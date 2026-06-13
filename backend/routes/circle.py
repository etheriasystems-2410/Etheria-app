"""Circles — mutual buddy lists with invite/accept/decline flow."""
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends

from .deps import db
from .auth_utils import get_current_user
from .profile_utils import now

router = APIRouter(prefix="/circle", tags=["circle"])



@router.post("/invite/{user_id}")
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
        "created_at": now(),
    }
    await db.circle_invites.insert_one(invite)
    return {"status": "sent", "invite_id": invite["_id"]}


@router.post("/invite/{invite_id}/accept")
async def accept_invite(invite_id: str, me: dict = Depends(get_current_user)):
    invite = await db.circle_invites.find_one({"_id": invite_id})
    if not invite or invite["to_id"] != me["user_id"]:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["status"] != "pending":
        return {"status": invite["status"]}

    now = now()
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


@router.post("/invite/{invite_id}/decline")
async def decline_invite(invite_id: str, me: dict = Depends(get_current_user)):
    invite = await db.circle_invites.find_one({"_id": invite_id})
    if not invite or invite["to_id"] != me["user_id"]:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["status"] != "pending":
        return {"status": invite["status"]}
    await db.circle_invites.update_one(
        {"_id": invite_id},
        {"$set": {"status": "declined", "responded_at": now()}},
    )
    return {"status": "declined"}


@router.get("/invites")
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


@router.get("/members")
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


@router.delete("/members/{user_id}")
async def remove_member(user_id: str, me: dict = Depends(get_current_user)):
    """Remove someone from my circle (mutual — they also lose me)."""
    await db.circle_members.delete_one({"owner_id": me["user_id"], "member_id": user_id})
    await db.circle_members.delete_one({"owner_id": user_id, "member_id": me["user_id"]})
    return {"success": True}
