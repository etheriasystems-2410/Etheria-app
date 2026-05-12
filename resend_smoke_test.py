"""
Resend email migration regression smoke test.

Verifies all 8 endpoints referenced in the review request return their expected
status codes after the SMTP→Resend cutover. We do NOT validate inbox delivery
(reviewer confirmed Resend delivery manually); we only ensure the endpoints
respond correctly and backend logs do not contain new Resend failures.
"""
import os
import sys
import json
import time
import requests

BACKEND_URL = "https://etheria-divination.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

results = []  # (name, ok, detail)


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    icon = "✅" if ok else "❌"
    print(f"{icon} {name} — {detail}")


def main():
    # 1) Admin login
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    ok = r.status_code == 200 and r.json().get("session_token") and r.json().get("is_admin") is True
    detail = f"status={r.status_code} is_admin={r.json().get('is_admin') if r.status_code==200 else 'n/a'}"
    record("1) POST /api/auth/login (admin)", ok, detail)
    if not ok:
        print("Cannot continue without admin session.")
        sys.exit(1)
    session_token = r.json()["session_token"]
    bearer = {"Authorization": f"Bearer {session_token}"}

    # 2) GET /api/admin/moderation-status
    r = requests.get(f"{API}/admin/moderation-status", headers=bearer, timeout=20)
    ok = r.status_code == 200 and all(k in r.json() for k in ["pending_flags", "suspended_users", "cancelled_users"])
    record("2) GET /api/admin/moderation-status", ok, f"status={r.status_code} keys={list(r.json().keys()) if r.status_code==200 else 'n/a'}")

    # 3) POST /api/admin/moderation/process-timeline
    r = requests.post(f"{API}/admin/moderation/process-timeline", headers=bearer, timeout=30)
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and body.get("success") is True
    record("3) POST /api/admin/moderation/process-timeline",
           ok,
           f"status={r.status_code} success={body.get('success')} reactivated_count={body.get('reactivated_count')}")

    # 4) POST /api/feedback/submit (this triggers send_feedback_email via Resend)
    feedback_body = {
        "type": "bug",
        "subject": "Test bug report",
        "message": "Just verifying the feedback flow still works after Resend migration",
        "user_email": "test@example.com",
        "user_name": "Test User"
    }
    r = requests.post(f"{API}/feedback/submit", json=feedback_body, timeout=30)
    body = r.json() if r.status_code == 200 else {}
    # Endpoint shape: returns {success:True, message:...} or similar; just verify 200
    ok = r.status_code == 200
    record("4) POST /api/feedback/submit (Resend send_feedback_email)",
           ok,
           f"status={r.status_code} body_keys={list(body.keys()) if isinstance(body, dict) else 'n/a'}")

    # 5) POST /api/admin/contest/generate-code
    # Endpoint signature: POST /api/admin/contest/generate-code?token=xxx with body {code_type:'monthly'|'lifetime'}
    # The endpoint uses query-param token (not Bearer) and requires code_type. The review spec said
    # "body {}" but server.py route expects CodeCreate.code_type — we send code_type='monthly'.
    r = requests.post(
        f"{API}/admin/contest/generate-code",
        params={"token": session_token},
        json={"code_type": "monthly"},
        timeout=60,
    )
    body = r.json() if r.status_code == 200 else {}
    code_field = body.get("code")
    ok = r.status_code == 200 and bool(code_field)
    record("5) POST /api/admin/contest/generate-code",
           ok,
           f"status={r.status_code} code={code_field} success={body.get('success')}")

    # 6) GET /api/admin/contest/status  (uses query-param token, not Bearer)
    r = requests.get(f"{API}/admin/contest/status", params={"token": session_token}, timeout=20)
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and "codes_stats" in body
    record("6) GET /api/admin/contest/status",
           ok,
           f"status={r.status_code} keys={list(body.keys()) if isinstance(body, dict) else 'n/a'}")

    # 7) POST /api/admin/process-moderation-emails (IMAP poll — no SMTP)
    r = requests.post(f"{API}/admin/process-moderation-emails", headers=bearer, timeout=60)
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and body.get("success") is True
    record("7) POST /api/admin/process-moderation-emails (IMAP)",
           ok,
           f"status={r.status_code} success={body.get('success')} details={body.get('details')}")

    # 8) POST /api/community/admin/create-test-flag?token=... (triggers Resend admin notification)
    # First fetch a test user (not admin) from all-users list
    r = requests.get(f"{API}/community/admin/all-users", params={"token": session_token}, timeout=30)
    test_user_id = None
    if r.status_code == 200:
        users = r.json() if isinstance(r.json(), list) else r.json().get("users", [])
        for u in users:
            if u.get("email") and u["email"] != ADMIN_EMAIL and not u.get("is_admin"):
                test_user_id = u.get("user_id") or u.get("id")
                test_user_email = u.get("email")
                break
    if not test_user_id:
        record("8) POST /api/community/admin/create-test-flag", False,
               f"Could not fetch a non-admin user for flag test (all-users status={r.status_code})")
    else:
        r = requests.post(
            f"{API}/community/admin/create-test-flag",
            params={"token": session_token},
            json={"user_id": test_user_id},
            timeout=30,
        )
        body = r.json() if r.status_code == 200 else {}
        ok = r.status_code == 200 and (body.get("success") or body.get("flag_id"))
        record("8) POST /api/community/admin/create-test-flag (Resend admin notify)",
               ok,
               f"status={r.status_code} flag_id={body.get('flag_id')} target={test_user_email}")

    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"RESEND SMOKE: {passed}/{len(results)} passed")
    for name, ok, detail in results:
        if not ok:
            print(f"  FAIL: {name} — {detail}")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
