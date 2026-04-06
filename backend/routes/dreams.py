"""
Dreams interpretation and Zodiac endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage
from .deps import db, EMERGENT_LLM_KEY, SPIRIT_GUIDE_VOICES

router = APIRouter(prefix="/dreams", tags=["dreams"])

# Zodiac to Element mapping
ZODIAC_TO_ELEMENT = {
    "aries": "Fire",
    "leo": "Fire", 
    "sagittarius": "Fire",
    "taurus": "Earth",
    "virgo": "Earth",
    "capricorn": "Earth",
    "gemini": "Air",
    "libra": "Air",
    "aquarius": "Air",
    "cancer": "Water",
    "scorpio": "Water",
    "pisces": "Water"
}


class DreamInterpretRequest(BaseModel):
    description: str = ""
    symbols: list = []
    feelings: list = []


@router.post("/interpret")
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


# Create a separate router for zodiac
zodiac_router = APIRouter(prefix="/zodiac", tags=["zodiac"])


@zodiac_router.get("/element/{birth_month}/{birth_day}")
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
