from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResendVerificationOtpRequest,
    ResetPasswordRequest,
    SignUpRequest,
    TokenResponse,
    UserResponse,
    VerifyOtpRequest,
)
from app.schemas.common import MessageResponse
from app.services import auth_service
from app.services.email_service import EmailConfigurationError, EmailDeliveryError

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse)
async def signup(body: SignUpRequest):
    try:
        user, shop, _otp = await auth_service.register_user(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            shop_name=body.shop_name,
            business_type=body.business_type,
            phone=body.phone,
            address=body.address,
            city=body.city,
            state=body.state,
            country=body.country,
            currency=body.currency,
            gst_number=body.gst_number,
            default_tax_rate=body.default_tax_rate,
            logo_url=body.logo_url,
            upi_id=body.upi_id,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    except (EmailConfigurationError, EmailDeliveryError):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Could not send verification email")
    _, access, refresh = await auth_service.login_user(body.email, body.password)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    try:
        _, access, refresh = await auth_service.login_user(body.email, body.password)
    except ValueError as exc:
        message = str(exc)
        code = status.HTTP_403_FORBIDDEN if "disabled" in message.lower() or "deleted" in message.lower() else status.HTTP_401_UNAUTHORIZED
        raise HTTPException(code, message)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    try:
        access, refresh_tok = await auth_service.refresh_access_token(body.refresh_token)
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))
    return TokenResponse(access_token=access, refresh_token=refresh_tok)


@router.get("/me", response_model=UserResponse)
async def me(user: Annotated[dict, Depends(get_current_user)]):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        tenant_id=user.get("tenant_id"),
        is_verified=user.get("is_verified", False),
        permissions=auth_service.user_permissions(user["role"]),
    )


@router.post("/verify-otp", response_model=MessageResponse)
async def verify_otp(body: VerifyOtpRequest):
    try:
        await auth_service.verify_email_otp(body.email, body.otp)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except ValueError as exc:
        code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(code, str(exc))
    return MessageResponse(message="Email verified successfully")


@router.post("/resend-verification-otp", response_model=MessageResponse)
async def resend_verification_otp(body: ResendVerificationOtpRequest):
    try:
        await auth_service.create_email_verification_otp(body.email)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except (EmailConfigurationError, EmailDeliveryError):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Could not send verification email")
    return MessageResponse(message="If the email exists, a verification OTP has been sent")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest):
    try:
        await auth_service.create_password_reset_otp(body.email)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except EmailConfigurationError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Password reset email is not configured")
    except EmailDeliveryError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Could not send password reset email")
    return MessageResponse(message="If the email exists, an OTP has been sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest):
    try:
        await auth_service.reset_password_with_otp(body.email, body.otp, body.password)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return MessageResponse(message="Password reset successful")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(body: ChangePasswordRequest, user: Annotated[dict, Depends(get_current_user)]):
    try:
        await auth_service.change_password(user["id"], body.current_password, body.new_password)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return MessageResponse(message="Password changed successfully")
