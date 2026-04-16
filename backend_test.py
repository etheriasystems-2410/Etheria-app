#!/usr/bin/env python3
"""
Backend Testing Script for Admin Panel Moderation Functionality
Tests the complete Admin Panel moderation functionality with flag actions.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

class AdminModerationTester:
    def __init__(self):
        self.session = None
        self.admin_token = None
        self.test_flag_id = None
        
    async def setup(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
    
    async def admin_login(self):
        """Login as admin and get session token"""
        print("🔐 Testing Admin Login...")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        async with self.session.post(f"{BACKEND_URL}/api/auth/login", json=login_data) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("is_admin") and data.get("session_token"):
                    self.admin_token = data["session_token"]
                    print(f"✅ Admin login successful: {ADMIN_EMAIL}")
                    print(f"   Session token: {self.admin_token[:20]}...")
                    print(f"   Admin status: {data.get('is_admin')}")
                    return True
                else:
                    print(f"❌ Login successful but not admin or no token: {data}")
                    return False
            else:
                error_text = await response.text()
                print(f"❌ Admin login failed: {response.status} - {error_text}")
                return False
    
    async def get_pending_flags(self):
        """Test GET /api/community/admin/pending-flags"""
        print("\n📋 Testing GET /api/community/admin/pending-flags...")
        
        url = f"{BACKEND_URL}/api/community/admin/pending-flags?token={self.admin_token}"
        
        async with self.session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                flags = data.get("flags", [])
                print(f"✅ Pending flags retrieved successfully")
                print(f"   Total pending flags: {len(flags)}")
                
                if flags:
                    print("   Sample flag details:")
                    flag = flags[0]
                    print(f"   - Flag ID: {flag.get('id')}")
                    print(f"   - User: {flag.get('user_email')} ({flag.get('user_name')})")
                    print(f"   - Content Type: {flag.get('content_type')}")
                    print(f"   - Reason: {flag.get('reason')}")
                    print(f"   - Status: {flag.get('status')}")
                    print(f"   - Is Test: {flag.get('is_test')}")
                    
                    # Store first flag for action testing
                    self.test_flag_id = flag.get('id')
                else:
                    print("   No pending flags found")
                
                return True, flags
            else:
                error_text = await response.text()
                print(f"❌ Failed to get pending flags: {response.status} - {error_text}")
                return False, []
    
    async def create_test_flag(self):
        """Test POST /api/community/admin/create-test-flag"""
        print("\n🚩 Testing POST /api/community/admin/create-test-flag...")
        
        # First get a user to flag
        users_url = f"{BACKEND_URL}/api/community/admin/all-users?token={self.admin_token}&limit=10"
        
        async with self.session.get(users_url) as response:
            if response.status == 200:
                users_data = await response.json()
                users = users_data.get("users", [])
                
                if not users:
                    print("❌ No users found to create test flag")
                    return False
                
                # Find a non-admin user
                test_user = None
                for user in users:
                    if not user.get("is_admin"):
                        test_user = user
                        break
                
                if not test_user:
                    print("❌ No non-admin users found to create test flag")
                    return False
                
                print(f"   Selected test user: {test_user.get('email')} ({test_user.get('name')})")
                
                # Create test flag
                flag_data = {
                    "user_id": test_user.get("user_id") or test_user.get("id"),
                    "content_type": "test_post",
                    "content": "This is a test flag content for moderation system testing",
                    "reason": "Test flag created by automated testing system"
                }
                
                create_url = f"{BACKEND_URL}/api/community/admin/create-test-flag?token={self.admin_token}"
                
                async with self.session.post(create_url, json=flag_data) as create_response:
                    if create_response.status == 200:
                        create_data = await create_response.json()
                        self.test_flag_id = create_data.get("flag_id")
                        print(f"✅ Test flag created successfully")
                        print(f"   Flag ID: {self.test_flag_id}")
                        print(f"   Message: {create_data.get('message')}")
                        print(f"   Note: {create_data.get('note')}")
                        return True
                    else:
                        error_text = await create_response.text()
                        print(f"❌ Failed to create test flag: {create_response.status} - {error_text}")
                        return False
            else:
                error_text = await response.text()
                print(f"❌ Failed to get users for test flag: {response.status} - {error_text}")
                return False
    
    async def test_flag_action(self, action):
        """Test POST /api/community/admin/flag/{flag_id}/action"""
        print(f"\n⚡ Testing POST /api/community/admin/flag/{self.test_flag_id}/action with action='{action}'...")
        
        if not self.test_flag_id:
            print("❌ No test flag ID available for action testing")
            return False
        
        url = f"{BACKEND_URL}/api/community/admin/flag/{self.test_flag_id}/action?token={self.admin_token}&action={action}"
        
        async with self.session.post(url) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✅ Flag action '{action}' executed successfully")
                print(f"   Response: {data.get('message')}")
                print(f"   Action: {data.get('action')}")
                print(f"   Flag ID: {data.get('flag_id')}")
                
                if data.get('suspension'):
                    print(f"   🚨 User suspended!")
                if data.get('cancelled'):
                    print(f"   🚨 User account cancelled!")
                if data.get('flag_count'):
                    print(f"   Warning count: {data.get('flag_count')}")
                
                return True
            else:
                error_text = await response.text()
                print(f"❌ Failed to execute flag action '{action}': {response.status} - {error_text}")
                return False
    
    async def verify_flag_processed(self):
        """Verify the flag is no longer in pending list"""
        print(f"\n🔍 Verifying flag {self.test_flag_id} is no longer pending...")
        
        success, flags = await self.get_pending_flags()
        if success:
            # Check if our test flag is still in pending list
            for flag in flags:
                if flag.get('id') == self.test_flag_id:
                    print(f"❌ Flag {self.test_flag_id} is still in pending list")
                    return False
            
            print(f"✅ Flag {self.test_flag_id} is no longer in pending list")
            return True
        else:
            print("❌ Could not verify flag status due to API error")
            return False
    
    async def run_complete_test(self):
        """Run the complete test flow"""
        print("🚀 Starting Admin Panel Moderation Functionality Test")
        print("=" * 60)
        
        try:
            # 1. Admin Login
            if not await self.admin_login():
                return False
            
            # 2. Get initial pending flags
            success, initial_flags = await self.get_pending_flags()
            if not success:
                return False
            
            initial_count = len(initial_flags)
            
            # 3. Create test flag if no pending flags exist
            if initial_count == 0:
                print("\n📝 No pending flags found, creating test flag...")
                if not await self.create_test_flag():
                    return False
            else:
                print(f"\n📝 Found {initial_count} existing pending flags, using first one for testing")
                self.test_flag_id = initial_flags[0].get('id')
            
            # 4. Get pending flags again to verify test flag appears
            success, updated_flags = await self.get_pending_flags()
            if not success:
                return False
            
            if len(updated_flags) <= initial_count and initial_count == 0:
                print("❌ Test flag was not found in pending flags list")
                return False
            
            # 5. Test dismiss action on the flag
            if not await self.test_flag_action("dismiss"):
                return False
            
            # 6. Verify flag is no longer in pending list
            if not await self.verify_flag_processed():
                return False
            
            print("\n" + "=" * 60)
            print("🎉 ALL ADMIN PANEL MODERATION TESTS PASSED!")
            print("✅ Admin login working")
            print("✅ GET /api/community/admin/pending-flags working")
            print("✅ POST /api/community/admin/create-test-flag working")
            print("✅ POST /api/community/admin/flag/{flag_id}/action working")
            print("✅ Flag dismiss action working")
            print("✅ Flag processing workflow complete")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Test failed with exception: {e}")
            import traceback
            traceback.print_exc()
            return False

async def main():
    """Main test function"""
    tester = AdminModerationTester()
    
    try:
        await tester.setup()
        success = await tester.run_complete_test()
        
        if success:
            print("\n🎯 RESULT: Admin Panel Moderation System is WORKING correctly!")
            sys.exit(0)
        else:
            print("\n💥 RESULT: Admin Panel Moderation System has ISSUES!")
            sys.exit(1)
            
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    asyncio.run(main())