#!/usr/bin/env python3
"""Smoke test for Etheria backend after moderation/training refactor."""
import os
import sys
import json
import requests

BASE = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASS = "$Tory2410"

results = []

def record(name, ok, detail=""):
    status = "✅" if ok else "❌"
    print(f"{status} {name}: {detail}")
    results.append((name, ok, detail))

# 1. GET training modules
try:
    r = requests.get(f"{BASE}/training/modules", timeout=30)
    data = r.json()
    modules = data if isinstance(data, list) else data.get("modules", [])
    ok = r.status_code == 200 and isinstance(modules, list) and 9 <= len(modules) <= 15
    record("GET /training/modules", ok, f"status={r.status_code}, count={len(modules)}")
    first_module_id = modules[0]["id"] if modules else None
except Exception as e:
    record("GET /training/modules", False, str(e))
    first_module_id = None

# 2. GET lessons for first module
first_lesson_id = None
if first_module_id:
    try:
        r = requests.get(f"{BASE}/training/modules/{first_module_id}/lessons", timeout=30)
        data = r.json()
        lessons = data if isinstance(data, list) else data.get("lessons", [])
        ok = r.status_code == 200 and isinstance(lessons, list) and len(lessons) > 0
        record("GET /training/modules/{id}/lessons", ok, f"status={r.status_code}, count={len(lessons)}")
        if lessons:
            first_lesson_id = lessons[0].get("id") or lessons[0].get("lesson_id")
    except Exception as e:
        record("GET /training/modules/{id}/lessons", False, str(e))

# 3. GET single lesson
if first_module_id and first_lesson_id:
    try:
        r = requests.get(f"{BASE}/training/modules/{first_module_id}/lessons/{first_lesson_id}", timeout=30)
        data = r.json() if r.status_code == 200 else {}
        ok = r.status_code == 200 and ("id" in data or "title" in data or "content" in data)
        record("GET /training/modules/{id}/lessons/{lid}", ok, f"status={r.status_code}, keys={list(data.keys())[:5] if isinstance(data,dict) else 'N/A'}")
    except Exception as e:
        record("GET /training/modules/{id}/lessons/{lid}", False, str(e))

# 4. POST login
session_token = None
try:
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    data = r.json()
    session_token = data.get("session_token")
    ok = r.status_code == 200 and bool(session_token)
    record("POST /auth/login", ok, f"status={r.status_code}, has_token={bool(session_token)}, is_admin={data.get('user',{}).get('is_admin')}")
except Exception as e:
    record("POST /auth/login", False, str(e))

auth_headers = {"Authorization": f"Bearer {session_token}"} if session_token else {}

# 5. GET moderation-status
try:
    r = requests.get(f"{BASE}/admin/moderation-status", headers=auth_headers, timeout=30)
    data = r.json() if r.status_code == 200 else {}
    required = {"pending_flags", "suspended_users", "cancelled_users"}
    ok = r.status_code == 200 and required.issubset(data.keys())
    record("GET /admin/moderation-status", ok, f"status={r.status_code}, keys={list(data.keys()) if isinstance(data,dict) else 'N/A'}")
except Exception as e:
    record("GET /admin/moderation-status", False, str(e))

# 6. GET moderation timeline
try:
    r = requests.get(f"{BASE}/admin/moderation/timeline", headers=auth_headers, timeout=30)
    data = r.json() if r.status_code == 200 else {}
    required = {"active_suspensions", "expired_suspensions", "cancelled_accounts", "users_with_warnings", "counts", "constants"}
    ok = r.status_code == 200 and required.issubset(data.keys())
    missing = required - set(data.keys()) if isinstance(data, dict) else required
    record("GET /admin/moderation/timeline", ok, f"status={r.status_code}, missing={missing}")
except Exception as e:
    record("GET /admin/moderation/timeline", False, str(e))

# 7. POST process-timeline
try:
    r = requests.post(f"{BASE}/admin/moderation/process-timeline", headers=auth_headers, timeout=30)
    data = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and data.get("success") is True
    record("POST /admin/moderation/process-timeline", ok, f"status={r.status_code}, success={data.get('success')}, reactivated={data.get('reactivated_count')}")
except Exception as e:
    record("POST /admin/moderation/process-timeline", False, str(e))

# 8. POST process-moderation-emails
try:
    r = requests.post(f"{BASE}/admin/process-moderation-emails", headers=auth_headers, timeout=60)
    data = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and data.get("success") is True
    record("POST /admin/process-moderation-emails", ok, f"status={r.status_code}, success={data.get('success')}, details={data.get('details')}")
except Exception as e:
    record("POST /admin/process-moderation-emails", False, str(e))

# 9. POST oracle/draw
try:
    r = requests.post(f"{BASE}/oracle/draw", json={"num_cards": 1, "question": "smoke test"}, timeout=90)
    data = r.json() if r.status_code == 200 else {}
    cards = data.get("cards", [])
    ok = r.status_code == 200 and isinstance(cards, list) and len(cards) >= 1
    record("POST /oracle/draw", ok, f"status={r.status_code}, cards={len(cards)}")
except Exception as e:
    record("POST /oracle/draw", False, str(e))

# 10. GET subscription plans
try:
    r = requests.get(f"{BASE}/subscription/plans", timeout=30)
    data = r.json() if r.status_code == 200 else {}
    plans = data.get("plans", data) if isinstance(data, dict) else {}
    has_premium = "premium_monthly" in plans if isinstance(plans, dict) else False
    if not has_premium and isinstance(data, dict):
        has_premium = "premium_monthly" in data
    ok = r.status_code == 200 and has_premium
    record("GET /subscription/plans", ok, f"status={r.status_code}, keys={list(data.keys()) if isinstance(data,dict) else 'N/A'}")
except Exception as e:
    record("GET /subscription/plans", False, str(e))

# 11. GET community admin all-users
test_user_id = None
try:
    r = requests.get(f"{BASE}/community/admin/all-users", params={"token": session_token}, timeout=30)
    data = r.json() if r.status_code == 200 else {}
    users = data.get("users", []) if isinstance(data, dict) else []
    ok = r.status_code == 200 and isinstance(users, list) and len(users) > 0
    record("GET /community/admin/all-users", ok, f"status={r.status_code}, count={len(users)}")
    # Pick a non-admin user for test flag
    for u in users:
        if not u.get("is_admin") and u.get("account_status") != "cancelled":
            test_user_id = u.get("id") or u.get("user_id")
            test_user_email = u.get("email")
            if test_user_id:
                break
except Exception as e:
    record("GET /community/admin/all-users", False, str(e))

# 12. POST create-test-flag
if test_user_id:
    try:
        r = requests.post(
            f"{BASE}/community/admin/create-test-flag",
            params={"token": session_token},
            json={"user_id": test_user_id},
            timeout=30,
        )
        data = r.json() if r.status_code == 200 else {}
        ok = r.status_code == 200 and (data.get("success") or data.get("flag_id") or "flag" in str(data).lower())
        record("POST /community/admin/create-test-flag", ok, f"status={r.status_code}, resp={str(data)[:200]}")
    except Exception as e:
        record("POST /community/admin/create-test-flag", False, str(e))
else:
    record("POST /community/admin/create-test-flag", False, "no non-admin user found")

# Summary
print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
print(f"SUMMARY: {passed}/{len(results)} passed")
for name, ok, detail in results:
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}")

sys.exit(0 if passed == len(results) else 1)
