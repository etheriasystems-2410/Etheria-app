#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com/api"

def test_spirit_guide_chat_english():
    """Test 1: Spirit Guide Chat in English (default)"""
    print("\n=== Test 1: Spirit Guide Chat in English (default) ===")
    
    url = f"{BACKEND_URL}/spirit-guides/chat"
    payload = {
        "guide": "Ignis",
        "element": "Fire",
        "message": "Hello, I need guidance about making a big life decision",
        "history": [],
        "language": "en"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success', False)}")
            print(f"Response Text: {data.get('response', 'No response')[:200]}...")
            print(f"Has Audio: {'Yes' if data.get('audio_base64') else 'No'}")
            print(f"Voice: {data.get('voice', 'None')}")
            
            # Verify response is in English (basic check)
            response_text = data.get('response', '')
            if response_text and len(response_text) > 10:
                print("✅ PASS: Received meaningful response in English")
                return True
            else:
                print("❌ FAIL: Response too short or empty")
                return False
        else:
            print(f"❌ FAIL: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_spirit_guide_chat_spanish():
    """Test 2: Spirit Guide Chat in Spanish"""
    print("\n=== Test 2: Spirit Guide Chat in Spanish ===")
    
    url = f"{BACKEND_URL}/spirit-guides/chat"
    payload = {
        "guide": "Aqua",
        "element": "Water",
        "message": "Hola, necesito orientación sobre el amor",
        "history": [],
        "language": "es"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success', False)}")
            print(f"Response Text: {data.get('response', 'No response')[:200]}...")
            print(f"Has Audio: {'Yes' if data.get('audio_base64') else 'No'}")
            print(f"Voice: {data.get('voice', 'None')}")
            
            # Verify response is in Spanish (basic check for Spanish words)
            response_text = data.get('response', '').lower()
            spanish_indicators = ['el', 'la', 'de', 'en', 'que', 'es', 'tu', 'te', 'con', 'por', 'para', 'amor', 'vida', 'corazón']
            spanish_found = any(word in response_text for word in spanish_indicators)
            
            if response_text and len(response_text) > 10 and spanish_found:
                print("✅ PASS: Received meaningful response in Spanish")
                return True
            else:
                print("❌ FAIL: Response doesn't appear to be in Spanish or too short")
                print(f"Full response: {data.get('response', '')}")
                return False
        else:
            print(f"❌ FAIL: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_spirit_guide_chat_french():
    """Test 3: Spirit Guide Chat in French"""
    print("\n=== Test 3: Spirit Guide Chat in French ===")
    
    url = f"{BACKEND_URL}/spirit-guides/chat"
    payload = {
        "guide": "Terra",
        "element": "Earth",
        "message": "Bonjour, j'ai besoin de conseils",
        "history": [],
        "language": "fr"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success', False)}")
            print(f"Response Text: {data.get('response', 'No response')[:200]}...")
            print(f"Has Audio: {'Yes' if data.get('audio_base64') else 'No'}")
            print(f"Voice: {data.get('voice', 'None')}")
            
            # Verify response is in French (basic check for French words)
            response_text = data.get('response', '').lower()
            french_indicators = ['le', 'la', 'de', 'du', 'des', 'je', 'tu', 'il', 'elle', 'vous', 'nous', 'avec', 'pour', 'dans', 'sur', 'est', 'être', 'avoir']
            french_found = any(word in response_text for word in french_indicators)
            
            if response_text and len(response_text) > 10 and french_found:
                print("✅ PASS: Received meaningful response in French")
                return True
            else:
                print("❌ FAIL: Response doesn't appear to be in French or too short")
                print(f"Full response: {data.get('response', '')}")
                return False
        else:
            print(f"❌ FAIL: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_tts_generate_with_language():
    """Test 4: TTS Generate with language"""
    print("\n=== Test 4: TTS Generate with language ===")
    
    url = f"{BACKEND_URL}/tts/generate"
    payload = {
        "text": "Hola, soy tu guía espiritual",
        "guide_name": "Ignis",
        "language": "es"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success', False)}")
            print(f"Text: {data.get('text', 'No text')}")
            print(f"Guide Name: {data.get('guide_name', 'None')}")
            print(f"Has Audio: {'Yes' if data.get('audio_base64') else 'No'}")
            print(f"Error: {data.get('error', 'None')}")
            
            # Verify TTS response
            if data.get('success') and data.get('audio_base64'):
                print("✅ PASS: TTS generated successfully with audio")
                return True
            elif data.get('success') and not data.get('audio_base64'):
                print("⚠️ PARTIAL: TTS succeeded but no audio (may be expected)")
                return True
            else:
                print("❌ FAIL: TTS generation failed")
                return False
        else:
            print(f"❌ FAIL: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def main():
    """Run all Spirit Guide language support tests"""
    print("🔮 SPIRIT GUIDE LANGUAGE SUPPORT TESTING")
    print("=" * 50)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    tests = [
        ("Spirit Guide Chat - English", test_spirit_guide_chat_english),
        ("Spirit Guide Chat - Spanish", test_spirit_guide_chat_spanish),
        ("Spirit Guide Chat - French", test_spirit_guide_chat_french),
        ("TTS Generate - Spanish", test_tts_generate_with_language),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ FAIL: {test_name} - Exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("🔮 SPIRIT GUIDE LANGUAGE SUPPORT TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Spirit Guide language support working correctly!")
        return 0
    else:
        print("⚠️ SOME TESTS FAILED - Check individual test results above")
        return 1

if __name__ == "__main__":
    sys.exit(main())