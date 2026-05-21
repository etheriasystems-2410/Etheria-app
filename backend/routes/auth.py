"""
Authentication routes - signup, login, Google OAuth callback, me/logout, profile.

Uses set_db()/set_config() to receive shared dependencies from server.py at startup.
Exposes hash_password, verify_password, create_session_token, get_current_user as
helpers other server modules can reuse.
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/api", tags=["auth"])

# Module-level dependencies (injected at startup)
_db = None
_config = {
    "JWT_EXPIRATION_DAYS": 7,
    "EMERGENT_AUTH_SESSION_ENDPOINT": os.environ.get("EMERGENT_AUTH_SESSION_ENDPOINT"),
}


def set_db(db):
    global _db
    _db = db


def set_config(**kwargs):
    """Allow server.py to override config (JWT_EXPIRATION_DAYS, EMERGENT_AUTH_SESSION_ENDPOINT)."""
    _config.update(kwargs)


# ----- Models -----

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None


# ----- Helpers (re-exported for use elsewhere) -----

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_session_token() -> str:
    return f"session_{uuid.uuid4().hex}"


def _enforce_account_status(user_doc: dict) -> None:
    """
    Reject login for users whose account has been cancelled by moderation
    or who are currently under an active suspension window.

    - account_status == 'cancelled'  → 403, permanent block
    - account_status == 'suspended' AND suspension_end is in the future → 403,
      with the suspension end timestamp in the error detail.
    - account_status == 'suspended' BUT suspension_end has passed → allowed
      (auto-reactivation will catch up via the hourly background job, but in the
      meantime we don't want a paying user locked out).
    """
    status = (user_doc or {}).get("account_status") or "active"

    if status == "cancelled":
        raise HTTPException(
            status_code=403,
            detail=(
                "Your Etheria account has been cancelled due to repeated "
                "violations of our Community Guidelines. If you believe this "
                "was made in error, please contact etheriasystems@gmail.com."
            ),
        )

    if status == "suspended":
        suspension_end = user_doc.get("suspension_end")
        # Normalize to aware UTC datetime if possible
        if isinstance(suspension_end, str):
            try:
                suspension_end = datetime.fromisoformat(suspension_end.replace("Z", "+00:00"))
            except ValueError:
                suspension_end = None
        if isinstance(suspension_end, datetime):
            if suspension_end.tzinfo is None:
                suspension_end = suspension_end.replace(tzinfo=timezone.utc)
            if suspension_end > datetime.now(timezone.utc):
                # Still inside the suspension window — block.
                ends_iso = suspension_end.isoformat()
                raise HTTPException(
                    status_code=403,
                    detail=(
                        f"Your Etheria account is suspended until {ends_iso}. "
                        "If you believe this was made in error, please contact "
                        "etheriasystems@gmail.com."
                    ),
                )
        # Else: suspension_end missing or already passed → allow login.


async def get_current_user(request: Request) -> dict:
    """Get current authenticated user from session (cookie or Bearer token)."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await _db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0},
    )
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await _db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0, "password_hash": 0},
    )
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    return user_doc


# ----- Endpoints -----

@router.post("/auth/signup")
async def signup(request: SignupRequest):
    """Create new user account with email/password."""
    existing = await _db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request.password)

    user_doc = {
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "password_hash": password_hash,
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.users.insert_one(user_doc)

    session_token = create_session_token()
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=_config["JWT_EXPIRATION_DAYS"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.user_sessions.insert_one(session_doc)

    response = JSONResponse(content={
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "picture": None,
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=_config["JWT_EXPIRATION_DAYS"] * 24 * 60 * 60,
        path="/",
        samesite="lax",
    )
    return response


@router.post("/auth/login")
async def login(request: LoginRequest):
    """Login with email/password."""
    user_doc = await _db.users.find_one({"email": request.email})
    if not user_doc or not verify_password(request.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Block cancelled / suspended accounts from logging in
    _enforce_account_status(user_doc)

    session_token = create_session_token()
    session_doc = {
        "session_token": session_token,
        "user_id": user_doc["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=_config["JWT_EXPIRATION_DAYS"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.user_sessions.insert_one(session_doc)

    response = JSONResponse(content={
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc.get("name", ""),
        "display_name": user_doc.get("display_name"),
        "picture": user_doc.get("picture"),
        "is_admin": user_doc.get("is_admin", False),
        "admin_level": user_doc.get("admin_level"),
        "session_token": session_token,
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=_config["JWT_EXPIRATION_DAYS"] * 24 * 60 * 60,
        path="/",
        samesite="lax",
    )
    return response


@router.post("/auth/google-callback")
async def google_auth_callback(session_id: str):
    """Exchange Emergent OAuth session_id for user data."""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                _config["EMERGENT_AUTH_SESSION_ENDPOINT"],
                headers={"X-Session-ID": session_id},
            )
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")

            data = response.json()

            user_doc = await _db.users.find_one({"email": data["email"]})
            if not user_doc:
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                user_doc = {
                    "user_id": user_id,
                    "email": data["email"],
                    "name": data["name"],
                    "picture": data.get("picture"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await _db.users.insert_one(user_doc)
            else:
                await _db.users.update_one(
                    {"user_id": user_doc["user_id"]},
                    {"$set": {"name": data["name"], "picture": data.get("picture")}},
                )

            # Block cancelled / suspended accounts from logging in
            _enforce_account_status(user_doc)

            session_token = data["session_token"]
            session_doc = {
                "session_token": session_token,
                "user_id": user_doc["user_id"],
                "expires_at": datetime.now(timezone.utc) + timedelta(days=_config["JWT_EXPIRATION_DAYS"]),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await _db.user_sessions.insert_one(session_doc)

            response_obj = JSONResponse(content={
                "user_id": user_doc["user_id"],
                "email": user_doc["email"],
                "name": user_doc["name"],
                "picture": user_doc.get("picture"),
                "session_token": session_token,
            })
            response_obj.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                max_age=_config["JWT_EXPIRATION_DAYS"] * 24 * 60 * 60,
                path="/",
                samesite="lax",
            )
            return response_obj
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user."""
    return await get_current_user(request)


@router.post("/auth/logout")
async def logout(request: Request):
    """Logout user and clear session."""
    session_token = request.cookies.get("session_token")
    if session_token:
        await _db.user_sessions.delete_one({"session_token": session_token})

    response = JSONResponse(content={"success": True})
    response.delete_cookie("session_token", path="/")
    return response


@router.patch("/user/update-profile")
async def update_profile(request: Request, data: UpdateProfileRequest):
    """Update user profile (name and/or picture)."""
    user = await get_current_user(request)

    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.picture:
        update_data["picture"] = data.picture

    if update_data:
        await _db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data},
        )

    updated_user = await _db.users.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "password_hash": 0},
    )
    return updated_user
