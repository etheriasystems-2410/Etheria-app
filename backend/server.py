from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
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
from elevenlabs import ElevenLabs, VoiceSettings
import base64
import io
import bcrypt
import jwt
import httpx
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from typing import Dict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Gemini API key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# ElevenLabs client for TTS
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY')
eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

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

# Spirit Guide Voice Configuration
# Using ElevenLabs pre-made voices with appropriate genders
SPIRIT_GUIDE_VOICES = {
    "Ignis": {
        "voice_id": "TxGEqnHWrfWFTfGW9XjX",  # Josh - Deep masculine voice for Fire
        "gender": "masculine",
        "element": "Fire",
        "personality": "passionate, direct, transformative"
    },
    "Aqua": {
        "voice_id": "EXAVITQu4vr4xnSDxMaL",  # Bella - Calm feminine voice for Water
        "gender": "feminine",
        "element": "Water",
        "personality": "intuitive, healing, emotionally wise"
    },
    "Terra": {
        "voice_id": "VR6AewLTigWG4xSOukaG",  # Arnold - Grounded masculine voice for Earth
        "gender": "masculine",
        "element": "Earth",
        "personality": "grounded, practical, stable"
    },
    "Aether": {
        "voice_id": "ThT5KcBeYPX3keUQqHPh",  # Dorothy - Clear feminine voice for Air
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
    {
        "name": "The Fire Phoenix",
        "element": "Fire",
        "description": "Transformation through passion and rebirth",
        "keywords": ["transformation", "passion", "renewal", "energy"],
        "image_url": "https://images.unsplash.com/photo-1764555719665-d2c91587a6e6"
    },
    {
        "name": "The Flame Dancer",
        "element": "Fire",
        "description": "Creative expression and bold action",
        "keywords": ["creativity", "action", "courage", "expression"],
        "image_url": "https://images.unsplash.com/photo-1762882936976-3cea8cbd6e3e"
    },
    {
        "name": "The Sacred Ember",
        "element": "Fire",
        "description": "Inner spark and divine inspiration",
        "keywords": ["inspiration", "motivation", "divine spark", "purpose"],
        "image_url": "https://images.pexels.com/photos/36022109/pexels-photo-36022109.jpeg"
    },
    {
        "name": "The Ocean Depths",
        "element": "Water",
        "description": "Deep emotions and subconscious wisdom",
        "keywords": ["emotions", "intuition", "depth", "subconscious"],
        "image_url": "https://images.unsplash.com/photo-1628371164958-887b4c79a6be"
    },
    {
        "name": "The Healing Spring",
        "element": "Water",
        "description": "Emotional cleansing and renewal",
        "keywords": ["healing", "cleansing", "forgiveness", "renewal"],
        "image_url": "https://images.unsplash.com/photo-1752139925820-d8267dc25182"
    },
    {
        "name": "The Moon Tide",
        "element": "Water",
        "description": "Cycles, intuition, and psychic ability",
        "keywords": ["cycles", "intuition", "psychic", "feminine energy"],
        "image_url": "https://images.unsplash.com/photo-1633403999090-064ea7537d68"
    },
    {
        "name": "The Ancient Tree",
        "element": "Earth",
        "description": "Grounding, wisdom, and stability",
        "keywords": ["grounding", "wisdom", "stability", "growth"],
        "image_url": "https://images.unsplash.com/photo-1761635555180-ba6f3e7cb057"
    },
    {
        "name": "The Sacred Mountain",
        "element": "Earth",
        "description": "Achievement and endurance",
        "keywords": ["achievement", "endurance", "strength", "foundation"],
        "image_url": "https://images.pexels.com/photos/1242987/pexels-photo-1242987.jpeg"
    },
    {
        "name": "The Blooming Garden",
        "element": "Earth",
        "description": "Abundance and manifestation",
        "keywords": ["abundance", "manifestation", "prosperity", "nurturing"],
        "image_url": "https://images.unsplash.com/photo-1703825864851-b5f379b9e3fc"
    },
    {
        "name": "The Whispering Wind",
        "element": "Air",
        "description": "Messages and mental clarity",
        "keywords": ["messages", "clarity", "communication", "thought"],
        "image_url": "https://images.unsplash.com/photo-1715616501682-a8eb6bf657e8"
    },
    {
        "name": "The Sky Dancer",
        "element": "Air",
        "description": "Freedom and new perspectives",
        "keywords": ["freedom", "perspective", "liberation", "change"],
        "image_url": "https://images.unsplash.com/photo-1765813142498-fbee89bd66e5"
    },
    {
        "name": "The Sacred Breath",
        "element": "Air",
        "description": "Life force and spiritual connection",
        "keywords": ["life force", "spirit", "connection", "awareness"],
        "image_url": "https://images.pexels.com/photos/6931694/pexels-photo-6931694.jpeg"
    }
]

# Training Modules
TRAINING_MODULES = [
    {
        "id": "beginner-1",
        "title": "Opening Your Third Eye",
        "description": "Learn foundational techniques to awaken your inner vision and psychic perception",
        "lessons": 5,
        "category": "beginner"
    },
    {
        "id": "beginner-2",
        "title": "Meditation Basics",
        "description": "Master the fundamentals of meditation for psychic development",
        "lessons": 7,
        "category": "beginner"
    },
    {
        "id": "beginner-3",
        "title": "Energy Awareness",
        "description": "Develop sensitivity to subtle energies and auras",
        "lessons": 6,
        "category": "beginner"
    },
    {
        "id": "intermediate-1",
        "title": "Clairvoyance Development",
        "description": "Enhance your ability to see beyond the physical realm",
        "lessons": 8,
        "category": "intermediate"
    },
    {
        "id": "intermediate-2",
        "title": "Telepathy & Mind Reading",
        "description": "Practice connecting with others' thoughts and emotions",
        "lessons": 6,
        "category": "intermediate"
    },
    {
        "id": "intermediate-3",
        "title": "Dream Work & Lucid Dreaming",
        "description": "Harness the power of your dream state for psychic insight",
        "lessons": 7,
        "category": "intermediate"
    },
    {
        "id": "advanced-1",
        "title": "Astral Projection Mastery",
        "description": "Travel beyond your physical body with controlled practice",
        "lessons": 10,
        "category": "advanced"
    },
    {
        "id": "advanced-2",
        "title": "Remote Viewing",
        "description": "See distant locations and events with your mind's eye",
        "lessons": 9,
        "category": "advanced"
    },
    {
        "id": "advanced-3",
        "title": "Psychic Protection",
        "description": "Shield yourself from negative energies and entities",
        "lessons": 5,
        "category": "advanced"
    }
]

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

class SpiritGuideResponse(BaseModel):
    response: str

# Auth Models
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: str

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_session_token() -> str:
    return f"session_{uuid.uuid4().hex}"

async def get_current_user(request: Request) -> dict:
    """Get current authenticated user from session"""
    # Check session_token from cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc

# Routes
@api_router.get("/")
async def root():
    return {"message": "Psychic Awareness API"}

@api_router.get("/training/modules")
async def get_training_modules():
    """Get all training modules"""
    return TRAINING_MODULES

@api_router.post("/oracle/draw")
async def draw_oracle_card():
    """Draw a random oracle card and get AI interpretation"""
    card = random.choice(ORACLE_CARDS)
    
    # Generate interpretation using Gemini
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"oracle-{uuid.uuid4()}",
            system_message="You are a wise spiritual guide providing oracle card interpretations. Give meaningful, insightful readings that help people on their spiritual journey. Keep responses under 200 words."
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"The seeker has drawn the card '{card['name']}' from the {card['element']} element. Card description: {card['description']}. Keywords: {', '.join(card['keywords'])}. Provide a spiritual interpretation and guidance for this card."
        
        user_message = UserMessage(text=prompt)
        interpretation = await chat.send_message(user_message)
        
        return OracleReading(
            card=card,
            interpretation=interpretation
        )
    except Exception as e:
        logging.error(f"Error generating interpretation: {e}")
        # Fallback interpretation
        return OracleReading(
            card=card,
            interpretation=f"The {card['name']} speaks of {card['description'].lower()}. This card brings the energy of {card['element']} into your life. Reflect on these keywords: {', '.join(card['keywords'])}."
        )

@api_router.post("/oracle/save")
async def save_oracle_reading(reading: SaveReadingRequest, request: Request):
    """Save an oracle reading to database"""
    try:
        # Get current user
        user = await get_current_user(request)
        
        reading_dict = reading.dict()
        reading_dict['_id'] = str(uuid.uuid4())
        reading_dict['user_id'] = user['user_id']  # Associate with user
        reading_dict['saved_at'] = datetime.utcnow().isoformat()
        await db.oracle_readings.insert_one(reading_dict)
        return {"success": True, "message": "Reading saved"}
    except HTTPException:
        # If not authenticated, save without user_id
        reading_dict = reading.dict()
        reading_dict['_id'] = str(uuid.uuid4())
        reading_dict['saved_at'] = datetime.utcnow().isoformat()
        await db.oracle_readings.insert_one(reading_dict)
        return {"success": True, "message": "Reading saved"}
    except Exception as e:
        logging.error(f"Error saving reading: {e}")
        raise HTTPException(status_code=500, detail="Failed to save reading")

@api_router.get("/oracle/readings")
async def get_saved_readings(request: Request, limit: int = 20):
    """Get saved oracle readings for current user"""
    try:
        # Get current user
        user = await get_current_user(request)
        readings = await db.oracle_readings.find(
            {"user_id": user['user_id']}
        ).sort("saved_at", -1).limit(limit).to_list(limit)
        return readings
    except HTTPException:
        # If not authenticated, return empty array
        return []
    except Exception as e:
        logging.error(f"Error fetching readings: {e}")
        return []

@api_router.post("/spirit-guides/chat", response_model=SpiritGuideResponse)
async def chat_with_spirit_guide(message: SpiritGuideMessage):
    """Chat with a spirit guide"""
    
    # Define guide personalities
    guide_personalities = {
        "Ignis": "You are Ignis, the Fire spirit guide. You are passionate, direct, and transformative. You encourage action, courage, and embracing change. Your wisdom comes through powerful metaphors of flame, transformation, and rebirth. You speak with energy and conviction.",
        "Aqua": "You are Aqua, the Water spirit guide. You are intuitive, healing, and emotionally wise. You help people understand their feelings and navigate emotional depths. Your wisdom flows like water - gentle yet powerful. You speak with compassion and empathy.",
        "Terra": "You are Terra, the Earth spirit guide. You are grounded, practical, and stable. You provide wisdom through patience, endurance, and natural growth. Your guidance is rooted in ancient wisdom and connection to nature. You speak with calm authority.",
        "Aether": "You are Aether, the Air spirit guide. You are intellectual, free-spirited, and enlightening. You help people gain new perspectives and mental clarity. Your wisdom comes through ideas, communication, and mental liberation. You speak with clarity and insight."
    }
    
    system_message = guide_personalities.get(message.guide, guide_personalities["Aether"])
    system_message += " Keep responses under 150 words. Be warm, wise, and helpful."
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"guide-{message.guide}-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("gemini", "gemini-2.5-pro")
        
        user_message = UserMessage(text=message.message)
        response = await chat.send_message(user_message)
        
        return SpiritGuideResponse(response=response)
    except Exception as e:
        logging.error(f"Error in spirit guide chat: {e}")
        return SpiritGuideResponse(
            response=f"I sense a disturbance in our connection. Let us try again, dear seeker."
        )

@api_router.post("/meditation/generate-guided")
async def generate_guided_meditation(duration_minutes: int = 10, focus: str = "general"):
    """Generate AI-guided meditation script"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"meditation-{uuid.uuid4()}",
            system_message=f"You are a meditation guide. Create a {duration_minutes}-minute guided meditation script focusing on {focus}. Include breathing exercises, visualization, and mindfulness techniques. Format with clear pauses marked as [PAUSE 5s] etc."
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"Create a complete {duration_minutes}-minute guided meditation script for {focus}. Include introduction, breathing, body scan, visualization, and closing."
        
        user_message = UserMessage(text=prompt)
        script = await chat.send_message(user_message)
        
        return {
            "script": script,
            "duration": duration_minutes,
            "focus": focus
        }
    except Exception as e:
        logging.error(f"Error generating meditation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meditation")

@api_router.post("/journal/save")
async def save_journal_entry(entry: dict, request: Request):
    """Save a journal entry"""
    try:
        # Get current user
        user = await get_current_user(request)
        
        entry['_id'] = str(uuid.uuid4())
        entry['user_id'] = user['user_id']  # Associate with user
        entry['created_at'] = datetime.utcnow().isoformat()
        await db.journal_entries.insert_one(entry)
        return {"success": True, "id": entry['_id']}
    except HTTPException:
        # If not authenticated, save without user_id
        entry['_id'] = str(uuid.uuid4())
        entry['created_at'] = datetime.utcnow().isoformat()
        await db.journal_entries.insert_one(entry)
        return {"success": True, "id": entry['_id']}
    except Exception as e:
        logging.error(f"Error saving journal entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to save entry")

@api_router.get("/journal/entries")
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

@api_router.get("/meditation/binaural/frequencies")
async def get_binaural_frequencies():
    """Get available binaural beat frequencies"""
    frequencies = [
        {
            "id": "delta",
            "name": "Delta (Deep Sleep)",
            "frequency_range": "0.5-4 Hz",
            "base_frequency": 200,
            "beat_frequency": 2,
            "benefits": ["Deep sleep", "Healing", "Pain relief", "Deep relaxation"],
            "color": "#4c1d95"
        },
        {
            "id": "theta",
            "name": "Theta (Meditation)",
            "frequency_range": "4-8 Hz",
            "base_frequency": 200,
            "beat_frequency": 6,
            "benefits": ["Deep meditation", "Creativity", "Intuition", "Memory"],
            "color": "#7c3aed"
        },
        {
            "id": "alpha",
            "name": "Alpha (Relaxation)",
            "frequency_range": "8-13 Hz",
            "base_frequency": 200,
            "beat_frequency": 10,
            "benefits": ["Relaxation", "Stress reduction", "Light meditation", "Learning"],
            "color": "#a855f7"
        },
        {
            "id": "beta",
            "name": "Beta (Focus)",
            "frequency_range": "13-30 Hz",
            "base_frequency": 200,
            "beat_frequency": 20,
            "benefits": ["Focus", "Concentration", "Alertness", "Problem solving"],
            "color": "#c084fc"
        },
        {
            "id": "gamma",
            "name": "Gamma (Peak Performance)",
            "frequency_range": "30-100 Hz",
            "base_frequency": 200,
            "beat_frequency": 40,
            "benefits": ["Peak focus", "Cognitive enhancement", "Information processing", "Memory recall"],
            "color": "#e9d5ff"
        }
    ]
    return frequencies

@api_router.get("/meditation/binaural/audio/{frequency_id}")
async def get_binaural_audio_info(frequency_id: str):
    """Get binaural audio information and streaming URL"""
    # In a production app, you would:
    # 1. Serve actual pre-recorded binaural beat audio files
    # 2. Generate audio using a synthesis library
    # 3. Use a third-party binaural beat API
    
    audio_urls = {
        "delta": "https://www.soundhealing.com/samples/delta-waves.mp3",
        "theta": "https://www.soundhealing.com/samples/theta-waves.mp3",
        "alpha": "https://www.soundhealing.com/samples/alpha-waves.mp3",
        "beta": "https://www.soundhealing.com/samples/beta-waves.mp3",
        "gamma": "https://www.soundhealing.com/samples/gamma-waves.mp3"
    }
    
    # Note: These are placeholder URLs for demonstration
    # Replace with actual hosted binaural beat audio files
    return {
        "frequency_id": frequency_id,
        "audio_url": audio_urls.get(frequency_id),
        "format": "mp3",
        "duration_minutes": 30,
        "sample_rate": 44100,
        "note": "For production, replace with actual binaural beat audio files"
    }

@api_router.post("/meditation/session/save")
async def save_meditation_session(session: dict, request: Request):
    """Save a meditation session to track progress"""
    try:
        # Get current user
        user = await get_current_user(request)
        
        session['_id'] = str(uuid.uuid4())
        session['user_id'] = user['user_id']  # Associate with user
        session['completed_at'] = datetime.utcnow().isoformat()
        await db.meditation_sessions.insert_one(session)
        return {"success": True, "session_id": session['_id']}
    except HTTPException:
        # If not authenticated, save without user_id
        session['_id'] = str(uuid.uuid4())
        session['completed_at'] = datetime.utcnow().isoformat()
        await db.meditation_sessions.insert_one(session)
        return {"success": True, "session_id": session['_id']}
    except Exception as e:
        logging.error(f"Error saving meditation session: {e}")
        raise HTTPException(status_code=500, detail="Failed to save session")

@api_router.get("/meditation/sessions")
async def get_meditation_sessions(request: Request, limit: int = 30):
    """Get meditation session history for current user"""
    try:
        # Get current user
        user = await get_current_user(request)
        sessions = await db.meditation_sessions.find(
            {"user_id": user['user_id']}
        ).sort("completed_at", -1).limit(limit).to_list(limit)
        return sessions
    except HTTPException:
        # If not authenticated, return empty array
        return []
    except Exception as e:
        logging.error(f"Error fetching sessions: {e}")
        return []

# TTS and Voice endpoints
class TTSRequest(BaseModel):
    text: str
    guide_name: Optional[str] = None  # Ignis, Aqua, Terra, or Aether
    voice_id: Optional[str] = None
    
class TTSResponse(BaseModel):
    audio_base64: str
    text: str
    guide_name: Optional[str] = None

@api_router.post("/tts/generate", response_model=TTSResponse)
async def generate_tts(request: TTSRequest):
    """Generate text-to-speech audio using ElevenLabs"""
    try:
        # Determine which voice to use
        if request.guide_name and request.guide_name in SPIRIT_GUIDE_VOICES:
            voice_id = SPIRIT_GUIDE_VOICES[request.guide_name]["voice_id"]
            guide_name = request.guide_name
        elif request.voice_id:
            voice_id = request.voice_id
            guide_name = None
        else:
            # Default to Aether (Air guide)
            voice_id = SPIRIT_GUIDE_VOICES["Aether"]["voice_id"]
            guide_name = "Aether"
        
        # Generate audio using ElevenLabs
        voice_settings = VoiceSettings(
            stability=0.75,
            similarity_boost=0.75,
            style=0.5,
            use_speaker_boost=True
        )
        
        audio_generator = eleven_client.text_to_speech.convert(
            text=request.text,
            voice_id=voice_id,
            model_id="eleven_multilingual_v2",
            voice_settings=voice_settings
        )
        
        # Collect audio data
        audio_data = b""
        for chunk in audio_generator:
            audio_data += chunk
        
        # Convert to base64
        audio_b64 = base64.b64encode(audio_data).decode()
        
        return TTSResponse(
            audio_base64=audio_b64,
            text=request.text,
            guide_name=guide_name
        )
        
    except Exception as e:
        logging.error(f"Error generating TTS: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating TTS: {str(e)}")

@api_router.get("/spirit-guides/voices")
async def get_spirit_guide_voices():
    """Get all spirit guide voice configurations"""
    return SPIRIT_GUIDE_VOICES

@api_router.get("/zodiac/element/{birth_month}/{birth_day}")
async def get_zodiac_element(birth_month: int, birth_day: int):
    """Get element and spirit guide based on birthday"""
    try:
        # Determine zodiac sign
        zodiac_sign = None
        if (birth_month == 3 and birth_day >= 21) or (birth_month == 4 and birth_day <= 19):
            zodiac_sign = "aries"
        elif (birth_month == 4 and birth_day >= 20) or (birth_month == 5 and birth_day <= 20):
            zodiac_sign = "taurus"
        elif (birth_month == 5 and birth_day >= 21) or (birth_month == 6 and birth_day <= 20):
            zodiac_sign = "gemini"
        elif (birth_month == 6 and birth_day >= 21) or (birth_month == 7 and birth_day <= 22):
            zodiac_sign = "cancer"
        elif (birth_month == 7 and birth_day >= 23) or (birth_month == 8 and birth_day <= 22):
            zodiac_sign = "leo"
        elif (birth_month == 8 and birth_day >= 23) or (birth_month == 9 and birth_day <= 22):
            zodiac_sign = "virgo"
        elif (birth_month == 9 and birth_day >= 23) or (birth_month == 10 and birth_day <= 22):
            zodiac_sign = "libra"
        elif (birth_month == 10 and birth_day >= 23) or (birth_month == 11 and birth_day <= 21):
            zodiac_sign = "scorpio"
        elif (birth_month == 11 and birth_day >= 22) or (birth_month == 12 and birth_day <= 21):
            zodiac_sign = "sagittarius"
        elif (birth_month == 12 and birth_day >= 22) or (birth_month == 1 and birth_day <= 19):
            zodiac_sign = "capricorn"
        elif (birth_month == 1 and birth_day >= 20) or (birth_month == 2 and birth_day <= 18):
            zodiac_sign = "aquarius"
        elif (birth_month == 2 and birth_day >= 19) or (birth_month == 3 and birth_day <= 20):
            zodiac_sign = "pisces"
        
        if not zodiac_sign:
            raise HTTPException(status_code=400, detail="Invalid birth date")
        
        # Get element for zodiac sign
        element = ZODIAC_TO_ELEMENT[zodiac_sign]
        
        # Find matching spirit guide
        spirit_guide = None
        for guide_name, guide_info in SPIRIT_GUIDE_VOICES.items():
            if guide_info["element"] == element:
                spirit_guide = {
                    "name": guide_name,
                    "element": element,
                    "gender": guide_info["gender"],
                    "personality": guide_info["personality"],
                    "voice_id": guide_info["voice_id"]
                }
                break
        
        return {
            "zodiac_sign": zodiac_sign.capitalize(),
            "element": element,
            "spirit_guide": spirit_guide
        }
        
    except Exception as e:
        logging.error(f"Error determining zodiac: {e}")
        raise HTTPException(status_code=500, detail="Error determining zodiac sign")

# Auth Endpoints
@api_router.post("/auth/signup")
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

@api_router.post("/auth/login")
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
        "picture": user_doc.get("picture")
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

@api_router.post("/auth/google-callback")
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
                "picture": user_doc.get("picture")
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

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
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

@api_router.patch("/user/update-profile")
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

# ==================== SUBSCRIPTION & PAYMENT ENDPOINTS ====================

class CreateCheckoutRequest(BaseModel):
    plan_id: str = "premium_monthly"
    origin_url: str

class SubscriptionStatusResponse(BaseModel):
    is_premium: bool
    subscription_status: Optional[str] = None
    expires_at: Optional[str] = None
    features: Dict[str, bool]

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return {
        "plans": SUBSCRIPTION_PLANS,
        "free_tier_limits": FREE_TIER_LIMITS
    }

@api_router.get("/subscription/status")
async def get_subscription_status(request: Request):
    """Get current user subscription status"""
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]})
        
        is_premium = user_doc.get("is_premium", False)
        subscription_expires = user_doc.get("subscription_expires_at")
        
        # Check if subscription expired
        if subscription_expires:
            if isinstance(subscription_expires, str):
                expires_dt = datetime.fromisoformat(subscription_expires.replace('Z', '+00:00'))
            else:
                expires_dt = subscription_expires
            if expires_dt.tzinfo is None:
                expires_dt = expires_dt.replace(tzinfo=timezone.utc)
            if expires_dt < datetime.now(timezone.utc):
                is_premium = False
                # Update user status
                await db.users.update_one(
                    {"user_id": user["user_id"]},
                    {"$set": {"is_premium": False}}
                )
        
        # Return premium features or free tier limits
        if is_premium:
            features = {
                "oracle_readings_unlimited": True,
                "journal_entries_unlimited": True,
                "all_training_modules": True,
                "spirit_guides": True,
                "binaural_meditation": True,
                "astral_meditation": True,
                "ai_guided_meditation": True,
                "tts_enabled": True
            }
        else:
            features = {
                "oracle_readings_unlimited": False,
                "journal_entries_unlimited": False,
                "all_training_modules": False,
                "spirit_guides": False,
                "binaural_meditation": False,
                "astral_meditation": False,
                "ai_guided_meditation": False,
                "tts_enabled": False
            }
        
        return SubscriptionStatusResponse(
            is_premium=is_premium,
            subscription_status="active" if is_premium else "free",
            expires_at=subscription_expires if is_premium else None,
            features=features
        )
    except HTTPException:
        # Not authenticated - return free tier
        return SubscriptionStatusResponse(
            is_premium=False,
            subscription_status="free",
            features={
                "oracle_readings_unlimited": False,
                "journal_entries_unlimited": False,
                "all_training_modules": False,
                "spirit_guides": False,
                "binaural_meditation": False,
                "astral_meditation": False,
                "ai_guided_meditation": False,
                "tts_enabled": False
            }
        )

@api_router.post("/subscription/create-checkout")
async def create_checkout_session(data: CreateCheckoutRequest, request: Request):
    """Create Stripe checkout session for subscription"""
    try:
        user = await get_current_user(request)
        
        # Validate plan exists
        if data.plan_id not in SUBSCRIPTION_PLANS:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        plan = SUBSCRIPTION_PLANS[data.plan_id]
        
        # Build URLs from frontend origin
        success_url = f"{data.origin_url}/settings?session_id={{CHECKOUT_SESSION_ID}}&success=true"
        cancel_url = f"{data.origin_url}/settings?canceled=true"
        
        # Initialize Stripe checkout
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=plan["price"],
            currency=plan["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user["user_id"],
                "email": user["email"],
                "plan_id": data.plan_id,
                "type": "subscription"
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store payment transaction
        transaction = {
            "_id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "email": user["email"],
            "plan_id": data.plan_id,
            "amount": plan["price"],
            "currency": plan["currency"],
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.get("/subscription/checkout-status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Get status of a checkout session and update subscription"""
    try:
        # Find the transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Check if already processed
        if transaction.get("payment_status") == "paid":
            return {
                "status": "complete",
                "payment_status": "paid",
                "already_processed": True
            }
        
        # Get status from Stripe
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": checkout_status.payment_status,
                "status": checkout_status.status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If payment successful, activate subscription
        if checkout_status.payment_status == "paid":
            # Get user_id from transaction
            user_id = transaction.get("user_id")
            
            if user_id:
                # Activate premium for 30 days
                expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "is_premium": True,
                        "subscription_expires_at": expires_at.isoformat(),
                        "subscription_plan": transaction.get("plan_id"),
                        "subscription_activated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logging.info(f"Subscription activated for user {user_id}")
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Checkout status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process webhook event
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            
            # Update transaction
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            if transaction:
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "webhook_processed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Activate subscription
                user_id = transaction.get("user_id")
                if user_id:
                    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                    await db.users.update_one(
                        {"user_id": user_id},
                        {"$set": {
                            "is_premium": True,
                            "subscription_expires_at": expires_at.isoformat()
                        }}
                    )
        
        return {"received": True}
        
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        return {"received": True, "error": str(e)}

# ==================== FEATURE ACCESS HELPERS ====================

async def check_feature_access(request: Request, feature: str) -> bool:
    """Check if user has access to a specific feature"""
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]})
        
        is_premium = user_doc.get("is_premium", False)
        
        # Check subscription expiry
        if is_premium:
            subscription_expires = user_doc.get("subscription_expires_at")
            if subscription_expires:
                if isinstance(subscription_expires, str):
                    expires_dt = datetime.fromisoformat(subscription_expires.replace('Z', '+00:00'))
                else:
                    expires_dt = subscription_expires
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                if expires_dt < datetime.now(timezone.utc):
                    is_premium = False
        
        # Premium users have access to everything
        if is_premium:
            return True
        
        # Free tier access check
        free_access = FREE_TIER_LIMITS.get(feature)
        
        # Boolean features
        if isinstance(free_access, bool):
            return free_access
        
        # Numeric limits require additional logic in the calling endpoint
        return free_access is not None
        
    except HTTPException:
        # Not authenticated - check free tier
        free_access = FREE_TIER_LIMITS.get(feature)
        if isinstance(free_access, bool):
            return free_access
        return free_access is not None

@api_router.get("/user/feature-access/{feature}")
async def check_user_feature_access(feature: str, request: Request):
    """Check if user has access to a specific feature"""
    has_access = await check_feature_access(request, feature)
    
    return {
        "feature": feature,
        "has_access": has_access,
        "upgrade_required": not has_access
    }

# Include the router in the main app
app.include_router(api_router)

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
