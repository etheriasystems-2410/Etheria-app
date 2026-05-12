"""
Backend regression smoke test after route extraction refactor.
"""
import requests
import json
import sys

BASE = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

results = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    results.append((name, ok, detail))


def short(obj, n=300):
    try:
        return json.dumps(obj)[:n]
    except Exception:
        return str(obj)[:n]


def main():
    # Admin login (#14)
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    try:
        body = r.json()
    except Exception:
        body = {}
    if r.status_code == 200 and body.get("session_token") and body.get("is_admin") is True:
        log("14. POST /api/auth/login (admin)", True, "is_admin=true, has session_token")
        token = body["session_token"]
    else:
        log("14. POST /api/auth/login (admin)", False,
            f"status={r.status_code} body={short(body)}")
        print("CANNOT CONTINUE WITHOUT ADMIN TOKEN")
        sys.exit(1)

    auth = {"Authorization": f"Bearer {token}"}

    # 1. Dreams interpret
    r = requests.post(f"{BASE}/dreams/interpret",
                      json={"description": "I was flying through clouds",
                            "symbols": ["flying", "sky"],
                            "feelings": ["free", "happy"]},
                      timeout=120)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    ok = (r.status_code == 200 and body.get("success") is True
          and isinstance(body.get("interpretation"), str)
          and len(body.get("interpretation", "")) > 0)
    log("1. POST /api/dreams/interpret", ok,
        f"status={r.status_code} interp_len={len(body.get('interpretation','')) if isinstance(body, dict) else 'n/a'}")

    # 2a. Zodiac Aries
    r = requests.get(f"{BASE}/zodiac/element/3/25", timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("zodiac_sign") == "Aries"
          and body.get("element") == "Fire"
          and body.get("spirit_guide", {}).get("name") == "Ignis"
          and body.get("spirit_guide", {}).get("element") == "Fire"
          and body.get("spirit_guide", {}).get("gender") == "masculine"
          and body.get("spirit_guide", {}).get("voice") == "onyx")
    log("2a. GET /api/zodiac/element/3/25 (Aries→Ignis)", ok,
        f"status={r.status_code} body={short(body)}")

    # 2b. Zodiac Cancer
    r = requests.get(f"{BASE}/zodiac/element/7/15", timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("zodiac_sign") == "Cancer"
          and body.get("element") == "Water"
          and body.get("spirit_guide", {}).get("name") == "Aqua"
          and body.get("spirit_guide", {}).get("gender") == "feminine")
    log("2b. GET /api/zodiac/element/7/15 (Cancer→Aqua)", ok,
        f"status={r.status_code} body={short(body)}")

    # 3. Spirit guides chat
    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Ignis", "element": "Fire",
                            "message": "hello", "history": [],
                            "language": "en"},
                      timeout=150)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("success") is True
          and isinstance(body.get("response"), str)
          and len(body.get("response", "")) > 0
          and body.get("voice") == "onyx"
          and "audio_base64" in body)
    log("3. POST /api/spirit-guides/chat", ok,
        f"status={r.status_code} resp_len={len(body.get('response','')) if isinstance(body, dict) else 0} voice={body.get('voice')}")

    # 4. Voices
    r = requests.get(f"{BASE}/spirit-guides/voices", timeout=30)
    body = r.json() if r.ok else {}
    required = ["Ignis", "Aqua", "Terra", "Aether"]
    ok = (r.status_code == 200 and all(k in body for k in required)
          and body.get("Ignis", {}).get("voice") == "onyx"
          and body.get("Aether", {}).get("voice") == "nova"
          and all("gender" in body.get(k, {}) for k in required))
    log("4. GET /api/spirit-guides/voices", ok,
        f"status={r.status_code} keys={list(body.keys()) if isinstance(body, dict) else 'n/a'}")

    # 5. Oracle draw single
    r = requests.post(f"{BASE}/oracle/draw",
                      json={"spread_type": "single", "card_count": 1,
                            "positions": ["Guidance"]},
                      timeout=180)
    body = r.json() if r.ok else {}
    cards = body.get("cards", [])
    ok = (r.status_code == 200 and body.get("spread_type") == "single"
          and len(cards) == 1
          and cards[0].get("position") == "Guidance"
          and isinstance(cards[0].get("interpretation"), str)
          and len(cards[0].get("interpretation", "")) > 0
          and cards[0].get("card", {}).get("name")
          and "image_base64" in cards[0].get("card", {})
          and body.get("timestamp"))
    log("5. POST /api/oracle/draw (single)", ok,
        f"status={r.status_code} card={cards[0].get('card',{}).get('name') if cards else 'n/a'}")

    # 6. Oracle draw 3
    r = requests.post(f"{BASE}/oracle/draw",
                      json={"spread_type": "three_card", "card_count": 3,
                            "positions": ["Past", "Present", "Future"]},
                      timeout=240)
    body = r.json() if r.ok else {}
    cards = body.get("cards", [])
    ok = (r.status_code == 200 and body.get("spread_type") == "three_card"
          and len(cards) == 3
          and [c.get("position") for c in cards] == ["Past", "Present", "Future"])
    log("6. POST /api/oracle/draw (three_card)", ok,
        f"status={r.status_code} cards_count={len(cards)}")

    # 7a. Oracle save
    r = requests.post(f"{BASE}/oracle/save", headers=auth,
                      json={"card": {"name": "Test"}, "interpretation": "x",
                            "timestamp": "2026-02-12T00:00:00"},
                      timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("success") is True
          and body.get("message") == "Reading saved")
    log("7a. POST /api/oracle/save (auth)", ok,
        f"status={r.status_code} body={short(body)}")

    # 7b. Oracle readings
    r = requests.get(f"{BASE}/oracle/readings", headers=auth, timeout=30)
    try:
        body = r.json()
    except Exception:
        body = None
    ok = (r.status_code == 200 and isinstance(body, list) and len(body) >= 1)
    log("7b. GET /api/oracle/readings (auth)", ok,
        f"status={r.status_code} count={len(body) if isinstance(body, list) else 'n/a'}")

    # 8. Subscription plans
    r = requests.get(f"{BASE}/subscription/plans", timeout=30)
    body = r.json() if r.ok else {}
    plans = body.get("plans", {})
    pm = plans.get("premium_monthly", {})
    ok = (r.status_code == 200 and "plans" in body and "free_tier_limits" in body
          and pm.get("price") == 3.99 and pm.get("currency") == "usd"
          and pm.get("name") and "features" in pm)
    log("8. GET /api/subscription/plans", ok,
        f"status={r.status_code} pm_price={pm.get('price')} currency={pm.get('currency')}")

    # 9a. Status with admin
    r = requests.get(f"{BASE}/subscription/status", headers=auth, timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("is_premium") is True
          and isinstance(body.get("features"), dict))
    log("9a. GET /api/subscription/status (admin)", ok,
        f"status={r.status_code} is_premium={body.get('is_premium')}")

    # 9b. Status without auth
    r = requests.get(f"{BASE}/subscription/status", timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("is_premium") is False)
    log("9b. GET /api/subscription/status (no auth)", ok,
        f"status={r.status_code} is_premium={body.get('is_premium')}")

    # 10. Create checkout
    r = requests.post(f"{BASE}/subscription/create-checkout", headers=auth,
                      json={"plan_id": "premium_monthly",
                            "origin_url": "https://etheria-divination.preview.emergentagent.com"},
                      timeout=60)
    try:
        body = r.json()
    except Exception:
        body = {}
    checkout_url = body.get("url") or body.get("checkout_url")
    session_id = body.get("session_id")
    ok = (r.status_code == 200 and checkout_url and session_id)
    log("10. POST /api/subscription/create-checkout (admin)", ok,
        f"status={r.status_code} has_url={bool(checkout_url)} session_id={(session_id or '')[:30]}")

    # 11. Checkout status
    if session_id:
        r = requests.get(f"{BASE}/subscription/checkout-status/{session_id}", headers=auth, timeout=30)
        body = r.json() if r.ok else {}
        ok = (r.status_code == 200 and ("status" in body or "payment_status" in body))
        log("11. GET /api/subscription/checkout-status/{id}", ok,
            f"status={r.status_code} body={short(body)}")
    else:
        log("11. GET /api/subscription/checkout-status/{id}", False, "no session_id")

    # 12a. Feature access no auth
    r = requests.get(f"{BASE}/user/feature-access/spirit_guides", timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("feature") == "spirit_guides"
          and "has_access" in body and "upgrade_required" in body)
    log("12a. GET /api/user/feature-access/spirit_guides (no auth)", ok,
        f"status={r.status_code} body={short(body)}")

    # 12b. Feature access admin
    r = requests.get(f"{BASE}/user/feature-access/spirit_guides", headers=auth, timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("has_access") is True)
    log("12b. GET /api/user/feature-access/spirit_guides (admin)", ok,
        f"status={r.status_code} has_access={body.get('has_access')}")

    # 13. Training
    r = requests.get(f"{BASE}/training/modules", timeout=30)
    body = r.json() if r.ok else None
    modules = body if isinstance(body, list) else (body or {}).get("modules", [])
    ok = (r.status_code == 200 and len(modules) == 10)
    log("13. GET /api/training/modules", ok,
        f"status={r.status_code} count={len(modules)}")

    # 15. Journal status
    r = requests.get(f"{BASE}/journal/status", headers=auth, timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("is_premium") is True
          and body.get("unlimited") is True)
    log("15. GET /api/journal/status (admin)", ok,
        f"status={r.status_code} body={short(body)}")

    # 16. Moderation timeline
    r = requests.get(f"{BASE}/admin/moderation/timeline", headers=auth, timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200
          and "active_suspensions" in body
          and "expired_suspensions" in body
          and "cancelled_accounts" in body
          and "counts" in body)
    log("16. GET /api/admin/moderation/timeline (admin)", ok,
        f"status={r.status_code} keys={list(body.keys()) if isinstance(body, dict) else 'n/a'}")

    # 17. Messages threads
    r = requests.get(f"{BASE}/messages/threads", headers=auth, timeout=30)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and "threads_count" in body)
    log("17. GET /api/messages/threads (admin)", ok,
        f"status={r.status_code} threads_count={body.get('threads_count')}")

    # 18. Feedback submit
    r = requests.post(f"{BASE}/feedback/submit",
                      json={"type": "bug", "subject": "Test refactor",
                            "message": "smoke",
                            "user_email": "test@example.com",
                            "user_name": "Tester"},
                      timeout=60)
    body = r.json() if r.ok else {}
    ok = (r.status_code == 200 and body.get("success") is True
          and body.get("feedback_id") and "email_sent" in body)
    log("18. POST /api/feedback/submit", ok,
        f"status={r.status_code} body={short(body)}")

    # Summary
    print("\n" + "=" * 80)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"TOTAL: {passed} passed, {failed} failed of {len(results)}")
    if failed:
        print("\nFAILED TESTS:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name}: {detail}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
