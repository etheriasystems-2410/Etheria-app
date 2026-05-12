"""
Spirit Guides Custom + LGBTQ+ regression test.
Tests all scenarios in the review request.
"""
import requests
import json
import sys

BASE = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

PASS = 0
FAIL = 0
results = []

def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        results.append(("PASS", name, detail))
        print(f"✅ {name} {detail}")
    else:
        FAIL += 1
        results.append(("FAIL", name, detail))
        print(f"❌ {name} {detail}")

def login_admin():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    return data.get("session_token")

def H(token=None):
    return {"Authorization": f"Bearer {token}"} if token else {}

def main():
    print("=" * 70)
    print("SPIRIT GUIDES (Custom + LGBTQ+) REGRESSION TEST")
    print("=" * 70)

    admin_token = login_admin()
    print(f"Admin token acquired: {admin_token[:20]}...")

    # ------------------------------------------------------------------
    # 1) GET /spirit-guides/list
    # ------------------------------------------------------------------
    print("\n--- [1] GET /spirit-guides/list ---")
    r = requests.get(f"{BASE}/spirit-guides/list", timeout=30)
    check("1.status_200", r.status_code == 200, f"got {r.status_code}")
    data = r.json() if r.status_code == 200 else {}
    check("1.has_elemental_4", len(data.get("elemental", [])) == 4, f"got {len(data.get('elemental',[]))}")
    check("1.has_lgbtq_3", len(data.get("lgbtq", [])) == 3, f"got {len(data.get('lgbtq',[]))}")
    check("1.has_custom_2", len(data.get("custom", [])) == 2, f"got {len(data.get('custom',[]))}")

    def find(group, name):
        for it in data.get(group, []):
            if it.get("name") == name:
                return it
        return None

    ignis = find("elemental", "Ignis")
    check("1.Ignis.voice=onyx", ignis and ignis.get("voice") == "onyx", f"got {ignis}")
    solis = find("lgbtq", "Solis")
    check("1.Solis.voice=fable", solis and solis.get("voice") == "fable", f"got {solis}")
    aurora = find("lgbtq", "Aurora")
    check("1.Aurora.voice=alloy", aurora and aurora.get("voice") == "alloy", f"got {aurora}")
    spectrum = find("lgbtq", "Spectrum")
    check("1.Spectrum.voice=sage", spectrum and spectrum.get("voice") == "sage", f"got {spectrum}")
    check("1.Spectrum.gender=non-binary", spectrum and spectrum.get("gender") == "non-binary",
          f"got {spectrum.get('gender') if spectrum else None}")
    male = find("custom", "Male Guide")
    check("1.MaleGuide.voice=ash", male and male.get("voice") == "ash", f"got {male}")
    female = find("custom", "Female Guide")
    check("1.FemaleGuide.voice=coral", female and female.get("voice") == "coral", f"got {female}")

    # Each item has required keys
    if ignis:
        keys = set(ignis.keys())
        required = {"name", "voice", "gender", "element", "personality", "image"}
        check("1.item_required_keys", required.issubset(keys), f"keys={keys}")

    # ------------------------------------------------------------------
    # 2) GET /spirit-guides/voices
    # ------------------------------------------------------------------
    print("\n--- [2] GET /spirit-guides/voices ---")
    r = requests.get(f"{BASE}/spirit-guides/voices", timeout=30)
    check("2.status_200", r.status_code == 200)
    voices = r.json() if r.status_code == 200 else {}
    check("2.count_9", len(voices) == 9, f"got {len(voices)}")
    expected_names = {"Ignis", "Aqua", "Terra", "Aether", "Male Guide", "Female Guide", "Solis", "Aurora", "Spectrum"}
    check("2.all_names_present", expected_names.issubset(set(voices.keys())),
          f"missing: {expected_names - set(voices.keys())}")

    # ------------------------------------------------------------------
    # 3) GET /spirit-guides/access (no auth)
    # ------------------------------------------------------------------
    print("\n--- [3] GET /spirit-guides/access (no auth) ---")
    r = requests.get(f"{BASE}/spirit-guides/access", timeout=30)
    check("3.status_200", r.status_code == 200)
    acc = r.json() if r.status_code == 200 else {}
    check("3.elemental_unlocked", acc.get("elemental_unlocked") is True)
    check("3.lgbtq_unlocked", acc.get("lgbtq_unlocked") is True)
    check("3.custom_unlocked", acc.get("custom_unlocked") is True, f"got {acc.get('custom_unlocked')}")
    check("3.in_free_promo", acc.get("in_free_promo") is True)
    check("3.is_premium_false", acc.get("is_premium") is False)
    check("3.custom_free_until=2026-07-01", acc.get("custom_free_until") == "2026-07-01T00:00:00+00:00",
          f"got {acc.get('custom_free_until')}")

    # ------------------------------------------------------------------
    # 4) GET /spirit-guides/access (admin auth)
    # ------------------------------------------------------------------
    print("\n--- [4] GET /spirit-guides/access (admin) ---")
    r = requests.get(f"{BASE}/spirit-guides/access", headers=H(admin_token), timeout=30)
    check("4.status_200", r.status_code == 200)
    acc = r.json() if r.status_code == 200 else {}
    check("4.custom_unlocked", acc.get("custom_unlocked") is True)
    check("4.is_premium_true", acc.get("is_premium") is True, f"got {acc.get('is_premium')}")

    # ------------------------------------------------------------------
    # 5) GET /spirit-guides/custom-names (no auth)
    # ------------------------------------------------------------------
    print("\n--- [5] GET /spirit-guides/custom-names (no auth) ---")
    r = requests.get(f"{BASE}/spirit-guides/custom-names", timeout=30)
    check("5.status_200", r.status_code == 200)
    cn = r.json() if r.status_code == 200 else {}
    check("5.male_name=default", cn.get("male_name") == "Male Guide")
    check("5.female_name=default", cn.get("female_name") == "Female Guide")
    check("5.default_male=Male Guide", cn.get("default_male") == "Male Guide")
    check("5.default_female=Female Guide", cn.get("default_female") == "Female Guide")
    check("5.is_authenticated_false", cn.get("is_authenticated") is False)

    # ------------------------------------------------------------------
    # 6) GET /spirit-guides/custom-names (admin)
    # ------------------------------------------------------------------
    print("\n--- [6] GET /spirit-guides/custom-names (admin) ---")
    r = requests.get(f"{BASE}/spirit-guides/custom-names", headers=H(admin_token), timeout=30)
    check("6.status_200", r.status_code == 200)
    cn6 = r.json() if r.status_code == 200 else {}
    check("6.is_authenticated_true", cn6.get("is_authenticated") is True)
    check("6.has_male_name", "male_name" in cn6)
    check("6.has_female_name", "female_name" in cn6)

    # ------------------------------------------------------------------
    # 7) POST /spirit-guides/custom-names (no auth)
    # ------------------------------------------------------------------
    print("\n--- [7] POST /spirit-guides/custom-names (no auth) ---")
    r = requests.post(f"{BASE}/spirit-guides/custom-names", json={"male_name": "X", "female_name": "Y"}, timeout=30)
    check("7.status_401", r.status_code == 401, f"got {r.status_code}")
    if r.status_code == 401:
        detail = r.json().get("detail", "")
        check("7.detail_message", "sign in" in detail.lower() or "login" in detail.lower(),
              f"detail={detail}")

    # ------------------------------------------------------------------
    # 8) POST /spirit-guides/custom-names (admin) Theron/Lyra
    # ------------------------------------------------------------------
    print("\n--- [8] POST /spirit-guides/custom-names (admin) Theron/Lyra ---")
    r = requests.post(f"{BASE}/spirit-guides/custom-names",
                      headers=H(admin_token),
                      json={"male_name": "Theron", "female_name": "Lyra"}, timeout=30)
    check("8.status_200", r.status_code == 200, f"got {r.status_code} body={r.text[:200]}")
    body = r.json() if r.status_code == 200 else {}
    check("8.success_true", body.get("success") is True)
    check("8.male_name=Theron", body.get("male_name") == "Theron")
    check("8.female_name=Lyra", body.get("female_name") == "Lyra")

    # confirm via GET
    r = requests.get(f"{BASE}/spirit-guides/custom-names", headers=H(admin_token), timeout=30)
    cn8 = r.json()
    check("8.GET_returns_Theron", cn8.get("male_name") == "Theron", f"got {cn8.get('male_name')}")
    check("8.GET_returns_Lyra", cn8.get("female_name") == "Lyra", f"got {cn8.get('female_name')}")

    # ------------------------------------------------------------------
    # 9) Empty/whitespace falls back to default
    # ------------------------------------------------------------------
    print("\n--- [9] POST /spirit-guides/custom-names empty -> defaults ---")
    r = requests.post(f"{BASE}/spirit-guides/custom-names",
                      headers=H(admin_token),
                      json={"male_name": "", "female_name": ""}, timeout=30)
    check("9.status_200", r.status_code == 200)
    body = r.json() if r.status_code == 200 else {}
    check("9.male_name_default", body.get("male_name") == "Male Guide", f"got {body.get('male_name')}")
    check("9.female_name_default", body.get("female_name") == "Female Guide", f"got {body.get('female_name')}")

    # ------------------------------------------------------------------
    # 10) Long name truncation to 32 chars
    # ------------------------------------------------------------------
    print("\n--- [10] POST /spirit-guides/custom-names 40-char -> truncated ---")
    long_name = "A" * 40
    r = requests.post(f"{BASE}/spirit-guides/custom-names",
                      headers=H(admin_token),
                      json={"male_name": long_name, "female_name": "Lyra"}, timeout=30)
    check("10.status_200", r.status_code == 200)
    body = r.json() if r.status_code == 200 else {}
    check("10.male_truncated_to_32", len(body.get("male_name", "")) == 32,
          f"len={len(body.get('male_name',''))}")

    # ------------------------------------------------------------------
    # CHAT — standard guides
    # ------------------------------------------------------------------
    print("\n--- [11] Chat Ignis ---")
    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Ignis", "element": "Fire", "message": "hi", "history": [], "language": "en"},
                      timeout=90)
    check("11.status_200", r.status_code == 200, f"got {r.status_code}")
    j = r.json() if r.status_code == 200 else {}
    check("11.voice=onyx", j.get("voice") == "onyx", f"got {j.get('voice')}")

    print("\n--- [12] Chat Solis (LGBTQ+ light) ---")
    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Solis", "element": "Light", "message": "hi", "history": [], "language": "en"},
                      timeout=90)
    check("12.status_200", r.status_code == 200)
    j = r.json() if r.status_code == 200 else {}
    check("12.voice=fable", j.get("voice") == "fable", f"got {j.get('voice')}")
    resp_text = (j.get("response") or "").lower()
    pride_match = any(k in resp_text for k in ["pride", "light", "rainbow", "luminous", "radiant", "queer", "shine", "courage"])
    check("12.pride_themes", pride_match, f"response snippet: {resp_text[:200]}")

    print("\n--- [13] Chat Aurora ---")
    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Aurora", "element": "Light", "message": "hi", "history": [], "language": "en"},
                      timeout=90)
    check("13.status_200", r.status_code == 200)
    j = r.json() if r.status_code == 200 else {}
    check("13.voice=alloy", j.get("voice") == "alloy", f"got {j.get('voice')}")

    print("\n--- [14] Chat Spectrum (trans/gender-expansive) ---")
    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Spectrum", "element": "Rainbow", "message": "hi", "history": [], "language": "en"},
                      timeout=90)
    check("14.status_200", r.status_code == 200)
    j = r.json() if r.status_code == 200 else {}
    check("14.voice=sage", j.get("voice") == "sage", f"got {j.get('voice')}")
    resp_text = (j.get("response") or "").lower()
    trans_match = any(k in resp_text for k in ["trans", "gender", "non-binary", "nonbinary", "identity", "authentic", "becoming", "transition", "expansive", "color", "spectrum"])
    check("14.trans_themes", trans_match, f"response snippet: {resp_text[:200]}")

    print("\n--- [15] Chat Male Guide ---")
    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Male Guide", "element": "Custom", "message": "hi", "history": [], "language": "en"},
                      timeout=90)
    check("15.status_200", r.status_code == 200)
    j = r.json() if r.status_code == 200 else {}
    check("15.voice=ash", j.get("voice") == "ash", f"got {j.get('voice')}")

    print("\n--- [16] Chat Female Guide ---")
    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Female Guide", "element": "Custom", "message": "hi", "history": [], "language": "en"},
                      timeout=90)
    check("16.status_200", r.status_code == 200)
    j = r.json() if r.status_code == 200 else {}
    check("16.voice=coral", j.get("voice") == "coral", f"got {j.get('voice')}")

    # ------------------------------------------------------------------
    # 17) Renamed custom guides
    # ------------------------------------------------------------------
    print("\n--- [17] Renamed Custom Guides (Orion/Selene) ---")
    r = requests.post(f"{BASE}/spirit-guides/custom-names",
                      headers=H(admin_token),
                      json={"male_name": "Orion", "female_name": "Selene"}, timeout=30)
    check("17.setup_rename", r.status_code == 200)

    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Orion", "element": "Custom", "message": "hi",
                            "history": [], "language": "en",
                            "voice_id": "ash", "gender": "masculine"},
                      timeout=90)
    check("17a.status_200", r.status_code == 200)
    j = r.json() if r.status_code == 200 else {}
    check("17a.voice=ash", j.get("voice") == "ash", f"got {j.get('voice')} body={r.text[:200]}")

    r = requests.post(f"{BASE}/spirit-guides/chat",
                      json={"guide": "Selene", "element": "Custom", "message": "hi",
                            "history": [], "language": "en",
                            "voice_id": "coral", "gender": "feminine"},
                      timeout=90)
    check("17b.status_200", r.status_code == 200)
    j = r.json() if r.status_code == 200 else {}
    check("17b.voice=coral", j.get("voice") == "coral", f"got {j.get('voice')}")

    # ------------------------------------------------------------------
    # 18) RESTORE defaults
    # ------------------------------------------------------------------
    print("\n--- [18] Restore defaults ---")
    r = requests.post(f"{BASE}/spirit-guides/custom-names",
                      headers=H(admin_token),
                      json={"male_name": "Male Guide", "female_name": "Female Guide"}, timeout=30)
    check("18.status_200", r.status_code == 200)
    body = r.json() if r.status_code == 200 else {}
    check("18.male_name=Male Guide", body.get("male_name") == "Male Guide")
    check("18.female_name=Female Guide", body.get("female_name") == "Female Guide")

    # ------------------------------------------------------------------
    # 19-21) Zodiac elementals only
    # ------------------------------------------------------------------
    print("\n--- [19] Zodiac 3/25 Aries->Ignis ---")
    r = requests.get(f"{BASE}/zodiac/element/3/25", timeout=30)
    check("19.status_200", r.status_code == 200)
    z = r.json() if r.status_code == 200 else {}
    sg = z.get("spirit_guide", {})
    check("19.guide=Ignis", sg.get("name") == "Ignis", f"got {sg.get('name')}")
    check("19.element=Fire", sg.get("element") == "Fire" or z.get("element") == "Fire",
          f"got element {sg.get('element')} / {z.get('element')}")
    # must not match custom/lgbtq
    check("19.not_custom", sg.get("name") not in {"Male Guide", "Female Guide", "Solis", "Aurora", "Spectrum"},
          f"got {sg.get('name')}")

    print("\n--- [20] Zodiac 7/15 Cancer->Aqua ---")
    r = requests.get(f"{BASE}/zodiac/element/7/15", timeout=30)
    check("20.status_200", r.status_code == 200)
    z = r.json() if r.status_code == 200 else {}
    sg = z.get("spirit_guide", {})
    check("20.guide=Aqua", sg.get("name") == "Aqua", f"got {sg.get('name')}")
    check("20.element=Water", sg.get("element") == "Water" or z.get("element") == "Water")

    print("\n--- [21] Zodiac 11/15 Scorpio->Aqua ---")
    r = requests.get(f"{BASE}/zodiac/element/11/15", timeout=30)
    check("21.status_200", r.status_code == 200)
    z = r.json() if r.status_code == 200 else {}
    sg = z.get("spirit_guide", {})
    check("21.guide=Aqua_Scorpio", sg.get("name") == "Aqua", f"got {sg.get('name')}")

    # ------------------------------------------------------------------
    # REGRESSION
    # ------------------------------------------------------------------
    print("\n--- [22] Auth Login regression ---")
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    check("22.status_200", r.status_code == 200)
    check("22.is_admin", r.json().get("is_admin") is True)

    print("\n--- [23] Training modules ---")
    r = requests.get(f"{BASE}/training/modules", timeout=30)
    check("23.status_200", r.status_code == 200)
    mods = r.json() if r.status_code == 200 else []
    # may be a list or dict
    if isinstance(mods, dict):
        mods = mods.get("modules", [])
    check("23.10_modules", len(mods) == 10, f"got {len(mods)}")

    print("\n--- [24] Oracle draw ---")
    r = requests.post(f"{BASE}/oracle/draw",
                      json={"spread_type": "single", "card_count": 1, "positions": ["Guidance"]},
                      timeout=120)
    check("24.status_200", r.status_code == 200, f"got {r.status_code}")

    print("\n--- [25] Subscription plans ---")
    r = requests.get(f"{BASE}/subscription/plans", timeout=30)
    check("25.status_200", r.status_code == 200)

    print("\n--- [26] Chakra list ---")
    r = requests.get(f"{BASE}/meditation/chakra/list", timeout=30)
    check("26.status_200", r.status_code == 200)
    chakras = r.json() if r.status_code == 200 else []
    if isinstance(chakras, dict):
        chakras = chakras.get("chakras", [])
    check("26.7_chakras", len(chakras) == 7, f"got {len(chakras)}")

    print("\n--- [27] TTS generate ---")
    r = requests.post(f"{BASE}/tts/generate", json={"text": "hello world"}, timeout=60)
    check("27.status_200", r.status_code == 200)
    j = r.json() if r.status_code == 200 else {}
    check("27.guide=Aether", j.get("guide_name") == "Aether", f"got {j.get('guide_name')}")
    check("27.audio_base64_nonempty", bool(j.get("audio_base64")))

    print("\n--- [28] Feedback submit ---")
    r = requests.post(f"{BASE}/feedback/submit",
                      json={"type": "bug", "subject": "Smoke post-guides",
                            "message": "smoke test message for guides feature",
                            "user_email": "test@example.com", "user_name": "Smoke"},
                      timeout=60)
    check("28.status_200", r.status_code == 200, f"got {r.status_code} body={r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    check("28.success_true", j.get("success") is True)
    check("28.email_sent", j.get("email_sent") is True, f"got email_sent={j.get('email_sent')}")

    # Final summary
    print("\n" + "=" * 70)
    print(f"TOTAL: PASS={PASS}  FAIL={FAIL}")
    print("=" * 70)
    if FAIL:
        print("\nFAILED:")
        for status, name, detail in results:
            if status == "FAIL":
                print(f"  - {name}: {detail}")
    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    main()
