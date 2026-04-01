#!/usr/bin/env python3
"""
Focused Stripe Monetization Testing for Etheria Psychic App
Tests all Stripe-related endpoints with proper authentication
"""

import requests
import json
import uuid
from datetime import datetime
import time

# Backend URL from frontend .env
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com/api"

class StripeMonetizationTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = {}
        self.session_token = None
        self.test_user_id = None
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        self.test_results[test_name] = {
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
    
    def test_auth_signup(self):
        """Test POST /api/auth/signup - Create test user"""
        try:
            signup_data = {
                "email": "test@etheria.com",
                "password": "TestPass123!",
                "name": "Test User"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/auth/signup",
                json=signup_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                user_data = response.json()
                required_fields = ["user_id", "email", "name"]
                if all(field in user_data for field in required_fields):
                    self.test_user_id = user_data["user_id"]
                    
                    # Extract session token from cookie
                    if 'Set-Cookie' in response.headers:
                        cookie_header = response.headers['Set-Cookie']
                        if 'session_token=' in cookie_header:
                            start = cookie_header.find('session_token=') + len('session_token=')
                            end = cookie_header.find(';', start)
                            if end == -1:
                                end = len(cookie_header)
                            self.session_token = cookie_header[start:end]
                            
                            # Set session token for future requests
                            self.session.headers.update({"Authorization": f"Bearer {self.session_token}"})
                            
                            self.log_test("Auth Signup", True, f"User created: {user_data['email']}")
                            return True
                    
                    self.log_test("Auth Signup", False, "No session token in response")
                    return False
                else:
                    self.log_test("Auth Signup", False, f"Missing required fields: {user_data}")
                    return False
            elif response.status_code == 400:
                # User might already exist, try login instead
                return self.test_auth_login()
            else:
                self.log_test("Auth Signup", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Auth Signup", False, f"Error: {str(e)}")
            return False
    
    def test_auth_login(self):
        """Test POST /api/auth/login - Login existing user"""
        try:
            login_data = {
                "email": "test@etheria.com",
                "password": "TestPass123!"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                user_data = response.json()
                required_fields = ["user_id", "email", "name"]
                if all(field in user_data for field in required_fields):
                    self.test_user_id = user_data["user_id"]
                    
                    # Extract session token from cookie
                    if 'Set-Cookie' in response.headers:
                        cookie_header = response.headers['Set-Cookie']
                        if 'session_token=' in cookie_header:
                            start = cookie_header.find('session_token=') + len('session_token=')
                            end = cookie_header.find(';', start)
                            if end == -1:
                                end = len(cookie_header)
                            self.session_token = cookie_header[start:end]
                            
                            # Set session token for future requests
                            self.session.headers.update({"Authorization": f"Bearer {self.session_token}"})
                            
                            self.log_test("Auth Login", True, f"User logged in: {user_data['email']}")
                            return True
                    
                    self.log_test("Auth Login", False, "No session token in response")
                    return False
                else:
                    self.log_test("Auth Login", False, f"Missing required fields: {user_data}")
                    return False
            else:
                self.log_test("Auth Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Auth Login", False, f"Error: {str(e)}")
            return False
    
    def test_subscription_plans(self):
        """Test GET /api/subscription/plans"""
        try:
            response = self.session.get(f"{BACKEND_URL}/subscription/plans")
            if response.status_code == 200:
                data = response.json()
                required_fields = ["plans", "free_tier_limits"]
                if all(field in data for field in required_fields):
                    plans = data["plans"]
                    free_limits = data["free_tier_limits"]
                    
                    # Check if premium_monthly plan exists
                    if "premium_monthly" in plans:
                        plan = plans["premium_monthly"]
                        if plan.get("price") == 3.99 and plan.get("currency") == "usd":
                            self.log_test("Subscription Plans", True, f"Plans available: {list(plans.keys())}, Price: ${plan['price']}")
                            return True
                        else:
                            self.log_test("Subscription Plans", False, f"Invalid plan pricing: {plan}")
                            return False
                    else:
                        self.log_test("Subscription Plans", False, "premium_monthly plan not found")
                        return False
                else:
                    self.log_test("Subscription Plans", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Subscription Plans", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Subscription Plans", False, f"Error: {str(e)}")
            return False
    
    def test_subscription_status(self):
        """Test GET /api/subscription/status"""
        try:
            if not self.session_token:
                self.log_test("Subscription Status", False, "No auth token - need to login first")
                return False
            
            response = self.session.get(
                f"{BACKEND_URL}/subscription/status",
                headers={"Authorization": f"Bearer {self.session_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["is_premium", "subscription_status", "features"]
                if all(field in data for field in required_fields):
                    # For a new free user, should be false
                    if data["is_premium"] == False and data["subscription_status"] == "free":
                        self.log_test("Subscription Status", True, f"Free user status: {data['subscription_status']}")
                        return True
                    else:
                        self.log_test("Subscription Status", True, f"Premium user status: {data['subscription_status']}")
                        return True
                else:
                    self.log_test("Subscription Status", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Subscription Status", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Subscription Status", False, f"Error: {str(e)}")
            return False
    
    def test_create_checkout(self):
        """Test POST /api/subscription/create-checkout"""
        try:
            if not self.session_token:
                self.log_test("Create Checkout", False, "No auth token - need to login first")
                return None
            
            checkout_data = {
                "plan_id": "premium_monthly",
                "origin_url": "http://localhost:3000"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/subscription/create-checkout",
                json=checkout_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.session_token}"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["checkout_url", "session_id"]
                if all(field in data for field in required_fields):
                    # Validate URL format
                    if data["checkout_url"].startswith("https://checkout.stripe.com"):
                        self.log_test("Create Checkout", True, f"Checkout session created: {data['session_id']}")
                        return data["session_id"]
                    else:
                        self.log_test("Create Checkout", False, f"Invalid checkout URL: {data['checkout_url']}")
                        return None
                else:
                    self.log_test("Create Checkout", False, f"Missing required fields: {data}")
                    return None
            else:
                self.log_test("Create Checkout", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("Create Checkout", False, f"Error: {str(e)}")
            return None
    
    def test_checkout_status(self, session_id=None):
        """Test GET /api/subscription/checkout-status/{session_id}"""
        try:
            # Use fake session_id to test 404 response
            test_session_id = session_id or "fake_session_id_12345"
            
            response = self.session.get(f"{BACKEND_URL}/subscription/checkout-status/{test_session_id}")
            
            if response.status_code == 404:
                self.log_test("Checkout Status", True, "Correctly returned 404 for fake session_id")
                return True
            elif response.status_code == 200:
                data = response.json()
                if "status" in data and "payment_status" in data:
                    self.log_test("Checkout Status", True, f"Session status: {data['status']}, Payment: {data['payment_status']}")
                    return True
                else:
                    self.log_test("Checkout Status", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Checkout Status", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Checkout Status", False, f"Error: {str(e)}")
            return False
    
    def test_feature_access(self):
        """Test GET /api/user/feature-access/{feature}"""
        try:
            if not self.session_token:
                self.log_test("Feature Access", False, "No auth token - need to login first")
                return False
            
            # Test spirit_guides feature for free user
            response = self.session.get(
                f"{BACKEND_URL}/user/feature-access/spirit_guides",
                headers={"Authorization": f"Bearer {self.session_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["feature", "has_access", "upgrade_required"]
                if all(field in data for field in required_fields):
                    # For free user, should require upgrade for spirit_guides
                    if data["feature"] == "spirit_guides" and data["upgrade_required"] == True:
                        self.log_test("Feature Access", True, f"Free user correctly requires upgrade for {data['feature']}")
                        return True
                    else:
                        self.log_test("Feature Access", True, f"Feature access: {data['feature']}, Has access: {data['has_access']}")
                        return True
                else:
                    self.log_test("Feature Access", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Feature Access", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Feature Access", False, f"Error: {str(e)}")
            return False
    
    def run_stripe_tests(self):
        """Run all Stripe monetization tests"""
        print("💳 Starting Stripe Monetization Testing for Etheria App")
        print("=" * 60)
        
        # Authentication tests (required for Stripe tests)
        print("\n🔐 AUTHENTICATION TESTS")
        print("-" * 30)
        auth_success = self.test_auth_signup()
        if not auth_success:
            print("❌ Authentication failed - some tests will be skipped")
        
        print("\n💰 STRIPE MONETIZATION TESTS")
        print("-" * 30)
        
        # Stripe monetization tests
        self.test_subscription_plans()
        self.test_subscription_status()
        
        # Create checkout session
        session_id = self.test_create_checkout()
        
        # Test checkout status with fake session_id
        self.test_checkout_status(session_id)
        
        # Test feature access
        self.test_feature_access()
        
        print("\n" + "=" * 60)
        print("🏁 Stripe Testing Complete")
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"📈 Results: {passed_tests}/{total_tests} tests passed")
        if failed_tests > 0:
            print(f"❌ Failed tests: {failed_tests}")
            print("\nFailed test details:")
            for test_name, result in self.test_results.items():
                if not result["success"]:
                    print(f"  • {test_name}: {result['details']}")
        
        return self.test_results

if __name__ == "__main__":
    tester = StripeMonetizationTester()
    results = tester.run_stripe_tests()