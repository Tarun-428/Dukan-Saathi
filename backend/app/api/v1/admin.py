import secrets
from datetime import timedelta
from typing import Annotated, Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import hash_password
from app.models.base import serialize_doc, utc_now
from app.services.automation_service import run_subscription_reminders
from app.services.subscription_service import activate_subscription, get_plan

router = APIRouter(prefix="/admin", tags=["Platform Admin"])


def _require_admin(user: dict) -> None:
    if user.get("role") not in {"super_admin", "admin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform admin only")


class PlanPayload(BaseModel):
    code: str = Field(min_length=2)
    name: str
    price: float = Field(ge=0)
    currency: str = "INR"
    duration_days: int = Field(default=30, ge=0)
    duration_minutes: int = Field(default=0, ge=0)
    plan_type: str = "monthly"
    features: list[str] = []
    limits: dict[str, Any] = {}
    is_active: bool = True
    is_single_subscribe: bool = False


class StatusPayload(BaseModel):
    is_active: bool
    reason: Optional[str] = None


class ResetPasswordPayload(BaseModel):
    new_password: Optional[str] = Field(default=None, min_length=8)


class AssignSubscriptionPayload(BaseModel):
    tenant_id: str
    plan_id: str
    auto_renew: bool = False
    payment_status: str = "paid"


class AdminNotificationPayload(BaseModel):
    title: str
    message: str
    type: str = "admin"
    severity: str = "normal"
    target: str = "all"
    tenant_ids: list[str] = []
    plan_code: Optional[str] = None
    action_url: Optional[str] = None
    scheduled_at: Optional[str] = None


class PaymentRecordPayload(BaseModel):
    tenant_id: str
    plan_id: str
    amount: float = Field(ge=0)
    provider: str = "manual"
    provider_payment_id: Optional[str] = None
    status: str = "paid"
    notes: Optional[str] = None


@router.get("/analytics")
async def platform_analytics(user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    now = utc_now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total_tenants = await db.shops.count_documents({"deleted_at": {"$exists": False}})
    total_users = await db.users.count_documents({"deleted_at": {"$exists": False}})
    active_users = await db.users.count_documents({"is_active": True, "deleted_at": {"$exists": False}})
    expired = await db.subscriptions.count_documents({"status": {"$in": ["expired", "cancelled"]}})
    active_subscriptions = await db.subscriptions.count_documents({"status": {"$in": ["active", "lifetime"]}})
    pending_subscriptions = await db.subscriptions.count_documents({"status": "pending"})
    expiring_soon = await db.subscriptions.count_documents({
        "status": {"$in": ["trialing", "active", "past_due"]},
        "expires_at": {"$gte": now, "$lte": now + timedelta(days=7)},
    })
    revenue = await db.subscription_payments.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "month": {"$sum": {"$cond": [{"$gte": ["$created_at", month_start]}, "$amount", 0]}}}},
    ]).to_list(1)
    plan_stats = await db.subscriptions.aggregate([
        {"$match": {"status": {"$in": ["trialing", "active", "past_due", "lifetime"]}}},
        {"$group": {"_id": "$plan_code", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(None)
    most_active = await db.activity_logs.aggregate([
        {"$match": {"created_at": {"$gte": now - timedelta(days=30)}}},
        {"$group": {"_id": "$user_id", "actions": {"$sum": 1}, "last_active": {"$max": "$created_at"}}},
        {"$sort": {"actions": -1}},
        {"$limit": 8},
    ]).to_list(8)
    notification_stats = await db.notifications.aggregate([
        {"$group": {"_id": "$read", "count": {"$sum": 1}}},
    ]).to_list(None)
    return {
        "total_tenants": total_tenants,
        "total_users": total_users,
        "active_users": active_users,
        "expired_subscriptions": expired,
        "active_subscriptions": active_subscriptions,
        "pending_subscriptions": pending_subscriptions,
        "expiring_soon": expiring_soon,
        "subscription_revenue": revenue[0]["total"] if revenue else 0,
        "monthly_revenue": revenue[0]["month"] if revenue else 0,
        "plan_stats": plan_stats,
        "most_active_users": most_active,
        "notification_stats": notification_stats,
    }


@router.get("/tenants")
async def list_tenants(
    user: Annotated[dict, Depends(get_current_user)],
    search: str = "",
    status_filter: str = Query("", alias="status"),
    plan: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    _require_admin(user)
    db = get_db()
    filt: dict[str, Any] = {"deleted_at": {"$exists": False}}
    if search:
        filt["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"slug": {"$regex": search, "$options": "i"}},
        ]
    if status_filter:
        filt["subscription_status"] = status_filter
    if plan:
        filt["subscription_plan"] = plan
    total = await db.shops.count_documents(filt)
    shops = await db.shops.find(filt).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    shop_ids = [str(s["_id"]) for s in shops]
    owners = await db.users.find({"tenant_id": {"$in": shop_ids}, "role": "owner"}).to_list(None)
    owner_by_tenant = {u["tenant_id"]: serialize_doc(u) for u in owners}
    return {
        "items": [{**serialize_doc(shop), "owner": owner_by_tenant.get(str(shop["_id"]))} for shop in shops],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.patch("/tenants/{tenant_id}/status")
async def update_tenant_status(tenant_id: str, body: StatusPayload, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    if not ObjectId.is_valid(tenant_id):
        raise HTTPException(400, "Invalid tenant id")
    now = utc_now()
    await db.shops.update_one({"_id": ObjectId(tenant_id)}, {"$set": {"is_active": body.is_active, "status_reason": body.reason, "updated_at": now}})
    await db.users.update_many({"tenant_id": tenant_id}, {"$set": {"is_active": body.is_active, "status_reason": body.reason, "updated_at": now}})
    await db.audit_logs.insert_one({"tenant_id": tenant_id, "actor_id": user["id"], "action": "tenant_status_changed", "metadata": body.model_dump(), "created_at": now})
    return {"message": "Tenant status updated"}


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    if not ObjectId.is_valid(tenant_id):
        raise HTTPException(400, "Invalid tenant id")
    now = utc_now()
    shop = await db.shops.find_one({"_id": ObjectId(tenant_id)})
    if not shop:
        raise HTTPException(404, "Tenant not found")
    tenant_users = await db.users.find({"tenant_id": tenant_id}).to_list(None)
    tenant_user_ids = [str(item["_id"]) for item in tenant_users]
    tenant_object_user_ids = [item["_id"] for item in tenant_users]

    tenant_collections = [
        db.products,
        db.invoices,
        db.customers,
        db.customer_payments,
        db.invoice_edits,
        db.expenses,
        db.stock_movements,
        db.notifications,
        db.audit_logs,
        db.activity_logs,
        db.subscriptions,
        db.subscription_payments,
    ]
    deleted_counts: dict[str, int] = {}
    for collection in tenant_collections:
        result = await collection.delete_many({"tenant_id": tenant_id})
        deleted_counts[collection.name] = result.deleted_count
    if tenant_user_ids:
        deleted_counts["login_history"] = (await db.login_history.delete_many({"user_id": {"$in": tenant_user_ids}})).deleted_count
        deleted_counts["sessions"] = (await db.sessions.delete_many({"user_id": {"$in": tenant_user_ids + tenant_object_user_ids}})).deleted_count
    deleted_counts["users"] = (await db.users.delete_many({"tenant_id": tenant_id})).deleted_count
    deleted_counts["shops"] = (await db.shops.delete_one({"_id": ObjectId(tenant_id)})).deleted_count
    await db.audit_logs.insert_one({
        "tenant_id": None,
        "actor_id": user["id"],
        "action": "tenant_hard_deleted",
        "metadata": {"tenant_id": tenant_id, "shop_name": shop.get("name"), "deleted_counts": deleted_counts},
        "created_at": now,
    })
    return {"message": "Tenant and all related data deleted", "deleted_counts": deleted_counts}


@router.post("/users/{user_id}/force-logout")
async def force_logout(user_id: str, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"refresh_tokens": [], "force_logout_at": utc_now()}})
    return {"message": "User sessions revoked"}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, body: ResetPasswordPayload, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    password = body.new_password or secrets.token_urlsafe(10)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"password_hash": hash_password(password), "refresh_tokens": [], "updated_at": utc_now()}})
    return {"message": "Password reset", "temporary_password": password}


@router.get("/plans")
async def list_plans(user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    plans = await db.subscription_plans.find().sort("price", 1).to_list(None)
    return [serialize_doc(p) for p in plans]


@router.post("/plans")
async def create_plan(body: PlanPayload, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    now = utc_now()
    doc = {**body.model_dump(), "created_at": now, "updated_at": now}
    result = await db.subscription_plans.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.patch("/plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanPayload, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    query: dict[str, Any] = {"code": plan_id}
    if ObjectId.is_valid(plan_id):
        query = {"_id": ObjectId(plan_id)}
    updated = await db.subscription_plans.find_one_and_update(query, {"$set": {**body.model_dump(), "updated_at": utc_now()}}, return_document=True)
    if not updated:
        raise HTTPException(404, "Plan not found")
    return serialize_doc(updated)


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    query: dict[str, Any] = {"code": plan_id}
    if ObjectId.is_valid(plan_id):
        query = {"_id": ObjectId(plan_id)}
    result = await db.subscription_plans.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(404, "Plan not found")
    return {"message": "Plan deleted"}


@router.post("/subscriptions/assign")
async def assign_subscription(body: AssignSubscriptionPayload, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    try:
        subscription = await activate_subscription(
            body.tenant_id,
            body.plan_id,
            payment_status=body.payment_status,
            created_by=user["id"],
            auto_renew=body.auto_renew,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return subscription


@router.get("/payments")
async def list_payments(user: Annotated[dict, Depends(get_current_user)], tenant_id: str = "", page_size: int = Query(50, ge=1, le=100)):
    _require_admin(user)
    db = get_db()
    filt = {"tenant_id": tenant_id} if tenant_id else {}
    payments = await db.subscription_payments.find(filt).sort("created_at", -1).limit(page_size).to_list(page_size)
    return [serialize_doc(p) for p in payments]


@router.post("/payments")
async def record_payment(body: PaymentRecordPayload, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    plan = await get_plan(body.plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    now = utc_now()
    doc = {
        **body.model_dump(exclude_none=True),
        "plan_code": plan["code"],
        "plan_name": plan["name"],
        "recorded_by": user["id"],
        "created_at": now,
    }
    result = await db.subscription_payments.insert_one(doc)
    if body.status == "paid":
        await activate_subscription(body.tenant_id, body.plan_id, payment_status="paid", created_by=user["id"])
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.post("/notifications/broadcast")
async def broadcast_notification(body: AdminNotificationPayload, user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    db = get_db()
    tenant_filter: dict[str, Any] = {"deleted_at": {"$exists": False}}
    if body.target == "selected":
        tenant_filter["_id"] = {"$in": [ObjectId(t) for t in body.tenant_ids if ObjectId.is_valid(t)]}
    elif body.target == "plan" and body.plan_code:
        tenant_filter["subscription_plan"] = body.plan_code
    shops = await db.shops.find(tenant_filter).to_list(None)
    now = utc_now()
    docs = [{
        "tenant_id": str(shop["_id"]),
        "user_id": None,
        "title": body.title,
        "message": body.message,
        "type": body.type,
        "severity": body.severity,
        "action_url": body.action_url,
        "scheduled_at": body.scheduled_at,
        "read": False,
        "created_by": user["id"],
        "created_at": now,
    } for shop in shops]
    if docs:
        await db.notifications.insert_many(docs)
    return {"message": "Notification queued", "recipients": len(docs)}


@router.get("/activity")
async def activity_logs(user: Annotated[dict, Depends(get_current_user)], tenant_id: str = "", page_size: int = Query(100, ge=1, le=200)):
    _require_admin(user)
    db = get_db()
    filt = {"tenant_id": tenant_id} if tenant_id else {}
    logs = await db.activity_logs.find(filt).sort("created_at", -1).limit(page_size).to_list(page_size)
    return [serialize_doc(log) for log in logs]


@router.get("/login-history")
async def login_history(user: Annotated[dict, Depends(get_current_user)], user_id: str = "", page_size: int = Query(100, ge=1, le=200)):
    _require_admin(user)
    db = get_db()
    filt = {"user_id": user_id} if user_id else {}
    rows = await db.login_history.find(filt).sort("created_at", -1).limit(page_size).to_list(page_size)
    return [serialize_doc(row) for row in rows]


@router.post("/automations/subscription-reminders/run")
async def run_subscription_automation(user: Annotated[dict, Depends(get_current_user)]):
    _require_admin(user)
    return await run_subscription_reminders()
