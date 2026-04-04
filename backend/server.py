from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import random
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAITextToSpeech
import base64
import io
import bcrypt
import jwt
import httpx
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from typing import Dict
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Gemini API key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# OpenAI TTS Configuration (replacing ElevenLabs)
openai_tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'change_this_secret_key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Emergent Auth Configuration
EMERGENT_AUTH_SESSION_ENDPOINT = os.environ.get('EMERGENT_AUTH_SESSION_ENDPOINT')

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
MONTHLY_SUBSCRIPTION_PRICE = 3.99  # $3.99 USD

# Subscription Plans - Server-side defined (NEVER accept from frontend)
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
    "training_modules": 1,  # Only first beginner module
    "spirit_guides": False,
    "binaural_meditation": False,
    "astral_meditation": False,
    "ai_guided_meditation": False,
    "tts_enabled": False
}

# Gmail SMTP Configuration for prize drawing
GMAIL_EMAIL = os.environ.get('GMAIL_EMAIL')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'etheria_admin_secret_2026')

# Mystical code word lists for AI-generated codes
MYSTICAL_PREFIXES = ["LUNA", "STELLAR", "COSMIC", "MYSTIC", "ETHEREAL", "ASTRAL", "CELESTIAL", "DIVINE", "SACRED", "ORACLE"]
MYSTICAL_MIDDLES = ["MOON", "STAR", "SPIRIT", "CRYSTAL", "PHOENIX", "DRAGON", "SAGE", "DREAM", "VISION", "FLAME"]
MYSTICAL_SUFFIXES = ["RISE", "LIGHT", "POWER", "MAGIC", "BLOOM", "FLOW", "GLOW", "WAVE", "PATH", "SOUL"]

# Spirit Guide Voice Configuration
# Using OpenAI TTS voices with appropriate personalities
SPIRIT_GUIDE_VOICES = {
    "Ignis": {
        "voice": "onyx",  # Deep, authoritative - for Fire
        "gender": "masculine",
        "element": "Fire",
        "personality": "passionate, direct, transformative"
    },
    "Aqua": {
        "voice": "shimmer",  # Bright, cheerful - for Water (feminine feel)
        "gender": "feminine",
        "element": "Water",
        "personality": "intuitive, healing, emotionally wise"
    },
    "Terra": {
        "voice": "echo",  # Smooth, calm - for Earth (grounded)
        "gender": "masculine",
        "element": "Earth",
        "personality": "grounded, practical, stable"
    },
    "Aether": {
        "voice": "nova",  # Energetic, upbeat - for Air (free-spirited)
        "gender": "feminine",
        "element": "Air",
        "personality": "intellectual, free-spirited, enlightening"
    }
}

# Zodiac to Element mapping
ZODIAC_TO_ELEMENT = {
    # Fire signs
    "aries": "Fire",
    "leo": "Fire",
    "sagittarius": "Fire",
    # Water signs
    "cancer": "Water",
    "scorpio": "Water",
    "pisces": "Water",
    # Earth signs
    "taurus": "Earth",
    "virgo": "Earth",
    "capricorn": "Earth",
    # Air signs
    "gemini": "Air",
    "libra": "Air",
    "aquarius": "Air"
}

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Oracle Cards - Spirit Guide themed with beautiful illustrations
ORACLE_CARDS = [
    {
        "name": "The Fire Phoenix",
        "element": "Fire",
        "description": "Transformation through passion and rebirth",
        "keywords": ["transformation", "passion", "renewal", "energy"],
        "image_url": "https://images.unsplash.com/photo-1764555719665-d2c91587a6e6"
    },
    {
        "name": "The Flame Dancer",
        "element": "Fire",
        "description": "Creative expression and bold action",
        "keywords": ["creativity", "action", "courage", "expression"],
        "image_url": "https://images.unsplash.com/photo-1762882936976-3cea8cbd6e3e"
    },
    {
        "name": "The Sacred Ember",
        "element": "Fire",
        "description": "Inner spark and divine inspiration",
        "keywords": ["inspiration", "motivation", "divine spark", "purpose"],
        "image_url": "https://images.pexels.com/photos/36022109/pexels-photo-36022109.jpeg"
    },
    {
        "name": "The Ocean Depths",
        "element": "Water",
        "description": "Deep emotions and subconscious wisdom",
        "keywords": ["emotions", "intuition", "depth", "subconscious"],
        "image_url": "https://images.unsplash.com/photo-1628371164958-887b4c79a6be"
    },
    {
        "name": "The Healing Spring",
        "element": "Water",
        "description": "Emotional cleansing and renewal",
        "keywords": ["healing", "cleansing", "forgiveness", "renewal"],
        "image_url": "https://images.unsplash.com/photo-1752139925820-d8267dc25182"
    },
    {
        "name": "The Moon Tide",
        "element": "Water",
        "description": "Cycles, intuition, and psychic ability",
        "keywords": ["cycles", "intuition", "psychic", "feminine energy"],
        "image_url": "https://images.unsplash.com/photo-1633403999090-064ea7537d68"
    },
    {
        "name": "The Ancient Tree",
        "element": "Earth",
        "description": "Grounding, wisdom, and stability",
        "keywords": ["grounding", "wisdom", "stability", "growth"],
        "image_url": "https://images.unsplash.com/photo-1761635555180-ba6f3e7cb057"
    },
    {
        "name": "The Sacred Mountain",
        "element": "Earth",
        "description": "Achievement and endurance",
        "keywords": ["achievement", "endurance", "strength", "foundation"],
        "image_url": "https://images.pexels.com/photos/1242987/pexels-photo-1242987.jpeg"
    },
    {
        "name": "The Blooming Garden",
        "element": "Earth",
        "description": "Abundance and manifestation",
        "keywords": ["abundance", "manifestation", "prosperity", "nurturing"],
        "image_url": "https://images.unsplash.com/photo-1703825864851-b5f379b9e3fc"
    },
    {
        "name": "The Whispering Wind",
        "element": "Air",
        "description": "Messages and mental clarity",
        "keywords": ["messages", "clarity", "communication", "thought"],
        "image_url": "https://images.unsplash.com/photo-1715616501682-a8eb6bf657e8"
    },
    {
        "name": "The Sky Dancer",
        "element": "Air",
        "description": "Freedom and new perspectives",
        "keywords": ["freedom", "perspective", "liberation", "change"],
        "image_url": "https://images.unsplash.com/photo-1765813142498-fbee89bd66e5"
    },
    {
        "name": "The Sacred Breath",
        "element": "Air",
        "description": "Life force and spiritual connection",
        "keywords": ["life force", "spirit", "connection", "awareness"],
        "image_url": "https://images.pexels.com/photos/6931694/pexels-photo-6931694.jpeg"
    }
]

# Training Modules
TRAINING_MODULES = [
    {
        "id": "beginner-1",
        "title": "Opening Your Third Eye",
        "description": "Learn foundational techniques to awaken your inner vision and psychic perception",
        "lessons": 5,
        "category": "beginner",
        "free": True
    },
    {
        "id": "beginner-2",
        "title": "Meditation Basics",
        "description": "Master the fundamentals of meditation for psychic development",
        "lessons": 7,
        "category": "beginner",
        "free": True
    },
    {
        "id": "beginner-3",
        "title": "Energy Awareness",
        "description": "Develop sensitivity to subtle energies and auras",
        "lessons": 6,
        "category": "beginner",
        "free": False
    },
    {
        "id": "beginner-4",
        "title": "Automatic Writing Basics",
        "description": "Learn to channel messages through written expression and connect with your higher self",
        "lessons": 6,
        "category": "beginner",
        "free": True
    },
    {
        "id": "intermediate-1",
        "title": "Clairvoyance Development",
        "description": "Enhance your ability to see beyond the physical realm",
        "lessons": 8,
        "category": "intermediate",
        "free": False
    },
    {
        "id": "intermediate-2",
        "title": "Telepathy & Mind Reading",
        "description": "Practice connecting with others' thoughts and emotions",
        "lessons": 6,
        "category": "intermediate",
        "free": False
    },
    {
        "id": "intermediate-3",
        "title": "Dream Work & Lucid Dreaming",
        "description": "Harness the power of your dream state for psychic insight",
        "lessons": 7,
        "category": "intermediate",
        "free": False
    },
    {
        "id": "advanced-1",
        "title": "Astral Projection Mastery",
        "description": "Travel beyond your physical body with controlled practice",
        "lessons": 10,
        "category": "advanced",
        "free": False
    },
    {
        "id": "advanced-2",
        "title": "Remote Viewing",
        "description": "See distant locations and events with your mind's eye",
        "lessons": 9,
        "category": "advanced",
        "free": False
    },
    {
        "id": "advanced-3",
        "title": "Psychic Protection",
        "description": "Shield yourself from negative energies and entities",
        "lessons": 5,
        "category": "advanced",
        "free": False
    }
]

# Lesson content for all training modules
LESSON_CONTENT = {
    "beginner-1": [
        {
            "id": 1,
            "title": "Introduction to the Third Eye",
            "content": """The third eye, also known as the Ajna chakra, is located between your eyebrows. It is the center of intuition, insight, and psychic perception.

**What is the Third Eye?**
The third eye is your connection to higher consciousness and inner wisdom. When activated, it allows you to:
- See beyond physical reality
- Access intuitive knowledge
- Receive psychic impressions
- Connect with spiritual guidance

**Signs of Third Eye Awakening:**
- Increased intuition
- Vivid dreams
- Sensitivity to light
- Pressure between eyebrows
- Enhanced creativity

**Today's Exercise:**
Close your eyes and focus on the space between your eyebrows. Breathe deeply and imagine a indigo light glowing there. Hold this visualization for 5 minutes.""",
            "meditation": {
                "title": "Third Eye Awakening Meditation",
                "duration": 10,
                "script": """Find a comfortable seated position and gently close your eyes. Take three deep breaths to settle into this moment.

[pause for 10 seconds]

Bring your awareness to the space between your eyebrows - your third eye center. Simply notice this area without trying to change anything.

[pause for 15 seconds]

Now visualize a small point of indigo light at your third eye. See it glowing softly, like a distant star in the night sky.

[pause for 20 seconds]

With each inhale, imagine this light growing slightly brighter. With each exhale, feel yourself relaxing more deeply.

[pause for 30 seconds]

Allow the indigo light to expand gently, filling the space behind your forehead with its soothing glow. There is no effort needed - just allow.

[pause for 45 seconds]

If any images, colors, or impressions arise, simply observe them without judgment. You are opening the doorway to your inner vision.

[pause for 60 seconds]

Feel a gentle warmth or tingling at your third eye. This is your psychic center awakening. Welcome this sensation.

[pause for 45 seconds]

Now slowly let the light soften. Know that your third eye remains active, ready to guide you with intuitive wisdom.

[pause for 20 seconds]

Take a deep breath and gently return your awareness to your body. When you're ready, slowly open your eyes."""
            }
        },
        {
            "id": 2,
            "title": "Preparing Your Mind",
            "content": """Before opening your third eye, you must prepare your mind through mental clarity and focus.

**Clearing Mental Clutter:**
1. Find a quiet space free from distractions
2. Release any expectations or fears
3. Let go of analytical thinking
4. Embrace stillness and receptivity

**Grounding Exercise:**
- Sit comfortably with feet flat on the floor
- Visualize roots growing from your feet into the earth
- Feel stable, secure, and connected
- This grounding prevents disorientation during third eye work

**Breathing for Clarity:**
Practice 4-7-8 breathing:
- Inhale for 4 counts
- Hold for 7 counts
- Exhale for 8 counts
- Repeat 4 times

This calms the nervous system and prepares you for deeper perception.""",
            "meditation": {
                "title": "Mental Clarity & Grounding Meditation",
                "duration": 12,
                "script": """Sit comfortably with your feet flat on the floor. Close your eyes and take a deep, cleansing breath.

[pause for 10 seconds]

Begin by noticing any mental chatter. Don't fight it - simply observe your thoughts as if watching clouds pass across the sky.

[pause for 20 seconds]

Now we'll practice 4-7-8 breathing. Inhale through your nose for 4 counts... 1, 2, 3, 4.

[pause for 2 seconds]

Hold your breath for 7 counts... 1, 2, 3, 4, 5, 6, 7.

[pause for 2 seconds]

Exhale slowly through your mouth for 8 counts... 1, 2, 3, 4, 5, 6, 7, 8.

[pause for 5 seconds]

Let's repeat this three more times at your own pace.

[pause for 60 seconds]

Now bring your attention to your feet. Visualize roots growing from the soles of your feet, extending deep into the earth below.

[pause for 30 seconds]

See these roots reaching down through soil and rock, anchoring you firmly to the planet. Feel yourself becoming stable and grounded.

[pause for 30 seconds]

Draw earth energy up through these roots - a warm, golden light rising through your feet, your legs, filling your entire body with stability.

[pause for 45 seconds]

Your mind is now clear. Your body is grounded. You are prepared for deeper psychic work.

[pause for 20 seconds]

Take a final deep breath and slowly open your eyes, maintaining this grounded clarity."""
            }
        },
        {
            "id": 3,
            "title": "Third Eye Meditation",
            "content": """This guided meditation will begin activating your third eye center.

**Preparation:**
- Dim the lights
- Sit in a comfortable position
- Close your eyes gently

**The Meditation:**
1. Take three deep breaths to center yourself
2. Focus your attention on the point between your eyebrows
3. Visualize a small indigo sphere of light there
4. With each breath, see this light growing brighter
5. Feel warmth or tingling in this area
6. Allow any images or impressions to arise naturally
7. Don't force anything - simply observe
8. Continue for 10-15 minutes

**After the Meditation:**
- Open your eyes slowly
- Journal any images, colors, or feelings you experienced
- Drink water to stay grounded""",
            "meditation": {
                "title": "Deep Third Eye Activation",
                "duration": 15,
                "script": """Dim the lights around you if possible. Sit in a position that allows your spine to be straight yet relaxed. Close your eyes.

[pause for 10 seconds]

Take three deep breaths, releasing any tension with each exhale.

[pause for 15 seconds]

Bring all of your attention to the point between your eyebrows. Feel as if your consciousness is gathering there.

[pause for 20 seconds]

Visualize a small sphere of deep indigo light at your third eye. See it pulsing gently with each heartbeat.

[pause for 30 seconds]

With your next inhale, see this sphere of light expand slightly. It grows brighter, more luminous.

[pause for 10 seconds]

Continue this pattern - each breath causes the light to grow and intensify.

[pause for 45 seconds]

You may begin to feel warmth, tingling, or gentle pressure at your third eye. This is normal and welcome. Lean into these sensations.

[pause for 60 seconds]

Now allow the indigo light to open like a flower blooming. Petals of light unfold, revealing your inner vision.

[pause for 30 seconds]

In this open state, simply receive. Allow any images, colors, symbols, or impressions to arise. Don't analyze - just observe.

[pause for 90 seconds]

Whatever you experienced is valid. Your third eye is awakening at exactly the right pace for you.

[pause for 30 seconds]

Gently visualize the light softening, the petals closing slightly - not fully, just enough to protect this sacred center.

[pause for 20 seconds]

Take a deep breath, feel your physical body, and when ready, slowly open your eyes. Take a moment to journal your experience."""
            }
        },
        {
            "id": 4,
            "title": "Strengthening Inner Vision",
            "content": """Now we'll practice exercises to strengthen your inner sight.

**Visualization Exercise - The Blue Flame:**
1. Close your eyes and relax
2. Imagine a deep blue flame at your third eye
3. See it flickering gently
4. Notice its color, brightness, and movement
5. Hold this image for 5 minutes

**Remote Viewing Basics:**
- Have a friend place an object in another room
- Sit quietly and focus on your third eye
- Ask to "see" the object
- Note any impressions: colors, shapes, textures
- Don't judge - just receive

**Symbol Recognition:**
- Have someone draw a simple symbol on paper
- Without seeing it, tune into your third eye
- Describe what you perceive
- Practice daily to improve accuracy""",
            "meditation": {
                "title": "Blue Flame Visualization Practice",
                "duration": 10,
                "script": """Close your eyes and settle into a comfortable position. Take a few breaths to center yourself.

[pause for 15 seconds]

Focus your attention on your third eye center. Feel the energy gathering there.

[pause for 10 seconds]

Now visualize a flame appearing at your third eye - not an ordinary flame, but a mystical blue flame. See its deep, sapphire color.

[pause for 20 seconds]

Watch this blue flame flicker and dance gently. Notice its shape, its movement, its ethereal quality.

[pause for 30 seconds]

See the flame grow slightly taller, its blue light illuminating the darkness behind your closed eyes.

[pause for 30 seconds]

This blue flame represents your inner vision - your ability to see beyond the physical. As you strengthen this flame, you strengthen your sight.

[pause for 45 seconds]

Now imagine the flame casting its blue light outward, like a searchlight. It can illuminate anything you focus on.

[pause for 30 seconds]

Direct this light toward something you wish to understand better. What do you see? What impressions arise?

[pause for 45 seconds]

Gently bring the flame back to a soft glow at your third eye. Thank it for its service.

[pause for 15 seconds]

Take a deep breath and slowly open your eyes, carrying this strengthened inner vision with you."""
            }
        },
        {
            "id": 5,
            "title": "Integrating Your Third Eye",
            "content": """Learn to use your awakened third eye in daily life.

**Daily Practices:**
- Morning meditation focusing on the third eye (5 min)
- Throughout the day, pause and check your intuition
- Before sleep, review intuitive hits you received
- Keep an intuition journal

**Working with Your Third Eye:**
When making decisions:
1. Pause and close your eyes
2. Focus on your third eye
3. Ask your question internally
4. Notice the first impression you receive
5. Trust this guidance

**Signs of Progress:**
- Increased synchronicities
- More vivid dreams with messages
- Knowing things before they happen
- Seeing auras or energy
- Stronger gut feelings

**Protection:**
Always close your session by:
- Thanking your higher self
- Visualizing the indigo light dimming slightly
- Grounding yourself with deep breaths
- Returning to normal awareness gently""",
            "meditation": {
                "title": "Daily Third Eye Integration",
                "duration": 8,
                "script": """This is a quick daily practice to keep your third eye active and integrated into your life. Close your eyes.

[pause for 5 seconds]

Take three conscious breaths, arriving fully in this moment.

[pause for 10 seconds]

Quickly scan your body from feet to head, noticing any tension and releasing it.

[pause for 15 seconds]

Bring your awareness to your third eye. Feel it as if it were a real eye - awake, alert, ready to perceive.

[pause for 20 seconds]

Set an intention: "My third eye guides me wisely today. I trust my intuition."

[pause for 15 seconds]

Visualize a quick flash of indigo light at your third eye - activating it for the day ahead.

[pause for 10 seconds]

Ask your higher self: "What do I need to know today?" Wait for any impressions.

[pause for 30 seconds]

Accept whatever came - or didn't come. Trust that guidance will arrive when needed.

[pause for 10 seconds]

Visualize a gentle protective light around your third eye, allowing only beneficial information to enter.

[pause for 10 seconds]

Ground yourself by feeling your feet on the earth. Take a deep breath and open your eyes.

You are now ready to move through your day with heightened intuition and inner guidance."""
            }
        }
    ],
    "beginner-2": [
        {
            "id": 1,
            "title": "What is Meditation?",
            "content": """Meditation is the foundation of all psychic development. It trains your mind to be still, focused, and receptive.

**Benefits of Meditation:**
- Calms the mind and reduces stress
- Increases awareness and perception
- Opens channels for intuitive information
- Strengthens concentration
- Connects you to higher consciousness

**Types of Meditation:**
- **Focused attention**: Concentrating on one thing (breath, candle, mantra)
- **Open monitoring**: Observing thoughts without attachment
- **Loving-kindness**: Cultivating compassion
- **Visualization**: Creating mental images
- **Transcendental**: Using mantras to transcend thought

**Getting Started:**
- Start with just 5 minutes daily
- Same time and place builds habit
- Comfortable position (sitting or lying down)
- No judgment - wandering thoughts are normal""",
            "meditation": {
                "title": "Your First Meditation",
                "duration": 8,
                "script": """Welcome to your first meditation practice. There's nothing to achieve here - simply be present.

[pause for 5 seconds]

Find a comfortable position. You can sit in a chair with feet flat, or on the floor with legs crossed. Close your eyes.

[pause for 10 seconds]

Notice how you feel right now. Don't try to change anything - just observe.

[pause for 15 seconds]

Bring your attention to your breath. Notice the natural rhythm of your breathing. You don't need to control it.

[pause for 20 seconds]

Feel the air entering through your nose, cool and fresh. Feel it leaving, slightly warmer.

[pause for 30 seconds]

Your mind will wander - this is completely normal. When you notice thoughts arising, simply label them "thinking" and return to your breath.

[pause for 45 seconds]

There's no such thing as a bad meditation. Every moment you spend in awareness is valuable.

[pause for 30 seconds]

Continue following your breath. In... and out. Simple and natural.

[pause for 45 seconds]

Begin to deepen your breath slightly. Feel your body. Hear the sounds around you.

[pause for 10 seconds]

When you're ready, gently open your eyes. Congratulations - you've meditated."""
            }
        },
        {
            "id": 2,
            "title": "Breath Awareness",
            "content": """The breath is your anchor to the present moment and a powerful tool for psychic development.

**Basic Breath Meditation:**
1. Sit comfortably with spine straight
2. Close your eyes softly
3. Notice your natural breathing
4. Don't change it - just observe
5. Feel the air entering your nostrils
6. Feel your chest and belly rise
7. Notice the pause between breaths
8. Continue for 10 minutes

**Counting Breaths:**
- Inhale, count "1"
- Exhale, count "2"
- Continue to 10, then restart
- If you lose count, gently begin again

**Energy Breathing:**
- Visualize breathing in white light
- See it filling your entire body
- Exhale any tension or darkness
- Feel yourself becoming lighter""",
            "meditation": {
                "title": "Breath Awareness Practice",
                "duration": 12,
                "script": """Settle into a comfortable seated position with your spine straight but relaxed. Close your eyes.

[pause for 10 seconds]

For the first minute, simply notice your natural breathing. Don't change it - observe it like a curious scientist.

[pause for 30 seconds]

Where do you feel the breath most strongly? Your nostrils? Your chest? Your belly? Focus on that area.

[pause for 30 seconds]

Now we'll practice counting breaths. As you inhale, mentally count "one." As you exhale, count "two." Continue up to ten.

[pause for 5 seconds]

Begin now. One... two... three... four...

[pause for 60 seconds]

If you lost count, simply start again at one. This is part of the practice.

[pause for 30 seconds]

Now release the counting. Simply follow each breath with your full attention.

[pause for 45 seconds]

Notice the brief pause between the inhale and exhale. Rest in that stillness.

[pause for 30 seconds]

Now add visualization. As you inhale, imagine breathing in pure white light. See it filling your body.

[pause for 20 seconds]

As you exhale, release any darkness, tension, or negativity. Let it dissolve.

[pause for 45 seconds]

Continue this light breathing, feeling yourself becoming clearer and brighter with each breath.

[pause for 30 seconds]

Gently release the visualization and return to normal breathing. Open your eyes when ready."""
            }
        },
        {
            "id": 3,
            "title": "Body Scan Meditation",
            "content": """Developing body awareness enhances your ability to sense energy and receive psychic impressions.

**The Body Scan:**
1. Lie down comfortably
2. Close your eyes
3. Take three deep breaths

4. Focus on your feet - notice any sensations
5. Move attention to your ankles
6. Continue up through your legs
7. Notice your hips and lower back
8. Feel your abdomen and chest
9. Scan your hands, arms, shoulders
10. Observe your neck, face, and head

**What to Notice:**
- Temperature (warm/cool)
- Tension or relaxation
- Tingling or pulsing
- Heaviness or lightness
- Any emotions arising

**Practice:**
Do this scan daily. Over time, you'll notice subtle energy sensations that indicate psychic awakening.""",
            "meditation": {
                "title": "Complete Body Scan",
                "duration": 15,
                "script": """Lie down on your back in a comfortable position. Let your arms rest at your sides, palms facing up. Close your eyes.

[pause for 10 seconds]

Take three deep breaths, allowing your body to settle and relax with each exhale.

[pause for 15 seconds]

Bring your awareness to your feet. Notice any sensations there - warmth, coolness, tingling, pressure. Simply observe.

[pause for 20 seconds]

Move your attention to your ankles and lower legs. Scan slowly, noticing the sensations without judging them.

[pause for 20 seconds]

Now bring awareness to your knees and thighs. Feel the weight of your legs resting on the surface beneath you.

[pause for 20 seconds]

Notice your hips and pelvis. This area often holds tension. Breathe into any tightness you find.

[pause for 20 seconds]

Scan your lower back and abdomen. Feel the gentle rise and fall of your belly with each breath.

[pause for 20 seconds]

Move up to your chest and upper back. Notice your heartbeat. Feel your ribcage expand and contract.

[pause for 20 seconds]

Bring awareness to your hands - each finger, your palms, your wrists. Notice any subtle sensations.

[pause for 20 seconds]

Scan up through your forearms, upper arms, and shoulders. Let any tension melt away.

[pause for 20 seconds]

Notice your neck and throat. Relax your jaw. Let your tongue rest softly.

[pause for 20 seconds]

Finally, scan your face and head - your eyes, forehead, the crown of your head. Feel your entire body now as one unified field of awareness.

[pause for 30 seconds]

Take a deep breath, filling your whole body with energy. Slowly begin to move your fingers and toes, and when ready, open your eyes."""
            }
        },
        {
            "id": 4,
            "title": "Mantra Meditation",
            "content": """Mantras are sacred sounds that raise your vibration and open psychic channels.

**What is a Mantra?**
A mantra is a word or phrase repeated during meditation. The vibration affects your energy field and consciousness.

**Powerful Mantras:**
- **OM**: The universal sound of creation
- **SO HUM**: "I am that" - connects to infinite consciousness
- **OM MANI PADME HUM**: Awakens compassion
- **I AM**: Affirms your divine nature

**How to Practice:**
1. Choose one mantra
2. Sit comfortably
3. Close your eyes
4. Begin repeating the mantra silently
5. Let it become effortless
6. If thoughts arise, return to the mantra
7. Practice for 15-20 minutes

**Using Mala Beads:**
- Hold beads in your right hand
- Move one bead per mantra repetition
- Complete 108 repetitions for full effect""",
            "meditation": {
                "title": "OM Mantra Practice",
                "duration": 12,
                "script": """Sit in a comfortable position with your spine straight. Rest your hands on your knees. Close your eyes.

[pause for 10 seconds]

Take a few deep breaths to center yourself.

[pause for 15 seconds]

We will use the mantra OM - the primordial sound of the universe. This sound connects you to all that is.

[pause for 10 seconds]

First, I'll chant OM aloud three times. Feel the vibration in your body. Then you'll continue silently.

[pause for 5 seconds]

OOOOMMMMM...

[pause for 8 seconds]

OOOOMMMMM...

[pause for 8 seconds]

OOOOMMMMM...

[pause for 10 seconds]

Now begin repeating OM silently in your mind. Let the sound arise naturally with each exhale.

[pause for 60 seconds]

Feel the mantra vibrating through your entire being. Each repetition raises your vibration higher.

[pause for 45 seconds]

If thoughts interrupt, simply return to OM. The mantra is your anchor.

[pause for 45 seconds]

Now let the mantra fade into the background. Rest in the silence and expanded awareness it has created.

[pause for 30 seconds]

Feel the heightened state of consciousness you've accessed through this ancient practice.

[pause for 20 seconds]

Take a deep breath and slowly return to normal awareness. Open your eyes when ready."""
            }
        },
        {
            "id": 5,
            "title": "Walking Meditation",
            "content": """Not all meditation requires sitting still. Walking meditation develops awareness in motion.

**Basic Walking Meditation:**
1. Choose a quiet path
2. Stand still and breathe deeply
3. Begin walking slowly
4. Notice each step: lifting, moving, placing
5. Feel your feet connecting with the ground
6. Stay present with each movement
7. Walk for 10-20 minutes

**Sensory Walking:**
- Notice what you see without labeling
- Hear sounds near and far
- Feel the air on your skin
- Smell the environment
- Experience fully without thinking

**Energy Walking:**
- Visualize energy entering through your feet
- See it flowing up through your body
- Release it through your crown
- Feel connected to earth and sky""",
            "meditation": {
                "title": "Mindful Walking Practice",
                "duration": 10,
                "script": """Stand at the beginning of your chosen walking path. Take a moment to feel your feet on the ground.

[pause for 10 seconds]

Take three deep breaths, centering your awareness in your body.

[pause for 10 seconds]

Set an intention: "I walk with full presence and awareness."

[pause for 5 seconds]

Begin walking very slowly. Lift your right foot. Notice the sensation of lifting.

[pause for 5 seconds]

Move your foot forward. Feel the movement through space.

[pause for 5 seconds]

Place your foot down. Feel the heel, then the ball, then the toes making contact with the earth.

[pause for 5 seconds]

Now lift your left foot. Continue this slow, deliberate walking.

[pause for 30 seconds]

With each step, feel yourself more connected to the ground beneath you. You are walking on the earth itself.

[pause for 30 seconds]

Now expand your awareness while continuing to walk. Notice what you see around you - colors, shapes, movement.

[pause for 30 seconds]

Hear the sounds - near and far. Let them enter without labeling or judging.

[pause for 30 seconds]

Feel the air on your skin. Notice temperature, movement of breeze.

[pause for 30 seconds]

Now visualize energy from the earth rising up through your feet with each step. Feel it filling your body with each footfall.

[pause for 30 seconds]

Gradually slow to a stop. Stand still and feel the accumulated presence and energy. Bow slightly to honor your practice."""
            }
        },
        {
            "id": 6,
            "title": "Loving-Kindness Meditation",
            "content": """Developing compassion opens the heart chakra and enhances empathic abilities.

**The Practice:**
1. Sit comfortably and close your eyes
2. Breathe deeply and relax

**Direct love to yourself:**
- "May I be happy"
- "May I be healthy"
- "May I be safe"
- "May I live with ease"

**Extend to loved ones:**
- Visualize someone you love
- Repeat the phrases for them

**Extend to neutral people:**
- Think of someone you don't know well
- Send them the same wishes

**Extend to difficult people:**
- Think of someone challenging
- Offer them loving-kindness

**Extend to all beings:**
- "May all beings be happy"
- "May all beings be free from suffering"

This practice develops empathy, essential for psychic connection.""",
            "meditation": {
                "title": "Loving-Kindness (Metta) Meditation",
                "duration": 15,
                "script": """Sit comfortably and close your eyes. Take a few breaths to settle in.

[pause for 10 seconds]

Place your hand on your heart. Feel its steady beat - the center of love within you.

[pause for 15 seconds]

We begin by offering loving-kindness to yourself. Silently repeat: "May I be happy."

[pause for 10 seconds]

"May I be healthy."

[pause for 10 seconds]

"May I be safe."

[pause for 10 seconds]

"May I live with ease."

[pause for 15 seconds]

Feel these wishes as genuine blessings to yourself. You deserve this kindness.

[pause for 20 seconds]

Now think of someone you love deeply. See their face clearly. Repeat: "May you be happy. May you be healthy. May you be safe. May you live with ease."

[pause for 30 seconds]

Feel your love flowing to this person like warm light.

[pause for 20 seconds]

Now think of someone neutral - perhaps a neighbor or shopkeeper you've seen but don't know well. Send them the same wishes: "May you be happy. May you be healthy. May you be safe. May you live with ease."

[pause for 30 seconds]

Now - and this can be challenging - think of someone difficult in your life. They too suffer and want happiness. Offer them: "May you be happy. May you be healthy. May you be safe. May you live with ease."

[pause for 30 seconds]

Finally, expand to all beings everywhere: "May all beings be happy. May all beings be healthy. May all beings be safe. May all beings live with ease."

[pause for 30 seconds]

Feel your heart expanded, connected to all life. Take a deep breath and slowly open your eyes."""
            }
        },
        {
            "id": 7,
            "title": "Creating a Daily Practice",
            "content": """Consistency is key for psychic development. Create a sustainable meditation routine.

**Building Your Practice:**
- Start with 5-10 minutes
- Same time daily (morning is ideal)
- Same location builds energy
- Gradually increase duration

**Sample Morning Routine:**
1. Wake and hydrate
2. Light a candle
3. 5 minutes breath awareness
4. 5 minutes third eye focus
5. Set intention for the day
6. Journal any insights

**Evening Practice:**
1. Review the day's intuitive hits
2. 10 minutes relaxation meditation
3. Gratitude reflection
4. Dream intention setting

**Overcoming Obstacles:**
- Busy schedule? Start with 3 minutes
- Mind racing? That's normal - keep going
- Sleepy? Try sitting instead of lying down
- Bored? Try different techniques

**Tracking Progress:**
Keep a meditation journal noting:
- Date and duration
- Technique used
- How you felt before/after
- Any insights or experiences""",
            "meditation": {
                "title": "Morning Activation Practice",
                "duration": 10,
                "script": """This is your morning practice to start each day with clarity and intention. Sit comfortably and close your eyes.

[pause for 5 seconds]

Take three deep breaths, awakening your body and mind.

[pause for 15 seconds]

Scan quickly from feet to head, noticing how you feel this morning. No judgment - just awareness.

[pause for 15 seconds]

Bring attention to your breath. Follow five complete breaths with full presence.

[pause for 30 seconds]

Now focus on your third eye center. Visualize a quick flash of indigo light - activating your intuition for the day.

[pause for 15 seconds]

Open your heart center with a feeling of gratitude. Think of one thing you're grateful for this morning.

[pause for 20 seconds]

Set an intention for your day. What quality do you want to embody? What do you want to create or experience?

[pause for 20 seconds]

Silently state: "I move through this day with awareness, compassion, and openness to guidance."

[pause for 15 seconds]

Visualize your day unfolding positively. See yourself calm, focused, and receptive to intuition.

[pause for 20 seconds]

Ground yourself by feeling your connection to the earth. Take a deep breath of energy and possibility.

[pause for 10 seconds]

Open your eyes slowly. You are ready for your day."""
            }
        }
    ],
    "beginner-3": [
        {
            "id": 1,
            "title": "Understanding Energy",
            "content": """Everything is energy. Learning to sense and work with energy is fundamental to psychic development.

**What is Energy?**
- All matter vibrates at different frequencies
- Thoughts and emotions are energy
- Living beings have energy fields (auras)
- Energy can be sensed, directed, and transformed

**Types of Energy:**
- **Personal energy**: Your own life force (chi, prana)
- **Environmental energy**: Energy of places and spaces
- **Emotional energy**: Feelings that radiate from people
- **Spiritual energy**: Higher vibrational frequencies

**First Sensing Exercise:**
1. Rub your palms together vigorously for 30 seconds
2. Slowly pull hands apart
3. Notice the sensation between your palms
4. Move hands closer, then apart
5. Feel the energy ball you've created

This is your first step to energy awareness.""",
            "meditation": {
                "title": "Energy Sensing Practice",
                "duration": 10,
                "script": """Sit comfortably and close your eyes. Take a few centering breaths.

[pause for 10 seconds]

We'll begin by activating the energy centers in your hands. Rub your palms together vigorously for 30 seconds.

[pause for 30 seconds]

Now slowly stop rubbing and hold your hands about 6 inches apart, palms facing each other. Don't let them touch.

[pause for 10 seconds]

Notice what you feel between your palms. Warmth? Tingling? Pressure? Magnetism? This is energy.

[pause for 20 seconds]

Slowly move your hands closer together, stopping before they touch. Feel the energy compress between them.

[pause for 15 seconds]

Now slowly move them apart again. Feel the energy stretch.

[pause for 15 seconds]

Play with this - moving closer, moving apart. You're feeling your own life force energy.

[pause for 30 seconds]

Now imagine you're holding a ball of glowing light between your palms. See its color - whatever appears.

[pause for 20 seconds]

Make the ball larger, then smaller. Feel the energy respond to your intention.

[pause for 20 seconds]

When ready, bring your palms together and absorb this energy back into your body. Feel it spreading through you.

[pause for 15 seconds]

Take a breath and open your eyes. You've just consciously worked with energy."""
            }
        },
        {
            "id": 2,
            "title": "Feeling Your Aura",
            "content": """Your aura is the energy field surrounding your body. Learning to feel it strengthens psychic perception.

**What is the Aura?**
- Extends 2-3 feet from the body
- Contains multiple layers
- Reflects physical, emotional, mental, spiritual states
- Changes color based on mood and health

**Sensing Your Aura:**
1. Stand in a relaxed position
2. Close your eyes
3. Extend your awareness beyond your skin
4. Notice where your energy field ends
5. You may feel warmth, tingling, or pressure

**Hand Scanning:**
1. Hold your hand 6 inches from your body
2. Slowly move it toward your skin
3. Notice when you feel resistance or warmth
4. This is the edge of your aura

**Expanding Your Aura:**
- Breathe deeply
- Visualize your aura growing
- Push it outward with intention
- Fill the room with your energy""",
            "meditation": {
                "title": "Aura Awareness Meditation",
                "duration": 12,
                "script": """Stand if possible, or sit with your spine straight. Close your eyes.

[pause for 10 seconds]

Take three deep breaths, feeling yourself become more present and aware.

[pause for 15 seconds]

Begin by feeling the boundaries of your physical body - your skin, the edge of your form.

[pause for 15 seconds]

Now extend your awareness just beyond your skin. Feel the space immediately around your body - this is your etheric field.

[pause for 20 seconds]

Push your awareness further out. Feel your energy extending 6 inches, then a foot, then two feet beyond your body.

[pause for 20 seconds]

Notice where your energy field seems to end. You might feel a subtle edge, a shift in sensation.

[pause for 20 seconds]

Now raise one hand. Hold it about 2 feet from your torso. Slowly move it toward your body.

[pause for 10 seconds]

Notice any sensations as your hand passes through layers of your aura. Warmth? Tingling? Resistance?

[pause for 20 seconds]

Return your hand to your side. Now we'll expand your aura.

[pause for 5 seconds]

With each inhale, visualize your aura growing larger, more luminous. Push it outward with intention.

[pause for 30 seconds]

Feel yourself filling the room with your energy field. You are larger than your physical body.

[pause for 20 seconds]

Now gently draw your aura back to a comfortable size - about arm's length from your body.

[pause for 15 seconds]

Take a deep breath and open your eyes, maintaining awareness of the energy field around you."""
            }
        },
        {
            "id": 3,
            "title": "Seeing Auras",
            "content": """With practice, you can see the energy fields around people and objects.

**Preparation:**
- Soft, natural lighting works best
- White or neutral backgrounds
- Relaxed, unfocused gaze

**Exercise 1 - Your Hands:**
1. Hold your hand against a white wall
2. Soften your gaze
3. Look slightly past your hand
4. Notice a faint glow around your fingers
5. This is the etheric layer of your aura

**Exercise 2 - Another Person:**
1. Have someone stand against a plain wall
2. Look at their forehead or shoulder
3. Use peripheral vision
4. Notice colors or light around them

**Aura Colors:**
- **Red**: Passion, energy, anger
- **Orange**: Creativity, confidence
- **Yellow**: Intellect, optimism
- **Green**: Healing, growth, balance
- **Blue**: Communication, calm
- **Purple**: Intuition, spirituality
- **White**: Pure, high vibration""",
            "meditation": {
                "title": "Developing Aura Vision",
                "duration": 10,
                "script": """For this practice, you'll need to keep your eyes open with a soft gaze. Sit facing a plain, light-colored wall.

[pause for 10 seconds]

Take a few deep breaths to relax your body and mind.

[pause for 15 seconds]

Hold one hand up in front of you, about a foot from your face, against the plain background.

[pause for 10 seconds]

Soften your gaze. Don't focus directly on your hand - look slightly past it. Let your vision become gentle and unfocused.

[pause for 20 seconds]

In your peripheral vision, begin to notice the space immediately around your fingers. Don't strain - just softly observe.

[pause for 30 seconds]

You may begin to see a faint glow - often appearing as a thin line of light around your fingers. This is your etheric aura.

[pause for 30 seconds]

If you don't see it yet, that's okay. Close your eyes and visualize light around your hand. Then open and look again with soft eyes.

[pause for 30 seconds]

Now spread your fingers apart. Notice if the glow extends between them.

[pause for 20 seconds]

The more you practice this soft gaze, the more easily you'll perceive auras. It's like a muscle - it strengthens with use.

[pause for 15 seconds]

Lower your hand and close your eyes for a moment. Know that your aura vision is developing.

[pause for 10 seconds]

Open your eyes normally. Practice this technique daily."""
            }
        },
        {
            "id": 4,
            "title": "Energy of Places",
            "content": """Places hold energy from events and emotions that occurred there.

**Sensing Place Energy:**
1. Enter a new space slowly
2. Stand still and close your eyes
3. Notice your first impressions
4. Does it feel heavy or light?
5. Warm or cold?
6. Welcoming or uncomfortable?

**Types of Place Energy:**
- **Sacred sites**: Temples, churches, ancient places
- **Natural power spots**: Mountains, forests, water
- **Traumatic locations**: Sites of tragedy hold heavy energy
- **Happy places**: Parks, homes full of love

**Clearing Space Energy:**
- Open windows for fresh air
- Ring a bell or clap in corners
- Burn sage or palo santo
- Set intention for positive energy
- Visualize white light filling the space

**Creating Sacred Space:**
- Clear the energy regularly
- Add crystals and plants
- Keep it clean and organized
- Use it for meditation and practice""",
            "meditation": {
                "title": "Space Energy Sensing",
                "duration": 8,
                "script": """For this meditation, remain where you are. We'll practice sensing the energy of your current space.

[pause for 5 seconds]

Close your eyes and take a few deep breaths.

[pause for 10 seconds]

Without moving, extend your awareness into the room around you. Don't analyze - just feel.

[pause for 15 seconds]

What is your first impression of this space right now? Heavy or light? Calm or agitated?

[pause for 15 seconds]

Notice any areas that feel different. Perhaps one corner feels different from another. Just observe.

[pause for 20 seconds]

Feel the history of this space. What emotions have been expressed here? What energy lingers?

[pause for 20 seconds]

Now imagine white light beginning to fill the room, starting from where you sit.

[pause for 15 seconds]

See this light expanding, touching every corner, every surface. It's clearing any stagnant or negative energy.

[pause for 20 seconds]

Set an intention for this space. What energy do you want it to hold? Peace? Creativity? Healing?

[pause for 15 seconds]

Feel the space responding to your intention, aligning with your vision.

[pause for 10 seconds]

Take a deep breath. Open your eyes and look at your space with fresh perception."""
            }
        },
        {
            "id": 5,
            "title": "Energy Exchange",
            "content": """We constantly exchange energy with others. Learning to manage this is essential.

**How Energy Exchange Works:**
- Conversations transfer energy
- Emotions are contagious
- Some people drain energy (energy vampires)
- Some people boost energy

**Protecting Your Energy:**
1. **Shielding**: Visualize protective light around you
2. **Grounding**: Connect to earth's stabilizing energy
3. **Cord cutting**: Release unhealthy attachments
4. **Cleansing**: Clear absorbed energy daily

**Shield Visualization:**
- See yourself surrounded by golden light
- Make it into a protective bubble
- Set intention that it filters out negativity
- Refresh this shield daily

**After Social Interactions:**
- Take a salt bath
- Spend time in nature
- Meditate to clear absorbed energy
- Practice grounding exercises""",
            "meditation": {
                "title": "Energy Shield Activation",
                "duration": 10,
                "script": """Sit or stand comfortably. Close your eyes and center yourself with a few breaths.

[pause for 10 seconds]

Feel your own energy field around you. Know that this field can protect you.

[pause for 15 seconds]

Visualize a beautiful golden light beginning to form at your heart center.

[pause for 15 seconds]

See this golden light expanding outward, surrounding your entire body in a luminous cocoon.

[pause for 20 seconds]

Watch as this light forms a complete bubble around you - above, below, and on all sides. You are enclosed in golden protection.

[pause for 20 seconds]

Set the intention: "This shield allows love and positive energy to enter, while deflecting all negativity."

[pause for 15 seconds]

See the outer surface of your shield becoming slightly mirror-like - reflecting back any harmful energy sent your way.

[pause for 20 seconds]

Feel completely safe and protected within your golden bubble. Nothing can harm you here.

[pause for 20 seconds]

Know that this shield will remain with you throughout your day. You can strengthen it anytime by taking a breath and visualizing it.

[pause for 15 seconds]

Ground yourself by feeling your feet on the earth. Open your eyes, carrying your protection with you."""
            }
        },
        {
            "id": 6,
            "title": "Working with Crystals",
            "content": """Crystals are powerful energy tools that can enhance your psychic abilities.

**How Crystals Work:**
- Each crystal has unique vibration
- They can absorb, store, and transmit energy
- They amplify intention and healing

**Essential Crystals for Psychic Development:**
- **Clear Quartz**: Amplifies energy and intention
- **Amethyst**: Opens third eye, enhances intuition
- **Black Tourmaline**: Protection and grounding
- **Labradorite**: Psychic abilities and transformation
- **Selenite**: Cleansing and spiritual connection

**Using Crystals:**
1. **Meditation**: Hold crystal or place on third eye
2. **Wearing**: Carry in pocket or wear as jewelry
3. **Space clearing**: Place in corners of room
4. **Sleeping**: Under pillow for dream work

**Cleansing Crystals:**
- Moonlight (especially full moon)
- Running water (not for all crystals)
- Sage smoke
- Sound (bells, singing bowls)
- Selenite plate""",
            "meditation": {
                "title": "Crystal Attunement Meditation",
                "duration": 10,
                "script": """If you have a crystal, hold it in your hands. If not, you can visualize one. Close your eyes.

[pause for 10 seconds]

Take three deep breaths, centering yourself.

[pause for 10 seconds]

Feel the crystal in your hands or in your mind's eye. Notice its weight, its temperature, its texture.

[pause for 15 seconds]

Crystals are ancient beings of the earth. They hold wisdom and energy from millions of years.

[pause for 15 seconds]

Set an intention to connect with this crystal's energy. Say silently: "I am open to receiving your gifts."

[pause for 15 seconds]

Begin to sense the crystal's unique vibration. It might feel like tingling, warmth, or a subtle hum.

[pause for 25 seconds]

Ask the crystal: "What do you want me to know?" Listen with your inner senses for any message.

[pause for 30 seconds]

Now visualize the crystal's energy merging with yours - amplifying your own abilities and intentions.

[pause for 20 seconds]

Thank the crystal for its partnership. Know that you can call on its energy whenever you work together.

[pause for 15 seconds]

Take a deep breath and open your eyes, maintaining connection with your crystal ally."""
            }
        }
    ],
    "beginner-4": [
        {
            "id": 1,
            "title": "What is Automatic Writing?",
            "content": """Automatic writing is a practice where you allow messages to flow through you onto paper, bypassing the conscious mind.

**Understanding Automatic Writing:**
- Also called psychography or spirit writing
- The hand writes without conscious direction
- Messages may come from your higher self, guides, or the subconscious
- A form of channeling through written word

**Benefits:**
- Accesses deeper wisdom
- Bypasses mental blocks
- Connects with spiritual guidance
- Provides clarity on life questions
- Develops trust in intuition

**What to Expect:**
- Initially, writing may seem like gibberish
- With practice, coherent messages emerge
- May feel like thoughts flow faster than normal
- Hand may move on its own
- Don't judge what comes through

**Requirements:**
- Paper and pen (not computer initially)
- Quiet, comfortable space
- Open, receptive mindset
- Patience and regular practice""",
            "meditation": {
                "title": "Preparing for Automatic Writing",
                "duration": 8,
                "script": """Sit at a table with paper and pen ready. Close your eyes for this preparation.

[pause for 10 seconds]

Take several deep breaths, releasing any tension or expectation.

[pause for 15 seconds]

Set an intention: "I am open to receiving messages from my higher wisdom."

[pause for 10 seconds]

Visualize a column of white light descending from above, entering through the crown of your head.

[pause for 15 seconds]

See this light flowing down through your neck, your shoulder, your arm, and into your writing hand.

[pause for 15 seconds]

Your hand is now a channel for wisdom to flow through. You don't need to control it.

[pause for 15 seconds]

Release your conscious mind. Let it step aside, becoming an observer rather than a director.

[pause for 20 seconds]

When you feel ready, open your eyes, hold your pen loosely, and let your hand begin to move.

[pause for 10 seconds]

Don't think about what you're writing. Let the pen flow. Trust the process.

[pause for 10 seconds]

Continue for at least 10 minutes. Then read what came through without judgment."""
            }
        },
        {
            "id": 2,
            "title": "Preparing for Automatic Writing",
            "content": """Proper preparation creates the optimal conditions for receiving clear messages.

**Physical Preparation:**
- Quiet, comfortable space
- Dim lighting
- Comfortable seating with writing surface
- Several sheets of paper
- Pen that flows easily
- Turn off distractions

**Mental Preparation:**
1. Clear your mind through meditation (5-10 minutes)
2. Set intention for the session
3. Release expectations
4. Open your heart to receiving

**Protection:**
- Visualize white light surrounding you
- Set intention to receive only highest guidance
- Ask for protection from negative energies
- State: "Only loving, truthful messages may come through"

**Setting Intention:**
Before writing, ask:
- "What do I need to know today?"
- "Please share wisdom for my highest good"
- Or ask a specific question

**Opening Ritual:**
- Light a candle
- Take three deep breaths
- Say a prayer or affirmation
- Hold your pen loosely
- Begin when you feel ready""",
            "meditation": {
                "title": "Sacred Writing Space Creation",
                "duration": 10,
                "script": """Sit in your writing space with everything you need. Close your eyes.

[pause for 10 seconds]

Take three deep breaths, arriving fully in this moment.

[pause for 15 seconds]

Visualize a sphere of white light surrounding you and your writing space. This is your sacred container.

[pause for 15 seconds]

Within this sphere, you are protected. State silently: "Only loving, truthful messages may enter here."

[pause for 15 seconds]

Call upon your guides, your higher self, the wisdom of the universe. Invite them to communicate through you.

[pause for 20 seconds]

Set your intention clearly. What do you seek guidance on? Or simply state: "I am open to whatever I need to know."

[pause for 15 seconds]

Feel the presence of wisdom gathering around you, ready to flow through your hand.

[pause for 15 seconds]

Release your need to understand or control. Trust that what comes through will serve you.

[pause for 15 seconds]

Take a final deep breath. You are prepared. Open your eyes when ready and begin to write."""
            }
        },
        {
            "id": 3,
            "title": "Your First Session",
            "content": """Let's practice automatic writing for the first time.

**Step-by-Step Guide:**

1. **Settle in** (2 minutes)
   - Sit comfortably
   - Close your eyes
   - Take deep breaths

2. **Set protection and intention** (1 minute)
   - Visualize white light
   - Ask your question or state openness to receive

3. **Begin writing** (10-15 minutes)
   - Hold pen loosely on paper
   - Let hand move freely
   - Don't look at what you're writing
   - Don't edit or judge
   - If stuck, write "I am open to receive" repeatedly

4. **Close the session**
   - Thank your guides/higher self
   - Take three breaths
   - Slowly open your eyes

5. **Review**
   - Read what you wrote
   - Highlight meaningful passages
   - Note any patterns or themes

**Tips for Beginners:**
- Start with 10-minute sessions
- Practice at the same time daily
- Keep all writings in a journal
- Look for improvement over time""",
            "meditation": {
                "title": "First Automatic Writing Session",
                "duration": 15,
                "script": """Have your paper and pen ready. Sit comfortably and close your eyes.

[pause for 10 seconds]

Take five deep breaths, each one releasing more tension, more thought, more control.

[pause for 20 seconds]

Visualize white protective light surrounding you. You are safe and ready to receive.

[pause for 15 seconds]

Set your intention. You might ask: "What do I need to know right now?" Or simply say: "I am open to wisdom."

[pause for 15 seconds]

Feel your arm and hand becoming lighter, almost separate from your conscious control.

[pause for 15 seconds]

Open your eyes now but keep them soft and unfocused. Place your pen on the paper.

[pause for 10 seconds]

Begin to move your pen. Don't think. Let it wander, scribble, write whatever comes.

[pause for 15 seconds]

If words form, let them. If it's just lines and shapes, that's fine too. Don't judge.

[pause for 60 seconds]

Keep writing. If you feel stuck, write "I am open" over and over until something else comes.

[pause for 90 seconds]

Continue to let the pen move. Trust what's coming through you.

[pause for 90 seconds]

Begin to slow down now. Let the writing come to a natural close.

[pause for 15 seconds]

Put down your pen. Close your eyes. Thank whatever wisdom came through.

[pause for 10 seconds]

Take three breaths. Open your eyes and read what you wrote with curiosity, not criticism."""
            }
        },
        {
            "id": 4,
            "title": "Deepening the Connection",
            "content": """As you practice, the connection strengthens and messages become clearer.

**Signs of Progress:**
- Writing flows more easily
- Messages become coherent
- Handwriting may change
- Receiving information you couldn't know
- Feeling presence while writing

**Techniques to Deepen:**

**Non-dominant Hand Writing:**
- Use your other hand
- Bypasses logical mind more effectively
- May feel awkward but produces results

**Stream of Consciousness:**
- Write whatever comes
- No punctuation or stopping
- Fill entire pages without pausing

**Specific Questions:**
Ask clear questions like:
- "What is blocking me?"
- "How can I improve my relationships?"
- "What is my life purpose?"
- "What should I focus on now?"

**Connecting with Guides:**
- Ask to connect with your spirit guide
- Ask their name
- Request their guidance
- Build ongoing relationship""",
            "meditation": {
                "title": "Deepening Your Channel",
                "duration": 12,
                "script": """Prepare for a deeper automatic writing session. Close your eyes and breathe deeply.

[pause for 15 seconds]

Ground yourself by feeling roots extending from your feet into the earth.

[pause for 15 seconds]

Now open your crown chakra at the top of your head. See it as a lotus flower opening to the sky.

[pause for 15 seconds]

Invite your spirit guides, your higher self, your soul to come closer. Feel their presence gathering around you.

[pause for 20 seconds]

Ask: "Please make our connection stronger. Help me receive your messages more clearly."

[pause for 20 seconds]

Feel the channel between your crown and your hand becoming wider, clearer, more open.

[pause for 20 seconds]

You may feel tingling, warmth, or pressure as this connection strengthens.

[pause for 20 seconds]

Now set a specific intention or question. What do you truly want guidance on? State it clearly.

[pause for 15 seconds]

Open your eyes and begin writing. Let the pen move without hesitation or editing.

[pause for 10 seconds]

Write continuously for the next 10 minutes. Trust what flows through you."""
            }
        },
        {
            "id": 5,
            "title": "Interpreting Messages",
            "content": """Learning to understand and apply the messages you receive.

**Reading Your Writing:**
- Read immediately after session
- Read again the next day
- Look for recurring themes
- Notice unusual phrases or words
- Some meanings unfold over time

**Types of Messages:**
- **Direct guidance**: Clear instructions
- **Symbolic**: Images or metaphors to interpret
- **Emotional**: Feelings or sensations described
- **Predictive**: Future possibilities
- **Healing**: Releasing old wounds

**Discernment:**
Not all messages are profound. Ask:
- Does this resonate as true?
- Is it loving and constructive?
- Does it align with my highest good?
- Does it require harmful action? (if yes, dismiss it)

**Keeping Records:**
- Date all sessions
- Note your question
- Record any synchronicities
- Track accuracy of guidance
- Review periodically for patterns""",
            "meditation": {
                "title": "Message Integration Practice",
                "duration": 10,
                "script": """After completing an automatic writing session, use this meditation to integrate and understand your messages. Close your eyes.

[pause for 10 seconds]

Hold your writing in your hands or place it before you. Take a few centering breaths.

[pause for 15 seconds]

Ask: "Help me understand the deeper meaning of what I've received."

[pause for 15 seconds]

Even with eyes closed, sense the energy of the words on the page. What feelings do they evoke?

[pause for 20 seconds]

If there were specific words or phrases that stood out, bring them to mind now. What do they mean for your life?

[pause for 30 seconds]

Ask for any symbols or metaphors to be clarified. What images come to mind?

[pause for 30 seconds]

Consider how this guidance applies to your current situation. What action is being suggested?

[pause for 30 seconds]

Feel gratitude for the wisdom received. Even if not fully understood now, trust it will become clear.

[pause for 15 seconds]

Set an intention to remain open to further insight over the coming days. The message may unfold gradually.

[pause for 10 seconds]

Take a deep breath and open your eyes. Journal any additional insights."""
            }
        },
        {
            "id": 6,
            "title": "Advanced Applications",
            "content": """Use automatic writing for various purposes beyond personal guidance.

**Creative Inspiration:**
- Ask for story ideas
- Channel poetry or lyrics
- Receive artistic guidance
- Access creative flow state

**Problem Solving:**
- Write out your problem
- Ask for solutions
- Receive unexpected perspectives
- Access subconscious wisdom

**Healing Work:**
- Ask about health issues
- Receive emotional healing messages
- Connect with inner child
- Process past traumas safely

**Connecting with Departed:**
- Set clear intention
- Ask for specific loved one
- Request proof of identity
- Use discernment with messages

**Daily Practice Ritual:**
1. Morning: Ask what to focus on today
2. Evening: Ask for dream guidance
3. Weekly: Deeper question session
4. Monthly: Review and integrate

**Integration:**
- Act on guidance received
- Notice results
- Adjust practice as needed
- Trust the process""",
            "meditation": {
                "title": "Advanced Channeling Session",
                "duration": 15,
                "script": """This is an advanced practice for receiving deeper guidance. Prepare yourself carefully. Close your eyes.

[pause for 10 seconds]

Take several deep breaths, entering a light trance state. Feel yourself shifting into a receptive mode.

[pause for 20 seconds]

Surround yourself with protective white light. State: "I am protected. Only the highest wisdom may come through."

[pause for 15 seconds]

Open your crown chakra wide. Feel a beam of light connecting you to higher dimensions.

[pause for 20 seconds]

If you wish to connect with a specific being - a guide, your higher self, or a departed loved one - call them now by name or intention.

[pause for 20 seconds]

Feel their presence drawing near. You may sense their energy, see their light, or simply know they're there.

[pause for 20 seconds]

Ask your question or state your openness to receive whatever message serves your highest good.

[pause for 15 seconds]

Open your eyes and begin writing. Let the communication flow without interruption.

[pause for 10 seconds]

Write until the energy naturally subsides. Don't force it to continue or to stop.

[pause for 120 seconds]

When complete, thank the source of wisdom. Close your crown chakra partially - like closing a flower at dusk.

[pause for 15 seconds]

Ground yourself fully. Feel your body, the room around you, the earth beneath you.

[pause for 10 seconds]

Open your eyes. Take time to process what you've received."""
            }
        }
    ]
}
# Models
class OracleReading(BaseModel):
    card: dict
    interpretation: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class SaveReadingRequest(BaseModel):
    card: dict
    interpretation: str
    timestamp: str

class SpiritGuideMessage(BaseModel):
    guide: str
    element: str
    message: str
    history: List[dict] = []

class SpiritGuideResponse(BaseModel):
    response: str

# Auth Models
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: str

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_session_token() -> str:
    return f"session_{uuid.uuid4().hex}"

async def get_current_user(request: Request) -> dict:
    """Get current authenticated user from session"""
    # Check session_token from cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc

# Routes
@api_router.get("/")
async def root():
    return {"message": "Psychic Awareness API"}

@api_router.get("/training/modules")
async def get_training_modules():
    """Get all training modules"""
    return TRAINING_MODULES

@api_router.get("/training/modules/{module_id}/lessons")
async def get_module_lessons(module_id: str):
    """Get lessons for a specific training module"""
    if module_id not in LESSON_CONTENT:
        raise HTTPException(status_code=404, detail="Module not found")
    return {
        "module_id": module_id,
        "lessons": LESSON_CONTENT[module_id]
    }

@api_router.get("/training/modules/{module_id}/lessons/{lesson_id}")
async def get_single_lesson(module_id: str, lesson_id: int):
    """Get a specific lesson from a module"""
    if module_id not in LESSON_CONTENT:
        raise HTTPException(status_code=404, detail="Module not found")
    
    lessons = LESSON_CONTENT[module_id]
    lesson = next((l for l in lessons if l["id"] == lesson_id), None)
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    return lesson

class MultiCardDrawRequest(BaseModel):
    spread_type: str = "single"
    card_count: int = 1
    positions: List[str] = ["Guidance"]

@api_router.post("/oracle/draw")
async def draw_oracle_card(request: MultiCardDrawRequest = None):
    """Draw oracle cards and get AI interpretation"""
    import asyncio
    
    # Handle both old single-card and new multi-card requests
    if request is None or request.card_count == 1:
        # Single card draw (original behavior)
        card = random.choice(ORACLE_CARDS)
        
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"oracle-{uuid.uuid4()}",
                system_message="You are a wise spiritual guide providing oracle card interpretations. Give meaningful, insightful readings that help people on their spiritual journey. Keep responses under 100 words."
            ).with_model("gemini", "gemini-2.0-flash")
            
            prompt = f"The seeker has drawn '{card['name']}' ({card['element']}). Description: {card['description']}. Give a brief spiritual interpretation."
            
            user_message = UserMessage(text=prompt)
            interpretation = await chat.send_message(user_message)
            
            return {
                "spread_type": "single",
                "cards": [{
                    "card": card,
                    "position": "Guidance",
                    "interpretation": interpretation
                }],
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logging.error(f"Error generating interpretation: {e}")
            return {
                "spread_type": "single",
                "cards": [{
                    "card": card,
                    "position": "Guidance",
                    "interpretation": f"The {card['name']} speaks of {card['description'].lower()}. This card brings the energy of {card['element']} into your life."
                }],
                "timestamp": datetime.utcnow().isoformat()
            }
    
    # Multi-card spread - generate interpretations in parallel for speed
    card_count = min(request.card_count, 10)
    positions = request.positions[:card_count]
    
    # Draw unique cards
    drawn_cards = random.sample(ORACLE_CARDS, min(card_count, len(ORACLE_CARDS)))
    
    async def get_interpretation(card, position, spread_type):
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"oracle-{uuid.uuid4()}",
                system_message=f"You are a wise spiritual guide. Give a brief oracle interpretation for the {position} position. Keep it under 80 words."
            ).with_model("gemini", "gemini-2.0-flash")
            
            prompt = f"Card '{card['name']}' ({card['element']}) in the '{position}' position. Description: {card['description']}. Interpret briefly for {position}."
            
            user_message = UserMessage(text=prompt)
            return await chat.send_message(user_message)
        except Exception as e:
            logging.error(f"Error generating interpretation: {e}")
            return f"The {card['name']} in the {position} position speaks of {card['description'].lower()}. This {card['element']} energy guides this aspect of your journey."
    
    # Run all interpretations in parallel
    tasks = []
    for i, card in enumerate(drawn_cards):
        position = positions[i] if i < len(positions) else f"Card {i+1}"
        tasks.append(get_interpretation(card, position, request.spread_type))
    
    interpretations = await asyncio.gather(*tasks)
    
    cards_result = []
    for i, (card, interpretation) in enumerate(zip(drawn_cards, interpretations)):
        position = positions[i] if i < len(positions) else f"Card {i+1}"
        cards_result.append({
            "card": card,
            "position": position,
            "interpretation": interpretation
        })
    
    return {
        "spread_type": request.spread_type,
        "cards": cards_result,
        "timestamp": datetime.utcnow().isoformat()
    }

@api_router.post("/oracle/save")
async def save_oracle_reading(reading: SaveReadingRequest, request: Request):
    """Save an oracle reading to database"""
    try:
        # Get current user
        user = await get_current_user(request)
        
        reading_dict = reading.dict()
        reading_dict['_id'] = str(uuid.uuid4())
        reading_dict['user_id'] = user['user_id']  # Associate with user
        reading_dict['saved_at'] = datetime.utcnow().isoformat()
        await db.oracle_readings.insert_one(reading_dict)
        return {"success": True, "message": "Reading saved"}
    except HTTPException:
        # If not authenticated, save without user_id
        reading_dict = reading.dict()
        reading_dict['_id'] = str(uuid.uuid4())
        reading_dict['saved_at'] = datetime.utcnow().isoformat()
        await db.oracle_readings.insert_one(reading_dict)
        return {"success": True, "message": "Reading saved"}
    except Exception as e:
        logging.error(f"Error saving reading: {e}")
        raise HTTPException(status_code=500, detail="Failed to save reading")

@api_router.get("/oracle/readings")
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

@api_router.post("/spirit-guides/chat", response_model=SpiritGuideResponse)
async def chat_with_spirit_guide(message: SpiritGuideMessage):
    """Chat with a spirit guide"""
    
    # Define guide personalities
    guide_personalities = {
        "Ignis": "You are Ignis, the Fire spirit guide. You are passionate, direct, and transformative. You encourage action, courage, and embracing change. Your wisdom comes through powerful metaphors of flame, transformation, and rebirth. You speak with energy and conviction.",
        "Aqua": "You are Aqua, the Water spirit guide. You are intuitive, healing, and emotionally wise. You help people understand their feelings and navigate emotional depths. Your wisdom flows like water - gentle yet powerful. You speak with compassion and empathy.",
        "Terra": "You are Terra, the Earth spirit guide. You are grounded, practical, and stable. You provide wisdom through patience, endurance, and natural growth. Your guidance is rooted in ancient wisdom and connection to nature. You speak with calm authority.",
        "Aether": "You are Aether, the Air spirit guide. You are intellectual, free-spirited, and enlightening. You help people gain new perspectives and mental clarity. Your wisdom comes through ideas, communication, and mental liberation. You speak with clarity and insight."
    }
    
    system_message = guide_personalities.get(message.guide, guide_personalities["Aether"])
    system_message += " Keep responses under 150 words. Be warm, wise, and helpful."
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"guide-{message.guide}-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("gemini", "gemini-2.5-pro")
        
        user_message = UserMessage(text=message.message)
        response = await chat.send_message(user_message)
        
        return SpiritGuideResponse(response=response)
    except Exception as e:
        logging.error(f"Error in spirit guide chat: {e}")
        return SpiritGuideResponse(
            response=f"I sense a disturbance in our connection. Let us try again, dear seeker."
        )

@api_router.post("/meditation/generate-guided")
async def generate_guided_meditation(duration_minutes: int = 10, focus: str = "general"):
    """Generate AI-guided meditation script"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"meditation-{uuid.uuid4()}",
            system_message=f"""You are a meditation guide. Create a {duration_minutes}-minute guided meditation script focusing on {focus}. 

IMPORTANT FORMATTING RULES:
1. Include pauses using EXACTLY this format: [pause for X seconds] where X is a number between 3 and 15
2. Insert pauses after breathing instructions, between sections, and during reflection moments
3. Example: "Take a deep breath in... [pause for 5 seconds] ...and slowly exhale."
4. Use multiple pauses throughout to create a natural meditation rhythm
5. Include at least one pause every 2-3 sentences during breathing and visualization sections"""
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"""Create a complete {duration_minutes}-minute guided meditation script for {focus}. 

Structure:
1. Introduction and settling in (with pauses)
2. Breathing exercises (with pauses between breaths)
3. Body scan or visualization (with pauses for awareness)
4. Main meditation practice (with reflective pauses)
5. Gentle closing and return to awareness (with pauses)

Remember to use [pause for X seconds] format for all pauses."""
        
        user_message = UserMessage(text=prompt)
        script = await chat.send_message(user_message)
        
        return {
            "script": script,
            "duration": duration_minutes,
            "focus": focus
        }
    except Exception as e:
        logging.error(f"Error generating meditation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meditation")

@api_router.post("/journal/save")
async def save_journal_entry(entry: dict, request: Request):
    """Save a journal entry"""
    try:
        # Get current user
        user = await get_current_user(request)
        user_id = user.get('user_id')
        
        # Check if user is premium
        user_doc = await db.users.find_one({"user_id": user_id})
        is_premium = False
        
        if user_doc:
            is_premium = user_doc.get('is_premium', False)
            # Check subscription expiry
            if is_premium:
                subscription_expires = user_doc.get('subscription_expires')
                if subscription_expires:
                    if isinstance(subscription_expires, str):
                        expires_dt = datetime.fromisoformat(subscription_expires.replace("Z", "+00:00"))
                    else:
                        expires_dt = subscription_expires
                    if expires_dt.tzinfo is None:
                        expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                    if expires_dt < datetime.now(timezone.utc):
                        is_premium = False
        
        # If free user, check weekly entry limit
        if not is_premium:
            # Get start of current week (Monday)
            now = datetime.now(timezone.utc)
            week_start = now - timedelta(days=now.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Count entries this week
            weekly_entries = await db.journal_entries.count_documents({
                "user_id": user_id,
                "created_at": {"$gte": week_start.isoformat()}
            })
            
            if weekly_entries >= 5:
                raise HTTPException(
                    status_code=403, 
                    detail="Free users can only create 5 journal entries per week. Upgrade to Premium for unlimited entries!"
                )
        
        entry['_id'] = str(uuid.uuid4())
        entry['user_id'] = user_id
        entry['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.journal_entries.insert_one(entry)
        return {"success": True, "id": entry['_id']}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error saving journal entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to save entry")

@api_router.get("/journal/entries")
async def get_journal_entries(request: Request, limit: int = 50):
    """Get journal entries for current user"""
    try:
        # Get current user
        user = await get_current_user(request)
        entries = await db.journal_entries.find(
            {"user_id": user['user_id']}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return entries
    except HTTPException:
        # If not authenticated, return empty array
        return []
    except Exception as e:
        logging.error(f"Error fetching entries: {e}")
        return []

@api_router.get("/journal/status")
async def get_journal_status(request: Request):
    """Get journal entry status for current user (entries used/remaining this week)"""
    try:
        user = await get_current_user(request)
        user_id = user.get('user_id')
        
        # Check if user is premium
        user_doc = await db.users.find_one({"user_id": user_id})
        is_premium = False
        
        if user_doc:
            is_premium = user_doc.get('is_premium', False)
            if is_premium:
                subscription_expires = user_doc.get('subscription_expires')
                if subscription_expires:
                    if isinstance(subscription_expires, str):
                        expires_dt = datetime.fromisoformat(subscription_expires.replace("Z", "+00:00"))
                    else:
                        expires_dt = subscription_expires
                    if expires_dt.tzinfo is None:
                        expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                    if expires_dt < datetime.now(timezone.utc):
                        is_premium = False
        
        if is_premium:
            return {
                "is_premium": True,
                "weekly_limit": None,
                "entries_this_week": 0,
                "entries_remaining": None,
                "unlimited": True
            }
        
        # Get start of current week (Monday)
        now = datetime.now(timezone.utc)
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Count entries this week
        weekly_entries = await db.journal_entries.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": week_start.isoformat()}
        })
        
        return {
            "is_premium": False,
            "weekly_limit": 5,
            "entries_this_week": weekly_entries,
            "entries_remaining": max(0, 5 - weekly_entries),
            "unlimited": False,
            "week_resets": (week_start + timedelta(days=7)).isoformat()
        }
    except HTTPException:
        return {
            "is_premium": False,
            "weekly_limit": 5,
            "entries_this_week": 0,
            "entries_remaining": 5,
            "unlimited": False
        }
    except Exception as e:
        logging.error(f"Error getting journal status: {e}")
        return {
            "is_premium": False,
            "weekly_limit": 5,
            "entries_this_week": 0,
            "entries_remaining": 5,
            "unlimited": False
        }

@api_router.get("/meditation/binaural/frequencies")
async def get_binaural_frequencies():
    """Get available binaural beat frequencies"""
    frequencies = [
        {
            "id": "god-tone",
            "name": "God Tone (963 Hz)",
            "frequency_range": "963 Hz Solfeggio",
            "base_frequency": 963,
            "beat_frequency": 7.83,
            "benefits": ["Spiritual awakening", "Divine connection", "Crown chakra activation", "Higher consciousness"],
            "color": "#ffd700",
            "description": "The frequency of divine connection and spiritual awakening - activates the crown chakra and connects to higher consciousness"
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
            "description": "The Earth's natural electromagnetic frequency - promotes deep connection with nature and grounding"
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
    return frequencies

@api_router.get("/meditation/binaural/generate/{frequency_id}")
async def generate_binaural_beat(frequency_id: str, duration: int = 60):
    """Generate actual binaural beat audio"""
    import numpy as np
    from scipy.io import wavfile
    
    # Frequency configurations - all frequencies including Solfeggio tones
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
    
    # Audio parameters
    sample_rate = 44100
    duration_seconds = min(duration, 300)  # Max 5 minutes per request
    
    # Generate time array
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds), dtype=np.float32)
    
    # Generate binaural beats (different frequency in each ear)
    left_freq = base_freq
    right_freq = base_freq + beat_freq
    
    # Create sine waves for left and right channels
    left_channel = np.sin(2 * np.pi * left_freq * t).astype(np.float32)
    right_channel = np.sin(2 * np.pi * right_freq * t).astype(np.float32)
    
    # Add gentle fade in/out (2 seconds each)
    fade_samples = int(sample_rate * 2)
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    left_channel[:fade_samples] *= fade_in
    left_channel[-fade_samples:] *= fade_out
    right_channel[:fade_samples] *= fade_in
    right_channel[-fade_samples:] *= fade_out
    
    # Scale to 16-bit range
    left_channel = (left_channel * 32767 * 0.7).astype(np.int16)
    right_channel = (right_channel * 32767 * 0.7).astype(np.int16)
    
    # Combine into stereo
    stereo = np.column_stack((left_channel, right_channel))
    
    # Write to bytes buffer
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, stereo)
    buffer.seek(0)
    
    # Convert to base64
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

@api_router.get("/meditation/binaural/audio/{frequency_id}")
async def get_binaural_audio_info(frequency_id: str):
    """Get binaural audio information and streaming URL"""
    # In a production app, you would:
    # 1. Serve actual pre-recorded binaural beat audio files
    # 2. Generate audio using a synthesis library
    # 3. Use a third-party binaural beat API
    
    audio_urls = {
        "delta": "https://www.soundhealing.com/samples/delta-waves.mp3",
        "theta": "https://www.soundhealing.com/samples/theta-waves.mp3",
        "alpha": "https://www.soundhealing.com/samples/alpha-waves.mp3",
        "beta": "https://www.soundhealing.com/samples/beta-waves.mp3",
        "gamma": "https://www.soundhealing.com/samples/gamma-waves.mp3"
    }
    
    # Note: These are placeholder URLs for demonstration
    # Replace with actual hosted binaural beat audio files
    return {
        "frequency_id": frequency_id,
        "audio_url": audio_urls.get(frequency_id),
        "format": "mp3",
        "duration_minutes": 30,
        "sample_rate": 44100,
        "note": "For production, replace with actual binaural beat audio files"
    }

# ==================== CHAKRA MEDITATION ====================

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

@api_router.get("/meditation/chakra/list")
async def get_chakras():
    """Get all chakra information"""
    chakras = []
    for chakra_id, data in CHAKRA_DATA.items():
        chakras.append({
            "id": chakra_id,
            **data
        })
    return chakras

@api_router.get("/meditation/chakra/tone/{chakra_id}")
async def generate_chakra_tone(chakra_id: str, duration: int = 60):
    """Generate a pure chakra frequency tone - optimized for mobile with loopable segments"""
    import numpy as np
    from scipy.io import wavfile
    
    if chakra_id not in CHAKRA_DATA:
        raise HTTPException(status_code=404, detail="Chakra not found")
    
    chakra = CHAKRA_DATA[chakra_id]
    frequency = chakra["frequency"]
    
    # Use lower sample rate and generate short loopable segment (30 seconds max)
    sample_rate = 22050  # Lower sample rate for smaller file
    # Generate a short loopable segment - frontend will loop it
    segment_duration = min(duration, 30)  # Max 30 second segments for mobile
    num_samples = int(sample_rate * segment_duration)
    
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)
    
    # Generate main frequency with harmonics for richer sound
    audio = np.sin(2 * np.pi * frequency * t) * 0.5
    audio += np.sin(2 * np.pi * frequency * 2 * t) * 0.15  # 2nd harmonic
    audio += np.sin(2 * np.pi * frequency * 3 * t) * 0.08  # 3rd harmonic
    
    # Add gentle amplitude modulation for warmth
    mod = 1 + 0.1 * np.sin(2 * np.pi * 0.2 * t)
    audio = audio * mod
    
    # Smooth fade at start/end for seamless loop
    fade_samples = int(sample_rate * 0.5)  # 0.5 second fade
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)
    audio[:fade_samples] *= fade_in
    audio[-fade_samples:] *= fade_out
    
    # Normalize and convert
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

@api_router.get("/meditation/chakra/realign-tone")
async def generate_realign_all_tone(duration: int = 300):
    """Generate a morphing tone that transitions through all chakras - optimized for mobile"""
    import numpy as np
    from scipy.io import wavfile
    
    # Lower sample rate and max 60 seconds for mobile compatibility
    sample_rate = 22050
    duration_seconds = min(duration, 60)  # Max 60 seconds, loops on frontend
    num_samples = int(sample_rate * duration_seconds)
    
    # Chakra order from root to crown
    chakra_order = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"]
    frequencies = [CHAKRA_DATA[c]["frequency"] for c in chakra_order]
    
    # Time spent on each chakra
    time_per_chakra = duration_seconds / len(chakra_order)
    
    t = np.linspace(0, duration_seconds, num_samples, dtype=np.float32)
    audio = np.zeros(num_samples, dtype=np.float32)
    
    for i, freq in enumerate(frequencies):
        start_time = i * time_per_chakra
        end_time = (i + 1) * time_per_chakra
        
        # Create smooth transition envelope
        for j in range(num_samples):
            current_time = j / sample_rate
            if start_time <= current_time < end_time:
                # Calculate position within this chakra's segment
                progress = (current_time - start_time) / time_per_chakra
                
                # Smooth fade in/out within each chakra segment
                if progress < 0.1:
                    envelope = progress / 0.1
                elif progress > 0.9:
                    envelope = (1 - progress) / 0.1
                else:
                    envelope = 1.0
                
                # Add frequency with harmonics
                audio[j] += envelope * 0.5 * np.sin(2 * np.pi * freq * current_time)
                audio[j] += envelope * 0.15 * np.sin(2 * np.pi * freq * 2 * current_time)
    
    # Global fade in/out
    fade_samples = int(sample_rate * 1)
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    # Normalize
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

# ============ STREAMING AUDIO ENDPOINTS FOR NATIVE PLAYBACK ============

@api_router.get("/meditation/chakra/stream/{chakra_id}")
async def stream_chakra_tone(chakra_id: str, duration: int = 30):
    """Stream chakra frequency tone as WAV audio for native playback"""
    import numpy as np
    from scipy.io import wavfile
    
    if chakra_id not in CHAKRA_DATA:
        raise HTTPException(status_code=404, detail="Chakra not found")
    
    chakra = CHAKRA_DATA[chakra_id]
    frequency = chakra["frequency"]
    
    sample_rate = 22050
    segment_duration = min(duration, 30)
    num_samples = int(sample_rate * segment_duration)
    
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)
    
    # Generate frequency with harmonics
    audio = np.sin(2 * np.pi * frequency * t) * 0.5
    audio += np.sin(2 * np.pi * frequency * 2 * t) * 0.15
    audio += np.sin(2 * np.pi * frequency * 3 * t) * 0.08
    
    # Amplitude modulation
    mod = 1 + 0.1 * np.sin(2 * np.pi * 0.2 * t)
    audio = audio * mod
    
    # Fade for seamless loop
    fade_samples = int(sample_rate * 0.5)
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    # Normalize
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

@api_router.get("/meditation/chakra/stream-realign")
async def stream_realign_tone(duration: int = 60):
    """Stream morphing chakra frequency progression as WAV audio"""
    import numpy as np
    from scipy.io import wavfile
    
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
    
    # Fade
    fade_samples = int(sample_rate * 1)
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
            "Content-Disposition": "inline; filename=chakra_realign.wav",
            "Accept-Ranges": "bytes"
        }
    )

@api_router.get("/meditation/binaural/stream/{frequency_id}")
async def stream_binaural_beat(frequency_id: str, duration: int = 30):
    """Stream binaural beat as WAV audio for native playback"""
    import numpy as np
    from scipy.io import wavfile
    
    # Frequency definitions
    BINAURAL_FREQUENCIES = {
        "delta": {"base": 100, "beat": 2, "name": "Delta (Deep Sleep)"},
        "theta": {"base": 150, "beat": 6, "name": "Theta (Meditation)"},
        "alpha": {"base": 200, "beat": 10, "name": "Alpha (Relaxation)"},
        "beta": {"base": 250, "beat": 20, "name": "Beta (Focus)"},
        "gamma": {"base": 300, "beat": 40, "name": "Gamma (Cognition)"},
        "god-tone": {"base": 963, "beat": 0, "name": "God Tone (963Hz)"},
        "love": {"base": 528, "beat": 0, "name": "Love Frequency (528Hz)"},
        "liberation": {"base": 396, "beat": 0, "name": "Liberation (396Hz)"},
    }
    
    if frequency_id not in BINAURAL_FREQUENCIES:
        raise HTTPException(status_code=404, detail="Frequency not found")
    
    freq_data = BINAURAL_FREQUENCIES[frequency_id]
    base_freq = freq_data["base"]
    beat_freq = freq_data["beat"]
    
    sample_rate = 22050
    segment_duration = min(duration, 30)
    num_samples = int(sample_rate * segment_duration)
    
    t = np.linspace(0, segment_duration, num_samples, dtype=np.float32)
    
    if beat_freq > 0:
        # Binaural beat - create stereo
        left = np.sin(2 * np.pi * base_freq * t) * 0.5
        right = np.sin(2 * np.pi * (base_freq + beat_freq) * t) * 0.5
        audio = np.column_stack((left, right))
    else:
        # Pure tone - mono
        audio = np.sin(2 * np.pi * base_freq * t) * 0.5
        audio += np.sin(2 * np.pi * base_freq * 2 * t) * 0.15
        audio += np.sin(2 * np.pi * base_freq * 3 * t) * 0.08
    
    # Fade
    fade_samples = int(sample_rate * 0.5)
    if len(audio.shape) == 2:
        audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32).reshape(-1, 1)
        audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32).reshape(-1, 1)
    else:
        audio[:fade_samples] *= np.linspace(0, 1, fade_samples, dtype=np.float32)
        audio[-fade_samples:] *= np.linspace(1, 0, fade_samples, dtype=np.float32)
    
    # Normalize
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

# ============ END STREAMING AUDIO ENDPOINTS ============

@api_router.post("/meditation/chakra/generate-guided/{chakra_id}")
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

IMPORTANT FORMATTING RULES:
1. Include pauses using EXACTLY this format: [pause for X seconds] where X is between 3 and 10
2. Focus on the {chakra['location']} area and the color {chakra['color']}
3. Include the affirmation: "{chakra['affirmation']}"
4. Reference the {chakra['element']} element
5. Include visualization of the chakra's color energy
6. Keep language calm, soothing, and spiritually uplifting"""
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"""Create a complete {duration_minutes}-minute chakra meditation for the {chakra['name']} located at the {chakra['location']}.

Include:
1. Opening and settling (with pauses)
2. Breathing to connect with the chakra
3. Color visualization ({chakra['color']} energy)
4. Element connection ({chakra['element']})
5. Affirmation work: "{chakra['affirmation']}"
6. Benefits focus: {', '.join(chakra['benefits'])}
7. Gentle closing

Use [pause for X seconds] format for all pauses."""
        
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

@api_router.post("/meditation/chakra/generate-realign")
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
6. The tone will automatically shift to match each chakra, so mention when moving to next chakra"""
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

Use [pause for X seconds] for breathing and integration moments."""
        
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

@api_router.get("/meditation/ambient/generate/{sound_id}")
async def generate_ambient_sound(sound_id: str, duration: int = 60):
    """Generate ambient sound audio (synthesized)"""
    import numpy as np
    from scipy.io import wavfile
    
    # Sound configurations - we'll synthesize nature-like sounds
    sound_config = {
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
    
    if sound_id not in sound_config:
        raise HTTPException(status_code=404, detail="Sound not found")
    
    config = sound_config[sound_id]
    sample_rate = 44100
    duration_seconds = min(duration, 300)  # Max 5 minutes per request
    num_samples = int(sample_rate * duration_seconds)
    
    # Generate audio based on type
    if config["type"] == "silence":
        audio = np.zeros(num_samples, dtype=np.float32)
    
    elif config["type"] == "pink_noise":
        # Pink noise (1/f noise) - sounds like heavy rain
        white = np.random.randn(num_samples).astype(np.float32)
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        from scipy.signal import lfilter
        pink = lfilter(b, a, white)
        mod = 0.5 + config["modulation"] * np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate)
        audio = (pink * mod * 0.3).astype(np.float32)
    
    elif config["type"] == "white_noise":
        # Pure white noise
        white = np.random.randn(num_samples).astype(np.float32)
        mod = 0.3 + config["modulation"] * np.abs(np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate + np.random.randn(num_samples) * 0.5))
        audio = (white * mod * 0.25).astype(np.float32)
    
    elif config["type"] == "brown_noise":
        # Brown noise (random walk) - deeper, forest-like
        white = np.random.randn(num_samples).astype(np.float32)
        brown = np.cumsum(white)
        brown = brown / np.max(np.abs(brown))
        mod = 0.7 + config["modulation"] * np.sin(2 * np.pi * config["mod_freq"] * np.arange(num_samples) / sample_rate)
        audio = (brown * mod * 0.3).astype(np.float32)
    
    elif config["type"] == "sine_harmonic":
        # Harmonious note - harmonic sine waves with decay
        t = np.arange(num_samples) / sample_rate
        audio = np.zeros(num_samples, dtype=np.float32)
        for i, h in enumerate(config["harmonics"]):
            freq = config["base_freq"] * h
            decay = np.exp(-t * (0.1 + i * 0.05))
            audio += np.sin(2 * np.pi * freq * t) * decay * (1.0 / (i + 1))
        audio = (audio / np.max(np.abs(audio)) * 0.5).astype(np.float32)
        strike_interval = int(sample_rate * 8)
        for strike_pos in range(0, num_samples, strike_interval):
            strike_end = min(strike_pos + int(sample_rate * 0.1), num_samples)
            audio[strike_pos:strike_end] *= 1.5
    
    elif config["type"] == "thunder":
        # Thunderstorm - rain with occasional thunder rumbles
        from scipy.signal import lfilter
        white = np.random.randn(num_samples).astype(np.float32)
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        rain = lfilter(b, a, white) * 0.2
        # Add thunder rumbles
        thunder_times = np.random.choice(num_samples, size=int(duration_seconds / 10), replace=False)
        for t_pos in thunder_times:
            thunder_len = int(sample_rate * np.random.uniform(1.5, 3.0))
            if t_pos + thunder_len < num_samples:
                t = np.arange(thunder_len) / sample_rate
                thunder = np.random.randn(thunder_len) * np.exp(-t * 2) * 0.6
                # Low pass filter for rumble
                from scipy.signal import butter, filtfilt
                b_lp, a_lp = butter(4, 100 / (sample_rate / 2), btype='low')
                thunder = filtfilt(b_lp, a_lp, thunder)
                rain[t_pos:t_pos + thunder_len] += thunder
        audio = rain.astype(np.float32)
    
    elif config["type"] == "wind":
        # Wind - modulated filtered noise
        from scipy.signal import butter, filtfilt
        white = np.random.randn(num_samples).astype(np.float32)
        # Bandpass for wind sound
        b_bp, a_bp = butter(2, [100 / (sample_rate / 2), 1000 / (sample_rate / 2)], btype='band')
        wind = filtfilt(b_bp, a_bp, white)
        # Slow modulation for gusts
        t = np.arange(num_samples) / sample_rate
        gust = 0.5 + 0.5 * np.sin(2 * np.pi * 0.1 * t + np.random.randn() * 2)
        audio = (wind * gust * 0.3).astype(np.float32)
    
    elif config["type"] == "fire":
        # Crackling fire
        from scipy.signal import butter, filtfilt
        # Base fire roar (low frequency noise)
        white = np.random.randn(num_samples).astype(np.float32)
        b_lp, a_lp = butter(2, 500 / (sample_rate / 2), btype='low')
        fire_base = filtfilt(b_lp, a_lp, white) * 0.15
        # Add crackles
        crackle_times = np.random.choice(num_samples, size=int(duration_seconds * config["crackle_rate"]), replace=False)
        for c_pos in crackle_times:
            crackle_len = int(sample_rate * np.random.uniform(0.02, 0.08))
            if c_pos + crackle_len < num_samples:
                crackle = np.random.randn(crackle_len) * np.exp(-np.arange(crackle_len) / (crackle_len / 3)) * 0.4
                fire_base[c_pos:c_pos + crackle_len] += crackle
        audio = fire_base.astype(np.float32)
    
    elif config["type"] == "stream":
        # Flowing stream - filtered noise with babbling
        from scipy.signal import butter, filtfilt
        white = np.random.randn(num_samples).astype(np.float32)
        # Bandpass for water sound
        b_bp, a_bp = butter(2, [200 / (sample_rate / 2), 2000 / (sample_rate / 2)], btype='band')
        water = filtfilt(b_bp, a_bp, white)
        # Add gentle modulation
        t = np.arange(num_samples) / sample_rate
        flow = 0.7 + 0.3 * np.sin(2 * np.pi * config["flow_rate"] * t)
        audio = (water * flow * 0.25).astype(np.float32)
    
    elif config["type"] == "night":
        # Night sounds - crickets and ambient
        t = np.arange(num_samples) / sample_rate
        # Base quiet ambient
        ambient = np.random.randn(num_samples) * 0.02
        # Cricket chirps (high frequency pulses)
        cricket_freq = 4000
        chirp_duration = 0.05
        chirp_samples = int(sample_rate * chirp_duration)
        chirp_times = np.random.choice(num_samples - chirp_samples, size=int(duration_seconds * config["cricket_rate"]), replace=False)
        for c_pos in chirp_times:
            chirp_t = np.arange(chirp_samples) / sample_rate
            chirp = np.sin(2 * np.pi * cricket_freq * chirp_t) * np.exp(-chirp_t * 30) * 0.15
            ambient[c_pos:c_pos + chirp_samples] += chirp
        audio = ambient.astype(np.float32)
    
    else:
        audio = np.zeros(num_samples, dtype=np.float32)
    
    # Add gentle fade in/out
    fade_samples = int(sample_rate * 1)
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)
    audio[:fade_samples] *= fade_in
    audio[-fade_samples:] *= fade_out
    
    # Clip and convert to 16-bit
    audio = np.clip(audio, -1, 1)
    audio_int16 = (audio * 32767).astype(np.int16)
    
    # Write to buffer
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    buffer.seek(0)
    
    # Convert to base64
    audio_base64 = base64.b64encode(buffer.read()).decode()
    
    return {
        "sound_id": sound_id,
        "duration_seconds": duration_seconds,
        "sample_rate": sample_rate,
        "audio_base64": audio_base64,
        "format": "wav"
    }

@api_router.post("/meditation/session/save")
async def save_meditation_session(session: dict, request: Request):
    """Save a meditation session to track progress"""
    try:
        # Get current user
        user = await get_current_user(request)
        
        session['_id'] = str(uuid.uuid4())
        session['user_id'] = user['user_id']  # Associate with user
        session['completed_at'] = datetime.utcnow().isoformat()
        await db.meditation_sessions.insert_one(session)
        return {"success": True, "session_id": session['_id']}
    except HTTPException:
        # If not authenticated, save without user_id
        session['_id'] = str(uuid.uuid4())
        session['completed_at'] = datetime.utcnow().isoformat()
        await db.meditation_sessions.insert_one(session)
        return {"success": True, "session_id": session['_id']}
    except Exception as e:
        logging.error(f"Error saving meditation session: {e}")
        raise HTTPException(status_code=500, detail="Failed to save session")

@api_router.get("/meditation/sessions")
async def get_meditation_sessions(request: Request, limit: int = 30):
    """Get meditation session history for current user"""
    try:
        # Get current user
        user = await get_current_user(request)
        sessions = await db.meditation_sessions.find(
            {"user_id": user['user_id']}
        ).sort("completed_at", -1).limit(limit).to_list(limit)
        return sessions
    except HTTPException:
        # If not authenticated, return empty array
        return []
    except Exception as e:
        logging.error(f"Error fetching sessions: {e}")
        return []

# TTS and Voice endpoints
class TTSRequest(BaseModel):
    text: str
    guide_name: Optional[str] = None  # Ignis, Aqua, Terra, or Aether
    voice_id: Optional[str] = None
    
class TTSResponse(BaseModel):
    audio_base64: Optional[str] = None
    text: str
    guide_name: Optional[str] = None
    error: Optional[str] = None
    success: bool = True

@api_router.post("/tts/generate", response_model=TTSResponse)
async def generate_tts(request: TTSRequest):
    """Generate text-to-speech audio using OpenAI TTS"""
    try:
        # Determine which voice to use
        if request.guide_name and request.guide_name in SPIRIT_GUIDE_VOICES:
            voice = SPIRIT_GUIDE_VOICES[request.guide_name]["voice"]
            guide_name = request.guide_name
        elif request.voice_id:
            voice = request.voice_id
            guide_name = None
        else:
            # Default to Aether (Air guide)
            voice = SPIRIT_GUIDE_VOICES["Aether"]["voice"]
            guide_name = "Aether"
        
        # Check if API key is configured
        if not EMERGENT_LLM_KEY:
            return TTSResponse(
                audio_base64=None,
                text=request.text,
                guide_name=guide_name,
                error="TTS not configured",
                success=False
            )
        
        # Validate and truncate text if too long (OpenAI TTS limit is 4096 chars)
        text_to_speak = request.text
        if len(text_to_speak) > 4000:
            # Truncate at sentence boundary to stay under limit
            truncated = text_to_speak[:4000]
            last_period = truncated.rfind('.')
            last_exclaim = truncated.rfind('!')
            last_question = truncated.rfind('?')
            cut_point = max(last_period, last_exclaim, last_question)
            if cut_point > 3000:  # Only truncate at sentence if reasonable
                text_to_speak = truncated[:cut_point + 1]
            else:
                text_to_speak = truncated
            logging.info(f"TTS text truncated from {len(request.text)} to {len(text_to_speak)} characters")
        
        # Generate audio using OpenAI TTS
        audio_base64 = await openai_tts.generate_speech_base64(
            text=text_to_speak,
            voice=voice,
            model="tts-1",  # Use standard model for faster response
            response_format="mp3"
        )
        
        return TTSResponse(
            audio_base64=audio_base64,
            text=text_to_speak,
            guide_name=guide_name,
            success=True
        )
        
    except Exception as e:
        error_msg = str(e)
        logging.error(f"Error generating TTS: {e}")
        
        # Return graceful error instead of 500
        return TTSResponse(
            audio_base64=None,
            text=request.text,
            guide_name=request.guide_name,
            error="Voice generation temporarily unavailable. Please try again later.",
            success=False
        )

@api_router.get("/spirit-guides/voices")
async def get_spirit_guide_voices():
    """Get all spirit guide voice configurations"""
    return SPIRIT_GUIDE_VOICES

@api_router.get("/zodiac/element/{birth_month}/{birth_day}")
async def get_zodiac_element(birth_month: int, birth_day: int):
    """Get element and spirit guide based on birthday"""
    try:
        # Determine zodiac sign
        zodiac_sign = None
        if (birth_month == 3 and birth_day >= 21) or (birth_month == 4 and birth_day <= 19):
            zodiac_sign = "aries"
        elif (birth_month == 4 and birth_day >= 20) or (birth_month == 5 and birth_day <= 20):
            zodiac_sign = "taurus"
        elif (birth_month == 5 and birth_day >= 21) or (birth_month == 6 and birth_day <= 20):
            zodiac_sign = "gemini"
        elif (birth_month == 6 and birth_day >= 21) or (birth_month == 7 and birth_day <= 22):
            zodiac_sign = "cancer"
        elif (birth_month == 7 and birth_day >= 23) or (birth_month == 8 and birth_day <= 22):
            zodiac_sign = "leo"
        elif (birth_month == 8 and birth_day >= 23) or (birth_month == 9 and birth_day <= 22):
            zodiac_sign = "virgo"
        elif (birth_month == 9 and birth_day >= 23) or (birth_month == 10 and birth_day <= 22):
            zodiac_sign = "libra"
        elif (birth_month == 10 and birth_day >= 23) or (birth_month == 11 and birth_day <= 21):
            zodiac_sign = "scorpio"
        elif (birth_month == 11 and birth_day >= 22) or (birth_month == 12 and birth_day <= 21):
            zodiac_sign = "sagittarius"
        elif (birth_month == 12 and birth_day >= 22) or (birth_month == 1 and birth_day <= 19):
            zodiac_sign = "capricorn"
        elif (birth_month == 1 and birth_day >= 20) or (birth_month == 2 and birth_day <= 18):
            zodiac_sign = "aquarius"
        elif (birth_month == 2 and birth_day >= 19) or (birth_month == 3 and birth_day <= 20):
            zodiac_sign = "pisces"
        
        if not zodiac_sign:
            raise HTTPException(status_code=400, detail="Invalid birth date")
        
        # Get element for zodiac sign
        element = ZODIAC_TO_ELEMENT[zodiac_sign]
        
        # Find matching spirit guide
        spirit_guide = None
        for guide_name, guide_info in SPIRIT_GUIDE_VOICES.items():
            if guide_info["element"] == element:
                spirit_guide = {
                    "name": guide_name,
                    "element": element,
                    "gender": guide_info["gender"],
                    "personality": guide_info["personality"],
                    "voice_id": guide_info["voice_id"]
                }
                break
        
        return {
            "zodiac_sign": zodiac_sign.capitalize(),
            "element": element,
            "spirit_guide": spirit_guide
        }
        
    except Exception as e:
        logging.error(f"Error determining zodiac: {e}")
        raise HTTPException(status_code=500, detail="Error determining zodiac sign")

# Auth Endpoints
@api_router.post("/auth/signup")
async def signup(request: SignupRequest):
    """Create new user account with email/password"""
    # Check if user exists
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request.password)
    
    user_doc = {
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "password_hash": password_hash,
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = create_session_token()
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Return user and set cookie
    response = JSONResponse(content={
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "picture": None
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/",
        samesite="lax"
    )
    
    return response

@api_router.post("/auth/login")
async def login(request: LoginRequest):
    """Login with email/password"""
    # Find user
    user_doc = await db.users.find_one({"email": request.email})
    
    if not user_doc or not verify_password(request.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create session
    session_token = create_session_token()
    session_doc = {
        "session_token": session_token,
        "user_id": user_doc["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Return user and set cookie
    response = JSONResponse(content={
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "picture": user_doc.get("picture"),
        "session_token": session_token  # Include token for mobile apps
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/",
        samesite="lax"
    )
    
    return response

@api_router.post("/auth/google-callback")
async def google_auth_callback(session_id: str):
    """Exchange Emergent OAuth session_id for user data"""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                EMERGENT_AUTH_SESSION_ENDPOINT,
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")
            
            data = response.json()
            
            # Check if user exists, create if not
            user_doc = await db.users.find_one({"email": data["email"]})
            
            if not user_doc:
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                user_doc = {
                    "user_id": user_id,
                    "email": data["email"],
                    "name": data["name"],
                    "picture": data.get("picture"),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user_doc)
            else:
                # Update name and picture if changed
                await db.users.update_one(
                    {"user_id": user_doc["user_id"]},
                    {"$set": {
                        "name": data["name"],
                        "picture": data.get("picture")
                    }}
                )
            
            # Create session using token from Emergent
            session_token = data["session_token"]
            session_doc = {
                "session_token": session_token,
                "user_id": user_doc["user_id"],
                "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.user_sessions.insert_one(session_doc)
            
            # Return user and set cookie
            response_obj = JSONResponse(content={
                "user_id": user_doc["user_id"],
                "email": user_doc["email"],
                "name": user_doc["name"],
                "picture": user_doc.get("picture"),
                "session_token": session_token  # Include token in response for mobile
            })
            
            response_obj.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
                path="/",
                samesite="lax"
            )
            
            return response_obj
            
    except Exception as e:
        logging.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response = JSONResponse(content={"success": True})
    response.delete_cookie("session_token", path="/")
    return response

# User Profile Endpoints
class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None

@api_router.patch("/user/update-profile")
async def update_profile(request: Request, data: UpdateProfileRequest):
    """Update user profile"""
    user = await get_current_user(request)
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.picture:
        update_data["picture"] = data.picture
    
    if update_data:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data}
        )
    
    # Return updated user
    updated_user = await db.users.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    return updated_user

# ==================== SUBSCRIPTION & PAYMENT ENDPOINTS ====================

class CreateCheckoutRequest(BaseModel):
    plan_id: str = "premium_monthly"
    origin_url: str

class SubscriptionStatusResponse(BaseModel):
    is_premium: bool
    subscription_status: Optional[str] = None
    expires_at: Optional[str] = None
    features: Dict[str, bool]

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return {
        "plans": SUBSCRIPTION_PLANS,
        "free_tier_limits": FREE_TIER_LIMITS
    }

@api_router.get("/subscription/status")
async def get_subscription_status(request: Request):
    """Get current user subscription status"""
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]})
        
        is_premium = user_doc.get("is_premium", False)
        subscription_expires = user_doc.get("subscription_expires_at")
        
        # Check if subscription expired
        if subscription_expires:
            if isinstance(subscription_expires, str):
                expires_dt = datetime.fromisoformat(subscription_expires.replace('Z', '+00:00'))
            else:
                expires_dt = subscription_expires
            if expires_dt.tzinfo is None:
                expires_dt = expires_dt.replace(tzinfo=timezone.utc)
            if expires_dt < datetime.now(timezone.utc):
                is_premium = False
                # Update user status
                await db.users.update_one(
                    {"user_id": user["user_id"]},
                    {"$set": {"is_premium": False}}
                )
        
        # Return premium features or free tier limits
        if is_premium:
            features = {
                "oracle_readings_unlimited": True,
                "journal_entries_unlimited": True,
                "all_training_modules": True,
                "spirit_guides": True,
                "binaural_meditation": True,
                "astral_meditation": True,
                "ai_guided_meditation": True,
                "tts_enabled": True
            }
        else:
            features = {
                "oracle_readings_unlimited": False,
                "journal_entries_unlimited": False,
                "all_training_modules": False,
                "spirit_guides": False,
                "binaural_meditation": False,
                "astral_meditation": False,
                "ai_guided_meditation": False,
                "tts_enabled": False
            }
        
        return SubscriptionStatusResponse(
            is_premium=is_premium,
            subscription_status="active" if is_premium else "free",
            expires_at=subscription_expires if is_premium else None,
            features=features
        )
    except HTTPException:
        # Not authenticated - return free tier
        return SubscriptionStatusResponse(
            is_premium=False,
            subscription_status="free",
            features={
                "oracle_readings_unlimited": False,
                "journal_entries_unlimited": False,
                "all_training_modules": False,
                "spirit_guides": False,
                "binaural_meditation": False,
                "astral_meditation": False,
                "ai_guided_meditation": False,
                "tts_enabled": False
            }
        )

@api_router.post("/subscription/create-checkout")
async def create_checkout_session(data: CreateCheckoutRequest, request: Request):
    """Create Stripe checkout session for subscription"""
    try:
        user = await get_current_user(request)
        
        # Validate plan exists
        if data.plan_id not in SUBSCRIPTION_PLANS:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        plan = SUBSCRIPTION_PLANS[data.plan_id]
        
        # Build URLs from frontend origin
        success_url = f"{data.origin_url}/settings?session_id={{CHECKOUT_SESSION_ID}}&success=true"
        cancel_url = f"{data.origin_url}/settings?canceled=true"
        
        # Initialize Stripe checkout
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=plan["price"],
            currency=plan["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user["user_id"],
                "email": user["email"],
                "plan_id": data.plan_id,
                "type": "subscription"
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store payment transaction
        transaction = {
            "_id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "email": user["email"],
            "plan_id": data.plan_id,
            "amount": plan["price"],
            "currency": plan["currency"],
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.get("/subscription/checkout-status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Get status of a checkout session and update subscription"""
    try:
        # Find the transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Check if already processed
        if transaction.get("payment_status") == "paid":
            return {
                "status": "complete",
                "payment_status": "paid",
                "already_processed": True
            }
        
        # Get status from Stripe
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": checkout_status.payment_status,
                "status": checkout_status.status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If payment successful, activate subscription
        if checkout_status.payment_status == "paid":
            # Get user_id from transaction
            user_id = transaction.get("user_id")
            
            if user_id:
                # Activate premium for 30 days
                expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "is_premium": True,
                        "subscription_expires_at": expires_at.isoformat(),
                        "subscription_plan": transaction.get("plan_id"),
                        "subscription_activated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logging.info(f"Subscription activated for user {user_id}")
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Checkout status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process webhook event
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            
            # Update transaction
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            if transaction:
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "webhook_processed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Activate subscription
                user_id = transaction.get("user_id")
                if user_id:
                    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                    await db.users.update_one(
                        {"user_id": user_id},
                        {"$set": {
                            "is_premium": True,
                            "subscription_expires_at": expires_at.isoformat()
                        }}
                    )
        
        return {"received": True}
        
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        return {"received": True, "error": str(e)}

# ==================== FEATURE ACCESS HELPERS ====================

async def check_feature_access(request: Request, feature: str) -> bool:
    """Check if user has access to a specific feature"""
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]})
        
        is_premium = user_doc.get("is_premium", False)
        
        # Check subscription expiry
        if is_premium:
            subscription_expires = user_doc.get("subscription_expires_at")
            if subscription_expires:
                if isinstance(subscription_expires, str):
                    expires_dt = datetime.fromisoformat(subscription_expires.replace('Z', '+00:00'))
                else:
                    expires_dt = subscription_expires
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                if expires_dt < datetime.now(timezone.utc):
                    is_premium = False
        
        # Premium users have access to everything
        if is_premium:
            return True
        
        # Free tier access check
        free_access = FREE_TIER_LIMITS.get(feature)
        
        # Boolean features
        if isinstance(free_access, bool):
            return free_access
        
        # Numeric limits require additional logic in the calling endpoint
        return free_access is not None
        
    except HTTPException:
        # Not authenticated - check free tier
        free_access = FREE_TIER_LIMITS.get(feature)
        if isinstance(free_access, bool):
            return free_access
        return free_access is not None

@api_router.get("/user/feature-access/{feature}")
async def check_user_feature_access(feature: str, request: Request):
    """Check if user has access to a specific feature"""
    has_access = await check_feature_access(request, feature)
    
    return {
        "feature": feature,
        "has_access": has_access,
        "upgrade_required": not has_access
    }

# ==================== GIFT CODE SYSTEM ====================

class RedeemCodeRequest(BaseModel):
    code: str

class PrizeDrawingOptIn(BaseModel):
    opt_in: bool

async def generate_weekly_code():
    """AI generates a mystical-themed weekly code"""
    # Get the current week number for consistency
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    
    # Check if we already have a code for this week
    existing_code = await db.gift_codes.find_one({
        "week_start": week_start,
        "is_active": True
    })
    
    if existing_code:
        return existing_code
    
    # Generate new code using AI
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"gift-code-{uuid.uuid4()}"
        ).with_model("gemini", "gemini-2.0-flash")
        
        prompt = f"""Generate a single mystical promotional code for a psychic/spiritual app called Etheria. 
        The code should:
        - Be 8-12 characters
        - Use uppercase letters and numbers only
        - Have a mystical/spiritual feel (examples: LUNA-STAR-24, COSMIC7DREAM, ETHEREAL888)
        - Be easy to type
        
        Just respond with the code only, nothing else."""
        
        response = await chat.send_message(
            UserMessage(text=prompt)
        )
        
        code = response.text.strip().upper().replace(" ", "")
        # Ensure valid format
        if len(code) < 6 or len(code) > 15:
            # Fallback to generated code
            code = f"{random.choice(MYSTICAL_PREFIXES)}-{random.choice(MYSTICAL_MIDDLES)}-{random.randint(10, 99)}"
    except Exception as e:
        logging.error(f"AI code generation failed: {e}")
        # Fallback to random generation
        code = f"{random.choice(MYSTICAL_PREFIXES)}-{random.choice(MYSTICAL_MIDDLES)}-{random.randint(10, 99)}"
    
    # Store the new code
    code_doc = {
        "code": code,
        "week_start": week_start,
        "week_end": week_end,
        "created_at": now,
        "is_active": True,
        "redemptions": [],
        "max_redemptions": 1000  # Per week limit
    }
    
    await db.gift_codes.insert_one(code_doc)
    
    return code_doc

@api_router.get("/gift-code/current")
async def get_current_gift_code(request: Request):
    """Get the current week's active gift code (admin only or for display)"""
    # Generate or retrieve the current week's code
    code_doc = await generate_weekly_code()
    
    return {
        "code": code_doc["code"],
        "expires_at": code_doc["week_end"].isoformat(),
        "redemptions_count": len(code_doc.get("redemptions", []))
    }

@api_router.post("/gift-code/redeem")
async def redeem_gift_code(redeem_request: RedeemCodeRequest, request: Request):
    """Redeem a gift code for 1 month free premium"""
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please login to redeem a code")
    
    code = redeem_request.code.strip().upper()
    
    # Find the code
    code_doc = await db.gift_codes.find_one({
        "code": code,
        "is_active": True
    })
    
    if not code_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Check if code is still valid
    now = datetime.now(timezone.utc)
    week_end = code_doc["week_end"]
    if isinstance(week_end, str):
        week_end = datetime.fromisoformat(week_end.replace('Z', '+00:00'))
    if week_end.tzinfo is None:
        week_end = week_end.replace(tzinfo=timezone.utc)
    if now > week_end:
        raise HTTPException(status_code=400, detail="This code has expired")
    
    # Check if user already redeemed this code
    user_id = user.get("user_id")
    if user_id in [str(r.get("user_id")) for r in code_doc.get("redemptions", [])]:
        raise HTTPException(status_code=400, detail="You have already redeemed this code")
    
    # Check if user already has an active premium subscription
    existing_user = await db.users.find_one({"user_id": user_id})
    if existing_user:
        current_expires = existing_user.get("subscription_expires_at")
        if current_expires:
            if isinstance(current_expires, str):
                current_expires = datetime.fromisoformat(current_expires.replace("Z", "+00:00"))
            if current_expires.tzinfo is None:
                current_expires = current_expires.replace(tzinfo=timezone.utc)
            if current_expires > now:
                # Extend existing subscription
                new_expires = current_expires + timedelta(days=30)
            else:
                new_expires = now + timedelta(days=30)
        else:
            new_expires = now + timedelta(days=30)
    else:
        new_expires = now + timedelta(days=30)
    
    # Update user to premium
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "is_premium": True,
                "subscription_status": "gift_code",
                "subscription_expires_at": new_expires.isoformat(),
                "gift_code_redeemed_at": now.isoformat()
            }
        }
    )
    
    # Record the redemption
    await db.gift_codes.update_one(
        {"_id": code_doc["_id"]},
        {
            "$push": {
                "redemptions": {
                    "user_id": user_id,
                    "email": user.get("email"),
                    "redeemed_at": now.isoformat()
                }
            }
        }
    )
    
    return {
        "success": True,
        "message": "Congratulations! You now have 1 month of premium access!",
        "expires_at": new_expires.isoformat()
    }

# ==================== PRIZE DRAWING SYSTEM ====================

@api_router.post("/prize-drawing/opt-in")
async def opt_in_prize_drawing(opt_in_request: PrizeDrawingOptIn, request: Request):
    """Opt in or out of the monthly prize drawing"""
    try:
        user = await get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Please login to participate")
    
    await db.users.update_one(
        {"user_id": user.get("user_id")},
        {
            "$set": {
                "prize_drawing_opted_in": opt_in_request.opt_in,
                "prize_drawing_opted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "opted_in": opt_in_request.opt_in,
        "message": "You're now entered in the monthly prize drawing!" if opt_in_request.opt_in else "You've opted out of the prize drawing"
    }

@api_router.get("/prize-drawing/status")
async def get_prize_drawing_status(request: Request):
    """Get user's prize drawing status and eligibility"""
    try:
        user = await get_current_user(request)
    except HTTPException:
        return {
            "opted_in": False,
            "eligible": False,
            "weekly_usage_minutes": 0,
            "required_minutes": 30
        }
    
    user_doc = await db.users.find_one({"user_id": user.get("user_id")})
    opted_in = user_doc.get("prize_drawing_opted_in", False) if user_doc else False
    
    # Calculate weekly usage
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get all sessions from this week
    user_id = user.get("user_id")
    sessions = await db.usage_tracking.find({
        "user_id": user_id,
        "timestamp": {"$gte": week_start.isoformat()}
    }).to_list(1000)
    
    total_seconds = sum(s.get("duration_seconds", 0) for s in sessions)
    total_minutes = total_seconds / 60
    
    return {
        "opted_in": opted_in,
        "eligible": total_minutes >= 30,
        "weekly_usage_minutes": round(total_minutes, 1),
        "required_minutes": 30,
        "week_start": week_start.isoformat(),
        "next_drawing": get_next_drawing_date().isoformat()
    }

def get_next_drawing_date():
    """Get the date of the next monthly drawing (first of the month)"""
    now = datetime.now(timezone.utc)
    if now.day == 1:
        return now.replace(hour=12, minute=0, second=0, microsecond=0)
    
    # First of next month
    if now.month == 12:
        next_drawing = datetime(now.year + 1, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    else:
        next_drawing = datetime(now.year, now.month + 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    
    return next_drawing

@api_router.post("/usage/track")
async def track_usage(request: Request):
    """Track user's app usage for prize drawing eligibility"""
    body = await request.json()
    duration_seconds = body.get("duration_seconds", 0)
    activity_type = body.get("activity_type", "general")
    
    try:
        user = await get_current_user(request)
        user_id = str(user.get("user_id") or user.get("_id"))
    except HTTPException:
        return {"tracked": False, "reason": "Not logged in"}
    
    await db.usage_tracking.insert_one({
        "user_id": user_id,
        "duration_seconds": duration_seconds,
        "activity_type": activity_type,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"tracked": True, "duration_seconds": duration_seconds}

async def send_winner_email(email: str, code: str, expires_at: str):
    """Send winner notification email via Gmail SMTP"""
    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        logging.error("Gmail credentials not configured")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = '🎉 Congratulations! You Won the Etheria Monthly Drawing!'
        msg['From'] = GMAIL_EMAIL
        msg['To'] = email
        
        # Plain text version
        text = f"""
Congratulations! 🌟

You have been selected as the winner of Etheria's monthly prize drawing!

Your reward: 1 Month of FREE Premium Access

To claim your prize, use this exclusive code:
{code}

This code expires on: {expires_at}

How to redeem:
1. Open the Etheria app
2. Go to Settings or tap "Subscribe Now"
3. Click "Have a code?" 
4. Enter your code: {code}
5. Enjoy your free month of premium features!

Thank you for being part of the Etheria community.

Blessings on your spiritual journey,
The Etheria Team
        """
        
        # HTML version
        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #1a0033, #0f0321); color: #e9d5ff; padding: 40px;">
            <div style="max-width: 600px; margin: 0 auto; background: rgba(45, 27, 78, 0.9); border-radius: 16px; padding: 32px; border: 1px solid #7c3aed;">
                <h1 style="color: #ffd700; text-align: center;">🎉 Congratulations! 🎉</h1>
                <p style="font-size: 18px; text-align: center;">You have been selected as the winner of Etheria's monthly prize drawing!</p>
                
                <div style="background: linear-gradient(135deg, #7c3aed, #a855f7); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                    <p style="margin: 0; color: #fff; font-size: 16px;">Your Exclusive Code:</p>
                    <p style="font-size: 32px; font-weight: bold; color: #ffd700; margin: 12px 0; letter-spacing: 3px;">{code}</p>
                    <p style="margin: 0; color: #e9d5ff; font-size: 14px;">Expires: {expires_at}</p>
                </div>
                
                <h3 style="color: #b794f6;">How to Redeem:</h3>
                <ol style="color: #c4b5fd;">
                    <li>Open the Etheria app</li>
                    <li>Go to Settings or tap "Subscribe Now"</li>
                    <li>Click "Have a code?"</li>
                    <li>Enter your code</li>
                    <li>Enjoy 1 month of FREE premium features!</li>
                </ol>
                
                <p style="text-align: center; color: #9f7aea; margin-top: 32px;">
                    ✨ Thank you for being part of the Etheria community ✨
                </p>
            </div>
        </body>
        </html>
        """
        
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send via Gmail SMTP
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_EMAIL, email, msg.as_string())
        server.quit()
        
        return True
    except Exception as e:
        logging.error(f"Failed to send winner email: {e}")
        return False

@api_router.post("/admin/prize-drawing/run")
async def run_prize_drawing(request: Request):
    """Run the monthly prize drawing (admin only)"""
    body = await request.json()
    admin_secret = body.get("admin_secret")
    test_mode = body.get("test_mode", False)  # Skip eligibility for testing
    
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Get all eligible participants
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Find users who opted in
    opted_in_users = await db.users.find({
        "prize_drawing_opted_in": True
    }).to_list(10000)
    
    eligible_users = []
    
    for user in opted_in_users:
        user_id = str(user.get("user_id") or user.get("_id"))
        
        # In test mode, skip eligibility check
        if test_mode:
            eligible_users.append(user)
            continue
        
        # Check weekly usage for the past month (average 30 min/week)
        # Get all weeks in the month
        weeks_checked = 0
        weeks_eligible = 0
        
        check_date = month_start
        while check_date < now:
            week_end = min(check_date + timedelta(days=7), now)
            
            sessions = await db.usage_tracking.find({
                "user_id": user_id,
                "timestamp": {
                    "$gte": check_date.isoformat(),
                    "$lt": week_end.isoformat()
                }
            }).to_list(1000)
            
            total_seconds = sum(s.get("duration_seconds", 0) for s in sessions)
            if total_seconds >= 1800:  # 30 minutes = 1800 seconds
                weeks_eligible += 1
            
            weeks_checked += 1
            check_date = week_end
        
        # User is eligible if they met the 30 min requirement for at least half the weeks
        if weeks_checked > 0 and weeks_eligible >= (weeks_checked / 2):
            eligible_users.append(user)
    
    if not eligible_users:
        return {
            "success": False,
            "message": "No eligible participants this month",
            "participants_count": len(opted_in_users),
            "eligible_count": 0
        }
    
    # AI selects the winner (random from eligible)
    winner = random.choice(eligible_users)
    
    # Get or generate the current week's code
    code_doc = await generate_weekly_code()
    
    # Send winner email
    winner_email = winner.get("email")
    email_sent = await send_winner_email(
        winner_email,
        code_doc["code"],
        code_doc["week_end"].strftime("%B %d, %Y")
    )
    
    # Record the drawing
    drawing_record = {
        "drawing_date": now.isoformat(),
        "month": now.strftime("%B %Y"),
        "winner_id": str(winner.get("_id")),
        "winner_email": winner_email,
        "code_given": code_doc["code"],
        "code_expires": code_doc["week_end"].isoformat(),
        "email_sent": email_sent,
        "total_participants": len(opted_in_users),
        "eligible_participants": len(eligible_users)
    }
    
    await db.prize_drawings.insert_one(drawing_record)
    
    return {
        "success": True,
        "winner_email": winner_email,
        "code_given": code_doc["code"],
        "email_sent": email_sent,
        "total_participants": len(opted_in_users),
        "eligible_participants": len(eligible_users)
    }

# ==================== ADMIN DASHBOARD ====================

@api_router.get("/admin/dashboard")
async def get_admin_dashboard(admin_secret: str):
    """Get admin dashboard data"""
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Get current code
    code_doc = await generate_weekly_code()
    
    # Get drawing participants count
    participants = await db.users.count_documents({"prize_drawing_opted_in": True})
    
    # Get previous winners
    winners = await db.prize_drawings.find().sort("drawing_date", -1).limit(12).to_list(12)
    
    # Get total users
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"is_premium": True})
    
    return {
        "current_code": {
            "code": code_doc["code"],
            "expires_at": code_doc["week_end"].isoformat(),
            "redemptions_count": len(code_doc.get("redemptions", []))
        },
        "prize_drawing": {
            "participants_count": participants,
            "next_drawing": get_next_drawing_date().isoformat()
        },
        "previous_winners": [
            {
                "month": w.get("month"),
                "winner_email": w.get("winner_email", "").replace("@", " at ").split(" at ")[0] + "...@...",
                "drawing_date": w.get("drawing_date"),
                "eligible_count": w.get("eligible_participants", 0)
            }
            for w in winners
        ],
        "stats": {
            "total_users": total_users,
            "premium_users": premium_users
        }
    }

@api_router.get("/admin/participants")
async def get_drawing_participants(admin_secret: str):
    """Get list of prize drawing participants"""
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    participants = await db.users.find(
        {"prize_drawing_opted_in": True},
        {"email": 1, "name": 1, "prize_drawing_opted_at": 1}
    ).to_list(10000)
    
    return {
        "count": len(participants),
        "participants": [
            {
                "email": p.get("email"),
                "name": p.get("name"),
                "opted_at": p.get("prize_drawing_opted_at")
            }
            for p in participants
        ]
    }

@api_router.post("/admin/generate-new-code")
async def admin_generate_new_code(request: Request):
    """Force generate a new code (admin only)"""
    body = await request.json()
    admin_secret = body.get("admin_secret")
    
    if admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Deactivate current codes
    await db.gift_codes.update_many(
        {"is_active": True},
        {"$set": {"is_active": False}}
    )
    
    # Generate new code
    code_doc = await generate_weekly_code()
    
    return {
        "success": True,
        "new_code": code_doc["code"],
        "expires_at": code_doc["week_end"].isoformat()
    }

# ==================== FEEDBACK SYSTEM ====================

class FeedbackRequest(BaseModel):
    type: str  # bug, suggestion, question, other
    subject: str
    message: str
    user_email: str
    user_name: Optional[str] = "Anonymous"

async def send_feedback_email(feedback: FeedbackRequest):
    """Send feedback email to etheriasystems@gmail.com via Gmail SMTP"""
    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        logging.error("Gmail credentials not configured for feedback")
        return False
    
    try:
        # Map feedback type to emoji
        type_emoji = {
            "bug": "🐛",
            "suggestion": "💡",
            "question": "❓",
            "other": "💬"
        }
        emoji = type_emoji.get(feedback.type, "📧")
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'{emoji} Etheria Feedback: [{feedback.type.upper()}] {feedback.subject}'
        msg['From'] = GMAIL_EMAIL
        msg['To'] = 'etheriasystems@gmail.com'
        msg['Reply-To'] = feedback.user_email
        
        # Plain text version
        text = f"""
New Feedback Received from Etheria App
=====================================

Type: {feedback.type.upper()}
From: {feedback.user_name}
Email: {feedback.user_email}
Subject: {feedback.subject}

Message:
{feedback.message}

---
Submitted: {datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")}
        """
        
        # HTML version
        type_colors = {
            "bug": "#ef4444",
            "suggestion": "#f59e0b",
            "question": "#3b82f6",
            "other": "#8b5cf6"
        }
        color = type_colors.get(feedback.type, "#8b5cf6")
        
        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f3f4f6; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #1a0033, #2d1b4e); padding: 24px; text-align: center;">
                    <h1 style="color: #e9d5ff; margin: 0;">✨ Etheria Feedback ✨</h1>
                </div>
                
                <div style="padding: 24px;">
                    <div style="background: {color}20; border-left: 4px solid {color}; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                        <span style="color: {color}; font-weight: bold; text-transform: uppercase;">{emoji} {feedback.type}</span>
                    </div>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; width: 100px;">From:</td>
                            <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">{feedback.user_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                            <td style="padding: 8px 0;"><a href="mailto:{feedback.user_email}" style="color: #7c3aed;">{feedback.user_email}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Subject:</td>
                            <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">{feedback.subject}</td>
                        </tr>
                    </table>
                    
                    <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px;">
                        <h3 style="color: #374151; margin: 0 0 12px 0;">Message:</h3>
                        <p style="color: #4b5563; line-height: 1.6; margin: 0; white-space: pre-wrap;">{feedback.message}</p>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="mailto:{feedback.user_email}?subject=Re: {feedback.subject}" 
                           style="display: inline-block; background: #7c3aed; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                            Reply to User
                        </a>
                    </div>
                </div>
                
                <div style="background: #f3f4f6; padding: 16px; text-align: center; color: #6b7280; font-size: 12px;">
                    Submitted {datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")}
                </div>
            </div>
        </body>
        </html>
        """
        
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send via Gmail SMTP
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_EMAIL, 'etheriasystems@gmail.com', msg.as_string())
        server.quit()
        
        return True
    except Exception as e:
        logging.error(f"Failed to send feedback email: {e}")
        return False

@api_router.post("/feedback/submit")
async def submit_feedback(feedback: FeedbackRequest, request: Request):
    """Submit user feedback - sends email to etheriasystems@gmail.com"""
    
    # Validate input
    if not feedback.subject or len(feedback.subject) < 3:
        raise HTTPException(status_code=400, detail="Subject must be at least 3 characters")
    if not feedback.message or len(feedback.message) < 10:
        raise HTTPException(status_code=400, detail="Message must be at least 10 characters")
    if not feedback.user_email or '@' not in feedback.user_email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    
    # Try to get user info from auth
    user_id = None
    try:
        user = await get_current_user(request)
        user_id = str(user.get("user_id") or user.get("_id"))
    except:
        pass
    
    # Store feedback in database
    feedback_doc = {
        "_id": str(uuid.uuid4()),
        "type": feedback.type,
        "subject": feedback.subject,
        "message": feedback.message,
        "user_email": feedback.user_email,
        "user_name": feedback.user_name,
        "user_id": user_id,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "email_sent": False
    }
    
    await db.feedback.insert_one(feedback_doc)
    
    # Send email
    email_sent = await send_feedback_email(feedback)
    
    # Update record with email status
    await db.feedback.update_one(
        {"_id": feedback_doc["_id"]},
        {"$set": {"email_sent": email_sent}}
    )
    
    if not email_sent:
        logging.warning(f"Feedback saved but email not sent for {feedback_doc['_id']}")
    
    return {
        "success": True,
        "message": "Thank you for your feedback!",
        "feedback_id": feedback_doc["_id"],
        "email_sent": email_sent
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
