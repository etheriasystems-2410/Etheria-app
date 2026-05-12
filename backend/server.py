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

@api_router.post("/oracle/draw")
async def draw_oracle_card(request: MultiCardDrawRequest = None):
    """Draw oracle cards and get AI interpretation with AI-generated images"""
    import asyncio
    
    # Handle both old single-card and new multi-card requests
    if request is None or request.card_count == 1:
        # Single card draw (original behavior)
        card = random.choice(ORACLE_CARDS)
        
        # Get or generate card image
        image_base64 = await get_or_generate_card_image(card['name'], card.get('image_prompt', ''))
        card_with_image = {**card, 'image_base64': image_base64}
        
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"oracle-{uuid.uuid4()}",
                system_message="You are a wise spiritual guide providing oracle card interpretations. Give meaningful, insightful readings that help people on their spiritual journey. Keep responses under 100 words."
            ).with_model("gemini", "gemini-2.0-flash")
            
            prompt = f"The seeker has drawn '{card['name']}' ({card['element']}). Description: {card['description']}. Give a brief spiritual interpretation."
            
            user_message = UserMessage(text=prompt)
            interpretation = await chat.send_message(user_message)
            
            return {
                "spread_type": "single",
                "cards": [{
                    "card": card_with_image,
                    "position": "Guidance",
                    "interpretation": interpretation
                }],
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logging.error(f"Error generating interpretation: {e}")
            return {
                "spread_type": "single",
                "cards": [{
                    "card": card_with_image,
                    "position": "Guidance",
                    "interpretation": f"The {card['name']} speaks of {card['description'].lower()}. This card brings the energy of {card['element']} into your life."
                }],
                "timestamp": datetime.utcnow().isoformat()
            }
    
    # Multi-card spread - generate interpretations in parallel for speed
    card_count = min(request.card_count, 10)
    positions = request.positions[:card_count]
    
    # Draw unique cards
    drawn_cards = random.sample(ORACLE_CARDS, min(card_count, len(ORACLE_CARDS)))
    
    # Generate images for all cards in parallel
    async def get_card_with_image(card):
        image_base64 = await get_or_generate_card_image(card['name'], card.get('image_prompt', ''))
        return {**card, 'image_base64': image_base64}
    
    cards_with_images = await asyncio.gather(*[get_card_with_image(card) for card in drawn_cards])
    
    async def get_interpretation(card, position, spread_type):
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"oracle-{uuid.uuid4()}",
                system_message=f"You are a wise spiritual guide. Give a brief oracle interpretation for the {position} position. Keep it under 80 words."
            ).with_model("gemini", "gemini-2.0-flash")
            
            prompt = f"Card '{card['name']}' ({card['element']}) in the '{position}' position. Description: {card['description']}. Interpret briefly for {position}."
            
            user_message = UserMessage(text=prompt)
            return await chat.send_message(user_message)
        except Exception as e:
            logging.error(f"Error generating interpretation: {e}")
            return f"The {card['name']} in the {position} position speaks of {card['description'].lower()}. This {card['element']} energy guides this aspect of your journey."
    
    # Run all interpretations in parallel
    tasks = []
    for i, card in enumerate(cards_with_images):
        position = positions[i] if i < len(positions) else f"Card {i+1}"
        tasks.append(get_interpretation(card, position, request.spread_type))
    
    interpretations = await asyncio.gather(*tasks)
    
    cards_result = []
    for i, (card, interpretation) in enumerate(zip(cards_with_images, interpretations)):
        position = positions[i] if i < len(positions) else f"Card {i+1}"
        cards_result.append({
            "card": card,
            "position": position,
            "interpretation": interpretation
        })
    
    return {
        "spread_type": request.spread_type,
        "cards": cards_result,
        "timestamp": datetime.utcnow().isoformat()
    }

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
    """Chat with a spirit guide - returns text and TTS audio"""
    
    # Get the language name for the prompt
    language_name = LANGUAGE_NAMES.get(message.language, "English")
    
    # Define guide personalities with no-markdown instructions
    guide_personalities = {
        "Ignis": "You are Ignis, the Fire spirit guide. You are passionate, direct, and transformative. You encourage action, courage, and embracing change. Your wisdom comes through powerful metaphors of flame, transformation, and rebirth. You speak with energy and conviction.",
        "Aqua": "You are Aqua, the Water spirit guide. You are intuitive, healing, and emotionally wise. You help people understand their feelings and navigate emotional depths. Your wisdom flows like water - gentle yet powerful. You speak with compassion and empathy.",
        "Terra": "You are Terra, the Earth spirit guide. You are grounded, practical, and stable. You provide wisdom through patience, endurance, and natural growth. Your guidance is rooted in ancient wisdom and connection to nature. You speak with calm authority.",
        "Aether": "You are Aether, the Air spirit guide. You are intellectual, free-spirited, and enlightening. You help people gain new perspectives and mental clarity. Your wisdom comes through ideas, communication, and mental liberation. You speak with clarity and insight."
    }
    
    system_message = guide_personalities.get(message.guide, guide_personalities["Aether"])
    system_message += f""" Keep responses under 150 words. Be warm, wise, and helpful.

IMPORTANT: You MUST respond in {language_name}. The user has selected {language_name} as their preferred language.

IMPORTANT: DO NOT use any markdown formatting in your response - no asterisks (*), no hash symbols (#), no bullet points, no bold or italic markers. Write in plain flowing prose that sounds natural when spoken aloud, as your response will be read by text-to-speech."""
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"guide-{message.guide}-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("gemini", "gemini-2.5-pro")
        
        user_message = UserMessage(text=message.message)
        response_text = await chat.send_message(user_message)
        
        # Clean any markdown that might have slipped through
        import re
        lines = response_text.split('\n')
        cleaned_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('*') or stripped.startswith('#'):
                continue
            cleaned_line = re.sub(r'\*+', '', line)
            cleaned_line = re.sub(r'#+\s*', '', cleaned_line)
            if cleaned_line.strip():
                cleaned_lines.append(cleaned_line)
        
        cleaned_response = ' '.join(cleaned_lines)
        
        # Generate TTS audio for the response
        audio_base64 = None
        voice = SPIRIT_GUIDE_VOICES.get(message.guide, SPIRIT_GUIDE_VOICES["Aether"])["voice"]
        
        try:
            if EMERGENT_LLM_KEY and cleaned_response.strip():
                audio_base64 = await openai_tts.generate_speech_base64(
                    text=cleaned_response,
                    voice=voice,
                    model="tts-1",
                    response_format="mp3"
                )
        except Exception as tts_error:
            logging.error(f"Error generating TTS for spirit guide: {tts_error}")
            # Continue without audio - text response is still valid
        
        return SpiritGuideResponse(
            response=cleaned_response,
            audio_base64=audio_base64,
            voice=voice,
            success=True
        )
    except Exception as e:
        logging.error(f"Error in spirit guide chat: {e}")
        return SpiritGuideResponse(
            response=f"I sense a disturbance in our connection. Let us try again, dear seeker.",
            audio_base64=None,
            voice=None,
            success=False
        )

@api_router.post("/meditation/generate-guided")
async def generate_guided_meditation(duration_minutes: int = 10, focus: str = "general"):
    """Generate AI-guided meditation script"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"meditation-{uuid.uuid4()}",
            system_message=f"""You are a meditation guide. Create a {duration_minutes}-minute guided meditation script focusing on {focus}. 

IMPORTANT FORMATTING RULES:
1. Include pauses using EXACTLY this format: [pause for X seconds] where X is a number between 3 and 15
2. Insert pauses after breathing instructions, between sections, and during reflection moments
3. Example: "Take a deep breath in... [pause for 5 seconds] ...and slowly exhale."
4. Use multiple pauses throughout to create a natural meditation rhythm
5. Include at least one pause every 2-3 sentences during breathing and visualization sections
6. DO NOT use any markdown formatting - no asterisks (*), no hash symbols (#), no bullet points
7. Write in plain flowing prose that sounds natural when spoken aloud
8. Avoid headers, lists, or any formatting that isn't meant to be read aloud"""
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"""Create a complete {duration_minutes}-minute guided meditation script for {focus}. 

Structure:
1. Introduction and settling in (with pauses)
2. Breathing exercises (with pauses between breaths)
3. Body scan or visualization (with pauses for awareness)
4. Main meditation practice (with reflective pauses)
5. Gentle closing and return to awareness (with pauses)

Remember to use [pause for X seconds] format for all pauses.
Write in plain prose without any markdown formatting - this will be read aloud."""
        
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


@api_router.get("/meditation/binaural/frequencies")
async def get_binaural_frequencies():
    """Get available binaural beat frequencies"""
    frequencies = [
        {
            "id": "god-tone",
            "name": "God Tone (963 Hz)",
            "frequency_range": "963 Hz Solfeggio",
            "base_frequency": 963,
            "beat_frequency": 7.83,
            "benefits": ["Spiritual awakening", "Divine connection", "Crown chakra activation", "Higher consciousness"],
            "color": "#ffd700",
            "description": "The frequency of divine connection and spiritual awakening - activates the crown chakra and connects to higher consciousness"
        },
        {
            "id": "love",
            "name": "Love Frequency (528 Hz)",
            "frequency_range": "528 Hz Solfeggio",
            "base_frequency": 528,
            "beat_frequency": 6,
            "benefits": ["Heart healing", "DNA repair", "Transformation", "Miracles"],
            "color": "#ec4899",
            "description": "The miracle tone - promotes love, healing, and positive transformation"
        },
        {
            "id": "liberation",
            "name": "Liberation (396 Hz)",
            "frequency_range": "396 Hz Solfeggio",
            "base_frequency": 396,
            "beat_frequency": 6,
            "benefits": ["Release fear", "Guilt liberation", "Root chakra", "Grounding"],
            "color": "#ef4444",
            "description": "Liberates from fear and guilt - grounds and balances the root chakra"
        },
        {
            "id": "schumann",
            "name": "Schumann Resonance",
            "frequency_range": "7.83 Hz",
            "base_frequency": 200,
            "beat_frequency": 7.83,
            "benefits": ["Earth connection", "Grounding", "Natural harmony", "Stress relief"],
            "color": "#10b981",
            "description": "The Earth's natural electromagnetic frequency - promotes deep connection with nature and grounding"
        },
        {
            "id": "delta",
            "name": "Delta (Deep Sleep)",
            "frequency_range": "0.5-4 Hz",
            "base_frequency": 200,
            "beat_frequency": 2,
            "benefits": ["Deep sleep", "Healing", "Pain relief", "Deep relaxation"],
            "color": "#4c1d95",
            "description": "Promotes deep, restorative sleep and physical healing"
        },
        {
            "id": "theta",
            "name": "Theta (Meditation)",
            "frequency_range": "4-8 Hz",
            "base_frequency": 200,
            "beat_frequency": 6,
            "benefits": ["Deep meditation", "Creativity", "Intuition", "Memory"],
            "color": "#7c3aed",
            "description": "Ideal for deep meditation, creativity, and accessing intuition"
        },
        {
            "id": "alpha",
            "name": "Alpha (Relaxation)",
            "frequency_range": "8-13 Hz",
            "base_frequency": 200,
            "beat_frequency": 10,
            "benefits": ["Relaxation", "Stress reduction", "Light meditation", "Learning"],
            "color": "#a855f7",
            "description": "Perfect for relaxation, light meditation, and enhanced learning"
        },
        {
            "id": "beta",
            "name": "Beta (Focus)",
            "frequency_range": "13-30 Hz",
            "base_frequency": 200,
            "beat_frequency": 20,
            "benefits": ["Focus", "Concentration", "Alertness", "Problem solving"],
            "color": "#c084fc",
            "description": "Enhances focus, concentration, and mental alertness"
        },
        {
            "id": "gamma",
            "name": "Gamma (Peak Performance)",
            "frequency_range": "30-100 Hz",
            "base_frequency": 200,
            "beat_frequency": 40,
            "benefits": ["Peak focus", "Cognitive enhancement", "Information processing", "Memory recall"],
            "color": "#e9d5ff",
            "description": "For peak mental performance and cognitive enhancement"
        }
    ]
    return frequencies

@api_router.get("/meditation/binaural/generate/{frequency_id}")
async def generate_binaural_beat(frequency_id: str, duration: int = 60):
    """Generate actual binaural beat audio"""
    import numpy as np
    from scipy.io import wavfile
    
    # Frequency configurations - all frequencies including Solfeggio tones
    freq_config = {
        "god-tone": {"base": 963, "beat": 7.83},
        "love": {"base": 528, "beat": 6},
        "liberation": {"base": 396, "beat": 6},
        "schumann": {"base": 200, "beat": 7.83},
        "delta": {"base": 200, "beat": 2},
        "theta": {"base": 200, "beat": 6},
        "alpha": {"base": 200, "beat": 10},
        "beta": {"base": 200, "beat": 20},
        "gamma": {"base": 200, "beat": 40}
    }
    
    if frequency_id not in freq_config:
        raise HTTPException(status_code=404, detail="Frequency not found")
    
    config = freq_config[frequency_id]
    base_freq = config["base"]
    beat_freq = config["beat"]
    
    # Audio parameters
    sample_rate = 44100
    duration_seconds = min(duration, 300)  # Max 5 minutes per request
    
    # Generate time array
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds), dtype=np.float32)
    
    # Generate binaural beats (different frequency in each ear)
    left_freq = base_freq
    right_freq = base_freq + beat_freq
    
    # Create sine waves for left and right channels
    left_channel = np.sin(2 * np.pi * left_freq * t).astype(np.float32)
    right_channel = np.sin(2 * np.pi * right_freq * t).astype(np.float32)
    
    # Add gentle fade in/out (2 seconds each)
    fade_samples = int(sample_rate * 2)
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    left_channel[:fade_samples] *= fade_in
    left_channel[-fade_samples:] *= fade_out
    right_channel[:fade_samples] *= fade_in
    right_channel[-fade_samples:] *= fade_out
    
    # Scale to 16-bit range
    left_channel = (left_channel * 32767 * 0.7).astype(np.int16)
    right_channel = (right_channel * 32767 * 0.7).astype(np.int16)
    
    # Combine into stereo
    stereo = np.column_stack((left_channel, right_channel))
    
    # Write to bytes buffer
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, stereo)
    buffer.seek(0)
    
    # Convert to base64
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "frequency_id": frequency_id,
        "base_frequency": base_freq,
        "beat_frequency": beat_freq,
        "duration_seconds": duration_seconds,
        "sample_rate": sample_rate,
        "audio_base64": audio_base64,
        "format": "wav"
    }

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

# ==================== CHAKRA MEDITATION ====================

CHAKRA_DATA = {
    "root": {
        "name": "Root Chakra (Muladhara)",
        "sanskrit": "Muladhara",
        "frequency": 396,
        "color": "#dc2626",
        "location": "Base of spine",
        "element": "Earth",
        "benefits": ["Grounding", "Security", "Stability", "Survival instincts"],
        "affirmation": "I am safe, grounded, and secure."
    },
    "sacral": {
        "name": "Sacral Chakra (Svadhisthana)",
        "sanskrit": "Svadhisthana", 
        "frequency": 417,
        "color": "#ea580c",
        "location": "Lower abdomen",
        "element": "Water",
        "benefits": ["Creativity", "Emotions", "Sexuality", "Pleasure"],
        "affirmation": "I embrace my creativity and emotions freely."
    },
    "solar": {
        "name": "Solar Plexus Chakra (Manipura)",
        "sanskrit": "Manipura",
        "frequency": 528,
        "color": "#eab308",
        "location": "Upper abdomen",
        "element": "Fire",
        "benefits": ["Personal power", "Confidence", "Willpower", "Self-esteem"],
        "affirmation": "I am confident, powerful, and in control of my life."
    },
    "heart": {
        "name": "Heart Chakra (Anahata)",
        "sanskrit": "Anahata",
        "frequency": 639,
        "color": "#16a34a",
        "location": "Center of chest",
        "element": "Air",
        "benefits": ["Love", "Compassion", "Forgiveness", "Connection"],
        "affirmation": "I give and receive love freely and unconditionally."
    },
    "throat": {
        "name": "Throat Chakra (Vishuddha)",
        "sanskrit": "Vishuddha",
        "frequency": 741,
        "color": "#0ea5e9",
        "location": "Throat",
        "element": "Ether",
        "benefits": ["Communication", "Expression", "Truth", "Authenticity"],
        "affirmation": "I speak my truth with clarity and confidence."
    },
    "third-eye": {
        "name": "Third Eye Chakra (Ajna)",
        "sanskrit": "Ajna",
        "frequency": 852,
        "color": "#6366f1",
        "location": "Between eyebrows",
        "element": "Light",
        "benefits": ["Intuition", "Wisdom", "Insight", "Imagination"],
        "affirmation": "I trust my intuition and see clearly."
    },
    "crown": {
        "name": "Crown Chakra (Sahasrara)",
        "sanskrit": "Sahasrara",
        "frequency": 963,
        "color": "#9333ea",
        "location": "Top of head",
        "element": "Thought",
        "benefits": ["Spiritual connection", "Enlightenment", "Unity", "Transcendence"],
        "affirmation": "I am connected to the divine and universal consciousness."
    }
}

@api_router.get("/meditation/chakra/list")
async def get_chakras():
    """Get all chakra information"""
    chakras = []
    for chakra_id, data in CHAKRA_DATA.items():
        chakras.append({
            "id": chakra_id,
            **data
        })
    return chakras

@api_router.get("/meditation/chakra/tone/{chakra_id}")
async def generate_chakra_tone(chakra_id: str, duration: int = 60):
    """Generate a pure chakra frequency tone - optimized for mobile with loopable segments"""
    import numpy as np
    from scipy.io import wavfile
    
    if chakra_id not in CHAKRA_DATA:
        raise HTTPException(status_code=404, detail="Chakra not found")
    
    chakra = CHAKRA_DATA[chakra_id]
    frequency = chakra["frequency"]
    
    # Use lower sample rate and generate short loopable segment (30 seconds max)
    sample_rate = 22050  # Lower sample rate for smaller file
    # Generate a short loopable segment - frontend will loop it
    segment_duration = min(duration, 30)  # Max 30 second segments for mobile
    num_samples = int(sample_rate * segment_duration)
    
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)
    
    # Generate main frequency with harmonics for richer sound
    audio = np.sin(2 * np.pi * frequency * t) * 0.5
    audio += np.sin(2 * np.pi * frequency * 2 * t) * 0.15  # 2nd harmonic
    audio += np.sin(2 * np.pi * frequency * 3 * t) * 0.08  # 3rd harmonic
    
    # Add gentle amplitude modulation for warmth
    mod = 1 + 0.1 * np.sin(2 * np.pi * 0.2 * t)
    audio = audio * mod
    
    # Smooth fade at start/end for seamless loop
    fade_samples = int(sample_rate * 0.5)  # 0.5 second fade
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)
    audio[:fade_samples] *= fade_in
    audio[-fade_samples:] *= fade_out
    
    # Normalize and convert
    audio = audio / np.max(np.abs(audio)) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "chakra_id": chakra_id,
        "chakra_name": chakra["name"],
        "frequency": frequency,
        "duration_seconds": segment_duration,
        "audio_base64": audio_base64,
        "format": "wav",
        "loopable": True
    }

@api_router.get("/meditation/chakra/realign-tone")
async def generate_realign_all_tone(duration: int = 300):
    """Generate a morphing tone that transitions through all chakras - optimized for mobile"""
    import numpy as np
    from scipy.io import wavfile
    
    # Lower sample rate and max 60 seconds for mobile compatibility
    sample_rate = 22050
    duration_seconds = min(duration, 60)  # Max 60 seconds, loops on frontend
    num_samples = int(sample_rate * duration_seconds)
    
    # Chakra order from root to crown
    chakra_order = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"]
    frequencies = [CHAKRA_DATA[c]["frequency"] for c in chakra_order]
    
    # Time spent on each chakra
    time_per_chakra = duration_seconds / len(chakra_order)
    
    t = np.linspace(0, duration_seconds, num_samples, dtype=np.float32)
    audio = np.zeros(num_samples, dtype=np.float32)
    
    for i, freq in enumerate(frequencies):
        start_time = i * time_per_chakra
        end_time = (i + 1) * time_per_chakra
        
        # Create smooth transition envelope
        for j in range(num_samples):
            current_time = j / sample_rate
            if start_time <= current_time < end_time:
                # Calculate position within this chakra's segment
                progress = (current_time - start_time) / time_per_chakra
                
                # Smooth fade in/out within each chakra segment
                if progress < 0.1:
                    envelope = progress / 0.1
                elif progress > 0.9:
                    envelope = (1 - progress) / 0.1
                else:
                    envelope = 1.0
                
                # Add frequency with harmonics
                audio[j] += envelope * 0.5 * np.sin(2 * np.pi * freq * current_time)
                audio[j] += envelope * 0.15 * np.sin(2 * np.pi * freq * 2 * current_time)
    
    # Global fade in/out
    fade_samples = int(sample_rate * 1)
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    # Normalize
    audio = audio / np.max(np.abs(audio)) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "type": "realign_all",
        "duration_seconds": duration_seconds,
        "chakra_order": chakra_order,
        "audio_base64": audio_base64,
        "format": "wav",
        "loopable": True
    }

# ============ STREAMING AUDIO ENDPOINTS FOR NATIVE PLAYBACK ============

@api_router.get("/meditation/chakra/stream/{chakra_id}")
async def stream_chakra_tone(chakra_id: str, duration: int = 30):
    """Stream chakra frequency tone as WAV audio for native playback"""
    import numpy as np
    from scipy.io import wavfile
    
    if chakra_id not in CHAKRA_DATA:
        raise HTTPException(status_code=404, detail="Chakra not found")
    
    chakra = CHAKRA_DATA[chakra_id]
    frequency = chakra["frequency"]
    
    sample_rate = 22050
    segment_duration = min(duration, 30)
    num_samples = int(sample_rate * segment_duration)
    
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)
    
    # Generate frequency with harmonics
    audio = np.sin(2 * np.pi * frequency * t) * 0.5
    audio += np.sin(2 * np.pi * frequency * 2 * t) * 0.15
    audio += np.sin(2 * np.pi * frequency * 3 * t) * 0.08
    
    # Amplitude modulation
    mod = 1 + 0.1 * np.sin(2 * np.pi * 0.2 * t)
    audio = audio * mod
    
    # Fade for seamless loop
    fade_samples = int(sample_rate * 0.5)
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    # Normalize
    audio = audio / np.max(np.abs(audio)) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"inline; filename=chakra_{chakra_id}.wav",
            "Accept-Ranges": "bytes"
        }
    )

@api_router.get("/meditation/chakra/stream-realign")
async def stream_realign_tone(duration: int = 60):
    """Stream morphing chakra frequency progression as WAV audio"""
    import numpy as np
    from scipy.io import wavfile
    
    sample_rate = 22050
    duration_seconds = min(duration, 60)
    num_samples = int(sample_rate * duration_seconds)
    
    chakra_order = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"]
    frequencies = [CHAKRA_DATA[c]["frequency"] for c in chakra_order]
    
    time_per_chakra = duration_seconds / len(chakra_order)
    
    t = np.linspace(0, duration_seconds, num_samples, dtype=np.float32)
    audio = np.zeros(num_samples, dtype=np.float32)
    
    for i, freq in enumerate(frequencies):
        start_time = i * time_per_chakra
        end_time = (i + 1) * time_per_chakra
        
        for j in range(num_samples):
            current_time = j / sample_rate
            if start_time <= current_time < end_time:
                progress = (current_time - start_time) / time_per_chakra
                
                if progress < 0.1:
                    envelope = progress / 0.1
                elif progress > 0.9:
                    envelope = (1 - progress) / 0.1
                else:
                    envelope = 1.0
                
                audio[j] += envelope * 0.5 * np.sin(2 * np.pi * freq * current_time)
                audio[j] += envelope * 0.15 * np.sin(2 * np.pi * freq * 2 * current_time)
    
    # Fade
    fade_samples = int(sample_rate * 1)
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    audio = audio / np.max(np.abs(audio)) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="audio/wav",
        headers={
            "Content-Disposition": "inline; filename=chakra_realign.wav",
            "Accept-Ranges": "bytes"
        }
    )

@api_router.get("/meditation/binaural/stream/{frequency_id}")
async def stream_binaural_beat(frequency_id: str, duration: int = 30):
    """Stream binaural beat as WAV audio for native playback"""
    import numpy as np
    from scipy.io import wavfile
    
    # Frequency definitions
    BINAURAL_FREQUENCIES = {
        "delta": {"base": 100, "beat": 2, "name": "Delta (Deep Sleep)"},
        "theta": {"base": 150, "beat": 6, "name": "Theta (Meditation)"},
        "alpha": {"base": 200, "beat": 10, "name": "Alpha (Relaxation)"},
        "beta": {"base": 250, "beat": 20, "name": "Beta (Focus)"},
        "gamma": {"base": 300, "beat": 40, "name": "Gamma (Cognition)"},
        "god-tone": {"base": 963, "beat": 0, "name": "God Tone (963Hz)"},
        "love": {"base": 528, "beat": 0, "name": "Love Frequency (528Hz)"},
        "liberation": {"base": 396, "beat": 0, "name": "Liberation (396Hz)"},
    }
    
    if frequency_id not in BINAURAL_FREQUENCIES:
        raise HTTPException(status_code=404, detail="Frequency not found")
    
    freq_data = BINAURAL_FREQUENCIES[frequency_id]
    base_freq = freq_data["base"]
    beat_freq = freq_data["beat"]
    
    sample_rate = 22050
    segment_duration = min(duration, 30)
    num_samples = int(sample_rate * segment_duration)
    
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)
    
    if beat_freq > 0:
        # Binaural beat - create stereo
        left = np.sin(2 * np.pi * base_freq * t) * 0.5
        right = np.sin(2 * np.pi * (base_freq + beat_freq) * t) * 0.5
        audio = np.column_stack((left, right))
    else:
        # Pure tone - mono
        audio = np.sin(2 * np.pi * base_freq * t) * 0.5
        audio += np.sin(2 * np.pi * base_freq * 2 * t) * 0.15
        audio += np.sin(2 * np.pi * base_freq * 3 * t) * 0.08
    
    # Fade
    fade_samples = int(sample_rate * 0.5)
    if len(audio.shape) == 2:
        audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32).reshape(-1, 1)
        audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32).reshape(-1, 1)
    else:
        audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
        audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    # Normalize
    audio = audio / np.max(np.abs(audio)) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"inline; filename=binaural_{frequency_id}.wav",
            "Accept-Ranges": "bytes"
        }
    )

# ============ END STREAMING AUDIO ENDPOINTS ============

@api_router.post("/meditation/chakra/generate-guided/{chakra_id}")
async def generate_chakra_meditation(chakra_id: str, duration_minutes: int = 5):
    """Generate a guided meditation script for a specific chakra"""
    if chakra_id not in CHAKRA_DATA:
        raise HTTPException(status_code=404, detail="Chakra not found")
    
    chakra = CHAKRA_DATA[chakra_id]
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"chakra-{uuid.uuid4()}",
            system_message=f"""You are a chakra healing meditation guide. Create a {duration_minutes}-minute guided meditation for the {chakra['name']}.

IMPORTANT FORMATTING RULES:
1. Include pauses using EXACTLY this format: [pause for X seconds] where X is between 3 and 10
2. Focus on the {chakra['location']} area and the color {chakra['color']}
3. Include the affirmation: "{chakra['affirmation']}"
4. Reference the {chakra['element']} element
5. Include visualization of the chakra's color energy
6. Keep language calm, soothing, and spiritually uplifting
7. DO NOT use any markdown formatting - no asterisks (*), no hash symbols (#), no bullet points
8. Write in plain flowing prose that sounds natural when spoken aloud"""
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"""Create a complete {duration_minutes}-minute chakra meditation for the {chakra['name']} located at the {chakra['location']}.

Include:
1. Opening and settling (with pauses)
2. Breathing to connect with the chakra
3. Color visualization ({chakra['color']} energy)
4. Element connection ({chakra['element']})
5. Affirmation work: "{chakra['affirmation']}"
6. Benefits focus: {', '.join(chakra['benefits'])}
7. Gentle closing

Use [pause for X seconds] format for all pauses.
Write in plain prose without any markdown formatting - this will be read aloud."""
        
        user_message = UserMessage(text=prompt)
        script = await chat.send_message(user_message)
        
        return {
            "chakra_id": chakra_id,
            "chakra_name": chakra["name"],
            "script": script,
            "duration_minutes": duration_minutes,
            "frequency": chakra["frequency"]
        }
    except Exception as e:
        logging.error(f"Error generating chakra meditation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meditation")

@api_router.post("/meditation/chakra/generate-realign")
async def generate_realign_all_meditation(duration_minutes: int = 15):
    """Generate a guided meditation that works through all chakras"""
    chakra_order = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"]
    chakra_info = [f"- {CHAKRA_DATA[c]['name']} ({CHAKRA_DATA[c]['location']}): {CHAKRA_DATA[c]['affirmation']}" for c in chakra_order]
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"chakra-realign-{uuid.uuid4()}",
            system_message=f"""You are a chakra healing meditation guide. Create a {duration_minutes}-minute full chakra realignment meditation that moves through all seven chakras from root to crown.

IMPORTANT FORMATTING RULES:
1. Include pauses using EXACTLY this format: [pause for X seconds] where X is between 3 and 15
2. Spend roughly equal time on each chakra
3. Include smooth transitions between chakras
4. Use color visualization for each chakra
5. Include each chakra's affirmation
6. The tone will automatically shift to match each chakra, so mention when moving to next chakra
7. DO NOT use any markdown formatting - no asterisks (*), no hash symbols (#), no bullet points
8. Write in plain flowing prose that sounds natural when spoken aloud"""
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"""Create a complete {duration_minutes}-minute chakra realignment meditation that moves through all seven chakras:

{chr(10).join(chakra_info)}

Structure:
1. Opening and grounding
2. Root Chakra (red) - grounding and security
3. Sacral Chakra (orange) - creativity and emotions  
4. Solar Plexus Chakra (yellow) - personal power
5. Heart Chakra (green) - love and compassion
6. Throat Chakra (blue) - communication and truth
7. Third Eye Chakra (indigo) - intuition and wisdom
8. Crown Chakra (violet) - spiritual connection
9. Integration and closing

Use [pause for X seconds] for breathing and integration moments.
Write in plain prose without any markdown formatting - this will be read aloud."""
        
        user_message = UserMessage(text=prompt)
        script = await chat.send_message(user_message)
        
        return {
            "type": "realign_all",
            "script": script,
            "duration_minutes": duration_minutes,
            "chakra_order": chakra_order
        }
    except Exception as e:
        logging.error(f"Error generating realign meditation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meditation")

@api_router.get("/meditation/ambient/generate/{sound_id}")
async def generate_ambient_sound(sound_id: str, duration: int = 60):
    """Generate ambient sound audio (synthesized)"""
    import numpy as np
    from scipy.io import wavfile
    
    # Sound configurations - we'll synthesize nature-like sounds
    sound_config = {
        "ocean": {"type": "pink_noise", "modulation": 0.3, "mod_freq": 0.1},
        "rain": {"type": "white_noise", "modulation": 0.5, "mod_freq": 2.0},
        "forest": {"type": "brown_noise", "modulation": 0.2, "mod_freq": 0.5},
        "singing-bowl": {"type": "sine_harmonic", "base_freq": 396, "harmonics": [1, 2, 3, 5]},
        "thunder": {"type": "thunder", "modulation": 0.6},
        "wind": {"type": "wind", "modulation": 0.4},
        "fire": {"type": "fire", "crackle_rate": 8},
        "stream": {"type": "stream", "flow_rate": 0.3},
        "night": {"type": "night", "cricket_rate": 4},
        "silence": {"type": "silence"}
    }
    
    if sound_id not in sound_config:
        raise HTTPException(status_code=404, detail="Sound not found")
    
    config = sound_config[sound_id]
    sample_rate = 44100
    duration_seconds = min(duration, 300)  # Max 5 minutes per request
    num_samples = int(sample_rate * duration_seconds)
    
    # Generate audio based on type
    if config["type"] == "silence":
        audio = np.zeros(num_samples, dtype=np.float32)
    
    elif config["type"] == "pink_noise":
        # Pink noise (1/f noise) - sounds like heavy rain
        white = np.random.randn(num_samples).astype(np.float32)
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        from scipy.signal import lfilter
        pink = lfilter(b, a, white)
        mod = 0.5 + config["modulation"] * np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate)
        audio = (pink * mod * 0.3).astype(np.float32)
    
    elif config["type"] == "white_noise":
        # Pure white noise
        white = np.random.randn(num_samples).astype(np.float32)
        mod = 0.3 + config["modulation"] * np.abs(np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate + np.random.randn(num_samples) * 0.5))
        audio = (white * mod * 0.25).astype(np.float32)
    
    elif config["type"] == "brown_noise":
        # Brown noise (random walk) - deeper, forest-like
        white = np.random.randn(num_samples).astype(np.float32)
        brown = np.cumsum(white)
        brown = brown / np.max(np.abs(brown))
        mod = 0.7 + config["modulation"] * np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate)
        audio = (brown * mod * 0.3).astype(np.float32)
    
    elif config["type"] == "sine_harmonic":
        # Harmonious note - harmonic sine waves with decay
        t = np.arange(num_samples) / sample_rate
        audio = np.zeros(num_samples, dtype=np.float32)
        for i, h in enumerate(config["harmonics"]):
            freq = config["base_freq"] * h
            decay = np.exp(-t * (0.1 + i * 0.05))
            audio += np.sin(2 * np.pi * freq * t) * decay * (1.0 / (i + 1))
        audio = (audio / np.max(np.abs(audio)) * 0.5).astype(np.float32)
        strike_interval = int(sample_rate * 8)
        for strike_pos in range(0, num_samples, strike_interval):
            strike_end = min(strike_pos + int(sample_rate * 0.1), num_samples)
            audio[strike_pos:strike_end] *= 1.5
    
    elif config["type"] == "thunder":
        # Thunderstorm - rain with occasional thunder rumbles
        from scipy.signal import lfilter
        white = np.random.randn(num_samples).astype(np.float32)
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        rain = lfilter(b, a, white) * 0.2
        # Add thunder rumbles
        thunder_times = np.random.choice(num_samples, size=int(duration_seconds / 10), replace=False)
        for t_pos in thunder_times:
            thunder_len = int(sample_rate * np.random.uniform(1.5, 3.0))
            if t_pos + thunder_len < num_samples:
                t = np.arange(thunder_len) / sample_rate
                thunder = np.random.randn(thunder_len) * np.exp(-t * 2) * 0.6
                # Low pass filter for rumble
                from scipy.signal import butter, filtfilt
                b_lp, a_lp = butter(4, 100 / (sample_rate / 2), btype='low')
                thunder = filtfilt(b_lp, a_lp, thunder)
                rain[t_pos:t_pos + thunder_len] += thunder
        audio = rain.astype(np.float32)
    
    elif config["type"] == "wind":
        # Wind - modulated filtered noise
        from scipy.signal import butter, filtfilt
        white = np.random.randn(num_samples).astype(np.float32)
        # Bandpass for wind sound
        b_bp, a_bp = butter(2, [100 / (sample_rate / 2), 1000 / (sample_rate / 2)], btype='band')
        wind = filtfilt(b_bp, a_bp, white)
        # Slow modulation for gusts
        t = np.arange(num_samples) / sample_rate
        gust = 0.5 + 0.5 * np.sin(2 * np.pi * 0.1 * t + np.random.randn() * 2)
        audio = (wind * gust * 0.3).astype(np.float32)
    
    elif config["type"] == "fire":
        # Crackling fire
        from scipy.signal import butter, filtfilt
        # Base fire roar (low frequency noise)
        white = np.random.randn(num_samples).astype(np.float32)
        b_lp, a_lp = butter(2, 500 / (sample_rate / 2), btype='low')
        fire_base = filtfilt(b_lp, a_lp, white) * 0.15
        # Add crackles
        crackle_times = np.random.choice(num_samples, size=int(duration_seconds * config["crackle_rate"]), replace=False)
        for c_pos in crackle_times:
            crackle_len = int(sample_rate * np.random.uniform(0.02, 0.08))
            if c_pos + crackle_len < num_samples:
                crackle = np.random.randn(crackle_len) * np.exp(-np.arange(crackle_len) / (crackle_len / 3)) * 0.4
                fire_base[c_pos:c_pos + crackle_len] += crackle
        audio = fire_base.astype(np.float32)
    
    elif config["type"] == "stream":
        # Flowing stream - filtered noise with babbling
        from scipy.signal import butter, filtfilt
        white = np.random.randn(num_samples).astype(np.float32)
        # Bandpass for water sound
        b_bp, a_bp = butter(2, [200 / (sample_rate / 2), 2000 / (sample_rate / 2)], btype='band')
        water = filtfilt(b_bp, a_bp, white)
        # Add gentle modulation
        t = np.arange(num_samples) / sample_rate
        flow = 0.7 + 0.3 * np.sin(2 * np.pi * config["flow_rate"] * t)
        audio = (water * flow * 0.25).astype(np.float32)
    
    elif config["type"] == "night":
        # Night sounds - crickets and ambient
        t = np.arange(num_samples) / sample_rate
        # Base quiet ambient
        ambient = np.random.randn(num_samples) * 0.02
        # Cricket chirps (high frequency pulses)
        cricket_freq = 4000
        chirp_duration = 0.05
        chirp_samples = int(sample_rate * chirp_duration)
        chirp_times = np.random.choice(num_samples - chirp_samples, size=int(duration_seconds * config["cricket_rate"]), replace=False)
        for c_pos in chirp_times:
            chirp_t = np.arange(chirp_samples) / sample_rate
            chirp = np.sin(2 * np.pi * cricket_freq * chirp_t) * np.exp(-chirp_t * 30) * 0.15
            ambient[c_pos:c_pos + chirp_samples] += chirp
        audio = ambient.astype(np.float32)
    
    else:
        audio = np.zeros(num_samples, dtype=np.float32)
    
    # Add gentle fade in/out
    fade_samples = int(sample_rate * 1)
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)
    audio[:fade_samples] *= fade_in
    audio[-fade_samples:] *= fade_out
    
    # Clip and convert to 16-bit
    audio = np.clip(audio, -1, 1)
    audio_int16 = (audio * 32767).astype(np.int16)
    
    # Write to buffer
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    # Convert to base64
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "sound_id": sound_id,
        "duration_seconds": duration_seconds,
        "sample_rate": sample_rate,
        "audio_base64": audio_base64,
        "format": "wav"
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

@api_router.get("/spirit-guides/voices")
async def get_spirit_guide_voices():
    """Get all spirit guide voice configurations"""
    return SPIRIT_GUIDE_VOICES

# Dream Interpretation endpoint
class DreamInterpretRequest(BaseModel):
    description: str = ""
    symbols: list = []
    feelings: list = []

@api_router.post("/dreams/interpret")
async def interpret_dream(request: DreamInterpretRequest):
    """Interpret a dream using AI"""
    try:
        # Build the prompt
        symbols_text = ", ".join(request.symbols) if request.symbols else "None specified"
        feelings_text = ", ".join(request.feelings) if request.feelings else "None specified"
        
        system_message = """You are a wise dream interpreter with deep knowledge of dream symbolism, psychology, and spiritual traditions. 
You help people understand the symbolic language of their dreams with warmth, compassion, and insight.
Keep your interpretations supportive and empowering. Avoid being overly negative or alarming."""

        prompt = f"""Analyze this dream and provide a thoughtful, insightful interpretation.

DREAM DESCRIPTION:
{request.description if request.description else "Not provided - interpret based on symbols only"}

SYMBOLS PRESENT:
{symbols_text}

FEELINGS EXPERIENCED:
{feelings_text}

Please provide a comprehensive interpretation that includes:
1. The overall meaning and message of the dream
2. Analysis of key symbols and what they represent
3. How the emotions relate to the dream's meaning
4. Potential connections to waking life situations
5. Guidance or insights the dreamer might take from this dream

The interpretation should be 2-3 paragraphs."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"dream-interpret-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("gemini", "gemini-2.0-flash")
        
        response = await chat.send_message(
            UserMessage(text=prompt)
        )
        
        # Response may be a string or an object with text attribute
        if hasattr(response, 'text'):
            interpretation = response.text
        else:
            interpretation = str(response)
        
        return {"interpretation": interpretation, "success": True}
        
    except Exception as e:
        logging.error(f"Error interpreting dream: {e}")
        raise HTTPException(status_code=500, detail="Failed to interpret dream")

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
                    "voice": guide_info["voice"]
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


# ==================== Push Notifications ====================

class PushTokenRequest(BaseModel):
    user_id: str
    push_token: str
    platform: str

class SendNotificationRequest(BaseModel):
    title: str
    body: str
    user_ids: Optional[List[str]] = None  # None = send to all
    data: Optional[dict] = None

@api_router.post("/notifications/register")
async def register_push_token(request: PushTokenRequest):
    """Register a user's push notification token"""
    try:
        await db.push_tokens.update_one(
            {"user_id": request.user_id},
            {
                "$set": {
                    "push_token": request.push_token,
                    "platform": request.platform,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        return {"success": True, "message": "Push token registered"}
    except Exception as e:
        logging.error(f"Error registering push token: {e}")
        raise HTTPException(status_code=500, detail="Failed to register push token")

@api_router.post("/notifications/send")
async def send_push_notification(request: SendNotificationRequest):
    """Send push notification to users (admin only)"""
    try:
        # Get target users with reasonable limit for batch processing
        if request.user_ids:
            tokens = await db.push_tokens.find(
                {"user_id": {"$in": request.user_ids}}
            ).to_list(1000)  # Limit to 1000 tokens per batch
        else:
            tokens = await db.push_tokens.find().to_list(1000)  # Limit to 1000 tokens per batch
        
        if not tokens:
            return {"success": False, "message": "No registered devices found"}
        
        # Use Expo push notification service
        push_tokens = [t["push_token"] for t in tokens if t.get("push_token")]
        
        # Send via Expo Push API
        messages = []
        for token in push_tokens:
            messages.append({
                "to": token,
                "title": request.title,
                "body": request.body,
                "data": request.data or {},
                "sound": "default",
            })
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Content-Type": "application/json"}
            )
            result = response.json()
        
        return {
            "success": True,
            "sent_count": len(push_tokens),
            "result": result
        }
    except Exception as e:
        logging.error(f"Error sending push notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send notification")

@api_router.get("/notifications/tokens/count")
async def get_push_token_count():
    """Get count of registered push tokens"""
    try:
        count = await db.push_tokens.count_documents({})
        return {"count": count}
    except Exception as e:
        logging.error(f"Error getting push token count: {e}")
        raise HTTPException(status_code=500, detail="Failed to get token count")


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
