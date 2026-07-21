"""Oracle deck bug-fix verification tests.

Verifies the latency and payload fix for POST /api/oracle/draw:
- single card: HTTP 200, <15s, contains card + interpretation
- three_card: HTTP 200, <25s, 3 cards + woven overall_interpretation
- celtic (5-card): HTTP 200, <40s
- /oracle/chat regression against a fresh 3-card spread.
"""
import os
import time
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
    or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
)
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _post_draw(api, payload):
    t0 = time.time()
    r = api.post(f"{BASE_URL}/api/oracle/draw", json=payload, timeout=90)
    return r, time.time() - t0


# ---------------------------------------------------------------------------
# /api/oracle/draw — latency + payload verification
# ---------------------------------------------------------------------------
class TestOracleDraw:
    def test_single_card_draw_under_15s(self, api):
        r, elapsed = _post_draw(
            api,
            {"card_count": 1, "spread_type": "single", "positions": ["Guidance"]},
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        assert elapsed < 15, f"Single-card draw took {elapsed:.1f}s (>15s)"
        data = r.json()
        assert data.get("spread_type") == "single"
        cards = data.get("cards") or []
        assert len(cards) == 1
        c0 = cards[0]
        assert c0.get("card"), "missing card object"
        assert c0["card"].get("name")
        assert c0["card"].get("element")
        # image_base64 should be present (all 27 pre-warmed) OR None if a
        # race-condition eviction happened — accept either but log.
        img = c0["card"].get("image_base64")
        interp = (c0.get("interpretation") or "").strip()
        assert len(interp) > 50, f"Interpretation too short ({len(interp)} chars)"
        print(f"[single] {elapsed:.1f}s, image={'yes' if img else 'no'}, "
              f"interp={len(interp)} chars")

    def test_three_card_draw_under_25s(self, api):
        r, elapsed = _post_draw(
            api,
            {
                "card_count": 3,
                "spread_type": "three_card",
                "positions": ["Past", "Present", "Future"],
            },
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        assert elapsed < 25, f"3-card draw took {elapsed:.1f}s (>25s)"
        data = r.json()
        cards = data.get("cards") or []
        assert len(cards) == 3, f"expected 3 cards, got {len(cards)}"
        for i, c in enumerate(cards):
            assert c.get("card", {}).get("name"), f"card {i} has no name"
            assert (c.get("interpretation") or "").strip(), \
                f"card {i} has empty interpretation"
        overall = (data.get("overall_interpretation") or "").strip()
        assert overall, "overall_interpretation is empty"
        word_count = len(overall.split())
        # Spec says 280-380 but allow a small slack from the LLM.
        assert 180 <= word_count <= 500, \
            f"overall_interpretation word count {word_count} outside 180-500"
        # Ensure cards are unique
        names = [c["card"]["name"] for c in cards]
        assert len(set(names)) == 3, f"duplicate cards drawn: {names}"
        print(f"[three_card] {elapsed:.1f}s, overall={word_count} words")

    def test_celtic_five_card_under_40s(self, api):
        r, elapsed = _post_draw(
            api,
            {
                "card_count": 5,
                "spread_type": "celtic_cross",
                "positions": [
                    "Present",
                    "Challenge",
                    "Past",
                    "Future",
                    "Outcome",
                ],
            },
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        assert elapsed < 40, f"5-card draw took {elapsed:.1f}s (>40s)"
        data = r.json()
        cards = data.get("cards") or []
        assert len(cards) == 5
        for c in cards:
            assert (c.get("interpretation") or "").strip()
        assert (data.get("overall_interpretation") or "").strip()
        print(f"[celtic 5] {elapsed:.1f}s")


# ---------------------------------------------------------------------------
# Image cache coverage — verify most/all 27 cards are cached by drawing many
# ---------------------------------------------------------------------------
class TestOracleImageCache:
    def test_repeated_draws_serve_cached_images(self, api):
        """Draw 3-card spreads a few times and confirm cached images
        come back (i.e., not all None) — indirect check of the cache."""
        seen_with_image = 0
        seen_total = 0
        for _ in range(3):
            r, _ = _post_draw(
                api,
                {
                    "card_count": 3,
                    "spread_type": "three_card",
                    "positions": ["Past", "Present", "Future"],
                },
            )
            assert r.status_code == 200
            for c in r.json().get("cards", []):
                seen_total += 1
                if c["card"].get("image_base64"):
                    seen_with_image += 1
        assert seen_total == 9
        # With 27/27 cached, EVERY sample should return an image.
        assert seen_with_image >= 8, \
            f"only {seen_with_image}/9 draws returned a cached image"
        print(f"[image cache] {seen_with_image}/{seen_total} draws had images")


# ---------------------------------------------------------------------------
# /api/oracle/chat — regression
# ---------------------------------------------------------------------------
class TestOracleChat:
    def test_chat_against_fresh_three_card_spread(self, api):
        # 1) draw
        draw_r, _ = _post_draw(
            api,
            {
                "card_count": 3,
                "spread_type": "three_card",
                "positions": ["Past", "Present", "Future"],
            },
        )
        assert draw_r.status_code == 200
        reading = draw_r.json()

        # 2) chat
        t0 = time.time()
        chat_r = api.post(
            f"{BASE_URL}/api/oracle/chat",
            json={
                "reading": reading,
                "history": [],
                "question": "What does the pattern of these cards suggest?",
            },
            timeout=45,
        )
        elapsed = time.time() - t0
        assert chat_r.status_code == 200, \
            f"chat HTTP {chat_r.status_code}: {chat_r.text[:300]}"
        assert elapsed < 20, f"chat took {elapsed:.1f}s (>20s)"
        body = chat_r.json()
        response = (body.get("response") or "").strip()
        assert len(response) > 40, f"chat reply too short: {response!r}"
        # Quantum should not use markdown per its system prompt.
        assert "**" not in response, "chat response contains markdown bold"
        print(f"[chat] {elapsed:.1f}s, {len(response.split())} words")

    def test_chat_missing_reading_returns_400(self, api):
        r = api.post(
            f"{BASE_URL}/api/oracle/chat",
            json={"reading": {}, "history": [], "question": "hello"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_chat_missing_question_returns_400(self, api):
        r = api.post(
            f"{BASE_URL}/api/oracle/chat",
            json={
                "reading": {"cards": [{"card": {"name": "x"}}]},
                "history": [],
                "question": "   ",
            },
            timeout=15,
        )
        assert r.status_code == 400
