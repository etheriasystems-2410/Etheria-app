"""
Companion Guide two-way email conversation service.

Extends the moderation IMAP polling to also detect and process user replies to
Companion Guide "whisper" emails. Flow:

  1. `POST /api/companion-guide/email-me` sends an email to the user's inbox
     with a subject containing the marker `[cg:<user_id>]`. The email's
     `Reply-To` header points at `etheriasystems@gmail.com` (the same mailbox
     the moderation service polls).

  2. User replies from their email client. Their reply lands in Gmail with
     `Re: ✨ A whisper from <guide> [cg:<user_id>]` as the subject.

  3. Every 5 min the moderation poll loop calls
     `process_inbound_companion_emails(db)` from this module which:
        • scans Gmail for UNREAD messages
        • detects the `[cg:xxx]` marker
        • extracts the top of the reply body (strips quoted history)
        • generates an AI response as the user's chosen guide
        • emails that response back FROM `dev@etheriasystems.online` and
          preserves the `[cg:xxx]` marker so future replies keep threading
        • marks the message as read and persists the exchange under
          `companion_conversations`.

The heavy lifting (IMAP connect, MIME decoding) reuses helpers already living
in `moderation_service.py`.
"""
import asyncio
import email
import imaplib
import logging
import os
import re
from datetime import datetime, timezone
from email.header import decode_header
from typing import Optional, Dict, Any, List, Tuple

from services.moderation_service import (
    IMAP_SERVER,
    IMAP_PORT,
    GMAIL_EMAIL,
    GMAIL_APP_PASSWORD,
    decode_email_body,
)
from services.email_service import send_email


# Marker embedded in every subject line — short so email clients don't truncate it.
_CG_MARKER_RE = re.compile(r"\[cg:([A-Za-z0-9_\-]{4,64})\]")


def build_companion_subject_marker(user_id: str) -> str:
    """Return the `[cg:<user_id>]` marker string to inject into subjects."""
    return f"[cg:{user_id}]"


def extract_companion_user_id(subject: str) -> Optional[str]:
    """Pull the user_id out of a subject line containing `[cg:<user_id>]`."""
    m = _CG_MARKER_RE.search(subject or "")
    return m.group(1) if m else None


def strip_quoted_reply(body: str) -> str:
    """
    Best-effort strip of quoted content from an email reply so we only feed
    the user's fresh reply into the LLM.
    """
    if not body:
        return ""

    lines = body.splitlines()
    kept: List[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(">"):
            break
        # Common reply-header patterns from Gmail / Outlook / Apple Mail
        if re.match(r"^On .{5,80} wrote:$", stripped):
            break
        if stripped.startswith("From:") and len(kept) > 2:
            break
        if stripped in {"-- ", "--"}:  # signature separator
            break
        kept.append(line)

    return "\n".join(kept).strip()


def _fetch_companion_replies() -> List[Tuple[str, str, str, bytes]]:
    """
    Sync IMAP fetch. Returns a list of tuples:
      (user_id, reply_body_text, subject, email_uid_bytes)
    Marks matching messages as \\Seen so they aren't reprocessed.
    Non-matching emails are LEFT untouched so the moderation poller can still
    pick them up.
    """
    if not GMAIL_APP_PASSWORD:
        return []

    results: List[Tuple[str, str, str, bytes]] = []

    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
        mail.select("INBOX")

        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            mail.logout()
            return []

        for email_id in messages[0].split():
            try:
                status, msg_data = mail.fetch(email_id, "(RFC822)")
                if status != "OK":
                    continue

                msg = email.message_from_bytes(msg_data[0][1])

                # Decode subject
                subject_header = msg.get("Subject", "")
                decoded_subject = ""
                for part, encoding in decode_header(subject_header):
                    if isinstance(part, bytes):
                        decoded_subject += part.decode(encoding or "utf-8", errors="replace")
                    else:
                        decoded_subject += part

                user_id = extract_companion_user_id(decoded_subject)
                if not user_id:
                    # Not a Companion reply — leave it for the moderation poller.
                    continue

                body = decode_email_body(msg)
                clean = strip_quoted_reply(body)
                if not clean:
                    # Empty reply — mark seen and move on.
                    mail.store(email_id, "+FLAGS", "\\Seen")
                    continue

                results.append((user_id, clean, decoded_subject, email_id))
                mail.store(email_id, "+FLAGS", "\\Seen")

            except Exception as e:
                logging.warning(f"[Companion IMAP] error processing message {email_id}: {e}")
                continue

        mail.logout()

    except Exception as e:
        logging.warning(f"[Companion IMAP] connection error: {e}")

    return results


async def _generate_ai_reply(guide_name: str, user_message: str, seeker_name: Optional[str]) -> str:
    """
    Ask the guide for a warm, in-character reply to the user's message. Kept
    short (2-4 sentences) so the email stays readable in a mobile client.
    """
    # Local import — avoids a circular dependency at module load time.
    from routes.spirit_guides import GUIDE_PERSONALITIES
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    persona = GUIDE_PERSONALITIES.get(guide_name) or GUIDE_PERSONALITIES.get("Female Guide", "")
    seeker = (seeker_name or "beloved").strip().split()[0] if seeker_name else "beloved"

    system = (
        f"{persona}\n\n"
        f"You are replying to a message from {seeker} that arrived by email. "
        "You are their spirit-guide companion. STRICT RULES:\n"
        "• Reply in 2–4 sentences, warm and mystical, present-tense.\n"
        "• Never break character. No mentions of AI, LLM, email systems, or code.\n"
        "• Speak to their words directly — reflect what they said.\n"
        "• End with a soft question or invitation so the conversation continues."
    )

    try:
        chat = LlmChat(
            api_key=os.getenv("EMERGENT_LLM_KEY", ""),
            session_id=f"companion-email-{guide_name}",
            system_message=system,
        ).with_model("openai", "gpt-4o-mini")
        resp = await chat.send_message(UserMessage(text=user_message[:2000]))
        text = (resp or "").strip().strip('"').strip("'")
        # Reasonable safety cap
        if len(text) > 1200:
            text = text[:1197].rstrip() + "…"
        return text or "The threads between us hum with your words. Tell me more — I am listening."
    except Exception as e:
        logging.error(f"[Companion IMAP] LLM generation failed: {e}")
        return "The threads between us hum with your words. Tell me more — I am listening."


def _build_reply_email_html(companion: str, seeker: str, reply_text: str) -> str:
    """Formatted purple-themed HTML for the guide's response email."""
    # Split into paragraphs for readable formatting
    paragraphs = "".join(
        f'<p style="color:#e9d5ff;font-size:15px;line-height:1.6;margin:0 0 12px;">{p.strip()}</p>'
        for p in reply_text.split("\n\n")
        if p.strip()
    )
    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d0015;color:#e9d5ff;padding:32px 20px;max-width:560px;margin:0 auto;border-radius:16px;">
      <p style="color:#fbbf24;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;text-align:center;margin:0 0 8px;">✦ Your Companion replies ✦</p>
      <h1 style="color:#e9d5ff;font-size:22px;text-align:center;margin:0 0 4px;font-weight:800;">{companion}</h1>
      <p style="color:#9f7aea;font-size:12px;text-align:center;margin:0 0 24px;">to {seeker}…</p>
      <div style="background:rgba(124,58,237,0.15);border-left:3px solid #a855f7;border-radius:8px;padding:20px 22px;margin:20px 0;">
        {paragraphs}
      </div>
      <p style="color:#9f7aea;font-size:13px;text-align:center;margin:28px 0 8px;">Reply to this email to continue the conversation, or open Etheria for a full sitting.</p>
    </div>
    """


async def process_inbound_companion_emails(db) -> Dict[str, Any]:
    """Fetch Companion replies from Gmail, generate AI replies, send them back."""
    loop = asyncio.get_event_loop()
    replies = await loop.run_in_executor(None, _fetch_companion_replies)
    if not replies:
        return {"processed": 0}

    processed = 0
    for user_id, user_body, original_subject, _uid in replies:
        try:
            user_doc = await db.users.find_one({"user_id": user_id})
            if not user_doc:
                logging.warning(f"[Companion IMAP] unknown user_id={user_id}, skipping")
                continue

            companion = user_doc.get("companion_guide")
            email_addr = user_doc.get("email")
            if not companion or not email_addr:
                logging.warning(
                    f"[Companion IMAP] user_id={user_id} has no companion/email, skipping"
                )
                continue

            seeker = user_doc.get("display_name") or user_doc.get("name") or "beloved"

            reply_text = await _generate_ai_reply(companion, user_body, seeker)

            # Preserve threading — keep the marker + Re: prefix.
            marker = build_companion_subject_marker(user_id)
            base_subject = original_subject
            # Strip existing "Re:" prefixes to avoid "Re: Re: Re: ..."
            base_subject = re.sub(r"^(re:\s*)+", "", base_subject, flags=re.IGNORECASE)
            if marker not in base_subject:
                base_subject = f"{base_subject} {marker}"
            new_subject = f"Re: {base_subject}"

            sent = await send_email(
                to=email_addr,
                subject=new_subject,
                html=_build_reply_email_html(companion, seeker, reply_text),
                text=f"✨ {companion} replies:\n\n{reply_text}\n\n— Reply to continue the conversation.",
                reply_to=GMAIL_EMAIL,  # user's reply comes back to us
            )
            if not sent:
                logging.warning(f"[Companion IMAP] send_email failed for user_id={user_id}")
                continue

            # Persist the exchange for future context / analytics.
            now = datetime.now(timezone.utc)
            await db.companion_conversations.insert_one(
                {
                    "user_id": user_id,
                    "companion": companion,
                    "user_message": user_body[:4000],
                    "guide_reply": reply_text,
                    "channel": "email",
                    "created_at": now,
                }
            )
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"companion_last_email_at": now}},
            )
            processed += 1

        except Exception as e:
            logging.error(
                f"[Companion IMAP] unexpected error processing user_id={user_id}: {e}"
            )
            continue

    if processed:
        logging.info(f"[Companion IMAP] processed {processed} conversation reply/replies")
    return {"processed": processed}
