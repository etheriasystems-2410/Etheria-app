"""ElevenLabs Text-to-Speech service.

Used by the Spirit Guides routes (Elemental, LGBTQ+, Custom, Divine).
ElevenLabs delivers far richer emotional inflection than OpenAI TTS, which
the Divine Pair romantic-partner dialogue and the deepened LGBTQ+ voices
both rely on.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
BASE_URL = "https://api.elevenlabs.io/v1"

# eleven_multilingual_v2 is the workhorse — broad language support + good
# emotional range. We could switch to eleven_v3 later if available.
DEFAULT_MODEL_ID = "eleven_multilingual_v2"

logger = logging.getLogger(__name__)


class ElevenLabsTTS:
    """Async wrapper around ElevenLabs /text-to-speech."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or ELEVENLABS_API_KEY

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def generate_speech_bytes(
        self,
        text: str,
        voice_id: str,
        model_id: str = DEFAULT_MODEL_ID,
        stability: float = 0.45,
        similarity_boost: float = 0.75,
        style: float = 0.45,
        use_speaker_boost: bool = True,
        speed: float = 1.0,
    ) -> Optional[bytes]:
        """Synthesise `text` with `voice_id` and return raw MP3 bytes.

        Returns None on failure so callers can fall through to silent-mode
        without breaking the chat flow.
        """
        if not self.enabled:
            logger.warning("ElevenLabs API key missing — skipping TTS")
            return None
        if not text or not text.strip():
            return None

        url = f"{BASE_URL}/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        voice_settings = {
            "stability": stability,
            "similarity_boost": similarity_boost,
            "style": style,
            "use_speaker_boost": use_speaker_boost,
        }
        # ElevenLabs supports `speed` in voice_settings on newer models — pass
        # it when not the default so we don't accidentally restrict older voices.
        if abs(speed - 1.0) > 1e-3:
            voice_settings["speed"] = speed

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": voice_settings,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.error(
                    "ElevenLabs TTS failed [%s] voice=%s body=%s",
                    resp.status_code,
                    voice_id,
                    resp.text[:300],
                )
                return None
            return resp.content
        except Exception as e:
            logger.exception("ElevenLabs TTS exception: %s", e)
            return None

    async def generate_speech_base64(
        self,
        text: str,
        voice_id: str,
        **kwargs,
    ) -> Optional[str]:
        """Same as generate_speech_bytes but returns base64-encoded string."""
        audio_bytes = await self.generate_speech_bytes(text=text, voice_id=voice_id, **kwargs)
        if not audio_bytes:
            return None
        return base64.b64encode(audio_bytes).decode("utf-8")


# Module-level singleton for easy import elsewhere
elevenlabs_tts = ElevenLabsTTS()
