"""Direct Mail — in-app long-form letters between users."""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from .deps import db
from .auth_utils import get_current_user
from .profile_utils import now

router = APIRouter(prefix="/direct-mail", tags=["direct-mail"])


class DirectMailBody(BaseModel):
    to_user_id: str
    subject: str = Field(..., min_length=1, max_length=140)
    body: str = Field(..., min_length=1, max_length=4000)


@router.post("")
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
        "sent_at": now(),
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


@router.get("/inbox")
async def inbox(me: dict = Depends(get_current_user)):
    cur = db.direct_mail.find({
        "to_id": me["user_id"],
        "deleted_by_recipient": {"$ne": True},
    }).sort("sent_at", -1).limit(200)
    letters = [l async for l in cur]
    return {"letters": await _annotate_letters(letters)}


@router.get("/sent")
async def sent(me: dict = Depends(get_current_user)):
    cur = db.direct_mail.find({
        "from_id": me["user_id"],
        "deleted_by_sender": {"$ne": True},
    }).sort("sent_at", -1).limit(200)
    letters = [l async for l in cur]
    return {"letters": await _annotate_letters(letters)}


@router.get("/{letter_id}")
async def get_letter(letter_id: str, me: dict = Depends(get_current_user)):
    letter = await db.direct_mail.find_one({"_id": letter_id})
    if not letter or me["user_id"] not in (letter["from_id"], letter["to_id"]):
        raise HTTPException(status_code=404, detail="Letter not found")
    # Mark as read if I'm the recipient and it's unread
    if me["user_id"] == letter["to_id"] and not letter.get("read"):
        await db.direct_mail.update_one({"_id": letter_id}, {"$set": {"read": True, "read_at": now()}})
        letter["read"] = True
    annotated = await _annotate_letters([letter])
    return annotated[0]


@router.delete("/{letter_id}")
async def delete_letter(letter_id: str, me: dict = Depends(get_current_user)):
    letter = await db.direct_mail.find_one({"_id": letter_id})
    if not letter or me["user_id"] not in (letter["from_id"], letter["to_id"]):
        raise HTTPException(status_code=404, detail="Letter not found")
    field = "deleted_by_sender" if me["user_id"] == letter["from_id"] else "deleted_by_recipient"
    await db.direct_mail.update_one({"_id": letter_id}, {"$set": {field: True}})
    return {"success": True}

