"""
Resend email service - unified outbound transactional email for all of Etheria.

Replaces direct smtplib usage everywhere. Uses Resend's HTTPS API (no extra SDK).
Inbound IMAP polling stays on Gmail (Resend is send-only).

Usage:
    from services.email_service import send_email
    success = await send_email(
        to="user@example.com",
        subject="Hello",
        html="<p>Hi!</p>",
        text="Hi!",  # optional plaintext fallback
    )
"""
import os
import logging
from typing import Optional, Union, List

import httpx
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "dev@etheriasystems.online")
RESEND_FROM_NAME = os.getenv("RESEND_FROM_NAME", "Etheria")
RESEND_API_URL = "https://api.resend.com/emails"

# Build the canonical "Name <email@domain>" format Resend expects.
_FROM = f"{RESEND_FROM_NAME} <{RESEND_FROM_EMAIL}>" if RESEND_FROM_NAME else RESEND_FROM_EMAIL


async def send_email(
    to: Union[str, List[str]],
    subject: str,
    html: str,
    text: Optional[str] = None,
    reply_to: Optional[str] = None,
    from_override: Optional[str] = None,
) -> bool:
    """
    Send a transactional email via Resend.

    Returns True on success, False on any failure. Errors are logged but never raised
    so a single email failure cannot break a larger request flow.
    """
    if not RESEND_API_KEY:
        logging.error("[Email] RESEND_API_KEY not configured — email NOT sent")
        return False

    payload = {
        "from": from_override or _FROM,
        "to": [to] if isinstance(to, str) else to,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if reply_to:
        payload["reply_to"] = reply_to

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(RESEND_API_URL, json=payload, headers=headers)
            if resp.status_code in (200, 201, 202):
                logging.info(f"[Email] Sent to {payload['to']} (subject={subject!r})")
                return True
            logging.error(
                f"[Email] Resend failure {resp.status_code} for {payload['to']}: {resp.text}"
            )
            return False
    except Exception as e:
        logging.error(f"[Email] Exception sending to {payload['to']}: {e}")
        return False


def send_email_sync(
    to: Union[str, List[str]],
    subject: str,
    html: str,
    text: Optional[str] = None,
    reply_to: Optional[str] = None,
    from_override: Optional[str] = None,
) -> bool:
    """Synchronous wrapper for legacy code that isn't async."""
    if not RESEND_API_KEY:
        logging.error("[Email] RESEND_API_KEY not configured — email NOT sent")
        return False

    payload = {
        "from": from_override or _FROM,
        "to": [to] if isinstance(to, str) else to,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if reply_to:
        payload["reply_to"] = reply_to

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(RESEND_API_URL, json=payload, headers=headers)
            if resp.status_code in (200, 201, 202):
                logging.info(f"[Email] Sent (sync) to {payload['to']} (subject={subject!r})")
                return True
            logging.error(
                f"[Email] Resend failure (sync) {resp.status_code} for {payload['to']}: {resp.text}"
            )
            return False
    except Exception as e:
        logging.error(f"[Email] Exception (sync) sending to {payload['to']}: {e}")
        return False
