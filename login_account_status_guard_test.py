#!/usr/bin/env python3
"""
End-to-end test for the new account-status guard on POST /api/auth/login.

Verifies:
  1. Admin login still works.
  2. Wrong password returns 401 (precedence: password check BEFORE status check).
  3. Cancelled user is blocked with 403 containing "cancelled".
  4. Suspended user (active suspension window) is blocked with 403 containing
     "suspended until <iso>".
  5. Suspended user whose suspension_end is in the past CAN still log in
     (graceful fallback for paying users while the hourly job is slow).

Base URL: https://etheria-divination.preview.emergentagent.com/api
"""

import json
import sys
import uuid
import time
from typing import Optional, Tuple

import requests

BASE = "https://etheria-divination.preview.emergentagent.com/api"

ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

# Already-cancelled users from earlier test runs (per review request)
KNOWN_CANCELLED_EMAILS = [
    "free.dm.4b751978@example.com",
    "timeline-cancel+21f03a20@example.com",
]
CANCELLED_DEFAULT_PASSWORD = "TestPass123!"


def _snip(text: str, limit: int = 200) -> str:
    text = text or ""
    return text[:limit].replace("\n", " ")


def _post(path: str, **kw):
    return requests.post(f"{BASE}{path}", timeout=30, **kw)


def _get(path: str, **kw):
    return requests.get(f"{BASE}{path}", timeout=30, **kw)


passes = []
fails = []


def record(step: str, ok: bool, status: int, body: str, detail: str = ""):
    line = f"[{step}] {'PASS' if ok else 'FAIL'} (HTTP {status}) body={_snip(body)} {detail}"
    print(line)
    (passes if ok else fails).append(line)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def admin_login() -> Tuple[str, dict]:
    r = _post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    body = r.text
    try:
        data = r.json()
    except Exception:
        data = {}
    ok = r.status_code == 200 and bool(data.get("session_token")) and data.get("is_admin") is True
    record("Step 1: Admin login (sanity)", ok, r.status_code, body)
    if not ok:
        raise SystemExit("Admin login failed — cannot continue")
    return data["session_token"], data


def signup(email: str, password: str, name: str) -> Tuple[Optional[str], Optional[str], dict]:
    r = _post("/auth/signup", json={"email": email, "password": password, "name": name})
    try:
        data = r.json()
    except Exception:
        data = {}
    return (
        data.get("session_token") or data.get("user_id"),  # signup uses cookie; session_token may not be in body
        data.get("user_id"),
        {"status": r.status_code, "body": r.text, "data": data, "cookies": dict(r.cookies)},
    )


def find_user_id_by_email(admin_token: str, email: str) -> Optional[str]:
    """Find the Mongo ObjectId-string for a given email via /community/admin/all-users."""
    r = _get(f"/community/admin/all-users", params={"token": admin_token, "limit": 500})
    if r.status_code != 200:
        return None
    for u in r.json().get("users", []):
        if u.get("email", "").lower() == email.lower():
            return u.get("id")
    return None


def get_account_status(admin_token: str, email: str) -> Optional[dict]:
    r = _get(f"/community/admin/all-users", params={"token": admin_token, "limit": 500})
    if r.status_code != 200:
        return None
    for u in r.json().get("users", []):
        if u.get("email", "").lower() == email.lower():
            return u
    return None


def admin_cancel(admin_token: str, mongo_user_id: str) -> requests.Response:
    return _post(
        f"/community/admin/user/{mongo_user_id}/action",
        params={"token": admin_token, "action": "cancel"},
    )


def admin_clear_flags(admin_token: str, mongo_user_id: str) -> requests.Response:
    return _post(
        f"/community/admin/user/{mongo_user_id}/action",
        params={"token": admin_token, "action": "clear_flags"},
    )


def create_test_flag_and_warn(admin_token: str, target_user_id: str, target_email: str) -> Tuple[bool, str]:
    """Issue 1 warn (which advances flag_count by 1, or triggers suspension/cancel at thresholds)."""
    # 1) create test flag
    rf = _post(
        "/community/admin/create-test-flag",
        params={"token": admin_token},
        json={"user_id": target_user_id, "user_email": target_email, "reason": "Suspension test (auto)"},
    )
    if rf.status_code != 200:
        return False, f"create-test-flag failed: {rf.status_code} {_snip(rf.text)}"
    flag_id = (rf.json() or {}).get("flag_id") or (rf.json() or {}).get("id")
    if not flag_id:
        return False, f"no flag_id in response: {_snip(rf.text)}"
    # 2) action=warn
    ra = _post(
        f"/community/admin/flag/{flag_id}/action",
        params={"token": admin_token, "action": "warn"},
    )
    if ra.status_code != 200:
        return False, f"flag-action warn failed: {ra.status_code} {_snip(ra.text)}"
    return True, ra.text


def simulate_timeline(admin_token: str, mongo_user_id: str) -> requests.Response:
    return _post(
        "/admin/moderation/simulate-timeline",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"user_id": mongo_user_id},
    )


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

# Step 1
admin_token, admin_payload = admin_login()


# Step 2 — Wrong password returns 401 (precedence). Use a known-cancelled user
# (or any account) — purpose is to ensure password check fires first.
test_email_for_step2 = KNOWN_CANCELLED_EMAILS[0]
r2 = _post("/auth/login", json={"email": test_email_for_step2, "password": "totally-wrong-password-xyz"})
try:
    d2 = r2.json()
except Exception:
    d2 = {}
ok2 = r2.status_code == 401 and "invalid" in str(d2.get("detail", "")).lower()
record("Step 2: Wrong password precedence -> 401", ok2, r2.status_code, r2.text,
       detail=f"(target={test_email_for_step2}, used wrong password; expected 401 'Invalid email or password')")


# Step 3 — Cancelled user is blocked with 403 "cancelled".
# Try the known cancelled users with the default test password first; if none
# work, create a fresh signup, cancel via admin, and test.
step3_passed = False
for email in KNOWN_CANCELLED_EMAILS:
    rp = _post("/auth/login", json={"email": email, "password": CANCELLED_DEFAULT_PASSWORD})
    try:
        dp = rp.json()
    except Exception:
        dp = {}
    detail_msg = str(dp.get("detail", "")).lower()
    if rp.status_code == 403 and "cancelled" in detail_msg:
        record(f"Step 3a: Known cancelled user {email} -> 403 'cancelled'",
               True, rp.status_code, rp.text,
               detail="Verified default password worked AND status guard fires.")
        # Also confirm no session_token in response
        if "session_token" in (dp or {}):
            fails.append(f"[Step 3a] LEAK: session_token present in 403 response for {email}")
        step3_passed = True
        break
    elif rp.status_code == 401:
        print(f"[Step 3a] Known cancelled user {email} returned 401 (wrong password assumption); trying next…")
    else:
        print(f"[Step 3a] Unexpected response for {email}: {rp.status_code} {_snip(rp.text)}")

if not step3_passed:
    # Fallback: create a fresh signup, cancel them, then try login.
    fresh_email = f"login-block-test+{uuid.uuid4().hex[:8]}@example.com"
    fresh_password = "TestPass123!"
    fresh_name = "Login Block Test"
    print(f"[Step 3b] Creating fresh signup {fresh_email} / {fresh_password}")
    _, fresh_user_id, signup_meta = signup(fresh_email, fresh_password, fresh_name)
    if signup_meta["status"] != 200:
        record("Step 3b: signup new user", False, signup_meta["status"], signup_meta["body"])
    else:
        # Look up the Mongo ObjectId-string for this email
        mongo_id = find_user_id_by_email(admin_token, fresh_email)
        if not mongo_id:
            record("Step 3b: find mongo_id of new signup", False, 0, "Could not locate user via /community/admin/all-users")
        else:
            cancel_resp = admin_cancel(admin_token, mongo_id)
            if cancel_resp.status_code != 200:
                record("Step 3b: admin cancel new user", False, cancel_resp.status_code, cancel_resp.text)
            else:
                # Now login should be blocked
                rp2 = _post("/auth/login", json={"email": fresh_email, "password": fresh_password})
                try:
                    dp2 = rp2.json()
                except Exception:
                    dp2 = {}
                detail_msg2 = str(dp2.get("detail", "")).lower()
                token_leaked = "session_token" in (dp2 or {})
                ok3 = rp2.status_code == 403 and "cancelled" in detail_msg2 and not token_leaked
                record(f"Step 3b: Cancelled user {fresh_email} -> 403 'cancelled'",
                       ok3, rp2.status_code, rp2.text,
                       detail=f"(no session_token leaked: {not token_leaked})")
                step3_passed = ok3

                # Save the fresh credentials
                try:
                    with open("/app/memory/test_credentials.md", "a", encoding="utf-8") as f:
                        f.write(f"\n## Login Block Test (cancelled-user E2E)\n"
                                f"- Email: {fresh_email}\n"
                                f"- Password: {fresh_password}\n"
                                f"- Status: CANCELLED (created during account-status-guard test)\n")
                except Exception as e:
                    print(f"[Step 3b] Could not append to test_credentials.md: {e}")


# Step 4 — Suspended user with active suspension is blocked with 403 "suspended until".
# Create a fresh signup and run 3 warns to push them into the suspension state.
susp_email = f"login-suspend-test+{uuid.uuid4().hex[:8]}@example.com"
susp_password = "TestPass123!"
susp_name = "Login Suspend Test"
print(f"[Step 4] Creating fresh signup {susp_email} / {susp_password}")
_, susp_user_id, susp_signup_meta = signup(susp_email, susp_password, susp_name)
susp_mongo_id = None
if susp_signup_meta["status"] != 200:
    record("Step 4: signup suspension test user", False, susp_signup_meta["status"], susp_signup_meta["body"])
else:
    susp_mongo_id = find_user_id_by_email(admin_token, susp_email)
    if not susp_mongo_id:
        record("Step 4: find mongo_id of suspension test user", False, 0, "Could not locate user")
    else:
        # Make sure flag_count starts at 0
        admin_clear_flags(admin_token, susp_mongo_id)
        # 3 warns
        warn_ok = True
        for i in range(3):
            ok, msg = create_test_flag_and_warn(admin_token, susp_mongo_id, susp_email)
            print(f"[Step 4] warn #{i+1}: ok={ok} msg={_snip(msg)}")
            if not ok:
                warn_ok = False
                break
            time.sleep(0.4)
        if not warn_ok:
            record("Step 4: issue 3 warns to suspend user", False, 0, "warn pipeline failed")
        else:
            # Verify user is suspended
            user_row = get_account_status(admin_token, susp_email)
            if not user_row or user_row.get("account_status") != "suspended":
                record("Step 4: user account_status==suspended after 3 warns",
                       False, 0, json.dumps(user_row))
            else:
                # Attempt login
                r4 = _post("/auth/login", json={"email": susp_email, "password": susp_password})
                try:
                    d4 = r4.json()
                except Exception:
                    d4 = {}
                detail_msg4 = str(d4.get("detail", "")).lower()
                token_leaked4 = "session_token" in (d4 or {})
                ok4 = (
                    r4.status_code == 403
                    and "suspended until" in detail_msg4
                    and not token_leaked4
                )
                record(f"Step 4: Suspended user {susp_email} -> 403 'suspended until'",
                       ok4, r4.status_code, r4.text,
                       detail=f"(no session_token leaked: {not token_leaked4})")

                # Save credentials
                try:
                    with open("/app/memory/test_credentials.md", "a", encoding="utf-8") as f:
                        f.write(f"\n## Login Block Test (suspended-user E2E)\n"
                                f"- Email: {susp_email}\n"
                                f"- Password: {susp_password}\n"
                                f"- Status: SUSPENDED (14-day window, created during account-status-guard test)\n")
                except Exception as e:
                    print(f"[Step 4] Could not append to test_credentials.md: {e}")


# Step 5 — Suspended user with EXPIRED suspension can still log in.
# Take the same user as Step 4 → simulate-timeline → DO NOT process-timeline → attempt login.
if susp_mongo_id:
    sim = simulate_timeline(admin_token, susp_mongo_id)
    if sim.status_code != 200:
        record("Step 5: simulate-timeline (fast-forward suspension_end)",
               False, sim.status_code, sim.text)
    else:
        # Confirm status is still "suspended" in DB but suspension_end is in past
        user_row5 = get_account_status(admin_token, susp_email)
        still_suspended = user_row5 and user_row5.get("account_status") == "suspended"
        print(f"[Step 5] After simulate: account_status={user_row5.get('account_status') if user_row5 else None} (expected still 'suspended')")
        # Try login — expect 200 + session_token
        r5 = _post("/auth/login", json={"email": susp_email, "password": susp_password})
        try:
            d5 = r5.json()
        except Exception:
            d5 = {}
        ok5 = (
            r5.status_code == 200
            and (bool(d5.get("session_token")) or "session_token" in dict(r5.cookies))
        )
        record(
            f"Step 5: Expired-suspension user {susp_email} can login -> 200",
            ok5, r5.status_code, r5.text,
            detail=f"(account_status still 'suspended' in DB: {still_suspended}, cookies set: {list(r5.cookies.keys())})",
        )
else:
    record("Step 5: requires Step 4 user", False, 0, "Step 4 did not create a suspended user")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print(f"PASSED: {len(passes)}")
print(f"FAILED: {len(fails)}")
print("=" * 70)
for f in fails:
    print("  ✗ " + f)
sys.exit(0 if not fails else 1)
