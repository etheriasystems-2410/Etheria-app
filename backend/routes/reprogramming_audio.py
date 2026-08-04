"""
Reprogramming session audio — dedicated pool of 5 hypnotic / trance MP3s.

Unlike the meditation ambient library (which is user-selectable), these
tracks are randomly assigned by the server on every session and looped
under the voice-guided reprogramming script for the user's chosen
duration.

Returned payload includes BPM so the frontend can drive Light Therapy
beat-sync, mandala pulse, and subliminal-flash timing off the same
tempo — everything visually and rhythmically flows with the audio.
"""
from __future__ import annotations

import random
from typing import Dict, List

from fastapi import APIRouter

router = APIRouter(prefix="/reprogramming", tags=["reprogramming-audio"])


# ── Curated pool. Each track advertises a BPM so downstream light/visual
#    effects can synchronise. BPMs are informed estimates for
#    trance/hypnotic-techno cuts (typically 110–140 BPM).
_ASSET_BASE = (
    "https://customer-assets-gfyr7b9c.emergentagent.net/"
    "job_a75d84fa-0948-4f28-9189-c803d31a5037/artifacts/"
)
SESSION_TRACKS: List[Dict] = [
    {
        "id": "state-of-trance",
        "name": "State of Trance",
        "url": _ASSET_BASE + "slhsnz2m_natureseye-state-of-trance-448131_1.mp3",
        "bpm": 138,
    },
    {
        "id": "razor-dark-techno",
        "name": "Razor Dark Techno",
        "url": _ASSET_BASE + "djiykr7a_musinova-razor-dark-hypnotic-techno-357456_1.mp3",
        "bpm": 130,
    },
    {
        "id": "hypnotic-sway",
        "name": "Hypnotic Sway",
        "url": _ASSET_BASE + "bye7o1pq_maison_brava-hypnotic-sway-403494_1.mp3",
        "bpm": 110,
    },
    {
        "id": "electric-horizons",
        "name": "Electric Horizons",
        "url": _ASSET_BASE + "8s2x338o_hypnotic-frequencies-electric-horizons-1-320190_1.mp3",
        "bpm": 128,
    },
    {
        "id": "dancing-through-infinity",
        "name": "Dancing Through Infinity",
        "url": _ASSET_BASE + "6evkb3w5_hypnotic-frequencies-dancing-through-infinity-320185_1.mp3",
        "bpm": 128,
    },
]


@router.get("/session-audio")
async def get_session_audio() -> Dict:
    """Return one randomly-selected session audio track for a new
    reprogramming session. The frontend loops it (with a fade-out on
    session end) and drives the light-therapy + mandala pulse from the
    returned BPM."""
    pick = random.choice(SESSION_TRACKS)
    return {
        "id": pick["id"],
        "name": pick["name"],
        "url": pick["url"],
        "bpm": pick["bpm"],
        "loop": True,
    }
