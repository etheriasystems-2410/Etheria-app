"""
Push notification token registration routes.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

_db = None


def set_db(db):
    global _db
    _db = db


class RegisterTokenRequest(BaseModel):
    token: str
    device_info: dict | None = None


async def _require_user(request: Request) -> dict:
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


@router.post("/register")
async def register_token(req: RegisterTokenRequest, request: Request):
    """Register an Expo push token for the current user."""
    me = await _require_user(request)
    if not req.token or not req.token.startswith("ExponentPushToken"):
        raise HTTPException(status_code=400, detail="Invalid Expo push token")
    await _db.users.update_one(
        {"user_id": me["user_id"]},
        {
            "$addToSet": {"push_tokens": req.token},
            "$set": {"push_token_updated_at": datetime.now(timezone.utc)},
        },
    )
    return {"success": True, "registered": req.token}


@router.post("/unregister")
async def unregister_token(req: RegisterTokenRequest, request: Request):
    """Remove a token (on logout)."""
    me = await _require_user(request)
    await _db.users.update_one(
        {"user_id": me["user_id"]},
        {"$pull": {"push_tokens": req.token}},
    )
    return {"success": True}


@router.post("/test")
async def test_push(request: Request):
    """Send a test push to the current user (verifies tokens work)."""
    me = await _require_user(request)
    from services.push_service import send_push_to_user
    sent = await send_push_to_user(
        _db,
        me["user_id"],
        "✨ Etheria test",
        "Your push notifications are working!",
        {"type": "test"},
    )
    return {"success": True, "sent_to_tokens": sent}
