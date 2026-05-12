"""
FINAL REFACTOR REGRESSION TEST — verifies routes extracted into /app/backend/routes/admin.py
plus regression on previously extracted domains and routes still living in server.py.
"""
import os
import sys
import json
import requests

BASE = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

passed = []
failed = []


def record(name, ok, detail=""):
    (passed if ok else failed).append((name, detail))
    flag = "✅" if ok else "❌"
    print(f"{flag} {name}: {detail[:300]}")


def login_admin():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    return body["session_token"], body


def main():
    token, login_body = login_admin()
    auth = {"Authorization": f"Bearer {token}"}

    # 34 first to confirm login worked
    record(
        "[34] POST /auth/login admin",
        login_body.get("is_admin") is True and token,
        f"is_admin={login_body.get('is_admin')} token_present={bool(token)}",
    )

    # 1. TTS default (Aether)
    r = requests.post(f"{BASE}/tts/generate", json={"text": "Hello traveler"}, timeout=60)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[1] POST /tts/generate default→Aether",
        r.status_code == 200
        and body.get("success") is True
        and body.get("guide_name") == "Aether"
        and bool(body.get("audio_base64")),
        f"status={r.status_code} guide={body.get('guide_name')} ab64_len={len(body.get('audio_base64') or '')}",
    )

    # 2. TTS with markdown + guide_name=Ignis
    r = requests.post(
        f"{BASE}/tts/generate",
        json={"text": "# bold\n* bullet\nactual content", "guide_name": "Ignis"},
        timeout=60,
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    cleaned_text = body.get("text", "")
    record(
        "[2] POST /tts/generate Ignis+markdown",
        r.status_code == 200
        and body.get("guide_name") == "Ignis"
        and bool(body.get("audio_base64"))
        and "#" not in cleaned_text  # markdown removed
        and "*" not in cleaned_text,
        f"status={r.status_code} guide={body.get('guide_name')} cleaned_text='{cleaned_text}'",
    )

    # 3. GET /gift-code/current
    r = requests.get(f"{BASE}/gift-code/current", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    code_val = body.get("code", "")
    record(
        "[3] GET /gift-code/current",
        r.status_code == 200
        and code_val == code_val.upper()
        and "-" in code_val
        and bool(body.get("expires_at"))
        and isinstance(body.get("redemptions_count"), int),
        f"status={r.status_code} code={code_val} expires={body.get('expires_at')} redemptions={body.get('redemptions_count')}",
    )

    # 4. POST /gift-code/redeem no auth
    r = requests.post(f"{BASE}/gift-code/redeem", json={"code": "INVALID-CODE-XYZ"}, timeout=30)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
    record(
        "[4] POST /gift-code/redeem no-auth→401",
        r.status_code == 401 and "login" in (body.get("detail", "")).lower(),
        f"status={r.status_code} detail={body.get('detail')}",
    )

    # 5. POST /gift-code/redeem with admin
    r = requests.post(
        f"{BASE}/gift-code/redeem", json={"code": "INVALID-CODE-XYZ"}, headers=auth, timeout=30
    )
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
    record(
        "[5] POST /gift-code/redeem invalid code (auth)→400",
        r.status_code == 400 and "invalid" in (body.get("detail", "")).lower(),
        f"status={r.status_code} detail={body.get('detail')}",
    )

    # 6. POST /prize-drawing/opt-in no auth → 401
    r = requests.post(f"{BASE}/prize-drawing/opt-in", json={"opt_in": True}, timeout=30)
    record(
        "[6] POST /prize-drawing/opt-in no-auth→401",
        r.status_code == 401,
        f"status={r.status_code} body={r.text[:160]}",
    )

    # 7. POST /prize-drawing/opt-in with admin
    r = requests.post(
        f"{BASE}/prize-drawing/opt-in", json={"opt_in": True}, headers=auth, timeout=30
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[7] POST /prize-drawing/opt-in (auth)→200",
        r.status_code == 200
        and body.get("success") is True
        and body.get("opted_in") is True
        and bool(body.get("message")),
        f"status={r.status_code} body={body}",
    )

    # 8. GET /prize-drawing/status no auth
    r = requests.get(f"{BASE}/prize-drawing/status", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[8] GET /prize-drawing/status no-auth",
        r.status_code == 200
        and body.get("opted_in") is False
        and body.get("eligible") is False
        and body.get("weekly_usage_minutes") == 0
        and body.get("required_minutes") == 30,
        f"status={r.status_code} body={body}",
    )

    # 9. GET /prize-drawing/status with admin
    r = requests.get(f"{BASE}/prize-drawing/status", headers=auth, timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[9] GET /prize-drawing/status (auth)→opted_in:true",
        r.status_code == 200 and body.get("opted_in") is True and "next_drawing" in body,
        f"status={r.status_code} opted_in={body.get('opted_in')} next_drawing={body.get('next_drawing')}",
    )

    # 10. POST /usage/track no auth
    r = requests.post(
        f"{BASE}/usage/track",
        json={"duration_seconds": 120, "activity_type": "meditation"},
        timeout=30,
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[10] POST /usage/track no-auth",
        r.status_code == 200
        and body.get("tracked") is False
        and "login" in (body.get("reason") or "").lower(),
        f"status={r.status_code} body={body}",
    )

    # 11. POST /usage/track with admin
    r = requests.post(
        f"{BASE}/usage/track",
        json={"duration_seconds": 120, "activity_type": "meditation"},
        headers=auth,
        timeout=30,
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[11] POST /usage/track (auth)→tracked",
        r.status_code == 200
        and body.get("tracked") is True
        and body.get("duration_seconds") == 120,
        f"status={r.status_code} body={body}",
    )

    # 12. POST /admin/prize-drawing/run wrong secret
    r = requests.post(
        f"{BASE}/admin/prize-drawing/run", json={"admin_secret": "wrong"}, timeout=30
    )
    record(
        "[12] POST /admin/prize-drawing/run wrong-secret→403",
        r.status_code == 403,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # 13. GET /admin/dashboard wrong secret
    r = requests.get(f"{BASE}/admin/dashboard", params={"admin_secret": "wrong"}, timeout=30)
    record(
        "[13] GET /admin/dashboard wrong-secret→403",
        r.status_code == 403,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # 14. GET /admin/participants wrong secret
    r = requests.get(f"{BASE}/admin/participants", params={"admin_secret": "wrong"}, timeout=30)
    record(
        "[14] GET /admin/participants wrong-secret→403",
        r.status_code == 403,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # 15. POST /admin/generate-new-code wrong secret
    r = requests.post(
        f"{BASE}/admin/generate-new-code", json={"admin_secret": "wrong"}, timeout=30
    )
    record(
        "[15] POST /admin/generate-new-code wrong-secret→403",
        r.status_code == 403,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # 16. POST /feedback/submit
    r = requests.post(
        f"{BASE}/feedback/submit",
        json={
            "type": "bug",
            "subject": "Smoke test parity",
            "message": "Testing extracted feedback route via Resend",
            "user_email": "test@example.com",
            "user_name": "Smoke Tester",
        },
        timeout=60,
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[16] POST /feedback/submit",
        r.status_code == 200
        and body.get("success") is True
        and body.get("email_sent") is True,
        f"status={r.status_code} body={body}",
    )

    # 17. POST /promo-code/redeem no auth
    r = requests.post(f"{BASE}/promo-code/redeem", json={"code": "test"}, timeout=30)
    record(
        "[17] POST /promo-code/redeem no-auth→401",
        r.status_code == 401,
        f"status={r.status_code} body={r.text[:160]}",
    )

    # 18. GET /contest/eligible-count
    r = requests.get(f"{BASE}/contest/eligible-count", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[18] GET /contest/eligible-count",
        r.status_code == 200 and isinstance(body.get("eligible_count"), int),
        f"status={r.status_code} body={body}",
    )

    # 19. GET /contest/next
    r = requests.get(f"{BASE}/contest/next", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[19] GET /contest/next",
        r.status_code == 200 and "next_drawing_date" in body,
        f"status={r.status_code} body={body}",
    )

    # 20. GET /contest/history
    r = requests.get(f"{BASE}/contest/history", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[20] GET /contest/history",
        r.status_code == 200 and isinstance(body.get("history"), list),
        f"status={r.status_code} history_len={len(body.get('history') or [])}",
    )

    # 21. POST /contest/run wrong secret
    r = requests.post(f"{BASE}/contest/run", json={"admin_secret": "wrong"}, timeout=30)
    record(
        "[21] POST /contest/run wrong-secret→403",
        r.status_code == 403,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # 22. GET /user/notifications with admin
    r = requests.get(f"{BASE}/user/notifications", headers=auth, timeout=30)
    body = None
    try:
        body = r.json()
    except Exception:
        body = r.text
    record(
        "[22] GET /user/notifications (auth)",
        r.status_code == 200 and isinstance(body, (list, dict)),
        f"status={r.status_code} type={type(body).__name__}",
    )

    # 23. POST /dreams/interpret
    r = requests.post(
        f"{BASE}/dreams/interpret",
        json={"description": "I was flying", "symbols": [], "feelings": []},
        timeout=120,
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[23] POST /dreams/interpret",
        r.status_code == 200 and (body.get("success") is True or "interpretation" in body),
        f"status={r.status_code} keys={list(body.keys()) if isinstance(body, dict) else 'n/a'}",
    )

    # 24. GET /zodiac/element/3/25 → Aries/Fire/Ignis
    r = requests.get(f"{BASE}/zodiac/element/3/25", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    sg = body.get("spirit_guide", {}) if isinstance(body, dict) else {}
    record(
        "[24] GET /zodiac/element/3/25 Aries/Fire/Ignis/masculine",
        r.status_code == 200
        and body.get("zodiac_sign") == "Aries"
        and body.get("element") == "Fire"
        and sg.get("name") == "Ignis"
        and sg.get("gender") == "masculine",
        f"status={r.status_code} sign={body.get('zodiac_sign')} element={body.get('element')} guide={sg.get('name')} gender={sg.get('gender')}",
    )

    # 25. POST /spirit-guides/chat
    r = requests.post(
        f"{BASE}/spirit-guides/chat",
        json={
            "guide": "Ignis",
            "element": "Fire",
            "message": "hi",
            "history": [],
            "language": "en",
        },
        timeout=120,
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[25] POST /spirit-guides/chat Ignis→voice:onyx",
        r.status_code == 200 and body.get("voice") == "onyx",
        f"status={r.status_code} voice={body.get('voice')}",
    )

    # 26. GET /spirit-guides/voices
    r = requests.get(f"{BASE}/spirit-guides/voices", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    voices = body.get("voices", body) if isinstance(body, dict) else {}
    required = {"Ignis", "Aqua", "Terra", "Aether"}
    has_all = required.issubset(set(voices.keys())) if isinstance(voices, dict) else False
    record(
        "[26] GET /spirit-guides/voices includes all 4",
        r.status_code == 200 and has_all,
        f"status={r.status_code} keys={list(voices.keys()) if isinstance(voices, dict) else 'n/a'}",
    )

    # 27. POST /oracle/draw single card with image_base64
    r = requests.post(
        f"{BASE}/oracle/draw",
        json={"spread_type": "single", "card_count": 1, "positions": ["Guidance"]},
        timeout=180,
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    cards = body.get("cards", []) if isinstance(body, dict) else []
    has_image = bool(cards and (cards[0].get("card", {}).get("image_base64") or cards[0].get("image_base64")))
    record(
        "[27] POST /oracle/draw with image_base64",
        r.status_code == 200 and len(cards) == 1 and has_image,
        f"status={r.status_code} cards_count={len(cards)} has_image={has_image}",
    )

    # 28. GET /subscription/plans
    r = requests.get(f"{BASE}/subscription/plans", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[28] GET /subscription/plans",
        r.status_code == 200 and "plans" in body,
        f"status={r.status_code} keys={list(body.keys()) if isinstance(body, dict) else 'n/a'}",
    )

    # 29. GET /subscription/status with admin
    r = requests.get(f"{BASE}/subscription/status", headers=auth, timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[29] GET /subscription/status (auth)→is_premium:true",
        r.status_code == 200 and body.get("is_premium") is True,
        f"status={r.status_code} is_premium={body.get('is_premium')}",
    )

    # 30. GET /user/feature-access/spirit_guides
    r = requests.get(f"{BASE}/user/feature-access/spirit_guides", timeout=30)
    record(
        "[30] GET /user/feature-access/spirit_guides",
        r.status_code == 200,
        f"status={r.status_code} body={r.text[:160]}",
    )

    # 31. GET /meditation/chakra/list
    r = requests.get(f"{BASE}/meditation/chakra/list", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    chakras = body.get("chakras", body) if isinstance(body, dict) else []
    if isinstance(chakras, dict):
        # some implementations might wrap differently
        chakras = chakras.get("chakras", chakras)
    record(
        "[31] GET /meditation/chakra/list (7 chakras)",
        r.status_code == 200 and (isinstance(chakras, list) and len(chakras) == 7),
        f"status={r.status_code} count={len(chakras) if isinstance(chakras, list) else 'n/a'}",
    )

    # 32. GET /meditation/chakra/tone/heart
    r = requests.get(f"{BASE}/meditation/chakra/tone/heart", timeout=120)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    expected_keys = {
        "chakra_id",
        "name",
        "sanskrit",
        "frequency",
        "color",
        "location",
        "element",
        "benefits",
        "affirmation",
        "duration_seconds",
        "audio_base64",
        "format",
    }
    missing = expected_keys - set(body.keys() if isinstance(body, dict) else [])
    record(
        "[32] GET /meditation/chakra/tone/heart full payload",
        r.status_code == 200
        and not missing
        and body.get("frequency") == 639
        and body.get("format") == "wav"
        and bool(body.get("audio_base64")),
        f"status={r.status_code} missing={missing} freq={body.get('frequency')} fmt={body.get('format')} ab64_len={len(body.get('audio_base64') or '')}",
    )

    # 33. POST /meditation/chakra/generate-guided/heart
    r = requests.post(
        f"{BASE}/meditation/chakra/generate-guided/heart",
        params={"duration_minutes": 3},
        timeout=120,
    )
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[33] POST /meditation/chakra/generate-guided/heart has 'color'",
        r.status_code == 200 and "color" in body,
        f"status={r.status_code} keys={list(body.keys()) if isinstance(body, dict) else 'n/a'} has_color={'color' in (body if isinstance(body, dict) else {})}",
    )

    # 35. GET /training/modules
    r = requests.get(f"{BASE}/training/modules", timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    modules = body if isinstance(body, list) else body.get("modules", [])
    record(
        "[35] GET /training/modules (10 modules)",
        r.status_code == 200 and len(modules) == 10,
        f"status={r.status_code} count={len(modules)}",
    )

    # 36. GET /journal/status with admin
    r = requests.get(f"{BASE}/journal/status", headers=auth, timeout=30)
    body = r.json() if r.status_code == 200 else {"raw": r.text}
    record(
        "[36] GET /journal/status (auth)→is_premium:true unlimited:true",
        r.status_code == 200 and body.get("is_premium") is True and body.get("unlimited") is True,
        f"status={r.status_code} body={body}",
    )

    # 37. GET /messages/threads with admin
    r = requests.get(f"{BASE}/messages/threads", headers=auth, timeout=30)
    record(
        "[37] GET /messages/threads (auth)",
        r.status_code == 200,
        f"status={r.status_code}",
    )

    # 38. GET /admin/moderation/timeline with admin
    r = requests.get(f"{BASE}/admin/moderation/timeline", headers=auth, timeout=30)
    record(
        "[38] GET /admin/moderation/timeline (auth)",
        r.status_code == 200,
        f"status={r.status_code}",
    )

    # 39. POST /notifications/register
    r = requests.post(
        f"{BASE}/notifications/register",
        json={"token": "ExponentPushToken[smoke]", "platform": "ios"},
        headers=auth,
        timeout=30,
    )
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
    record(
        "[39] POST /notifications/register (push router, NOT shadowed)",
        r.status_code == 200 and body.get("success") is True,
        f"status={r.status_code} body={body}",
    )

    # Summary
    print("\n========== SUMMARY ==========")
    print(f"PASSED: {len(passed)}")
    print(f"FAILED: {len(failed)}")
    if failed:
        print("\nFailed tests:")
        for name, detail in failed:
            print(f"  ❌ {name}: {detail}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
