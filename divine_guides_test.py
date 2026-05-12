"""
Divine Spirit Guides regression test
Tests Helios + Selene + chat-pair + regression on existing endpoints.
"""
import json
import os
import sys
import time
import requests

BASE = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

PASS = []
FAIL = []


def record(name, ok, detail=""):
    if ok:
        PASS.append(name)
        print(f"✅ {name}  {detail}")
    else:
        FAIL.append((name, detail))
        print(f"❌ {name}  {detail}")


def login_admin():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        print(f"FATAL: admin login failed {r.status_code} {r.text}")
        sys.exit(1)
    j = r.json()
    return j.get("session_token") or j.get("token"), j


def H(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    token, login_json = login_admin()
    record("11. POST /api/auth/login admin", token and login_json.get("is_admin") in (True, None) or token is not None,
           f"is_admin={login_json.get('is_admin')}")

    # 1. GET /api/spirit-guides/list — divine key
    r = requests.get(f"{BASE}/spirit-guides/list", timeout=30)
    ok = r.status_code == 200
    j = r.json() if ok else {}
    divine = j.get("divine") or []
    by_name = {x.get("name"): x for x in divine}
    cond = (
        ok and len(divine) == 2 and "Helios" in by_name and "Selene" in by_name
        and by_name["Helios"].get("voice") == "onyx" and by_name["Selene"].get("voice") == "shimmer"
        and by_name["Helios"].get("element") == "Sun" and by_name["Selene"].get("element") == "Moon"
    )
    record("1. GET /spirit-guides/list contains divine[Helios,Selene]",
           cond, f"status={r.status_code} divine_count={len(divine)} names={list(by_name)}")

    # 2. GET /spirit-guides/access (no auth)
    r = requests.get(f"{BASE}/spirit-guides/access", timeout=30)
    j = r.json() if r.status_code == 200 else {}
    cond = r.status_code == 200 and j.get("divine_unlocked") is False and j.get("is_premium") is False
    record("2. /spirit-guides/access (no auth) divine_unlocked=false",
           cond, f"divine_unlocked={j.get('divine_unlocked')} is_premium={j.get('is_premium')}")

    # 3. GET /spirit-guides/access (admin)
    r = requests.get(f"{BASE}/spirit-guides/access", headers=H(token), timeout=30)
    j = r.json() if r.status_code == 200 else {}
    cond = r.status_code == 200 and j.get("divine_unlocked") is True and j.get("is_premium") is True
    record("3. /spirit-guides/access (admin) divine_unlocked=true",
           cond, f"divine_unlocked={j.get('divine_unlocked')} is_premium={j.get('is_premium')}")

    # 4. POST /chat Helios
    body = {"guide": "Helios", "element": "Sun", "message": "What is true strength?",
            "history": [], "language": "en", "voice_id": "onyx", "gender": "masculine"}
    r = requests.post(f"{BASE}/spirit-guides/chat", json=body, timeout=120)
    j = r.json() if r.status_code == 200 else {}
    txt = (j.get("response") or "").lower()
    audio_len = len(j.get("audio_base64") or "")
    themes = any(w in txt for w in ["sun", "solar", "fire", "king", "light", "courage", "strength", "will", "sovereign", "ember", "flame", "radian"])
    cond = (r.status_code == 200 and j.get("voice") == "onyx" and j.get("success") is True
            and audio_len > 0 and themes)
    record("4. POST /spirit-guides/chat Helios voice=onyx",
           cond, f"voice={j.get('voice')} audio_len={audio_len} themes={themes} text_snippet={txt[:80]!r}")

    # 5. POST /chat Selene
    body = {"guide": "Selene", "element": "Moon", "message": "Tell me about intuition",
            "history": [], "language": "en", "voice_id": "shimmer", "gender": "feminine"}
    r = requests.post(f"{BASE}/spirit-guides/chat", json=body, timeout=120)
    j = r.json() if r.status_code == 200 else {}
    txt = (j.get("response") or "").lower()
    audio_len = len(j.get("audio_base64") or "")
    themes = any(w in txt for w in ["moon", "lunar", "tide", "intuition", "feminine", "feeling", "soft", "mystery", "knowing", "receptive", "wisdom"])
    cond = (r.status_code == 200 and j.get("voice") == "shimmer" and audio_len > 0 and themes)
    record("5. POST /spirit-guides/chat Selene voice=shimmer",
           cond, f"voice={j.get('voice')} audio_len={audio_len} themes={themes} text_snippet={txt[:80]!r}")

    # 6. chat-pair no auth → 401
    r = requests.post(f"{BASE}/spirit-guides/chat-pair",
                      json={"message": "I seek balance", "history": [], "language": "en"}, timeout=30)
    cond = r.status_code == 401 and "Divine pair" in (r.text or "")
    record("6. /chat-pair (no auth) → 401",
           cond, f"status={r.status_code} body={r.text[:120]}")

    # 7. chat-pair admin → 200 + 3 messages
    r = requests.post(f"{BASE}/spirit-guides/chat-pair",
                      headers=H(token),
                      json={"message": "I seek balance in life", "history": [], "language": "en"},
                      timeout=180)
    ok = r.status_code == 200
    j = r.json() if ok else {}
    msgs = j.get("messages") or []
    cond_top = ok and j.get("success") is True and len(msgs) == 3
    record("7a. /chat-pair (admin) 3 messages",
           cond_top, f"status={r.status_code} success={j.get('success')} messages={len(msgs)}")

    if cond_top:
        m0, m1, m2 = msgs
        # m0 Helios dialogue addressing Selene
        m0_text_lower = (m0.get("text") or "").lower()
        cond0 = (
            m0.get("guide") == "Helios" and m0.get("voice") == "onyx" and m0.get("speed") == 0.88
            and m0.get("kind") == "dialogue"
            and "selene" in m0_text_lower
            and len(m0.get("audio_base64") or "") > 0
        )
        record("7b. messages[0]=Helios dialogue (addresses Selene, onyx, 0.88, audio)",
               cond0, f"guide={m0.get('guide')} voice={m0.get('voice')} speed={m0.get('speed')} kind={m0.get('kind')} contains_Selene={'selene' in m0_text_lower} audio_len={len(m0.get('audio_base64') or '')} text={m0.get('text')[:100]!r}")

        m1_text_lower = (m1.get("text") or "").lower()
        cond1 = (
            m1.get("guide") == "Selene" and m1.get("voice") == "shimmer" and m1.get("speed") == 0.88
            and m1.get("kind") == "dialogue"
            and "helios" in m1_text_lower
            and len(m1.get("audio_base64") or "") > 0
        )
        record("7c. messages[1]=Selene dialogue (addresses Helios, shimmer, 0.88, audio)",
               cond1, f"guide={m1.get('guide')} voice={m1.get('voice')} speed={m1.get('speed')} kind={m1.get('kind')} contains_Helios={'helios' in m1_text_lower} audio_len={len(m1.get('audio_base64') or '')} text={m1.get('text')[:100]!r}")

        m2_text_lower = (m2.get("text") or "").lower()
        unified_pronouns = any(p in m2_text_lower for p in [" we ", " us ", " our ", "beloved", "dear seeker", "we ", "we'", " we,"])
        cond2 = (
            m2.get("guide") == "Divine Pair" and m2.get("voice") == "onyx" and m2.get("speed") == 0.88
            and m2.get("kind") == "unified"
            and unified_pronouns
            and len(m2.get("audio_base64") or "") > 0
        )
        record("7d. messages[2]=Divine Pair unified (we/us/beloved, onyx, 0.88, audio)",
               cond2, f"guide={m2.get('guide')} voice={m2.get('voice')} speed={m2.get('speed')} kind={m2.get('kind')} unified_pronouns={unified_pronouns} audio_len={len(m2.get('audio_base64') or '')} text={m2.get('text')[:100]!r}")

    # 8. chat-pair admin empty msg → 400
    r = requests.post(f"{BASE}/spirit-guides/chat-pair",
                      headers=H(token),
                      json={"message": "", "history": [], "language": "en"}, timeout=30)
    cond = r.status_code == 400 and "empty" in (r.text or "").lower()
    record("8. /chat-pair (admin) empty msg → 400",
           cond, f"status={r.status_code} body={r.text[:160]}")

    # 9. Zodiac element 3/25 — must NOT include Helios
    r = requests.get(f"{BASE}/zodiac/element/3/25", timeout=30)
    j = r.json() if r.status_code == 200 else {}
    guide_name = (j.get("spirit_guide") or {}).get("name")
    cond = r.status_code == 200 and j.get("element") == "Fire" and guide_name == "Ignis"
    record("9. /zodiac/element/3/25 → Ignis (Fire), NOT Helios",
           cond, f"element={j.get('element')} guide={guide_name}")

    # 10. Voices endpoint
    r = requests.get(f"{BASE}/spirit-guides/voices", timeout=30)
    j = r.json() if r.status_code == 200 else {}
    h = j.get("Helios") or {}
    s = j.get("Selene") or {}
    cond = (r.status_code == 200 and len(j) == 11
            and h.get("speed") == 0.88 and s.get("speed") == 0.88)
    record("10. /spirit-guides/voices → 11 entries, Helios+Selene speed=0.88",
           cond, f"count={len(j)} Helios.speed={h.get('speed')} Selene.speed={s.get('speed')}")

    # 12. GET /spirit-guides/custom-names admin
    r = requests.get(f"{BASE}/spirit-guides/custom-names", headers=H(token), timeout=30)
    cond = r.status_code == 200 and r.json().get("is_authenticated") is True
    record("12. GET /spirit-guides/custom-names (admin)", cond, f"status={r.status_code}")

    # 13. POST custom-names {Theron, Lyra}
    r = requests.post(f"{BASE}/spirit-guides/custom-names", headers=H(token),
                      json={"male_name": "Theron", "female_name": "Lyra"}, timeout=30)
    j = r.json() if r.status_code == 200 else {}
    cond = r.status_code == 200 and j.get("male_name") == "Theron" and j.get("female_name") == "Lyra"
    record("13. POST /spirit-guides/custom-names {Theron, Lyra}",
           cond, f"status={r.status_code} male={j.get('male_name')} female={j.get('female_name')}")

    # Verify persistence
    r = requests.get(f"{BASE}/spirit-guides/custom-names", headers=H(token), timeout=30)
    j = r.json() if r.status_code == 200 else {}
    cond_p = j.get("male_name") == "Theron" and j.get("female_name") == "Lyra"
    record("13b. Custom names persist",
           cond_p, f"male={j.get('male_name')} female={j.get('female_name')}")

    # 14. Restore defaults
    r = requests.post(f"{BASE}/spirit-guides/custom-names", headers=H(token),
                      json={"male_name": "Male Guide", "female_name": "Female Guide"}, timeout=30)
    j = r.json() if r.status_code == 200 else {}
    cond = r.status_code == 200 and j.get("male_name") == "Male Guide" and j.get("female_name") == "Female Guide"
    record("14. Restore default names",
           cond, f"status={r.status_code} male={j.get('male_name')} female={j.get('female_name')}")

    # 15. All elementals
    elementals = [("Ignis", "Fire", "onyx"), ("Aqua", "Water", "shimmer"),
                  ("Terra", "Earth", "echo"), ("Aether", "Air", "nova")]
    for name, element, expected_voice in elementals:
        body = {"guide": name, "element": element, "message": "Hello dear guide",
                "history": [], "language": "en"}
        r = requests.post(f"{BASE}/spirit-guides/chat", json=body, timeout=120)
        j = r.json() if r.status_code == 200 else {}
        cond = r.status_code == 200 and j.get("voice") == expected_voice and j.get("success") is True
        record(f"15. /chat {name}/{element} voice={expected_voice}",
               cond, f"status={r.status_code} voice={j.get('voice')}")

    # 16. LGBTQ+
    lgbtq = [("Solis", "Light", "fable"), ("Aurora", "Light", "alloy"), ("Spectrum", "Rainbow", "sage")]
    for name, element, expected_voice in lgbtq:
        body = {"guide": name, "element": element, "message": "Hello dear guide",
                "history": [], "language": "en"}
        r = requests.post(f"{BASE}/spirit-guides/chat", json=body, timeout=120)
        j = r.json() if r.status_code == 200 else {}
        cond = r.status_code == 200 and j.get("voice") == expected_voice and j.get("success") is True
        record(f"16. /chat {name}/{element} voice={expected_voice}",
               cond, f"status={r.status_code} voice={j.get('voice')}")

    # 17. /training/modules
    r = requests.get(f"{BASE}/training/modules", timeout=30)
    j = r.json() if r.status_code == 200 else None
    n = len(j) if isinstance(j, list) else (len(j.get("modules") or []) if isinstance(j, dict) else 0)
    cond = r.status_code == 200 and n == 10
    record("17. GET /training/modules → 10 modules",
           cond, f"status={r.status_code} count={n}")

    # 18. /oracle/draw
    r = requests.post(f"{BASE}/oracle/draw", json={"spread_type": "single", "card_count": 1, "positions": ["Guidance"]},
                      timeout=120)
    cond = r.status_code == 200
    record("18. POST /oracle/draw → 200", cond, f"status={r.status_code}")

    # 19. /subscription/plans
    r = requests.get(f"{BASE}/subscription/plans", timeout=30)
    cond = r.status_code == 200
    record("19. GET /subscription/plans → 200", cond, f"status={r.status_code}")

    # 20. /meditation/chakra/list
    r = requests.get(f"{BASE}/meditation/chakra/list", timeout=30)
    cond = r.status_code == 200
    record("20. GET /meditation/chakra/list → 200", cond, f"status={r.status_code}")

    # Summary
    print("\n" + "=" * 70)
    print(f"RESULTS: {len(PASS)} pass / {len(FAIL)} fail")
    print("=" * 70)
    if FAIL:
        print("\nFAILURES:")
        for n, d in FAIL:
            print(f"  - {n}: {d}")
    return len(FAIL)


if __name__ == "__main__":
    sys.exit(main())
