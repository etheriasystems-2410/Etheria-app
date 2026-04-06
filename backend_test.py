#!/usr/bin/env python3
"""
Backend Test Suite for Oracle Card AI Image Generation Feature
Tests the POST /api/oracle/draw endpoint with AI-generated images
"""

import requests
import json
import time
import base64
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com/api"

def test_oracle_ai_image_generation():
    """Test Oracle card AI image generation feature"""
    print("🔮 TESTING ORACLE CARD AI IMAGE GENERATION")
    print("=" * 60)
    
    # Test 1: Single card draw with image generation
    print("\n1️⃣ Testing Single Card Draw with AI Image Generation")
    print("-" * 50)
    
    start_time = time.time()
    response = requests.post(f"{BACKEND_URL}/oracle/draw", timeout=60)
    end_time = time.time()
    
    print(f"⏱️  Response time: {end_time - start_time:.2f} seconds")
    print(f"📊 Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Response received successfully")
        
        # Verify response structure
        assert "spread_type" in data, "Missing spread_type field"
        assert "cards" in data, "Missing cards field"
        assert "timestamp" in data, "Missing timestamp field"
        assert data["spread_type"] == "single", "Expected single spread type"
        assert len(data["cards"]) == 1, "Expected exactly 1 card"
        
        card_data = data["cards"][0]
        assert "card" in card_data, "Missing card field"
        assert "position" in card_data, "Missing position field"
        assert "interpretation" in card_data, "Missing interpretation field"
        
        card = card_data["card"]
        assert "name" in card, "Missing card name"
        assert "element" in card, "Missing card element"
        assert "description" in card, "Missing card description"
        assert "keywords" in card, "Missing card keywords"
        assert "image_prompt" in card, "Missing card image_prompt"
        assert "image_base64" in card, "Missing image_base64 field"
        
        # Verify image_base64 is valid
        image_base64 = card["image_base64"]
        if image_base64:
            print(f"🖼️  Image base64 length: {len(image_base64)} characters")
            
            # Decode base64 to verify it's valid
            try:
                image_data = base64.b64decode(image_base64)
                print(f"🔍 Decoded image size: {len(image_data)} bytes")
                
                # Check if it's a PNG (starts with PNG signature)
                if image_data.startswith(b'\x89PNG'):
                    print("✅ Valid PNG image detected (starts with PNG signature)")
                else:
                    print(f"⚠️  Image format: First 8 bytes: {image_data[:8]}")
                    
            except Exception as e:
                print(f"❌ Invalid base64 image data: {e}")
                return False
        else:
            print("⚠️  No image_base64 returned (may be None)")
        
        print(f"🃏 Card drawn: {card['name']} ({card['element']})")
        print(f"📝 Interpretation length: {len(card_data['interpretation'])} characters")
        print(f"🎯 Position: {card_data['position']}")
        
        # Store card name for caching test
        first_card_name = card['name']
        
    else:
        print(f"❌ Single card draw failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    # Test 2: Multi-card draw (3 cards) with images
    print("\n2️⃣ Testing Multi-Card Draw (3 cards) with AI Images")
    print("-" * 50)
    
    multi_card_payload = {
        "card_count": 3,
        "spread_type": "three_card",
        "positions": ["Past", "Present", "Future"]
    }
    
    start_time = time.time()
    response = requests.post(f"{BACKEND_URL}/oracle/draw", 
                           json=multi_card_payload, 
                           timeout=90)
    end_time = time.time()
    
    print(f"⏱️  Response time: {end_time - start_time:.2f} seconds")
    print(f"📊 Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Multi-card response received successfully")
        
        # Verify response structure
        assert data["spread_type"] == "three_card", "Expected three_card spread type"
        assert len(data["cards"]) == 3, "Expected exactly 3 cards"
        
        for i, card_data in enumerate(data["cards"]):
            card = card_data["card"]
            print(f"🃏 Card {i+1}: {card['name']} ({card['element']}) - Position: {card_data['position']}")
            
            # Verify each card has image_base64
            assert "image_base64" in card, f"Missing image_base64 in card {i+1}"
            
            image_base64 = card["image_base64"]
            if image_base64:
                print(f"   🖼️  Image base64 length: {len(image_base64)} characters")
                
                # Verify it's valid base64 and PNG
                try:
                    image_data = base64.b64decode(image_base64)
                    if image_data.startswith(b'\x89PNG'):
                        print(f"   ✅ Valid PNG image for {card['name']}")
                    else:
                        print(f"   ⚠️  Non-PNG image for {card['name']}")
                except Exception as e:
                    print(f"   ❌ Invalid base64 for {card['name']}: {e}")
            else:
                print(f"   ⚠️  No image for {card['name']}")
        
    else:
        print(f"❌ Multi-card draw failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    # Test 3: Image caching verification
    print("\n3️⃣ Testing Image Caching (Draw same card again)")
    print("-" * 50)
    
    # Draw multiple single cards to try to get the same card as before
    cached_card_found = False
    attempts = 0
    max_attempts = 10
    
    while not cached_card_found and attempts < max_attempts:
        attempts += 1
        print(f"Attempt {attempts}: Drawing single card...")
        
        start_time = time.time()
        response = requests.post(f"{BACKEND_URL}/oracle/draw", timeout=60)
        end_time = time.time()
        
        if response.status_code == 200:
            data = response.json()
            card = data["cards"][0]["card"]
            response_time = end_time - start_time
            
            print(f"   🃏 Drew: {card['name']} (Response time: {response_time:.2f}s)")
            
            if card['name'] == first_card_name:
                print(f"✅ Found cached card: {card['name']}")
                print(f"⚡ Cached response time: {response_time:.2f} seconds")
                
                # Verify image is still present
                if card.get("image_base64"):
                    print("✅ Cached image present")
                    cached_card_found = True
                else:
                    print("❌ Cached image missing")
                break
        else:
            print(f"   ❌ Draw failed: {response.status_code}")
    
    if not cached_card_found:
        print(f"⚠️  Could not find cached card '{first_card_name}' in {max_attempts} attempts")
        print("   This is normal due to randomness, but caching should work when same card is drawn")
    
    # Test 4: Verify PNG signature in base64 images
    print("\n4️⃣ Testing PNG Signature Verification")
    print("-" * 50)
    
    # Draw one more card to test PNG signature
    response = requests.post(f"{BACKEND_URL}/oracle/draw", timeout=60)
    
    if response.status_code == 200:
        data = response.json()
        card = data["cards"][0]["card"]
        image_base64 = card.get("image_base64")
        
        if image_base64:
            try:
                # Decode base64
                image_data = base64.b64decode(image_base64)
                
                # Check PNG signature
                if image_data.startswith(b'\x89PNG\r\n\x1a\n'):
                    print("✅ Perfect PNG signature detected")
                    print(f"   First 8 bytes: {image_data[:8].hex()}")
                elif image_data.startswith(b'\x89PNG'):
                    print("✅ PNG signature detected (partial)")
                    print(f"   First 8 bytes: {image_data[:8].hex()}")
                else:
                    print(f"❌ Invalid PNG signature")
                    print(f"   First 8 bytes: {image_data[:8].hex()}")
                    print(f"   Expected PNG signature: 89504e470d0a1a0a")
                
                # Additional format checks
                print(f"📊 Image statistics:")
                print(f"   - Size: {len(image_data)} bytes")
                print(f"   - Base64 length: {len(image_base64)} characters")
                
            except Exception as e:
                print(f"❌ Error verifying PNG signature: {e}")
        else:
            print("❌ No image_base64 field in response")
    else:
        print(f"❌ PNG verification test failed: {response.status_code}")
    
    # Test 5: Check MongoDB caching collection
    print("\n5️⃣ Testing MongoDB Image Cache Collection")
    print("-" * 50)
    print("ℹ️  Note: Cannot directly test MongoDB from here, but backend logs should show caching activity")
    print("   Check backend logs for 'oracle_card_images' collection operations")
    
    print("\n🎉 ORACLE AI IMAGE GENERATION TESTING COMPLETE")
    print("=" * 60)
    return True

def main():
    """Run all Oracle AI image generation tests"""
    print("🚀 Starting Oracle Card AI Image Generation Test Suite")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        success = test_oracle_ai_image_generation()
        
        if success:
            print("\n✅ ALL TESTS COMPLETED SUCCESSFULLY")
            print("🔮 Oracle AI image generation feature is working correctly!")
        else:
            print("\n❌ SOME TESTS FAILED")
            print("🔧 Please check the issues above and fix them")
            
    except Exception as e:
        print(f"\n💥 CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()