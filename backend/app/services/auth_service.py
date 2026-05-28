import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.core.database import get_db
from app.core.permissions import ROLE_PERMISSIONS, Role
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.base import new_id, serialize_doc, utc_now
from app.services.email_service import send_email_verification_email, send_password_reset_email
from app.services.subscription_service import create_pending_subscription, log_activity


def _slugify(name: str) -> str:
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or new_id()[:8]


def _as_aware_utc(value: datetime | None) -> datetime | None:
    if not value:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def register_user(
    email: str,
    password: str,
    full_name: str,
    shop_name: str,
    business_type: str,
    phone: str | None,
    address: str | None = None,
    city: str | None = None,
    state: str | None = None,
    country: str = "IN",
    currency: str = "INR",
    gst_number: str | None = None,
    default_tax_rate: float = 0,
    logo_url: str | None = None,
    upi_id: str | None = None,
):
    db = get_db()
    if await db.users.find_one({"email": email.lower()}):
        raise ValueError("Email already registered")

    tenant_id = new_id()
    slug = _slugify(shop_name)
    counter = 0
    while await db.shops.find_one({"slug": slug}):
        counter += 1
        slug = f"{_slugify(shop_name)}-{counter}"

    now = utc_now()
    shop_doc = {
        "_id": ObjectId(tenant_id) if len(tenant_id) == 24 else ObjectId(),
        "name": shop_name,
        "slug": slug,
        "business_type": business_type,
        "currency": currency,
        "timezone": "Asia/Kolkata",
        "address": address,
        "city": city,
        "state": state,
        "country": country,
        "phone": phone,
        "branding": {"logo_url": logo_url, "primary_color": "#6366f1", "accent_color": "#8b5cf6"},
        "payment": {
            "upi_id": upi_id,
            "upi_name": shop_name,
            "show_upi_qr_on_invoice": bool(upi_id),
            "whatsapp_bill_enabled": True,
        },
        "tax": {
            "gst_enabled": bool(gst_number),
            "gst_number": gst_number,
            "default_tax_rate": default_tax_rate,
            "tax_inclusive": False,
        },
        "invoice": {
            "prefix": "INV",
            "next_number": 1,
            "template_id": "modern",
            "terms": "Goods once sold can be returned only as per shop policy.",
            "footer_note": "Thank you for shopping with us.",
        },
        "subscription_plan": None,
        "subscription_status": "pending",
        "subscription_expires_at": None,
        "onboarding_completed": False,
        "created_at": now,
        "updated_at": now,
    }
    tenant_id = str(shop_doc["_id"])
    await db.shops.insert_one(shop_doc)

    user_id = ObjectId()
    otp = secrets.randbelow(900000) + 100000
    user_doc = {
        "_id": user_id,
        "email": email.lower(),
        "password_hash": hash_password(password),
        "full_name": full_name,
        "phone": phone,
        "role": Role.OWNER.value,
        "tenant_id": tenant_id,
        "is_active": True,
        "is_verified": False,
        "otp": str(otp),
        "otp_expires": now + timedelta(minutes=15),
        "refresh_tokens": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    await create_pending_subscription(tenant_id, str(user_id))
    await db.notifications.insert_one({
        "tenant_id": tenant_id,
        "user_id": str(user_id),
        "title": "Welcome to Sathi",
        "message": "Choose a subscription plan to activate your shop workspace.",
        "type": "welcome",
        "severity": "normal",
        "read": False,
        "created_at": now,
    })
    await send_email_verification_email(to_email=user_doc["email"], otp=str(otp))

    return serialize_doc(user_doc), serialize_doc(shop_doc), str(otp)


async def login_user(email: str, password: str) -> tuple[dict, str, str]:
    db = get_db()
    user = await db.users.find_one({"email": email.lower()})
    if not user or not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid credentials")
    if user.get("deleted_at"):
        raise ValueError("This account has been deleted. Please contact Sathi support.")
    if not user.get("is_active", True):
        reason = user.get("status_reason")
        if not reason and user.get("tenant_id"):
            shop = await db.shops.find_one({"_id": ObjectId(user["tenant_id"])})
            reason = (shop or {}).get("status_reason")
        message = f"Your account is disabled. Reason: {reason}" if reason else "Your account is disabled. Please contact the administrator."
        raise ValueError(message)

    user_id = str(user["_id"])
    extra = {
        "role": user["role"],
        "tenant_id": user.get("tenant_id"),
        "email": user["email"],
    }
    access = create_access_token(user_id, extra)
    refresh = create_refresh_token(user_id)
    now = utc_now()
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"last_login_at": now, "last_active_at": now},
            "$push": {"refresh_tokens": {"token": refresh, "created_at": now}},
        },
    )
    await db.login_history.insert_one({
        "user_id": user_id,
        "tenant_id": user.get("tenant_id"),
        "email": user["email"],
        "role": user["role"],
        "status": "success",
        "created_at": now,
    })
    await log_activity(user_id=user_id, tenant_id=user.get("tenant_id"), action="login", module="auth")
    return serialize_doc(user), access, refresh


async def refresh_access_token(refresh_token: str) -> tuple[str, str]:
    from app.core.security import decode_token

    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise ValueError("Invalid refresh token")
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise ValueError("User not found")
    stored = user.get("refresh_tokens", [])
    if not any(t.get("token") == refresh_token for t in stored):
        raise ValueError("Refresh token revoked")

    user_id = str(user["_id"])
    extra = {"role": user["role"], "tenant_id": user.get("tenant_id"), "email": user["email"]}
    return create_access_token(user_id, extra), refresh_token


async def create_password_reset_otp(email: str) -> bool:
    db = get_db()
    user = await db.users.find_one({"email": email.lower()})
    if not user:
        return False
    now = utc_now()
    otp = str(secrets.randbelow(900000) + 100000)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_reset_otp": otp,
                "password_reset_otp_expires": now + timedelta(minutes=10),
                "updated_at": now,
            }
        },
    )
    await send_password_reset_email(to_email=user["email"], otp=otp)
    return True


async def create_email_verification_otp(email: str) -> bool:
    db = get_db()
    user = await db.users.find_one({"email": email.lower()})
    if not user:
        return False
    if user.get("is_verified"):
        return True
    now = utc_now()
    otp = str(secrets.randbelow(900000) + 100000)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "otp": otp,
                "otp_expires": now + timedelta(minutes=15),
                "updated_at": now,
            }
        },
    )
    await send_email_verification_email(to_email=user["email"], otp=otp)
    return True


async def verify_email_otp(email: str, otp: str) -> None:
    db = get_db()
    user = await db.users.find_one({"email": email.lower()})
    if not user:
        raise ValueError("User not found")
    if user.get("is_verified"):
        return
    if user.get("otp") != otp:
        raise ValueError("Invalid OTP")
    expires_at = _as_aware_utc(user.get("otp_expires"))
    if expires_at and expires_at < utc_now():
        raise ValueError("OTP expired")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True, "updated_at": utc_now()}, "$unset": {"otp": "", "otp_expires": ""}},
    )


async def reset_password_with_otp(email: str, otp: str, password: str) -> None:
    db = get_db()
    user = await db.users.find_one({"email": email.lower()})
    if not user:
        raise ValueError("Invalid OTP or email")
    if user.get("password_reset_otp") != otp:
        raise ValueError("Invalid OTP or email")
    expires_at = _as_aware_utc(user.get("password_reset_otp_expires"))
    if expires_at and expires_at < utc_now():
        raise ValueError("OTP expired")
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(password), "refresh_tokens": [], "updated_at": utc_now()},
            "$unset": {"password_reset_otp": "", "password_reset_otp_expires": ""},
        },
    )


async def change_password(user_id: str, current_password: str, new_password: str) -> None:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not verify_password(current_password, user["password_hash"]):
        raise ValueError("Current password is incorrect")
    if verify_password(new_password, user["password_hash"]):
        raise ValueError("New password must be different from current password")
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(new_password), "refresh_tokens": [], "updated_at": utc_now()},
        },
    )


def user_permissions(role: str) -> list[str]:
    try:
        r = Role(role)
        return [p.value for p in ROLE_PERMISSIONS.get(r, set())]
    except ValueError:
        return []
