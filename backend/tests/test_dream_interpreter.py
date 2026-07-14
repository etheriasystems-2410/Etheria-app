"""Tests verifying the Dream Interpreter fix (gemini-2.5-flash migration).

Bug: POST /api/dreams/interpret was returning 500 due to deprecated
`gemini-2.0-flash` model. Fix: upgraded to `gemini-2.5-flash`. This suite
verifies the primary endpoint plus a light sanity check on the related
spirit-guides elemental chat endpoint (also LLM-backed).
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
    "https://etheria-divination.preview.emergentagent.com"


# --- Dream Interpreter (primary fix) ---
class TestDreamInterpret:
    def test_interpret_with_full_input(self):
        payload = {
            "description": "I was flying over a golden ocean",
            "symbols": ["ocean", "flying"],
            "feelings": ["peaceful", "free"],
        }
        r = requests.post(f"{BASE_URL}/api/dreams/interpret", json=payload, timeout=90)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("success") is True, f"success flag missing/false: {data}"
        interp = data.get("interpretation", "")
        assert isinstance(interp, str), "interpretation must be a string"
        assert len(interp) > 400, f"interpretation too short ({len(interp)} chars): {interp[:200]}"

    def test_interpret_with_empty_description(self):
        payload = {
            "description": "",
            "symbols": ["water", "shadow"],
            "feelings": ["curious", "anxious"],
        }
        r = requests.post(f"{BASE_URL}/api/dreams/interpret", json=payload, timeout=90)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("success") is True
        interp = data.get("interpretation", "")
        assert len(interp) > 200, f"interpretation too short: {interp[:200]}"


# --- Spirit Guides elemental chat (light sanity — no premium gate for elemental) ---
class TestSpiritGuideChat:
    def test_elemental_guide_chat_no_500(self):
        """Ignis (Fire) is elemental, free for all users, no auth required."""
        payload = {
            "guide": "Ignis",
            "element": "Fire",
            "message": "Hello, what wisdom do you have for me today?",
            "history": [],
            "language": "en",
        }
        r = requests.post(f"{BASE_URL}/api/spirit-guides/chat", json=payload, timeout=120)
        # Must not be 500 (model deprecation would surface here)
        assert r.status_code != 500, f"Server 500 (model issue?): {r.text[:400]}"
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("success") is True
        assert isinstance(data.get("response"), str) and len(data["response"]) > 0
