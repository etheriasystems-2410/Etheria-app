"""Shared pytest fixtures for Etheria backend tests.

Provides:
- BASE_URL  : public preview URL (no trailing slash)
- api       : requests.Session with JSON headers
- admin_token: session_token for the admin (premium) account
- fresh_user: a freshly-created free-tier user (token + email + user_id)
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
           os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to the frontend/.env value if env not exported in the test runner shell.
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except FileNotFoundError:
        pass

ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"


@pytest.fixture(scope="session")
def base_url():
    assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL is required"
    return BASE_URL


@pytest.fixture()
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token")
    assert token, f"No session_token in admin login response: {data}"
    return token


@pytest.fixture(scope="session")
def admin_auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def fresh_user():
    """Create a brand-new free-tier user for premium-gating tests."""
    email = f"TEST_companion_{uuid.uuid4().hex[:10]}@example.com"
    password = "TestPass123!"
    name = "Companion Tester"
    r = requests.post(
        f"{BASE_URL}/api/auth/signup",
        json={"email": email, "password": password, "name": name},
        timeout=30,
    )
    assert r.status_code == 200, f"Signup failed: {r.status_code} {r.text}"
    # Signup sets cookie but not token; do a login to get session_token
    r2 = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r2.status_code == 200, f"Free user login failed: {r2.status_code} {r2.text}"
    data = r2.json()
    return {
        "email": email,
        "password": password,
        "user_id": data.get("user_id"),
        "token": data.get("session_token"),
    }


@pytest.fixture()
def fresh_user_headers(fresh_user):
    return {
        "Authorization": f"Bearer {fresh_user['token']}",
        "Content-Type": "application/json",
    }
