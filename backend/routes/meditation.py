"""
Meditation endpoints - Binaural beats, Chakra tones, Ambient sounds, and sessions
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import List, Optional
import uuid
import logging
import io
import base64
import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter, butter, filtfilt

from emergentintegrations.llm.chat import LlmChat, UserMessage
from .deps import db, EMERGENT_LLM_KEY
from .auth_utils import get_current_user

router = APIRouter(prefix="/meditation", tags=["meditation"])

# ==================== CHAKRA DATA ====================
CHAKRA_DATA = {
    "root": {
        "name": "Root Chakra (Muladhara)",
        "sanskrit": "Muladhara",
        "frequency": 396,
        "color": "#dc2626",
        "location": "Base of spine",
        "element": "Earth",
        "benefits": ["Grounding", "Security", "Stability", "Survival instincts"],
        "affirmation": "I am safe, grounded, and secure."
    },
    "sacral": {
        "name": "Sacral Chakra (Svadhisthana)",
        "sanskrit": "Svadhisthana", 
        "frequency": 417,
        "color": "#ea580c",
        "location": "Lower abdomen",
        "element": "Water",
        "benefits": ["Creativity", "Emotions", "Sexuality", "Pleasure"],
        "affirmation": "I embrace my creativity and emotions freely."
    },
    "solar": {
        "name": "Solar Plexus Chakra (Manipura)",
        "sanskrit": "Manipura",
        "frequency": 528,
        "color": "#eab308",
        "location": "Upper abdomen",
        "element": "Fire",
        "benefits": ["Personal power", "Confidence", "Willpower", "Self-esteem"],
        "affirmation": "I am confident, powerful, and in control of my life."
    },
    "heart": {
        "name": "Heart Chakra (Anahata)",
        "sanskrit": "Anahata",
        "frequency": 639,
        "color": "#16a34a",
        "location": "Center of chest",
        "element": "Air",
        "benefits": ["Love", "Compassion", "Forgiveness", "Connection"],
        "affirmation": "I give and receive love freely and unconditionally."
    },
    "throat": {
        "name": "Throat Chakra (Vishuddha)",
        "sanskrit": "Vishuddha",
        "frequency": 741,
        "color": "#0ea5e9",
        "location": "Throat",
        "element": "Ether",
        "benefits": ["Communication", "Expression", "Truth", "Authenticity"],
        "affirmation": "I speak my truth with clarity and confidence."
    },
    "third-eye": {
        "name": "Third Eye Chakra (Ajna)",
        "sanskrit": "Ajna",
        "frequency": 852,
        "color": "#6366f1",
        "location": "Between eyebrows",
        "element": "Light",
        "benefits": ["Intuition", "Wisdom", "Insight", "Imagination"],
        "affirmation": "I trust my intuition and see clearly."
    },
    "crown": {
        "name": "Crown Chakra (Sahasrara)",
        "sanskrit": "Sahasrara",
        "frequency": 963,
        "color": "#9333ea",
        "location": "Top of head",
        "element": "Thought",
        "benefits": ["Spiritual connection", "Enlightenment", "Unity", "Transcendence"],
        "affirmation": "I am connected to the divine and universal consciousness."
    }
}

# ==================== BINAURAL FREQUENCIES ====================
# NOTE: Items 1-3 (Schumann, Delta, Theta) are FREE — they intentionally come
#       first so unsubscribed users see usable options at the top of the list.
#       Premium items follow.
BINAURAL_FREQUENCIES = [
    {
        "id": "schumann",
        "name": "Schumann Resonance",
        "frequency_range": "7.83 Hz",
        "base_frequency": 200,
        "beat_frequency": 7.83,
        "benefits": ["Earth connection", "Grounding", "Natural harmony", "Stress relief"],
        "color": "#10b981",
        "description": "The Earth's natural electromagnetic frequency"
    },
    {
        "id": "delta",
        "name": "Delta (Deep Sleep)",
        "frequency_range": "0.5-4 Hz",
        "base_frequency": 200,
        "beat_frequency": 2,
        "benefits": ["Deep sleep", "Healing", "Pain relief", "Deep relaxation"],
        "color": "#4c1d95",
        "description": "Promotes deep, restorative sleep and physical healing"
    },
    {
        "id": "theta",
        "name": "Theta (Meditation)",
        "frequency_range": "4-8 Hz",
        "base_frequency": 200,
        "beat_frequency": 6,
        "benefits": ["Deep meditation", "Creativity", "Intuition", "Memory"],
        "color": "#7c3aed",
        "description": "Ideal for deep meditation, creativity, and accessing intuition"
    },
    {
        "id": "god-tone",
        "name": "God Tone (963 Hz)",
        "frequency_range": "963 Hz Solfeggio",
        "base_frequency": 963,
        "beat_frequency": 7.83,
        "benefits": ["Spiritual awakening", "Divine connection", "Crown chakra activation", "Higher consciousness"],
        "color": "#ffd700",
        "description": "The frequency of divine connection and spiritual awakening"
    },
    {
        "id": "love",
        "name": "Love Frequency (528 Hz)",
        "frequency_range": "528 Hz Solfeggio",
        "base_frequency": 528,
        "beat_frequency": 6,
        "benefits": ["Heart healing", "DNA repair", "Transformation", "Miracles"],
        "color": "#ec4899",
        "description": "The miracle tone - promotes love, healing, and positive transformation"
    },
    {
        "id": "liberation",
        "name": "Liberation (396 Hz)",
        "frequency_range": "396 Hz Solfeggio",
        "base_frequency": 396,
        "beat_frequency": 6,
        "benefits": ["Release fear", "Guilt liberation", "Root chakra", "Grounding"],
        "color": "#ef4444",
        "description": "Liberates from fear and guilt - grounds and balances the root chakra"
    },
    {
        "id": "alpha",
        "name": "Alpha (Relaxation)",
        "frequency_range": "8-13 Hz",
        "base_frequency": 200,
        "beat_frequency": 10,
        "benefits": ["Relaxation", "Stress reduction", "Light meditation", "Learning"],
        "color": "#a855f7",
        "description": "Perfect for relaxation, light meditation, and enhanced learning"
    },
    {
        "id": "beta",
        "name": "Beta (Focus)",
        "frequency_range": "13-30 Hz",
        "base_frequency": 200,
        "beat_frequency": 20,
        "benefits": ["Focus", "Concentration", "Alertness", "Problem solving"],
        "color": "#c084fc",
        "description": "Enhances focus, concentration, and mental alertness"
    },
    {
        "id": "gamma",
        "name": "Gamma (Peak Performance)",
        "frequency_range": "30-100 Hz",
        "base_frequency": 200,
        "beat_frequency": 40,
        "benefits": ["Peak focus", "Cognitive enhancement", "Information processing", "Memory recall"],
        "color": "#e9d5ff",
        "description": "For peak mental performance and cognitive enhancement"
    }
]


# ==================== ENDPOINTS ====================

@router.get("/binaural/frequencies")
async def get_binaural_frequencies():
    """Get available binaural beat frequencies"""
    return BINAURAL_FREQUENCIES


@router.get("/binaural/generate/{frequency_id}")
async def generate_binaural_beat(frequency_id: str, duration: int = 60):
    """Generate actual binaural beat audio"""
    freq_config = {
        "god-tone": {"base": 963, "beat": 7.83},
        "love": {"base": 528, "beat": 6},
        "liberation": {"base": 396, "beat": 6},
        "schumann": {"base": 200, "beat": 7.83},
        "delta": {"base": 200, "beat": 2},
        "theta": {"base": 200, "beat": 6},
        "alpha": {"base": 200, "beat": 10},
        "beta": {"base": 200, "beat": 20},
        "gamma": {"base": 200, "beat": 40}
    }
    
    if frequency_id not in freq_config:
        raise HTTPException(status_code=404, detail="Frequency not found")
    
    config = freq_config[frequency_id]
    base_freq = config["base"]
    beat_freq = config["beat"]
    
    sample_rate = 44100
    duration_seconds = min(duration, 300)
    
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds), dtype=np.float32)
    
    left_freq = base_freq
    right_freq = base_freq + beat_freq
    
    left_channel = np.sin(2 * np.pi * left_freq * t).astype(np.float32)
    right_channel = np.sin(2 * np.pi * right_freq * t).astype(np.float32)
    
    fade_samples = int(sample_rate * 2)
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    left_channel[:fade_samples] *= fade_in
    left_channel[-fade_samples:] *= fade_out
    right_channel[:fade_samples] *= fade_in
    right_channel[-fade_samples:] *= fade_out
    
    left_channel = (left_channel * 32767 * 0.7).astype(np.int16)
    right_channel = (right_channel * 32767 * 0.7).astype(np.int16)
    
    stereo = np.column_stack((left_channel, right_channel))
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, stereo)
    buffer.seek(0)
    
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "frequency_id": frequency_id,
        "base_frequency": base_freq,
        "beat_frequency": beat_freq,
        "duration_seconds": duration_seconds,
        "sample_rate": sample_rate,
        "audio_base64": audio_base64,
        "format": "wav"
    }


@router.get("/chakra/list")
async def get_chakras():
    """Get all chakra information"""
    chakras = []
    for chakra_id, data in CHAKRA_DATA.items():
        chakras.append({"id": chakra_id, **data})
    return chakras


@router.get("/chakra/tone/{chakra_id}")
async def generate_chakra_tone(chakra_id: str, duration: int = 60):
    """Generate a pure chakra frequency tone"""
    if chakra_id not in CHAKRA_DATA:
        raise HTTPException(status_code=404, detail="Chakra not found")
    
    chakra = CHAKRA_DATA[chakra_id]
    frequency = chakra["frequency"]
    
    sample_rate = 22050
    segment_duration = min(duration, 30)
    num_samples = int(sample_rate * segment_duration)
    
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)
    
    audio = np.sin(2 * np.pi * frequency * t) * 0.5
    audio += np.sin(2 * np.pi * frequency * 2 * t) * 0.15
    audio += np.sin(2 * np.pi * frequency * 3 * t) * 0.08
    
    mod = 1 + 0.1 * np.sin(2 * np.pi * 0.2 * t)
    audio = audio * mod
    
    fade_samples = int(sample_rate * 0.5)
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    audio = audio / np.max(np.abs(audio)) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "chakra_id": chakra_id,
        "chakra_name": chakra["name"],
        "name": chakra["name"],
        "sanskrit": chakra["sanskrit"],
        "frequency": frequency,
        "color": chakra["color"],
        "location": chakra["location"],
        "element": chakra["element"],
        "benefits": chakra["benefits"],
        "affirmation": chakra["affirmation"],
        "duration_seconds": segment_duration,
        "audio_base64": audio_base64,
        "format": "wav",
        "loopable": True
    }


@router.get("/chakra/realign-tone")
async def generate_realign_all_tone(duration: int = 300):
    """Generate a morphing tone that transitions through all chakras"""
    sample_rate = 22050
    duration_seconds = min(duration, 60)
    num_samples = int(sample_rate * duration_seconds)
    
    chakra_order = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"]
    frequencies = [CHAKRA_DATA[c]["frequency"] for c in chakra_order]
    
    time_per_chakra = duration_seconds / len(chakra_order)

    audio = np.zeros(num_samples, dtype=np.float32)
    
    for i, freq in enumerate(frequencies):
        start_time = i * time_per_chakra
        end_time = (i + 1) * time_per_chakra
        
        for j in range(num_samples):
            current_time = j / sample_rate
            if start_time <= current_time < end_time:
                progress = (current_time - start_time) / time_per_chakra
                
                if progress < 0.1:
                    envelope = progress / 0.1
                elif progress > 0.9:
                    envelope = (1 - progress) / 0.1
                else:
                    envelope = 1.0
                
                audio[j] += envelope * 0.5 * np.sin(2 * np.pi * freq * current_time)
                audio[j] += envelope * 0.15 * np.sin(2 * np.pi * freq * 2 * current_time)
    
    fade_samples = int(sample_rate * 1)
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    audio = audio / np.max(np.abs(audio)) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "type": "realign_all",
        "duration_seconds": duration_seconds,
        "chakra_order": chakra_order,
        "audio_base64": audio_base64,
        "format": "wav",
        "loopable": True
    }


@router.get("/binaural/audio/{frequency_id}")
async def get_binaural_audio_info(frequency_id: str):
    """Get binaural audio information and streaming URL"""
    audio_urls = {
        "delta": "https://www.soundhealing.com/samples/delta-waves.mp3",
        "theta": "https://www.soundhealing.com/samples/theta-waves.mp3",
        "alpha": "https://www.soundhealing.com/samples/alpha-waves.mp3",
        "beta": "https://www.soundhealing.com/samples/beta-waves.mp3",
        "gamma": "https://www.soundhealing.com/samples/gamma-waves.mp3"
    }
    return {
        "frequency_id": frequency_id,
        "audio_url": audio_urls.get(frequency_id),
        "format": "mp3",
        "duration_minutes": 30,
        "sample_rate": 44100,
        "note": "For production, replace with actual binaural beat audio files"
    }


@router.get("/chakra/stream-realign")
async def stream_realign_tone(duration: int = 60):
    """Stream morphing chakra frequency progression as a fully-buffered WAV.

    Unlike single-chakra streams this one is a one-shot journey (not looped),
    so it keeps the long fade-in/fade-out envelopes.
    """
    duration_seconds = max(20, min(duration, 120))
    sample_rate = MEDITATION_SAMPLE_RATE
    num_samples = int(sample_rate * duration_seconds)

    chakra_order = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"]
    frequencies = [CHAKRA_DATA[c]["frequency"] for c in chakra_order]

    time_per_chakra = duration_seconds / len(chakra_order)
    audio = np.zeros(num_samples, dtype=np.float32)

    # Vectorised per-chakra segment synthesis (~1000x faster than the nested
    # per-sample Python loop that lived here before).
    for i, freq in enumerate(frequencies):
        start_idx = int(i * time_per_chakra * sample_rate)
        end_idx = int((i + 1) * time_per_chakra * sample_rate)
        end_idx = min(end_idx, num_samples)
        if end_idx <= start_idx:
            continue
        seg_len = end_idx - start_idx
        seg_t = np.linspace(
            start_idx / sample_rate,
            end_idx / sample_rate,
            seg_len,
            dtype=np.float32,
        )
        # In-segment envelope: 10% ramp up, sustain, 10% ramp down
        progress = np.linspace(0, 1, seg_len, dtype=np.float32)
        envelope = np.ones_like(progress)
        envelope[progress < 0.1] = progress[progress < 0.1] / 0.1
        envelope[progress > 0.9] = (1 - progress[progress > 0.9]) / 0.1
        segment = envelope * 0.5 * np.sin(2 * np.pi * freq * seg_t)
        segment += envelope * 0.15 * np.sin(2 * np.pi * freq * 2 * seg_t)
        audio[start_idx:end_idx] += segment

    audio = _apply_fades(audio, sample_rate, seconds=1.0)
    return _wav_response(_wav_bytes_mono(audio, sample_rate), "chakra_realign")


@router.post("/chakra/generate-realign")
async def generate_realign_all_meditation(duration_minutes: int = 15):
    """Generate a guided meditation that works through all chakras"""
    chakra_order = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"]
    chakra_info = [f"- {CHAKRA_DATA[c]['name']} ({CHAKRA_DATA[c]['location']}): {CHAKRA_DATA[c]['affirmation']}" for c in chakra_order]

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"chakra-realign-{uuid.uuid4()}",
            system_message=f"""You are a chakra healing meditation guide. Create a {duration_minutes}-minute full chakra realignment meditation that moves through all seven chakras from root to crown.

IMPORTANT FORMATTING RULES:
1. Include pauses using EXACTLY this format: [pause for X seconds] where X is between 3 and 15
2. Spend roughly equal time on each chakra
3. Include smooth transitions between chakras
4. Use color visualization for each chakra
5. Include each chakra's affirmation
6. The tone will automatically shift to match each chakra, so mention when moving to next chakra
7. DO NOT use any markdown formatting - no asterisks (*), no hash symbols (#), no bullet points
8. Write in plain flowing prose that sounds natural when spoken aloud"""
        ).with_model("gemini", "gemini-2.5-pro")

        prompt = f"""Create a complete {duration_minutes}-minute chakra realignment meditation that moves through all seven chakras:

{chr(10).join(chakra_info)}

Structure:
1. Opening and grounding
2. Root Chakra (red) - grounding and security
3. Sacral Chakra (orange) - creativity and emotions  
4. Solar Plexus Chakra (yellow) - personal power
5. Heart Chakra (green) - love and compassion
6. Throat Chakra (blue) - communication and truth
7. Third Eye Chakra (indigo) - intuition and wisdom
8. Crown Chakra (violet) - spiritual connection
9. Integration and closing

Use [pause for X seconds] for breathing and integration moments.
Write in plain prose without any markdown formatting - this will be read aloud."""

        user_message = UserMessage(text=prompt)
        script = await chat.send_message(user_message)

        return {
            "type": "realign_all",
            "script": script,
            "duration_minutes": duration_minutes,
            "chakra_order": chakra_order
        }
    except Exception as e:
        logging.error(f"Error generating realign meditation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meditation")


# ---------------------------------------------------------------------------
# Helpers for meditation audio generation
# ---------------------------------------------------------------------------
# Native mobile audio players (iOS AVPlayer, Android ExoPlayer) require a
# proper `Content-Length` header to loop / seek reliably. `StreamingResponse`
# uses `Transfer-Encoding: chunked` and omits Content-Length, which caused
# silent playback failures on production device builds. Everything below now
# returns a fully-materialised `Response(content=bytes, ...)` so the audio
# player knows the exact byte count of the WAV and can safely loop.
#
# Additional loop-friendly behaviour: when `loop=1` is passed we skip the
# fade-in/out envelopes so seamless looping doesn't produce clicks / silence
# gaps between iterations.
MEDITATION_SAMPLE_RATE = 44100  # 44.1 kHz — universally supported


def _wav_bytes_stereo(left: np.ndarray, right: np.ndarray, sample_rate: int) -> bytes:
    """Encode a stereo float32 signal (both channels ~[-1,1]) as 16-bit WAV bytes."""
    audio = np.column_stack((left, right))
    audio = audio / max(np.max(np.abs(audio)), 1e-9) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    buf = io.BytesIO()
    wavfile.write(buf, sample_rate, audio_int16)
    return buf.getvalue()


def _wav_bytes_mono(mono: np.ndarray, sample_rate: int) -> bytes:
    """Encode a mono float32 signal as 16-bit WAV bytes."""
    audio = mono / max(np.max(np.abs(mono)), 1e-9) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    buf = io.BytesIO()
    wavfile.write(buf, sample_rate, audio_int16)
    return buf.getvalue()


def _apply_fades(audio: np.ndarray, sample_rate: int, seconds: float = 0.5) -> np.ndarray:
    """Apply a linear fade-in and fade-out to a mono or stereo signal."""
    fade_samples = int(sample_rate * seconds)
    if fade_samples <= 0 or fade_samples * 2 >= audio.shape[0]:
        return audio
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)
    if audio.ndim == 2:
        fade_in = fade_in.reshape(-1, 1)
        fade_out = fade_out.reshape(-1, 1)
    audio = audio.copy()
    audio[:fade_samples] *= fade_in
    audio[-fade_samples:] *= fade_out
    return audio


def _wav_response(wav_bytes: bytes, filename: str) -> Response:
    """Return a `Response` with Content-Length so native players can loop it."""
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"inline; filename={filename}.wav",
            "Content-Length": str(len(wav_bytes)),
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/chakra/stream/{chakra_id}")
async def stream_chakra_tone(chakra_id: str, duration: int = 60, loop: int = 1):
    """Stream chakra frequency tone as a fully-buffered WAV.

    Parameters
    ----------
    duration : int
        Seconds of audio to synthesise (clamped to 5..120). Default 60s.
    loop : int
        When 1 (default) the audio is fade-free so it can loop seamlessly.
        When 0 the audio has a 0.5s fade-in and fade-out.
    """
    if chakra_id not in CHAKRA_DATA:
        raise HTTPException(status_code=404, detail="Chakra not found")

    chakra = CHAKRA_DATA[chakra_id]
    frequency = chakra["frequency"]

    segment_duration = max(5, min(duration, 120))
    sample_rate = MEDITATION_SAMPLE_RATE
    num_samples = int(sample_rate * segment_duration)

    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)

    # Fundamental + gentle harmonics + soft amplitude modulation
    audio = np.sin(2 * np.pi * frequency * t) * 0.5
    audio += np.sin(2 * np.pi * frequency * 2 * t) * 0.15
    audio += np.sin(2 * np.pi * frequency * 3 * t) * 0.08
    mod = 1 + 0.1 * np.sin(2 * np.pi * 0.2 * t)
    audio = audio * mod

    if not loop:
        audio = _apply_fades(audio, sample_rate)

    return _wav_response(_wav_bytes_mono(audio, sample_rate), f"chakra_{chakra_id}")


@router.get("/binaural/stream/{frequency_id}")
async def stream_binaural_beat(frequency_id: str, duration: int = 60, loop: int = 1):
    """Stream binaural beat (or solfeggio tone) as a fully-buffered WAV."""
    BINAURAL_FREQ_CONFIG = {
        "delta": {"base": 100, "beat": 2},
        "theta": {"base": 150, "beat": 6},
        "alpha": {"base": 200, "beat": 10},
        "beta": {"base": 250, "beat": 20},
        "gamma": {"base": 300, "beat": 40},
        "god-tone": {"base": 963, "beat": 0},
        "love": {"base": 528, "beat": 0},
        "liberation": {"base": 396, "beat": 0},
    }
    if frequency_id not in BINAURAL_FREQ_CONFIG:
        raise HTTPException(status_code=404, detail="Frequency not found")

    freq_data = BINAURAL_FREQ_CONFIG[frequency_id]
    base_freq = freq_data["base"]
    beat_freq = freq_data["beat"]

    segment_duration = max(5, min(duration, 120))
    sample_rate = MEDITATION_SAMPLE_RATE
    num_samples = int(sample_rate * segment_duration)
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)

    if beat_freq > 0:
        # True binaural — different frequency in each ear
        left = np.sin(2 * np.pi * base_freq * t) * 0.5
        right = np.sin(2 * np.pi * (base_freq + beat_freq) * t) * 0.5
        stereo = np.column_stack((left, right))
        if not loop:
            stereo = _apply_fades(stereo, sample_rate)
        wav = _wav_bytes_stereo(stereo[:, 0], stereo[:, 1], sample_rate)
    else:
        # Solfeggio single-tone — mono is fine
        mono = np.sin(2 * np.pi * base_freq * t) * 0.5
        mono += np.sin(2 * np.pi * base_freq * 2 * t) * 0.15
        mono += np.sin(2 * np.pi * base_freq * 3 * t) * 0.08
        if not loop:
            mono = _apply_fades(mono, sample_rate)
        wav = _wav_bytes_mono(mono, sample_rate)

    return _wav_response(wav, f"binaural_{frequency_id}")


@router.post("/generate-guided")
async def generate_guided_meditation(
    duration_minutes: int = 10,
    focus: str = "relaxation",
    voice_style: str = "calm"
):
    """Generate a guided meditation script with AI"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"meditation-{uuid.uuid4()}",
            system_message=f"""You are a meditation guide. Create a {duration_minutes}-minute guided meditation focused on {focus}.

IMPORTANT FORMATTING RULES:
1. Include pauses using EXACTLY this format: [pause for X seconds] where X is between 3 and 15
2. Keep language calm, soothing, and spiritually uplifting
3. DO NOT use any markdown formatting
4. Write in plain flowing prose that sounds natural when spoken aloud"""
        ).with_model("gemini", "gemini-2.5-flash")
        
        prompt = f"Create a complete {duration_minutes}-minute guided meditation focused on {focus}. Include breathing instructions, visualization, and body awareness. Use [pause for X seconds] format for pauses."
        
        user_message = UserMessage(text=prompt)
        script = await chat.send_message(user_message)
        
        return {
            "script": script,
            "duration_minutes": duration_minutes,
            "focus": focus
        }
    except Exception as e:
        logging.error(f"Error generating meditation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meditation")


@router.post("/chakra/generate-guided/{chakra_id}")
async def generate_chakra_meditation(chakra_id: str, duration_minutes: int = 5):
    """Generate a guided meditation script for a specific chakra"""
    if chakra_id not in CHAKRA_DATA:
        raise HTTPException(status_code=404, detail="Chakra not found")
    
    chakra = CHAKRA_DATA[chakra_id]
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"chakra-{uuid.uuid4()}",
            system_message=f"""You are a chakra healing meditation guide. Create a {duration_minutes}-minute guided meditation for the {chakra['name']}.

Include pauses using [pause for X seconds] format. Focus on the {chakra['location']} area and the color {chakra['color']}. Include the affirmation: "{chakra['affirmation']}". DO NOT use markdown."""
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"Create a {duration_minutes}-minute chakra meditation for {chakra['name']}. Benefits: {', '.join(chakra['benefits'])}."
        
        user_message = UserMessage(text=prompt)
        script = await chat.send_message(user_message)
        
        return {
            "chakra_id": chakra_id,
            "chakra_name": chakra["name"],
            "script": script,
            "duration_minutes": duration_minutes,
            "frequency": chakra["frequency"],
            "color": chakra["color"]
        }
    except Exception as e:
        logging.error(f"Error generating chakra meditation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meditation")


@router.post("/session/save")
async def save_meditation_session(session: dict, request: Request):
    """Save a meditation session to track progress"""
    try:
        from datetime import datetime
        user = await get_current_user(request)
        
        session['_id'] = str(uuid.uuid4())
        session['user_id'] = user['user_id']
        session['completed_at'] = datetime.utcnow().isoformat()
        await db.meditation_sessions.insert_one(session)
        return {"success": True, "session_id": session['_id']}
    except HTTPException:
        from datetime import datetime
        session['_id'] = str(uuid.uuid4())
        session['completed_at'] = datetime.utcnow().isoformat()
        await db.meditation_sessions.insert_one(session)
        return {"success": True, "session_id": session['_id']}
    except Exception as e:
        logging.error(f"Error saving meditation session: {e}")
        raise HTTPException(status_code=500, detail="Failed to save session")


@router.get("/sessions")
async def get_meditation_sessions(request: Request, limit: int = 30):
    """Get meditation session history for current user"""
    try:
        user = await get_current_user(request)
        sessions = await db.meditation_sessions.find(
            {"user_id": user['user_id']}
        ).sort("completed_at", -1).limit(limit).to_list(limit)
        return sessions
    except HTTPException:
        return []
    except Exception as e:
        logging.error(f"Error fetching sessions: {e}")
        return []


# ==================== AMBIENT SOUNDS ====================
SOUND_CONFIG = {
    "ocean": {"type": "pink_noise", "modulation": 0.3, "mod_freq": 0.1},
    "rain": {"type": "white_noise", "modulation": 0.5, "mod_freq": 2.0},
    "forest": {"type": "brown_noise", "modulation": 0.2, "mod_freq": 0.5},
    "singing-bowl": {"type": "sine_harmonic", "base_freq": 396, "harmonics": [1, 2, 3, 5]},
    "thunder": {"type": "thunder", "modulation": 0.6},
    "wind": {"type": "wind", "modulation": 0.4},
    "fire": {"type": "fire", "crackle_rate": 8},
    "stream": {"type": "stream", "flow_rate": 0.3},
    "night": {"type": "night", "cricket_rate": 4},
    "silence": {"type": "silence"}
}


@router.get("/ambient/generate/{sound_id}")
async def generate_ambient_sound(sound_id: str, duration: int = 60, loop: int = 1):
    """Generate ambient sound audio (synthesized).

    Returns base64-encoded 44.1 kHz WAV in JSON — used by the Timed Meditation
    screen which builds a `data:audio/wav;base64,...` URI and loops it in
    `AudioPlayerManager`.

    Parameters
    ----------
    duration : int
        Seconds of audio to synthesise (clamped to 20..300). Default 60.
    loop : int
        When 1 (default) the audio has NO fade-in/out envelope so it loops
        seamlessly. When 0 a 1-second fade is applied on each end.
    """
    if sound_id not in SOUND_CONFIG:
        raise HTTPException(status_code=404, detail="Sound not found")

    config = SOUND_CONFIG[sound_id]
    sample_rate = 44100
    duration_seconds = max(20, min(duration, 300))
    num_samples = int(sample_rate * duration_seconds)
    t = np.arange(num_samples) / sample_rate

    stype = config["type"]

    if stype == "silence":
        audio = np.zeros(num_samples, dtype=np.float32)

    elif stype == "pink_noise":
        white = np.random.randn(num_samples).astype(np.float32)
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        pink = lfilter(b, a, white)
        mod = 0.5 + config["modulation"] * np.sin(2 * np.pi * config["mod_freq"] * t)
        audio = (pink * mod * 0.3).astype(np.float32)

    elif stype == "white_noise":
        white = np.random.randn(num_samples).astype(np.float32)
        mod = 0.3 + config["modulation"] * np.abs(
            np.sin(2 * np.pi * config["mod_freq"] * t + np.random.randn(num_samples) * 0.5)
        )
        audio = (white * mod * 0.25).astype(np.float32)

    elif stype == "brown_noise":
        white = np.random.randn(num_samples).astype(np.float32)
        brown = np.cumsum(white)
        brown = brown / max(np.max(np.abs(brown)), 1e-9)
        mod = 0.7 + config["modulation"] * np.sin(2 * np.pi * config["mod_freq"] * t)
        audio = (brown * mod * 0.3).astype(np.float32)

    elif stype == "sine_harmonic":
        audio = np.zeros(num_samples, dtype=np.float32)
        for i, h in enumerate(config["harmonics"]):
            freq = config["base_freq"] * h
            # Decay per-harmonic to give it a bell-like character. Retriggered
            # every 6 seconds so the bowl "rings" throughout the meditation.
            phase = (t % 6.0)
            decay = np.exp(-phase * (0.4 + i * 0.15))
            audio += np.sin(2 * np.pi * freq * t) * decay * (1.0 / (i + 1))
        audio = (audio / max(np.max(np.abs(audio)), 1e-9) * 0.5).astype(np.float32)

    elif stype == "thunder":
        # Low-frequency rumbling brown noise with occasional loud claps.
        white = np.random.randn(num_samples).astype(np.float32)
        rumble = np.cumsum(white) / max(np.max(np.abs(np.cumsum(white))), 1e-9)
        rumble *= 0.15
        # Sparse impulse claps ~ every 8-14 s with exponential decay tails.
        num_claps = max(2, int(duration_seconds / 10))
        rng = np.random.default_rng()
        clap_positions = rng.integers(
            int(sample_rate * 2), num_samples - int(sample_rate * 2), size=num_claps,
        )
        clap_envelope = np.zeros(num_samples, dtype=np.float32)
        tail_len = int(sample_rate * 3.0)
        tail = np.exp(-np.linspace(0, 6, tail_len, dtype=np.float32))
        for pos in clap_positions:
            end = min(pos + tail_len, num_samples)
            clap_envelope[pos:end] += tail[: end - pos] * 0.6
        clap_noise = np.random.randn(num_samples).astype(np.float32) * clap_envelope
        audio = (rumble + clap_noise * 0.5).astype(np.float32)

    elif stype == "wind":
        # Band-passed white noise with slow amplitude modulation for gustiness.
        white = np.random.randn(num_samples).astype(np.float32)
        # Simple 1st-order low-pass filter (single-pole IIR) for whooshing feel.
        b = [0.05]
        a = [1, -0.95]
        filtered = lfilter(b, a, white).astype(np.float32)
        gust = 0.5 + 0.5 * np.sin(2 * np.pi * 0.08 * t + np.sin(2 * np.pi * 0.02 * t) * 2)
        gust = gust ** 2  # sharper peaks
        audio = (filtered * gust * 0.45).astype(np.float32)

    elif stype == "fire":
        # Brown noise base + Poisson-random crackle transients.
        white = np.random.randn(num_samples).astype(np.float32)
        brown = np.cumsum(white)
        brown = brown / max(np.max(np.abs(brown)), 1e-9)
        crackle = np.zeros(num_samples, dtype=np.float32)
        crackle_rate = config.get("crackle_rate", 8)  # per second
        num_crackles = int(duration_seconds * crackle_rate)
        rng = np.random.default_rng()
        positions = rng.integers(0, num_samples - 200, size=num_crackles)
        # Each crackle is a short exponentially-decaying noise burst
        for pos in positions:
            burst_len = rng.integers(50, 200)
            burst = np.random.randn(burst_len).astype(np.float32)
            burst *= np.exp(-np.linspace(0, 4, burst_len, dtype=np.float32))
            crackle[pos: pos + burst_len] += burst * rng.uniform(0.3, 0.8)
        audio = (brown * 0.15 + crackle * 0.35).astype(np.float32)

    elif stype == "stream":
        # High-passed white noise + gentle 400-1200 Hz warbles for water sound.
        white = np.random.randn(num_samples).astype(np.float32)
        # Naive high-pass: subtract low-pass version
        b_lp = [0.05]
        a_lp = [1, -0.95]
        lp = lfilter(b_lp, a_lp, white).astype(np.float32)
        hp = white - lp
        # Add sparkling upper "burble" tones that drift in frequency
        drift = 600 + 200 * np.sin(2 * np.pi * 0.15 * t) + 100 * np.sin(2 * np.pi * 0.9 * t)
        burble = np.sin(2 * np.pi * drift * t) * 0.05
        flow = 0.6 + 0.4 * config.get("flow_rate", 0.3) * np.sin(2 * np.pi * 0.3 * t)
        audio = ((hp * flow) * 0.35 + burble).astype(np.float32)

    elif stype == "night":
        # Quiet ambient hiss + periodic cricket chirp bursts.
        white = np.random.randn(num_samples).astype(np.float32) * 0.05
        cricket = np.zeros(num_samples, dtype=np.float32)
        cricket_rate = config.get("cricket_rate", 4)  # crickets per second
        num_chirps = int(duration_seconds * cricket_rate)
        rng = np.random.default_rng()
        for _ in range(num_chirps):
            pos = rng.integers(0, num_samples - 4000)
            chirp_freq = rng.uniform(3800, 4400)
            chirp_len = rng.integers(1500, 3000)
            env = np.exp(-np.linspace(0, 8, chirp_len, dtype=np.float32))
            chirp_t = np.arange(chirp_len) / sample_rate
            chirp = np.sin(2 * np.pi * chirp_freq * chirp_t) * env * 0.15
            cricket[pos: pos + chirp_len] += chirp
        audio = (white + cricket).astype(np.float32)

    else:
        # Unknown → silence rather than a crash. Log so it's not silent silent.
        logging.warning(f"[ambient] Unknown sound type '{stype}' for id '{sound_id}'")
        audio = np.zeros(num_samples, dtype=np.float32)

    # Normalise to prevent clipping.
    peak = np.max(np.abs(audio))
    if peak > 1e-9:
        audio = audio / peak * 0.7

    # Fade in/out ONLY when the caller intends one-shot playback. For looping
    # (the default) a fade creates an audible silence gap between iterations.
    if not loop:
        fade_samples = int(sample_rate * 1.0)
        if fade_samples * 2 < audio.shape[0]:
            audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
            audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)

    audio = np.clip(audio, -1, 1)
    audio_int16 = (audio * 32767).astype(np.int16)

    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    audio_base64 = base64.b64encode(buffer.getvalue()).decode()

    return {
        "sound_id": sound_id,
        "duration_seconds": duration_seconds,
        "sample_rate": sample_rate,
        "audio_base64": audio_base64,
        "format": "wav",
    }
