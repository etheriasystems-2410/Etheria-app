"""
Journal endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import uuid
import logging

from .deps import db
from .auth_utils import get_current_user

router = APIRouter(prefix="/journal", tags=["journal"])


async def _save_journal_entry_handler(entry: dict, request: Request):
    """Save a journal entry"""
    try:
        # Get current user
        user = await get_current_user(request)
        user_id = user.get('user_id')
        
        # Check if user is premium
        user_doc = await db.users.find_one({"user_id": user_id})
        is_premium = False
        
        if user_doc:
            is_premium = user_doc.get('is_premium', False)
            # Check subscription expiry
            if is_premium:
                subscription_expires = user_doc.get('subscription_expires')
                if subscription_expires:
                    if isinstance(subscription_expires, str):
                        expires_dt = datetime.fromisoformat(subscription_expires.replace("Z", "+00:00"))
                    else:
                        expires_dt = subscription_expires
                    if expires_dt.tzinfo is None:
                        expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                    if expires_dt < datetime.now(timezone.utc):
                        is_premium = False
        
        # If free user, check weekly entry limit
        if not is_premium:
            # Get start of current week (Monday)
            now = datetime.now(timezone.utc)
            week_start = now - timedelta(days=now.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Count entries this week
            weekly_entries = await db.journal_entries.count_documents({
                "user_id": user_id,
                "created_at": {"$gte": week_start.isoformat()}
            })
            
            if weekly_entries >= 5:
                raise HTTPException(
                    status_code=403, 
                    detail="Free users can only create 5 journal entries per week. Upgrade to Premium for unlimited entries!"
                )
        
        entry['_id'] = str(uuid.uuid4())
        entry['user_id'] = user_id
        entry['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.journal_entries.insert_one(entry)
        return {"success": True, "id": entry['_id']}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error saving journal entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to save entry")


@router.post("/save")
async def save_journal_entry(entry: dict, request: Request):
    """Save a journal entry - primary endpoint"""
    return await _save_journal_entry_handler(entry, request)


@router.post("/entries")
async def create_journal_entry(entry: dict, request: Request):
    """Save a journal entry - alias endpoint"""
    return await _save_journal_entry_handler(entry, request)


@router.get("/entries")
async def get_journal_entries(request: Request, limit: int = 50):
    """Get journal entries for current user"""
    try:
        # Get current user
        user = await get_current_user(request)
        entries = await db.journal_entries.find(
            {"user_id": user['user_id']}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return entries
    except HTTPException:
        # If not authenticated, return empty array
        return []
    except Exception as e:
        logging.error(f"Error fetching entries: {e}")
        return []


@router.delete("/entries/{entry_id}")
async def delete_journal_entry(entry_id: str, request: Request):
    """Delete a journal entry"""
    try:
        user = await get_current_user(request)
        user_id = user['user_id']
        
        # Find and delete the entry (only if it belongs to the user)
        result = await db.journal_entries.delete_one({
            "_id": entry_id,
            "user_id": user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        return {"success": True, "message": "Entry deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting journal entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete entry")


@router.get("/status")
async def get_journal_status(request: Request):
    """Get journal entry status for current user (entries used/remaining this week)"""
    try:
        user = await get_current_user(request)
        user_id = user.get('user_id')
        
        # Check if user is premium
        user_doc = await db.users.find_one({"user_id": user_id})
        is_premium = False
        
        if user_doc:
            is_premium = user_doc.get('is_premium', False)
            if is_premium:
                subscription_expires = user_doc.get('subscription_expires')
                if subscription_expires:
                    if isinstance(subscription_expires, str):
                        expires_dt = datetime.fromisoformat(subscription_expires.replace("Z", "+00:00"))
                    else:
                        expires_dt = subscription_expires
                    if expires_dt.tzinfo is None:
                        expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                    if expires_dt < datetime.now(timezone.utc):
                        is_premium = False
        
        if is_premium:
            return {
                "is_premium": True,
                "weekly_limit": None,
                "entries_this_week": 0,
                "entries_remaining": None,
                "unlimited": True
            }
        
        # Get start of current week (Monday)
        now = datetime.now(timezone.utc)
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Count entries this week
        weekly_entries = await db.journal_entries.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": week_start.isoformat()}
        })
        
        return {
            "is_premium": False,
            "weekly_limit": 5,
            "entries_this_week": weekly_entries,
            "entries_remaining": max(0, 5 - weekly_entries),
            "unlimited": False,
            "week_resets": (week_start + timedelta(days=7)).isoformat()
        }
    except HTTPException:
        return {
            "is_premium": False,
            "weekly_limit": 5,
            "entries_this_week": 0,
            "entries_remaining": 5,
            "unlimited": False
        }
    except Exception as e:
        logging.error(f"Error getting journal status: {e}")
        return {
            "is_premium": False,
            "weekly_limit": 5,
            "entries_this_week": 0,
            "entries_remaining": 5,
            "unlimited": False
        }
