"""
Oracle Divination endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime, timezone
import random
import uuid
import logging
import asyncio
import base64

from emergentintegrations.llm.chat import LlmChat, UserMessage
from .deps import db, EMERGENT_LLM_KEY, oracle_image_gen
from .auth_utils import get_current_user

router = APIRouter(prefix="/oracle", tags=["oracle"])

# Oracle Cards Data
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


class MultiCardDrawRequest(BaseModel):
    spread_type: str = "single"
    card_count: int = 1
    positions: List[str] = ["Guidance"]


@router.post("/draw")
async def draw_oracle_card(request: MultiCardDrawRequest = None):
    """Draw oracle cards and get AI interpretation with AI-generated images"""
    
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


@router.post("/save")
async def save_oracle_reading(reading: SaveReadingRequest, request: Request):
    """Save an oracle reading to database"""
    try:
        # Get current user
        user = await get_current_user(request)
        
        reading_dict = reading.dict()
        reading_dict['_id'] = str(uuid.uuid4())
        reading_dict['user_id'] = user['user_id']
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


@router.get("/readings")
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
