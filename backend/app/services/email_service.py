from email.message import EmailMessage
import asyncio
import base64
import logging

import aiosmtplib
import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailConfigurationError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


async def send_email(*, to_email: str, subject: str, html: str, text: str) -> None:
    if settings.GMAIL_CLIENT_ID and settings.GMAIL_CLIENT_SECRET and settings.GMAIL_REFRESH_TOKEN:
        await _send_email_via_gmail_api(to_email=to_email, subject=subject, html=html, text=text)
        return

    if settings.RESEND_API_KEY:
        await _send_email_via_resend(to_email=to_email, subject=subject, html=html, text=text)
        return

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


async def _send_email_via_resend(*, to_email: str, subject: str, html: str, text: str) -> None:
    from_email = settings.RESEND_FROM_EMAIL or "onboarding@resend.dev"
    if not from_email:
        raise EmailConfigurationError("Email sender is not configured")

    try:
        async with httpx.AsyncClient(timeout=settings.SMTP_TIMEOUT_SECONDS) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_email,
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                    "text": text,
                },
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.warning("Resend delivery failed for %s: %s", to_email, exc.response.text)
        raise EmailDeliveryError("Could not deliver email") from exc
    except httpx.HTTPError as exc:
        logger.warning("Resend connection failed for %s: %s", to_email, exc)
        raise EmailDeliveryError("Could not connect to email provider") from exc


async def _send_email_via_gmail_api(*, to_email: str, subject: str, html: str, text: str) -> None:
    sender_email = settings.GMAIL_SENDER_EMAIL or settings.SMTP_FROM or settings.SMTP_USER
    if not sender_email:
        raise EmailConfigurationError("Gmail sender email is not configured")

    message = EmailMessage()
    message["From"] = sender_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

    def send_message() -> None:
        creds = Credentials(
            token=None,
            refresh_token=settings.GMAIL_REFRESH_TOKEN,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GMAIL_CLIENT_ID,
            client_secret=settings.GMAIL_CLIENT_SECRET,
            scopes=["https://www.googleapis.com/auth/gmail.send"],
        )
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        service.users().messages().send(userId="me", body={"raw": raw_message}).execute()

    try:
        await asyncio.wait_for(asyncio.to_thread(send_message), timeout=settings.SMTP_TIMEOUT_SECONDS)
    except HttpError as exc:
        logger.warning("Gmail API delivery failed for %s: %s", to_email, exc)
        raise EmailDeliveryError("Could not deliver email") from exc
    except TimeoutError as exc:
        logger.warning("Gmail API delivery timed out for %s", to_email)
        raise EmailDeliveryError("Could not connect to Gmail API") from exc
    except Exception as exc:
        logger.warning("Gmail API delivery failed for %s: %s", to_email, exc)
        raise EmailDeliveryError("Could not deliver email") from exc


async def send_email_verification_email(*, to_email: str, otp: str) -> None:
    subject = "Sathi email verification OTP"
    text = (
        f"Hi,\n\n"
        f"Your Sathi email verification OTP is {otp}.\n\n"
        "This OTP is valid for 15 minutes. Do not share it with anyone.\n\n"
        "If you did not create a Sathi account, you can safely ignore this email.\n\n"
        "Team Sathi"
    )
    html = f"""
    <html>
      <body style="margin: 0; background: #f8fafc; font-family: Arial, sans-serif; color: #111827;">
        <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px;">
            <p style="margin: 0 0 10px; color: #4f46e5; font-size: 14px; font-weight: 700;">Sathi</p>
            <h2 style="margin: 0 0 12px; font-size: 22px;">Verify your email</h2>
            <p style="margin: 0 0 18px; line-height: 1.6; color: #475569;">Use this OTP to verify your Sathi account and continue setting up your shop.</p>
            <div style="background: #eef2ff; border-radius: 12px; padding: 18px; text-align: center;">
              <p style="margin: 0 0 8px; color: #475569; font-size: 13px;">Your verification code</p>
              <p style="font-size: 34px; font-weight: 800; letter-spacing: 6px; margin: 0; color: #111827;">{otp}</p>
            </div>
            <p style="margin: 18px 0 0; line-height: 1.6; color: #475569;">This OTP is valid for 15 minutes. Do not share it with anyone.</p>
            <p style="margin: 14px 0 0; color: #64748b; font-size: 13px;">If you did not create a Sathi account, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
    """
    await send_email(to_email=to_email, subject=subject, html=html, text=text)


async def send_password_reset_email(*, to_email: str, otp: str) -> None:
    subject = "Sathi password reset OTP"
    text = (
        f"Hi,\n\n"
        f"Your Sathi password reset OTP is {otp}.\n\n"
        "This OTP is valid for 10 minutes. Do not share it with anyone.\n\n"
        "If you did not request a password reset, you can safely ignore this email.\n\n"
        "Team Sathi"
    )
    html = f"""
    <html>
      <body style="margin: 0; background: #f8fafc; font-family: Arial, sans-serif; color: #111827;">
        <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px;">
            <p style="margin: 0 0 10px; color: #4f46e5; font-size: 14px; font-weight: 700;">Sathi</p>
            <h2 style="margin: 0 0 12px; font-size: 22px;">Reset your password</h2>
            <p style="margin: 0 0 18px; line-height: 1.6; color: #475569;">Use this OTP to reset your Sathi account password.</p>
            <div style="background: #eef2ff; border-radius: 12px; padding: 18px; text-align: center;">
              <p style="margin: 0 0 8px; color: #475569; font-size: 13px;">Your reset code</p>
              <p style="font-size: 34px; font-weight: 800; letter-spacing: 6px; margin: 0; color: #111827;">{otp}</p>
            </div>
            <p style="margin: 18px 0 0; line-height: 1.6; color: #475569;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
            <p style="margin: 14px 0 0; color: #64748b; font-size: 13px;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
    """
    await send_email(to_email=to_email, subject=subject, html=html, text=text)
