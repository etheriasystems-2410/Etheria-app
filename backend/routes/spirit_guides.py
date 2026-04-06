"""
Spirit Guides chat and TTS endpoints
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import uuid
import logging
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage
from .deps import db, EMERGENT_LLM_KEY, SPIRIT_GUIDE_VOICES, LANGUAGE_NAMES, openai_tts

router = APIRouter(prefix="/spirit-guides", tags=["spirit-guides"])


# Models
class SpiritGuideMessage(BaseModel):
    guide: str
    element: str
    message: str
    history: List[dict] = []
    language: str = "en"


class SpiritGuideResponse(BaseModel):
    response: str
    audio_base64: Optional[str] = None
    voice: Optional[str] = None
    success: bool = True


@router.post("/chat", response_model=SpiritGuideResponse)
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
            if EMERGENT_LLM_KEY and cleaned_response.strip() and openai_tts:
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


@router.get("/voices")
async def get_spirit_guide_voices():
    """Get all spirit guide voice configurations"""
    return SPIRIT_GUIDE_VOICES
