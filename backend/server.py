from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import random
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAITextToSpeech
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
import base64
import io
import bcrypt
import jwt
import httpx
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from typing import Dict
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio

# Import training content from data module
from data.training_content import TRAINING_MODULES, LESSON_CONTENT  # noqa: F401  # used by routes.training

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise ValueError("MONGO_URL environment variable is required")
db_name = os.environ.get('DB_NAME', 'etheria_db')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Gemini API key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# OpenAI TTS Configuration (replacing ElevenLabs)
openai_tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'change_this_secret_key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Emergent Auth Configuration
EMERGENT_AUTH_SESSION_ENDPOINT = os.environ.get('EMERGENT_AUTH_SESSION_ENDPOINT')

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
MONTHLY_SUBSCRIPTION_PRICE = 3.99  # $3.99 USD

# Subscription Plans - Server-side defined (NEVER accept from frontend)
SUBSCRIPTION_PLANS = {
    "premium_monthly": {
        "name": "Etheria Premium Monthly",
        "price": 3.99,
        "currency": "usd",
        "features": [
            "Unlimited Oracle readings with AI",
            "Access to all Spirit Guides",
            "AI Guided Meditation",
            "Binaural & Astral Meditation",
            "Unlimited Journal entries",
            "All Training modules"
        ]
    }
}

# Free tier limits
FREE_TIER_LIMITS = {
    "oracle_readings_per_day": 1,
    "journal_entries_max": 5,
    "training_modules": 1,  # Only first beginner module
    "spirit_guides": False,
    "binaural_meditation": False,
    "astral_meditation": False,
    "ai_guided_meditation": False,
    "tts_enabled": False
}

# Gmail SMTP Configuration for prize drawing
GMAIL_EMAIL = os.environ.get('GMAIL_EMAIL')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'etheria_admin_secret_2026')

# Mystical code word lists for AI-generated codes
MYSTICAL_PREFIXES = ["LUNA", "STELLAR", "COSMIC", "MYSTIC", "ETHEREAL", "ASTRAL", "CELESTIAL", "DIVINE", "SACRED", "ORACLE"]
MYSTICAL_MIDDLES = ["MOON", "STAR", "SPIRIT", "CRYSTAL", "PHOENIX", "DRAGON", "SAGE", "DREAM", "VISION", "FLAME"]
MYSTICAL_SUFFIXES = ["RISE", "LIGHT", "POWER", "MAGIC", "BLOOM", "FLOW", "GLOW", "WAVE", "PATH", "SOUL"]

# Spirit Guide Voice Configuration
# Using OpenAI TTS voices with appropriate personalities
SPIRIT_GUIDE_VOICES = {
    "Ignis": {
        "voice": "onyx",  # Deep, authoritative - for Fire
        "gender": "masculine",
        "element": "Fire",
        "personality": "passionate, direct, transformative"
    },
    "Aqua": {
        "voice": "shimmer",  # Bright, cheerful - for Water (feminine feel)
        "gender": "feminine",
        "element": "Water",
        "personality": "intuitive, healing, emotionally wise"
    },
    "Terra": {
        "voice": "echo",  # Smooth, calm - for Earth (grounded)
        "gender": "masculine",
        "element": "Earth",
        "personality": "grounded, practical, stable"
    },
    "Aether": {
        "voice": "nova",  # Energetic, upbeat - for Air (free-spirited)
        "gender": "feminine",
        "element": "Air",
        "personality": "intellectual, free-spirited, enlightening"
    }
}

# Zodiac to Element mapping
ZODIAC_TO_ELEMENT = {
    # Fire signs
    "aries": "Fire",
    "leo": "Fire",
    "sagittarius": "Fire",
    # Water signs
    "cancer": "Water",
    "scorpio": "Water",
    "pisces": "Water",
    # Earth signs
    "taurus": "Earth",
    "virgo": "Earth",
    "capricorn": "Earth",
    # Air signs
    "gemini": "Air",
    "libra": "Air",
    "aquarius": "Air"
}

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Oracle Cards - Spirit Guide themed with beautiful illustrations
ORACLE_CARDS = [
    # Fire Element Cards
    {
        "name": "The Fire Phoenix",
        "element": "Fire",
        "description": "Transformation through passion and rebirth",
        "keywords": ["transformation", "passion", "renewal", "energy"],
        "image_prompt": "Mystical phoenix bird rising from flames, glowing orange and red feathers, magical fire swirling, dark mystical background, oracle tarot card art style"
    },
    {
        "name": "The Flame Dancer",
        "element": "Fire",
        "description": "Creative expression and bold action",
        "keywords": ["creativity", "action", "courage", "expression"],
        "image_prompt": "Ethereal spirit dancing within flames, flowing fire dress, mystical orange and gold light, oracle card art style"
    },
    {
        "name": "The Sacred Ember",
        "element": "Fire",
        "description": "Inner spark and divine inspiration",
        "keywords": ["inspiration", "motivation", "divine spark", "purpose"],
        "image_prompt": "Glowing mystical ember floating in darkness, warm orange light radiating outward, sacred geometry, oracle card art"
    },
    {
        "name": "The Blazing Sun",
        "element": "Fire",
        "description": "Vitality, confidence, and illumination",
        "keywords": ["vitality", "confidence", "illumination", "power"],
        "image_prompt": "Magnificent golden sun with corona flames, mystical face, rays of divine light, cosmic background, oracle card art"
    },
    {
        "name": "The Dragon's Heart",
        "element": "Fire",
        "description": "Fierce protection and inner strength",
        "keywords": ["protection", "strength", "courage", "guardian"],
        "image_prompt": "Glowing red crystalline dragon heart surrounded by fire, mystical scales, powerful energy, oracle tarot card art"
    },
    # Water Element Cards
    {
        "name": "The Ocean Depths",
        "element": "Water",
        "description": "Deep emotions and subconscious wisdom",
        "keywords": ["emotions", "intuition", "depth", "subconscious"],
        "image_prompt": "Deep mystical ocean with bioluminescent creatures, ancient underwater temple, ethereal blue light, oracle card art"
    },
    {
        "name": "The Healing Spring",
        "element": "Water",
        "description": "Emotional cleansing and renewal",
        "keywords": ["healing", "cleansing", "forgiveness", "renewal"],
        "image_prompt": "Magical glowing spring water in enchanted forest, healing light emanating, mystical flowers, oracle card art"
    },
    {
        "name": "The Moon Tide",
        "element": "Water",
        "description": "Cycles, intuition, and psychic ability",
        "keywords": ["cycles", "intuition", "psychic", "feminine energy"],
        "image_prompt": "Full moon reflecting on mystical ocean waves, silver moonlight, tidal energy, stars above, oracle card art"
    },
    {
        "name": "The Mystic River",
        "element": "Water",
        "description": "Flow, adaptability, and life's journey",
        "keywords": ["flow", "adaptability", "journey", "change"],
        "image_prompt": "Enchanted glowing river flowing through mystical forest, magical mist rising, ethereal blue light, oracle card art"
    },
    {
        "name": "The Pearl of Wisdom",
        "element": "Water",
        "description": "Hidden treasures and inner beauty",
        "keywords": ["wisdom", "treasure", "beauty", "discovery"],
        "image_prompt": "Giant luminous pearl glowing with inner light, mystical underwater scene, ancient wisdom symbols, oracle card art"
    },
    # Earth Element Cards
    {
        "name": "The Ancient Tree",
        "element": "Earth",
        "description": "Grounding, wisdom, and stability",
        "keywords": ["grounding", "wisdom", "stability", "growth"],
        "image_prompt": "Massive ancient mystical tree with glowing roots, magical leaves, spirit faces in bark, sacred grove, oracle card art"
    },
    {
        "name": "The Sacred Mountain",
        "element": "Earth",
        "description": "Achievement and endurance",
        "keywords": ["achievement", "endurance", "strength", "foundation"],
        "image_prompt": "Mystical mountain peak touching stars, glowing summit, ancient stone temples, spiritual energy, oracle card art"
    },
    {
        "name": "The Blooming Garden",
        "element": "Earth",
        "description": "Abundance and manifestation",
        "keywords": ["abundance", "manifestation", "prosperity", "nurturing"],
        "image_prompt": "Enchanted garden with magical glowing flowers, butterflies of light, abundance energy, oracle tarot card art"
    },
    {
        "name": "The Crystal Cave",
        "element": "Earth",
        "description": "Inner reflection and hidden potential",
        "keywords": ["reflection", "potential", "clarity", "insight"],
        "image_prompt": "Mystical cave filled with glowing crystals, purple and blue light, ancient magic, sacred geometry, oracle card art"
    },
    {
        "name": "The Stone Guardian",
        "element": "Earth",
        "description": "Protection, patience, and perseverance",
        "keywords": ["protection", "patience", "perseverance", "resilience"],
        "image_prompt": "Ancient mystical stone golem guardian, covered in moss and runes, protective energy, oracle tarot card art"
    },
    # Air Element Cards
    {
        "name": "The Whispering Wind",
        "element": "Air",
        "description": "Messages and mental clarity",
        "keywords": ["messages", "clarity", "communication", "thought"],
        "image_prompt": "Ethereal wind spirit with flowing form, swirling air currents, mystical whispers visible, oracle card art"
    },
    {
        "name": "The Sky Dancer",
        "element": "Air",
        "description": "Freedom and new perspectives",
        "keywords": ["freedom", "perspective", "liberation", "change"],
        "image_prompt": "Graceful ethereal being dancing among clouds, flowing robes of mist, cosmic sky, oracle tarot card art"
    },
    {
        "name": "The Sacred Breath",
        "element": "Air",
        "description": "Life force and spiritual connection",
        "keywords": ["life force", "spirit", "connection", "awareness"],
        "image_prompt": "Mystical visualization of divine breath, golden light particles, spiritual energy flow, oracle card art"
    },
    {
        "name": "The Starlight Messenger",
        "element": "Air",
        "description": "Divine guidance and cosmic wisdom",
        "keywords": ["guidance", "cosmos", "wisdom", "destiny"],
        "image_prompt": "Celestial messenger angel among stars, wings of light, cosmic background, carrying divine scroll, oracle card art"
    },
    {
        "name": "The Feathered Oracle",
        "element": "Air",
        "description": "Spiritual messages and higher truth",
        "keywords": ["messages", "truth", "spirit", "ascension"],
        "image_prompt": "Mystical owl with glowing eyes, surrounded by floating feathers, ancient wisdom, starry night, oracle card art"
    },
    # Spirit Element Cards
    {
        "name": "The Third Eye",
        "element": "Spirit",
        "description": "Psychic vision and inner knowing",
        "keywords": ["psychic", "vision", "intuition", "insight"],
        "image_prompt": "Mystical third eye opening with cosmic vision, purple and indigo energy, sacred geometry, oracle card art"
    },
    {
        "name": "The Divine Lotus",
        "element": "Spirit",
        "description": "Spiritual awakening and enlightenment",
        "keywords": ["awakening", "enlightenment", "purity", "transformation"],
        "image_prompt": "Glowing lotus flower floating on mystical water, thousand petals of light, spiritual enlightenment, oracle card art"
    },
    {
        "name": "The Sacred Spiral",
        "element": "Spirit",
        "description": "Evolution and infinite possibilities",
        "keywords": ["evolution", "infinity", "growth", "cycles"],
        "image_prompt": "Cosmic spiral galaxy merging with sacred geometry, golden ratio, infinite evolution, oracle tarot card art"
    },
    {
        "name": "The Celestial Gateway",
        "element": "Spirit",
        "description": "Portals to higher dimensions",
        "keywords": ["portal", "dimensions", "transcendence", "expansion"],
        "image_prompt": "Mystical portal to higher dimensions, ancient stone archway with glowing runes, cosmic light, oracle card art"
    },
    {
        "name": "The Ancestor's Blessing",
        "element": "Spirit",
        "description": "Ancestral wisdom and heritage",
        "keywords": ["ancestors", "wisdom", "heritage", "blessing"],
        "image_prompt": "Ethereal ancestor spirits surrounding with blessing light, ancient symbols, warm golden glow, oracle card art"
    },
    {
        "name": "The Veil Between Worlds",
        "element": "Spirit",
        "description": "Connection to the spirit realm",
        "keywords": ["spirit realm", "connection", "mystery", "transition"],
        "image_prompt": "Mystical veil of mist separating two realms, spirits visible through thin barrier, ethereal twilight, oracle card art"
    },
    {
        "name": "The Infinite Mirror",
        "element": "Spirit",
        "description": "Self-reflection and soul recognition",
        "keywords": ["reflection", "soul", "recognition", "truth"],
        "image_prompt": "Mystical mirror reflecting infinite versions, cosmic self-reflection, ethereal glow, sacred symbols, oracle card art"
    }
]

# Image generator for oracle cards
oracle_image_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY) if EMERGENT_LLM_KEY else None

async def get_or_generate_card_image(card_name: str, image_prompt: str) -> str:
    """Get cached image or generate new one for oracle card"""
    # Check if image is cached in database
    cached = await db.oracle_card_images.find_one({"card_name": card_name})
    if cached and cached.get("image_base64"):
        return cached["image_base64"]
    
    # Generate new image
    if not oracle_image_gen:
        return None
    
    try:
        images = await oracle_image_gen.generate_images(
            prompt=image_prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            image_base64 = base64.b64encode(images[0]).decode('utf-8')
            
            # Cache in database
            await db.oracle_card_images.update_one(
                {"card_name": card_name},
                {"$set": {"card_name": card_name, "image_base64": image_base64, "created_at": datetime.now(timezone.utc)}},
                upsert=True
            )
            
            return image_base64
    except Exception as e:
        print(f"Error generating image for {card_name}: {e}")
    
    return None

# Models
class OracleReading(BaseModel):
    card: dict
    interpretation: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class SaveReadingRequest(BaseModel):
    card: dict
    interpretation: str
    timestamp: str

class SpiritGuideMessage(BaseModel):
    guide: str
    element: str
    message: str
    history: List[dict] = []
    language: str = "en"  # Language code for response and TTS

# Language names for system prompts
LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
}

class SpiritGuideResponse(BaseModel):
    response: str
    audio_base64: Optional[str] = None
    voice: Optional[str] = None
    success: bool = True

# Auth Models and helpers — extracted to routes/auth.py.
# Re-import here so existing inline references in server.py keep working.
from routes.auth import (
    SignupRequest,
    LoginRequest,
    UpdateProfileRequest,
    hash_password,
    verify_password,
    create_session_token,
    get_current_user,
)


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: str

# Routes
@api_router.get("/")
async def root():
    return {"message": "Psychic Awareness API"}

class MultiCardDrawRequest(BaseModel):
    spread_type: str = "single"
    card_count: int = 1
    positions: List[str] = ["Guidance"]

# Oracle endpoints — see routes/oracle.py


# Spirit Guides chat & voices — see routes/spirit_guides.py

# Meditation endpoints — see routes/meditation.py

# TTS and Voice endpoints
class RedeemCodeRequest(BaseModel):
    code: str

class PrizeDrawingOptIn(BaseModel):
    opt_in: bool

@api_router.post("/promo-code/redeem")
async def redeem_promo_code(redeem_request: RedeemCodeRequest, request: Request):
    """Redeem a promotional code (including lifetime premium codes)"""
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please login to redeem a code")
    
    code = redeem_request.code.strip().upper()
    now = datetime.now(timezone.utc)
    
    # First check promo_codes collection for special codes (like lifetime)
    promo_doc = await db.promo_codes.find_one({
        "code": code,
        "is_active": True
    })
    
    if promo_doc:
        # Check if code is still valid
        expires_at = promo_doc.get("expires_at")
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                raise HTTPException(status_code=400, detail="This promotional code has expired")
        
        # Check if user already redeemed this code
        user_id = user.get("user_id")
        if user_id in [str(r.get("user_id")) for r in promo_doc.get("redemptions", [])]:
            raise HTTPException(status_code=400, detail="You have already redeemed this code")
        
        # Get grants from the promo code
        grants = promo_doc.get("grants", {})
        subscription_type = grants.get("subscription_type", "monthly")
        
        # Update user based on promo type
        update_data = {
            "is_premium": True,
            "subscription_status": "promo_code",
            "promo_code_redeemed": code,
            "promo_code_redeemed_at": now.isoformat()
        }
        
        if subscription_type == "lifetime":
            # Lifetime premium - no expiration
            update_data["subscription_type"] = "lifetime"
            update_data["subscription_expires_at"] = None
            message = "Congratulations! You now have LIFETIME premium access!"
            expires_response = None
        else:
            # Standard time-limited promo
            duration_days = grants.get("duration_days", 30)
            new_expires = now + timedelta(days=duration_days)
            update_data["subscription_expires_at"] = new_expires.isoformat()
            message = f"Congratulations! You now have {duration_days} days of premium access!"
            expires_response = new_expires.isoformat()
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
        
        # Record the redemption
        await db.promo_codes.update_one(
            {"_id": promo_doc["_id"]},
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
            "message": message,
            "subscription_type": subscription_type,
            "expires_at": expires_response
        }
    
    # If not found in promo_codes, try gift_codes (existing weekly codes)
    gift_doc = await db.gift_codes.find_one({
        "code": code,
        "is_active": True
    })
    
    if gift_doc:
        # Use the existing gift code redemption logic
        week_end = gift_doc["week_end"]
        if isinstance(week_end, str):
            week_end = datetime.fromisoformat(week_end.replace('Z', '+00:00'))
        if week_end.tzinfo is None:
            week_end = week_end.replace(tzinfo=timezone.utc)
        if now > week_end:
            raise HTTPException(status_code=400, detail="This code has expired")
        
        user_id = user.get("user_id")
        if user_id in [str(r.get("user_id")) for r in gift_doc.get("redemptions", [])]:
            raise HTTPException(status_code=400, detail="You have already redeemed this code")
        
        new_expires = now + timedelta(days=30)
        
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
            {"_id": gift_doc["_id"]},
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
            "subscription_type": "monthly",
            "expires_at": new_expires.isoformat()
        }
    
    raise HTTPException(status_code=400, detail="Invalid or expired code")




# ==================== BI-WEEKLY CONTEST SYSTEM ====================
from services.contest_service import BiWeeklyContestService, scheduled_contest_run

@api_router.post("/contest/run")
async def run_contest_manually(request: Request):
    """Manually trigger the bi-weekly contest (admin only)"""
    body = await request.json()
    admin_secret = body.get("admin_secret")
    
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = BiWeeklyContestService(
        db=db,
        emergent_llm_key=EMERGENT_LLM_KEY,
        gmail_email=GMAIL_EMAIL,
        gmail_password=GMAIL_APP_PASSWORD
    )
    
    result = await service.run_contest(manual_trigger=True)
    return result


@api_router.get("/contest/history")
async def get_contest_history(admin_secret: str, limit: int = 10):
    """Get contest history (admin only)"""
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    service = BiWeeklyContestService(
        db=db,
        emergent_llm_key=EMERGENT_LLM_KEY,
        gmail_email=GMAIL_EMAIL,
        gmail_password=GMAIL_APP_PASSWORD
    )
    
    history = await service.get_contest_history(limit)
    return {"contests": history}


@api_router.get("/contest/next")
async def get_next_contest_date():
    """Get the next scheduled contest date"""
    service = BiWeeklyContestService(
        db=db,
        emergent_llm_key=EMERGENT_LLM_KEY,
        gmail_email=GMAIL_EMAIL,
        gmail_password=GMAIL_APP_PASSWORD
    )
    
    next_date = await service.get_next_contest_date()
    return {
        "next_contest": next_date.isoformat(),
        "next_contest_formatted": next_date.strftime("%B %d, %Y at %I:%M %p UTC")
    }


@api_router.get("/contest/eligible-count")
async def get_eligible_user_count(request: Request):
    """Get count of users eligible for the next contest"""
    service = BiWeeklyContestService(
        db=db,
        emergent_llm_key=EMERGENT_LLM_KEY,
        gmail_email=GMAIL_EMAIL,
        gmail_password=GMAIL_APP_PASSWORD
    )
    
    eligible = await service.get_eligible_users()
    return {"eligible_count": len(eligible)}


@api_router.get("/user/notifications")
async def get_user_notifications(request: Request, unread_only: bool = False, limit: int = 20):
    """Get notifications for the current user"""
    try:
        user = await get_current_user(request)
        user_id = user.get("user_id")
        
        query = {"user_id": user_id}
        if unread_only:
            query["read"] = False
        
        notifications = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
        
        return {"notifications": notifications}
    except HTTPException:
        return {"notifications": []}


@api_router.post("/user/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    try:
        user = await get_current_user(request)
        user_id = user.get("user_id")
        
        result = await db.notifications.update_one(
            {"_id": notification_id, "user_id": user_id},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True}
    except HTTPException:
        raise


# Secure Admin Setup Endpoint
class AdminSetupRequest(BaseModel):
    email: str
    admin_secret: str

@api_router.post("/admin/setup-owner")
async def setup_owner_admin(request: AdminSetupRequest):
    """
    Secure endpoint to set up the owner as admin.
    Requires the admin secret defined in environment variables.
    """
    # Check admin secret
    expected_secret = os.getenv("ADMIN_SECRET", "etheria_admin_secret_2026")
    if request.admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
    # Only allow specific owner email
    if request.email != "etheriasystems@gmail.com":
        raise HTTPException(status_code=403, detail="This endpoint is for owner setup only")
    
    # Find user
    user = await db.users.find_one({"email": request.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please create an account first.")
    
    # Check if already admin
    if user.get("is_admin") and user.get("admin_level") == "full":
        return {"success": True, "message": "User is already a full admin", "is_admin": True}
    
    # Set as full admin
    await db.users.update_one(
        {"email": request.email},
        {
            "$set": {
                "is_admin": True,
                "admin_level": "full",
                "lifetime_premium": True,
                "admin_setup_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )

# Include the router in the main app
app.include_router(api_router)

# Import and register moderation routes (extracted from server.py)
from routes.moderation import router as moderation_router, set_db as set_moderation_db
set_moderation_db(db)
app.include_router(moderation_router)

# Import and register training routes (extracted from server.py - no DB deps)
from routes.training import router as training_router
app.include_router(training_router, prefix="/api")

# Import and register auth routes (extracted from server.py)
from routes.auth import router as auth_router, set_db as set_auth_db, set_config as set_auth_config
set_auth_db(db)
set_auth_config(JWT_EXPIRATION_DAYS=JWT_EXPIRATION_DAYS, EMERGENT_AUTH_SESSION_ENDPOINT=EMERGENT_AUTH_SESSION_ENDPOINT)
app.include_router(auth_router)

# Import and register journal routes (extracted from server.py)
from routes.journal import router as journal_router, set_db as set_journal_db
set_journal_db(db)
app.include_router(journal_router)

# Import and register DM (messages) routes
from routes.messages import router as messages_router, set_db as set_messages_db
set_messages_db(db)
app.include_router(messages_router)

# Import and register notifications (push token) routes
from routes.notifications import router as notifications_router, set_db as set_notifications_db
set_notifications_db(db)
app.include_router(notifications_router)

# Import and register Companion Guide routes (premium feature)
from routes.companion import router as companion_router
app.include_router(companion_router, prefix="/api")

# Import and register community routes
from routes.community import router as community_router, set_db as set_community_db, set_llm_key as set_community_llm_key
set_community_db(db)
set_community_llm_key(EMERGENT_LLM_KEY)
app.include_router(community_router)

# Import and register admin contest routes
from routes.admin_contest import router as admin_contest_router, set_db as set_admin_contest_db, set_llm_key as set_admin_llm_key
set_admin_contest_db(db)
set_admin_llm_key(EMERGENT_LLM_KEY)
app.include_router(admin_contest_router)

# Import and register dreams + zodiac routes (extracted from server.py)
from routes.dreams import router as dreams_router, zodiac_router
app.include_router(dreams_router, prefix="/api")
app.include_router(zodiac_router, prefix="/api")

# Import and register spirit guides routes (extracted from server.py)
from routes.spirit_guides import router as spirit_guides_router
app.include_router(spirit_guides_router, prefix="/api")

# Import and register oracle routes (extracted from server.py)
from routes.oracle import router as oracle_router
app.include_router(oracle_router, prefix="/api")

# Daily Card + Streak system (uses ORACLE_CARDS from oracle.py)
from routes.daily_card import router as daily_card_router
app.include_router(daily_card_router, prefix="/api")

# Import and register subscription / webhook / user feature-access routes
from routes.subscription import router as subscription_router, webhook_router as stripe_webhook_router, user_router as user_feature_router
app.include_router(subscription_router, prefix="/api")
app.include_router(stripe_webhook_router, prefix="/api")
app.include_router(user_feature_router, prefix="/api")

# Import and register meditation routes (extracted from server.py)
from routes.meditation import router as meditation_router
app.include_router(meditation_router, prefix="/api")

# Import and register admin/tts/gift-code/prize-drawing/usage/feedback routers (extracted from server.py).
# NOTE: We deliberately do NOT register admin.notifications_router because it conflicts with the new
# push-notification routes already mounted at /api/notifications/* in routes/notifications.py.
from routes.admin import (
    tts_router,
    gift_code_router,
    prize_drawing_router,
    usage_router,
    admin_router,
    feedback_router,
)
app.include_router(tts_router, prefix="/api")
app.include_router(gift_code_router, prefix="/api")
app.include_router(prize_drawing_router, prefix="/api")
app.include_router(usage_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import moderation service for email polling
from services.moderation_service import (
    start_email_polling_task, 
    stop_email_polling_task,
    process_inbound_moderation_emails
)

@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup"""
    # Start email polling task (checks every 5 minutes)
    await start_email_polling_task(db, interval_seconds=300)
    logger.info("Application startup complete - email polling task started")

@app.on_event("shutdown")
async def shutdown_db_client():
    # Stop email polling task
    stop_email_polling_task()
    client.close()
