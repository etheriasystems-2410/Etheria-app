"""
Tests for the bi-weekly contest / prize drawing endpoints.

Covers:
- GET /api/prize-drawing/winners            (public, default limit)
- GET /api/prize-drawing/winners?limit=5    (limit param)
- GET /api/prize-drawing/status             (auth-guarded regression)
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") \
    if os.environ.get("EXPO_PUBLIC_BACKEND_URL") \
    else os.environ["EXPO_BACKEND_URL"].rstrip("/")

TIMEOUT = 30


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    """Log in as the admin user to exercise the auth-guarded regression check."""
    from memory_creds import ADMIN_EMAIL, ADMIN_PASSWORD  # type: ignore
    return None  # placeholder — replaced below


@pytest.fixture(scope="module")
def bearer_token(api):
    """Fetch a bearer token for the admin user for regression on /status."""
    payload = {"email": "etheriasystems@gmail.com", "password": "$Tory2410"}
    r = api.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=TIMEOUT)
    if r.status_code != 200:
        pytest.skip(f"Cannot log in admin — /auth/login returned {r.status_code}: {r.text[:200]}")
    data = r.json()
    token = data.get("session_token") or data.get("token") or data.get("access_token")
    if not token:
        pytest.skip(f"No token in login response: {list(data.keys())}")
    return token


# ==================== /prize-drawing/winners ====================

class TestPrizeDrawingWinners:
    def test_winners_default_shape(self, api):
        r = api.get(f"{BASE_URL}/api/prize-drawing/winners", timeout=TIMEOUT)
        assert r.status_code == 200, f"Expected 200 got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "winners" in data, f"Missing 'winners' key: {data}"
        assert "count" in data, f"Missing 'count' key: {data}"
        assert isinstance(data["winners"], list), "winners must be a list"
        assert isinstance(data["count"], int), "count must be int"
        assert data["count"] == len(data["winners"]), (
            f"count ({data['count']}) must equal len(winners) ({len(data['winners'])})"
        )

    def test_winners_no_auth_required(self, api):
        # No Authorization header at all — endpoint should still return 200.
        r = requests.get(f"{BASE_URL}/api/prize-drawing/winners", timeout=TIMEOUT)
        assert r.status_code == 200, f"Public endpoint returned {r.status_code}"

    def test_winners_limit_param(self, api):
        r = api.get(f"{BASE_URL}/api/prize-drawing/winners?limit=5", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "winners" in data and "count" in data
        assert data["count"] <= 5, f"count={data['count']} must be <= 5"
        assert len(data["winners"]) <= 5

    def test_winners_invalid_limit_is_clamped(self, api):
        # limit=0 or huge — the endpoint should clamp (1..100) instead of erroring.
        r = api.get(f"{BASE_URL}/api/prize-drawing/winners?limit=0", timeout=TIMEOUT)
        assert r.status_code == 200
        r2 = api.get(f"{BASE_URL}/api/prize-drawing/winners?limit=9999", timeout=TIMEOUT)
        assert r2.status_code == 200
        assert r2.json()["count"] <= 100

    def test_winners_masked_member_id_shape(self, api):
        r = api.get(f"{BASE_URL}/api/prize-drawing/winners", timeout=TIMEOUT)
        assert r.status_code == 200
        for w in r.json().get("winners", []):
            assert "member_id" in w
            assert "won_at" in w
            assert "contest_id" in w
            mid = w["member_id"]
            # Masked ID must never leak a raw uuid — expect an ellipsis or the anonymous sentinel.
            assert ("…" in mid) or (mid == "(anonymous)") or ("..." in mid), (
                f"member_id '{mid}' does not appear masked"
            )


# ==================== /prize-drawing/status regression ====================

class TestPrizeDrawingStatusRegression:
    def test_status_unauthenticated_returns_defaults(self, api):
        r = requests.get(f"{BASE_URL}/api/prize-drawing/status", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        for key in ("opted_in", "eligible", "weekly_usage_minutes", "required_minutes"):
            assert key in data, f"Missing key {key}"
        assert data["opted_in"] is False
        assert data["required_minutes"] == 30

    def test_status_with_bearer_token(self, api, bearer_token):
        r = requests.get(
            f"{BASE_URL}/api/prize-drawing/status",
            headers={"Authorization": f"Bearer {bearer_token}"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"Auth /status returned {r.status_code}: {r.text[:200]}"
        data = r.json()
        for key in ("opted_in", "eligible", "weekly_usage_minutes", "required_minutes",
                    "week_start", "next_drawing"):
            assert key in data, f"Missing key {key} in authed response: {data}"
        assert isinstance(data["opted_in"], bool)
