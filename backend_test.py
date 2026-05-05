"""
Backend test for Automated Moderation Timeline (Etheria App)
Tests:
 1. GET /api/admin/moderation/timeline (auth + 401/403)
 2. POST /api/admin/moderation/process-timeline
 3. POST /api/admin/moderation/simulate-timeline (validation)
 4. Full integration flow: warns -> suspended (14d) -> simulate+process -> reactivated
                          -> warns -> suspended (30d) -> simulate+process -> reactivated
                          -> warns -> cancelled
 5. Pre-existing endpoints still work:
    - GET /api/admin/moderation-status
    - POST /api/admin/process-moderation-emails
"""

import os
import sys
import time
import json
import requests
from typing import Any, Dict, Optional

BACKEND_URL = "https://etheria-divination.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

# ---------- helpers ----------

results = []

def record(name: str, ok: bool, detail: str = ""):
    icon = "PASS" if ok else "FAIL"
    print(f"[{icon}] {name} - {detail}")
    results.append({"name": name, "ok": ok, "detail": detail})


def admin_login() -> str:
    r = requests.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("session_token") or data.get("token")
    if not token:
        raise RuntimeError(f"No session_token in login response: {data}")
    is_admin = data.get("user", {}).get("is_admin") if isinstance(data.get("user"), dict) else data.get("is_admin")
    print(f"[admin_login] token=...{token[-8:]} is_admin={is_admin}")
    return token


def auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_timeline(token: str) -> Dict[str, Any]:
    r = requests.get(f"{API}/admin/moderation/timeline", headers=auth_headers(token), timeout=30)
    r.raise_for_status()
    return r.json()


def process_timeline(token: str) -> requests.Response:
    return requests.post(f"{API}/admin/moderation/process-timeline", headers=auth_headers(token), timeout=30)


def simulate_timeline(token: str, user_id: str) -> requests.Response:
    return requests.post(
        f"{API}/admin/moderation/simulate-timeline",
        headers=auth_headers(token),
        json={"user_id": user_id},
        timeout=30,
    )


def get_all_users(token: str) -> list:
    r = requests.get(f"{API}/community/admin/all-users",
                     params={"token": token, "limit": 200},
                     timeout=30)
    r.raise_for_status()
    return r.json().get("users", [])


def create_test_flag(token: str, user_mongo_id: str) -> Dict[str, Any]:
    r = requests.post(
        f"{API}/community/admin/create-test-flag",
        params={"token": token},
        json={
            "user_id": user_mongo_id,
            "content_type": "test",
            "content": "Automated timeline test flag",
            "reason": "Automated moderation timeline test"
        },
        timeout=60,
    )
    if r.status_code != 200:
        raise RuntimeError(f"create-test-flag failed: {r.status_code} {r.text}")
    return r.json()


def take_action(token: str, flag_id: str, action: str) -> requests.Response:
    return requests.post(
        f"{API}/community/admin/flag/{flag_id}/action",
        params={"token": token, "action": action},
        timeout=60,
    )


def find_user_in_timeline(timeline: Dict[str, Any], section: str, user_id: str) -> Optional[Dict[str, Any]]:
    for u in timeline.get(section, []):
        if u.get("user_id") == user_id:
            return u
    return None


def find_user_by_id(users: list, mongo_id: str) -> Optional[Dict[str, Any]]:
    for u in users:
        if u.get("id") == mongo_id:
            return u
    return None


# ---------- Tests ----------

def test_auth_negative(token: str):
    # 401 without token
    r = requests.get(f"{API}/admin/moderation/timeline", timeout=20)
    record("timeline_401_no_token", r.status_code == 401, f"status={r.status_code}")

    # 401 invalid token
    r = requests.get(f"{API}/admin/moderation/timeline",
                     headers={"Authorization": "Bearer invalid_token_xxx"}, timeout=20)
    record("timeline_401_invalid_token", r.status_code == 401, f"status={r.status_code}")

    # 403 non-admin
    import uuid as _uuid
    email = f"timeline_test_{_uuid.uuid4().hex[:8]}@etheria.test"
    pwd = "Test1234!"
    rs = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": pwd, "name": "Timeline Tester"
    }, timeout=30)
    if rs.status_code in (200, 201):
        rs_data = rs.json()
        non_admin_token = rs_data.get("session_token") or rs_data.get("token")
        if non_admin_token:
            r = requests.get(f"{API}/admin/moderation/timeline",
                             headers={"Authorization": f"Bearer {non_admin_token}"}, timeout=20)
            record("timeline_403_non_admin", r.status_code == 403,
                   f"status={r.status_code} body={r.text[:120]}")
        else:
            record("timeline_403_non_admin", False, f"signup ok but no token: {rs.text[:120]}")
    else:
        record("timeline_403_non_admin", False,
               f"could not create non-admin user: {rs.status_code} {rs.text[:120]}")


def test_timeline_shape(token: str):
    timeline = get_timeline(token)
    expected_keys = {"now", "constants", "active_suspensions", "expired_suspensions",
                     "cancelled_accounts", "users_with_warnings", "counts"}
    missing = expected_keys - set(timeline.keys())
    record("timeline_top_level_keys", not missing,
           f"missing={list(missing)}, keys={list(timeline.keys())}")

    constants = timeline.get("constants", {})
    expected_const_keys = {"flags_before_suspension", "first_suspension_days", "second_suspension_days"}
    missing_c = expected_const_keys - set(constants.keys())
    record("timeline_constants_keys", not missing_c,
           f"missing={list(missing_c)}, constants={constants}")

    if not missing_c:
        ok = (constants.get("flags_before_suspension") == 3
              and constants.get("first_suspension_days") == 14
              and constants.get("second_suspension_days") == 30)
        record("timeline_constants_values", ok, f"constants={constants}")

    counts = timeline.get("counts", {})
    expected_count_keys = {"active_suspensions", "expired_suspensions",
                           "cancelled_accounts", "users_with_warnings"}
    missing_co = expected_count_keys - set(counts.keys())
    record("timeline_counts_keys", not missing_co,
           f"missing={list(missing_co)}, counts={counts}")

    for k in ("active_suspensions", "expired_suspensions", "cancelled_accounts", "users_with_warnings"):
        record(f"timeline_{k}_is_list", isinstance(timeline.get(k), list),
               f"type={type(timeline.get(k)).__name__}")

    return timeline


def test_process_timeline_no_expired(token: str):
    r = process_timeline(token)
    if r.status_code != 200:
        record("process_timeline_initial", False, f"status={r.status_code} body={r.text[:200]}")
        return None
    data = r.json()
    ok = data.get("success") is True and "scanned_at" in data and "reactivated_count" in data
    record("process_timeline_initial", ok,
           f"reactivated_count={data.get('reactivated_count')} keys={list(data.keys())}")
    return data


def test_simulate_validation(token: str):
    users = get_all_users(token)
    admin_user = next((u for u in users if u.get("email") == ADMIN_EMAIL), None)
    if not admin_user:
        record("simulate_validation_400_active", False, "admin not found in user list")
    else:
        r = simulate_timeline(token, admin_user["id"])
        record("simulate_validation_400_active", r.status_code == 400,
               f"status={r.status_code} body={r.text[:200]}")

    r = requests.post(f"{API}/admin/moderation/simulate-timeline",
                      headers=auth_headers(token), json={}, timeout=20)
    record("simulate_validation_400_missing", r.status_code == 400,
           f"status={r.status_code}")


def pick_test_user(users: list) -> Optional[Dict[str, Any]]:
    """Pick a non-admin, non-cancelled, active user for the integration flow."""
    for u in users:
        if u.get("is_admin"):
            continue
        if u.get("email") == ADMIN_EMAIL:
            continue
        if u.get("account_status") == "cancelled":
            continue
        if u.get("account_status") == "active":
            return u
    for u in users:
        if u.get("is_admin") or u.get("email") == ADMIN_EMAIL:
            continue
        if u.get("account_status") != "cancelled":
            return u
    return None


def warn_three_times(token: str, user_mongo_id: str, label: str) -> bool:
    flag_ids = []
    for i in range(3):
        flag_resp = create_test_flag(token, user_mongo_id)
        flag_id = flag_resp.get("flag_id")
        if not flag_id:
            record(f"{label}_create_flag_{i+1}", False, f"resp={flag_resp}")
            return False
        flag_ids.append(flag_id)
        r = take_action(token, flag_id, "warn")
        if r.status_code != 200:
            record(f"{label}_warn_{i+1}", False,
                   f"flag_id={flag_id} status={r.status_code} body={r.text[:300]}")
            return False
        try:
            body = r.json()
        except Exception:
            body = {}
        record(f"{label}_warn_{i+1}", body.get("success") is True,
               f"flag_id={flag_id} message={body.get('message')}")
    print(f"[{label}] flag_ids issued: {flag_ids}")
    return True


def get_user_state(token: str, user_mongo_id: str) -> Optional[Dict[str, Any]]:
    users = get_all_users(token)
    return find_user_by_id(users, user_mongo_id)


def test_full_integration(token: str):
    print("\n========= FULL TIMELINE INTEGRATION =========\n")
    users = get_all_users(token)
    print(f"Total users: {len(users)}")
    target = pick_test_user(users)
    if not target:
        record("integration_pick_user", False, "No suitable test user found")
        return

    user_mongo_id = target["id"]
    user_email = target["email"]
    print(f"[integration] target user: {user_email} ({user_mongo_id}) "
          f"status={target['account_status']} flags={target.get('flag_count')}")
    record("integration_pick_user", True,
           f"user={user_email} id={user_mongo_id} status={target['account_status']}")

    if target["account_status"] == "suspended":
        sr = simulate_timeline(token, user_mongo_id)
        print(f"[pre-cleanup] simulate -> {sr.status_code} {sr.text[:120]}")
        pr = process_timeline(token)
        print(f"[pre-cleanup] process -> {pr.status_code} {pr.text[:200]}")
        time.sleep(1)
        target = get_user_state(token, user_mongo_id)

    # ---- Phase 1 ----
    print("\n--- Phase 1: 3 warns -> first suspension (14d) ---")
    if not warn_three_times(token, user_mongo_id, "phase1"):
        return

    state = get_user_state(token, user_mongo_id)
    print(f"[phase1] post-3-warns: status={state['account_status']} flags={state.get('flag_count')}")
    record("phase1_user_suspended",
           state["account_status"] == "suspended",
           f"status={state['account_status']} flags={state.get('flag_count')}")

    timeline = get_timeline(token)
    susp_entry = find_user_in_timeline(timeline, "active_suspensions", user_mongo_id)
    if susp_entry:
        days = susp_entry.get("days_remaining")
        susp_count = susp_entry.get("suspension_count")
        print(f"[phase1] timeline entry: days_remaining={days} susp_count={susp_count} "
              f"end={susp_entry.get('suspension_end')}")
        record("phase1_in_active_suspensions", True,
               f"days_remaining={days} susp_count={susp_count}")
        record("phase1_days_remaining_13_14", days in (13, 14),
               f"days_remaining={days}")
        record("phase1_suspension_count_1", susp_count == 1, f"susp_count={susp_count}")
    else:
        record("phase1_in_active_suspensions", False,
               f"user not found in active_suspensions; counts={timeline.get('counts')}")

    sr = simulate_timeline(token, user_mongo_id)
    record("phase1_simulate", sr.status_code == 200, f"status={sr.status_code} body={sr.text[:200]}")

    timeline = get_timeline(token)
    exp_entry = find_user_in_timeline(timeline, "expired_suspensions", user_mongo_id)
    record("phase1_in_expired_suspensions", exp_entry is not None,
           f"counts={timeline.get('counts')}")

    pr = process_timeline(token)
    if pr.status_code == 200:
        pdata = pr.json()
        print(f"[phase1] process-timeline -> reactivated_count={pdata.get('reactivated_count')}")
        record("phase1_process_timeline", pdata.get("reactivated_count", 0) >= 1,
               f"reactivated_count={pdata.get('reactivated_count')}")
    else:
        record("phase1_process_timeline", False, f"status={pr.status_code} body={pr.text[:200]}")

    state = get_user_state(token, user_mongo_id)
    print(f"[phase1] post-reactivation: status={state['account_status']} flags={state.get('flag_count')}")
    record("phase1_reactivated_active", state["account_status"] == "active",
           f"status={state['account_status']}")
    record("phase1_reactivated_flags_zero", state.get("flag_count", 0) == 0,
           f"flag_count={state.get('flag_count')}")

    # ---- Phase 2 ----
    print("\n--- Phase 2: 3 warns -> second suspension (30d) ---")
    if not warn_three_times(token, user_mongo_id, "phase2"):
        return

    state = get_user_state(token, user_mongo_id)
    print(f"[phase2] post-3-warns: status={state['account_status']} flags={state.get('flag_count')}")
    record("phase2_user_suspended",
           state["account_status"] == "suspended",
           f"status={state['account_status']}")

    timeline = get_timeline(token)
    susp_entry = find_user_in_timeline(timeline, "active_suspensions", user_mongo_id)
    if susp_entry:
        days = susp_entry.get("days_remaining")
        susp_count = susp_entry.get("suspension_count")
        print(f"[phase2] timeline entry: days_remaining={days} susp_count={susp_count}")
        record("phase2_in_active_suspensions", True,
               f"days_remaining={days} susp_count={susp_count}")
        record("phase2_days_remaining_29_30", days in (29, 30), f"days_remaining={days}")
        record("phase2_suspension_count_2", susp_count == 2, f"susp_count={susp_count}")
    else:
        record("phase2_in_active_suspensions", False,
               f"user not in active_suspensions; counts={timeline.get('counts')}")

    sr = simulate_timeline(token, user_mongo_id)
    record("phase2_simulate", sr.status_code == 200, f"status={sr.status_code}")

    pr = process_timeline(token)
    if pr.status_code == 200:
        pdata = pr.json()
        record("phase2_process_timeline", pdata.get("reactivated_count", 0) >= 1,
               f"reactivated_count={pdata.get('reactivated_count')}")
    else:
        record("phase2_process_timeline", False, f"status={pr.status_code} body={pr.text[:200]}")

    state = get_user_state(token, user_mongo_id)
    print(f"[phase2] post-reactivation: status={state['account_status']} flags={state.get('flag_count')}")
    record("phase2_reactivated_active", state["account_status"] == "active",
           f"status={state['account_status']}")

    # ---- Phase 3 ----
    print("\n--- Phase 3: 3 warns -> account cancellation ---")
    if not warn_three_times(token, user_mongo_id, "phase3"):
        return

    state = get_user_state(token, user_mongo_id)
    print(f"[phase3] post-3-warns: status={state['account_status']} flags={state.get('flag_count')}")
    record("phase3_user_cancelled", state["account_status"] == "cancelled",
           f"status={state['account_status']}")

    timeline = get_timeline(token)
    cancel_entry = find_user_in_timeline(timeline, "cancelled_accounts", user_mongo_id)
    record("phase3_in_cancelled_accounts", cancel_entry is not None,
           f"counts={timeline.get('counts')}")
    if cancel_entry:
        print(f"[phase3] cancel entry: {cancel_entry}")


def test_preexisting_endpoints(token: str):
    print("\n--- Pre-existing endpoints sanity ---")
    r = requests.get(f"{API}/admin/moderation-status", headers=auth_headers(token), timeout=30)
    if r.status_code == 200:
        data = r.json()
        ok = all(k in data for k in ("pending_flags", "suspended_users", "cancelled_users", "recent_actions"))
        record("admin_moderation_status", ok, f"keys={list(data.keys())} pending={data.get('pending_flags')}")
    else:
        record("admin_moderation_status", False, f"status={r.status_code} body={r.text[:200]}")

    r = requests.post(f"{API}/admin/process-moderation-emails", headers=auth_headers(token), timeout=120)
    if r.status_code == 200:
        data = r.json()
        record("admin_process_moderation_emails", data.get("success") is True,
               f"details={data.get('details')}")
    else:
        record("admin_process_moderation_emails", False,
               f"status={r.status_code} body={r.text[:300]}")


def main():
    print(f"Testing backend at: {API}")
    try:
        token = admin_login()
    except Exception as e:
        print(f"FATAL: admin login failed: {e}")
        sys.exit(1)

    test_auth_negative(token)
    test_timeline_shape(token)
    test_process_timeline_no_expired(token)
    test_simulate_validation(token)
    test_full_integration(token)
    test_preexisting_endpoints(token)

    print("\n========= SUMMARY =========")
    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])
    print(f"Passed: {passed}, Failed: {failed}, Total: {passed+failed}")
    if failed:
        print("\nFailures:")
        for r in results:
            if not r["ok"]:
                print(f"  - {r['name']}: {r['detail']}")
    sys.exit(0 if failed == 0 else 2)


if __name__ == "__main__":
    main()
