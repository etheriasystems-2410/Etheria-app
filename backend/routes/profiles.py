"""
Profiles, Circles, Direct Mail & Email-Forwarding routes.

Every connected feature on the user-to-user side of Etheria lives here:

  Profiles
    GET  /api/profile/me                          my full profile (includes email)
    PUT  /api/profile/me                          update my profile
    GET  /api/profile/{user_id}                   view a profile (email hidden)

  Email forwarding (Mail-to button)
    POST /api/profile/{user_id}/email             server forwards a message to
                                                  their signup email — sender
                                                  never learns the address

  Direct Mail (in-app letters)
    POST /api/direct-mail                         compose & send
    GET  /api/direct-mail/inbox                   letters received
    GET  /api/direct-mail/sent                    letters I sent
    GET  /api/direct-mail/{letter_id}             read (marks unread→read)
    DELETE /api/direct-mail/{letter_id}           delete (sender or recipient)

  Circles (mutual buddy lists)
    POST   /api/circle/invite/{user_id}           send an invite
    POST   /api/circle/invite/{invite_id}/accept  accept (mutual add)
    POST   /api/circle/invite/{invite_id}/decline decline
    GET    /api/circle/invites                    pending invites to me
    GET    /api/circle/members                    my circle list
    DELETE /api/circle/members/{user_id}          leave / remove (mutual)
"""
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field, EmailStr

from .deps import db
from .auth_utils import get_current_user
from services.email_service import send_email


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
PUBLIC_PROFILE_FIELDS = (
    "user_id", "name", "display_name", "picture", "bio", "birthday",
    "location", "favorite_guide", "psychic_interests", "created_at",
    "is_admin", "is_premium",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _public_profile(user_doc: dict, viewer_id: Optional[str] = None) -> dict:
    """Strip private fields and add circle/relationship metadata."""
    name = (user_doc.get("display_name") or user_doc.get("name") or "Seeker").strip()
    p = {
        "user_id": user_doc.get("user_id"),
        "name": name,
        "picture": user_doc.get("picture"),
        "bio": user_doc.get("bio") or "",
        "birthday": user_doc.get("birthday"),       # ISO date string, may be ""
        "location": user_doc.get("location") or "",
        "favorite_guide": user_doc.get("favorite_guide") or "",
        "psychic_interests": user_doc.get("psychic_interests") or [],
        # Lifestyle / personality
        "hobbies": user_doc.get("hobbies") or "",
        "favorite_things": user_doc.get("favorite_things") or "",
        "dislikes": user_doc.get("dislikes") or "",
        "other_details": user_doc.get("other_details") or "",
        # "The Path I Walk" — faith group
        "path_walked": user_doc.get("path_walked") or "",
        "in_coven": bool(user_doc.get("in_coven")),
        "coven_name": user_doc.get("coven_name") or "",
        "deities_followed": user_doc.get("deities_followed") or "",
        # Psychic talent disclosures
        "family_has_psychic_talent": bool(user_doc.get("family_has_psychic_talent")),
        "family_psychic_details": user_doc.get("family_psychic_details") or "",
        "self_has_psychic_talent": bool(user_doc.get("self_has_psychic_talent")),
        "self_psychic_details": user_doc.get("self_psychic_details") or "",
        # Story
        "why_etheria": user_doc.get("why_etheria") or "",
        # Progress visibility — default ON
        "show_progress": user_doc.get("show_progress", True),
        "created_at": user_doc.get("created_at"),
        "is_admin": bool(user_doc.get("is_admin")),
        "is_premium": bool(user_doc.get("is_premium")),
    }

    # Relationship metadata for the viewer
    if viewer_id and viewer_id != user_doc.get("user_id"):
        in_circle = await db.circle_members.find_one({
            "owner_id": viewer_id,
            "member_id": user_doc.get("user_id"),
        })
        pending_out = await db.circle_invites.find_one({
            "from_id": viewer_id,
            "to_id": user_doc.get("user_id"),
            "status": "pending",
        })
        pending_in = await db.circle_invites.find_one({
            "from_id": user_doc.get("user_id"),
            "to_id": viewer_id,
            "status": "pending",
        })
        p["circle_relationship"] = (
            "in_circle" if in_circle
            else "invite_pending_out" if pending_out
            else "invite_pending_in" if pending_in
            else "none"
        )

    # Progress stats — always for self, only when toggled ON for others
    is_self = viewer_id == user_doc.get("user_id")
    if is_self or user_doc.get("show_progress", True):
        p["stats"] = await _profile_stats(user_doc)

    return p


async def _profile_stats(user_doc: dict) -> dict:
    """Compute the Progress stats. Cheap aggregate queries."""
    uid = user_doc.get("user_id")
    if not uid:
        return {}
    daily_card_count = await db.daily_cards.count_documents({"user_id": uid})
    journal_count = await db.journal_entries.count_documents({"user_id": uid})
    completed = user_doc.get("completed_modules") or []
    modules_completed = len(completed) if isinstance(completed, list) else 0
    created = user_doc.get("created_at")
    days_as_member = 0
    if isinstance(created, datetime):
        ref = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
        days_as_member = max(0, (datetime.now(timezone.utc) - ref).days)
    elif isinstance(created, str):
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            days_as_member = max(0, (datetime.now(timezone.utc) - dt).days)
        except Exception:
            pass
    return {
        "modules_completed": modules_completed,
        "current_streak": int(user_doc.get("streak_count") or 0),
        "longest_streak": int(user_doc.get("longest_streak") or 0),
        "total_cards_drawn": daily_card_count,
        "journal_entries": journal_count,
        "days_as_member": days_as_member,
    }


# ===========================================================================
# Profile endpoints
# ===========================================================================
profile_router = APIRouter(prefix="/profile", tags=["profile"])


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


@profile_router.get("/me")
async def get_my_profile(user: dict = Depends(get_current_user)):
    """My full profile (including email — never returned for others)."""
    doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    p = await _public_profile(doc, viewer_id=user["user_id"])
    # Include email + plan only for self
    p["email"] = doc.get("email")
    p["subscription_plan"] = doc.get("subscription_plan")
    p["subscription_expires_at"] = doc.get("subscription_expires_at")
    return p


@profile_router.put("/me")
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

    update["profile_updated_at"] = _now()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    return {"success": True, "profile": await _public_profile(doc, viewer_id=user["user_id"])}


@profile_router.get("/{user_id}")
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


@profile_router.post("/{user_id}/email")
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
        "sent_at": _now(),
    })
    return {"success": True}


# ===========================================================================
# Direct Mail (in-app letters)
# ===========================================================================
direct_mail_router = APIRouter(prefix="/direct-mail", tags=["direct-mail"])


class DirectMailBody(BaseModel):
    to_user_id: str
    subject: str = Field(..., min_length=1, max_length=140)
    body: str = Field(..., min_length=1, max_length=4000)


@direct_mail_router.post("")
async def send_direct_mail(body: DirectMailBody, sender: dict = Depends(get_current_user)):
    if body.to_user_id == sender["user_id"]:
        raise HTTPException(status_code=400, detail="You can't mail yourself")
    recipient = await db.users.find_one({"user_id": body.to_user_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")

    letter = {
        "_id": str(uuid.uuid4()),
        "from_id": sender["user_id"],
        "to_id": body.to_user_id,
        "subject": body.subject.strip(),
        "body": body.body.strip(),
        "read": False,
        "sent_at": _now(),
        "deleted_by_sender": False,
        "deleted_by_recipient": False,
    }
    await db.direct_mail.insert_one(letter)
    return {"success": True, "letter_id": letter["_id"]}


async def _annotate_letters(letters: List[dict]) -> List[dict]:
    """Attach the other party's display name/picture to each letter for the UI."""
    ids = {
        l["from_id"] for l in letters
    } | {l["to_id"] for l in letters}
    if not ids:
        return []
    users = {}
    async for u in db.users.find({"user_id": {"$in": list(ids)}},
                                  projection={"user_id": 1, "name": 1, "display_name": 1, "picture": 1, "_id": 0}):
        users[u["user_id"]] = u
    out = []
    for l in letters:
        out.append({
            "id": l["_id"],
            "from_id": l["from_id"],
            "to_id": l["to_id"],
            "subject": l["subject"],
            "body": l["body"],
            "read": l.get("read", False),
            "sent_at": (l["sent_at"].isoformat() if isinstance(l["sent_at"], datetime) else l["sent_at"]),
            "from_user": users.get(l["from_id"], {}),
            "to_user": users.get(l["to_id"], {}),
        })
    return out


@direct_mail_router.get("/inbox")
async def inbox(me: dict = Depends(get_current_user)):
    cur = db.direct_mail.find({
        "to_id": me["user_id"],
        "deleted_by_recipient": {"$ne": True},
    }).sort("sent_at", -1).limit(200)
    letters = [l async for l in cur]
    return {"letters": await _annotate_letters(letters)}


@direct_mail_router.get("/sent")
async def sent(me: dict = Depends(get_current_user)):
    cur = db.direct_mail.find({
        "from_id": me["user_id"],
        "deleted_by_sender": {"$ne": True},
    }).sort("sent_at", -1).limit(200)
    letters = [l async for l in cur]
    return {"letters": await _annotate_letters(letters)}


@direct_mail_router.get("/{letter_id}")
async def get_letter(letter_id: str, me: dict = Depends(get_current_user)):
    letter = await db.direct_mail.find_one({"_id": letter_id})
    if not letter or me["user_id"] not in (letter["from_id"], letter["to_id"]):
        raise HTTPException(status_code=404, detail="Letter not found")
    # Mark as read if I'm the recipient and it's unread
    if me["user_id"] == letter["to_id"] and not letter.get("read"):
        await db.direct_mail.update_one({"_id": letter_id}, {"$set": {"read": True, "read_at": _now()}})
        letter["read"] = True
    annotated = await _annotate_letters([letter])
    return annotated[0]


@direct_mail_router.delete("/{letter_id}")
async def delete_letter(letter_id: str, me: dict = Depends(get_current_user)):
    letter = await db.direct_mail.find_one({"_id": letter_id})
    if not letter or me["user_id"] not in (letter["from_id"], letter["to_id"]):
        raise HTTPException(status_code=404, detail="Letter not found")
    field = "deleted_by_sender" if me["user_id"] == letter["from_id"] else "deleted_by_recipient"
    await db.direct_mail.update_one({"_id": letter_id}, {"$set": {field: True}})
    return {"success": True}


# ===========================================================================
# Circles
# ===========================================================================
circle_router = APIRouter(prefix="/circle", tags=["circle"])


@circle_router.post("/invite/{user_id}")
async def send_invite(user_id: str, me: dict = Depends(get_current_user)):
    """Send a Circle invite to a user. Idempotent — duplicate sends are ignored."""
    if user_id == me["user_id"]:
        raise HTTPException(status_code=400, detail="You can't add yourself")

    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Already in circle?
    exists = await db.circle_members.find_one({"owner_id": me["user_id"], "member_id": user_id})
    if exists:
        return {"status": "already_in_circle"}

    # Already pending in either direction?
    pending = await db.circle_invites.find_one({
        "$or": [
            {"from_id": me["user_id"], "to_id": user_id, "status": "pending"},
            {"from_id": user_id, "to_id": me["user_id"], "status": "pending"},
        ]
    })
    if pending:
        return {"status": "already_pending", "invite_id": pending["_id"]}

    invite = {
        "_id": str(uuid.uuid4()),
        "from_id": me["user_id"],
        "to_id": user_id,
        "status": "pending",
        "created_at": _now(),
    }
    await db.circle_invites.insert_one(invite)
    return {"status": "sent", "invite_id": invite["_id"]}


@circle_router.post("/invite/{invite_id}/accept")
async def accept_invite(invite_id: str, me: dict = Depends(get_current_user)):
    invite = await db.circle_invites.find_one({"_id": invite_id})
    if not invite or invite["to_id"] != me["user_id"]:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["status"] != "pending":
        return {"status": invite["status"]}

    now = _now()
    # Add mutual circle_members docs (idempotent on the pair)
    await db.circle_members.update_one(
        {"owner_id": invite["from_id"], "member_id": invite["to_id"]},
        {"$setOnInsert": {"owner_id": invite["from_id"], "member_id": invite["to_id"], "added_at": now}},
        upsert=True,
    )
    await db.circle_members.update_one(
        {"owner_id": invite["to_id"], "member_id": invite["from_id"]},
        {"$setOnInsert": {"owner_id": invite["to_id"], "member_id": invite["from_id"], "added_at": now}},
        upsert=True,
    )
    await db.circle_invites.update_one(
        {"_id": invite_id},
        {"$set": {"status": "accepted", "responded_at": now}},
    )
    return {"status": "accepted"}


@circle_router.post("/invite/{invite_id}/decline")
async def decline_invite(invite_id: str, me: dict = Depends(get_current_user)):
    invite = await db.circle_invites.find_one({"_id": invite_id})
    if not invite or invite["to_id"] != me["user_id"]:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["status"] != "pending":
        return {"status": invite["status"]}
    await db.circle_invites.update_one(
        {"_id": invite_id},
        {"$set": {"status": "declined", "responded_at": _now()}},
    )
    return {"status": "declined"}


@circle_router.get("/invites")
async def my_pending_invites(me: dict = Depends(get_current_user)):
    """Invites waiting for MY response (incoming, pending)."""
    cur = db.circle_invites.find({"to_id": me["user_id"], "status": "pending"}).sort("created_at", -1)
    invites = [i async for i in cur]
    # Annotate with sender info
    sender_ids = list({i["from_id"] for i in invites})
    senders = {}
    if sender_ids:
        async for u in db.users.find({"user_id": {"$in": sender_ids}},
                                       projection={"user_id": 1, "name": 1, "display_name": 1, "picture": 1, "_id": 0}):
            senders[u["user_id"]] = u
    out = [{
        "id": i["_id"],
        "from": senders.get(i["from_id"], {}),
        "created_at": i["created_at"].isoformat() if isinstance(i["created_at"], datetime) else i["created_at"],
    } for i in invites]
    return {"invites": out}


@circle_router.get("/members")
async def my_circle(me: dict = Depends(get_current_user)):
    """My circle list — users I've mutually added."""
    cur = db.circle_members.find({"owner_id": me["user_id"]}).sort("added_at", -1)
    member_links = [m async for m in cur]
    member_ids = [m["member_id"] for m in member_links]
    if not member_ids:
        return {"members": []}
    users = {}
    async for u in db.users.find({"user_id": {"$in": member_ids}},
                                  projection={"user_id": 1, "name": 1, "display_name": 1,
                                              "picture": 1, "is_premium": 1, "is_admin": 1,
                                              "bio": 1, "_id": 0}):
        users[u["user_id"]] = u
    out = []
    for link in member_links:
        u = users.get(link["member_id"])
        if not u:
            continue
        out.append({
            "user_id": u["user_id"],
            "name": (u.get("display_name") or u.get("name") or "Seeker").strip(),
            "picture": u.get("picture"),
            "is_premium": bool(u.get("is_premium")),
            "is_admin": bool(u.get("is_admin")),
            "bio": u.get("bio") or "",
            "added_at": link["added_at"].isoformat() if isinstance(link["added_at"], datetime) else link["added_at"],
        })
    return {"members": out}


@circle_router.delete("/members/{user_id}")
async def remove_member(user_id: str, me: dict = Depends(get_current_user)):
    """Remove someone from my circle (mutual — they also lose me)."""
    await db.circle_members.delete_one({"owner_id": me["user_id"], "member_id": user_id})
    await db.circle_members.delete_one({"owner_id": user_id, "member_id": me["user_id"]})
    return {"success": True}
