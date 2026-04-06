"""
Meditation endpoints - Binaural beats, Chakra tones, Ambient sounds, and sessions
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
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
BINAURAL_FREQUENCIES = [
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
        "frequency": frequency,
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
    
    t = np.linspace(0, duration_seconds, num_samples, dtype=np.float32)
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


@router.get("/chakra/stream/{chakra_id}")
async def stream_chakra_tone(chakra_id: str, duration: int = 30):
    """Stream chakra frequency tone as WAV audio"""
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
    
    return StreamingResponse(
        buffer,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"inline; filename=chakra_{chakra_id}.wav",
            "Accept-Ranges": "bytes"
        }
    )


@router.get("/binaural/stream/{frequency_id}")
async def stream_binaural_beat(frequency_id: str, duration: int = 30):
    """Stream binaural beat as WAV audio"""
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
    
    sample_rate = 22050
    segment_duration = min(duration, 30)
    num_samples = int(sample_rate * segment_duration)
    
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)
    
    if beat_freq > 0:
        left = np.sin(2 * np.pi * base_freq * t) * 0.5
        right = np.sin(2 * np.pi * (base_freq + beat_freq) * t) * 0.5
        audio = np.column_stack((left, right))
    else:
        audio = np.sin(2 * np.pi * base_freq * t) * 0.5
        audio += np.sin(2 * np.pi * base_freq * 2 * t) * 0.15
        audio += np.sin(2 * np.pi * base_freq * 3 * t) * 0.08
    
    fade_samples = int(sample_rate * 0.5)
    if len(audio.shape) == 2:
        audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32).reshape(-1, 1)
        audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32).reshape(-1, 1)
    else:
        audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
        audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    audio = audio / np.max(np.abs(audio)) * 0.7
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"inline; filename=binaural_{frequency_id}.wav",
            "Accept-Ranges": "bytes"
        }
    )


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
        ).with_model("gemini", "gemini-2.0-flash")
        
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
            "frequency": chakra["frequency"]
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
async def generate_ambient_sound(sound_id: str, duration: int = 60):
    """Generate ambient sound audio (synthesized)"""
    if sound_id not in SOUND_CONFIG:
        raise HTTPException(status_code=404, detail="Sound not found")
    
    config = SOUND_CONFIG[sound_id]
    sample_rate = 44100
    duration_seconds = min(duration, 300)
    num_samples = int(sample_rate * duration_seconds)
    
    if config["type"] == "silence":
        audio = np.zeros(num_samples, dtype=np.float32)
    
    elif config["type"] == "pink_noise":
        white = np.random.randn(num_samples).astype(np.float32)
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        pink = lfilter(b, a, white)
        mod = 0.5 + config["modulation"] * np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate)
        audio = (pink * mod * 0.3).astype(np.float32)
    
    elif config["type"] == "white_noise":
        white = np.random.randn(num_samples).astype(np.float32)
        mod = 0.3 + config["modulation"] * np.abs(np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate + np.random.randn(num_samples) * 0.5))
        audio = (white * mod * 0.25).astype(np.float32)
    
    elif config["type"] == "brown_noise":
        white = np.random.randn(num_samples).astype(np.float32)
        brown = np.cumsum(white)
        brown = brown / np.max(np.abs(brown))
        mod = 0.7 + config["modulation"] * np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate)
        audio = (brown * mod * 0.3).astype(np.float32)
    
    elif config["type"] == "sine_harmonic":
        t = np.arange(num_samples) / sample_rate
        audio = np.zeros(num_samples, dtype=np.float32)
        for i, h in enumerate(config["harmonics"]):
            freq = config["base_freq"] * h
            decay = np.exp(-t * (0.1 + i * 0.05))
            audio += np.sin(2 * np.pi * freq * t) * decay * (1.0 / (i + 1))
        audio = (audio / np.max(np.abs(audio)) * 0.5).astype(np.float32)
    
    else:
        audio = np.zeros(num_samples, dtype=np.float32)
    
    # Fade in/out
    fade_samples = int(sample_rate * 1)
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    audio = np.clip(audio, -1, 1)
    audio_int16 = (audio * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "sound_id": sound_id,
        "duration_seconds": duration_seconds,
        "sample_rate": sample_rate,
        "audio_base64": audio_base64,
        "format": "wav"
    }
