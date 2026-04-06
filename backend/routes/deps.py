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
SPIRIT_GUIDE_VOICES = {
    "Ignis": {
        "element": "Fire",
        "voice": "nova",
        "personality": "Passionate, inspiring, transformative. Speaks with intensity and warmth.",
        "description": "The Fire Spirit Guide, a fierce and protective force"
    },
    "Aqua": {
        "element": "Water",
        "voice": "shimmer",
        "personality": "Calm, intuitive, flowing. Speaks with gentle wisdom and emotional depth.",
        "description": "The Water Spirit Guide, a nurturing and healing presence"
    },
    "Terra": {
        "element": "Earth",
        "voice": "echo",
        "personality": "Grounded, patient, stable. Speaks with reassuring strength and practicality.",
        "description": "The Earth Spirit Guide, a grounding and protective force"
    },
    "Aether": {
        "element": "Air",
        "voice": "alloy",
        "personality": "Intellectual, communicative, expansive. Speaks with clarity and vision.",
        "description": "The Air Spirit Guide, a messenger and visionary"
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
