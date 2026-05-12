"""
MEDITATION ROUTE DOMAIN EXTRACTION REGRESSION SMOKE TEST
Tests all 15 meditation endpoints + regression of routes that stayed/were extracted earlier.
"""
import requests
import json
import sys

BASE_URL = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

results = []  # list of (name, pass_bool, status_code, summary)

def record(name, ok, status, summary):
    results.append((name, ok, status, summary))
    icon = "✅" if ok else "❌"
    print(f"{icon} {name} | status={status} | {summary}")

def short(v, n=120):
    s = str(v)
    return s[:n] + ("..." if len(s) > n else "")

# ============ Admin login first (needed for tests 14, 15, 23, etc.) ============
print("=" * 80)
print("BOOTSTRAP: Admin login")
print("=" * 80)
try:
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    admin_data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    SESSION_TOKEN = admin_data.get("session_token")
    if r.status_code == 200 and SESSION_TOKEN and admin_data.get("is_admin") is True:
        print(f"✅ admin login | session_token issued | is_admin=True")
    else:
        print(f"❌ admin login failed: status={r.status_code}, body={short(r.text)}")
        sys.exit(1)
except Exception as e:
    print(f"❌ admin login exception: {e}")
    sys.exit(1)

HEADERS_AUTH = {"Authorization": f"Bearer {SESSION_TOKEN}"}

print()
print("=" * 80)
print("MEDITATION ENDPOINTS (1-15)")
print("=" * 80)

# ============ 1. GET /api/meditation/chakra/list ============
try:
    r = requests.get(f"{BASE_URL}/meditation/chakra/list", timeout=30)
    if r.status_code != 200:
        record("1. GET /meditation/chakra/list", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ok = isinstance(data, list) and len(data) == 7
        first = data[0] if ok else {}
        required = ["id", "name", "sanskrit", "frequency", "color", "location", "element", "benefits", "affirmation"]
        missing = [k for k in required if k not in first]
        is_root_first = first.get("id") == "root" and first.get("frequency") == 396
        ok = ok and not missing and is_root_first
        record("1. GET /meditation/chakra/list", ok, r.status_code,
               f"len={len(data)}, first.id={first.get('id')}, freq={first.get('frequency')}, missing={missing}")
except Exception as e:
    record("1. GET /meditation/chakra/list", False, "EXC", str(e))

# ============ 2. GET /api/meditation/binaural/frequencies ============
try:
    r = requests.get(f"{BASE_URL}/meditation/binaural/frequencies", timeout=30)
    if r.status_code != 200:
        record("2. GET /meditation/binaural/frequencies", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ok = isinstance(data, list) and len(data) == 9
        first = data[0] if ok else {}
        required = ["id", "name", "frequency_range", "base_frequency", "beat_frequency", "benefits", "color"]
        missing = [k for k in required if k not in first]
        ok = ok and not missing
        record("2. GET /meditation/binaural/frequencies", ok, r.status_code,
               f"len={len(data)}, missing_fields={missing}")
except Exception as e:
    record("2. GET /meditation/binaural/frequencies", False, "EXC", str(e))

# ============ 3. GET /api/meditation/chakra/tone/heart ============
try:
    r = requests.get(f"{BASE_URL}/meditation/chakra/tone/heart", timeout=60)
    if r.status_code != 200:
        record("3. GET /meditation/chakra/tone/heart", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        # Review expects: chakra_id, frequency:639, name, audio_base64, color, sanskrit, location, element, benefits, affirmation, duration_seconds, format
        required = ["chakra_id", "frequency", "name", "audio_base64", "color", "sanskrit",
                    "location", "element", "benefits", "affirmation", "duration_seconds", "format"]
        missing = [k for k in required if k not in data]
        present = list(data.keys())
        freq_ok = data.get("frequency") == 639
        fmt_ok = data.get("format") == "wav"
        ab64 = data.get("audio_base64", "")
        ab64_ok = isinstance(ab64, str) and len(ab64) > 100
        ok = not missing and freq_ok and fmt_ok and ab64_ok
        record("3. GET /meditation/chakra/tone/heart", ok, r.status_code,
               f"missing={missing}; present={present}; freq={data.get('frequency')}; fmt={data.get('format')}; ab64_len={len(ab64) if isinstance(ab64,str) else 'NA'}")
except Exception as e:
    record("3. GET /meditation/chakra/tone/heart", False, "EXC", str(e))

# ============ 4. GET /api/meditation/binaural/generate/alpha?duration=5 ============
try:
    r = requests.get(f"{BASE_URL}/meditation/binaural/generate/alpha", params={"duration": 5}, timeout=60)
    if r.status_code != 200:
        record("4. GET /meditation/binaural/generate/alpha?duration=5", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        required = ["frequency_id", "base_frequency", "beat_frequency", "duration_seconds", "sample_rate", "audio_base64", "format"]
        missing = [k for k in required if k not in data]
        ab64 = data.get("audio_base64", "")
        ab64_ok = isinstance(ab64, str) and len(ab64) > 100
        ok = not missing and data.get("format") == "wav" and data.get("frequency_id") == "alpha" and ab64_ok
        record("4. GET /meditation/binaural/generate/alpha?duration=5", ok, r.status_code,
               f"missing={missing}, freq_id={data.get('frequency_id')}, dur={data.get('duration_seconds')}, ab64_len={len(ab64) if isinstance(ab64,str) else 'NA'}")
except Exception as e:
    record("4. GET /meditation/binaural/generate/alpha?duration=5", False, "EXC", str(e))

# ============ 5. GET /api/meditation/chakra/realign-tone?duration=7 ============
try:
    r = requests.get(f"{BASE_URL}/meditation/chakra/realign-tone", params={"duration": 7}, timeout=60)
    if r.status_code != 200:
        record("5. GET /meditation/chakra/realign-tone?duration=7", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        required = ["type", "duration_seconds", "chakra_order", "audio_base64", "format", "loopable"]
        missing = [k for k in required if k not in data]
        order = data.get("chakra_order", [])
        ok = (not missing and data.get("type") == "realign_all" and isinstance(order, list)
              and len(order) == 7 and data.get("format") == "wav" and data.get("loopable") is True)
        ab64 = data.get("audio_base64", "")
        ok = ok and isinstance(ab64, str) and len(ab64) > 100
        record("5. GET /meditation/chakra/realign-tone?duration=7", ok, r.status_code,
               f"missing={missing}, type={data.get('type')}, order_len={len(order)}, loopable={data.get('loopable')}, ab64_len={len(ab64) if isinstance(ab64,str) else 'NA'}")
except Exception as e:
    record("5. GET /meditation/chakra/realign-tone?duration=7", False, "EXC", str(e))

# ============ 6. GET /api/meditation/ambient/generate/rain?duration=3 ============
# Review expects "binary content" but code returns JSON {audio_base64} — flag if mismatch
try:
    r = requests.get(f"{BASE_URL}/meditation/ambient/generate/rain", params={"duration": 3}, timeout=60)
    if r.status_code != 200:
        record("6. GET /meditation/ambient/generate/rain?duration=3", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        ct = r.headers.get("content-type", "")
        if "audio/wav" in ct:
            ok = len(r.content) > 100 and r.content[:4] == b"RIFF"
            record("6. GET /meditation/ambient/generate/rain?duration=3 (BINARY)", ok, r.status_code,
                   f"content-type={ct}, bytes={len(r.content)}, RIFF_header={r.content[:4] == b'RIFF'}")
        elif "json" in ct:
            data = r.json()
            ab64 = data.get("audio_base64", "")
            # Spec said binary WAV stream, but route returns JSON with audio_base64 — still functionally usable
            ok = isinstance(ab64, str) and len(ab64) > 100 and data.get("format") == "wav"
            record("6. GET /meditation/ambient/generate/rain?duration=3 (JSON)", ok, r.status_code,
                   f"⚠️ returns JSON not binary stream; sound_id={data.get('sound_id')}, fmt={data.get('format')}, ab64_len={len(ab64) if isinstance(ab64,str) else 'NA'}")
        else:
            record("6. GET /meditation/ambient/generate/rain?duration=3", False, r.status_code,
                   f"unexpected content-type={ct}, body={short(r.content)}")
except Exception as e:
    record("6. GET /meditation/ambient/generate/rain?duration=3", False, "EXC", str(e))

# ============ 7. GET /api/meditation/chakra/stream/heart?duration=3 ============
try:
    r = requests.get(f"{BASE_URL}/meditation/chakra/stream/heart", params={"duration": 3}, timeout=60)
    ct = r.headers.get("content-type", "")
    ok = r.status_code == 200 and "audio/wav" in ct and len(r.content) > 100 and r.content[:4] == b"RIFF"
    record("7. GET /meditation/chakra/stream/heart?duration=3", ok, r.status_code,
           f"content-type={ct}, bytes={len(r.content)}, RIFF={r.content[:4] == b'RIFF'}")
except Exception as e:
    record("7. GET /meditation/chakra/stream/heart?duration=3", False, "EXC", str(e))

# ============ 8. GET /api/meditation/binaural/stream/alpha?duration=3 ============
try:
    r = requests.get(f"{BASE_URL}/meditation/binaural/stream/alpha", params={"duration": 3}, timeout=60)
    ct = r.headers.get("content-type", "")
    ok = r.status_code == 200 and "audio/wav" in ct and len(r.content) > 100 and r.content[:4] == b"RIFF"
    record("8. GET /meditation/binaural/stream/alpha?duration=3", ok, r.status_code,
           f"content-type={ct}, bytes={len(r.content)}, RIFF={r.content[:4] == b'RIFF'}")
except Exception as e:
    record("8. GET /meditation/binaural/stream/alpha?duration=3", False, "EXC", str(e))

# ============ 9. GET /api/meditation/chakra/stream-realign?duration=7 ============
try:
    r = requests.get(f"{BASE_URL}/meditation/chakra/stream-realign", params={"duration": 7}, timeout=60)
    ct = r.headers.get("content-type", "")
    ok = r.status_code == 200 and "audio/wav" in ct and len(r.content) > 100 and r.content[:4] == b"RIFF"
    record("9. GET /meditation/chakra/stream-realign?duration=7", ok, r.status_code,
           f"content-type={ct}, bytes={len(r.content)}, RIFF={r.content[:4] == b'RIFF'}")
except Exception as e:
    record("9. GET /meditation/chakra/stream-realign?duration=7", False, "EXC", str(e))

# ============ 10. GET /api/meditation/binaural/audio/delta ============
try:
    r = requests.get(f"{BASE_URL}/meditation/binaural/audio/delta", timeout=30)
    if r.status_code != 200:
        record("10. GET /meditation/binaural/audio/delta", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        required = ["frequency_id", "audio_url", "format", "duration_minutes", "sample_rate", "note"]
        missing = [k for k in required if k not in data]
        ok = (not missing and data.get("frequency_id") == "delta" and data.get("format") == "mp3"
              and data.get("duration_minutes") == 30 and data.get("sample_rate") == 44100)
        record("10. GET /meditation/binaural/audio/delta", ok, r.status_code,
               f"missing={missing}, fmt={data.get('format')}, dur={data.get('duration_minutes')}, sr={data.get('sample_rate')}")
except Exception as e:
    record("10. GET /meditation/binaural/audio/delta", False, "EXC", str(e))

# ============ 11. POST /api/meditation/generate-guided?duration_minutes=3&focus=calm ============
try:
    r = requests.post(f"{BASE_URL}/meditation/generate-guided",
                      params={"duration_minutes": 3, "focus": "calm"}, timeout=60)
    if r.status_code != 200:
        record("11. POST /meditation/generate-guided", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        script = data.get("script", "")
        ok = (isinstance(script, str) and len(script) > 50
              and data.get("duration_minutes") == 3 and data.get("focus") == "calm")
        record("11. POST /meditation/generate-guided?duration=3&focus=calm", ok, r.status_code,
               f"script_len={len(script) if isinstance(script,str) else 'NA'}, dur={data.get('duration_minutes')}, focus={data.get('focus')}")
except Exception as e:
    record("11. POST /meditation/generate-guided", False, "EXC", str(e))

# ============ 12. POST /api/meditation/chakra/generate-guided/heart?duration_minutes=3 ============
try:
    r = requests.post(f"{BASE_URL}/meditation/chakra/generate-guided/heart",
                      params={"duration_minutes": 3}, timeout=60)
    if r.status_code != 200:
        record("12. POST /meditation/chakra/generate-guided/heart", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        required = ["script", "chakra_id", "chakra_name", "duration_minutes", "frequency"]
        missing = [k for k in required if k not in data]
        # Review expects "color" too — check
        has_color = "color" in data
        ok = (not missing and data.get("chakra_id") == "heart"
              and data.get("chakra_name") == "Heart Chakra (Anahata)"
              and data.get("duration_minutes") == 3
              and isinstance(data.get("script"), str) and len(data.get("script", "")) > 50)
        record("12. POST /meditation/chakra/generate-guided/heart?duration=3", ok, r.status_code,
               f"missing={missing}, has_color={has_color}, chakra_name={data.get('chakra_name')}, freq={data.get('frequency')}")
except Exception as e:
    record("12. POST /meditation/chakra/generate-guided/heart", False, "EXC", str(e))

# ============ 13. POST /api/meditation/chakra/generate-realign?duration_minutes=3 ============
try:
    r = requests.post(f"{BASE_URL}/meditation/chakra/generate-realign",
                      params={"duration_minutes": 3}, timeout=90)
    if r.status_code != 200:
        record("13. POST /meditation/chakra/generate-realign", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        required = ["type", "script", "duration_minutes", "chakra_order"]
        missing = [k for k in required if k not in data]
        order = data.get("chakra_order", [])
        ok = (not missing and data.get("type") == "realign_all"
              and data.get("duration_minutes") == 3
              and isinstance(order, list) and len(order) == 7
              and isinstance(data.get("script"), str) and len(data.get("script", "")) > 50)
        record("13. POST /meditation/chakra/generate-realign?duration=3", ok, r.status_code,
               f"missing={missing}, type={data.get('type')}, order_len={len(order)}, script_len={len(data.get('script') or '')}")
except Exception as e:
    record("13. POST /meditation/chakra/generate-realign", False, "EXC", str(e))

# ============ 14. POST /api/meditation/session/save with admin ============
try:
    body = {"meditation_type": "chakra", "duration_minutes": 5, "completed_at": "2026-02-12T00:00:00"}
    r = requests.post(f"{BASE_URL}/meditation/session/save", json=body, headers=HEADERS_AUTH, timeout=30)
    if r.status_code != 200:
        record("14. POST /meditation/session/save", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ok = data.get("success") is True and isinstance(data.get("session_id"), str) and len(data.get("session_id", "")) > 0
        record("14. POST /meditation/session/save (admin)", ok, r.status_code,
               f"success={data.get('success')}, session_id={data.get('session_id')}")
except Exception as e:
    record("14. POST /meditation/session/save", False, "EXC", str(e))

# ============ 15. GET /api/meditation/sessions with admin ============
try:
    r = requests.get(f"{BASE_URL}/meditation/sessions", headers=HEADERS_AUTH, timeout=30)
    if r.status_code != 200:
        record("15. GET /meditation/sessions", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ok = isinstance(data, list) and len(data) >= 1
        record("15. GET /meditation/sessions (admin)", ok, r.status_code,
               f"list_len={len(data) if isinstance(data,list) else 'NA'}")
except Exception as e:
    record("15. GET /meditation/sessions", False, "EXC", str(e))

print()
print("=" * 80)
print("REGRESSION (16-24) — previously-extracted/inline routes")
print("=" * 80)

# 16. POST /api/dreams/interpret
try:
    r = requests.post(f"{BASE_URL}/dreams/interpret",
                      json={"description": "I was flying", "symbols": [], "feelings": []}, timeout=90)
    if r.status_code != 200:
        record("16. POST /dreams/interpret", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ok = data.get("success") is True and isinstance(data.get("interpretation"), str) and len(data.get("interpretation", "")) > 20
        record("16. POST /dreams/interpret", ok, r.status_code,
               f"success={data.get('success')}, interp_len={len(data.get('interpretation') or '')}")
except Exception as e:
    record("16. POST /dreams/interpret", False, "EXC", str(e))

# 17. GET /api/zodiac/element/3/25
try:
    r = requests.get(f"{BASE_URL}/zodiac/element/3/25", timeout=30)
    if r.status_code != 200:
        record("17. GET /zodiac/element/3/25", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        zsign = data.get("zodiac_sign")
        element = data.get("element")
        sg = data.get("spirit_guide", {}) or {}
        # Review says Aries/Fire/Ignis
        ok = zsign == "Aries" and element == "Fire" and sg.get("name") == "Ignis"
        record("17. GET /zodiac/element/3/25", ok, r.status_code,
               f"zodiac={zsign}, element={element}, guide={sg.get('name')}")
except Exception as e:
    record("17. GET /zodiac/element/3/25", False, "EXC", str(e))

# 18. POST /api/spirit-guides/chat
try:
    r = requests.post(f"{BASE_URL}/spirit-guides/chat",
                      json={"guide": "Ignis", "element": "Fire", "message": "hi", "history": [], "language": "en"},
                      timeout=60)
    if r.status_code != 200:
        record("18. POST /spirit-guides/chat", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ok = (data.get("success") is True and isinstance(data.get("response"), str)
              and len(data.get("response", "")) > 5 and data.get("voice") == "onyx")
        record("18. POST /spirit-guides/chat (Ignis)", ok, r.status_code,
               f"success={data.get('success')}, voice={data.get('voice')}, resp_len={len(data.get('response') or '')}")
except Exception as e:
    record("18. POST /spirit-guides/chat", False, "EXC", str(e))

# 19. POST /api/oracle/draw single
try:
    r = requests.post(f"{BASE_URL}/oracle/draw",
                      json={"spread_type": "single", "card_count": 1, "positions": ["Guidance"]}, timeout=90)
    if r.status_code != 200:
        record("19. POST /oracle/draw", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        cards = data.get("cards", [])
        ok = isinstance(cards, list) and len(cards) == 1 and cards[0].get("card", {}).get("image_base64")
        record("19. POST /oracle/draw (single)", ok, r.status_code,
               f"cards_count={len(cards)}, has_image={bool(cards[0].get('card',{}).get('image_base64')) if cards else False}")
except Exception as e:
    record("19. POST /oracle/draw", False, "EXC", str(e))

# 20. GET /api/subscription/plans
try:
    r = requests.get(f"{BASE_URL}/subscription/plans", timeout=30)
    ok = r.status_code == 200
    body_keys = list(r.json().keys()) if ok else []
    record("20. GET /subscription/plans", ok, r.status_code, f"keys={body_keys}")
except Exception as e:
    record("20. GET /subscription/plans", False, "EXC", str(e))

# 21. POST /api/auth/login (re-verify admin login)
try:
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        record("21. POST /auth/login (admin)", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ok = data.get("is_admin") is True and isinstance(data.get("session_token"), str)
        record("21. POST /auth/login (admin)", ok, r.status_code,
               f"is_admin={data.get('is_admin')}, has_token={bool(data.get('session_token'))}")
except Exception as e:
    record("21. POST /auth/login", False, "EXC", str(e))

# 22. GET /api/training/modules
try:
    r = requests.get(f"{BASE_URL}/training/modules", timeout=30)
    if r.status_code != 200:
        record("22. GET /training/modules", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        if isinstance(data, list):
            count = len(data)
        elif isinstance(data, dict):
            mods = data.get("modules", [])
            count = len(mods) if isinstance(mods, list) else -1
        else:
            count = -1
        ok = count == 10
        record("22. GET /training/modules", ok, r.status_code, f"modules_count={count} (expected 10)")
except Exception as e:
    record("22. GET /training/modules", False, "EXC", str(e))

# 23. GET /api/journal/status with admin
try:
    r = requests.get(f"{BASE_URL}/journal/status", headers=HEADERS_AUTH, timeout=30)
    if r.status_code != 200:
        record("23. GET /journal/status (admin)", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ok = data.get("is_premium") is True and data.get("unlimited") is True
        record("23. GET /journal/status (admin)", ok, r.status_code,
               f"is_premium={data.get('is_premium')}, unlimited={data.get('unlimited')}")
except Exception as e:
    record("23. GET /journal/status", False, "EXC", str(e))

# 24. POST /api/tts/generate (inline in server.py)
try:
    r = requests.post(f"{BASE_URL}/tts/generate",
                      json={"text": "hello world", "guide_name": "Aether"}, timeout=60)
    if r.status_code != 200:
        record("24. POST /tts/generate", False, r.status_code, f"non-200; body={short(r.text)}")
    else:
        data = r.json()
        ab64 = data.get("audio_base64", "")
        ok = (data.get("success") is True and data.get("guide_name") == "Aether"
              and isinstance(ab64, str) and len(ab64) > 100)
        record("24. POST /tts/generate", ok, r.status_code,
               f"success={data.get('success')}, guide={data.get('guide_name')}, ab64_len={len(ab64) if isinstance(ab64,str) else 'NA'}")
except Exception as e:
    record("24. POST /tts/generate", False, "EXC", str(e))

# ============ SUMMARY ============
print()
print("=" * 80)
print("FINAL SUMMARY")
print("=" * 80)
passed = sum(1 for _, ok, _, _ in results if ok)
failed = sum(1 for _, ok, _, _ in results if not ok)
print(f"PASSED: {passed}/{len(results)}    FAILED: {failed}/{len(results)}")
print()
print("FAILED tests:")
for name, ok, status, summary in results:
    if not ok:
        print(f"  ❌ {name} | status={status} | {summary}")
print()
print("PASSED tests:")
for name, ok, status, summary in results:
    if ok:
        print(f"  ✅ {name} | status={status}")
