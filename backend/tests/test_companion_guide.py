"""Backend tests for the Companion Guide premium feature.

Covers:
- GET    /api/companion-guide                 (auth)
- PUT    /api/companion-guide                 (premium-gated)
- DELETE /api/companion-guide                 (auth)
- GET    /api/companion-guide/whisper         (auth, 404 if no companion)
- GET    /api/companion-guide/whispers/today  (auth, 404 if no companion)
- Regression smoke for the routers we may have stepped on:
  /api/spirit-guides/familiarity, /api/daily/card, /api/daily/collective,
  /api/notifications/test, /api/notifications/register
"""
import time

import pytest
import requests


# ---------------------------------------------------------------------------
# Auth guards
# ---------------------------------------------------------------------------
class TestAuthGuards:
    """All companion-guide endpoints require authentication."""

    def test_get_requires_auth(self, base_url, api):
        r = api.get(f"{base_url}/api/companion-guide")
        assert r.status_code == 401, r.text

    def test_put_requires_auth(self, base_url, api):
        r = api.put(f"{base_url}/api/companion-guide", json={"guide_name": "Aqua"})
        assert r.status_code == 401, r.text

    def test_delete_requires_auth(self, base_url, api):
        r = api.delete(f"{base_url}/api/companion-guide")
        assert r.status_code == 401, r.text

    def test_whisper_requires_auth(self, base_url, api):
        r = api.get(f"{base_url}/api/companion-guide/whisper")
        assert r.status_code == 401, r.text

    def test_whispers_today_requires_auth(self, base_url, api):
        r = api.get(f"{base_url}/api/companion-guide/whispers/today")
        assert r.status_code == 401, r.text


# ---------------------------------------------------------------------------
# Premium gating (free user)
# ---------------------------------------------------------------------------
class TestPremiumGating:
    """Fresh user is not premium → PUT should be rejected with 403."""

    def test_fresh_user_get_returns_nulls(self, base_url, fresh_user_headers):
        r = requests.get(f"{base_url}/api/companion-guide", headers=fresh_user_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body == {"companion": None, "whisper": None, "whisper_at": None}, body

    def test_free_user_put_is_403_with_premium_message(self, base_url, fresh_user_headers):
        r = requests.put(
            f"{base_url}/api/companion-guide",
            headers=fresh_user_headers,
            json={"guide_name": "Aqua"},
            timeout=30,
        )
        assert r.status_code == 403, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "premium" in detail and "companion guide" in detail, r.json()

    def test_free_user_whisper_without_companion_is_404(self, base_url, fresh_user_headers):
        r = requests.get(f"{base_url}/api/companion-guide/whisper", headers=fresh_user_headers, timeout=30)
        assert r.status_code == 404, r.text

    def test_free_user_whispers_today_without_companion_is_404(self, base_url, fresh_user_headers):
        r = requests.get(f"{base_url}/api/companion-guide/whispers/today", headers=fresh_user_headers, timeout=30)
        assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# Happy-path: admin (premium) flow
# ---------------------------------------------------------------------------
class TestAdminCompanionFlow:
    """Admin is always premium — full CRUD + whisper coverage."""

    def test_a_clear_starting_state(self, base_url, admin_auth_headers):
        # DELETE first so we start from a clean slate (idempotent)
        r = requests.delete(f"{base_url}/api/companion-guide", headers=admin_auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        r2 = requests.get(f"{base_url}/api/companion-guide", headers=admin_auth_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body == {"companion": None, "whisper": None, "whisper_at": None}, body

    def test_b_put_empty_guide_name_is_400(self, base_url, admin_auth_headers):
        r = requests.put(
            f"{base_url}/api/companion-guide",
            headers=admin_auth_headers,
            json={"guide_name": ""},
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "guide_name" in (r.json().get("detail") or "").lower()

    def test_c_put_missing_guide_name_is_4xx(self, base_url, admin_auth_headers):
        # Pydantic missing required field returns 422; this is the FastAPI default.
        r = requests.put(
            f"{base_url}/api/companion-guide",
            headers=admin_auth_headers,
            json={},
            timeout=30,
        )
        assert r.status_code in (400, 422), r.text

    def test_d_put_aqua_succeeds_and_persists(self, base_url, admin_auth_headers):
        r = requests.put(
            f"{base_url}/api/companion-guide",
            headers=admin_auth_headers,
            json={"guide_name": "Aqua"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("companion") == "Aqua", body
        whisper = body.get("whisper")
        assert isinstance(whisper, str) and len(whisper) > 0, body
        assert len(whisper) <= 130, f"whisper too long ({len(whisper)} chars): {whisper}"

        # GET should now reflect Aqua + the cached whisper + ISO timestamp.
        r2 = requests.get(f"{base_url}/api/companion-guide", headers=admin_auth_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        g = r2.json()
        assert g.get("companion") == "Aqua", g
        assert g.get("whisper") == whisper, g
        ts = g.get("whisper_at")
        assert isinstance(ts, str) and "T" in ts, g

    def test_e_whisper_returns_cached_after_put(self, base_url, admin_auth_headers):
        r = requests.get(f"{base_url}/api/companion-guide/whisper", headers=admin_auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("guide") == "Aqua", body
        assert body.get("cached") is True, body
        assert isinstance(body.get("whisper"), str) and len(body["whisper"]) > 0, body

        # Second call within TTL stays cached.
        r2 = requests.get(f"{base_url}/api/companion-guide/whisper", headers=admin_auth_headers, timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("cached") is True

    def test_f_whispers_today_returns_three(self, base_url, admin_auth_headers):
        r = requests.get(
            f"{base_url}/api/companion-guide/whispers/today",
            headers=admin_auth_headers,
            timeout=120,  # 3 LLM calls
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("guide") == "Aqua", body
        whispers = body.get("whispers")
        assert isinstance(whispers, list) and len(whispers) == 3, body
        for w in whispers:
            assert isinstance(w, str) and len(w) > 0, w
            assert len(w) <= 130, f"whisper too long ({len(w)}): {w}"
        gen = body.get("generated_at")
        assert isinstance(gen, str) and "T" in gen, body

    def test_g_put_helios_divine_premium_succeeds(self, base_url, admin_auth_headers):
        r = requests.put(
            f"{base_url}/api/companion-guide",
            headers=admin_auth_headers,
            json={"guide_name": "Helios"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("companion") == "Helios", body
        assert isinstance(body.get("whisper"), str) and len(body["whisper"]) > 0, body

    def test_h_put_unknown_name_treated_as_renamed_custom(self, base_url, admin_auth_headers):
        r = requests.put(
            f"{base_url}/api/companion-guide",
            headers=admin_auth_headers,
            json={"guide_name": "RandomNonsense"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("companion") == "RandomNonsense", body
        assert isinstance(body.get("whisper"), str) and len(body["whisper"]) > 0, body

    def test_i_delete_clears_companion(self, base_url, admin_auth_headers):
        r = requests.delete(f"{base_url}/api/companion-guide", headers=admin_auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        r2 = requests.get(f"{base_url}/api/companion-guide", headers=admin_auth_headers, timeout=30)
        assert r2.status_code == 200
        body = r2.json()
        assert body == {"companion": None, "whisper": None, "whisper_at": None}, body

    def test_j_whisper_after_delete_is_404(self, base_url, admin_auth_headers):
        r = requests.get(f"{base_url}/api/companion-guide/whisper", headers=admin_auth_headers, timeout=30)
        assert r.status_code == 404, r.text

    def test_k_whispers_today_after_delete_is_404(self, base_url, admin_auth_headers):
        r = requests.get(f"{base_url}/api/companion-guide/whispers/today", headers=admin_auth_headers, timeout=30)
        assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# Regression smoke for adjacent routers
# ---------------------------------------------------------------------------
class TestRegressionSmoke:
    """Ensure registering the companion router didn't break neighbouring routes."""

    def test_spirit_guides_familiarity(self, base_url, admin_auth_headers):
        r = requests.get(
            f"{base_url}/api/spirit-guides/familiarity",
            headers=admin_auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), (dict, list)), r.text

    def test_daily_card(self, base_url, admin_auth_headers):
        r = requests.get(
            f"{base_url}/api/daily/card",
            headers=admin_auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict), body

    def test_daily_collective(self, base_url, admin_auth_headers):
        r = requests.get(
            f"{base_url}/api/daily/collective",
            headers=admin_auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text

    def test_notifications_test_endpoint(self, base_url, admin_auth_headers):
        r = requests.post(
            f"{base_url}/api/notifications/test",
            headers=admin_auth_headers,
            json={},
            timeout=30,
        )
        # Should return JSON 200 even when relay key is placeholder (fail-soft)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict), r.text

    def test_notifications_register_endpoint(self, base_url, admin_auth_headers):
        # Legacy alias — accepts a token body and returns JSON {success, registered}
        r = requests.post(
            f"{base_url}/api/notifications/register",
            headers=admin_auth_headers,
            json={"token": "ExponentPushToken[TESTTOKEN_companion_regression]"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict), body
        assert "success" in body, body
