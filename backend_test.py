#!/usr/bin/env python3
"""
Backend API Testing Script for Etheria Admin Panel
Tests the admin panel endpoints as requested in the review.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

class AdminPanelTester:
    def __init__(self):
        self.session = None
        self.admin_token = None
        self.test_results = []
        
    async def setup(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    def log_result(self, test_name, success, details):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
    async def test_admin_login(self):
        """Test admin login and get session token"""
        try:
            login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            async with self.session.post(f"{BACKEND_URL}/auth/login", json=login_data) as response:
                if response.status == 200:
                    data = await response.json()
                    self.admin_token = data.get("session_token")
                    is_admin = data.get("is_admin", False)
                    
                    if self.admin_token and is_admin:
                        self.log_result("Admin Login", True, f"Token: {self.admin_token[:20]}..., is_admin: {is_admin}")
                        return True
                    else:
                        self.log_result("Admin Login", False, f"Missing token or admin status. Token: {bool(self.admin_token)}, is_admin: {is_admin}")
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Admin Login", False, f"HTTP {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}")
            return False
            
    async def test_all_users_endpoint(self):
        """Test GET /api/community/admin/all-users endpoint"""
        if not self.admin_token:
            self.log_result("All Users Endpoint", False, "No admin token available")
            return False
            
        try:
            # Community routes expect token as query parameter, not Authorization header
            async with self.session.get(f"{BACKEND_URL}/community/admin/all-users?token={self.admin_token}") as response:
                if response.status == 200:
                    data = await response.json()
                    users = data.get("users", [])
                    total = data.get("total", 0)
                    
                    # Check if users are sorted by created_at descending (newest first)
                    sorted_correctly = True
                    if len(users) > 1:
                        for i in range(len(users) - 1):
                            current_date = users[i].get("created_at")
                            next_date = users[i + 1].get("created_at")
                            if current_date and next_date and current_date < next_date:
                                sorted_correctly = False
                                break
                    
                    # Check response format
                    required_fields = ["id", "user_id", "email", "name", "is_admin", "is_premium", "account_status", "flag_count", "created_at"]
                    format_correct = True
                    missing_fields = []
                    
                    if users:
                        first_user = users[0]
                        for field in required_fields:
                            if field not in first_user:
                                format_correct = False
                                missing_fields.append(field)
                    
                    success = format_correct and sorted_correctly
                    details = f"Found {len(users)} users, total: {total}, sorted correctly: {sorted_correctly}, format correct: {format_correct}"
                    if missing_fields:
                        details += f", missing fields: {missing_fields}"
                    
                    self.log_result("All Users Endpoint", success, details)
                    return success
                    
                else:
                    error_text = await response.text()
                    self.log_result("All Users Endpoint", False, f"HTTP {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            self.log_result("All Users Endpoint", False, f"Exception: {str(e)}")
            return False
            
    async def test_setup_owner_endpoint(self):
        """Test POST /api/admin/setup-owner endpoint"""
        if not self.admin_token:
            self.log_result("Setup Owner Endpoint", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            setup_data = {
                "email": ADMIN_EMAIL,
                "admin_secret": "etheria_admin_secret_2026"
            }
            
            async with self.session.post(f"{BACKEND_URL}/admin/setup-owner", json=setup_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    success = data.get("success", False)
                    message = data.get("message", "")
                    
                    self.log_result("Setup Owner Endpoint", success, f"Message: {message}")
                    return success
                    
                elif response.status == 400:
                    # This might be expected if already setup
                    error_data = await response.json()
                    message = error_data.get("detail", "")
                    if "already" in message.lower():
                        self.log_result("Setup Owner Endpoint", True, f"Already setup: {message}")
                        return True
                    else:
                        self.log_result("Setup Owner Endpoint", False, f"HTTP 400: {message}")
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Setup Owner Endpoint", False, f"HTTP {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            self.log_result("Setup Owner Endpoint", False, f"Exception: {str(e)}")
            return False
            
    async def test_authentication_methods(self):
        """Test different authentication methods to understand the issue"""
        if not self.admin_token:
            self.log_result("Authentication Methods Test", False, "No admin token available")
            return False
            
        try:
            # Test 1: Authorization header (Bearer token)
            headers_bearer = {"Authorization": f"Bearer {self.admin_token}"}
            
            async with self.session.get(f"{BACKEND_URL}/community/admin/all-users", headers=headers_bearer) as response:
                bearer_success = response.status == 200
                bearer_error = await response.text() if response.status != 200 else "Success"
            
            # Test 2: Query parameter
            async with self.session.get(f"{BACKEND_URL}/community/admin/all-users?token={self.admin_token}") as response:
                query_success = response.status == 200
                query_error = await response.text() if response.status != 200 else "Success"
            
            # Test 3: Check what the token looks like
            token_info = f"Token starts with: {self.admin_token[:20]}..., length: {len(self.admin_token)}"
            
            details = f"Bearer auth: {bearer_success} ({bearer_error[:100]}), Query param: {query_success} ({query_error[:100]}), {token_info}"
            
            self.log_result("Authentication Methods Test", bearer_success or query_success, details)
            return bearer_success or query_success
            
        except Exception as e:
            self.log_result("Authentication Methods Test", False, f"Exception: {str(e)}")
            return False
            
    async def run_all_tests(self):
        """Run all admin panel tests"""
        print("🔧 ADMIN PANEL ENDPOINTS TESTING")
        print("=" * 50)
        
        await self.setup()
        
        try:
            # Test 1: Admin login
            login_success = await self.test_admin_login()
            
            if login_success:
                # Test 2: Authentication methods analysis
                await self.test_authentication_methods()
                
                # Test 3: All users endpoint
                await self.test_all_users_endpoint()
                
                # Test 4: Setup owner endpoint
                await self.test_setup_owner_endpoint()
            else:
                print("❌ Cannot proceed with other tests - admin login failed")
                
        finally:
            await self.cleanup()
            
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            
        print(f"\nResults: {passed}/{total} tests passed")
        
        if passed < total:
            print("\n🔍 FAILED TESTS ANALYSIS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}: {result['details']}")
                    
        return passed == total

async def main():
    """Main test runner"""
    tester = AdminPanelTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n🎉 All admin panel tests passed!")
        sys.exit(0)
    else:
        print("\n⚠️  Some admin panel tests failed - see details above")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())