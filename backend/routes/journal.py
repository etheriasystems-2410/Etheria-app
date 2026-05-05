"""
Journal routes - save/get/delete journal entries with weekly free-tier limits.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Request

from .auth import get_current_user

router = APIRouter(prefix="/api", tags=["journal"])

# Module-level db (injected at startup)
_db = None

WEEKLY_FREE_LIMIT = 5


def set_db(db):
    global _db
    _db = db


def _is_user_premium(user_doc: dict) -> bool:
    """Determine if a user is currently on premium (with active subscription)."""
    if not user_doc:
        return False
    is_premium = user_doc.get("is_premium", False)
    if not is_premium:
        return False
    subscription_expires = user_doc.get("subscription_expires")
    if subscription_expires:
        if isinstance(subscription_expires, str):
            expires_dt = datetime.fromisoformat(subscription_expires.replace("Z", "+00:00"))
        else:
            expires_dt = subscription_expires
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        if expires_dt < datetime.now(timezone.utc):
            return False
    return True


def _week_start(now: datetime) -> datetime:
    ws = now - timedelta(days=now.weekday())
    return ws.replace(hour=0, minute=0, second=0, microsecond=0)


async def _save_journal_entry_handler(entry: dict, request: Request):
    """Save a journal entry."""
    try:
        user = await get_current_user(request)
        user_id = user.get("user_id")

        user_doc = await _db.users.find_one({"user_id": user_id})
        is_premium = _is_user_premium(user_doc)

        if not is_premium:
            now = datetime.now(timezone.utc)
            week_start = _week_start(now)
            weekly_entries = await _db.journal_entries.count_documents({
                "user_id": user_id,
                "created_at": {"$gte": week_start.isoformat()},
            })
            if weekly_entries >= WEEKLY_FREE_LIMIT:
                raise HTTPException(
                    status_code=403,
                    detail="Free users can only create 5 journal entries per week. Upgrade to Premium for unlimited entries!",
                )

        entry["_id"] = str(uuid.uuid4())
        entry["user_id"] = user_id
        entry["created_at"] = datetime.now(timezone.utc).isoformat()
        await _db.journal_entries.insert_one(entry)
        return {"success": True, "id": entry["_id"]}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error saving journal entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to save entry")


@router.post("/journal/save")
async def save_journal_entry(entry: dict, request: Request):
    """Save a journal entry - primary endpoint."""
    return await _save_journal_entry_handler(entry, request)


@router.post("/journal/entries")
async def create_journal_entry(entry: dict, request: Request):
    """Save a journal entry - alias endpoint."""
    return await _save_journal_entry_handler(entry, request)


@router.get("/journal/entries")
async def get_journal_entries(request: Request, limit: int = 50):
    """Get journal entries for current user."""
    try:
        user = await get_current_user(request)
        entries = await _db.journal_entries.find(
            {"user_id": user["user_id"]}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return entries
    except HTTPException:
        return []
    except Exception as e:
        logging.error(f"Error fetching entries: {e}")
        return []


@router.delete("/journal/entries/{entry_id}")
async def delete_journal_entry(entry_id: str, request: Request):
    """Delete a journal entry (must belong to the requesting user)."""
    try:
        user = await get_current_user(request)
        result = await _db.journal_entries.delete_one({
            "_id": entry_id,
            "user_id": user["user_id"],
        })
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting journal entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete entry")


@router.get("/journal/status")
async def get_journal_status(request: Request):
    """Get the journal entry quota status for the current user (per-week)."""
    fallback = {
        "is_premium": False,
        "weekly_limit": WEEKLY_FREE_LIMIT,
        "entries_this_week": 0,
        "entries_remaining": WEEKLY_FREE_LIMIT,
        "unlimited": False,
    }
    try:
        user = await get_current_user(request)
        user_id = user.get("user_id")

        user_doc = await _db.users.find_one({"user_id": user_id})
        is_premium = _is_user_premium(user_doc)

        if is_premium:
            return {
                "is_premium": True,
                "weekly_limit": None,
                "entries_this_week": 0,
                "entries_remaining": None,
                "unlimited": True,
            }

        now = datetime.now(timezone.utc)
        week_start = _week_start(now)
        weekly_entries = await _db.journal_entries.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": week_start.isoformat()},
        })

        return {
            "is_premium": False,
            "weekly_limit": WEEKLY_FREE_LIMIT,
            "entries_this_week": weekly_entries,
            "entries_remaining": max(0, WEEKLY_FREE_LIMIT - weekly_entries),
            "unlimited": False,
            "week_resets": (week_start + timedelta(days=7)).isoformat(),
        }
    except HTTPException:
        return fallback
    except Exception as e:
        logging.error(f"Error getting journal status: {e}")
        return fallback
