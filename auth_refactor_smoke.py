"""Smoke regression test after auth refactor (auth extracted to routes/auth.py)."""
import os
import sys
import uuid
import requests

BASE = "https://etheria-divination.preview.emergentagent.com"
API = f"{BASE}/api"

ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

results = []


def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, ok, detail))
    print(f"[{status}] {name} :: {detail}")


def main():
    session = requests.Session()

    # 1) Signup with unique email
    unique = uuid.uuid4().hex[:10]
    signup_email = f"regression.{unique}@example.com"
    signup_payload = {
        "email": signup_email,
        "password": "Regression2026!",
        "name": "Regression Tester",
    }
    r = requests.post(f"{API}/auth/signup", json=signup_payload)
    signup_cookie = r.headers.get("Set-Cookie", "")
    has_cookie_signup = "session_token=" in signup_cookie
    try:
        body = r.json()
    except Exception:
        body = {}
    record(
        "1. POST /api/auth/signup",
        r.status_code == 200 and "user_id" in body,
        f"status={r.status_code}, user_id={body.get('user_id')}, set-cookie={has_cookie_signup}",
    )

    # 2) Admin login
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    login_cookie = r.headers.get("Set-Cookie", "")
    has_cookie_login = "session_token=" in login_cookie
    try:
        login_body = r.json()
    except Exception:
        login_body = {}
    admin_token = login_body.get("session_token")
    record(
        "2. POST /api/auth/login (admin)",
        r.status_code == 200
        and bool(admin_token)
        and login_body.get("is_admin") is True,
        f"status={r.status_code}, is_admin={login_body.get('is_admin')}, token={'yes' if admin_token else 'no'}, set-cookie={has_cookie_login}",
    )

    if not admin_token:
        print("ABORT: no admin token")
        sys.exit(1)

    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3) GET /api/auth/me
    r = requests.get(f"{API}/auth/me", headers=auth_headers)
    try:
        me_body = r.json()
    except Exception:
        me_body = {}
    record(
        "3. GET /api/auth/me",
        r.status_code == 200 and me_body.get("email") == ADMIN_EMAIL,
        f"status={r.status_code}, email={me_body.get('email')}",
    )

    # 4) PATCH /api/user/update-profile
    new_name = f"Admin {uuid.uuid4().hex[:6]}"
    r = requests.patch(
        f"{API}/user/update-profile",
        headers=auth_headers,
        json={"name": new_name},
    )
    try:
        up_body = r.json()
    except Exception:
        up_body = {}
    record(
        "4. PATCH /api/user/update-profile",
        r.status_code == 200 and up_body.get("name") == new_name,
        f"status={r.status_code}, name={up_body.get('name')} (expected {new_name})",
    )

    # 5) POST /api/auth/logout
    r = requests.post(f"{API}/auth/logout", headers=auth_headers)
    try:
        logout_body = r.json()
    except Exception:
        logout_body = {}
    record(
        "5. POST /api/auth/logout",
        r.status_code == 200,
        f"status={r.status_code}, body={logout_body}",
    )

    # Re-login to get a fresh token for the remaining authed tests (logout invalidated it)
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    admin_token = r.json().get("session_token")
    auth_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"[INFO] Re-logged in; new admin token acquired={'yes' if admin_token else 'no'}")

    # 6) GET /api/training/modules
    r = requests.get(f"{API}/training/modules")
    try:
        mods = r.json()
    except Exception:
        mods = None
    record(
        "6. GET /api/training/modules",
        r.status_code == 200 and isinstance(mods, list) and len(mods) > 0,
        f"status={r.status_code}, count={len(mods) if isinstance(mods, list) else 'N/A'}",
    )

    # 7) GET /api/admin/moderation/timeline
    r = requests.get(f"{API}/admin/moderation/timeline", headers=auth_headers)
    try:
        tl = r.json()
    except Exception:
        tl = {}
    has_keys = all(k in tl for k in ("active_suspensions", "counts", "constants"))
    record(
        "7. GET /api/admin/moderation/timeline",
        r.status_code == 200 and has_keys,
        f"status={r.status_code}, has_keys={has_keys}",
    )

    # 8) POST /api/oracle/draw
    r = requests.post(f"{API}/oracle/draw", json={"spread_type": "single"})
    try:
        draw = r.json()
    except Exception:
        draw = {}
    record(
        "8. POST /api/oracle/draw",
        r.status_code == 200 and "cards" in draw,
        f"status={r.status_code}, cards={len(draw.get('cards', [])) if isinstance(draw.get('cards'), list) else 'N/A'}",
    )

    # 9) GET /api/subscription/plans
    r = requests.get(f"{API}/subscription/plans")
    try:
        plans = r.json()
    except Exception:
        plans = {}
    record(
        "9. GET /api/subscription/plans",
        r.status_code == 200 and ("plans" in plans or "premium_monthly" in plans),
        f"status={r.status_code}, keys={list(plans.keys()) if isinstance(plans, dict) else 'N/A'}",
    )

    # 10) POST /api/community/admin/create-test-flag?token=... (query param auth)
    # Endpoint requires body with target user_id; pick one from all-users list
    users_resp = requests.get(
        f"{API}/community/admin/all-users",
        params={"token": admin_token},
    ).json()
    candidates = users_resp.get("users") if isinstance(users_resp, dict) else users_resp
    target_user_id = None
    for u in candidates or []:
        if not u.get("is_admin"):
            target_user_id = u.get("user_id") or u.get("id")
            break
    r = requests.post(
        f"{API}/community/admin/create-test-flag",
        params={"token": admin_token},
        json={"user_id": target_user_id},
    )
    try:
        flag_body = r.json()
    except Exception:
        flag_body = {}
    record(
        "10. POST /api/community/admin/create-test-flag?token=...",
        r.status_code == 200,
        f"status={r.status_code}, keys={list(flag_body.keys()) if isinstance(flag_body, dict) else 'N/A'}",
    )

    # 11) GET /api/community/admin/all-users?token=...
    r = requests.get(
        f"{API}/community/admin/all-users",
        params={"token": admin_token},
    )
    try:
        users_body = r.json()
    except Exception:
        users_body = {}
    users_list = users_body.get("users") if isinstance(users_body, dict) else users_body
    record(
        "11. GET /api/community/admin/all-users?token=...",
        r.status_code == 200,
        f"status={r.status_code}, users_count={len(users_list) if isinstance(users_list, list) else 'N/A'}",
    )

    # 12) GET /api/journal/status (still inline in server.py)
    r = requests.get(f"{API}/journal/status", headers=auth_headers)
    try:
        js = r.json()
    except Exception:
        js = {}
    record(
        "12. GET /api/journal/status (inline in server.py)",
        r.status_code == 200,
        f"status={r.status_code}, keys={list(js.keys()) if isinstance(js, dict) else 'N/A'}",
    )

    # 13) GET /api/subscription/status (still inline in server.py)
    r = requests.get(f"{API}/subscription/status", headers=auth_headers)
    try:
        ss = r.json()
    except Exception:
        ss = {}
    record(
        "13. GET /api/subscription/status (inline in server.py)",
        r.status_code == 200,
        f"status={r.status_code}, keys={list(ss.keys()) if isinstance(ss, dict) else 'N/A'}",
    )

    # Summary
    print("\n=== SUMMARY ===")
    fails = [r for r in results if not r[1]]
    print(f"Passed: {len(results) - len(fails)}/{len(results)}")
    for name, ok, detail in results:
        mark = "OK" if ok else "FAIL"
        print(f"  [{mark}] {name} :: {detail}")
    if fails:
        print("\nFAILURES:")
        for name, _, detail in fails:
            print(f"  - {name}: {detail}")
        sys.exit(1)


if __name__ == "__main__":
    main()
