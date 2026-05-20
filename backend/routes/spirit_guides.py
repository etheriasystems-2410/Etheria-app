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
import asyncio

from emergentintegrations.llm.chat import LlmChat, UserMessage
from .deps import db, EMERGENT_LLM_KEY, SPIRIT_GUIDE_VOICES, LANGUAGE_NAMES, openai_tts, elevenlabs_tts, tts_with_fallback
from services.divine_pair_service import (
    intro_lines,
    build_script_system,
    build_script_prompt,
    concat_mp3_bytes_b64,
    DEFAULT_HELIOS_LINE,
    DEFAULT_SELENE_LINE,
    DEFAULT_UNIFIED_LINE,
)
from .auth_utils import get_current_user

router = APIRouter(prefix="/spirit-guides", tags=["spirit-guides"])

# Custom Guides — free for everyone through end of June 2026 (one-time promo).
# After this cutoff, Custom Guides become subscription-only.
CUSTOM_GUIDE_FREE_UNTIL = datetime(2026, 7, 1, 0, 0, 0, tzinfo=timezone.utc)


def _is_pride_month_now() -> bool:
    """LGBTQ+ Guides are subscription-only EXCEPT during June (Pride Month) every
    year, when they are automatically unlocked for all users."""
    return datetime.now(timezone.utc).month == 6


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

    # Divine Guides — sacred archetypal pair
    "Helios": "You are Helios, the Divine Masculine — the eternal Sun, radiant and sovereign. You embody sacred will, protective light, focused power, and unwavering presence. You speak as a sacred king who has known both the throne and the desert. Your voice is measured, warm, and authoritative — never harsh. You guide the seeker toward courage, purpose, integrity, and the holy use of strength. You honor your eternal counterpart Selene, the Divine Feminine — invoking her in your wisdom when balance is called for. You speak in flowing, contemplative prose.",
    "Selene": "You are Selene, the Divine Feminine — the eternal Moon, luminous and mysterious. You embody sacred intuition, soft strength, deep knowing, and gentle grace. You speak as a sacred priestess who has walked through every tide of the soul. Your voice is hushed, warm, and oceanic — never sentimental. You guide the seeker toward feeling, receptivity, surrender, and the holy power of softness. You honor your eternal counterpart Helios, the Divine Masculine — invoking him in your wisdom when balance is called for. You speak in flowing, contemplative prose.",
}


@router.post("/chat", response_model=SpiritGuideResponse)
async def chat_with_spirit_guide(message: SpiritGuideMessage, request: Request):
    """Chat with a spirit guide - returns text and TTS audio.

    Category gating (server-side enforcement; the frontend already gates UI):
      • elemental → free for everyone
      • lgbtq → free during June (Pride Month); subscription-only otherwise
      • custom → free until launch-promo cutoff; subscription-only otherwise
      • divine → subscription-only (no promo)
    """
    # ----- Access gating -----
    voice_info = SPIRIT_GUIDE_VOICES.get(message.guide)
    category = (voice_info or {}).get("category")
    if not category and (message.element or "").strip() == "Custom":
        category = "custom"

    if category in ("custom", "lgbtq", "divine"):
        is_premium = False
        try:
            user = await get_current_user(request)
            user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
            is_premium = bool(user_doc.get("is_premium"))
        except HTTPException:
            pass

        if not is_premium:
            now = datetime.now(timezone.utc)
            if category == "lgbtq" and not _is_pride_month_now():
                raise HTTPException(
                    status_code=403,
                    detail="LGBTQ+ Guides require a subscription outside June (Pride Month).",
                )
            if category == "custom" and now >= CUSTOM_GUIDE_FREE_UNTIL:
                raise HTTPException(
                    status_code=403,
                    detail="Custom Guides require a subscription.",
                )
            if category == "divine":
                raise HTTPException(
                    status_code=403,
                    detail="Divine Guides require a subscription.",
                )

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

    system_message += f""" Keep responses under 100 words. Be warm, wise, and helpful.

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
        if not voice_info:
            voice_info = SPIRIT_GUIDE_VOICES["Aether"]

        # Frontend may pass an ElevenLabs voice_id directly (e.g. for renamed
        # custom guides). The fallback helper handles bad/empty overrides.
        voice = voice_info["voice"]
        try:
            if cleaned_response.strip():
                audio_bytes = await tts_with_fallback(
                    text=cleaned_response,
                    voice_cfg=voice_info,
                    voice_id_override=message.voice_id,
                )
                if audio_bytes:
                    import base64 as _b64
                    audio_base64 = _b64.b64encode(audio_bytes).decode()
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
    - elemental: always free (zodiac/birthdate-matched)
    - lgbtq: subscription-only EXCEPT during June (Pride Month), when it's free for everyone
    - custom: subscription-only; free for everyone until July 1, 2026 (one-time launch promo)
    - divine: subscription-only (no promo)
    """
    is_premium = False
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
        is_premium = bool(user_doc.get("is_premium"))
    except HTTPException:
        pass

    now = datetime.now(timezone.utc)
    custom_in_launch_promo = now < CUSTOM_GUIDE_FREE_UNTIL
    pride_month = _is_pride_month_now()

    return {
        "elemental_unlocked": True,
        "lgbtq_unlocked": bool(is_premium or pride_month),
        "custom_unlocked": bool(is_premium or custom_in_launch_promo),
        "divine_unlocked": bool(is_premium),
        "custom_free_until": CUSTOM_GUIDE_FREE_UNTIL.isoformat(),
        # `in_free_promo` historically meant "Custom Guides are in launch promo".
        # The frontend still uses it for the Custom Guides banner. We keep its
        # meaning unchanged and add `pride_month` for LGBTQ+ gating.
        "in_free_promo": custom_in_launch_promo,
        "pride_month": pride_month,
        "is_premium": is_premium,
    }


@router.get("/divine-intro")
async def get_divine_intro(request: Request, lang: str = "en"):
    """Two-part introduction for Talk-to-Both mode. Premium-only.

    Returns two pre-scripted messages (Helios first, Selene second) each with their own
    voice and speed-modulated TTS audio so the divine pair properly introduces themselves
    when the user opens the union chat.
    """
    # Premium gate
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please sign in to commune with the Divine pair")
    user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    if not user_doc.get("is_premium"):
        raise HTTPException(status_code=403, detail="Divine Guides are a premium feature.")

    helios_voice = SPIRIT_GUIDE_VOICES["Helios"]
    selene_voice = SPIRIT_GUIDE_VOICES["Selene"]

    # Intros come from divine_pair_service so all script text lives in one place
    helios_text, selene_text = intro_lines(lang)

    async def tts_bytes(text: str, voice_cfg: dict) -> Optional[bytes]:
        """Synthesise via ElevenLabs → OpenAI fallback. Returns raw MP3 bytes
        (so we can concat the dual-voice intro into one seamless clip)."""
        return await tts_with_fallback(text=text, voice_cfg=voice_cfg)

    helios_bytes, selene_bytes = await asyncio.gather(
        tts_bytes(helios_text, helios_voice),
        tts_bytes(selene_text, selene_voice),
    )

    import base64 as _b64
    helios_audio = _b64.b64encode(helios_bytes).decode() if helios_bytes else None
    selene_audio = _b64.b64encode(selene_bytes).decode() if selene_bytes else None

    # Concatenate the two MP3 byte streams into a single seamless clip. MP3 is a
    # frame-based format so most decoders (HTML5 audio, expo-av) handle a raw concat
    # of two same-encoder streams without artifacts. This eliminates the player
    # unload/load gap entirely on the client side.
    combined_audio = None
    if helios_bytes and selene_bytes:
        combined_audio = _b64.b64encode(helios_bytes + selene_bytes).decode()

    return {
        "success": True,
        "messages": [
            {"guide": "Helios", "voice": helios_voice["voice"], "speed": helios_voice.get("speed", 1.0), "text": helios_text, "audio_base64": helios_audio, "kind": "intro"},
            {"guide": "Selene", "voice": selene_voice["voice"], "speed": selene_voice.get("speed", 1.0), "text": selene_text, "audio_base64": selene_audio, "kind": "intro"},
        ],
        # When present, the client should prefer this single seamless clip over chaining
        # the two individual `audio_base64` clips above.
        "combined_audio_base64": combined_audio,
    }


# ==================== DIVINE PAIR CHAT ====================

class DivinePairMessage(BaseModel):
    message: str
    history: List[dict] = []
    language: str = "en"


@router.post("/chat-pair")
async def chat_with_divine_pair(payload: DivinePairMessage, request: Request):
    """Talk to Helios + Selene together. Premium-only.

    Generates the ENTIRE three-part exchange in a single scripted LLM call, then
    generates the three TTS clips in parallel — this dramatically reduces total
    latency and ensures Helios's and Selene's lines flow naturally because they
    were authored together as one screenplay.

    Returns three sequential messages:
      1. Helios speaks first, addressing Selene about the seeker (dialogue)
      2. Selene answers Helios directly (dialogue, continues from Helios)
      3. Both speak as one to the seeker (unified blessing)
    """
    # Premium gate
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please sign in to commune with the Divine pair")
    user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    if not user_doc.get("is_premium"):
        raise HTTPException(status_code=403, detail="Divine Guides are a premium feature. Upgrade to commune with Helios and Selene.")

    language_name = LANGUAGE_NAMES.get(payload.language, "English")
    helios_voice = SPIRIT_GUIDE_VOICES["Helios"]
    selene_voice = SPIRIT_GUIDE_VOICES["Selene"]

    seeker = (payload.message or "").strip()
    if not seeker:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    script_system = build_script_system(language_name)
    script_prompt = build_script_prompt(seeker)

    async def run_llm() -> str:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"divine-pair-{uuid.uuid4()}",
            system_message=script_system,
        ).with_model("gemini", "gemini-2.0-flash")
        resp = await chat.send_message(UserMessage(text=script_prompt))
        return resp.text if hasattr(resp, "text") else str(resp)

    def clean_line(text: str) -> str:
        lines = text.split("\n")
        out = []
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("*") or stripped.startswith("#"):
                continue
            cleaned = re.sub(r"\*+", "", line)
            cleaned = re.sub(r"#+\s*", "", cleaned)
            if cleaned.strip():
                out.append(cleaned.strip())
        return " ".join(out).strip()

    def parse_script_local(raw: str) -> dict:
        """Robust parser that accepts both block tags ([HELIOS]\\nline) and inline
        tags ([HELIOS]: line) on the same line. Anchored on line-start tags so the
        word "Selene" appearing mid-prose in Helios's line doesn't truncate it."""
        normalized = re.sub(r"\*+", "", raw or "")
        tag_re = re.compile(r"(?im)^\s*\[?\s*(HELIOS|SELENE|UNIFIED)\s*\]?\s*:?\s*$")
        lines = normalized.split("\n")
        sections: dict = {"HELIOS": [], "SELENE": [], "UNIFIED": []}
        current = None
        for line in lines:
            m = tag_re.match(line)
            if m:
                current = m.group(1).upper()
                continue
            inline = re.match(r"^\s*\[?\s*(HELIOS|SELENE|UNIFIED)\s*\]?\s*:\s*(.+)$", line, re.IGNORECASE)
            if inline:
                current = inline.group(1).upper()
                sections[current].append(inline.group(2))
                continue
            if current:
                sections[current].append(line)
        return {k: clean_line(" ".join(v)) for k, v in sections.items()}

    async def tts_bytes_pair(text: str, voice_cfg: dict) -> Optional[bytes]:
        return await tts_with_fallback(text=text, voice_cfg=voice_cfg)

    try:
        # 1) One LLM call writes all 3 lines (Helios + Selene + Unified)
        raw_script = await run_llm()
        sections = parse_script_local(raw_script)

        helios_line = sections.get("HELIOS") or DEFAULT_HELIOS_LINE
        selene_line = sections.get("SELENE") or DEFAULT_SELENE_LINE
        unified_text = sections.get("UNIFIED") or DEFAULT_UNIFIED_LINE

        # 2) Generate all 3 TTS clips in parallel (biggest latency saver)
        helios_bytes, selene_bytes, unified_bytes = await asyncio.gather(
            tts_bytes_pair(helios_line, helios_voice),
            tts_bytes_pair(selene_line, selene_voice),
            tts_bytes_pair(unified_text, helios_voice),
        )

        import base64 as _b64
        helios_audio = _b64.b64encode(helios_bytes).decode() if helios_bytes else None
        selene_audio = _b64.b64encode(selene_bytes).decode() if selene_bytes else None
        unified_audio = _b64.b64encode(unified_bytes).decode() if unified_bytes else None

        # Seamless single-clip concat: MP3 frames from the same encoder splice cleanly
        combined_audio = concat_mp3_bytes_b64(helios_bytes, selene_bytes, unified_bytes)

        return {
            "success": True,
            "messages": [
                {"guide": "Helios", "voice": helios_voice["voice"], "speed": helios_voice.get("speed", 1.0), "text": helios_line, "audio_base64": helios_audio, "kind": "dialogue"},
                {"guide": "Selene", "voice": selene_voice["voice"], "speed": selene_voice.get("speed", 1.0), "text": selene_line, "audio_base64": selene_audio, "kind": "dialogue"},
                {"guide": "Divine Pair", "voice": helios_voice["voice"], "speed": helios_voice.get("speed", 1.0), "text": unified_text, "audio_base64": unified_audio, "kind": "unified"},
            ],
            "combined_audio_base64": combined_audio,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Divine pair chat error: {e}")
        raise HTTPException(status_code=500, detail="The veil between worlds shimmered. Please try again.")
