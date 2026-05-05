"""
Moderation routes - admin endpoints for processing flagged content,
managing the suspension timeline, and verifying email reply commands.

All endpoints require admin authentication via Authorization: Bearer <session_token>.
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta
from bson import ObjectId

router = APIRouter(prefix="/api", tags=["moderation"])

# Module-level db reference, set from server.py at startup
_db = None


def set_db(db):
    """Inject the shared MongoDB handle from server.py."""
    global _db
    _db = db


async def _require_admin(request: Request):
    """Verify the request has a valid admin Bearer token. Returns the admin user dict."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = auth_header.replace("Bearer ", "")
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = await _db.users.find_one({"user_id": session.get("user_id")})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.post("/admin/process-moderation-emails")
async def trigger_email_processing(request: Request):
    """
    Manually trigger processing of admin moderation email replies.
    """
    await _require_admin(request)
    from services.moderation_service import process_inbound_moderation_emails
    result = await process_inbound_moderation_emails(_db)
    return {
        "success": True,
        "message": f"Processed {result['processed']} email replies",
        "details": result,
    }


@router.get("/admin/moderation-status")
async def get_moderation_status(request: Request):
    """
    Get current moderation status including pending flags and recent actions.
    """
    await _require_admin(request)

    pending_flags = await _db.user_flags.count_documents({"status": "pending"})
    recent_processed = await _db.user_flags.find(
        {"status": "processed"}
    ).sort("processed_at", -1).limit(10).to_list(length=10)

    suspended_users = await _db.users.count_documents({"account_status": "suspended"})
    cancelled_users = await _db.users.count_documents({"account_status": "cancelled"})

    return {
        "pending_flags": pending_flags,
        "suspended_users": suspended_users,
        "cancelled_users": cancelled_users,
        "recent_actions": [
            {
                "flag_id": str(f["_id"]),
                "resolution": f.get("resolution"),
                "processed_at": f.get("processed_at").isoformat() if f.get("processed_at") else None,
                "processed_via": f.get("processed_via", "admin_panel"),
            }
            for f in recent_processed
        ],
    }


@router.post("/admin/moderation/process-timeline")
async def trigger_timeline_processing(request: Request):
    """
    Manually process suspension expirations - auto-reactivates users whose
    suspension_end has passed. Normally runs automatically every hour.
    """
    await _require_admin(request)
    from services.moderation_service import process_suspension_expirations
    result = await process_suspension_expirations(_db)
    return {"success": True, **result}


@router.get("/admin/moderation/timeline")
async def get_timeline(request: Request):
    """
    Get the current state of the moderation timeline - active suspensions,
    pending auto-reactivations, cancelled accounts, and warning distribution.
    """
    await _require_admin(request)
    from services.moderation_service import get_moderation_timeline
    return await get_moderation_timeline(_db)


@router.post("/admin/moderation/simulate-timeline")
async def simulate_timeline_transition(request: Request):
    """
    TEST-ONLY: Fast-forward a user's suspension_end to the past so the next
    timeline processing call will auto-reactivate them.

    Body: {"user_id": "<mongo_id_or_user_id>"}
    """
    await _require_admin(request)

    body = await request.json()
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    target = None
    try:
        target = await _db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        pass
    if not target:
        target = await _db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.get("account_status") != "suspended":
        raise HTTPException(
            status_code=400,
            detail=f"User is not suspended (status={target.get('account_status')})",
        )

    past = datetime.utcnow() - timedelta(minutes=1)
    await _db.users.update_one(
        {"_id": target["_id"]},
        {"$set": {"suspension_end": past}},
    )

    return {
        "success": True,
        "message": (
            f"Suspension for {target.get('email')} fast-forwarded to the past. "
            "Run /api/admin/moderation/process-timeline to trigger auto-reactivation."
        ),
        "user_id": str(target["_id"]),
        "new_suspension_end": past.isoformat(),
    }
