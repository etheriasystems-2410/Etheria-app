#!/usr/bin/env python3
"""Focused test: verify cancelled user login behavior."""
import requests
import uuid
import json

BASE_URL = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASS = "$Tory2410"

s = requests.Session()

# Admin login
r = s.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
admin_token = r.json().get("session_token")
print(f"Admin token: {admin_token[:20]}...")

# Signup new test user
email = f"timeline-cancel+{uuid.uuid4().hex[:8]}@example.com"
password = "TestPass123!"
r = s.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": password, "name": "Cancel Login Test"}, timeout=30)
print(f"Signup {email}: {r.status_code}")
print(f"  body: {r.text[:300]}")

# Find user
r = s.get(f"{BASE_URL}/community/admin/all-users", params={"token": admin_token, "limit": 200}, timeout=30)
users = r.json().get("users", [])
target = next((u for u in users if (u.get("email") or "").lower() == email.lower()), None)
if not target:
    print(f"ERROR: cannot find new user")
    raise SystemExit(1)
user_id = target.get("id") or target.get("user_id")
print(f"User id: {user_id}")

# Verify login WORKS while active
r = s.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
print(f"\n[Before cancel] Login status={r.status_code}, success={'session_token' in r.text}")
print(f"  body: {r.text[:200]}")

# Issue 9 flags via warn action to get to cancellation
for i in range(9):
    fr = s.post(f"{BASE_URL}/community/admin/create-test-flag", params={"token": admin_token}, json={"user_id": user_id, "content_type": "test", "content": f"cancel-test-{i+1}", "reason": "test"}, timeout=30)
    flag_id = fr.json().get("flag_id")
    wr = s.post(f"{BASE_URL}/community/admin/flag/{flag_id}/action", params={"token": admin_token, "action": "warn"}, timeout=30)
    print(f"  warn {i+1}: {wr.json().get('message')}")
    # After warns 3 and 6, we need to simulate+process to escalate
    if i in [2, 5]:  # after 3rd and 6th warn -> suspended
        sr = s.post(f"{BASE_URL}/admin/moderation/simulate-timeline", headers={"Authorization": f"Bearer {admin_token}"}, json={"user_id": user_id}, timeout=30)
        pr = s.post(f"{BASE_URL}/admin/moderation/process-timeline", headers={"Authorization": f"Bearer {admin_token}"}, json={}, timeout=30)
        print(f"  simulate+process: reactivated_count={pr.json().get('reactivated_count')}")

# Check final state
r = s.get(f"{BASE_URL}/community/admin/all-users", params={"token": admin_token, "limit": 200}, timeout=30)
users = r.json().get("users", [])
target = next((u for u in users if (u.get("email") or "").lower() == email.lower()), None)
print(f"\nFinal account_status: {target.get('account_status') if target else 'NOT FOUND'}")

# Now attempt login - should fail per requirements
print(f"\n[After cancel] Attempt login with correct credentials:")
r = s.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
print(f"  status={r.status_code}")
print(f"  body: {r.text[:500]}")
if r.status_code == 200 and "session_token" in r.text:
    print("\n⚠️  ISSUE: Cancelled user successfully obtained a session_token!")
    print("   Per requirements, login should fail OR return account_status:cancelled flag.")
else:
    print("\n✅ Cancelled user login blocked")
