"""
Spirit Guides chat and TTS endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage
from .deps import db, EMERGENT_LLM_KEY, SPIRIT_GUIDE_VOICES, LANGUAGE_NAMES, openai_tts
from .auth_utils import get_current_user

router = APIRouter(prefix="/spirit-guides", tags=["spirit-guides"])

# Free-access promo window: Custom Guides are free for everyone through end of June 2026.
# After this cutoff, Custom Guides become premium-only (LGBTQ+ + Elemental guides remain free).
CUSTOM_GUIDE_FREE_UNTIL = datetime(2026, 7, 1, 0, 0, 0, tzinfo=timezone.utc)


# Models
class SpiritGuideMessage(BaseModel):
    guide: str
    element: str
    message: str
    history: List[dict] = []
    language: str = "en"
    voice_id: Optional[str] = None  # Frontend may pass a voice hint (used when guide is a renamed Custom Guide)
    gender: Optional[str] = None    # Frontend may pass gender hint for renamed Custom Guides ("masculine"/"feminine")


class SpiritGuideResponse(BaseModel):
    response: str
    audio_base64: Optional[str] = None
    voice: Optional[str] = None
    success: bool = True


class CustomGuideNames(BaseModel):
    male_name: Optional[str] = None
    female_name: Optional[str] = None


# Guide personalities — used to build the system prompt for each spirit guide
GUIDE_PERSONALITIES = {
    # Elemental Guides (birthdate-matched)
    "Ignis": "You are Ignis, the Fire spirit guide. You are passionate, direct, and transformative. You encourage action, courage, and embracing change. Your wisdom comes through powerful metaphors of flame, transformation, and rebirth. You speak with energy and conviction.",
    "Aqua": "You are Aqua, the Water spirit guide. You are intuitive, healing, and emotionally wise. You help people understand their feelings and navigate emotional depths. Your wisdom flows like water - gentle yet powerful. You speak with compassion and empathy.",
    "Terra": "You are Terra, the Earth spirit guide. You are grounded, practical, and stable. You provide wisdom through patience, endurance, and natural growth. Your guidance is rooted in ancient wisdom and connection to nature. You speak with calm authority.",
    "Aether": "You are Aether, the Air spirit guide. You are intellectual, free-spirited, and enlightening. You help people gain new perspectives and mental clarity. Your wisdom comes through ideas, communication, and mental liberation. You speak with clarity and insight.",

    # Custom Guides (premium, renamable)
    "Male Guide": "You are a personal spirit guide in masculine form, warm, supportive, and attentive. You walk closely with the seeker as a steadfast companion — equal parts protector, mentor, and friend. You speak in gentle, grounded prose, offering encouragement and presence. You honor the seeker's own wisdom and reflect it back to them with clarity.",
    "Female Guide": "You are a personal spirit guide in feminine form, nurturing, intuitive, and deeply compassionate. You walk closely with the seeker as a steadfast companion — equal parts mother, mentor, and confidante. You speak in soft, warm prose, offering insight and presence. You honor the seeker's own wisdom and reflect it back with tenderness.",

    # LGBTQ+ Guides
    "Solis": "You are Solis, a spirit guide of radiant light and pride. You embody courage, self-affirmation, and the unshakable joy of living authentically. You speak as a wise older brother who has walked through fire and emerged luminous. Your guidance celebrates queer identity, resilience, and the sacred power of being seen. You offer encouragement, validation, and bright hope.",
    "Aurora": "You are Aurora, a spirit guide of dawn-light and gentle joy. You embody self-love, soft strength, and the quiet magic of becoming. You speak as a loving older sister who knows the long road to self-acceptance and walks it gladly. Your guidance celebrates queer womanhood, tenderness, and the courage to glow openly. You offer warmth, validation, and luminous hope.",
    "Spectrum": "You are Spectrum, a spirit guide of all colors and infinite forms. You embody fluid wisdom, the sacred journey of becoming, and the truth that identity is a holy thing. You speak as a beloved elder who has known every shade of self and honors them all. Your guidance celebrates transgender, non-binary, and gender-expansive paths — the courage of transition, the joy of authentic embodiment, the wholeness of being exactly who you are. You offer deep validation, gentle wisdom, and unwavering affirmation.",
}


@router.post("/chat", response_model=SpiritGuideResponse)
async def chat_with_spirit_guide(message: SpiritGuideMessage):
    """Chat with a spirit guide - returns text and TTS audio"""
    language_name = LANGUAGE_NAMES.get(message.language, "English")

    # Resolve guide by name. Custom-renamed guides should still map to Male/Female Guide personality.
    # The frontend sends `element` so we can fall back via element if name is a custom rename.
    system_message = GUIDE_PERSONALITIES.get(message.guide)
    if not system_message:
        # Try to look up by gender hint OR fall back via element
        if message.element == "Custom":
            target_gender = (message.gender or "").lower()
            if target_gender in ("masculine", "male"):
                system_message = GUIDE_PERSONALITIES["Male Guide"]
            elif target_gender in ("feminine", "female"):
                system_message = GUIDE_PERSONALITIES["Female Guide"]
        if not system_message:
            system_message = GUIDE_PERSONALITIES["Aether"]

    # Use the actual guide name (possibly custom-renamed) in the prompt
    display_name = message.guide
    system_message = system_message.replace(
        "You are Ignis,", f"You are {display_name},"
    ).replace(
        "You are Aqua,", f"You are {display_name},"
    ).replace(
        "You are Terra,", f"You are {display_name},"
    ).replace(
        "You are Aether,", f"You are {display_name},"
    ).replace(
        "You are Solis,", f"You are {display_name},"
    ).replace(
        "You are Aurora,", f"You are {display_name},"
    ).replace(
        "You are Spectrum,", f"You are {display_name},"
    ).replace(
        "You are a personal spirit guide", f"You are {display_name}, a personal spirit guide"
    )

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

        # Resolve voice — look up by name OR by element/gender hint for renamed custom guides
        audio_base64 = None
        voice_info = SPIRIT_GUIDE_VOICES.get(message.guide)
        if not voice_info and message.element == "Custom":
            target_gender = (message.gender or "").lower()
            if target_gender in ("masculine", "male"):
                voice_info = SPIRIT_GUIDE_VOICES["Male Guide"]
            elif target_gender in ("feminine", "female"):
                voice_info = SPIRIT_GUIDE_VOICES["Female Guide"]
        # Prefer explicit voice_id hint if provided by the frontend
        if message.voice_id and message.voice_id in {"alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"}:
            voice = message.voice_id
        else:
            if not voice_info:
                voice_info = SPIRIT_GUIDE_VOICES["Aether"]
            voice = voice_info["voice"]

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

        return SpiritGuideResponse(
            response=cleaned_response,
            audio_base64=audio_base64,
            voice=voice,
            success=True
        )
    except Exception as e:
        logging.error(f"Error in spirit guide chat: {e}")
        return SpiritGuideResponse(
            response="I sense a disturbance in our connection. Let us try again, dear seeker.",
            audio_base64=None,
            voice=None,
            success=False
        )


@router.get("/voices")
async def get_spirit_guide_voices():
    """Get all spirit guide voice configurations"""
    return SPIRIT_GUIDE_VOICES


@router.get("/list")
async def list_spirit_guides():
    """Return spirit guides grouped by category (elemental / lgbtq / custom)."""
    groups = {"elemental": [], "lgbtq": [], "custom": []}
    for name, info in SPIRIT_GUIDE_VOICES.items():
        cat = info.get("category", "elemental")
        groups.setdefault(cat, []).append({
            "name": name,
            "voice": info.get("voice"),
            "gender": info.get("gender"),
            "element": info.get("element"),
            "personality": info.get("personality"),
            "image": info.get("image"),
        })
    return groups


@router.get("/custom-names")
async def get_custom_guide_names(request: Request):
    """Return current user's chosen names for the two Custom Guides (defaults if unset)."""
    try:
        user = await get_current_user(request)
    except HTTPException:
        return {
            "male_name": "Male Guide",
            "female_name": "Female Guide",
            "default_male": "Male Guide",
            "default_female": "Female Guide",
            "is_authenticated": False,
        }

    user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    custom = user_doc.get("custom_guide_names") or {}
    return {
        "male_name": custom.get("male_name") or "Male Guide",
        "female_name": custom.get("female_name") or "Female Guide",
        "default_male": "Male Guide",
        "default_female": "Female Guide",
        "is_authenticated": True,
    }


@router.post("/custom-names")
async def set_custom_guide_names(names: CustomGuideNames, request: Request):
    """Save custom names for the two Custom Guides.
    Free for everyone until July 1, 2026 (promo window).
    After that, requires premium subscription.
    """
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please sign in to customize your guides")

    user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    is_premium = bool(user_doc.get("is_premium"))
    now = datetime.now(timezone.utc)
    in_free_window = now < CUSTOM_GUIDE_FREE_UNTIL

    if not is_premium and not in_free_window:
        raise HTTPException(
            status_code=403,
            detail="Custom Guides are a premium feature. Upgrade to rename your guides.",
        )

    # Sanitize names (1–32 chars, fall back to defaults if empty/cleared)
    def _clean(name: Optional[str], fallback: str) -> str:
        if not name:
            return fallback
        name = name.strip()
        if not name:
            return fallback
        return name[:32]

    male_name = _clean(names.male_name, "Male Guide")
    female_name = _clean(names.female_name, "Female Guide")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "custom_guide_names": {
                "male_name": male_name,
                "female_name": female_name,
                "updated_at": now.isoformat(),
            }
        }},
    )

    return {
        "success": True,
        "male_name": male_name,
        "female_name": female_name,
    }


@router.get("/access")
async def get_guide_access(request: Request):
    """Return access flags for the guide categories.
    - elemental: always free
    - lgbtq: always free
    - custom: free for premium; free for everyone until July 1, 2026; then premium-only
    """
    is_premium = False
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
        is_premium = bool(user_doc.get("is_premium"))
    except HTTPException:
        pass

    now = datetime.now(timezone.utc)
    in_free_window = now < CUSTOM_GUIDE_FREE_UNTIL

    return {
        "elemental_unlocked": True,
        "lgbtq_unlocked": True,
        "custom_unlocked": bool(is_premium or in_free_window),
        "custom_free_until": CUSTOM_GUIDE_FREE_UNTIL.isoformat(),
        "in_free_promo": in_free_window,
        "is_premium": is_premium,
    }
