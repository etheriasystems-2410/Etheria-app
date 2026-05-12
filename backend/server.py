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
class TTSRequest(BaseModel):
    text: str
    guide_name: Optional[str] = None  # Ignis, Aqua, Terra, or Aether
    voice_id: Optional[str] = None
    language: Optional[str] = "en"  # Language code for TTS (en, es, fr, de, it, pt, ja, ko, zh)
    
class TTSResponse(BaseModel):
    audio_base64: Optional[str] = None
    text: str
    guide_name: Optional[str] = None
    error: Optional[str] = None
    success: bool = True

@api_router.post("/tts/generate", response_model=TTSResponse)
async def generate_tts(request: TTSRequest):
    """Generate text-to-speech audio using OpenAI TTS"""
    try:
        # Determine which voice to use
        if request.guide_name and request.guide_name in SPIRIT_GUIDE_VOICES:
            voice = SPIRIT_GUIDE_VOICES[request.guide_name]["voice"]
            guide_name = request.guide_name
        elif request.voice_id:
            voice = request.voice_id
            guide_name = None
        else:
            # Default to Aether (Air guide)
            voice = SPIRIT_GUIDE_VOICES["Aether"]["voice"]
            guide_name = "Aether"
        
        # Check if API key is configured
        if not EMERGENT_LLM_KEY:
            return TTSResponse(
                audio_base64=None,
                text=request.text,
                guide_name=guide_name,
                error="TTS not configured",
                success=False
            )
        
        # Clean the text - remove lines starting with * or # (markdown formatting)
        import re
        lines = request.text.split('\n')
        cleaned_lines = []
        for line in lines:
            stripped = line.strip()
            # Skip lines that start with * or # (markdown bullets/headers)
            if stripped.startswith('*') or stripped.startswith('#'):
                continue
            # Also remove inline asterisks used for bold/italic
            cleaned_line = re.sub(r'\*+', '', line)
            # Remove hash symbols
            cleaned_line = re.sub(r'#+\s*', '', cleaned_line)
            if cleaned_line.strip():
                cleaned_lines.append(cleaned_line)
        
        text_to_speak = ' '.join(cleaned_lines)
        
        # If text is empty after cleaning, return error
        if not text_to_speak.strip():
            return TTSResponse(
                audio_base64=None,
                text=request.text,
                guide_name=guide_name,
                error="No speakable text found",
                success=False
            )
        
        # Validate and truncate text if too long (OpenAI TTS limit is 4096 chars)
        if len(text_to_speak) > 4000:
            # Truncate at sentence boundary to stay under limit
            truncated = text_to_speak[:4000]
            last_period = truncated.rfind('.')
            last_exclaim = truncated.rfind('!')
            last_question = truncated.rfind('?')
            cut_point = max(last_period, last_exclaim, last_question)
            if cut_point > 3000:  # Only truncate at sentence if reasonable
                text_to_speak = truncated[:cut_point + 1]
            else:
                text_to_speak = truncated
            logging.info(f"TTS text truncated from {len(request.text)} to {len(text_to_speak)} characters")
        
        # Generate audio using OpenAI TTS
        audio_base64 = await openai_tts.generate_speech_base64(
            text=text_to_speak,
            voice=voice,
            model="tts-1",  # Use standard model for faster response
            response_format="mp3"
        )
        
        return TTSResponse(
            audio_base64=audio_base64,
            text=text_to_speak,
            guide_name=guide_name,
            success=True
        )
        
    except Exception as e:
        error_msg = str(e)
        logging.error(f"Error generating TTS: {e}")
        
        # Return graceful error instead of 500
        return TTSResponse(
            audio_base64=None,
            text=request.text,
            guide_name=request.guide_name,
            error="Voice generation temporarily unavailable. Please try again later.",
            success=False
        )

# Spirit Guide voices — see routes/spirit_guides.py

# Dream Interpretation & Zodiac endpoints — see routes/dreams.py

# Subscription, Webhook, and Feature-Access endpoints — see routes/subscription.py


# ==================== GIFT CODE SYSTEM ====================

class RedeemCodeRequest(BaseModel):
    code: str

class PrizeDrawingOptIn(BaseModel):
    opt_in: bool

async def generate_weekly_code():
    """AI generates a mystical-themed weekly code"""
    # Get the current week number for consistency
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    
    # Check if we already have a code for this week
    existing_code = await db.gift_codes.find_one({
        "week_start": week_start,
        "is_active": True
    })
    
    if existing_code:
        return existing_code
    
    # Generate new code using AI
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"gift-code-{uuid.uuid4()}"
        ).with_model("gemini", "gemini-2.0-flash")
        
        prompt = f"""Generate a single mystical promotional code for a psychic/spiritual app called Etheria. 
        The code should:
        - Be 8-12 characters
        - Use uppercase letters and numbers only
        - Have a mystical/spiritual feel (examples: LUNA-STAR-24, COSMIC7DREAM, ETHEREAL888)
        - Be easy to type
        
        Just respond with the code only, nothing else."""
        
        response = await chat.send_message(
            UserMessage(text=prompt)
        )
        
        code = response.text.strip().upper().replace(" ", "")
        # Ensure valid format
        if len(code) < 6 or len(code) > 15:
            # Fallback to generated code
            code = f"{random.choice(MYSTICAL_PREFIXES)}-{random.choice(MYSTICAL_MIDDLES)}-{random.randint(10, 99)}"
    except Exception as e:
        logging.error(f"AI code generation failed: {e}")
        # Fallback to random generation
        code = f"{random.choice(MYSTICAL_PREFIXES)}-{random.choice(MYSTICAL_MIDDLES)}-{random.randint(10, 99)}"
    
    # Store the new code
    code_doc = {
        "code": code,
        "week_start": week_start,
        "week_end": week_end,
        "created_at": now,
        "is_active": True,
        "redemptions": [],
        "max_redemptions": 1000  # Per week limit
    }
    
    await db.gift_codes.insert_one(code_doc)
    
    return code_doc

@api_router.get("/gift-code/current")
async def get_current_gift_code(request: Request):
    """Get the current week's active gift code (admin only or for display)"""
    # Generate or retrieve the current week's code
    code_doc = await generate_weekly_code()
    
    return {
        "code": code_doc["code"],
        "expires_at": code_doc["week_end"].isoformat(),
        "redemptions_count": len(code_doc.get("redemptions", []))
    }

@api_router.post("/gift-code/redeem")
async def redeem_gift_code(redeem_request: RedeemCodeRequest, request: Request):
    """Redeem a gift code for 1 month free premium"""
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please login to redeem a code")
    
    code = redeem_request.code.strip().upper()
    
    # Find the code
    code_doc = await db.gift_codes.find_one({
        "code": code,
        "is_active": True
    })
    
    if not code_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Check if code is still valid
    now = datetime.now(timezone.utc)
    week_end = code_doc["week_end"]
    if isinstance(week_end, str):
        week_end = datetime.fromisoformat(week_end.replace('Z', '+00:00'))
    if week_end.tzinfo is None:
        week_end = week_end.replace(tzinfo=timezone.utc)
    if now > week_end:
        raise HTTPException(status_code=400, detail="This code has expired")
    
    # Check if user already redeemed this code
    user_id = user.get("user_id")
    if user_id in [str(r.get("user_id")) for r in code_doc.get("redemptions", [])]:
        raise HTTPException(status_code=400, detail="You have already redeemed this code")
    
    # Check if user already has an active premium subscription
    existing_user = await db.users.find_one({"user_id": user_id})
    if existing_user:
        current_expires = existing_user.get("subscription_expires_at")
        if current_expires:
            if isinstance(current_expires, str):
                current_expires = datetime.fromisoformat(current_expires.replace("Z", "+00:00"))
            if current_expires.tzinfo is None:
                current_expires = current_expires.replace(tzinfo=timezone.utc)
            if current_expires > now:
                # Extend existing subscription
                new_expires = current_expires + timedelta(days=30)
            else:
                new_expires = now + timedelta(days=30)
        else:
            new_expires = now + timedelta(days=30)
    else:
        new_expires = now + timedelta(days=30)
    
    # Update user to premium
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
    
    # Record the redemption
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


# ==================== PRIZE DRAWING SYSTEM ====================

@api_router.post("/prize-drawing/opt-in")
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

@api_router.get("/prize-drawing/status")
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
    
    # Calculate weekly usage using aggregation for efficiency
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get total usage using aggregation pipeline
    user_id = user.get("user_id")
    pipeline = [
        {"$match": {"user_id": user_id, "timestamp": {"$gte": week_start.isoformat()}}},
        {"$group": {"_id": None, "total_seconds": {"$sum": "$duration_seconds"}}}
    ]
    result = await db.usage_tracking.aggregate(pipeline).to_list(1)
    total_seconds = result[0]["total_seconds"] if result else 0
    total_minutes = total_seconds / 60
    
    return {
        "opted_in": opted_in,
        "eligible": total_minutes >= 30,
        "weekly_usage_minutes": round(total_minutes, 1),
        "required_minutes": 30,
        "week_start": week_start.isoformat(),
        "next_drawing": get_next_drawing_date().isoformat()
    }

def get_next_drawing_date():
    """Get the date of the next monthly drawing (first of the month)"""
    now = datetime.now(timezone.utc)
    if now.day == 1:
        return now.replace(hour=12, minute=0, second=0, microsecond=0)
    
    # First of next month
    if now.month == 12:
        next_drawing = datetime(now.year + 1, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    else:
        next_drawing = datetime(now.year, now.month + 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    
    return next_drawing

@api_router.post("/usage/track")
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

async def send_winner_email(email: str, code: str, expires_at: str):
    """Send winner notification email via Resend."""
    try:
        from services.email_service import send_email as resend_send

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

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #1a0033, #0f0321); color: #e9d5ff; padding: 40px;">
            <div style="max-width: 600px; margin: 0 auto; background: rgba(45, 27, 78, 0.9); border-radius: 16px; padding: 32px; border: 1px solid #7c3aed;">
                <h1 style="color: #ffd700; text-align: center;">🎉 Congratulations! 🎉</h1>
                <p style="font-size: 18px; text-align: center;">You have been selected as the winner of Etheria's monthly prize drawing!</p>

                <div style="background: linear-gradient(135deg, #7c3aed, #a855f7); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                    <p style="margin: 0; color: #fff; font-size: 16px;">Your Exclusive Code:</p>
                    <p style="font-size: 32px; font-weight: bold; color: #ffd700; margin: 12px 0; letter-spacing: 3px;">{code}</p>
                    <p style="margin: 0; color: #e9d5ff; font-size: 14px;">Expires: {expires_at}</p>
                </div>

                <h3 style="color: #b794f6;">How to Redeem:</h3>
                <ol style="color: #c4b5fd;">
                    <li>Open the Etheria app</li>
                    <li>Go to Settings or tap "Subscribe Now"</li>
                    <li>Click "Have a code?"</li>
                    <li>Enter your code</li>
                    <li>Enjoy 1 month of FREE premium features!</li>
                </ol>

                <p style="text-align: center; color: #9f7aea; margin-top: 32px;">
                    ✨ Thank you for being part of the Etheria community ✨
                </p>
            </div>
        </body>
        </html>
        """

        return await resend_send(
            to=email,
            subject="🎉 Congratulations! You Won the Etheria Monthly Drawing!",
            html=html,
            text=text,
        )
    except Exception as e:
        logging.error(f"Failed to send winner email: {e}")
        return False

@api_router.post("/admin/prize-drawing/run")
async def run_prize_drawing(request: Request):
    """Run the monthly prize drawing (admin only)"""
    body = await request.json()
    admin_secret = body.get("admin_secret")
    test_mode = body.get("test_mode", False)  # Skip eligibility for testing
    
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Get all eligible participants
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Find users who opted in (use cursor for large datasets)
    opted_in_users = await db.users.find({
        "prize_drawing_opted_in": True
    }).to_list(None)  # No limit - get all opted-in users
    
    eligible_users = []
    
    for user in opted_in_users:
        user_id = str(user.get("user_id") or user.get("_id"))
        
        # In test mode, skip eligibility check
        if test_mode:
            eligible_users.append(user)
            continue
        
        # Check weekly usage for the past month using aggregation
        # Calculate total usage per week using aggregation pipeline
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "timestamp": {"$gte": month_start.isoformat(), "$lt": now.isoformat()}
            }},
            {"$group": {"_id": None, "total_seconds": {"$sum": "$duration_seconds"}}}
        ]
        result = await db.usage_tracking.aggregate(pipeline).to_list(1)
        total_seconds = result[0]["total_seconds"] if result else 0
        
        # User is eligible if they have at least 2 hours (7200 seconds) total usage this month
        # This is equivalent to averaging 30 min/week over 4 weeks
        if total_seconds >= 7200:
            eligible_users.append(user)
    
    if not eligible_users:
        return {
            "success": False,
            "message": "No eligible participants this month",
            "participants_count": len(opted_in_users),
            "eligible_count": 0
        }
    
    # AI selects the winner (random from eligible)
    winner = random.choice(eligible_users)
    
    # Get or generate the current week's code
    code_doc = await generate_weekly_code()
    
    # Send winner email
    winner_email = winner.get("email")
    email_sent = await send_winner_email(
        winner_email,
        code_doc["code"],
        code_doc["week_end"].strftime("%B %d, %Y")
    )
    
    # Record the drawing
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

# ==================== ADMIN DASHBOARD ====================

@api_router.get("/admin/dashboard")
async def get_admin_dashboard(admin_secret: str):
    """Get admin dashboard data"""
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Get current code
    code_doc = await generate_weekly_code()
    
    # Get drawing participants count
    participants = await db.users.count_documents({"prize_drawing_opted_in": True})
    
    # Get previous winners
    winners = await db.prize_drawings.find().sort("drawing_date", -1).limit(12).to_list(12)
    
    # Get total users
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

@api_router.get("/admin/participants")
async def get_drawing_participants(admin_secret: str, skip: int = 0, limit: int = 100):
    """Get list of prize drawing participants with pagination"""
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Get total count
    total_count = await db.users.count_documents({"prize_drawing_opted_in": True})
    
    # Get paginated results
    participants = await db.users.find(
        {"prize_drawing_opted_in": True},
        {"email": 1, "name": 1, "prize_drawing_opted_at": 1}
    ).skip(skip).limit(limit).to_list(limit)
    
    return {
        "total_count": total_count,
        "skip": skip,
        "limit": limit,
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

@api_router.post("/admin/generate-new-code")
async def admin_generate_new_code(request: Request):
    """Force generate a new code (admin only)"""
    body = await request.json()
    admin_secret = body.get("admin_secret")
    
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Deactivate current codes
    await db.gift_codes.update_many(
        {"is_active": True},
        {"$set": {"is_active": False}}
    )
    
    # Generate new code
    code_doc = await generate_weekly_code()
    
    return {
        "success": True,
        "new_code": code_doc["code"],
        "expires_at": code_doc["week_end"].isoformat()
    }

# ==================== FEEDBACK SYSTEM ====================

class FeedbackRequest(BaseModel):
    type: str  # bug, suggestion, question, other
    subject: str
    message: str
    user_email: str
    user_name: Optional[str] = "Anonymous"

async def send_feedback_email(feedback: FeedbackRequest):
    """Send feedback email to admin inbox via Resend."""
    try:
        from services.email_service import send_email as resend_send

        type_emoji = {
            "bug": "🐛",
            "suggestion": "💡",
            "question": "❓",
            "other": "💬"
        }
        emoji = type_emoji.get(feedback.type, "📧")

        text = f"""
New Feedback Received from Etheria App
=====================================

Type: {feedback.type.upper()}
From: {feedback.user_name}
Email: {feedback.user_email}
Subject: {feedback.subject}

Message:
{feedback.message}

---
Submitted: {datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")}
        """

        type_colors = {
            "bug": "#ef4444",
            "suggestion": "#f59e0b",
            "question": "#3b82f6",
            "other": "#8b5cf6"
        }
        color = type_colors.get(feedback.type, "#8b5cf6")

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f3f4f6; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #1a0033, #2d1b4e); padding: 24px; text-align: center;">
                    <h1 style="color: #e9d5ff; margin: 0;">✨ Etheria Feedback ✨</h1>
                </div>

                <div style="padding: 24px;">
                    <div style="background: {color}20; border-left: 4px solid {color}; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                        <span style="color: {color}; font-weight: bold; text-transform: uppercase;">{emoji} {feedback.type}</span>
                    </div>

                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; width: 100px;">From:</td>
                            <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">{feedback.user_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                            <td style="padding: 8px 0;"><a href="mailto:{feedback.user_email}" style="color: #7c3aed;">{feedback.user_email}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Subject:</td>
                            <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">{feedback.subject}</td>
                        </tr>
                    </table>

                    <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px;">
                        <h3 style="color: #374151; margin: 0 0 12px 0;">Message:</h3>
                        <p style="color: #4b5563; line-height: 1.6; margin: 0; white-space: pre-wrap;">{feedback.message}</p>
                    </div>

                    <div style="margin-top: 20px; text-align: center;">
                        <a href="mailto:{feedback.user_email}?subject=Re: {feedback.subject}"
                           style="display: inline-block; background: #7c3aed; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                            Reply to User
                        </a>
                    </div>
                </div>

                <div style="background: #f3f4f6; padding: 16px; text-align: center; color: #6b7280; font-size: 12px;">
                    Submitted {datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")}
                </div>
            </div>
        </body>
        </html>
        """

        return await resend_send(
            to='etheriasystems@gmail.com',
            subject=f'{emoji} Etheria Feedback: [{feedback.type.upper()}] {feedback.subject}',
            html=html,
            text=text,
            reply_to=feedback.user_email,
        )
    except Exception as e:
        logging.error(f"Failed to send feedback email: {e}")
        return False

@api_router.post("/feedback/submit")
async def submit_feedback(feedback: FeedbackRequest, request: Request):
    """Submit user feedback - sends email to etheriasystems@gmail.com"""
    
    # Validate input
    if not feedback.subject or len(feedback.subject) < 3:
        raise HTTPException(status_code=400, detail="Subject must be at least 3 characters")
    if not feedback.message or len(feedback.message) < 10:
        raise HTTPException(status_code=400, detail="Message must be at least 10 characters")
    if not feedback.user_email or '@' not in feedback.user_email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    
    # Try to get user info from auth
    user_id = None
    try:
        user = await get_current_user(request)
        user_id = str(user.get("user_id") or user.get("_id"))
    except:
        pass
    
    # Store feedback in database
    feedback_doc = {
        "_id": str(uuid.uuid4()),
        "type": feedback.type,
        "subject": feedback.subject,
        "message": feedback.message,
        "user_email": feedback.user_email,
        "user_name": feedback.user_name,
        "user_id": user_id,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "email_sent": False
    }
    
    await db.feedback.insert_one(feedback_doc)
    
    # Send email
    email_sent = await send_feedback_email(feedback)
    
    # Update record with email status
    await db.feedback.update_one(
        {"_id": feedback_doc["_id"]},
        {"$set": {"email_sent": email_sent}}
    )
    
    if not email_sent:
        logging.warning(f"Feedback saved but email not sent for {feedback_doc['_id']}")
    
    return {
        "success": True,
        "message": "Thank you for your feedback!",
        "feedback_id": feedback_doc["_id"],
        "email_sent": email_sent
    }



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

# Import and register subscription / webhook / user feature-access routes
from routes.subscription import router as subscription_router, webhook_router as stripe_webhook_router, user_router as user_feature_router
app.include_router(subscription_router, prefix="/api")
app.include_router(stripe_webhook_router, prefix="/api")
app.include_router(user_feature_router, prefix="/api")

# Import and register meditation routes (extracted from server.py)
from routes.meditation import router as meditation_router
app.include_router(meditation_router, prefix="/api")

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
