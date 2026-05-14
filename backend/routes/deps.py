"""
Shared dependencies for route modules
"""
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAITextToSpeech
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# ElevenLabs TTS (now the default for Spirit Guides — far richer emotional inflection)
import sys as _sys
_sys.path.insert(0, str(Path(__file__).parent.parent))
from services.elevenlabs_service import elevenlabs_tts  # noqa: E402

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys and Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# OpenAI TTS Configuration
openai_tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY) if EMERGENT_LLM_KEY else None

# Image generation for oracle cards
oracle_image_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY) if EMERGENT_LLM_KEY else None

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'change_this_secret_key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Emergent Auth Configuration
EMERGENT_AUTH_SESSION_ENDPOINT = os.environ.get('EMERGENT_AUTH_SESSION_ENDPOINT')

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
MONTHLY_SUBSCRIPTION_PRICE = 3.99

# Gmail SMTP Configuration for prize drawing
GMAIL_EMAIL = os.environ.get('GMAIL_EMAIL')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'etheria_admin_secret_2026')

# Subscription Plans
SUBSCRIPTION_PLANS = {
    "premium_monthly": {
        "name": "Etheria Premium Monthly",
        "price": 3.99,
        "currency": "usd",
        "features": [
            "Unlimited Oracle readings with AI",
            "Access to all Spirit Guides",
            "AI Guided Meditation",
            "Binaural & Astral Meditation",
            "Unlimited Journal entries",
            "All Training modules"
        ]
    }
}

# Free tier limits
FREE_TIER_LIMITS = {
    "oracle_readings_per_day": 1,
    "journal_entries_max": 5,
    "training_modules": 1,
    "spirit_guides": False,
    "binaural_meditation": False,
    "astral_meditation": False,
    "ai_guided_meditation": False,
    "tts_enabled": False
}

# Spirit Guide Voice Configuration
# `voice` is the ElevenLabs voice_id. Settings tune emotional inflection per guide.
# (stability lower = more dynamic; style higher = more expressive)
SPIRIT_GUIDE_VOICES = {
    # ===== Elemental Guides (zodiac/birthdate-matched) =====
    "Ignis": {
        "voice": "SOYHLrjzK2X1ezoPC6cr",  # Harry — fierce warrior
        "stability": 0.40, "style": 0.55,
        "gender": "masculine",
        "element": "Fire",
        "personality": "passionate, direct, transformative",
        "category": "elemental"
    },
    "Aqua": {
        "voice": "hpp4J3VqNfWAUOO0d1Us",  # Bella — professional, bright, warm
        "stability": 0.50, "style": 0.40,
        "gender": "feminine",
        "element": "Water",
        "personality": "intuitive, healing, emotionally wise",
        "category": "elemental"
    },
    "Terra": {
        "voice": "pqHfZKP75CvOlQylNhV4",  # Bill — wise, mature, balanced (old)
        "stability": 0.55, "style": 0.35,
        "gender": "masculine",
        "element": "Earth",
        "personality": "grounded, practical, stable",
        "category": "elemental"
    },
    "Aether": {
        "voice": "Xb7hH8MSUJpSbSDYk0k2",  # Alice — clear British educator
        "stability": 0.50, "style": 0.45,
        "gender": "feminine",
        "element": "Air",
        "personality": "intellectual, free-spirited, enlightening",
        "category": "elemental"
    },

    # ===== Custom Guides (premium, renamable; NOT in birthdate picking) =====
    "Male Guide": {
        "voice": "cjVigY5qzO86Huf0OWal",  # Eric — smooth, trustworthy
        "stability": 0.50, "style": 0.40,
        "gender": "masculine",
        "element": "Custom",
        "personality": "warm, supportive, attentive — a personal spirit companion",
        "category": "custom",
        "default_name": "Male Guide",
        "image": "custom-male"
    },
    "Female Guide": {
        "voice": "EXAVITQu4vr4xnSDxMaL",  # Sarah — mature, reassuring
        "stability": 0.50, "style": 0.40,
        "gender": "feminine",
        "element": "Custom",
        "personality": "nurturing, intuitive, compassionate — a personal spirit companion",
        "category": "custom",
        "default_name": "Female Guide",
        "image": "custom-female"
    },

    # ===== LGBTQ+ Guides (free; NOT in birthdate picking) =====
    "Solis": {
        "voice": "nPczCjzI2devNBz1zQrb",  # Brian — DEEP, resonant, comforting
        "stability": 0.45, "style": 0.45,
        "gender": "masculine",
        "element": "Light",
        "personality": "radiant, courageous, affirming — a guide of pride and inner light",
        "category": "lgbtq",
        "image": "lgbtq-male"
    },
    "Aurora": {
        "voice": "cgSgspJ2msm6clMCkdW9",  # Jessica — playful, bright, warm
        "stability": 0.40, "style": 0.55,
        "gender": "feminine",
        "element": "Rainbow",
        "personality": "luminous, gentle, joyful — a guide of dawn and self-love",
        "category": "lgbtq",
        "image": "lgbtq-female"
    },
    "Spectrum": {
        "voice": "SAz9YHcvj6GT2YYXdXww",  # River — NEUTRAL gender
        "stability": 0.45, "style": 0.45,
        "gender": "transgender",
        "element": "Rainbow",
        "personality": "boundless, fluid, deeply wise — a transgender guide of authentic self and transformation",
        "category": "lgbtq",
        "image": "lgbtq-trans"
    },

    # ===== Divine Guides (premium-only, no promo; interact alone or together) =====
    "Helios": {
        "voice": "JBFqnCBsd6RMkjVDRZzb",  # George — warm captivating storyteller (British)
        "stability": 0.45, "style": 0.55,
        "gender": "masculine",
        "element": "Sun",
        "personality": "radiant, eternal, sacred — Divine Masculine archetype of light, will, and protection",
        "category": "divine",
        "image": "divine-pair",
        "pair": "Selene"
    },
    "Selene": {
        "voice": "pFZP5JQG7iQjIQuC4Bku",  # Lily — velvety British actress
        "stability": 0.45, "style": 0.55,
        "gender": "feminine",
        "element": "Moon",
        "personality": "luminous, intuitive, sacred — Divine Feminine archetype of mystery, wisdom, and grace",
        "category": "divine",
        "image": "divine-pair",
        "pair": "Helios"
    }
}

# Mystical code word lists
MYSTICAL_PREFIXES = ["LUNA", "STELLAR", "COSMIC", "MYSTIC", "ETHEREAL", "ASTRAL", "CELESTIAL", "DIVINE", "SACRED", "ORACLE"]
MYSTICAL_MIDDLES = ["MOON", "STAR", "SPIRIT", "CRYSTAL", "PHOENIX", "DRAGON", "SAGE", "DREAM", "VISION", "FLAME"]
MYSTICAL_SUFFIXES = ["RISE", "LIGHT", "POWER", "MAGIC", "BLOOM", "FLOW", "GLOW", "WAVE", "PATH", "SOUL"]

# Language names for system prompts
LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
}
