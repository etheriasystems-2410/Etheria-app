"""
Oracle Divination endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional
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


async def _synth_and_cache_card_image(card_name: str, image_prompt: str) -> None:
    """Fire-and-forget background task that generates + caches an oracle
    card image. Used so the /draw endpoint never blocks on image gen."""
    if not oracle_image_gen:
        return
    try:
        images = await oracle_image_gen.generate_images(
            prompt=image_prompt,
            model="gpt-image-1",
            number_of_images=1,
        )
        if images and len(images) > 0:
            image_base64 = base64.b64encode(images[0]).decode("utf-8")
            await db.oracle_card_images.update_one(
                {"card_name": card_name},
                {
                    "$set": {
                        "card_name": card_name,
                        "image_base64": image_base64,
                        "created_at": datetime.now(timezone.utc),
                    }
                },
                upsert=True,
            )
    except Exception as e:
        logging.error(f"[oracle] background image gen failed for {card_name}: {e}")


async def get_or_generate_card_image(card_name: str, image_prompt: str) -> str:
    """Return the cached image for a card immediately. If the card is NOT
    yet cached, kick off generation in the background (fire-and-forget) so
    a future draw of the same card will hit the cache — this /draw call
    returns None (empty image) so the reading itself lands in <5 seconds.

    This prevents the "endless spinner" bug where a fresh gpt-image-1
    generation blocks the reading for 30-90 seconds and users assume the
    app is broken."""
    cached = await db.oracle_card_images.find_one({"card_name": card_name})
    if cached and cached.get("image_base64"):
        return cached["image_base64"]

    # Not cached — queue a background job. If two draws race, both jobs
    # will upsert to the same key so that's fine.
    if oracle_image_gen and image_prompt:
        try:
            asyncio.create_task(
                _synth_and_cache_card_image(card_name, image_prompt)
            )
        except Exception as e:
            logging.error(f"[oracle] failed to schedule image gen: {e}")
    return None


# Models
class OracleReading(BaseModel):
    card: dict
    interpretation: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class SaveReadingRequest(BaseModel):
    """Persist an oracle reading (single or multi-card) plus its Quantum
    chat history. Only spread_type + cards are strictly required — every
    other field is optional so this model can accept both single-card
    legacy payloads and full multi-card readings."""
    model_config = {"extra": "allow"}

    spread_type: Optional[str] = None
    cards: Optional[List[dict]] = None
    overall_interpretation: Optional[str] = None
    card: Optional[dict] = None            # legacy single-card
    interpretation: Optional[str] = None   # legacy single-card
    chat_history: Optional[List[dict]] = None
    reading_question: Optional[str] = None
    timestamp: Optional[str] = None


class MultiCardDrawRequest(BaseModel):
    spread_type: str = "single"
    card_count: int = 1
    positions: List[str] = ["Guidance"]


# ---------------------------------------------------------------------------
# LLM interpretation helpers
# ---------------------------------------------------------------------------
# Voice used across every reading. This is the persona the model channels.
_ORACLE_VOICE = (
    "You are Madame Sable, a seasoned oracle-card reader who has spent forty "
    "years reading for seekers in a candlelit parlour. You do not lecture. "
    "You do not moralise. You *see* and you *speak*. Your voice is warm, "
    "unhurried, poetic, and specific — as if you are looking directly into "
    "the seeker's eyes across the table. You address the seeker as 'you' and "
    "occasionally as 'dear one'. You use the present tense. You weave "
    "sensory detail (the way a card feels, the way its imagery moves) into "
    "your speaking. You never say 'this card means…' — instead you say what "
    "you SEE, what you FEEL, what the card WHISPERS. You are willing to "
    "name difficulty gently. You never predict fixed outcomes; you speak of "
    "currents, invitations, and doorways. Never mention that you are an AI. "
    "Never break character."
)


async def _single_card_reading(card: dict) -> str:
    """Rich narrative reading for a single-card draw (~150 words)."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"oracle-{uuid.uuid4()}",
            system_message=(
                _ORACLE_VOICE
                + " For a single-card draw, speak in one flowing passage of "
                "roughly 150–180 words. Begin by describing what you notice "
                "as the card turns face-up. Move through what the imagery "
                "and element are whispering to the seeker's present moment. "
                "Close with a specific, poetic invitation for the next step "
                "the seeker can take today or tonight. Do NOT use headings, "
                "bullet points, or the word 'meaning'. Just speak."
            ),
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = (
            f"The card that has turned for the seeker is '{card['name']}', "
            f"an oracle of {card['element']}. Its keeper is described as: "
            f"'{card['description']}'. Speak now, Madame Sable."
        )
        return await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logging.error(f"[oracle] single-card interpretation error: {e}")
        return (
            f"The {card['name']} turns for you, and its {card['element']} "
            f"breath fills the room. {card['description']} Sit with this a "
            "moment, dear one — the card has come for a reason only you can "
            "name."
        )


async def _per_card_reading(card: dict, position: str, spread_name: str) -> str:
    """Narrative reading for one card WITHIN a larger spread (~110 words).
    Written so each card's voice can later be woven into the overall
    story."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"oracle-{uuid.uuid4()}",
            system_message=(
                _ORACLE_VOICE
                + f" Right now you are turning the '{position}' card of a "
                f"{spread_name} spread. Speak in one flowing passage of "
                "roughly 110–140 words that stays inside this card's "
                "meaning for THIS position. Do not summarise the whole "
                "reading — that comes later. Do not use headings or bullets."
            ),
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = (
            f"The card in the '{position}' position is '{card['name']}', an "
            f"oracle of {card['element']}. Its keeper: '{card['description']}'."
            " Speak now, Madame Sable — but only about this position."
        )
        return await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logging.error(f"[oracle] per-card interpretation error: {e}")
        return (
            f"In the {position}, the {card['name']} lifts its "
            f"{card['element']} light. {card['description']} This is what "
            "wants your attention here."
        )


async def _overall_reading(cards_result: list, spread_name: str) -> str:
    """One long, story-woven narrative that ties EVERY card of the spread
    into a single unfolding tale (~280–380 words)."""
    if len(cards_result) < 2:
        return ""
    try:
        lines = []
        for entry in cards_result:
            c = entry["card"]
            lines.append(
                f"• {entry['position']}: {c['name']} ({c['element']}) — "
                f"{c['description']}"
            )
        card_block = "\n".join(lines)

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"oracle-overall-{uuid.uuid4()}",
            system_message=(
                _ORACLE_VOICE
                + " Now you set your hand over all the cards on the table and "
                "give the seeker the full story you see in them together. "
                "Write ONE flowing narrative of roughly 280–380 words. Read "
                "the cards LEFT-TO-RIGHT as a journey unfolding in time. "
                "Notice the ELEMENTAL pattern — which elements dominate, "
                "which are missing, what that says about balance. Notice the "
                "PROGRESSION — how one card gives birth to the next. Notice "
                "any TENSION between cards and how the resolution wants to "
                "come. End with a single, specific invitation the seeker can "
                "act on. Do NOT use bullet points, headings, or the word "
                "'meaning'. No card names in bold. Just speak in one warm, "
                "unhurried voice. Weave, do not list."
            ),
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = (
            f"The spread is '{spread_name}'. Here is what the table shows, "
            f"in order:\n\n{card_block}\n\nSpeak now, Madame Sable — the "
            "whole story, told once, from beginning to end."
        )
        return await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logging.error(f"[oracle] overall reading error: {e}")
        return (
            "The cards on the table share a single breath, dear one. Read "
            "them as one story — each an act in a play only you can finish. "
            "Trust what rises when you look at them together."
        )


async def _multi_card_readings_bundle(
    cards: list, positions: list, spread_name: str
) -> tuple[list, str]:
    """Single-call generation of BOTH per-card interpretations AND the
    overall woven vision. Returns `(per_card_texts, overall_text)`.

    On any parsing / API failure we fall back to the old two-step approach
    (parallel per-card + overall) so the /draw endpoint still resolves and
    the seeker never stares at a spinner.
    """
    import json as _json

    card_lines = []
    for i, c in enumerate(cards):
        pos = positions[i] if i < len(positions) else f"Card {i+1}"
        card_lines.append(
            f'{{"index": {i}, "position": "{pos}", "name": "{c["name"]}", '
            f'"element": "{c["element"]}", "keeper": "{c["description"]}"}}'
        )
    card_block = "\n".join(card_lines)

    system = (
        _ORACLE_VOICE
        + " You are producing BOTH the per-card readings AND the overall "
        "vision for a full oracle spread in a single response. Every "
        "reading remains Madame Sable's voice — poetic, warm, never a "
        "lecture. Return ONLY valid JSON — no markdown, no code fences, "
        "no commentary."
    )

    prompt = (
        f"Spread name: {spread_name}. The cards on the table, in order:\n"
        f"{card_block}\n\n"
        "Return valid JSON of exactly this shape:\n"
        '{"cards": ['
        '{"index": 0, "interpretation": "..."}, ...],'
        ' "overall": "..."}'
        "\n\nRules:\n"
        "• `cards[i].interpretation` — 110-140 flowing words, only about that "
        "card in its position. No headings, no bullets, no card names in bold.\n"
        "• `overall` — 280-380 flowing words that read the cards LEFT-TO-RIGHT "
        "as a single unfolding story. Notice which elements dominate, which "
        "are missing, tension between cards and how the resolution wants to "
        "come. End with one specific invitation the seeker can act on. No "
        "headings, no bullets, no lists.\n"
        "• Do not use the phrase 'this card means'.\n"
        "• Do not mention that you are an AI.\n"
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"oracle-bundle-{uuid.uuid4()}",
            system_message=system,
        ).with_model("gemini", "gemini-2.5-flash")

        raw = await chat.send_message(UserMessage(text=prompt))
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
        # Extract outermost JSON object
        import re as _re
        m = _re.search(r"\{[\s\S]*\}", cleaned)
        if not m:
            raise ValueError("No JSON in model response")
        data = _json.loads(m.group(0))

        card_readings = data.get("cards") or []
        by_index = {int(c.get("index", i)): (c.get("interpretation") or "").strip()
                    for i, c in enumerate(card_readings)}

        per_card_texts = [by_index.get(i, "") for i in range(len(cards))]
        overall = (data.get("overall") or "").strip()
        if not overall or not all(per_card_texts):
            raise ValueError("Bundle response missing fields")
        return per_card_texts, overall
    except Exception as e:
        logging.warning(f"[oracle] bundle reading fell back: {e}")
        # Fallback — two-step parallel path (still fast on gemini-2.5-flash)
        per_card_tasks = [
            _per_card_reading(c, positions[i] if i < len(positions) else f"Card {i+1}", spread_name)
            for i, c in enumerate(cards)
        ]
        per_card_texts = await asyncio.gather(*per_card_tasks)
        cards_result_for_overall = [
            {
                "card": cards[i],
                "position": positions[i] if i < len(positions) else f"Card {i+1}",
            }
            for i in range(len(cards))
        ]
        overall = await _overall_reading(cards_result_for_overall, spread_name)
        return list(per_card_texts), overall



@router.post("/draw")
async def draw_oracle_card(request: MultiCardDrawRequest = None):
    """Draw oracle cards and get AI interpretation with AI-generated images."""

    # ---------- Single-card draw ----------
    if request is None or request.card_count == 1:
        card = random.choice(ORACLE_CARDS)
        image_base64 = await get_or_generate_card_image(
            card["name"], card.get("image_prompt", "")
        )
        card_with_image = {**card, "image_base64": image_base64}

        interpretation = await _single_card_reading(card)
        return {
            "spread_type": "single",
            "cards": [
                {
                    "card": card_with_image,
                    "position": "Guidance",
                    "interpretation": interpretation,
                }
            ],
            "overall_interpretation": "",
            "timestamp": datetime.utcnow().isoformat(),
        }

    # ---------- Multi-card spread ----------
    card_count = min(request.card_count, 10)
    positions = request.positions[:card_count]
    spread_name = (request.spread_type or "spread").replace("_", " ").title()

    drawn_cards = random.sample(ORACLE_CARDS, min(card_count, len(ORACLE_CARDS)))

    async def get_card_with_image(card):
        image_base64 = await get_or_generate_card_image(
            card["name"], card.get("image_prompt", "")
        )
        return {**card, "image_base64": image_base64}

    cards_with_images = await asyncio.gather(
        *[get_card_with_image(card) for card in drawn_cards]
    )

    # Per-card readings + overall woven story ALL come back in a single
    # structured JSON call — this cuts a whole second round-trip vs the old
    # "per-card in parallel THEN overall" pattern and drops end-to-end draw
    # time from ~25s to ~5-8s for a 3-card spread.
    positions_for_llm = [
        positions[i] if i < len(positions) else f"Card {i + 1}"
        for i in range(len(cards_with_images))
    ]
    interpretations, overall = await _multi_card_readings_bundle(
        cards_with_images, positions_for_llm, spread_name
    )

    cards_result = []
    for i, (card, interpretation) in enumerate(
        zip(cards_with_images, interpretations)
    ):
        position = positions_for_llm[i]
        cards_result.append(
            {
                "card": card,
                "position": position,
                "interpretation": interpretation,
            }
        )

    return {
        "spread_type": request.spread_type,
        "cards": cards_result,
        "overall_interpretation": overall,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/save")
async def save_oracle_reading(reading: SaveReadingRequest, request: Request):
    """Save an oracle reading (including Quantum chat history) to the DB.
    Returns the generated `reading_id` so the client can later PATCH the
    chat_history when the user keeps chatting after saving."""
    reading_dict = reading.model_dump(exclude_none=True)
    reading_dict.setdefault("chat_history", [])
    reading_dict["_id"] = str(uuid.uuid4())
    reading_dict["saved_at"] = datetime.utcnow().isoformat()
    try:
        user = await get_current_user(request)
        reading_dict["user_id"] = user["user_id"]
    except HTTPException:
        pass  # allow anonymous saves too
    except Exception as e:
        logging.error(f"Error resolving user during save: {e}")

    try:
        await db.oracle_readings.insert_one(reading_dict)
        return {
            "success": True,
            "message": "Reading saved",
            "reading_id": reading_dict["_id"],
        }
    except Exception as e:
        logging.error(f"Error saving reading: {e}")
        raise HTTPException(status_code=500, detail="Failed to save reading")


class ChatPatchRequest(BaseModel):
    """Append one user→assistant exchange to a saved reading's chat log."""
    user_text: str
    assistant_text: str


@router.patch("/readings/{reading_id}/chat")
async def append_chat_to_reading(
    reading_id: str, body: ChatPatchRequest, request: Request
):
    """Append the latest Quantum exchange to a saved reading. Users may
    only patch their own readings (or anonymous readings)."""
    if not body.user_text.strip() or not body.assistant_text.strip():
        raise HTTPException(status_code=400, detail="Empty chat exchange")

    query: dict = {"_id": reading_id}
    try:
        user = await get_current_user(request)
        # Restrict to caller's own readings; anonymous saves have no user_id.
        query = {
            "_id": reading_id,
            "$or": [{"user_id": user["user_id"]}, {"user_id": {"$exists": False}}],
        }
    except HTTPException:
        # Anonymous callers can only patch anonymous readings.
        query = {"_id": reading_id, "user_id": {"$exists": False}}

    now = datetime.utcnow().isoformat()
    result = await db.oracle_readings.update_one(
        query,
        {
            "$push": {
                "chat_history": {
                    "$each": [
                        {"role": "user", "text": body.user_text.strip(), "at": now},
                        {
                            "role": "assistant",
                            "text": body.assistant_text.strip(),
                            "at": now,
                        },
                    ]
                }
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reading not found")
    return {"success": True}


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


# ---------------------------------------------------------------------------
# Quantum AI — follow-up chat about a reading
# ---------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    text: str


class OracleChatRequest(BaseModel):
    """A user question about an active reading. The frontend passes the full
    reading + chat history each turn so the backend stays stateless."""
    reading: dict
    history: List[ChatMessage] = Field(default_factory=list)
    question: str


_QUANTUM_VOICE = (
    "You are Quantum, the deeper intelligence that lives behind every oracle "
    "reading. Where Madame Sable speaks the poetry of the cards, you speak "
    "the pattern beneath them — the geometry of causes, the currents of "
    "probability, the way one choice ripples through every future self. You "
    "have already reviewed the reading the seeker holds in their hands. When "
    "they ask a question, you draw ONLY from the cards they were given, the "
    "positions those cards occupy, and the elemental interplay between them. "
    "You do not draw new cards. You do not predict fixed outcomes. You "
    "reveal what is ALREADY encoded in the spread and give the seeker a "
    "specific way to work with it. Your voice is calm, precise, warm, and "
    "unhurried. You speak in ordinary language shot through with occasional "
    "cosmic imagery. Never use markdown, headings, bullet points, or the "
    "word 'meaning'. Never break character. Keep every answer under 220 "
    "words unless the seeker explicitly asks for depth."
)


def _serialise_reading(reading: dict) -> str:
    """Turn the reading dict into a compact text block the model can see."""
    lines = []
    spread = reading.get("spread_type", "reading")
    lines.append(f"Spread: {spread}")
    for c in reading.get("cards", []):
        card = c.get("card", {})
        lines.append(
            f"[{c.get('position')}] {card.get('name')} ({card.get('element')}) "
            f"— {card.get('description')}"
        )
        interp = (c.get("interpretation") or "").strip()
        if interp:
            lines.append(f"   Madame Sable said: {interp}")
    overall = (reading.get("overall_interpretation") or "").strip()
    if overall:
        lines.append("")
        lines.append(f"Overall vision: {overall}")
    return "\n".join(lines)


@router.post("/chat")
async def oracle_chat(body: OracleChatRequest):
    """Follow-up conversation with the Quantum AI about a completed reading."""
    if not body.question or not body.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    if not body.reading or not body.reading.get("cards"):
        raise HTTPException(
            status_code=400, detail="An active reading is required for chat"
        )
    reading_block = _serialise_reading(body.reading)

    # Fold the multi-turn history into the user's message. Emergent LLM
    # sessions are ephemeral per call, so we embed the transcript inline —
    # this is the standard emergentintegrations pattern.
    transcript_lines = []
    for turn in body.history[-8:]:  # last 8 turns keeps context manageable
        role = "Seeker" if turn.role == "user" else "Quantum"
        transcript_lines.append(f"{role}: {turn.text}")
    transcript = "\n".join(transcript_lines)

    prompt_parts = [
        "The reading currently on the table:",
        "",
        reading_block,
    ]
    if transcript:
        prompt_parts += [
            "",
            "The conversation so far:",
            transcript,
        ]
    prompt_parts += [
        "",
        f"The seeker now asks: {body.question.strip()}",
        "",
        "Answer them now, Quantum — grounded in the cards above, in "
        "flowing prose, no headings, no bullets.",
    ]

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"oracle-chat-{uuid.uuid4()}",
            system_message=_QUANTUM_VOICE,
        ).with_model("gemini", "gemini-2.5-flash")

        response_text = await chat.send_message(
            UserMessage(text="\n".join(prompt_parts))
        )
        # Strip any stray markdown
        cleaned = response_text.replace("**", "").replace("##", "").strip()
        return {"response": cleaned}
    except Exception as e:
        logging.error(f"[oracle chat] failed: {e}")
        raise HTTPException(
            status_code=502,
            detail="Quantum is momentarily out of reach. Please try again.",
        )



# ---------------------------------------------------------------------------
# Quantum voice — ElevenLabs TTS for Quantum's replies
# ---------------------------------------------------------------------------
# A resonant, calm, slightly authoritative voice fits Quantum's persona.
# Adam — deep male voice — is a natural choice and is distinct from the
# reader/reprogramming voices already in use in the app.
_QUANTUM_VOICE_ID = "pNInz6obpgDQGcFmaJgB"  # Adam
_QUANTUM_VOICE_CFG = {
    "voice": _QUANTUM_VOICE_ID,
    "openai_voice": "onyx",
    "stability": 0.55,
    "style": 0.35,
    "speed": 0.95,
}

_TTS_MAX_CHARS = 2000  # safety cap per synthesis


class TTSRequest(BaseModel):
    text: str


@router.post("/tts")
async def quantum_tts(body: TTSRequest):
    """Synthesise a Quantum reply into an MP3 the client can play. Returns
    audio/mpeg with a correct Content-Length header so native players can
    seek. Trims text to a safe length so accidental huge inputs don't burn
    the whole ElevenLabs quota."""
    from .deps import tts_with_fallback

    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    if len(text) > _TTS_MAX_CHARS:
        text = text[:_TTS_MAX_CHARS].rsplit(" ", 1)[0] + "…"

    audio_bytes = await tts_with_fallback(text, _QUANTUM_VOICE_CFG)
    if not audio_bytes:
        raise HTTPException(
            status_code=502,
            detail="Voice synthesis is temporarily unavailable.",
        )

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Length": str(len(audio_bytes)),
            "Cache-Control": "no-store",
        },
    )
