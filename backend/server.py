from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import random
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Gemini API key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Oracle Cards - Spirit Guide themed
ORACLE_CARDS = [
    {
        "name": "The Fire Phoenix",
        "element": "Fire",
        "description": "Transformation through passion and rebirth",
        "keywords": ["transformation", "passion", "renewal", "energy"]
    },
    {
        "name": "The Flame Dancer",
        "element": "Fire",
        "description": "Creative expression and bold action",
        "keywords": ["creativity", "action", "courage", "expression"]
    },
    {
        "name": "The Sacred Ember",
        "element": "Fire",
        "description": "Inner spark and divine inspiration",
        "keywords": ["inspiration", "motivation", "divine spark", "purpose"]
    },
    {
        "name": "The Ocean Depths",
        "element": "Water",
        "description": "Deep emotions and subconscious wisdom",
        "keywords": ["emotions", "intuition", "depth", "subconscious"]
    },
    {
        "name": "The Healing Spring",
        "element": "Water",
        "description": "Emotional cleansing and renewal",
        "keywords": ["healing", "cleansing", "forgiveness", "renewal"]
    },
    {
        "name": "The Moon Tide",
        "element": "Water",
        "description": "Cycles, intuition, and psychic ability",
        "keywords": ["cycles", "intuition", "psychic", "feminine energy"]
    },
    {
        "name": "The Ancient Tree",
        "element": "Earth",
        "description": "Grounding, wisdom, and stability",
        "keywords": ["grounding", "wisdom", "stability", "growth"]
    },
    {
        "name": "The Sacred Mountain",
        "element": "Earth",
        "description": "Achievement and endurance",
        "keywords": ["achievement", "endurance", "strength", "foundation"]
    },
    {
        "name": "The Blooming Garden",
        "element": "Earth",
        "description": "Abundance and manifestation",
        "keywords": ["abundance", "manifestation", "prosperity", "nurturing"]
    },
    {
        "name": "The Whispering Wind",
        "element": "Air",
        "description": "Messages and mental clarity",
        "keywords": ["messages", "clarity", "communication", "thought"]
    },
    {
        "name": "The Sky Dancer",
        "element": "Air",
        "description": "Freedom and new perspectives",
        "keywords": ["freedom", "perspective", "liberation", "change"]
    },
    {
        "name": "The Sacred Breath",
        "element": "Air",
        "description": "Life force and spiritual connection",
        "keywords": ["life force", "spirit", "connection", "awareness"]
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
async def save_oracle_reading(reading: SaveReadingRequest):
    """Save an oracle reading to database"""
    try:
        reading_dict = reading.dict()
        reading_dict['_id'] = str(uuid.uuid4())
        reading_dict['saved_at'] = datetime.utcnow().isoformat()
        await db.oracle_readings.insert_one(reading_dict)
        return {"success": True, "message": "Reading saved"}
    except Exception as e:
        logging.error(f"Error saving reading: {e}")
        raise HTTPException(status_code=500, detail="Failed to save reading")

@api_router.get("/oracle/readings")
async def get_saved_readings(limit: int = 20):
    """Get saved oracle readings"""
    try:
        readings = await db.oracle_readings.find().sort("saved_at", -1).limit(limit).to_list(limit)
        return readings
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
async def save_journal_entry(entry: dict):
    """Save a journal entry"""
    try:
        entry['_id'] = str(uuid.uuid4())
        entry['created_at'] = datetime.utcnow().isoformat()
        await db.journal_entries.insert_one(entry)
        return {"success": True, "id": entry['_id']}
    except Exception as e:
        logging.error(f"Error saving journal entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to save entry")

@api_router.get("/journal/entries")
async def get_journal_entries(limit: int = 50):
    """Get journal entries"""
    try:
        entries = await db.journal_entries.find().sort("created_at", -1).limit(limit).to_list(limit)
        return entries
    except Exception as e:
        logging.error(f"Error fetching entries: {e}")
        return []

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
