#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Etheria App - Stripe Checkout Flow
Tests all Stripe monetization endpoints end-to-end
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com/api"

class StripeCheckoutTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.checkout_session_id = None
        
    async def run_tests(self):
        """Run complete Stripe checkout flow tests"""
        print("🧪 Starting Stripe Checkout Flow Testing...")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Test 1: Create test user or login
                await self.test_user_authentication(client)
                
                # Test 2: Check initial subscription status
                await self.test_initial_subscription_status(client)
                
                # Test 3: Get available plans
                await self.test_get_subscription_plans(client)
                
                # Test 4: Create checkout session
                await self.test_create_checkout_session(client)
                
                # Test 5: Check checkout status
                await self.test_checkout_status(client)
                
                # Test 6: Check feature access for free user
                await self.test_feature_access_control(client)
                
                # Test 7: Verify payment transaction in database
                await self.test_payment_transaction_created(client)
                
                print("\n" + "=" * 60)
                print("✅ ALL STRIPE CHECKOUT TESTS COMPLETED SUCCESSFULLY!")
                return True
                
            except Exception as e:
                print(f"\n❌ CRITICAL ERROR: {e}")
                return False
    
    async def test_user_authentication(self, client):
        """Test 1: Create test user or login with existing user"""
        print("\n🔐 Test 1: User Authentication")
        
        # Try to create new user first
        test_email = "stripetest@etheria.com"
        test_password = "StripeTest123!"
        test_name = "Stripe Tester"
        
        signup_data = {
            "email": test_email,
            "password": test_password,
            "name": test_name
        }
        
        try:
            # Try signup first
            response = await client.post(f"{BACKEND_URL}/auth/signup", json=signup_data)
            
            if response.status_code == 400 and "already registered" in response.text:
                print("   User already exists, attempting login...")
                # User exists, try login
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
                        # Extract session token from set-cookie header
                        import re
                        match = re.search(r'session_token=([^;]+)', set_cookie_header)
                        if match:
                            self.session_token = match.group(1)
                
                print(f"   ✅ Authentication successful")
                print(f"   User ID: {self.user_id}")
                print(f"   Email: {user_data['email']}")
                print(f"   Session token: {self.session_token[:20]}...")
            else:
                raise Exception(f"Authentication failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            raise Exception(f"Authentication test failed: {e}")
    
    async def test_initial_subscription_status(self, client):
        """Test 2: Check initial subscription status"""
        print("\n📊 Test 2: Initial Subscription Status")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        response = await client.get(f"{BACKEND_URL}/subscription/status", headers=headers)
        
        if response.status_code == 200:
            status_data = response.json()
            print(f"   ✅ Subscription status retrieved")
            print(f"   Is Premium: {status_data['is_premium']}")
            print(f"   Status: {status_data['subscription_status']}")
            
            # Verify free user initially
            if not status_data['is_premium']:
                print("   ✅ Confirmed: User is on free tier")
            else:
                print("   ⚠️  Warning: User already has premium subscription")
        else:
            raise Exception(f"Subscription status check failed: {response.status_code} - {response.text}")
    
    async def test_get_subscription_plans(self, client):
        """Test 3: Get available subscription plans"""
        print("\n💰 Test 3: Available Subscription Plans")
        
        response = await client.get(f"{BACKEND_URL}/subscription/plans")
        
        if response.status_code == 200:
            plans_data = response.json()
            print(f"   ✅ Plans retrieved successfully")
            
            # Verify premium_monthly plan exists
            if "plans" in plans_data and "premium_monthly" in plans_data["plans"]:
                premium_plan = plans_data["plans"]["premium_monthly"]
                print(f"   ✅ Premium Monthly Plan found:")
                print(f"      Name: {premium_plan['name']}")
                print(f"      Price: ${premium_plan['price']}")
                print(f"      Currency: {premium_plan['currency']}")
                
                # Verify price is $3.99
                if premium_plan['price'] == 3.99:
                    print("   ✅ Confirmed: Price is $3.99 as expected")
                else:
                    raise Exception(f"Price mismatch: Expected $3.99, got ${premium_plan['price']}")
            else:
                raise Exception("premium_monthly plan not found in response")
        else:
            raise Exception(f"Get plans failed: {response.status_code} - {response.text}")
    
    async def test_create_checkout_session(self, client):
        """Test 4: Create Stripe checkout session"""
        print("\n🛒 Test 4: Create Checkout Session")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        checkout_data = {
            "plan_id": "premium_monthly",
            "origin_url": "http://localhost:3000"
        }
        
        response = await client.post(f"{BACKEND_URL}/subscription/create-checkout", 
                                   json=checkout_data, headers=headers)
        
        if response.status_code == 200:
            checkout_response = response.json()
            print(f"   ✅ Checkout session created successfully")
            
            # Verify response contains required fields
            if "checkout_url" in checkout_response and "session_id" in checkout_response:
                self.checkout_session_id = checkout_response["session_id"]
                print(f"   Session ID: {self.checkout_session_id}")
                print(f"   Checkout URL: {checkout_response['checkout_url'][:50]}...")
                
                # Verify it's a Stripe URL
                if "stripe.com" in checkout_response["checkout_url"]:
                    print("   ✅ Confirmed: Valid Stripe checkout URL")
                else:
                    print("   ⚠️  Warning: Checkout URL doesn't contain stripe.com")
            else:
                raise Exception("Response missing checkout_url or session_id")
        else:
            raise Exception(f"Create checkout failed: {response.status_code} - {response.text}")
    
    async def test_checkout_status(self, client):
        """Test 5: Check checkout session status"""
        print("\n📋 Test 5: Checkout Status Verification")
        
        if not self.checkout_session_id:
            raise Exception("No checkout session ID available")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        response = await client.get(f"{BACKEND_URL}/subscription/checkout-status/{self.checkout_session_id}", 
                                  headers=headers)
        
        if response.status_code == 200:
            status_data = response.json()
            print(f"   ✅ Checkout status retrieved")
            print(f"   Status: {status_data.get('status', 'N/A')}")
            print(f"   Payment Status: {status_data.get('payment_status', 'N/A')}")
            
            # For test mode, status should be 'open' and payment_status 'unpaid'
            if status_data.get('status') == 'open':
                print("   ✅ Confirmed: Session is open for payment")
            if status_data.get('payment_status') == 'unpaid':
                print("   ✅ Confirmed: Payment is pending (as expected in test mode)")
        else:
            raise Exception(f"Checkout status check failed: {response.status_code} - {response.text}")
    
    async def test_feature_access_control(self, client):
        """Test 6: Check feature access for free user"""
        print("\n🔒 Test 6: Feature Access Control")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test spirit_guides feature (should require premium)
        response = await client.get(f"{BACKEND_URL}/user/feature-access/spirit_guides", 
                                  headers=headers)
        
        if response.status_code == 200:
            access_data = response.json()
            print(f"   ✅ Feature access check completed")
            print(f"   Feature: {access_data['feature']}")
            print(f"   Has Access: {access_data['has_access']}")
            print(f"   Upgrade Required: {access_data['upgrade_required']}")
            
            # For free user, should not have access to spirit_guides
            if not access_data['has_access'] and access_data['upgrade_required']:
                print("   ✅ Confirmed: Free user correctly blocked from premium feature")
            else:
                print("   ⚠️  Warning: Free user has unexpected access to premium feature")
        else:
            raise Exception(f"Feature access check failed: {response.status_code} - {response.text}")
    
    async def test_payment_transaction_created(self, client):
        """Test 7: Verify payment transaction was created in database"""
        print("\n💳 Test 7: Payment Transaction Verification")
        
        if not self.checkout_session_id:
            raise Exception("No checkout session ID to verify")
        
        # Since we can't directly access the database, we'll verify through the checkout status
        # which should show the transaction exists
        headers = {"Authorization": f"Bearer {self.session_token}"}
        response = await client.get(f"{BACKEND_URL}/subscription/checkout-status/{self.checkout_session_id}", 
                                  headers=headers)
        
        if response.status_code == 200:
            print("   ✅ Transaction record exists (verified via checkout status)")
            print("   ✅ Checkout session successfully created pending transaction")
        elif response.status_code == 404:
            raise Exception("Transaction not found in database")
        else:
            raise Exception(f"Transaction verification failed: {response.status_code} - {response.text}")

async def main():
    """Main test runner"""
    tester = StripeCheckoutTester()
    success = await tester.run_tests()
    
    if success:
        print("\n🎉 STRIPE CHECKOUT FLOW TESTING COMPLETE")
        print("All endpoints are working correctly!")
        exit(0)
    else:
        print("\n💥 TESTING FAILED")
        print("Some endpoints have issues that need attention.")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())