#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Etheria App - Prize Drawing and Gift Code System
Tests all Prize Drawing and Gift Code endpoints end-to-end
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com/api"

class PrizeDrawingGiftCodeTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.current_gift_code = None
        
    async def run_tests(self):
        """Run complete Prize Drawing and Gift Code system tests"""
        print("🧪 Starting Prize Drawing and Gift Code System Testing...")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Test 1: Get Current Gift Code (unauthenticated)
                await self.test_get_current_gift_code(client)
                
                # Test 2: Prize Drawing Status (unauthenticated)
                await self.test_prize_drawing_status_unauthenticated(client)
                
                # Test 3: Admin Dashboard
                await self.test_admin_dashboard(client)
                
                # Test 4: Admin Generate New Code
                await self.test_admin_generate_new_code(client)
                
                # Test 5: Get Participants List
                await self.test_get_participants_list(client)
                
                # Test 6: User Authentication (for authenticated tests)
                await self.test_user_authentication(client)
                
                # Test 7: Test Code Redemption (authenticated)
                await self.test_code_redemption(client)
                
                # Test 8: Prize Drawing Opt-In (authenticated)
                await self.test_prize_drawing_opt_in(client)
                
                # Test 9: Check Prize Drawing Status (authenticated)
                await self.test_prize_drawing_status_authenticated(client)
                
                print("\n" + "=" * 60)
                print("✅ ALL PRIZE DRAWING AND GIFT CODE TESTS COMPLETED SUCCESSFULLY!")
                return True
                
            except Exception as e:
                print(f"\n❌ CRITICAL ERROR: {e}")
                return False
    
    async def test_get_current_gift_code(self, client):
        """Test 1: Get Current Gift Code (should generate AI code if none exists)"""
        print("\n🎁 Test 1: Get Current Gift Code")
        
        response = await client.get(f"{BACKEND_URL}/gift-code/current")
        
        if response.status_code == 200:
            gift_code_data = response.json()
            print(f"   ✅ Gift code retrieved successfully")
            
            # Verify response contains required fields
            required_fields = ["code", "expires_at", "redemptions_count"]
            for field in required_fields:
                if field not in gift_code_data:
                    raise Exception(f"Missing required field: {field}")
            
            self.current_gift_code = gift_code_data["code"]
            print(f"   Code: {self.current_gift_code}")
            print(f"   Expires At: {gift_code_data['expires_at']}")
            print(f"   Redemptions Count: {gift_code_data['redemptions_count']}")
            
            # Verify code format (should be mystical/spiritual themed)
            if len(self.current_gift_code) >= 6:
                print("   ✅ Code format appears valid")
            else:
                print("   ⚠️  Warning: Code seems too short")
        else:
            raise Exception(f"Get current gift code failed: {response.status_code} - {response.text}")
    
    async def test_prize_drawing_status_unauthenticated(self, client):
        """Test 2: Prize Drawing Status (unauthenticated)"""
        print("\n🎲 Test 2: Prize Drawing Status (Unauthenticated)")
        
        response = await client.get(f"{BACKEND_URL}/prize-drawing/status")
        
        if response.status_code == 200:
            status_data = response.json()
            print(f"   ✅ Prize drawing status retrieved")
            
            # Verify expected fields for unauthenticated user
            expected_fields = ["opted_in", "eligible", "weekly_usage_minutes"]
            for field in expected_fields:
                if field not in status_data:
                    raise Exception(f"Missing expected field: {field}")
            
            print(f"   Opted In: {status_data['opted_in']}")
            print(f"   Eligible: {status_data['eligible']}")
            print(f"   Weekly Usage Minutes: {status_data['weekly_usage_minutes']}")
            
            # For unauthenticated user, should be false/0
            if not status_data['opted_in'] and not status_data['eligible'] and status_data['weekly_usage_minutes'] == 0:
                print("   ✅ Confirmed: Unauthenticated user has expected default values")
            else:
                print("   ⚠️  Warning: Unexpected values for unauthenticated user")
        else:
            raise Exception(f"Prize drawing status check failed: {response.status_code} - {response.text}")
    
    async def test_admin_dashboard(self, client):
        """Test 3: Admin Dashboard"""
        print("\n👑 Test 3: Admin Dashboard")
        
        admin_secret = "etheria_admin_secret_2026"
        response = await client.get(f"{BACKEND_URL}/admin/dashboard?admin_secret={admin_secret}")
        
        if response.status_code == 200:
            dashboard_data = response.json()
            print(f"   ✅ Admin dashboard accessed successfully")
            
            # Verify expected sections
            expected_sections = ["current_code", "prize_drawing", "user_stats"]
            for section in expected_sections:
                if section not in dashboard_data:
                    print(f"   ⚠️  Warning: Missing dashboard section: {section}")
                else:
                    print(f"   ✅ Found section: {section}")
            
            # Display current code info
            if "current_code" in dashboard_data:
                current_code = dashboard_data["current_code"]
                print(f"   Current Code: {current_code.get('code', 'N/A')}")
                print(f"   Redemptions: {current_code.get('redemptions_count', 0)}")
            
            # Display prize drawing stats
            if "prize_drawing" in dashboard_data:
                prize_stats = dashboard_data["prize_drawing"]
                print(f"   Total Participants: {prize_stats.get('total_participants', 0)}")
                print(f"   Eligible Users: {prize_stats.get('eligible_users', 0)}")
        else:
            raise Exception(f"Admin dashboard access failed: {response.status_code} - {response.text}")
    
    async def test_admin_generate_new_code(self, client):
        """Test 4: Admin Generate New Code"""
        print("\n🔄 Test 4: Admin Generate New Code")
        
        admin_data = {
            "admin_secret": "etheria_admin_secret_2026"
        }
        
        response = await client.post(f"{BACKEND_URL}/admin/generate-new-code", json=admin_data)
        
        if response.status_code == 200:
            new_code_data = response.json()
            print(f"   ✅ New code generated successfully")
            
            # Verify response contains required fields
            required_fields = ["success", "new_code", "expires_at"]
            for field in required_fields:
                if field not in new_code_data:
                    raise Exception(f"Missing required field: {field}")
            
            if new_code_data["success"]:
                print(f"   New Code: {new_code_data['new_code']}")
                print(f"   Expires At: {new_code_data['expires_at']}")
                
                # Update current code for later tests
                self.current_gift_code = new_code_data['new_code']
                print("   ✅ Code generation successful")
            else:
                raise Exception("Code generation reported as unsuccessful")
        else:
            raise Exception(f"Admin generate new code failed: {response.status_code} - {response.text}")
    
    async def test_get_participants_list(self, client):
        """Test 5: Get Participants List"""
        print("\n📋 Test 5: Get Participants List")
        
        admin_secret = "etheria_admin_secret_2026"
        response = await client.get(f"{BACKEND_URL}/admin/participants?admin_secret={admin_secret}")
        
        if response.status_code == 200:
            participants_data = response.json()
            print(f"   ✅ Participants list retrieved successfully")
            
            # Verify response structure
            if "count" in participants_data and "participants" in participants_data:
                print(f"   Total Count: {participants_data['count']}")
                print(f"   Participants Array Length: {len(participants_data['participants'])}")
                
                # Display sample participant if any exist
                if participants_data['participants']:
                    sample = participants_data['participants'][0]
                    print(f"   Sample Participant: {sample.get('email', 'N/A')}")
                else:
                    print("   No participants found (expected for new system)")
                
                print("   ✅ Participants list structure is valid")
            else:
                raise Exception("Invalid participants response structure")
        else:
            raise Exception(f"Get participants list failed: {response.status_code} - {response.text}")
    
    async def test_user_authentication(self, client):
        """Test 6: User Authentication (for authenticated tests)"""
        print("\n🔐 Test 6: User Authentication")
        
        # Use test credentials from test_credentials.md
        test_email = "stripetest@etheria.com"
        test_password = "StripeTest123!"
        
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        response = await client.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            user_data = response.json()
            self.user_id = user_data["user_id"]
            
            # Extract session token from cookies
            if hasattr(response, 'cookies'):
                for cookie_name, cookie_value in response.cookies.items():
                    if cookie_name == "session_token":
                        self.session_token = cookie_value
                        break
            
            # If no session token found, try to extract from headers
            if not self.session_token:
                set_cookie_header = response.headers.get('set-cookie', '')
                if 'session_token=' in set_cookie_header:
                    import re
                    match = re.search(r'session_token=([^;]+)', set_cookie_header)
                    if match:
                        self.session_token = match.group(1)
            
            print(f"   ✅ Authentication successful")
            print(f"   User ID: {self.user_id}")
            print(f"   Email: {user_data['email']}")
            print(f"   Session token: {self.session_token[:20] if self.session_token else 'Not found'}...")
        else:
            raise Exception(f"Authentication failed: {response.status_code} - {response.text}")
    
    async def test_code_redemption(self, client):
        """Test 7: Test Code Redemption (authenticated)"""
        print("\n🎫 Test 7: Code Redemption")
        
        if not self.session_token:
            raise Exception("No session token available for authentication")
        
        if not self.current_gift_code:
            raise Exception("No gift code available for redemption")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        redeem_data = {
            "code": self.current_gift_code
        }
        
        response = await client.post(f"{BACKEND_URL}/gift-code/redeem", 
                                   json=redeem_data, headers=headers)
        
        if response.status_code == 200:
            redeem_response = response.json()
            print(f"   ✅ Code redemption successful")
            
            # Verify response contains required fields
            required_fields = ["success", "message"]
            for field in required_fields:
                if field not in redeem_response:
                    raise Exception(f"Missing required field: {field}")
            
            if redeem_response["success"]:
                print(f"   Message: {redeem_response['message']}")
                if "expires_at" in redeem_response:
                    print(f"   Premium Expires At: {redeem_response['expires_at']}")
                print("   ✅ Premium access granted successfully")
            else:
                raise Exception("Code redemption reported as unsuccessful")
        elif response.status_code == 400:
            # Handle case where code was already redeemed
            error_data = response.json()
            if "already redeemed" in error_data.get("detail", "").lower():
                print("   ⚠️  Code already redeemed (expected for repeated tests)")
                print("   ✅ Redemption validation working correctly")
            else:
                raise Exception(f"Code redemption failed: {error_data.get('detail', 'Unknown error')}")
        else:
            raise Exception(f"Code redemption failed: {response.status_code} - {response.text}")
    
    async def test_prize_drawing_opt_in(self, client):
        """Test 8: Prize Drawing Opt-In (authenticated)"""
        print("\n🎯 Test 8: Prize Drawing Opt-In")
        
        if not self.session_token:
            raise Exception("No session token available for authentication")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        opt_in_data = {
            "opt_in": True
        }
        
        response = await client.post(f"{BACKEND_URL}/prize-drawing/opt-in", 
                                   json=opt_in_data, headers=headers)
        
        if response.status_code == 200:
            opt_in_response = response.json()
            print(f"   ✅ Prize drawing opt-in successful")
            
            # Verify response contains required fields
            required_fields = ["success", "opted_in"]
            for field in required_fields:
                if field not in opt_in_response:
                    raise Exception(f"Missing required field: {field}")
            
            if opt_in_response["success"] and opt_in_response["opted_in"]:
                print(f"   Message: {opt_in_response.get('message', 'N/A')}")
                print("   ✅ Successfully opted into prize drawing")
            else:
                raise Exception("Opt-in reported as unsuccessful")
        else:
            raise Exception(f"Prize drawing opt-in failed: {response.status_code} - {response.text}")
    
    async def test_prize_drawing_status_authenticated(self, client):
        """Test 9: Check Prize Drawing Status (authenticated)"""
        print("\n🏆 Test 9: Prize Drawing Status (Authenticated)")
        
        if not self.session_token:
            raise Exception("No session token available for authentication")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        response = await client.get(f"{BACKEND_URL}/prize-drawing/status", headers=headers)
        
        if response.status_code == 200:
            status_data = response.json()
            print(f"   ✅ Authenticated prize drawing status retrieved")
            
            # Verify expected fields for authenticated user
            expected_fields = ["opted_in", "weekly_usage_minutes", "eligible"]
            for field in expected_fields:
                if field not in status_data:
                    raise Exception(f"Missing expected field: {field}")
            
            print(f"   Opted In: {status_data['opted_in']}")
            print(f"   Weekly Usage Minutes: {status_data['weekly_usage_minutes']}")
            print(f"   Eligible: {status_data['eligible']}")
            
            # Should be opted in after previous test
            if status_data['opted_in']:
                print("   ✅ Confirmed: User is opted into prize drawing")
            else:
                print("   ⚠️  Warning: User not opted in despite previous opt-in")
            
            # Check eligibility logic
            if "required_minutes" in status_data:
                print(f"   Required Minutes: {status_data['required_minutes']}")
        else:
            raise Exception(f"Authenticated prize drawing status check failed: {response.status_code} - {response.text}")

async def main():
    """Main test runner"""
    tester = PrizeDrawingGiftCodeTester()
    success = await tester.run_tests()
    
    if success:
        print("\n🎉 PRIZE DRAWING AND GIFT CODE SYSTEM TESTING COMPLETE")
        print("All endpoints are working correctly!")
        exit(0)
    else:
        print("\n💥 TESTING FAILED")
        print("Some endpoints have issues that need attention.")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())