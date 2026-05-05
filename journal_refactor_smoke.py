"""
Regression smoke test for journal refactor.
"""
import os
import sys
import uuid
import json
import time

import requests

BASE = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail}")


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def step_1_admin_login():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    ok = r.status_code == 200 and r.json().get("session_token")
    record("1) POST /api/auth/login (admin)", ok, f"status={r.status_code}, is_admin={r.json().get('is_admin')}")
    return r.json().get("session_token") if ok else None


def step_2_journal_status_admin(token):
    r = requests.get(f"{BASE}/journal/status", headers=_auth_headers(token))
    body = r.json() if r.headers.get("content-type","" ).startswith("application/json") else {}
    ok = (
        r.status_code == 200
        and body.get("is_premium") is True
        and body.get("unlimited") is True
    )
    record("2) GET /api/journal/status (admin)", ok, f"status={r.status_code}, body={body}")


def step_3_get_entries_admin(token):
    r = requests.get(f"{BASE}/journal/entries", headers=_auth_headers(token))
    body = r.json() if r.status_code == 200 else None
    ok = r.status_code == 200 and isinstance(body, list)
    record("3) GET /api/journal/entries (admin)", ok, f"status={r.status_code}, count={len(body) if isinstance(body,list) else 'N/A'}")


def step_4_save_entry(token):
    payload = {
        "title": "Smoke Test Entry",
        "content": "Testing journal refactor.",
        "category": "general",
        "mood": "reflective",
        "tags": ["smoke", "test"],
    }
    r = requests.post(f"{BASE}/journal/save", headers=_auth_headers(token), json=payload)
    body = r.json() if r.status_code == 200 else {}
    entry_id = body.get("id")
    ok = r.status_code == 200 and body.get("success") is True and entry_id
    record("4) POST /api/journal/save", ok, f"status={r.status_code}, id={entry_id}")
    return entry_id


def step_5_alias_entries(token):
    payload = {
        "title": "Alias Endpoint",
        "content": "Verify /journal/entries POST alias still works.",
        "category": "general",
        "mood": "curious",
        "tags": ["alias"],
    }
    r = requests.post(f"{BASE}/journal/entries", headers=_auth_headers(token), json=payload)
    body = r.json() if r.status_code == 200 else {}
    eid = body.get("id")
    ok = r.status_code == 200 and body.get("success") is True and eid
    record("5) POST /api/journal/entries (alias)", ok, f"status={r.status_code}, id={eid}")
    return eid


def step_6_delete(token, entry_id):
    r = requests.delete(f"{BASE}/journal/entries/{entry_id}", headers=_auth_headers(token))
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and body.get("success") is True
    record("6) DELETE /api/journal/entries/{id}", ok, f"status={r.status_code}, body={body}")


def step_7_save_no_auth():
    payload = {
        "title": "No auth",
        "content": "no auth test",
        "category": "general",
        "mood": "",
        "tags": [],
    }
    r = requests.post(f"{BASE}/journal/save", json=payload)
    ok = r.status_code in (401, 403, 500)
    record("7) POST /api/journal/save (no auth)", ok, f"status={r.status_code}, body={r.text[:200]}")


def step_8_free_user_limit():
    # Signup a brand new free user
    unique = uuid.uuid4().hex[:8]
    email = f"free.user.{unique}@example.com"
    password = "FreeUser!2026"
    name = f"Free User {unique}"
    r = requests.post(f"{BASE}/auth/signup", json={"email": email, "password": password, "name": name})
    if r.status_code != 200:
        record("8a) signup new free user", False, f"status={r.status_code}, body={r.text[:200]}")
        return None, None
    # signup does not return session_token; login afterwards
    lr = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    if lr.status_code != 200:
        record("8a) signup+login new free user", False, f"login_status={lr.status_code}, body={lr.text[:200]}")
        return None, None
    token = lr.json().get("session_token")
    record("8a) signup+login new free user", bool(token), f"email={email}, is_premium={lr.json().get('is_premium')}")

    # Save 5 entries OK
    for i in range(1, 6):
        payload = {
            "title": f"Entry {i}",
            "content": f"Free tier test entry #{i}",
            "category": "reflection",
            "mood": "calm",
            "tags": ["free", f"n{i}"],
        }
        rr = requests.post(f"{BASE}/journal/save", headers=_auth_headers(token), json=payload)
        ok = rr.status_code == 200 and rr.json().get("success") is True
        record(f"8b.{i}) save entry {i}/5 as free user", ok, f"status={rr.status_code}")
        if not ok:
            return email, token

    # 6th should be 403
    payload6 = {
        "title": "Entry 6 - should fail",
        "content": "This should be blocked",
        "category": "reflection",
        "mood": "testing",
        "tags": ["limit"],
    }
    r6 = requests.post(f"{BASE}/journal/save", headers=_auth_headers(token), json=payload6)
    body6 = {}
    try:
        body6 = r6.json()
    except Exception:
        pass
    detail = body6.get("detail", "")
    ok = r6.status_code == 403 and "Free" in str(detail) and "5" in str(detail)
    record("8c) 6th save returns 403 with Free users limit msg", ok, f"status={r6.status_code}, detail={detail}")

    return email, token


def step_9_free_user_status(token):
    if not token:
        record("9) free user status", False, "no token")
        return
    r = requests.get(f"{BASE}/journal/status", headers=_auth_headers(token))
    body = {}
    try:
        body = r.json()
    except Exception:
        pass
    ok = (
        r.status_code == 200
        and body.get("entries_remaining") == 0
        and body.get("entries_this_week") == 5
        and body.get("weekly_limit") == 5
        and body.get("is_premium") is False
        and body.get("unlimited") is False
    )
    record("9) GET /api/journal/status (free user after 6th)", ok, f"status={r.status_code}, body={body}")


def step_10_other_endpoints(admin_token):
    # 10a) /auth/me
    r = requests.get(f"{BASE}/auth/me", headers=_auth_headers(admin_token))
    body = {}
    try: body = r.json()
    except Exception: pass
    ok = r.status_code == 200 and body.get("email") == ADMIN_EMAIL
    record("10a) GET /api/auth/me", ok, f"status={r.status_code}, email={body.get('email')}")

    # 10b) /training/modules
    r = requests.get(f"{BASE}/training/modules")
    body = r.json() if r.status_code == 200 else None
    ok = r.status_code == 200 and isinstance(body, list) and len(body) > 0
    record("10b) GET /api/training/modules", ok, f"status={r.status_code}, count={len(body) if isinstance(body,list) else 'N/A'}")

    # 10c) /oracle/draw
    r = requests.post(f"{BASE}/oracle/draw", json={"num_cards": 1, "question": "Guidance?"})
    body = {}
    try: body = r.json()
    except Exception: pass
    ok = r.status_code == 200 and isinstance(body.get("cards"), list) and len(body["cards"]) >= 1
    record("10c) POST /api/oracle/draw", ok, f"status={r.status_code}, cards={len(body.get('cards',[])) if isinstance(body,dict) else 0}")

    # 10d) /admin/moderation/timeline
    r = requests.get(f"{BASE}/admin/moderation/timeline", headers=_auth_headers(admin_token))
    body = {}
    try: body = r.json()
    except Exception: pass
    ok = (
        r.status_code == 200
        and "active_suspensions" in body
        and "counts" in body
        and "constants" in body
    )
    record("10d) GET /api/admin/moderation/timeline (admin)", ok, f"status={r.status_code}, keys={list(body.keys()) if isinstance(body,dict) else 'N/A'}")


def main():
    admin_token = step_1_admin_login()
    if not admin_token:
        print("\n❌ Admin login failed; aborting.")
        sys.exit(1)

    step_2_journal_status_admin(admin_token)
    step_3_get_entries_admin(admin_token)
    entry4_id = step_4_save_entry(admin_token)
    entry5_id = step_5_alias_entries(admin_token)
    # Cleanup both
    if entry4_id:
        step_6_delete(admin_token, entry4_id)
    if entry5_id:
        # also delete alias entry but don't record as separate required step
        r = requests.delete(f"{BASE}/journal/entries/{entry5_id}", headers=_auth_headers(admin_token))
        print(f"(cleanup) delete alias entry status={r.status_code}")

    step_7_save_no_auth()
    _, free_tok = step_8_free_user_limit()
    step_9_free_user_status(free_tok)
    step_10_other_endpoints(admin_token)

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print("\n" + "=" * 60)
    print(f"RESULT: {passed}/{total} assertions passed")
    for name, ok, detail in results:
        if not ok:
            print(f"  - FAIL {name}: {detail}")
    print("=" * 60)


if __name__ == "__main__":
    main()
