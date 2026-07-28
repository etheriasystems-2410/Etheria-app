"""
Ambient Music Library — synthesized on-the-fly ambient loops that can be
layered UNDER a binaural or chakra tone. Each track streams as a WAV so
front-end AudioPlayerManager can loop it seamlessly.

Design goals
------------
• Server-side synthesis — no MP3 assets to bundle or license.
• All tracks are pure-tone / band-noise textures with slow amplitude modulation
  so they *complement* the primary tone rather than mask it.
• Cache-friendly: identical (id, duration) requests return the same bytes.

Tracks (id → description)
-------------------------
deep-space      — low C-minor drone pad (65/97/117 Hz detuned sines)
forest-breeze   — filtered pink noise + slow LFO (mimics wind)
ocean-waves     — low-pass noise with 0.08 Hz amplitude sweep
gentle-rain     — steady high-passed noise
tibetan-bowl    — 220 Hz fundamental with rich detuned harmonics
cosmic-drift    — three stacked pads with slow beating (0.3 / 0.6 / 1.1 Hz)
"""
from __future__ import annotations

import io
import logging
from functools import lru_cache
from typing import Dict, List

import numpy as np
from fastapi import APIRouter, HTTPException, Response
from scipy.io import wavfile
from scipy.signal import butter, filtfilt


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/meditation/ambient", tags=["meditation-ambient"])

SAMPLE_RATE = 44_100
DEFAULT_LOOP_SECONDS = 30  # each track streams as a 30 s seamless loop
MAX_LOOP_SECONDS = 60


# ---------------------------------------------------------------------------
# Track catalogue
# ---------------------------------------------------------------------------
# Some tracks are *synthesized* on the fly (no `url`); others are *external*
# and stream directly from a CDN. The frontend prefers `url` when present.
TRACKS: Dict[str, Dict] = {
    # ── External MP3 tracks (used as the random default under binaural) ──
    "deep-meditation": {
        "name": "Deep Meditation",
        "description": "Warm, spacious meditation soundscape.",
        "category": "meditation",
        "icon": "moon",
        "url": (
            "https://customer-assets-gfyr7b9c.emergentagent.net/"
            "job_a75d84fa-0948-4f28-9189-c803d31a5037/artifacts/"
            "829hjrmw_leberch-deep-meditation-375362_1.MP3"
        ),
        "default_for": ["binaural"],
        "default_volume": 0.22,
        "loop": True,
    },
    "cosmic-meditation": {
        "name": "Cosmic Meditation",
        "description": "Expansive cosmic pad — perfect binaural bed.",
        "category": "meditation",
        "icon": "sparkles",
        "url": (
            "https://customer-assets-gfyr7b9c.emergentagent.net/"
            "job_a75d84fa-0948-4f28-9189-c803d31a5037/artifacts/"
            "91pozu6x_miromaxmusic-cosmic-meditation-4.MP3"
        ),
        "default_for": ["binaural"],
        "default_volume": 0.22,
        "loop": True,
    },
    # ── Synthesized on-the-fly loops ──
    "deep-space": {
        "name": "Deep Space",
        "description": "Low C-minor drone pad — grounding cosmic depth.",
        "category": "cosmic",
        "icon": "planet",
    },
    "forest-breeze": {
        "name": "Forest Breeze",
        "description": "Wind through trees, gentle and organic.",
        "category": "nature",
        "icon": "leaf",
    },
    "ocean-waves": {
        "name": "Ocean Waves",
        "description": "Slow rolling surf, deeply calming.",
        "category": "nature",
        "icon": "water",
    },
    "gentle-rain": {
        "name": "Gentle Rain",
        "description": "Steady soothing rainfall.",
        "category": "nature",
        "icon": "rainy",
    },
    "tibetan-bowl": {
        "name": "Tibetan Bowl",
        "description": "Resonant singing-bowl harmonic pad.",
        "category": "sacred",
        "icon": "musical-notes",
    },
    "cosmic-drift": {
        "name": "Cosmic Drift",
        "description": "Slowly beating pad — floating meditation.",
        "category": "cosmic",
        "icon": "sparkles",
    },
}


# ---------------------------------------------------------------------------
# Encoding helpers
# ---------------------------------------------------------------------------
def _normalise(sig: np.ndarray, peak: float = 0.7) -> np.ndarray:
    m = float(np.max(np.abs(sig))) if sig.size else 1.0
    if m < 1e-9:
        return sig
    return sig * (peak / m)


def _to_stereo(mono_or_stereo: np.ndarray) -> np.ndarray:
    if mono_or_stereo.ndim == 1:
        return np.column_stack((mono_or_stereo, mono_or_stereo))
    return mono_or_stereo


def _wav_bytes(sig: np.ndarray) -> bytes:
    stereo = _to_stereo(_normalise(sig, 0.72)).astype(np.float32)
    int16 = np.clip(stereo * 32767.0, -32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, int16)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Track synthesizers — each returns a stereo float32 array (samples, 2)
# ---------------------------------------------------------------------------
def _t_axis(duration: float) -> np.ndarray:
    n = int(SAMPLE_RATE * duration)
    return np.linspace(0.0, duration, n, endpoint=False, dtype=np.float32)


def _lp_noise(duration: float, cutoff_hz: float, rng: np.random.Generator) -> np.ndarray:
    n = int(SAMPLE_RATE * duration)
    noise = rng.standard_normal(n).astype(np.float32)
    nyq = SAMPLE_RATE / 2
    b, a = butter(4, min(cutoff_hz / nyq, 0.99), btype="low")
    return filtfilt(b, a, noise).astype(np.float32)


def _hp_noise(duration: float, cutoff_hz: float, rng: np.random.Generator) -> np.ndarray:
    n = int(SAMPLE_RATE * duration)
    noise = rng.standard_normal(n).astype(np.float32)
    nyq = SAMPLE_RATE / 2
    b, a = butter(4, min(cutoff_hz / nyq, 0.99), btype="high")
    return filtfilt(b, a, noise).astype(np.float32)


def _pink_noise(duration: float, rng: np.random.Generator) -> np.ndarray:
    """Voss algorithm approximation via cumulative filter — ~1/f roll-off."""
    n = int(SAMPLE_RATE * duration)
    white = rng.standard_normal(n).astype(np.float32)
    # Simple 1-pole filter approximating pink noise
    b = np.array([0.049922035, -0.095993537, 0.050612699, -0.004408786], dtype=np.float32)
    a = np.array([1.0, -2.494956002, 2.017265875, -0.522189400], dtype=np.float32)
    from scipy.signal import lfilter
    return lfilter(b, a, white).astype(np.float32)


def _seamless_edges(sig: np.ndarray, fade_seconds: float = 1.0) -> np.ndarray:
    """Crossfade start/end so a looped playback is seamless."""
    n = sig.shape[0]
    fade = int(fade_seconds * SAMPLE_RATE)
    if fade <= 0 or fade * 2 >= n:
        return sig
    ramp_in = np.linspace(0.0, 1.0, fade, dtype=np.float32)
    ramp_out = np.linspace(1.0, 0.0, fade, dtype=np.float32)
    if sig.ndim == 2:
        ramp_in = ramp_in[:, None]
        ramp_out = ramp_out[:, None]
    out = sig.copy()
    out[:fade] = sig[:fade] * ramp_in + sig[-fade:] * ramp_out
    out[-fade:] *= ramp_out
    return out


def _synth_deep_space(duration: float) -> np.ndarray:
    t = _t_axis(duration)
    # C minor: root 65.4 Hz, minor third 78, fifth 97.9. Detune slightly for
    # richness. Add slow LFO on amplitude.
    fund = np.sin(2 * np.pi * 65.4 * t)
    third = np.sin(2 * np.pi * 78.0 * t + 0.4) * 0.7
    fifth = np.sin(2 * np.pi * 97.9 * t + 1.1) * 0.6
    detune = np.sin(2 * np.pi * 65.9 * t) * 0.35
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t)
    left = (fund + third * 0.9 + detune) * lfo
    right = (fund + fifth + detune * 0.8) * lfo
    stereo = np.column_stack((left, right)).astype(np.float32)
    return _seamless_edges(stereo, 2.0)


def _synth_forest_breeze(duration: float) -> np.ndarray:
    rng = np.random.default_rng(2026)
    left = _lp_noise(duration, 900, rng)
    right = _lp_noise(duration, 900, rng)
    t = _t_axis(duration)
    # Wind-gust LFO envelope
    env = 0.55 + 0.45 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.08 * t + 0.3))
    stereo = np.column_stack((left * env, right * env)).astype(np.float32)
    return _seamless_edges(stereo, 2.0)


def _synth_ocean_waves(duration: float) -> np.ndarray:
    rng = np.random.default_rng(1618)
    base = _lp_noise(duration, 1_200, rng)
    other = _lp_noise(duration, 1_200, rng)
    t = _t_axis(duration)
    # Roll rhythm ~ every 6 seconds
    swell = 0.5 + 0.5 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.16 * t))
    swell = swell ** 1.5  # sharper crest
    left = base * swell
    right = other * swell
    stereo = np.column_stack((left, right)).astype(np.float32)
    return _seamless_edges(stereo, 2.0)


def _synth_gentle_rain(duration: float) -> np.ndarray:
    rng = np.random.default_rng(7331)
    left = _hp_noise(duration, 1_500, rng) * 0.75
    right = _hp_noise(duration, 1_500, rng) * 0.75
    stereo = np.column_stack((left, right)).astype(np.float32)
    return _seamless_edges(stereo, 2.0)


def _synth_tibetan_bowl(duration: float) -> np.ndarray:
    t = _t_axis(duration)
    fund = 220.0
    # A stack of detuned harmonics with slow beating.
    partials = [
        (1.00, 1.00, 0.0),
        (1.005, 0.55, 0.6),  # slight detune → shimmer
        (2.01, 0.35, 0.2),
        (2.98, 0.25, 1.1),
        (4.02, 0.18, 0.5),
        (5.99, 0.12, 0.9),
    ]
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    for ratio, amp, phase in partials:
        left += amp * np.sin(2 * np.pi * fund * ratio * t + phase)
        right += amp * np.sin(2 * np.pi * fund * ratio * t + phase + 0.15)
    lfo = 0.55 + 0.45 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t))
    stereo = np.column_stack((left * lfo, right * lfo)).astype(np.float32)
    return _seamless_edges(stereo, 2.0)


def _synth_cosmic_drift(duration: float) -> np.ndarray:
    t = _t_axis(duration)
    pads = [
        (130.8, 0.30),  # C3
        (196.0, 0.28),  # G3
        (261.6, 0.24),  # C4
    ]
    beats = [0.30, 0.60, 1.10]  # subtle amplitude beating on each pad
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    for (freq, amp), beat in zip(pads, beats):
        lfo = 0.6 + 0.4 * np.sin(2 * np.pi * beat * t)
        left += amp * np.sin(2 * np.pi * freq * t) * lfo
        right += amp * np.sin(2 * np.pi * (freq * 1.003) * t) * lfo
    stereo = np.column_stack((left, right)).astype(np.float32)
    return _seamless_edges(stereo, 2.0)


SYNTHESIZERS = {
    "deep-space": _synth_deep_space,
    "forest-breeze": _synth_forest_breeze,
    "ocean-waves": _synth_ocean_waves,
    "gentle-rain": _synth_gentle_rain,
    "tibetan-bowl": _synth_tibetan_bowl,
    "cosmic-drift": _synth_cosmic_drift,
}


# ---------------------------------------------------------------------------
# Rendering cache — same (id, duration) returns the same bytes.
# ---------------------------------------------------------------------------
@lru_cache(maxsize=32)
def _render_wav(track_id: str, duration: int) -> bytes:
    if track_id not in SYNTHESIZERS:
        raise KeyError(track_id)
    duration = max(5, min(int(duration), MAX_LOOP_SECONDS))
    sig = SYNTHESIZERS[track_id](float(duration))
    return _wav_bytes(sig)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/tracks")
async def list_tracks() -> List[Dict]:
    """List all curated built-in ambient tracks."""
    return [
        {"id": tid, **meta}
        for tid, meta in TRACKS.items()
    ]


@router.get("/defaults/{context}")
async def get_defaults(context: str) -> List[Dict]:
    """Return the ambient tracks flagged as defaults for a given context
    (e.g. `binaural`, `chakra`, `reprogramming`). The frontend picks one
    at random from this list on session start when the user has no manual
    selection persisted."""
    context = (context or "").strip().lower()
    return [
        {"id": tid, **meta}
        for tid, meta in TRACKS.items()
        if context in (meta.get("default_for") or [])
    ]


@router.get("/stream/{track_id}")
async def stream_track(track_id: str, duration: int = DEFAULT_LOOP_SECONDS):
    """Stream a curated ambient track. URL-backed tracks 302-redirect to
    the external CDN; synthesized tracks return a rendered WAV inline."""
    meta = TRACKS.get(track_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Unknown ambient track")

    # URL-backed track: redirect the audio client to the CDN URL directly.
    if meta.get("url"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=meta["url"], status_code=302)

    if track_id not in SYNTHESIZERS:
        raise HTTPException(status_code=404, detail="Unknown ambient track")

    try:
        wav = _render_wav(track_id, duration)
    except Exception as e:  # pragma: no cover
        logger.exception("Ambient synth failure: %s", e)
        raise HTTPException(status_code=500, detail="Could not synthesize track")

    return Response(
        content=wav,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"inline; filename=ambient_{track_id}.wav",
            "Content-Length": str(len(wav)),
            "Cache-Control": "public, max-age=3600",
        },
    )
