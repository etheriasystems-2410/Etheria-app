"""Profile routes — GET/PUT my profile, GET others, and the Mail-to email forwarder."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from .deps import db
from .auth_utils import get_current_user
from .profile_utils import now
from services.email_service import send_email

# Local re-import of _public_profile so each router stays self-contained
from .profile_utils import _public_profile, _profile_stats  # noqa: F401

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=60)
    bio: Optional[str] = Field(None, max_length=400)            # "About Me"
    birthday: Optional[str] = Field(None, max_length=10)
    location: Optional[str] = Field(None, max_length=80)
    favorite_guide: Optional[str] = Field(None, max_length=60)
    psychic_interests: Optional[List[str]] = None
    # Lifestyle / spirit details
    hobbies: Optional[str] = Field(None, max_length=400)
    favorite_things: Optional[str] = Field(None, max_length=400)
    dislikes: Optional[str] = Field(None, max_length=400)
    other_details: Optional[str] = Field(None, max_length=600)
    # "The Path I Walk" — religion / faith group
    path_walked: Optional[str] = Field(None, max_length=400)
    in_coven: Optional[bool] = None
    coven_name: Optional[str] = Field(None, max_length=120)
    deities_followed: Optional[str] = Field(None, max_length=400)
    # Psychic family / self disclosures
    family_has_psychic_talent: Optional[bool] = None
    family_psychic_details: Optional[str] = Field(None, max_length=600)
    self_has_psychic_talent: Optional[bool] = None
    self_psychic_details: Optional[str] = Field(None, max_length=600)
    # Story
    why_etheria: Optional[str] = Field(None, max_length=600)
    # Avatar (base64 data-URI or HTTPS URL — frontend image-picker compresses)
    picture: Optional[str] = Field(None, max_length=2_000_000)
    # Show progress stats on public profile?
    show_progress: Optional[bool] = None


@router.get("/me")
async def get_my_profile(user: dict = Depends(get_current_user)):
    """My full profile (including email — never returned for others)."""
    doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    p = await _public_profile(doc, viewer_id=user["user_id"])
    # Include email + plan only for self
    p["email"] = doc.get("email")
    p["subscription_plan"] = doc.get("subscription_plan")
    p["subscription_expires_at"] = doc.get("subscription_expires_at")
    return p


@router.put("/me")
async def update_my_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    """Update my profile. Only the writable fields above can be changed."""
    update: dict = {}
    if body.name is not None:
        n = body.name.strip()
        if n:
            update["display_name"] = n
            # Keep `name` in sync so legacy code keeps working
            update["name"] = n
    if body.bio is not None:
        update["bio"] = body.bio.strip()
    if body.birthday is not None:
        update["birthday"] = body.birthday.strip()
    if body.location is not None:
        update["location"] = body.location.strip()
    if body.favorite_guide is not None:
        update["favorite_guide"] = body.favorite_guide.strip()
    if body.psychic_interests is not None:
        # Coerce + dedupe + cap at 12 short tags
        cleaned = []
        seen = set()
        for t in body.psychic_interests:
            t = str(t).strip()[:40]
            if t and t.lower() not in seen:
                seen.add(t.lower())
                cleaned.append(t)
            if len(cleaned) >= 12:
                break
        update["psychic_interests"] = cleaned
    if body.hobbies is not None:
        update["hobbies"] = body.hobbies.strip()
    if body.favorite_things is not None:
        update["favorite_things"] = body.favorite_things.strip()
    if body.dislikes is not None:
        update["dislikes"] = body.dislikes.strip()
    if body.other_details is not None:
        update["other_details"] = body.other_details.strip()
    if body.path_walked is not None:
        update["path_walked"] = body.path_walked.strip()
    if body.in_coven is not None:
        update["in_coven"] = bool(body.in_coven)
    if body.coven_name is not None:
        update["coven_name"] = body.coven_name.strip()
    if body.deities_followed is not None:
        update["deities_followed"] = body.deities_followed.strip()
    if body.family_has_psychic_talent is not None:
        update["family_has_psychic_talent"] = bool(body.family_has_psychic_talent)
    if body.family_psychic_details is not None:
        update["family_psychic_details"] = body.family_psychic_details.strip()
    if body.self_has_psychic_talent is not None:
        update["self_has_psychic_talent"] = bool(body.self_has_psychic_talent)
    if body.self_psychic_details is not None:
        update["self_psychic_details"] = body.self_psychic_details.strip()
    if body.why_etheria is not None:
        update["why_etheria"] = body.why_etheria.strip()
    if body.picture is not None:
        pic = body.picture.strip()
        if pic and not pic.startswith(("data:image/", "http")):
            raise HTTPException(status_code=400, detail="Picture must be a data URI or HTTPS URL")
        update["picture"] = pic
    if body.show_progress is not None:
        update["show_progress"] = bool(body.show_progress)

    if not update:
        return {"success": True, "updated": False}

    update["profile_updated_at"] = now()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    return {"success": True, "profile": await _public_profile(doc, viewer_id=user["user_id"])}


@router.get("/{user_id}")
async def get_user_profile(user_id: str, viewer: dict = Depends(get_current_user)):
    """View someone else's profile. Email is NEVER exposed."""
    doc = await db.users.find_one({"user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return await _public_profile(doc, viewer_id=viewer["user_id"])


# ---------------------------------------------------------------------------
# Email-forwarding (the "Mail to" button)
# ---------------------------------------------------------------------------
class EmailForwardBody(BaseModel):
    subject: str = Field(..., min_length=1, max_length=140)
    body: str = Field(..., min_length=1, max_length=4000)


@router.post("/{user_id}/email")
async def email_to_user(user_id: str, body: EmailForwardBody, sender: dict = Depends(get_current_user)):
    """Server-side proxy email. The recipient's address stays hidden from the
    sender — we only show their display name. Reply-To is set so the
    recipient can answer the sender directly through their normal email."""
    if user_id == sender["user_id"]:
        raise HTTPException(status_code=400, detail="You can't email yourself")

    recipient = await db.users.find_one({"user_id": user_id})
    if not recipient or not recipient.get("email"):
        raise HTTPException(status_code=404, detail="User not reachable by email")

    sender_doc = await db.users.find_one({"user_id": sender["user_id"]}) or {}
    sender_name = (sender_doc.get("display_name") or sender_doc.get("name") or "A seeker").strip()
    sender_email = sender_doc.get("email")

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0f0523; color: #e9d5ff;">
      <h2 style="color: #fbbf24; margin-bottom: 4px;">✨ A message via Etheria</h2>
      <p style="color: #cbb6ff; font-size: 13px; margin-top: 0;">
        <strong>{sender_name}</strong> reached out to you through Etheria.
      </p>
      <hr style="border-color: rgba(159,122,234,0.3); margin: 16px 0;"/>
      <h3 style="color: #e9d5ff; font-size: 15px; margin: 0 0 8px;">{body.subject}</h3>
      <div style="background: rgba(124,58,237,0.10); padding: 14px; border-radius: 10px; white-space: pre-wrap; color: #e9d5ff; line-height: 1.5;">{body.body}</div>
      <p style="color: #9f7aea; font-size: 11px; margin-top: 18px;">
        You can reply directly to this email — your reply will go to {sender_name}.
        We never share your address.
      </p>
    </div>
    """
    text = f"{body.subject}\n\n{body.body}\n\n— {sender_name} (via Etheria)"

    ok = await send_email(
        to=recipient["email"],
        subject=f"[Etheria] {body.subject}",
        html=html,
        text=text,
        reply_to=sender_email or None,
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Email failed to send")

    # Audit log
    await db.email_forwards.insert_one({
        "_id": str(uuid.uuid4()),
        "from_id": sender["user_id"],
        "to_id": user_id,
        "subject": body.subject,
        "sent_at": now(),
    })
    return {"success": True}


