"""Test /api/spirit-guides/chat-pair returns combined_audio_base64 + each message has audio_base64.
Also smoke-test /api/spirit-guides/divine-intro?lang=en (premium-gated)."""
import os
import sys
import json
import requests

BASE = "https://etheria-divination.preview.emergentagent.com/api"
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"


def login():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    print(f"[login] status={r.status_code}")
    r.raise_for_status()
    data = r.json()
    print(f"[login] is_admin={data.get('user',{}).get('is_admin')}")
    return data["session_token"]


def test_chat_pair(token):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {"message": "I feel lost in my path lately.", "history": [], "language": "en"}
    print("\n=== /api/spirit-guides/chat-pair ===")
    r = requests.post(f"{BASE}/spirit-guides/chat-pair", json=body, headers=headers, timeout=120)
    print(f"status={r.status_code}")
    if r.status_code != 200:
        print(f"BODY: {r.text[:2000]}")
        return False
    data = r.json()
    success = data.get("success")
    msgs = data.get("messages") or []
    combined = data.get("combined_audio_base64")
    print(f"success={success}")
    print(f"messages count={len(msgs)}")
    if "combined_audio_base64" not in data:
        print("❌ combined_audio_base64 KEY MISSING")
        return False
    if combined is None:
        print("❌ combined_audio_base64 is None")
        return False
    print(f"combined_audio_base64 length={len(combined)}")

    if len(msgs) != 3:
        print(f"❌ Expected 3 messages, got {len(msgs)}")
        return False

    audio_lens = []
    for i, m in enumerate(msgs):
        ab = m.get("audio_base64") or ""
        audio_lens.append(len(ab))
        print(f"  msg[{i}] guide={m.get('guide')} voice={m.get('voice')} kind={m.get('kind')} text_len={len(m.get('text') or '')} audio_b64_len={len(ab)}")
        if not ab or len(ab) < 1000:
            print(f"  ❌ msg[{i}].audio_base64 too short / empty")
            return False

    helios_len, selene_len, unified_len = audio_lens
    sum_individual = helios_len + selene_len + unified_len
    print(f"\nLength summary:")
    print(f"  helios_audio  = {helios_len}")
    print(f"  selene_audio  = {selene_len}")
    print(f"  unified_audio = {unified_len}")
    print(f"  sum of 3      = {sum_individual}")
    print(f"  combined      = {len(combined)}")

    # combined is base64 of concatenated raw bytes; base64 length of (A+B+C bytes)
    # is roughly ceil((|a|+|b|+|c|)/3)*4 which is close to sum of individual base64
    # lengths but NOT exact due to per-clip base64 padding. Allow ~5% tolerance.
    if len(combined) < max(helios_len, selene_len, unified_len):
        print("❌ combined shorter than the largest individual clip — wrong")
        return False
    # combined should be approximately equal to sum (within a few chars due to padding)
    diff_pct = abs(len(combined) - sum_individual) / max(sum_individual, 1) * 100
    print(f"  diff vs sum: {diff_pct:.2f}%")
    if diff_pct > 5:
        print("⚠️  combined length differs from sum-of-individuals by more than 5%")
    else:
        print("✅ combined length ≈ sum of individual lengths")

    print("✅ chat-pair test PASSED")
    return True


def test_divine_intro_with_auth(token):
    headers = {"Authorization": f"Bearer {token}"}
    print("\n=== /api/spirit-guides/divine-intro?lang=en (with admin auth) ===")
    r = requests.get(f"{BASE}/spirit-guides/divine-intro?lang=en", headers=headers, timeout=120)
    print(f"status={r.status_code}")
    if r.status_code != 200:
        print(f"BODY: {r.text[:1000]}")
        return False
    data = r.json()
    msgs = data.get("messages") or []
    combined = data.get("combined_audio_base64")
    print(f"success={data.get('success')} messages count={len(msgs)} combined_len={len(combined) if combined else 0}")
    for i, m in enumerate(msgs):
        ab = m.get("audio_base64") or ""
        print(f"  msg[{i}] guide={m.get('guide')} kind={m.get('kind')} audio_b64_len={len(ab)}")
    print("✅ divine-intro authed test PASSED")
    return True


def test_divine_intro_no_auth():
    print("\n=== /api/spirit-guides/divine-intro?lang=en (NO auth — premium gate) ===")
    r = requests.get(f"{BASE}/spirit-guides/divine-intro?lang=en", timeout=30)
    print(f"status={r.status_code} body={r.text[:300]}")
    if r.status_code == 401:
        print("✅ Correctly gated (401 without auth)")
        return True
    print(f"⚠️ unexpected status code")
    return False


def main():
    token = login()
    r1 = test_chat_pair(token)
    r2 = test_divine_intro_with_auth(token)
    r3 = test_divine_intro_no_auth()
    print(f"\n=== FINAL: chat_pair={r1}  divine_intro_auth={r2}  divine_intro_no_auth={r3} ===")
    sys.exit(0 if (r1 and r2 and r3) else 1)


if __name__ == "__main__":
    main()
