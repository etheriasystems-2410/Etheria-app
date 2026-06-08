"""
Push notification routes.

This file exposes two surfaces:

1.  Emergent-managed push registration (per the integration playbook):
        POST /api/register-push   {user_id, platform, device_token}
    The frontend calls this on every app open after `getDevicePushTokenAsync()`.

2.  Per-user notification preferences (for the daily Oracle + Dream reminder
    scheduler):
        GET  /api/notifications/preferences
        PUT  /api/notifications/preferences
        POST /api/notifications/test              -> send a test push
        POST /api/notifications/register          -> legacy alias (kept so the
                                                     old `usePushNotifications`
                                                     callers don't 500 during
                                                     rollout).
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

# ---------- shared DB handle (set from server.py via set_db) ----------------
_db = None


def set_db(db):
    global _db
    _db = db


# ---------- /api/register-push (Emergent playbook contract) ----------------
register_router = APIRouter(prefix="/api", tags=["push-register"])


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@register_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    """Relay a native device token to the Emergent push provider.

    This is the canonical endpoint per the Emergent push playbook. The
    frontend hook obtains the token via `getDevicePushTokenAsync()` and POSTs
    here on every app open. We do NOT store the token in our DB — Emergent
    resolves recipients by `user_id` at send time."""
    from services.push_service import register_device

    ok = await register_device(body.user_id, body.platform, body.device_token)
    if not ok:
        # Surface as 500 — frontend retries on next app open anyway.
        raise HTTPException(status_code=500, detail="Push provider unavailable")
    # Stamp the user doc so we can show "Notifications enabled" in settings
    if _db is not None:
        await _db.users.update_one(
            {"user_id": body.user_id},
            {
                "$set": {
                    "push_registered_at": datetime.now(timezone.utc),
                    "push_platform": body.platform,
                }
            },
        )
    return {"status": "registered"}


# ---------- /api/notifications/* (preferences + utility endpoints) ---------
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


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


# ---- Preferences (used by the daily scheduler) ----------------------------
class NotificationPrefs(BaseModel):
    """Per-user reminder preferences.

    All times are LOCAL hour (0-23) in the user's timezone; we store
    `timezone_offset_minutes` so the scheduler can convert to UTC.
    Defaults: Oracle 9am, Dreams 7am, both enabled."""
    oracle_reminder_enabled: bool = True
    oracle_reminder_hour: int = Field(9, ge=0, le=23)
    dream_reminder_enabled: bool = True
    dream_reminder_hour: int = Field(7, ge=0, le=23)
    # Offset is *minutes east of UTC* (matches JS getTimezoneOffset() * -1).
    timezone_offset_minutes: int = Field(0, ge=-720, le=840)


DEFAULT_PREFS: dict = NotificationPrefs().model_dump()


@router.get("/preferences")
async def get_preferences(request: Request):
    me = await _require_user(request)
    prefs = me.get("notification_prefs") or {}
    merged = {**DEFAULT_PREFS, **prefs}
    return merged


@router.put("/preferences")
async def update_preferences(prefs: NotificationPrefs, request: Request):
    me = await _require_user(request)
    await _db.users.update_one(
        {"user_id": me["user_id"]},
        {"$set": {"notification_prefs": prefs.model_dump()}},
    )
    return {"success": True, "preferences": prefs.model_dump()}


# ---- Test push -----------------------------------------------------------
@router.post("/test")
async def test_push(request: Request):
    """Send a test push to the current user (verifies Emergent + device token)."""
    me = await _require_user(request)
    from services.push_service import send_push

    ok = await send_push(
        [me["user_id"]],
        {
            "title": "✨ Etheria test",
            "message": "Your push notifications are working!",
            "deeplink": "/",
        },
    )
    return {"success": ok}


# ---- Legacy register alias (back-compat shim) -----------------------------
class LegacyRegisterBody(BaseModel):
    token: str
    device_info: Optional[dict] = None


@router.post("/register")
async def legacy_register(req: LegacyRegisterBody, request: Request):
    """Legacy alias kept so older clients can still register without crashing.

    The new frontend hook calls `/api/register-push` directly. This shim
    forwards to the same Emergent relay using the user_id from the bearer
    session and `platform` derived from device_info."""
    me = await _require_user(request)
    from services.push_service import register_device

    platform = (req.device_info or {}).get("os") or "android"
    ok = await register_device(me["user_id"], platform, req.token)
    return {"success": ok, "registered": req.token if ok else None}
