"""
DM Feature comprehensive backend test.
Tests routes mounted at /api/messages/* and WebSocket /api/messages/ws.
"""
import asyncio
import json
import os
import time
import uuid
import requests
import websockets

BASE = "https://etheria-divination.preview.emergentagent.com"
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")

ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

results = []


def log(name, ok, info=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {info}")
    results.append((name, ok, info))


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        return None, r
    return r.json(), r


def signup(email, password, name):
    r = requests.post(f"{API}/auth/signup", json={"email": email, "password": password, "name": name}, timeout=30)
    if r.status_code != 200:
        return None, r
    return r.json(), r


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    # ===== 1. Auth wall =====
    print("\n=== TEST 1: Auth wall ===")
    r = requests.get(f"{API}/messages/threads", timeout=15)
    log("1. GET /threads without auth → 401", r.status_code == 401, f"status={r.status_code} body={r.text[:200]}")

    # ===== Setup: login admin =====
    print("\n=== Setup: Login admin ===")
    admin_data, r = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_data:
        log("Admin login", False, f"status={r.status_code} body={r.text[:300]}")
        return
    admin_token = admin_data.get("session_token")
    admin_user_id = admin_data.get("user_id") or admin_data.get("user", {}).get("user_id")
    if not admin_user_id:
        # Get from /me
        me = requests.get(f"{API}/auth/me", headers=auth_headers(admin_token), timeout=15).json()
        admin_user_id = me.get("user_id") or me.get("id")
    log("Admin login", bool(admin_token and admin_user_id), f"admin_id={admin_user_id} is_admin={admin_data.get('is_admin')}")

    # Fetch a non-admin user id for thread creation
    r = requests.get(f"{API}/community/admin/all-users", params={"token": admin_token}, timeout=20)
    if r.status_code != 200:
        log("Get all-users (admin)", False, f"status={r.status_code} body={r.text[:300]}")
        return
    users = r.json().get("users", [])
    non_admin_users = [u for u in users if not u.get("is_admin")]
    if not non_admin_users:
        log("Find non-admin user", False, "no non-admin users available")
        return
    # Pick the first non-admin user that is NOT one of our throwaway accounts
    target_user = non_admin_users[0]
    target_user_id = target_user.get("user_id") or target_user.get("id")
    log("Find non-admin user", True, f"target={target_user.get('email')} id={target_user_id}")

    # ===== 2a. Admin creates thread → 200 =====
    print("\n=== TEST 2a: Admin creates thread (premium-allowed) ===")
    r = requests.post(f"{API}/messages/threads", json={"recipient_id": target_user_id}, headers=auth_headers(admin_token), timeout=20)
    log("2a. Admin POST /threads → 200", r.status_code == 200 and r.json().get("thread_id"), f"status={r.status_code} body={r.text[:300]}")
    if r.status_code != 200:
        return
    admin_thread_id = r.json()["thread_id"]
    print(f"   thread_id={admin_thread_id}")

    # ===== 2b. New free user signs up, tries to create thread → 403 =====
    print("\n=== TEST 2b: Free user cannot create new thread ===")
    suffix = uuid.uuid4().hex[:8]
    free_email1 = f"free.dm.{suffix}@example.com"
    free_pw = "FreeUser123!"
    su, r = signup(free_email1, free_pw, "Free DM Tester")
    if not su:
        log("Signup free user 1", False, f"status={r.status_code} body={r.text[:300]}")
        return
    login_data, r = login(free_email1, free_pw)
    free_token1 = login_data.get("session_token")
    free_user_id1 = login_data.get("user_id")
    if not free_user_id1:
        me = requests.get(f"{API}/auth/me", headers=auth_headers(free_token1), timeout=15).json()
        free_user_id1 = me.get("user_id") or me.get("id")
    log("Signup+login free user 1", bool(free_token1 and free_user_id1), f"id={free_user_id1}")

    # Another free user
    suffix2 = uuid.uuid4().hex[:8]
    free_email2 = f"free.dm.{suffix2}@example.com"
    su2, r = signup(free_email2, free_pw, "Free DM Recipient")
    login_data2, r = login(free_email2, free_pw)
    free_token2 = login_data2.get("session_token")
    free_user_id2 = login_data2.get("user_id")
    if not free_user_id2:
        me = requests.get(f"{API}/auth/me", headers=auth_headers(free_token2), timeout=15).json()
        free_user_id2 = me.get("user_id") or me.get("id")
    log("Signup+login free user 2", bool(free_token2 and free_user_id2), f"id={free_user_id2}")

    r = requests.post(f"{API}/messages/threads", json={"recipient_id": free_user_id2}, headers=auth_headers(free_token1), timeout=20)
    log("2b. Free→Free POST /threads → 403", r.status_code == 403, f"status={r.status_code} body={r.text[:300]}")

    # ===== 2c. Free user POSTs to admin — should return EXISTING thread (200) =====
    # However, this requires that free user is one of admin's existing thread participants.
    # admin's thread is with target_user (not the free user). So we need to either:
    # - use target_user (who has thread with admin already) — but we don't have their password
    # OR
    # - admin creates thread with free_user_id1 first
    # The spec says: "free user, attempt to POST a thread to ADMIN as recipient (admin already created above)"
    # → so admin must have created thread with this free user. Let's adjust:
    # admin creates a thread with free_user_id1 first.
    print("\n=== TEST 2c: Free user → admin returns EXISTING thread ===")
    r = requests.post(f"{API}/messages/threads", json={"recipient_id": free_user_id1}, headers=auth_headers(admin_token), timeout=20)
    if r.status_code != 200:
        log("Setup: admin creates thread with free user1", False, f"status={r.status_code} body={r.text[:300]}")
        return
    admin_to_free1_thread = r.json()["thread_id"]
    # Now free user posts to admin → should return existing thread
    r = requests.post(f"{API}/messages/threads", json={"recipient_id": admin_user_id}, headers=auth_headers(free_token1), timeout=20)
    ok = r.status_code == 200 and r.json().get("thread_id") == admin_to_free1_thread
    log("2c. Free→Admin returns existing thread", ok, f"status={r.status_code} thread_id={r.json().get('thread_id') if r.status_code==200 else r.text[:200]} expected={admin_to_free1_thread}")

    # ===== 3a. Admin sends message =====
    print("\n=== TEST 3a: Admin sends message ===")
    r = requests.post(f"{API}/messages/threads/{admin_to_free1_thread}/send",
                      json={"content": "Hello fellow seeker"}, headers=auth_headers(admin_token), timeout=20)
    ok = r.status_code == 200 and r.json().get("success") and r.json().get("message", {}).get("id")
    log("3a. POST /threads/{id}/send → 200", ok, f"status={r.status_code} body={r.text[:300]}")
    if not ok:
        return
    msg_id = r.json()["message"]["id"]

    # ===== 3b. Recipient (free user) fetches thread =====
    print("\n=== TEST 3b: Recipient GET /threads/{id} ===")
    r = requests.get(f"{API}/messages/threads/{admin_to_free1_thread}", headers=auth_headers(free_token1), timeout=20)
    if r.status_code != 200:
        log("3b. Recipient GET thread → 200", False, f"status={r.status_code} body={r.text[:300]}")
    else:
        data = r.json()
        msgs = data.get("messages", [])
        found = next((m for m in msgs if m.get("id") == msg_id), None)
        ok = found is not None and found.get("mine") is False and found["content"] == "Hello fellow seeker"
        log("3b. Recipient sees message with mine=false", ok, f"messages_count={len(msgs)} found_mine={found.get('mine') if found else None}")

    # ===== 3c. Validation =====
    print("\n=== TEST 3c: Validation (empty / too long) ===")
    r = requests.post(f"{API}/messages/threads/{admin_to_free1_thread}/send",
                      json={"content": "   "}, headers=auth_headers(admin_token), timeout=20)
    log("3c. Empty content → 400", r.status_code == 400, f"status={r.status_code} body={r.text[:200]}")
    r = requests.post(f"{API}/messages/threads/{admin_to_free1_thread}/send",
                      json={"content": "x" * 4001}, headers=auth_headers(admin_token), timeout=20)
    log("3c. Content > 4000 chars → 400", r.status_code == 400, f"status={r.status_code} body={r.text[:200]}")

    # ===== 4a. Mark thread read =====
    print("\n=== TEST 4a: Mark thread read (recipient) ===")
    r = requests.post(f"{API}/messages/threads/{admin_to_free1_thread}/read", headers=auth_headers(free_token1), timeout=20)
    ok = r.status_code == 200 and r.json().get("success") and r.json().get("marked_read", 0) > 0
    log("4a. POST /threads/{id}/read → 200 marked_read>0", ok, f"status={r.status_code} body={r.text[:200]}")

    # ===== 4b. Unread count = 0 after read =====
    print("\n=== TEST 4b: Unread count = 0 after read ===")
    r = requests.get(f"{API}/messages/unread-count", headers=auth_headers(free_token1), timeout=20)
    ok = r.status_code == 200 and r.json().get("unread") == 0
    log("4b. GET /unread-count → 0", ok, f"status={r.status_code} body={r.text[:200]}")

    # ===== 4c. Admin sends another → unread should be 1 =====
    print("\n=== TEST 4c: Unread count = 1 after new send ===")
    r = requests.post(f"{API}/messages/threads/{admin_to_free1_thread}/send",
                      json={"content": "Second seeker message"}, headers=auth_headers(admin_token), timeout=20)
    if r.status_code != 200:
        log("4c. Send 2nd message", False, f"status={r.status_code}")
    time.sleep(1)
    r = requests.get(f"{API}/messages/unread-count", headers=auth_headers(free_token1), timeout=20)
    ok = r.status_code == 200 and r.json().get("unread") == 1
    log("4c. GET /unread-count → 1", ok, f"status={r.status_code} body={r.text[:200]}")

    # ===== 5. Thread list =====
    print("\n=== TEST 5: Thread list ===")
    r = requests.get(f"{API}/messages/threads", headers=auth_headers(admin_token), timeout=20)
    ok = False
    info = ""
    if r.status_code == 200:
        threads_list = r.json().get("threads", [])
        found = next((t for t in threads_list if t.get("thread_id") == admin_to_free1_thread), None)
        ok = found is not None and "last_message_preview" in found and "unread_count" in found
        info = f"threads_count={len(threads_list)} found={bool(found)} preview={found.get('last_message_preview') if found else None}"
    log("5a. Admin GET /threads", ok, info or f"status={r.status_code} body={r.text[:200]}")

    r = requests.get(f"{API}/messages/threads", headers=auth_headers(free_token1), timeout=20)
    ok = False
    info = ""
    if r.status_code == 200:
        threads_list = r.json().get("threads", [])
        found = next((t for t in threads_list if t.get("thread_id") == admin_to_free1_thread), None)
        ok = found is not None and "last_message_preview" in found and "unread_count" in found
        info = f"threads_count={len(threads_list)} found={bool(found)} unread={found.get('unread_count') if found else None}"
    log("5b. Free user GET /threads", ok, info or f"status={r.status_code} body={r.text[:200]}")

    # ===== 6. Block & unblock =====
    print("\n=== TEST 6: Block/unblock ===")
    # Admin blocks free user 1
    r = requests.post(f"{API}/messages/block/{free_user_id1}", headers=auth_headers(admin_token), timeout=20)
    log("6a. POST /block/{id} → 200", r.status_code == 200 and r.json().get("success"), f"status={r.status_code} body={r.text[:200]}")

    r = requests.get(f"{API}/messages/blocks", headers=auth_headers(admin_token), timeout=20)
    ok = False
    if r.status_code == 200:
        blocks = r.json().get("blocks", [])
        ok = any(b.get("user_id") == free_user_id1 for b in blocks)
    log("6b. GET /blocks includes blocked", ok, f"status={r.status_code} body={r.text[:200]}")

    # POST /threads with blocked user → 403
    r = requests.post(f"{API}/messages/threads", json={"recipient_id": free_user_id1}, headers=auth_headers(admin_token), timeout=20)
    log("6c. POST /threads with blocked → 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # Send to existing thread → 403
    r = requests.post(f"{API}/messages/threads/{admin_to_free1_thread}/send",
                      json={"content": "after block"}, headers=auth_headers(admin_token), timeout=20)
    log("6d. POST /send while blocked → 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # Unblock
    r = requests.delete(f"{API}/messages/block/{free_user_id1}", headers=auth_headers(admin_token), timeout=20)
    log("6e. DELETE /block/{id} → 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # Sending works again
    r = requests.post(f"{API}/messages/threads/{admin_to_free1_thread}/send",
                      json={"content": "after unblock"}, headers=auth_headers(admin_token), timeout=20)
    log("6e. Send after unblock → 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # ===== 7. Report thread =====
    print("\n=== TEST 7: Report thread ===")
    r = requests.post(f"{API}/messages/threads/{admin_to_free1_thread}/report",
                      json={"reason": "harassment"}, headers=auth_headers(free_token1), timeout=20)
    flag_id = None
    if r.status_code == 200:
        flag_id = r.json().get("flag_id")
    log("7. POST /threads/{id}/report → 200 with flag_id", r.status_code == 200 and bool(flag_id),
        f"status={r.status_code} flag_id={flag_id} body={r.text[:200]}")

    # ===== 8. Email throttle — check backend logs =====
    print("\n=== TEST 8: Email throttle ===")
    # Send 2 messages quickly to a fresh recipient. We'll then read backend logs for [Email] Sent.
    # Use admin → free_user_id2 (new thread)
    r = requests.post(f"{API}/messages/threads", json={"recipient_id": free_user_id2}, headers=auth_headers(admin_token), timeout=20)
    if r.status_code != 200:
        log("8. Setup new thread for throttle test", False, f"status={r.status_code} body={r.text[:300]}")
    else:
        throttle_thread = r.json()["thread_id"]
        r1 = requests.post(f"{API}/messages/threads/{throttle_thread}/send",
                           json={"content": "throttle test message 1 — should email"}, headers=auth_headers(admin_token), timeout=20)
        time.sleep(2)
        r2 = requests.post(f"{API}/messages/threads/{throttle_thread}/send",
                           json={"content": "throttle test message 2 — should NOT email"}, headers=auth_headers(admin_token), timeout=20)
        time.sleep(3)  # give email task time
        # Read backend logs
        import subprocess
        log_out = subprocess.run(["tail", "-n", "300", "/var/log/supervisor/backend.out.log"],
                                 capture_output=True, text=True).stdout
        err_out = subprocess.run(["tail", "-n", "300", "/var/log/supervisor/backend.err.log"],
                                 capture_output=True, text=True).stdout
        combined = log_out + err_out
        recipient_email = free_email2
        # Look for "[Email] Sent" lines containing recipient_email and the message subject pattern
        email_lines = [ln for ln in combined.split("\n") if "[Email] Sent" in ln and "sent you a message" in ln and recipient_email in ln]
        # We expect exactly 1 email for the throttle test
        log("8. Email sent on 1st message", len(email_lines) >= 1,
            f"matched_lines={len(email_lines)} sample={email_lines[-1][:200] if email_lines else 'none'}")
        log("8. Email throttled on 2nd message (no 2nd email)", len(email_lines) == 1,
            f"matched_lines={len(email_lines)}")

    # ===== 9. WebSocket =====
    print("\n=== TEST 9: WebSocket ===")
    asyncio.run(test_websocket(admin_token, admin_user_id, free_token1, admin_to_free1_thread))

    # ===== Summary =====
    print("\n\n========== SUMMARY ==========")
    pass_count = sum(1 for _, ok, _ in results if ok)
    fail_count = sum(1 for _, ok, _ in results if not ok)
    print(f"Passed: {pass_count}")
    print(f"Failed: {fail_count}")
    if fail_count:
        print("\nFAILED:")
        for name, ok, info in results:
            if not ok:
                print(f"  - {name} :: {info}")


async def test_websocket(admin_token, admin_user_id, free_token1, thread_id):
    """Open WS as free user, then send DM from admin, verify WS receives it."""
    ws_url = f"{WS_BASE}/api/messages/ws?token={free_token1}"
    print(f"   Connecting to {ws_url}")
    try:
        async with websockets.connect(ws_url, open_timeout=15, close_timeout=5) as ws:
            # 1) Receive hello
            first = await asyncio.wait_for(ws.recv(), timeout=10)
            first_data = json.loads(first)
            ok = first_data.get("type") == "hello" and first_data.get("user_id")
            log("9a. WS hello received", ok, f"data={first_data}")

            # 2) Trigger a DM from admin via REST
            content = f"WS test message {uuid.uuid4().hex[:6]}"
            r = requests.post(f"{API}/messages/threads/{thread_id}/send",
                              json={"content": content}, headers=auth_headers(admin_token), timeout=20)
            if r.status_code != 200:
                log("9b. Trigger DM via REST", False, f"status={r.status_code} body={r.text[:200]}")
                return

            # 3) Read WS messages — expect a "message" event within ~5s
            got_message = False
            received = []
            deadline = time.time() + 8
            while time.time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=max(0.1, deadline - time.time()))
                    data = json.loads(raw)
                    received.append(data)
                    if data.get("type") == "message" and data.get("thread_id") == thread_id:
                        if data.get("message", {}).get("content") == content:
                            got_message = True
                            break
                except asyncio.TimeoutError:
                    break
            log("9b. WS receives message event", got_message, f"received_count={len(received)} types={[d.get('type') for d in received]}")
            # 4) Close
            await ws.close()
            log("9c. WS closed cleanly", True, "")
    except Exception as e:
        log("9. WebSocket overall", False, f"exception={type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
