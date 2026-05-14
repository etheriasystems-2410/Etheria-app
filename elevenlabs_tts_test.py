"""
ElevenLabs TTS regression test for Spirit Guides endpoints.
Tests:
  1. POST /api/spirit-guides/chat — Solis, Aurora, Ignis (with voice_id)
  2. POST /api/tts/generate — guide_name=Aether
  3. GET /api/spirit-guides/divine-intro?lang=en — premium auth
  4. POST /api/spirit-guides/chat-pair — premium auth

Verifies: audio_base64 non-empty (>5000 chars), correct voice echo,
combined_audio_base64 ≈ sum of individual audio lengths (±1%).
"""

import os
import sys
import json
import requests
from pathlib import Path

# Read backend URL from frontend/.env
FRONTEND_ENV = Path("/app/frontend/.env")
BACKEND_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

if not BACKEND_URL:
    print("Could not find EXPO_PUBLIC_BACKEND_URL")
    sys.exit(1)

API = BACKEND_URL.rstrip("/") + "/api"
print(f"\n=== Testing against: {API} ===\n")

ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

results = []  # (name, passed, detail)


def record(name, passed, detail=""):
    results.append((name, passed, detail))
    icon = "PASS" if passed else "FAIL"
    print(f"[{icon}] {name}: {detail}")


# ============ Step 1: Login ============
print("\n--- Step 0: Admin login ---")
r = requests.post(
    f"{API}/auth/login",
    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    timeout=30,
)
if r.status_code != 200:
    print(f"LOGIN FAILED: {r.status_code} {r.text}")
    sys.exit(1)

login_data = r.json()
session_token = login_data.get("session_token") or login_data.get("user", {}).get("session_token")
if not session_token:
    print(f"NO session_token in login: {json.dumps(login_data, indent=2)[:500]}")
    sys.exit(1)

print(f"Admin logged in. is_admin={login_data.get('user',{}).get('is_admin')}  is_premium={login_data.get('user',{}).get('is_premium')}")
auth_headers = {"Authorization": f"Bearer {session_token}"}

# ============ Step 1: /spirit-guides/chat for 3 guides ============
print("\n--- Test 1: POST /api/spirit-guides/chat (3 guides) ---")

guides = [
    {"guide": "Solis", "element": "Light", "gender": "masculine", "voice_id": "nPczCjzI2devNBz1zQrb"},
    {"guide": "Aurora", "element": "Light", "gender": "feminine", "voice_id": "cgSgspJ2msm6clMCkdW9"},
    {"guide": "Ignis", "element": "Fire", "gender": "masculine", "voice_id": "SOYHLrjzK2X1ezoPC6cr"},
]

for g in guides:
    body = {
        "guide": g["guide"],
        "element": g["element"],
        "message": "Hello, can you guide me?",
        "history": [],
        "language": "en",
        "gender": g["gender"],
        "voice_id": g["voice_id"],
    }
    r = requests.post(f"{API}/spirit-guides/chat", json=body, headers=auth_headers, timeout=120)
    if r.status_code != 200:
        record(f"chat:{g['guide']}", False, f"HTTP {r.status_code} body={r.text[:200]}")
        continue
    data = r.json()
    success = data.get("success")
    audio_b64 = data.get("audio_base64") or ""
    voice = data.get("voice")
    audio_len = len(audio_b64)
    ok = (success is True) and (audio_len > 5000) and (voice == g["voice_id"])
    record(
        f"chat:{g['guide']}",
        ok,
        f"success={success} voice={voice} (expected {g['voice_id']}) audio_len={audio_len}"
    )

# ============ Step 2: /tts/generate ============
print("\n--- Test 2: POST /api/tts/generate ---")
body = {"text": "Hello world. This is a test.", "guide_name": "Aether"}
r = requests.post(f"{API}/tts/generate", json=body, timeout=120)
if r.status_code != 200:
    record("tts/generate", False, f"HTTP {r.status_code} body={r.text[:200]}")
else:
    data = r.json()
    success = data.get("success")
    audio_b64 = data.get("audio_base64") or ""
    guide_name = data.get("guide_name")
    audio_len = len(audio_b64)
    ok = (success is True) and (audio_len > 5000) and (guide_name == "Aether")
    record("tts/generate", ok, f"success={success} guide={guide_name} audio_len={audio_len}")

# ============ Step 3: /spirit-guides/divine-intro?lang=en ============
print("\n--- Test 3: GET /api/spirit-guides/divine-intro?lang=en ---")
r = requests.get(f"{API}/spirit-guides/divine-intro?lang=en", headers=auth_headers, timeout=120)
if r.status_code != 200:
    record("divine-intro", False, f"HTTP {r.status_code} body={r.text[:200]}")
else:
    data = r.json()
    success = data.get("success")
    msgs = data.get("messages") or []
    combined = data.get("combined_audio_base64") or ""
    combined_len = len(combined)
    if len(msgs) != 2:
        record("divine-intro", False, f"expected 2 messages, got {len(msgs)}")
    else:
        helios = msgs[0]
        selene = msgs[1]
        h_len = len(helios.get("audio_base64") or "")
        s_len = len(selene.get("audio_base64") or "")
        total = h_len + s_len
        if total > 0:
            diff_pct = abs(combined_len - total) / total * 100
        else:
            diff_pct = 100
        ok_individual = h_len > 5000 and s_len > 5000
        ok_combined = combined_len > 5000 and diff_pct <= 1.0
        ok_guides = helios.get("guide") == "Helios" and selene.get("guide") == "Selene"
        all_ok = success is True and ok_individual and ok_combined and ok_guides
        record(
            "divine-intro",
            all_ok,
            f"success={success} guides=[{helios.get('guide')},{selene.get('guide')}] "
            f"helios_audio_len={h_len} selene_audio_len={s_len} sum={total} "
            f"combined_len={combined_len} diff={diff_pct:.3f}%"
        )

# ============ Step 4: /spirit-guides/chat-pair ============
print("\n--- Test 4: POST /api/spirit-guides/chat-pair ---")
body = {"message": "I want to feel more confident.", "history": [], "language": "en"}
r = requests.post(f"{API}/spirit-guides/chat-pair", json=body, headers=auth_headers, timeout=180)
if r.status_code != 200:
    record("chat-pair", False, f"HTTP {r.status_code} body={r.text[:200]}")
else:
    data = r.json()
    success = data.get("success")
    msgs = data.get("messages") or []
    combined = data.get("combined_audio_base64") or ""
    combined_len = len(combined)
    if len(msgs) != 3:
        record("chat-pair", False, f"expected 3 messages, got {len(msgs)}")
    else:
        helios = msgs[0]
        selene = msgs[1]
        pair = msgs[2]
        h_len = len(helios.get("audio_base64") or "")
        s_len = len(selene.get("audio_base64") or "")
        p_len = len(pair.get("audio_base64") or "")
        total = h_len + s_len + p_len
        diff_pct = abs(combined_len - total) / total * 100 if total > 0 else 100
        ok_individual = h_len > 5000 and s_len > 5000 and p_len > 5000
        ok_combined = combined_len > 5000 and diff_pct <= 1.0
        ok_guides = (
            helios.get("guide") == "Helios"
            and selene.get("guide") == "Selene"
            and pair.get("guide") == "Divine Pair"
        )

        # Check endearments
        helios_text = (helios.get("text") or "").lower()
        selene_text = (selene.get("text") or "").lower()
        helios_endearments = ["my radiant one", "my moon", "beloved", "dear heart", "selene"]
        selene_endearments = ["helios", "my sun", "beloved", "dear heart", "my radiant"]
        helios_calls_selene = any(e in helios_text for e in helios_endearments)
        selene_calls_helios = any(e in selene_text for e in selene_endearments)

        all_ok = (
            success is True and ok_individual and ok_combined and ok_guides
            and helios_calls_selene and selene_calls_helios
        )
        record(
            "chat-pair",
            all_ok,
            f"success={success} guides=[{helios.get('guide')},{selene.get('guide')},{pair.get('guide')}] "
            f"helios_len={h_len} selene_len={s_len} pair_len={p_len} sum={total} "
            f"combined_len={combined_len} diff={diff_pct:.3f}% "
            f"helios_calls_selene={helios_calls_selene} selene_calls_helios={selene_calls_helios}"
        )
        # Show snippets for endearment debug
        print(f"  helios_text: {helios.get('text')[:200]!r}")
        print(f"  selene_text: {selene.get('text')[:200]!r}")
        print(f"  pair_text:   {pair.get('text')[:200]!r}")

# ============ Summary ============
print("\n=== SUMMARY ===")
passed = sum(1 for _, p, _ in results if p)
total = len(results)
for name, p, detail in results:
    icon = "PASS" if p else "FAIL"
    print(f"  [{icon}] {name}")
print(f"\n{passed}/{total} tests passed.")
sys.exit(0 if passed == total else 1)
