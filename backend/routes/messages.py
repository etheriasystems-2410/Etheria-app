"""
Direct Messages (DM) routes — premium-initiated, real-time via WebSocket, with
block/report moderation and Resend email notifications.

Collections:
  dm_threads:  { _id, participants: [user_id, user_id], created_by, created_at,
                 last_message_at, last_message_preview }
  dm_messages: { _id, thread_id, sender_id, content, sent_at,
                 read_by: [user_ids], deleted_for: [user_ids] }
  dm_blocks:   { _id, blocker_id, blocked_id, blocked_at }
  dm_email_throttle: { user_id, thread_id, last_email_at }

Premium gate: only premium users can INITIATE a new thread. Both sides can
reply once the thread exists. Free users still receive messages.
"""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Set, Dict
from collections import defaultdict

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/messages", tags=["messages"])

# Injected at startup
_db = None
_app_url = os.getenv("EXPO_PUBLIC_BACKEND_URL", "")

# Active WebSocket connections, keyed by user_id
_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
# Email throttle window — only send 1 email per thread per N minutes
_EMAIL_THROTTLE_MIN = 10


def set_db(db):
    global _db
    _db = db


# ---------- Models ----------

class CreateThreadRequest(BaseModel):
    recipient_id: str


class SendMessageRequest(BaseModel):
    content: str


class ReportRequest(BaseModel):
    reason: str


# ---------- Helpers ----------

async def _get_user_from_token(request: Request) -> dict:
    """Resolve current user from Authorization Bearer token."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not initialized")
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    token = auth.replace("Bearer ", "")
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await _db.users.find_one({"user_id": session.get("user_id")})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _is_premium(user: dict) -> bool:
    if not user:
        return False
    if user.get("is_admin"):
        return True
    if not user.get("is_premium"):
        return False
    expires = user.get("subscription_expires")
    if expires:
        if isinstance(expires, str):
            expires_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        else:
            expires_dt = expires
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        if expires_dt < datetime.now(timezone.utc):
            return False
    return True


async def _are_blocked(a: str, b: str) -> bool:
    """True if either user has blocked the other."""
    found = await _db.dm_blocks.find_one({
        "$or": [
            {"blocker_id": a, "blocked_id": b},
            {"blocker_id": b, "blocked_id": a},
        ]
    })
    return found is not None


async def _push_to_user(user_id: str, payload: dict) -> None:
    """Broadcast a JSON payload to every active WebSocket of a user."""
    dead = []
    for ws in list(_connections.get(user_id, [])):
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections[user_id].discard(ws)


async def _resolve_user_brief(user_id: str) -> Optional[dict]:
    """Fetch a minimal public profile for a user_id."""
    u = await _db.users.find_one({"user_id": user_id})
    if not u:
        return None
    return {
        "user_id": u.get("user_id"),
        "name": u.get("display_name") or u.get("name") or "Seeker",
        "picture": u.get("picture"),
        "email": u.get("email"),
    }


# ---------- Endpoints ----------

@router.post("/threads")
async def create_or_get_thread(req: CreateThreadRequest, request: Request):
    """
    Premium gate on the initiator only. If a thread already exists between the
    two users, return it; otherwise create a new one.
    """
    me = await _get_user_from_token(request)
    if req.recipient_id == me["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    recipient = await _db.users.find_one({"user_id": req.recipient_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if await _are_blocked(me["user_id"], req.recipient_id):
        raise HTTPException(status_code=403, detail="Blocked")

    existing = await _db.dm_threads.find_one({
        "participants": {"$all": [me["user_id"], req.recipient_id], "$size": 2}
    })
    if existing:
        return {
            "thread_id": str(existing["_id"]),
            "participants": existing["participants"],
            "created_at": existing.get("created_at"),
        }

    # New thread → premium gate on initiator
    if not _is_premium(me):
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required to start a new direct message",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "participants": [me["user_id"], req.recipient_id],
        "created_by": me["user_id"],
        "created_at": now,
        "last_message_at": now,
        "last_message_preview": "",
    }
    result = await _db.dm_threads.insert_one(doc)
    return {
        "thread_id": str(result.inserted_id),
        "participants": doc["participants"],
        "created_at": now.isoformat(),
    }


@router.get("/threads")
async def list_threads(request: Request):
    """List current user's threads, newest activity first, with last preview + unread count."""
    me = await _get_user_from_token(request)
    cursor = _db.dm_threads.find({"participants": me["user_id"]}).sort("last_message_at", -1)
    threads = await cursor.to_list(length=200)

    out = []
    for t in threads:
        other_id = next((p for p in t["participants"] if p != me["user_id"]), None)
        other = await _resolve_user_brief(other_id) if other_id else None
        # Unread count: messages in this thread not yet read by me, not sent by me
        unread = await _db.dm_messages.count_documents({
            "thread_id": str(t["_id"]),
            "sender_id": {"$ne": me["user_id"]},
            "read_by": {"$ne": me["user_id"]},
            "deleted_for": {"$ne": me["user_id"]},
        })
        out.append({
            "thread_id": str(t["_id"]),
            "other_user": other,
            "last_message_at": (t.get("last_message_at") or t.get("created_at")).isoformat()
                if isinstance(t.get("last_message_at") or t.get("created_at"), datetime)
                else t.get("last_message_at"),
            "last_message_preview": t.get("last_message_preview", ""),
            "unread_count": unread,
        })
    return {"threads": out}


@router.get("/threads/{thread_id}")
async def get_thread_messages(thread_id: str, request: Request, limit: int = 50, before: Optional[str] = None):
    """Fetch messages in a thread (newest last). Used for initial load and pagination."""
    me = await _get_user_from_token(request)
    try:
        oid = ObjectId(thread_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid thread_id")

    thread = await _db.dm_threads.find_one({"_id": oid})
    if not thread or me["user_id"] not in thread.get("participants", []):
        raise HTTPException(status_code=404, detail="Thread not found")

    q = {"thread_id": thread_id, "deleted_for": {"$ne": me["user_id"]}}
    if before:
        try:
            q["_id"] = {"$lt": ObjectId(before)}
        except Exception:
            pass

    cursor = _db.dm_messages.find(q).sort("_id", -1).limit(limit)
    raw = await cursor.to_list(length=limit)
    raw.reverse()  # oldest first

    other_id = next((p for p in thread["participants"] if p != me["user_id"]), None)
    other = await _resolve_user_brief(other_id) if other_id else None

    return {
        "thread_id": thread_id,
        "other_user": other,
        "messages": [
            {
                "id": str(m["_id"]),
                "sender_id": m["sender_id"],
                "content": m["content"],
                "sent_at": m["sent_at"].isoformat() if isinstance(m["sent_at"], datetime) else m["sent_at"],
                "read": me["user_id"] in m.get("read_by", []) if m["sender_id"] != me["user_id"] else True,
                "mine": m["sender_id"] == me["user_id"],
            }
            for m in raw
        ],
    }


@router.post("/threads/{thread_id}/send")
async def send_message(thread_id: str, req: SendMessageRequest, request: Request):
    """Send a message in a thread. Broadcasts via WebSocket and (throttled) emails."""
    me = await _get_user_from_token(request)
    content = (req.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Empty message")
    if len(content) > 4000:
        raise HTTPException(status_code=400, detail="Message too long (max 4000 chars)")

    try:
        oid = ObjectId(thread_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid thread_id")

    thread = await _db.dm_threads.find_one({"_id": oid})
    if not thread or me["user_id"] not in thread.get("participants", []):
        raise HTTPException(status_code=404, detail="Thread not found")

    other_id = next((p for p in thread["participants"] if p != me["user_id"]), None)
    if other_id and await _are_blocked(me["user_id"], other_id):
        raise HTTPException(status_code=403, detail="Blocked")

    now = datetime.now(timezone.utc)
    msg_doc = {
        "thread_id": thread_id,
        "sender_id": me["user_id"],
        "content": content,
        "sent_at": now,
        "read_by": [me["user_id"]],  # sender has read their own message
        "deleted_for": [],
    }
    result = await _db.dm_messages.insert_one(msg_doc)
    preview = content[:80] + ("…" if len(content) > 80 else "")
    await _db.dm_threads.update_one(
        {"_id": oid},
        {"$set": {"last_message_at": now, "last_message_preview": preview}}
    )

    msg_out = {
        "id": str(result.inserted_id),
        "thread_id": thread_id,
        "sender_id": me["user_id"],
        "content": content,
        "sent_at": now.isoformat(),
    }

    # WebSocket push to the recipient AND back to sender's other devices
    if other_id:
        await _push_to_user(other_id, {"type": "message", "thread_id": thread_id, "message": msg_out})
    await _push_to_user(me["user_id"], {"type": "message_sent", "thread_id": thread_id, "message": msg_out})

    # Throttled email notification
    asyncio.create_task(_maybe_email_recipient(other_id, me, thread_id, content))

    return {"success": True, "message": msg_out}


async def _maybe_email_recipient(recipient_id: Optional[str], sender: dict, thread_id: str, content: str):
    """Send an email notification at most once per recipient/thread/throttle window."""
    if not recipient_id:
        return
    try:
        recipient = await _db.users.find_one({"user_id": recipient_id})
        if not recipient or not recipient.get("email"):
            return

        now = datetime.now(timezone.utc)
        throttle = await _db.dm_email_throttle.find_one({"user_id": recipient_id, "thread_id": thread_id})
        if throttle and throttle.get("last_email_at"):
            last = throttle["last_email_at"]
            if isinstance(last, datetime) and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if (now - last).total_seconds() < _EMAIL_THROTTLE_MIN * 60:
                return

        from services.email_service import send_email
        sender_name = sender.get("display_name") or sender.get("name") or "A seeker"
        preview = content[:160] + ("…" if len(content) > 160 else "")

        html = f"""
        <html><body style="font-family: Arial, sans-serif; background:#0d0015; padding:32px; color:#e9d5ff;">
          <div style="max-width:560px;margin:0 auto;background:rgba(45,27,78,0.9);border-radius:16px;padding:32px;border:1px solid #7c3aed;">
            <h2 style="color:#fbbf24;margin-top:0;">✨ New message on Etheria</h2>
            <p><strong style="color:#a855f7;">{sender_name}</strong> sent you a direct message:</p>
            <blockquote style="background:rgba(124,58,237,0.12);border-left:3px solid #fbbf24;padding:14px 16px;border-radius:8px;color:#c4b5fd;font-style:italic;">{preview}</blockquote>
            <p style="color:#9f7aea;font-size:13px;">Open the Etheria app to reply.</p>
          </div>
        </body></html>
        """
        text = f"{sender_name} sent you a message on Etheria:\n\n{preview}\n\nOpen the app to reply."
        await send_email(
            to=recipient["email"],
            subject=f"✨ {sender_name} sent you a message",
            html=html,
            text=text,
        )
        await _db.dm_email_throttle.update_one(
            {"user_id": recipient_id, "thread_id": thread_id},
            {"$set": {"last_email_at": now}},
            upsert=True,
        )
    except Exception as e:
        logging.error(f"[DM Email] Failed for {recipient_id}: {e}")


@router.post("/threads/{thread_id}/read")
async def mark_thread_read(thread_id: str, request: Request):
    """Mark all messages in a thread as read by the current user."""
    me = await _get_user_from_token(request)
    try:
        oid = ObjectId(thread_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid thread_id")
    thread = await _db.dm_threads.find_one({"_id": oid})
    if not thread or me["user_id"] not in thread.get("participants", []):
        raise HTTPException(status_code=404, detail="Thread not found")

    result = await _db.dm_messages.update_many(
        {
            "thread_id": thread_id,
            "sender_id": {"$ne": me["user_id"]},
            "read_by": {"$ne": me["user_id"]},
        },
        {"$addToSet": {"read_by": me["user_id"]}}
    )
    # Notify the other party that messages were read
    other_id = next((p for p in thread["participants"] if p != me["user_id"]), None)
    if other_id and result.modified_count > 0:
        await _push_to_user(other_id, {"type": "read", "thread_id": thread_id, "by": me["user_id"]})

    return {"success": True, "marked_read": result.modified_count}


@router.get("/unread-count")
async def total_unread(request: Request):
    """Total unread messages across all threads — for drawer badge."""
    me = await _get_user_from_token(request)
    threads = await _db.dm_threads.find({"participants": me["user_id"]}).to_list(length=500)
    thread_ids = [str(t["_id"]) for t in threads]
    if not thread_ids:
        return {"unread": 0}
    count = await _db.dm_messages.count_documents({
        "thread_id": {"$in": thread_ids},
        "sender_id": {"$ne": me["user_id"]},
        "read_by": {"$ne": me["user_id"]},
        "deleted_for": {"$ne": me["user_id"]},
    })
    return {"unread": count}


@router.post("/block/{user_id}")
async def block_user(user_id: str, request: Request):
    me = await _get_user_from_token(request)
    if user_id == me["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    target = await _db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await _db.dm_blocks.update_one(
        {"blocker_id": me["user_id"], "blocked_id": user_id},
        {"$set": {"blocker_id": me["user_id"], "blocked_id": user_id, "blocked_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"success": True, "message": "User blocked"}


@router.delete("/block/{user_id}")
async def unblock_user(user_id: str, request: Request):
    me = await _get_user_from_token(request)
    await _db.dm_blocks.delete_one({"blocker_id": me["user_id"], "blocked_id": user_id})
    return {"success": True, "message": "User unblocked"}


@router.get("/blocks")
async def list_blocks(request: Request):
    me = await _get_user_from_token(request)
    cursor = _db.dm_blocks.find({"blocker_id": me["user_id"]})
    blocks = await cursor.to_list(length=200)
    out = []
    for b in blocks:
        u = await _resolve_user_brief(b["blocked_id"])
        if u:
            u["blocked_at"] = b.get("blocked_at").isoformat() if isinstance(b.get("blocked_at"), datetime) else b.get("blocked_at")
            out.append(u)
    return {"blocks": out}


@router.post("/threads/{thread_id}/report")
async def report_thread(thread_id: str, req: ReportRequest, request: Request):
    """Flag a DM thread for admin review — uses existing user_flags collection."""
    me = await _get_user_from_token(request)
    try:
        oid = ObjectId(thread_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid thread_id")
    thread = await _db.dm_threads.find_one({"_id": oid})
    if not thread or me["user_id"] not in thread.get("participants", []):
        raise HTTPException(status_code=404, detail="Thread not found")

    other_id = next((p for p in thread["participants"] if p != me["user_id"]), None)
    flag_doc = {
        "content_id": thread_id,
        "content_type": "dm_thread",
        "reason": (req.reason or "inappropriate")[:280],
        "reporter_id": me["user_id"],
        "reported_user_id": other_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    }
    result = await _db.user_flags.insert_one(flag_doc)
    return {"success": True, "flag_id": str(result.inserted_id)}


# ---------- WebSocket ----------

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    Live message bridge.
    Client connects with ?token=<session_token>. The server pushes JSON events:
      { type: "message",      thread_id, message: {...} }    // received from someone
      { type: "message_sent", thread_id, message: {...} }    // echoed to other devices
      { type: "read",         thread_id, by: <user_id> }     // recipient marked thread read
      { type: "ping" }                                       // keepalive (sent every 25s)
    """
    if _db is None:
        await websocket.close(code=1011)
        return
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        await websocket.close(code=4401)
        return
    user_id = session.get("user_id")
    await websocket.accept()
    _connections[user_id].add(websocket)
    try:
        # Send hello
        await websocket.send_json({"type": "hello", "user_id": user_id})
        # Passive listen — clients only need to receive
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=25.0)
                # echo or ignore
                if msg == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # send keepalive
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logging.error(f"[DM WS] Error for {user_id}: {e}")
    finally:
        _connections[user_id].discard(websocket)
