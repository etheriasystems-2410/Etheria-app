"""
Authentication endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging
import httpx

from .deps import db, JWT_EXPIRATION_DAYS, EMERGENT_AUTH_SESSION_ENDPOINT
from .auth_utils import hash_password, verify_password, create_session_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


# Models
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup")
async def signup(request: SignupRequest):
    """Create new user account with email/password"""
    # Check if user exists
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request.password)
    
    user_doc = {
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "password_hash": password_hash,
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = create_session_token()
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Return user and set cookie
    response = JSONResponse(content={
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "picture": None
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/",
        samesite="lax"
    )
    
    return response


@router.post("/login")
async def login(request: LoginRequest):
    """Login with email/password"""
    # Find user
    user_doc = await db.users.find_one({"email": request.email})
    
    if not user_doc or not verify_password(request.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create session
    session_token = create_session_token()
    session_doc = {
        "session_token": session_token,
        "user_id": user_doc["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Return user and set cookie
    response = JSONResponse(content={
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "picture": user_doc.get("picture"),
        "session_token": session_token  # Include token for mobile apps
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/",
        samesite="lax"
    )
    
    return response


@router.post("/google-callback")
async def google_auth_callback(session_id: str):
    """Exchange Emergent OAuth session_id for user data"""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                EMERGENT_AUTH_SESSION_ENDPOINT,
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")
            
            data = response.json()
            
            # Check if user exists, create if not
            user_doc = await db.users.find_one({"email": data["email"]})
            
            if not user_doc:
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                user_doc = {
                    "user_id": user_id,
                    "email": data["email"],
                    "name": data["name"],
                    "picture": data.get("picture"),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user_doc)
            else:
                # Update name and picture if changed
                await db.users.update_one(
                    {"user_id": user_doc["user_id"]},
                    {"$set": {
                        "name": data["name"],
                        "picture": data.get("picture")
                    }}
                )
            
            # Create session using token from Emergent
            session_token = data["session_token"]
            session_doc = {
                "session_token": session_token,
                "user_id": user_doc["user_id"],
                "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.user_sessions.insert_one(session_doc)
            
            # Return user and set cookie
            response_obj = JSONResponse(content={
                "user_id": user_doc["user_id"],
                "email": user_doc["email"],
                "name": user_doc["name"],
                "picture": user_doc.get("picture"),
                "session_token": session_token  # Include token in response for mobile
            })
            
            response_obj.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
                path="/",
                samesite="lax"
            )
            
            return response_obj
            
    except Exception as e:
        logging.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@router.get("/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user


@router.post("/logout")
async def logout(request: Request):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response = JSONResponse(content={"success": True})
    response.delete_cookie("session_token", path="/")
    return response


# User Profile Endpoints
class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None


@router.patch("/update-profile")
async def update_profile(request: Request, data: UpdateProfileRequest):
    """Update user profile"""
    user = await get_current_user(request)
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.picture:
        update_data["picture"] = data.picture
    
    if update_data:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data}
        )
    
    # Return updated user
    updated_user = await db.users.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    return updated_user
