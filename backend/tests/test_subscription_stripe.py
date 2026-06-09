"""Backend tests for the NEW direct-Stripe subscription integration.

Validates:
- GET  /api/subscription/plans               (public)
- GET  /api/subscription/status              (auth optional → free; admin → premium)
- POST /api/subscription/create-checkout     (creates real Stripe Checkout sessions)
- GET  /api/subscription/checkout-status/{id}
- POST /api/webhook/stripe                   (dev fallback w/o secret)
- GET  /api/user/feature-access/{feature}
- Regression smoke on familiarity/daily-card/companion-guide

NOTE: STRIPE_WEBHOOK_SECRET is intentionally blank in backend/.env — webhook
should accept events without signature verification (dev fallback).
"""
import os
import time
import pytest
import requests

from tests.conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_admin_user_id(admin_auth_headers) -> str:
    """Look up the admin user_id via /api/auth/me (works regardless of whether
    login response includes user_id)."""
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_auth_headers, timeout=20)
    assert r.status_code == 200, f"/auth/me failed: {r.status_code} {r.text}"
    data = r.json()
    uid = data.get("user_id") or data.get("user", {}).get("user_id")
    assert uid, f"No user_id in /auth/me response: {data}"
    return uid


# ===========================================================================
# 1) GET /api/subscription/plans  (public)
# ===========================================================================
class TestPlans:
    def test_plans_returns_both_plans(self, api):
        r = api.get(f"{BASE_URL}/api/subscription/plans", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "plans" in body
        assert "free_tier_limits" in body
        plans = body["plans"]
        assert "premium_monthly" in plans
        assert "premium_annual" in plans

    def test_plans_shape_monthly(self, api):
        body = api.get(f"{BASE_URL}/api/subscription/plans", timeout=20).json()
        m = body["plans"]["premium_monthly"]
        assert m["name"]
        assert m["price"] == 3.99
        assert m["currency"] == "usd"
        assert m["interval"] == "month"
        assert isinstance(m["features"], list) and len(m["features"]) >= 1
        # stripe_price_id should be stripped from the public response
        assert "stripe_price_id" not in m

    def test_plans_shape_annual(self, api):
        body = api.get(f"{BASE_URL}/api/subscription/plans", timeout=20).json()
        a = body["plans"]["premium_annual"]
        assert a["price"] == 36.99
        assert a["interval"] == "year"
        assert a.get("savings_label"), "premium_annual must include savings_label"
        assert "stripe_price_id" not in a
        assert isinstance(a["features"], list) and len(a["features"]) >= 1

    def test_free_tier_limits_is_dict(self, api):
        body = api.get(f"{BASE_URL}/api/subscription/plans", timeout=20).json()
        assert isinstance(body["free_tier_limits"], dict)
        assert len(body["free_tier_limits"]) >= 1


# ===========================================================================
# 2) GET /api/subscription/status  (auth optional)
# ===========================================================================
class TestStatus:
    def test_status_no_auth_returns_free(self, api):
        r = api.get(f"{BASE_URL}/api/subscription/status", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_premium"] is False
        assert body["subscription_status"] == "free"
        assert isinstance(body["features"], dict)
        # all features should be False
        assert all(v is False for v in body["features"].values()), body["features"]

    def test_status_admin_returns_premium(self, admin_auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/subscription/status",
            headers=admin_auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Admin is set is_premium=True in DB
        assert body["is_premium"] is True, body
        assert isinstance(body["features"], dict)
        # all premium features should be true
        for k, v in body["features"].items():
            assert v is True, f"Premium feature {k} should be True but was {v}"


# ===========================================================================
# 3) POST /api/subscription/create-checkout
# ===========================================================================
class TestCreateCheckout:
    def test_missing_auth_returns_401(self, api):
        r = api.post(
            f"{BASE_URL}/api/subscription/create-checkout",
            json={"plan_id": "premium_monthly", "origin_url": "https://example.com"},
            timeout=20,
        )
        assert r.status_code == 401, r.text

    def test_invalid_plan_returns_400(self, admin_auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/subscription/create-checkout",
            headers=admin_auth_headers,
            json={"plan_id": "premium_foo", "origin_url": "https://example.com"},
            timeout=20,
        )
        assert r.status_code == 400, r.text

    @pytest.mark.parametrize("plan_id", ["premium_monthly", "premium_annual"])
    def test_create_checkout_returns_real_stripe_url(self, admin_auth_headers, plan_id, request):
        r = requests.post(
            f"{BASE_URL}/api/subscription/create-checkout",
            headers=admin_auth_headers,
            json={"plan_id": plan_id, "origin_url": "https://example.com"},
            timeout=30,
        )
        assert r.status_code == 200, f"{plan_id} → {r.status_code} {r.text}"
        data = r.json()
        assert "checkout_url" in data
        assert "session_id" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com/"), data["checkout_url"]
        assert data["session_id"].startswith("cs_"), data["session_id"]
        # Stash the monthly session id for the checkout-status test
        if plan_id == "premium_monthly":
            request.config.cache.set("monthly_session_id", data["session_id"])


# ===========================================================================
# 4) GET /api/subscription/checkout-status/{session_id}
# ===========================================================================
class TestCheckoutStatus:
    def test_unknown_session_returns_404(self, admin_auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/subscription/checkout-status/cs_test_does_not_exist_xyz",
            headers=admin_auth_headers,
            timeout=20,
        )
        assert r.status_code == 404, r.text

    def test_known_unpaid_session(self, admin_auth_headers, request):
        # Create a fresh session for this test (don't rely on cache)
        cr = requests.post(
            f"{BASE_URL}/api/subscription/create-checkout",
            headers=admin_auth_headers,
            json={"plan_id": "premium_monthly", "origin_url": "https://example.com"},
            timeout=30,
        )
        assert cr.status_code == 200, cr.text
        session_id = cr.json()["session_id"]

        # Small delay to let Stripe surface the session
        time.sleep(1)
        r = requests.get(
            f"{BASE_URL}/api/subscription/checkout-status/{session_id}",
            headers=admin_auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"checkout-status failed: {r.status_code} {r.text}"
        body = r.json()
        # Required shape
        for key in ("status", "payment_status", "amount_total", "currency"):
            assert key in body, f"missing {key} in {body}"
        # Just-created session is not paid
        assert body["payment_status"] in ("unpaid", "no_payment_required", None), body


# ===========================================================================
# 5) POST /api/webhook/stripe — dev fallback (no signature)
# ===========================================================================
class TestWebhookDevFallback:
    """Webhook secret is blank in env → endpoint should accept events without
    signature verification and process them."""

    @pytest.fixture(scope="class")
    def admin_user_id(self, admin_auth_headers):
        return _get_admin_user_id(admin_auth_headers)

    def test_checkout_completed_marks_admin_premium(self, admin_user_id):
        evt = {
            "type": "checkout.session.completed",
            "data": {"object": {
                "id": "cs_test_fake_completed_001",
                "customer": "cus_test_fake_001",
                "subscription": "sub_test_fake_001",
                "metadata": {"user_id": admin_user_id, "plan_id": "premium_annual"},
                "client_reference_id": admin_user_id,
            }}
        }
        r = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json=evt,
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json() == {"received": True}

        # Verify admin doc was updated — check subscription/status
        login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=20,
        )
        token = login.json().get("session_token")
        hdr = {"Authorization": f"Bearer {token}"}
        s = requests.get(f"{BASE_URL}/api/subscription/status", headers=hdr, timeout=20).json()
        assert s["is_premium"] is True
        assert s.get("expires_at"), "expires_at should be set after checkout.session.completed"
        # plan_id should reflect the event metadata
        assert s.get("plan_id") == "premium_annual", s

    def test_subscription_updated_active(self, admin_user_id):
        future_ts = int(time.time()) + 60 * 60 * 24 * 30  # +30 days
        evt = {
            "type": "customer.subscription.updated",
            "data": {"object": {
                "id": "sub_test_fake_001",
                "status": "active",
                "current_period_end": future_ts,
                "customer": "cus_test_fake_001",
                "metadata": {"user_id": admin_user_id, "plan_id": "premium_monthly"},
            }}
        }
        r = requests.post(f"{BASE_URL}/api/webhook/stripe", json=evt, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json() == {"received": True}

        # Verify admin status reflects active + new expiry
        login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=20,
        )
        token = login.json().get("session_token")
        hdr = {"Authorization": f"Bearer {token}"}
        s = requests.get(f"{BASE_URL}/api/subscription/status", headers=hdr, timeout=20).json()
        assert s["is_premium"] is True
        assert s.get("subscription_status") == "active", s
        # expires_at should be near the future_ts (ISO format)
        assert s.get("expires_at"), s

    def test_subscription_deleted_revokes_premium(self, admin_user_id):
        evt = {
            "type": "customer.subscription.deleted",
            "data": {"object": {
                "id": "sub_test_fake_001",
                "status": "canceled",
                "customer": "cus_test_fake_001",
                "metadata": {"user_id": admin_user_id, "plan_id": "premium_monthly"},
            }}
        }
        r = requests.post(f"{BASE_URL}/api/webhook/stripe", json=evt, timeout=20)
        assert r.status_code == 200, r.text

        login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=20,
        )
        token = login.json().get("session_token")
        hdr = {"Authorization": f"Bearer {token}"}
        s = requests.get(f"{BASE_URL}/api/subscription/status", headers=hdr, timeout=20).json()
        assert s["is_premium"] is False, f"admin should be unsubscribed after delete event, got {s}"


# ===========================================================================
# 6) Feature-access helper
# ===========================================================================
class TestFeatureAccess:
    def test_oracle_unlimited_admin_has_access(self, admin_auth_headers):
        # Restore admin to premium first (the deleted webhook test above will have
        # flipped is_premium=False). We use the same fake-checkout event.
        admin_user_id = _get_admin_user_id(admin_auth_headers)
        requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json={
                "type": "checkout.session.completed",
                "data": {"object": {
                    "id": "cs_test_restore_admin_premium",
                    "customer": "cus_test_restore_admin",
                    "subscription": "sub_test_restore_admin",
                    "metadata": {"user_id": admin_user_id, "plan_id": "premium_annual"},
                    "client_reference_id": admin_user_id,
                }}
            },
            timeout=20,
        )
        r = requests.get(
            f"{BASE_URL}/api/user/feature-access/oracle_readings_unlimited",
            headers=admin_auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["feature"] == "oracle_readings_unlimited"
        assert body["has_access"] is True, body
        assert body["upgrade_required"] is False, body


# ===========================================================================
# 7) Regression smoke
# ===========================================================================
class TestRegression:
    def test_spirit_guides_familiarity(self, admin_auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/spirit-guides/familiarity",
            headers=admin_auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_daily_card(self, admin_auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/daily/card",
            headers=admin_auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_companion_guide(self, admin_auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/companion-guide",
            headers=admin_auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
