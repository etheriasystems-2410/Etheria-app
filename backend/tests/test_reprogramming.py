"""
Backend tests for the Reprogramming (Self-Hypnosis) feature.

Covers:
- Public sessions list
- Authenticated sessions list with premium flags
- Session detail (found/not found)
- Base64 audio for free (deep-sleep) and free (confidence) — cached
- Premium gating: fresh free user hitting a premium session -> 402
- Free session access for a fresh free user -> 200
- Audio streaming endpoint (Content-Length header)
"""
import base64
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # Read frontend .env directly as fallback
    _env_path = "/app/frontend/.env"
    if os.path.exists(_env_path):
        with open(_env_path, "r") as fh:
            for line in fh:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.strip().split("=", 1)[1]
                    break
assert BASE_URL, "BASE_URL not resolvable"
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    for path in ("/api/auth/login", "/api/auth/signin"):
        r = api.post(f"{BASE_URL}{path}", json={"email": email, "password": password}, timeout=30)
        if r.status_code == 200:
            data = r.json()
            token = data.get("token") or data.get("access_token") or data.get("session_token")
            return token, data
    return None, None


@pytest.fixture(scope="module")
def admin_token(api):
    token, _ = _login(api, ADMIN_EMAIL, ADMIN_PASSWORD)
    if not token:
        pytest.skip("Admin login failed — cannot run authenticated tests")
    return token


@pytest.fixture(scope="module")
def free_user_token(api):
    """Register a fresh free user and return (token, email)."""
    email = f"TEST_repro_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    payload = {"email": email, "password": password, "name": "TEST Repro Free"}
    r = requests.post(f"{BASE_URL}/api/auth/signup", json=payload, timeout=30)
    if r.status_code not in (200, 201):
        pytest.skip(f"Could not register free user via /api/auth/signup: {r.status_code} {r.text[:200]}")
    data = {}
    try:
        data = r.json()
    except Exception:
        pass
    token = data.get("session_token") or data.get("token") or data.get("access_token")
    # Also check cookies for session_token
    if not token:
        token = r.cookies.get("session_token")
    if not token:
        # Try login
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        token, _ = _login(s, email, password)
    if not token:
        pytest.skip(f"Free user token not returned. body={data} cookies={dict(r.cookies)}")
    return token


# ---------------- Sessions list ----------------
class TestSessionsList:
    def test_list_public(self, api):
        r = api.get(f"{BASE_URL}/api/reprogramming/sessions", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("sessions"), list)
        assert len(data["sessions"]) == 12
        # Shape
        required_keys = {
            "id", "title", "subtitle", "icon", "color", "category",
            "is_free", "is_premium", "duration_minutes", "locked",
        }
        for s in data["sessions"]:
            missing = required_keys - set(s.keys())
            assert not missing, f"Missing keys {missing} in {s.get('id')}"
        assert data.get("free_session_ids") == ["confidence", "deep-sleep"]
        assert data.get("voice_provider") == "elevenlabs"
        assert data.get("is_premium") is False

        # Verify locked flags for public: only 2 free ones unlocked
        locked_count = sum(1 for s in data["sessions"] if s["locked"])
        assert locked_count == 10

    def test_list_admin(self, api, admin_token):
        r = api.get(
            f"{BASE_URL}/api/reprogramming/sessions",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("is_premium") is True
        assert len(data["sessions"]) == 12
        assert all(s["locked"] is False for s in data["sessions"])


# ---------------- Session detail ----------------
class TestSessionDetail:
    def test_detail_ok(self, api):
        r = api.get(f"{BASE_URL}/api/reprogramming/session/deep-sleep", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == "deep-sleep"
        assert data["is_free"] is True
        assert isinstance(data.get("duration_presets"), list)

    def test_detail_404(self, api):
        r = api.get(f"{BASE_URL}/api/reprogramming/session/does-not-exist", timeout=30)
        assert r.status_code == 404


# ---------------- Audio (base64) ----------------
class TestAudioBase64:
    def test_deep_sleep_base64(self, api, admin_token):
        t0 = time.time()
        r = api.get(
            f"{BASE_URL}/api/reprogramming/audio-base64/deep-sleep",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=180,
        )
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("format") == "mp3"
        assert data.get("byte_length", 0) > 100_000
        # Base64 sanity
        raw = base64.b64decode(data["audio_base64"])
        assert len(raw) == data["byte_length"]
        print(f"[deep-sleep] first fetch elapsed={elapsed:.2f}s bytes={data['byte_length']}")

    def test_deep_sleep_base64_cached(self, api, admin_token):
        t0 = time.time()
        r = api.get(
            f"{BASE_URL}/api/reprogramming/audio-base64/deep-sleep",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        elapsed = time.time() - t0
        assert r.status_code == 200
        # Should be fast because cached on disk
        assert elapsed < 15, f"Cache too slow: {elapsed:.2f}s"
        print(f"[deep-sleep] cached fetch elapsed={elapsed:.2f}s")

    def test_confidence_base64(self, api, admin_token):
        r = api.get(
            f"{BASE_URL}/api/reprogramming/audio-base64/confidence",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("byte_length", 0) > 100_000


# ---------------- Premium gating ----------------
class TestPaywall:
    def test_premium_session_blocked_for_free_user(self, free_user_token):
        # IMPORTANT: use a fresh requests session (no shared cookies) so that
        # only the Bearer token identifies the user; otherwise the admin's
        # cookie from a shared session would leak in and bypass paywall.
        r = requests.get(
            f"{BASE_URL}/api/reprogramming/audio-base64/quit-smoking",
            headers={"Authorization": f"Bearer {free_user_token}"},
            timeout=30,
        )
        assert r.status_code == 402, f"Expected 402, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        detail = body.get("detail")
        # Detail may be a dict or a string; check message content
        if isinstance(detail, dict):
            assert detail.get("requires_premium") is True
            assert "premium" in detail.get("message", "").lower()
        else:
            assert "premium" in str(detail).lower()

    def test_free_session_open_for_free_user(self, api, free_user_token):
        r = api.get(
            f"{BASE_URL}/api/reprogramming/audio-base64/deep-sleep",
            headers={"Authorization": f"Bearer {free_user_token}"},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("byte_length", 0) > 100_000


# ---------------- Audio streaming (MP3) ----------------
class TestAudioStream:
    def test_stream_headers(self, api, admin_token):
        r = api.get(
            f"{BASE_URL}/api/reprogramming/audio/deep-sleep",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("audio/mpeg")
        cl = int(r.headers.get("Content-Length", "0"))
        assert cl > 100_000, f"Content-Length too small: {cl}"
        assert len(r.content) == cl
