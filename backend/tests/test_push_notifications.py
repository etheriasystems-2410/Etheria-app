"""
Backend tests for the new Emergent-managed push relay + daily reminder
scheduler (Etheria).

Covers:
  1. POST /api/register-push (body validation + placeholder-key failure path)
  2. GET  /api/notifications/preferences (defaults)
  3. PUT  /api/notifications/preferences (persistence + range validation)
  4. POST /api/notifications/test (graceful upstream failure)
  5. POST /api/notifications/register (legacy alias)
  6. notification_scheduler module smoke test
  7. Existing /api endpoints still work (regression)
"""
import os
import sys
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://etheria-divination.preview.emergentagent.com"
).rstrip("/")


# --------------------------------------------------------------------------
# 1. /api/register-push
# --------------------------------------------------------------------------
class TestRegisterPush:
    def test_missing_fields_returns_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/register-push", json={})
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    def test_missing_device_token_returns_422(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/register-push",
            json={"user_id": "u1", "platform": "ios"},
        )
        assert r.status_code == 422

    def test_missing_platform_returns_422(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/register-push",
            json={"user_id": "u1", "device_token": "tok"},
        )
        assert r.status_code == 422

    def test_valid_body_returns_500_with_placeholder_key(self, api_client):
        """With EMERGENT_PUSH_KEY=placeholder, upstream relay will fail.
        Endpoint should respond with 500 'Push provider unavailable' and
        MUST NOT crash the server."""
        r = api_client.post(
            f"{BASE_URL}/api/register-push",
            json={
                "user_id": "test_user_register_push",
                "platform": "ios",
                "device_token": "ExponentPushToken[TEST_xxx]",
            },
            timeout=20,
        )
        # Server must not crash; 500 is the documented response.
        assert r.status_code in (500, 502, 503), (
            f"Expected 5xx from placeholder relay; got {r.status_code}: {r.text}"
        )
        # Server is still alive — health-style ping
        r2 = api_client.get(f"{BASE_URL}/api/", timeout=10)
        # Just confirm the process didn't die
        assert r2.status_code < 600


# --------------------------------------------------------------------------
# 2 + 3. /api/notifications/preferences
# --------------------------------------------------------------------------
class TestNotificationPreferences:
    DEFAULTS = {
        "oracle_reminder_enabled": True,
        "oracle_reminder_hour": 9,
        "dream_reminder_enabled": True,
        "dream_reminder_hour": 7,
        "timezone_offset_minutes": 0,
    }

    def test_get_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notifications/preferences")
        assert r.status_code == 401

    def test_put_requires_auth(self, api_client):
        r = api_client.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=self.DEFAULTS,
        )
        assert r.status_code == 401

    def test_put_then_get_roundtrip(self, api_client, auth_headers):
        # Save custom prefs
        custom = {
            "oracle_reminder_enabled": False,
            "oracle_reminder_hour": 8,
            "dream_reminder_enabled": True,
            "dream_reminder_hour": 6,
            "timezone_offset_minutes": -300,
        }
        r = api_client.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=custom,
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("preferences") == custom

        # GET returns saved values
        r2 = api_client.get(
            f"{BASE_URL}/api/notifications/preferences",
            headers=auth_headers,
        )
        assert r2.status_code == 200
        data = r2.json()
        for k, v in custom.items():
            assert data.get(k) == v, f"Mismatch for {k}: {data.get(k)} != {v}"

        # Reset to defaults so subsequent runs / scheduler are clean
        api_client.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=self.DEFAULTS,
            headers=auth_headers,
        )

    def test_hour_out_of_range_rejected(self, api_client, auth_headers):
        bad = {**self.DEFAULTS, "oracle_reminder_hour": 24}
        r = api_client.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=bad,
            headers=auth_headers,
        )
        assert r.status_code == 422

        bad2 = {**self.DEFAULTS, "dream_reminder_hour": -1}
        r2 = api_client.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=bad2,
            headers=auth_headers,
        )
        assert r2.status_code == 422

    def test_timezone_offset_out_of_range_rejected(self, api_client, auth_headers):
        bad = {**self.DEFAULTS, "timezone_offset_minutes": -721}
        r = api_client.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=bad,
            headers=auth_headers,
        )
        assert r.status_code == 422

        bad2 = {**self.DEFAULTS, "timezone_offset_minutes": 841}
        r2 = api_client.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=bad2,
            headers=auth_headers,
        )
        assert r2.status_code == 422


# --------------------------------------------------------------------------
# 4. /api/notifications/test
# --------------------------------------------------------------------------
class TestNotificationsTest:
    def test_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/notifications/test")
        assert r.status_code == 401

    def test_returns_json_does_not_500(self, api_client, auth_headers):
        r = api_client.post(
            f"{BASE_URL}/api/notifications/test",
            headers=auth_headers,
            timeout=20,
        )
        # With placeholder key, relay will fail; endpoint must still respond 200 JSON.
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert "success" in data
        assert isinstance(data["success"], bool)
        # With placeholder key, expect False
        assert data["success"] is False


# --------------------------------------------------------------------------
# 5. /api/notifications/register (legacy alias)
# --------------------------------------------------------------------------
class TestLegacyRegister:
    def test_requires_auth(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/notifications/register",
            json={"token": "abc", "device_info": {"os": "ios"}},
        )
        assert r.status_code == 401

    def test_returns_json_does_not_crash(self, api_client, auth_headers):
        r = api_client.post(
            f"{BASE_URL}/api/notifications/register",
            json={"token": "abc", "device_info": {"os": "ios"}},
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert "success" in data
        # With placeholder relay -> success=False, registered=None
        assert data["success"] is False
        assert data.get("registered") is None


# --------------------------------------------------------------------------
# 6. notification_scheduler module smoke test
# --------------------------------------------------------------------------
class TestSchedulerSmoke:
    def test_module_imports_cleanly(self):
        sys.path.insert(0, "/app/backend")
        from services import notification_scheduler  # noqa: F401
        assert hasattr(notification_scheduler, "start")
        assert hasattr(notification_scheduler, "stop")
        assert hasattr(notification_scheduler, "_tick_once")

    def test_start_is_idempotent_and_tick_runs(self):
        """start(db) twice must not start two tasks; _tick_once() runs
        without exceptions against the live DB."""
        import asyncio
        sys.path.insert(0, "/app/backend")
        from motor.motor_asyncio import AsyncIOMotorClient
        from services import notification_scheduler as sched

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")

        async def _run():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            try:
                # Seed: ensure at least one user document so _tick_once exercises
                # the cursor branch. Use admin user (must already exist).
                admin = await db.users.find_one(
                    {"email": "etheriasystems@gmail.com"}
                )
                if admin:
                    await db.users.update_one(
                        {"user_id": admin["user_id"]},
                        {
                            "$set": {
                                "push_registered_at": __import__(
                                    "datetime"
                                ).datetime.utcnow(),
                                "push_platform": "ios",
                                # last_card_date NOT today -> oracle path may fire
                                "last_card_date": "1970-01-01",
                                "notification_prefs": {
                                    "oracle_reminder_enabled": True,
                                    "oracle_reminder_hour": 9,
                                    "dream_reminder_enabled": True,
                                    "dream_reminder_hour": 7,
                                    "timezone_offset_minutes": 0,
                                },
                                "streak_count": 5,
                            }
                        },
                    )

                # First start
                sched.start(db)
                first_task = sched._task
                assert first_task is not None
                # Second start should be a no-op (same task)
                sched.start(db)
                assert sched._task is first_task, (
                    "start() created a second task on duplicate call"
                )

                # Run a tick directly (does not depend on scheduler loop)
                await sched._tick_once()
            finally:
                sched.stop()
                client.close()

        # Use a fresh loop to avoid clashing with pytest's loop policy
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_run())
        finally:
            loop.close()

    def test_send_push_to_user_signature_preserved(self):
        """messages.py calls send_push_to_user(db, user_id, title, body, data).
        Make sure that signature didn't break with the rewrite."""
        import inspect
        sys.path.insert(0, "/app/backend")
        from services.push_service import send_push_to_user

        sig = inspect.signature(send_push_to_user)
        params = list(sig.parameters.keys())
        # Expected: db, user_id, title, body, data
        assert params[:4] == ["db", "user_id", "title", "body"], (
            f"send_push_to_user signature drift: {params}"
        )
        assert "data" in params


# --------------------------------------------------------------------------
# 7. Regression: unrelated /api endpoints still work
# --------------------------------------------------------------------------
class TestRegressionUnrelatedEndpoints:
    def test_spirit_guides_familiarity(self, api_client, auth_headers):
        r = api_client.get(
            f"{BASE_URL}/api/spirit-guides/familiarity",
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"

    def test_daily_card(self, api_client, auth_headers):
        r = api_client.get(
            f"{BASE_URL}/api/daily/card", headers=auth_headers, timeout=30
        )
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"

    def test_daily_collective(self, api_client, auth_headers):
        r = api_client.get(
            f"{BASE_URL}/api/daily/collective", headers=auth_headers, timeout=30
        )
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
