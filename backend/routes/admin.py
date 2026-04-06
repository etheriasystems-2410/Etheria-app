"""
Admin, Gift Codes, Prize Drawing, Feedback, and TTS endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from emergentintegrations.llm.chat import LlmChat, UserMessage
from .deps import (
    db, EMERGENT_LLM_KEY, ADMIN_SECRET, GMAIL_EMAIL, GMAIL_APP_PASSWORD,
    MYSTICAL_PREFIXES, MYSTICAL_MIDDLES, MYSTICAL_SUFFIXES, 
    SPIRIT_GUIDE_VOICES, openai_tts
)
from .auth_utils import get_current_user

# ==================== TTS ROUTER ====================
tts_router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str
    guide_name: Optional[str] = None
    voice_id: Optional[str] = None
    language: Optional[str] = "en"


class TTSResponse(BaseModel):
    audio_base64: Optional[str] = None
    text: str
    guide_name: Optional[str] = None
    error: Optional[str] = None
    success: bool = True


@tts_router.post("/generate", response_model=TTSResponse)
async def generate_tts(request: TTSRequest):
    """Generate text-to-speech audio"""
    if not request.text or not request.text.strip():
        return TTSResponse(
            text=request.text,
            success=False,
            error="Text cannot be empty"
        )
    
    voice = "nova"  # Default voice
    
    if request.guide_name and request.guide_name in SPIRIT_GUIDE_VOICES:
        voice = SPIRIT_GUIDE_VOICES[request.guide_name]["voice"]
    elif request.voice_id:
        voice = request.voice_id
    
    try:
        if EMERGENT_LLM_KEY and openai_tts:
            audio_base64 = await openai_tts.generate_speech_base64(
                text=request.text,
                voice=voice,
                model="tts-1",
                response_format="mp3"
            )
            
            return TTSResponse(
                audio_base64=audio_base64,
                text=request.text,
                guide_name=request.guide_name,
                success=True
            )
        else:
            return TTSResponse(
                text=request.text,
                success=False,
                error="TTS not configured"
            )
    except Exception as e:
        logging.error(f"TTS error: {e}")
        return TTSResponse(
            text=request.text,
            success=False,
            error=str(e)
        )


# ==================== GIFT CODE ROUTER ====================
gift_code_router = APIRouter(prefix="/gift-code", tags=["gift-code"])


class RedeemCodeRequest(BaseModel):
    code: str


async def generate_mystical_code():
    """Generate a mystical promotional code using AI"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"code-gen-{uuid.uuid4()}",
            system_message="You generate mystical, spiritual-themed promotional codes. Generate codes that feel magical and otherworldly. Format: 1-3 words separated by hyphens, using mystical/cosmic terminology."
        ).with_model("gemini", "gemini-2.0-flash")
        
        response = await chat.send_message(
            UserMessage(text="Generate a single mystical promotional code (format: WORD-WORD-WORD, cosmic/spiritual themed, uppercase). Just the code, nothing else.")
        )
        
        code = response.strip().upper().replace(" ", "-")
        if len(code) > 20 or len(code) < 5:
            code = f"{random.choice(MYSTICAL_PREFIXES)}-{random.choice(MYSTICAL_MIDDLES)}-{random.choice(MYSTICAL_SUFFIXES)}"
        
        return code
    except Exception as e:
        logging.error(f"Error generating AI code: {e}")
        return f"{random.choice(MYSTICAL_PREFIXES)}-{random.choice(MYSTICAL_MIDDLES)}-{random.choice(MYSTICAL_SUFFIXES)}"


async def generate_weekly_code():
    """Get or create the current week's gift code"""
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    
    existing_code = await db.gift_codes.find_one({
        "week_start": {"$gte": week_start.isoformat()},
        "is_active": True
    })
    
    if existing_code:
        existing_code["week_end"] = week_end
        return existing_code
    
    new_code = await generate_mystical_code()
    
    code_doc = {
        "code": new_code,
        "week_start": week_start,
        "week_end": week_end,
        "is_active": True,
        "created_at": now.isoformat(),
        "redemptions": []
    }
    
    await db.gift_codes.insert_one(code_doc)
    return code_doc


@gift_code_router.get("/current")
async def get_current_gift_code(request: Request):
    """Get the current week's active gift code"""
    code_doc = await generate_weekly_code()
    
    return {
        "code": code_doc["code"],
        "expires_at": code_doc["week_end"].isoformat(),
        "redemptions_count": len(code_doc.get("redemptions", []))
    }


@gift_code_router.post("/redeem")
async def redeem_gift_code(redeem_request: RedeemCodeRequest, request: Request):
    """Redeem a gift code for 1 month free premium"""
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please login to redeem a code")
    
    code = redeem_request.code.strip().upper()
    
    code_doc = await db.gift_codes.find_one({
        "code": code,
        "is_active": True
    })
    
    if not code_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    now = datetime.now(timezone.utc)
    week_end = code_doc["week_end"]
    if isinstance(week_end, str):
        week_end = datetime.fromisoformat(week_end.replace('Z', '+00:00'))
    if week_end.tzinfo is None:
        week_end = week_end.replace(tzinfo=timezone.utc)
    if now > week_end:
        raise HTTPException(status_code=400, detail="This code has expired")
    
    user_id = user.get("user_id")
    if user_id in [str(r.get("user_id")) for r in code_doc.get("redemptions", [])]:
        raise HTTPException(status_code=400, detail="You have already redeemed this code")
    
    existing_user = await db.users.find_one({"user_id": user_id})
    new_expires = now + timedelta(days=30)
    
    if existing_user:
        current_expires = existing_user.get("subscription_expires_at")
        if current_expires:
            if isinstance(current_expires, str):
                current_expires = datetime.fromisoformat(current_expires.replace("Z", "+00:00"))
            if current_expires.tzinfo is None:
                current_expires = current_expires.replace(tzinfo=timezone.utc)
            if current_expires > now:
                new_expires = current_expires + timedelta(days=30)
    
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "is_premium": True,
                "subscription_status": "gift_code",
                "subscription_expires_at": new_expires.isoformat(),
                "gift_code_redeemed_at": now.isoformat()
            }
        }
    )
    
    await db.gift_codes.update_one(
        {"_id": code_doc["_id"]},
        {
            "$push": {
                "redemptions": {
                    "user_id": user_id,
                    "email": user.get("email"),
                    "redeemed_at": now.isoformat()
                }
            }
        }
    )
    
    return {
        "success": True,
        "message": "Congratulations! You now have 1 month of premium access!",
        "expires_at": new_expires.isoformat()
    }


# ==================== PRIZE DRAWING ROUTER ====================
prize_drawing_router = APIRouter(prefix="/prize-drawing", tags=["prize-drawing"])


class PrizeDrawingOptIn(BaseModel):
    opt_in: bool = True


def get_next_drawing_date():
    """Get the date of the next monthly drawing"""
    now = datetime.now(timezone.utc)
    if now.day == 1:
        return now.replace(hour=12, minute=0, second=0, microsecond=0)
    
    if now.month == 12:
        return datetime(now.year + 1, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    else:
        return datetime(now.year, now.month + 1, 1, 12, 0, 0, tzinfo=timezone.utc)


@prize_drawing_router.post("/opt-in")
async def opt_in_prize_drawing(opt_in_request: PrizeDrawingOptIn, request: Request):
    """Opt in or out of the monthly prize drawing"""
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please login to participate")
    
    await db.users.update_one(
        {"user_id": user.get("user_id")},
        {
            "$set": {
                "prize_drawing_opted_in": opt_in_request.opt_in,
                "prize_drawing_opted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "opted_in": opt_in_request.opt_in,
        "message": "You're now entered in the monthly prize drawing!" if opt_in_request.opt_in else "You've opted out of the prize drawing"
    }


@prize_drawing_router.get("/status")
async def get_prize_drawing_status(request: Request):
    """Get user's prize drawing status and eligibility"""
    try:
        user = await get_current_user(request)
    except HTTPException:
        return {
            "opted_in": False,
            "eligible": False,
            "weekly_usage_minutes": 0,
            "required_minutes": 30
        }
    
    user_doc = await db.users.find_one({"user_id": user.get("user_id")})
    opted_in = user_doc.get("prize_drawing_opted_in", False) if user_doc else False
    
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    user_id = user.get("user_id")
    sessions = await db.usage_tracking.find({
        "user_id": user_id,
        "timestamp": {"$gte": week_start.isoformat()}
    }).to_list(1000)
    
    total_seconds = sum(s.get("duration_seconds", 0) for s in sessions)
    total_minutes = total_seconds / 60
    
    return {
        "opted_in": opted_in,
        "eligible": total_minutes >= 30,
        "weekly_usage_minutes": round(total_minutes, 1),
        "required_minutes": 30,
        "week_start": week_start.isoformat(),
        "next_drawing": get_next_drawing_date().isoformat()
    }


# ==================== USAGE TRACKING ROUTER ====================
usage_router = APIRouter(prefix="/usage", tags=["usage"])


@usage_router.post("/track")
async def track_usage(request: Request):
    """Track user's app usage for prize drawing eligibility"""
    body = await request.json()
    duration_seconds = body.get("duration_seconds", 0)
    activity_type = body.get("activity_type", "general")
    
    try:
        user = await get_current_user(request)
        user_id = str(user.get("user_id") or user.get("_id"))
    except HTTPException:
        return {"tracked": False, "reason": "Not logged in"}
    
    await db.usage_tracking.insert_one({
        "user_id": user_id,
        "duration_seconds": duration_seconds,
        "activity_type": activity_type,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"tracked": True, "duration_seconds": duration_seconds}


# ==================== ADMIN ROUTER ====================
admin_router = APIRouter(prefix="/admin", tags=["admin"])


async def send_winner_email(email: str, code: str, expires_at: str):
    """Send winner notification email via Gmail SMTP"""
    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        logging.error("Gmail credentials not configured")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = '🎉 Congratulations! You Won the Etheria Monthly Drawing!'
        msg['From'] = GMAIL_EMAIL
        msg['To'] = email
        
        text = f"""
Congratulations! 🌟

You have been selected as the winner of Etheria's monthly prize drawing!

Your reward: 1 Month of FREE Premium Access

To claim your prize, use this exclusive code:
{code}

This code expires on: {expires_at}

How to redeem:
1. Open the Etheria app
2. Go to Settings or tap "Subscribe Now"
3. Click "Have a code?" 
4. Enter your code: {code}
5. Enjoy your free month of premium features!

Thank you for being part of the Etheria community.

Blessings on your spiritual journey,
The Etheria Team
        """
        
        part1 = MIMEText(text, 'plain')
        msg.attach(part1)
        
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_EMAIL, email, msg.as_string())
        server.quit()
        
        return True
    except Exception as e:
        logging.error(f"Failed to send winner email: {e}")
        return False


@admin_router.post("/prize-drawing/run")
async def run_prize_drawing(request: Request):
    """Run the monthly prize drawing (admin only)"""
    body = await request.json()
    admin_secret = body.get("admin_secret")
    test_mode = body.get("test_mode", False)
    
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    opted_in_users = await db.users.find({
        "prize_drawing_opted_in": True
    }).to_list(10000)
    
    eligible_users = []
    
    for user in opted_in_users:
        user_id = str(user.get("user_id") or user.get("_id"))
        
        if test_mode:
            eligible_users.append(user)
            continue
        
        weeks_checked = 0
        weeks_eligible = 0
        
        check_date = month_start
        while check_date < now:
            week_end = min(check_date + timedelta(days=7), now)
            
            sessions = await db.usage_tracking.find({
                "user_id": user_id,
                "timestamp": {
                    "$gte": check_date.isoformat(),
                    "$lt": week_end.isoformat()
                }
            }).to_list(1000)
            
            total_seconds = sum(s.get("duration_seconds", 0) for s in sessions)
            if total_seconds >= 1800:
                weeks_eligible += 1
            
            weeks_checked += 1
            check_date = week_end
        
        if weeks_checked > 0 and weeks_eligible >= (weeks_checked / 2):
            eligible_users.append(user)
    
    if not eligible_users:
        return {
            "success": False,
            "message": "No eligible participants this month",
            "participants_count": len(opted_in_users),
            "eligible_count": 0
        }
    
    winner = random.choice(eligible_users)
    code_doc = await generate_weekly_code()
    
    winner_email = winner.get("email")
    email_sent = await send_winner_email(
        winner_email,
        code_doc["code"],
        code_doc["week_end"].strftime("%B %d, %Y")
    )
    
    drawing_record = {
        "drawing_date": now.isoformat(),
        "month": now.strftime("%B %Y"),
        "winner_id": str(winner.get("_id")),
        "winner_email": winner_email,
        "code_given": code_doc["code"],
        "code_expires": code_doc["week_end"].isoformat(),
        "email_sent": email_sent,
        "total_participants": len(opted_in_users),
        "eligible_participants": len(eligible_users)
    }
    
    await db.prize_drawings.insert_one(drawing_record)
    
    return {
        "success": True,
        "winner_email": winner_email,
        "code_given": code_doc["code"],
        "email_sent": email_sent,
        "total_participants": len(opted_in_users),
        "eligible_participants": len(eligible_users)
    }


@admin_router.get("/dashboard")
async def get_admin_dashboard(admin_secret: str):
    """Get admin dashboard data"""
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    code_doc = await generate_weekly_code()
    participants = await db.users.count_documents({"prize_drawing_opted_in": True})
    winners = await db.prize_drawings.find().sort("drawing_date", -1).limit(12).to_list(12)
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"is_premium": True})
    
    return {
        "current_code": {
            "code": code_doc["code"],
            "expires_at": code_doc["week_end"].isoformat(),
            "redemptions_count": len(code_doc.get("redemptions", []))
        },
        "prize_drawing": {
            "participants_count": participants,
            "next_drawing": get_next_drawing_date().isoformat()
        },
        "previous_winners": [
            {
                "month": w.get("month"),
                "winner_email": w.get("winner_email", "").replace("@", " at ").split(" at ")[0] + "...@...",
                "drawing_date": w.get("drawing_date"),
                "eligible_count": w.get("eligible_participants", 0)
            }
            for w in winners
        ],
        "stats": {
            "total_users": total_users,
            "premium_users": premium_users
        }
    }


@admin_router.get("/participants")
async def get_drawing_participants(admin_secret: str):
    """Get list of prize drawing participants"""
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    participants = await db.users.find(
        {"prize_drawing_opted_in": True},
        {"email": 1, "name": 1, "prize_drawing_opted_at": 1}
    ).to_list(10000)
    
    return {
        "count": len(participants),
        "participants": [
            {
                "email": p.get("email"),
                "name": p.get("name"),
                "opted_at": p.get("prize_drawing_opted_at")
            }
            for p in participants
        ]
    }


@admin_router.post("/generate-new-code")
async def admin_generate_new_code(request: Request):
    """Force generate a new code (admin only)"""
    body = await request.json()
    admin_secret = body.get("admin_secret")
    
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    await db.gift_codes.update_many(
        {"is_active": True},
        {"$set": {"is_active": False}}
    )
    
    code_doc = await generate_weekly_code()
    
    return {
        "success": True,
        "new_code": code_doc["code"],
        "expires_at": code_doc["week_end"].isoformat()
    }


# ==================== FEEDBACK ROUTER ====================
feedback_router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    type: str  # bug, suggestion, question, other
    subject: str
    message: str
    user_email: str
    user_name: Optional[str] = "Anonymous"


async def send_feedback_email(feedback: FeedbackRequest):
    """Send feedback email via Gmail SMTP"""
    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        logging.error("Gmail credentials not configured for feedback")
        return False
    
    try:
        type_emoji = {"bug": "🐛", "suggestion": "💡", "question": "❓", "other": "💬"}
        emoji = type_emoji.get(feedback.type, "📧")
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'{emoji} Etheria Feedback: [{feedback.type.upper()}] {feedback.subject}'
        msg['From'] = GMAIL_EMAIL
        msg['To'] = 'etheriasystems@gmail.com'
        msg['Reply-To'] = feedback.user_email
        
        text = f"""
New Feedback Received from Etheria App
=====================================

Type: {feedback.type.upper()}
From: {feedback.user_name}
Email: {feedback.user_email}
Subject: {feedback.subject}

Message:
{feedback.message}
        """
        
        part1 = MIMEText(text, 'plain')
        msg.attach(part1)
        
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_EMAIL, 'etheriasystems@gmail.com', msg.as_string())
        server.quit()
        
        return True
    except Exception as e:
        logging.error(f"Failed to send feedback email: {e}")
        return False


@feedback_router.post("/submit")
async def submit_feedback(feedback: FeedbackRequest):
    """Submit user feedback"""
    feedback_doc = {
        "_id": str(uuid.uuid4()),
        "type": feedback.type,
        "subject": feedback.subject,
        "message": feedback.message,
        "user_email": feedback.user_email,
        "user_name": feedback.user_name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feedback.insert_one(feedback_doc)
    email_sent = await send_feedback_email(feedback)
    
    return {
        "success": True,
        "message": "Thank you for your feedback! We'll review it soon.",
        "email_sent": email_sent
    }


# ==================== NOTIFICATIONS ROUTER ====================
notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])


class PushTokenRequest(BaseModel):
    token: str
    platform: str


@notifications_router.post("/register")
async def register_push_token(token_request: PushTokenRequest, request: Request):
    """Register a push notification token"""
    try:
        user = await get_current_user(request)
        user_id = user.get("user_id")
    except HTTPException:
        user_id = None
    
    await db.push_tokens.update_one(
        {"token": token_request.token},
        {
            "$set": {
                "token": token_request.token,
                "platform": token_request.platform,
                "user_id": user_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"success": True, "message": "Push token registered"}


@notifications_router.get("/tokens/count")
async def get_push_token_count():
    """Get total number of registered push tokens"""
    try:
        count = await db.push_tokens.count_documents({})
        return {"count": count}
    except Exception as e:
        logging.error(f"Error getting push token count: {e}")
        raise HTTPException(status_code=500, detail="Failed to get token count")
