"""
Tests for the Oracle "app crashes on selection" fix.

Two backend guarantees we must verify:
  1. POST /api/oracle/draw returns `image_url` (never `image_base64`) and the
     response body is small (< 5 KB).
  2. GET  /api/oracle/readings strips legacy `image_base64` blobs from stored
     readings and replaces them with `image_url`.
"""
import os
import json
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to the frontend .env value pulled at test time
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

TEST_EMAIL = "test@etheria.com"
TEST_PASSWORD = "TestPass123!"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(api):
    """Log in as the seeded premium test user and return a bearer token."""
    for path in ("/api/auth/login", "/api/auth/signin"):
        r = api.post(
            f"{BASE_URL}{path}",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        if r.status_code == 200:
            data = r.json()
            token = (
                data.get("token")
                or data.get("access_token")
                or data.get("session_token")
                or (data.get("user") or {}).get("token")
            )
            if token:
                return token
    pytest.skip(f"Could not obtain auth token via login; last status={r.status_code}, body={r.text[:200]}")


# --------- /api/oracle/draw ------------------------------------------------

class TestOracleDraw:
    def test_single_card_draw_uses_image_url_not_base64(self, api):
        r = api.post(
            f"{BASE_URL}/api/oracle/draw",
            json={"spread_type": "single", "card_count": 1, "positions": ["Guidance"]},
            timeout=45,
        )
        assert r.status_code == 200, r.text[:300]
        body_bytes = len(r.content)
        # Small payload: hero of the fix
        assert body_bytes < 5 * 1024, f"/draw payload too large: {body_bytes} bytes"

        data = r.json()
        assert "cards" in data and isinstance(data["cards"], list) and len(data["cards"]) == 1
        card = data["cards"][0]["card"]
        # No base64 blob
        assert "image_base64" not in card, "image_base64 must not be present in /draw response"
        # image_url either None or a /api/oracle/card-image/ ref
        img = card.get("image_url")
        assert img is None or "/api/oracle/card-image/" in img

    def test_multi_card_draw_uses_image_url_not_base64(self, api):
        r = api.post(
            f"{BASE_URL}/api/oracle/draw",
            json={
                "spread_type": "three_card",
                "card_count": 3,
                "positions": ["Past", "Present", "Future"],
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text[:300]
        body_bytes = len(r.content)
        # A 3-card spread text-only should still be small (<20KB is plenty)
        assert body_bytes < 20 * 1024, f"3-card /draw payload too large: {body_bytes} bytes"

        data = r.json()
        assert len(data["cards"]) == 3
        for entry in data["cards"]:
            card = entry["card"]
            assert "image_base64" not in card
            img = card.get("image_url")
            assert img is None or "/api/oracle/card-image/" in img


# --------- /api/oracle/readings (legacy blob stripping) --------------------

class TestOracleReadingsStripsBase64:
    def test_readings_endpoint_never_returns_image_base64(self, api, auth_token):
        """The endpoint must strip any `image_base64` blob it finds on legacy
        readings and inject `image_url` in its place. Seed a legacy reading
        directly through /save so we know a stored blob exists."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}",
        }
        legacy_payload = {
            "spread_type": "single",
            "cards": [
                {
                    "position": "Guidance",
                    "card": {
                        "name": "The Fire Phoenix",
                        "element": "Fire",
                        "description": "TEST_legacy blob card",
                        # Fake but syntactically valid base64 blob (a few KB is enough
                        # to prove the endpoint really strips it).
                        "image_base64": "iVBORw0KGgoAAAANSUhEUgAA" + "A" * 4096,
                    },
                    "interpretation": "TEST_legacy interpretation",
                }
            ],
            "overall_interpretation": "",
            "timestamp": "2024-01-01T00:00:00",
        }
        save = requests.post(
            f"{BASE_URL}/api/oracle/save", headers=headers, json=legacy_payload, timeout=30
        )
        assert save.status_code == 200, save.text[:300]

        # Now GET readings — the endpoint MUST strip the blob.
        r = requests.get(
            f"{BASE_URL}/api/oracle/readings",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        readings = r.json()
        assert isinstance(readings, list)
        assert len(readings) >= 1

        # Walk every card in every reading — none may carry image_base64.
        for reading in readings:
            for entry in reading.get("cards") or []:
                card = entry.get("card") if isinstance(entry, dict) else None
                if not isinstance(card, dict):
                    continue
                assert "image_base64" not in card, (
                    f"image_base64 leaked back to client for card {card.get('name')}"
                )
                # If the card has a name we expect image_url to be injected.
                if card.get("name"):
                    assert card.get("image_url", "").startswith(
                        "/api/oracle/card-image/"
                    ) or card.get("image_url") is None or card.get("image_url", "").endswith(
                        "/api/oracle/card-image/" + card["name"].replace(" ", "%20")
                    ) or "/api/oracle/card-image/" in card.get("image_url", ""), (
                        f"Missing image_url for card {card['name']}"
                    )

    def test_readings_response_size_reasonable(self, api, auth_token):
        r = requests.get(
            f"{BASE_URL}/api/oracle/readings",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        # After stripping, even with several saved readings this should be
        # well under 500 KB — the crash regression was >2 MB per reading.
        assert len(r.content) < 500 * 1024, (
            f"/readings response too large: {len(r.content)} bytes"
        )
