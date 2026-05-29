from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from app.core.database import get_db
from app.models.base import serialize_doc, utc_now


async def ensure_default_plans() -> None:
    db = get_db()
    now = utc_now()
    if await db.subscription_plans.count_documents({}) > 0:
        await db.subscription_plans.update_many(
            {"is_single_subscribe": {"$exists": False}},
            {"$set": {"is_single_subscribe": False, "updated_at": now}},
        )
        await db.subscription_plans.update_one(
            {"code": "trial"},
            {"$set": {"is_active": False, "updated_at": now}},
        )
        return
    plans = [
        {
            "code": "starter",
            "name": "Starter",
            "price": 499,
            "currency": "INR",
            "duration_days": 30,
            "plan_type": "monthly",
            "features": ["billing", "inventory", "customers", "reports", "expenses"],
            "limits": {
                "products": 500,
                "monthly_invoices": 1000,
                "storage_mb": 1024,
                "analytics": True,
                "backup": False,
            },
            "is_active": True,
            "is_single_subscribe": False,
        },
        {
            "code": "growth",
            "name": "Growth",
            "price": 1499,
            "currency": "INR",
            "duration_days": 30,
            "plan_type": "monthly",
            "features": ["billing", "inventory", "customers", "reports", "expenses", "advanced_analytics", "backup"],
            "limits": {
                "products": 5000,
                "monthly_invoices": 10000,
                "storage_mb": 10240,
                "analytics": True,
                "backup": True,
            },
            "is_active": True,
            "is_single_subscribe": False,
        },
        {
            "code": "annual-growth",
            "name": "Annual Growth",
            "price": 14999,
            "currency": "INR",
            "duration_days": 365,
            "plan_type": "yearly",
            "features": ["billing", "inventory", "customers", "reports", "expenses", "advanced_analytics", "backup"],
            "limits": {
                "products": 10000,
                "monthly_invoices": 20000,
                "storage_mb": 20480,
                "analytics": True,
                "backup": True,
            },
            "is_active": True,
            "is_single_subscribe": False,
        },
    ]
    for plan in plans:
        await db.subscription_plans.update_one(
            {"code": plan["code"]},
            {"$setOnInsert": {**plan, "created_at": now}, "$set": {"updated_at": now}},
            upsert=True,
        )
    await db.subscription_plans.update_one(
        {"code": "trial"},
        {"$set": {"is_active": False, "updated_at": now}},
    )


async def create_pending_subscription(tenant_id: str, owner_user_id: str | None = None) -> dict:
    db = get_db()
    existing = await db.subscriptions.find_one({"tenant_id": tenant_id, "status": "pending"})
    if existing:
        return serialize_doc(existing)
    now = utc_now()
    doc = {
        "tenant_id": tenant_id,
        "plan_id": None,
        "plan_code": None,
        "plan_name": None,
        "status": "pending",
        "starts_at": None,
        "expires_at": None,
        "renews_at": None,
        "grace_until": None,
        "auto_renew": False,
        "payment_status": "unpaid",
        "created_by": owner_user_id,
        "created_at": now,
        "updated_at": now,
        "history": [{"event": "subscription_required", "at": now, "by": owner_user_id}],
    }
    result = await db.subscriptions.insert_one(doc)
    await db.shops.update_one(
        {"_id": ObjectId(tenant_id)},
        {"$set": {"subscription_plan": None, "subscription_status": "pending", "subscription_expires_at": None}},
    )
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


async def get_current_subscription(tenant_id: str, auto_create_pending: bool = False) -> dict | None:
    db = get_db()
    sub = await db.subscriptions.find_one({"tenant_id": tenant_id}, sort=[("created_at", -1)])
    if not sub and auto_create_pending:
        sub = await create_pending_subscription(tenant_id)
        return sub
    return serialize_doc(sub) if sub else None


async def get_plan(plan_code_or_id: str | None) -> dict | None:
    if not plan_code_or_id:
        return None
    db = get_db()
    query: dict[str, Any] = {"code": plan_code_or_id}
    if ObjectId.is_valid(plan_code_or_id):
        query = {"$or": [{"code": plan_code_or_id}, {"_id": ObjectId(plan_code_or_id)}]}
    plan = await db.subscription_plans.find_one(query)
    return serialize_doc(plan) if plan else None


def subscription_is_usable(subscription: dict | None) -> bool:
    if not subscription:
        return False
    if subscription.get("status") == "lifetime":
        return True
    if subscription.get("status") not in {"trialing", "active", "past_due"}:
        return False
    now = utc_now()
    expiry = _as_datetime(subscription.get("expires_at"))
    return bool(expiry and expiry >= now)


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


async def assert_subscription_active(tenant_id: str) -> dict:
    subscription = await get_current_subscription(tenant_id, auto_create_pending=True)
    if not subscription_is_usable(subscription):
        db = get_db()
        now = utc_now()
        subscription_id = subscription.get("id") if subscription else None
        if subscription_id and ObjectId.is_valid(subscription_id):
            await db.subscriptions.update_one(
                {"_id": ObjectId(subscription_id), "tenant_id": tenant_id, "status": {"$ne": "expired"}},
                {"$set": {"status": "expired", "updated_at": now}},
            )
        await db.shops.update_one(
            {"_id": ObjectId(tenant_id)},
            {"$set": {"subscription_status": "expired", "updated_at": now}},
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Subscription expired. Please renew to continue using the platform.",
        )
    return subscription


async def assert_feature_allowed(tenant_id: str, feature: str) -> dict:
    subscription = await assert_subscription_active(tenant_id)
    plan = await get_plan(subscription.get("plan_id") or subscription.get("plan_code"))
    features = set((plan or {}).get("features") or [])
    if feature not in features and "all" not in features:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your current plan does not include {feature}.")
    return subscription


async def assert_limit_available(tenant_id: str, limit_name: str) -> dict:
    subscription = await assert_subscription_active(tenant_id)
    plan = await get_plan(subscription.get("plan_id") or subscription.get("plan_code"))
    limits = (plan or {}).get("limits") or {}
    limit = limits.get(limit_name)
    if limit in (None, "", -1):
        return subscription
    db = get_db()
    if limit_name == "products":
        used = await db.products.count_documents({"tenant_id": tenant_id, "is_active": {"$ne": False}})
    elif limit_name == "monthly_invoices":
        now = utc_now()
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        used = await db.invoices.count_documents({"tenant_id": tenant_id, "created_at": {"$gte": start}})
    else:
        used = 0
    if used >= int(limit):
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, f"Plan limit reached for {limit_name}. Please upgrade.")
    return subscription


async def activate_subscription(
    tenant_id: str,
    plan_id: str,
    *,
    payment_status: str = "paid",
    created_by: str | None = None,
    auto_renew: bool = False,
) -> dict:
    db = get_db()
    plan = await get_plan(plan_id)
    if not plan or not plan.get("is_active", True):
        raise ValueError("Subscription plan is not available")
    if plan.get("is_single_subscribe", False):
        existing = await db.subscriptions.find_one({
            "tenant_id": tenant_id,
            "$or": [{"plan_id": plan["id"]}, {"plan_code": plan["code"]}],
        })
        if existing:
            raise ValueError("This plan can only be subscribed once per shop.")
    now = utc_now()
    duration_minutes = int(plan.get("duration_minutes") or 0)
    duration_days = int(plan.get("duration_days") or 0)
    status_value = "lifetime" if plan.get("plan_type") == "lifetime" else "active"
    expires_at = None if status_value == "lifetime" else now + (timedelta(minutes=duration_minutes) if duration_minutes > 0 else timedelta(days=max(duration_days, 1)))
    doc = {
        "tenant_id": tenant_id,
        "plan_id": plan["id"],
        "plan_code": plan["code"],
        "plan_name": plan["name"],
        "status": status_value,
        "starts_at": now,
        "expires_at": expires_at,
        "renews_at": expires_at if auto_renew else None,
        "grace_until": expires_at + timedelta(days=3) if expires_at else None,
        "auto_renew": auto_renew,
        "payment_status": payment_status,
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
        "history": [{"event": "activated", "at": now, "by": created_by, "plan": plan["code"]}],
    }
    await db.subscriptions.update_many({"tenant_id": tenant_id, "status": {"$in": ["pending", "trialing", "active", "past_due"]}}, {"$set": {"status": "replaced", "updated_at": now}})
    result = await db.subscriptions.insert_one(doc)
    await db.shops.update_one(
        {"_id": ObjectId(tenant_id)},
        {"$set": {"subscription_plan": plan["code"], "subscription_status": status_value, "subscription_expires_at": expires_at}},
    )
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


async def log_activity(
    *,
    user_id: str | None,
    tenant_id: str | None,
    action: str,
    module: str,
    metadata: dict | None = None,
) -> None:
    db = get_db()
    now = utc_now()
    await db.activity_logs.insert_one({
        "user_id": user_id,
        "tenant_id": tenant_id,
        "action": action,
        "module": module,
        "metadata": metadata or {},
        "created_at": now,
    })
    if user_id and ObjectId.is_valid(user_id):
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"last_active_at": now}})
