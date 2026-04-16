#!/usr/bin/env python3
"""
Backend API Testing for Etheria Moderation System
Tests the complete moderation system including test flag creation and email processing.
"""

import requests
import json
import sys
import os
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com"

# Test credentials from review request
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

class EtheriaModeratorTester:
    def __init__(self):
        self.session_token = None
        self.base_url = BACKEND_URL
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def test_admin_login(self):
        """Test admin authentication"""
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("is_admin") and data.get("session_token"):
                    self.session_token = data["session_token"]
                    self.log_test(
                        "Admin Login", 
                        True, 
                        f"Admin authenticated successfully, is_admin: {data.get('is_admin')}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Login", 
                        False, 
                        "Login successful but user is not admin or no session token", 
                        data
                    )
                    return False
            else:
                self.log_test(
                    "Admin Login", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_get_all_users(self):
        """Test getting all users to find a test user ID"""
        try:
            response = requests.get(
                f"{self.base_url}/api/community/admin/all-users",
                params={"token": self.session_token},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                if users:
                    # Find a non-admin user for testing
                    test_user = None
                    for user in users:
                        if not user.get("is_admin", False):
                            test_user = user
                            break
                    
                    if test_user:
                        self.test_user_id = test_user.get("id") or test_user.get("user_id")
                        self.log_test(
                            "Get All Users", 
                            True, 
                            f"Found {len(users)} users, selected test user: {test_user.get('email', 'N/A')}"
                        )
                        return True
                    else:
                        self.log_test(
                            "Get All Users", 
                            False, 
                            "No non-admin users found for testing"
                        )
                        return False
                else:
                    self.log_test(
                        "Get All Users", 
                        False, 
                        "No users returned"
                    )
                    return False
            else:
                self.log_test(
                    "Get All Users", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Get All Users", False, f"Exception: {str(e)}")
            return False
    
    def test_create_test_flag(self):
        """Test creating a test flag and sending notification email"""
        try:
            response = requests.post(
                f"{self.base_url}/api/community/admin/create-test-flag",
                params={"token": self.session_token},
                json={
                    "user_id": self.test_user_id,
                    "content_type": "test",
                    "content": "Test content for moderation system verification",
                    "reason": "Testing moderation system email notifications"
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.test_flag_id = data.get("flag_id")
                    self.log_test(
                        "Create Test Flag", 
                        True, 
                        f"Test flag created successfully, flag_id: {self.test_flag_id}"
                    )
                    return True
                else:
                    self.log_test(
                        "Create Test Flag", 
                        False, 
                        "Response indicates failure", 
                        data
                    )
                    return False
            else:
                self.log_test(
                    "Create Test Flag", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Create Test Flag", False, f"Exception: {str(e)}")
            return False
    
    def test_moderation_status(self):
        """Test getting moderation status"""
        try:
            response = requests.get(
                f"{self.base_url}/api/admin/moderation-status",
                headers={"Authorization": f"Bearer {self.session_token}"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["pending_flags", "suspended_users", "cancelled_users"]
                
                if all(field in data for field in required_fields):
                    self.log_test(
                        "Get Moderation Status", 
                        True, 
                        f"Status retrieved: pending_flags={data['pending_flags']}, suspended_users={data['suspended_users']}, cancelled_users={data['cancelled_users']}"
                    )
                    return True
                else:
                    self.log_test(
                        "Get Moderation Status", 
                        False, 
                        f"Missing required fields. Got: {list(data.keys())}", 
                        data
                    )
                    return False
            else:
                self.log_test(
                    "Get Moderation Status", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Get Moderation Status", False, f"Exception: {str(e)}")
            return False
    
    def test_process_moderation_emails(self):
        """Test processing moderation email replies"""
        try:
            response = requests.post(
                f"{self.base_url}/api/admin/process-moderation-emails",
                headers={"Authorization": f"Bearer {self.session_token}"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    processed_count = data.get("details", {}).get("processed", 0)
                    self.log_test(
                        "Process Moderation Emails", 
                        True, 
                        f"Email processing triggered successfully, processed {processed_count} emails"
                    )
                    return True
                else:
                    self.log_test(
                        "Process Moderation Emails", 
                        False, 
                        "Response indicates failure", 
                        data
                    )
                    return False
            else:
                self.log_test(
                    "Process Moderation Emails", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Process Moderation Emails", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all moderation system tests"""
        print("🔧 ETHERIA MODERATION SYSTEM TESTING")
        print("=" * 50)
        print(f"Backend URL: {self.base_url}")
        print(f"Admin Email: {ADMIN_EMAIL}")
        print(f"Test Time: {datetime.now().isoformat()}")
        print()
        
        # Test sequence
        tests = [
            ("Admin Login", self.test_admin_login),
            ("Get All Users", self.test_get_all_users),
            ("Create Test Flag", self.test_create_test_flag),
            ("Get Moderation Status", self.test_moderation_status),
            ("Process Moderation Emails", self.test_process_moderation_emails)
        ]
        
        for test_name, test_func in tests:
            if not test_func():
                print(f"❌ Test sequence stopped at: {test_name}")
                break
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Tests Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Moderation system is working correctly!")
        else:
            print("⚠️  Some tests failed - Check details above")
        
        return passed == total

def main():
    """Main test execution"""
    tester = EtheriaModeratorTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()