from email.message import EmailMessage
import logging

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailConfigurationError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


async def send_email(*, to_email: str, subject: str, html: str, text: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise EmailConfigurationError("SMTP is not configured")

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    use_tls = settings.SMTP_USE_TLS or settings.SMTP_PORT == 465
    start_tls = False if use_tls else settings.SMTP_START_TLS

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=use_tls,
            start_tls=start_tls,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        )
    except aiosmtplib.SMTPException as exc:
        logger.warning("SMTP delivery failed for %s: %s", to_email, exc)
        raise EmailDeliveryError("Could not deliver email") from exc
    except (OSError, TimeoutError) as exc:
        logger.warning("SMTP connection failed for %s: %s", to_email, exc)
        raise EmailDeliveryError("Could not connect to SMTP server") from exc


async def send_email_verification_email(*, to_email: str, otp: str) -> None:
    subject = "Sathi email verification OTP"
    text = (
        f"Your Sathi email verification OTP is {otp}.\n"
        "This OTP is valid for 15 minutes.\n"
        "If you did not create a Sathi account, you can ignore this email."
    )
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2 style="margin-bottom: 8px;">Verify your email</h2>
        <p>Your Sathi verification OTP is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">{otp}</p>
        <p>This OTP is valid for 15 minutes.</p>
        <p>If you did not create a Sathi account, you can ignore this email.</p>
      </body>
    </html>
    """
    await send_email(to_email=to_email, subject=subject, html=html, text=text)


async def send_password_reset_email(*, to_email: str, otp: str) -> None:
    subject = "Sathi password reset OTP"
    text = (
        f"Your Sathi password reset OTP is {otp}.\n"
        "This OTP is valid for 10 minutes.\n"
        "If you did not request a password reset, you can ignore this email."
    )
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2 style="margin-bottom: 8px;">Password reset request</h2>
        <p>Your Sathi password reset OTP is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">{otp}</p>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      </body>
    </html>
    """
    await send_email(to_email=to_email, subject=subject, html=html, text=text)
