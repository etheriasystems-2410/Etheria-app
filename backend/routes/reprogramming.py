"""
Reprogramming — pre-written self-hypnosis + subliminal audio sessions.

Design
------
• 12 curated topics (see SESSIONS below).
• Two are FREE: `deep-sleep`, `confidence` — the rest are Premium.
• Scripts are hand-written (see /app/backend/data/reprogramming_scripts.py)
  and never LLM-generated at request time.
• Narration is synthesised with ElevenLabs (rich emotional inflection) and
  cached to disk at /app/backend/data/reprogramming_audio/{session_id}.mp3
  so we only pay the TTS cost once per topic.
• Audio is a base ~10-minute narration; the frontend loops it and uses a
  gentle fade-out sleep timer to reach the user's chosen duration (10, 20,
  30, or 60 minutes).
• Delivery: /api/reprogramming/audio/{session_id} returns the cached MP3
  with a correct Content-Length header so native expo-audio can seek/loop.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

# Make the parent /app/backend importable so we can pull the scripts module.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from data.reprogramming_scripts import build_full_script, TOPIC_BODIES  # noqa: E402
from routes.auth import get_current_user  # noqa: E402
from routes.deps import elevenlabs_tts, tts_with_fallback  # noqa: E402


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reprogramming", tags=["reprogramming"])


# ---------------------------------------------------------------------------
# Session catalog
# ---------------------------------------------------------------------------
# The two sessions listed in FREE_SESSIONS are unlocked for all users; the
# rest require an active Premium subscription. Admin/lifetime users
# (is_premium=True) get everything automatically.
FREE_SESSIONS = {"deep-sleep", "confidence"}

# All available session slugs must match keys in TOPIC_BODIES.
SESSIONS = [
    {
        "id": "deep-sleep",
        "title": "Deep Sleep",
        "subtitle": "Drift into effortless rest",
        "icon": "moon",
        "color": "#7c3aed",
        "category": "sleep",
    },
    {
        "id": "confidence",
        "title": "Deep Confidence",
        "subtitle": "Anchor unshakable self-belief",
        "icon": "flame",
        "color": "#f59e0b",
        "category": "mindset",
    },
    {
        "id": "quit-smoking",
        "title": "Quit Smoking",
        "subtitle": "Release the urge, breathe freely",
        "icon": "cloud",
        "color": "#94a3b8",
        "category": "habits",
    },
    {
        "id": "weight-loss",
        "title": "Weight Loss",
        "subtitle": "Align with your natural body wisdom",
        "icon": "leaf",
        "color": "#10b981",
        "category": "habits",
    },
    {
        "id": "release-anxiety",
        "title": "Release Anxiety",
        "subtitle": "Return to calm and safety",
        "icon": "water",
        "color": "#06b6d4",
        "category": "healing",
    },
    {
        "id": "abundance",
        "title": "Abundance Mindset",
        "subtitle": "Open to prosperity",
        "icon": "diamond",
        "color": "#fbbf24",
        "category": "mindset",
    },
    {
        "id": "self-love",
        "title": "Self Love",
        "subtitle": "Come home to your heart",
        "icon": "heart",
        "color": "#ec4899",
        "category": "healing",
    },
    {
        "id": "focus",
        "title": "Laser Focus",
        "subtitle": "Master flow states",
        "icon": "eye",
        "color": "#a855f7",
        "category": "mindset",
    },
    {
        "id": "release-fear",
        "title": "Release Fear",
        "subtitle": "Move forward with courage",
        "icon": "shield",
        "color": "#ef4444",
        "category": "healing",
    },
    {
        "id": "manifest-love",
        "title": "Manifest Love",
        "subtitle": "Open to soulful connection",
        "icon": "rose",
        "color": "#f472b6",
        "category": "manifestation",
    },
    {
        "id": "healing-body",
        "title": "Whole-Body Healing",
        "subtitle": "Activate your body's wisdom",
        "icon": "medical",
        "color": "#22c55e",
        "category": "healing",
    },
    {
        "id": "release-past",
        "title": "Release the Past",
        "subtitle": "Free yourself from old chains",
        "icon": "leaf-outline",
        "color": "#a3a3a3",
        "category": "healing",
    },
]

# Runtime enrichment so callers know pricing tier and estimated length.
for _s in SESSIONS:
    _s["is_free"] = _s["id"] in FREE_SESSIONS
    _s["is_premium"] = _s["id"] not in FREE_SESSIONS
    _s["duration_minutes"] = 10  # base narration length (frontend loops for longer)

SESSIONS_BY_ID = {s["id"]: s for s in SESSIONS}

# Duration presets (in minutes) the client is allowed to request as sleep-timer.
DURATION_PRESETS = [10, 20, 30, 45, 60]

# ---------------------------------------------------------------------------
# Audio cache
# ---------------------------------------------------------------------------
AUDIO_CACHE_DIR = _BACKEND_ROOT / "data" / "reprogramming_audio"
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Preferred ElevenLabs voice for hypnosis narration.
# Sarah — mature, reassuring feminine voice (existing spirit-guide voice).
DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"
DEFAULT_VOICE_CFG = {
    "voice": DEFAULT_VOICE_ID,
    "openai_voice": "nova",   # fallback if ElevenLabs is unavailable
    "stability": 0.65,        # higher = more consistent, less dynamic (good for hypnosis)
    "style": 0.30,            # low style = less expressive, more calming
    "speed": 0.85,            # slower cadence
}


def _cache_path_for(session_id: str) -> Path:
    """Return the on-disk cache path for a session's base narration MP3."""
    safe = hashlib.sha1(f"{session_id}|{DEFAULT_VOICE_ID}".encode()).hexdigest()[:16]
    return AUDIO_CACHE_DIR / f"{session_id}_{safe}.mp3"


async def _synthesise_and_cache(session_id: str) -> bytes:
    """Synthesise the full narration for `session_id` and cache to disk.
    Returns raw MP3 bytes."""
    if session_id not in TOPIC_BODIES:
        raise HTTPException(status_code=404, detail=f"Unknown session '{session_id}'")

    cache_path = _cache_path_for(session_id)
    if cache_path.exists() and cache_path.stat().st_size > 4096:
        return cache_path.read_bytes()

    script = build_full_script(session_id)
    logger.info(
        "[Reprogramming] Synthesising narration for '%s' (%d chars) via ElevenLabs…",
        session_id,
        len(script),
    )

    audio_bytes = await tts_with_fallback(script, DEFAULT_VOICE_CFG)
    if not audio_bytes:
        raise HTTPException(
            status_code=502,
            detail="Voice synthesis is temporarily unavailable. Please try again shortly.",
        )

    # Persist to cache (atomic-ish write via tmp file)
    tmp = cache_path.with_suffix(cache_path.suffix + ".tmp")
    tmp.write_bytes(audio_bytes)
    tmp.replace(cache_path)
    logger.info(
        "[Reprogramming] Cached %d bytes → %s", len(audio_bytes), cache_path.name
    )
    return audio_bytes


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/sessions")
async def list_sessions(request: Request):
    """List all reprogramming sessions. Adds per-user `locked` flag if the
    caller is authenticated (based on is_premium)."""
    is_premium = False
    try:
        user = await get_current_user(request)
        is_premium = bool(user.get("is_premium"))
    except HTTPException:
        # Public listing is fine — unauthenticated users see all locks
        pass

    sessions_out = []
    for s in SESSIONS:
        sessions_out.append(
            {
                **s,
                "locked": (not s["is_free"]) and (not is_premium),
            }
        )

    return {
        "sessions": sessions_out,
        "categories": sorted({s["category"] for s in SESSIONS}),
        "free_session_ids": sorted(FREE_SESSIONS),
        "duration_presets": DURATION_PRESETS,
        "voice_provider": "elevenlabs" if elevenlabs_tts.enabled else "openai",
        "is_premium": is_premium,
    }


@router.get("/session/{session_id}")
async def session_detail(session_id: str, request: Request):
    """Return metadata for a single session (public info)."""
    session = SESSIONS_BY_ID.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Unknown session")

    is_premium = False
    try:
        user = await get_current_user(request)
        is_premium = bool(user.get("is_premium"))
    except HTTPException:
        pass

    return {
        **session,
        "locked": (not session["is_free"]) and (not is_premium),
        "duration_presets": DURATION_PRESETS,
    }


def _ensure_access(session: dict, user_doc: dict) -> None:
    """Raise 402 if the user does not have access to `session`."""
    if session["is_free"]:
        return
    if user_doc.get("is_premium"):
        return
    raise HTTPException(
        status_code=402,
        detail={
            "message": "This reprogramming session requires an Etheria Premium subscription.",
            "session_id": session["id"],
            "requires_premium": True,
        },
    )


@router.get("/audio/{session_id}")
async def stream_audio(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Return the cached narration MP3 for a session, with Content-Length so
    native expo-audio can seek and loop. Generates + caches on first hit."""
    session = SESSIONS_BY_ID.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Unknown session")

    _ensure_access(session, user)

    audio_bytes = await _synthesise_and_cache(session_id)

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Length": str(len(audio_bytes)),
            "Content-Disposition": f'inline; filename="reprogramming_{session_id}.mp3"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.get("/audio-base64/{session_id}")
async def audio_base64(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Return the cached narration MP3 as base64 (for clients that cannot
    stream large HTTPS responses via authenticated fetch)."""
    session = SESSIONS_BY_ID.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Unknown session")

    _ensure_access(session, user)

    audio_bytes = await _synthesise_and_cache(session_id)

    return {
        "session_id": session_id,
        "title": session["title"],
        "subtitle": session["subtitle"],
        "audio_base64": base64.b64encode(audio_bytes).decode(),
        "format": "mp3",
        "byte_length": len(audio_bytes),
        "duration_presets": DURATION_PRESETS,
    }


@router.post("/warm-cache")
async def warm_cache(user: dict = Depends(get_current_user)):
    """Admin-only: pre-synthesise every session so first-user latency is zero.
    Handy after deploying a new script."""
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    results = {}
    for s in SESSIONS:
        sid = s["id"]
        try:
            data = await _synthesise_and_cache(sid)
            results[sid] = {"ok": True, "bytes": len(data)}
        except HTTPException as e:
            results[sid] = {"ok": False, "error": str(e.detail)}
        except Exception as e:
            results[sid] = {"ok": False, "error": str(e)}

    return {"results": results, "cache_dir": str(AUDIO_CACHE_DIR)}
