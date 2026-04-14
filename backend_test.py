#!/usr/bin/env python3
"""
Backend API Testing for Etheria Meditation App Admin Panel
Testing actual admin endpoints that exist in the system
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"  # Using password from review request
ADMIN_SECRET = "etheria_admin_secret_2026"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"🧪 TESTING: {test_name}")
    print(f"{'='*60}")

def print_result(success, message, response_data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if response_data:
        print(f"Response: {json.dumps(response_data, indent=2)}")
    print("-" * 60)

def test_admin_login():
    """Test admin login to get authentication token"""
    print_test_header("Admin Login Authentication")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            is_admin = data.get("is_admin", False)
            token = data.get("session_token")
            
            if is_admin and token:
                print_result(True, f"Admin login successful. Admin status: {is_admin}", {
                    "is_admin": is_admin,
                    "admin_level": data.get("admin_level"),
                    "email": data.get("email"),
                    "token_received": bool(token)
                })
                return token
            else:
                print_result(False, f"Login successful but admin status is {is_admin} or no token", data)
                return None
        else:
            print_result(False, f"Login failed with status {response.status_code}", {
                "status_code": response.status_code,
                "response": response.text
            })
            return None
            
    except Exception as e:
        print_result(False, f"Login request failed: {str(e)}")
        return None

def test_admin_dashboard():
    """Test admin dashboard endpoint"""
    print_test_header("Admin Dashboard")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/dashboard",
            params={"admin_secret": ADMIN_SECRET},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Admin dashboard retrieved successfully", data)
            return True
        else:
            print_result(False, f"Dashboard request failed with status {response.status_code}", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"Dashboard request failed: {str(e)}")
        return False

def test_admin_participants():
    """Test admin participants endpoint"""
    print_test_header("Admin Participants List")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/participants",
            params={"admin_secret": ADMIN_SECRET},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Admin participants list retrieved successfully", {
                "total_participants": data.get("total_participants"),
                "participants_count": len(data.get("participants", [])),
                "sample_participant": data.get("participants", [{}])[0] if data.get("participants") else None
            })
            return True
        else:
            print_result(False, f"Participants request failed with status {response.status_code}", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"Participants request failed: {str(e)}")
        return False

def test_admin_generate_code():
    """Test admin generate new code endpoint"""
    print_test_header("Admin Generate New Code")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/generate-new-code",
            json={"admin_secret": ADMIN_SECRET},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "New code generated successfully", data)
            return True
        else:
            print_result(False, f"Generate code request failed with status {response.status_code}", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"Generate code request failed: {str(e)}")
        return False

def test_all_users_endpoint(admin_token):
    """Test admin all users endpoint"""
    print_test_header("Admin All Users Endpoint")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/community/admin/all-users",
            params={"token": admin_token},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            users = data.get("users", [])
            admin_user = None
            for user in users:
                if user.get("email") == ADMIN_EMAIL:
                    admin_user = user
                    break
            
            print_result(True, f"All users retrieved successfully. Total: {data.get('total', 0)}", {
                "total_users": data.get("total"),
                "users_returned": len(users),
                "admin_user_found": admin_user is not None,
                "admin_user_details": admin_user if admin_user else "Not found"
            })
            return True
        else:
            print_result(False, f"All users request failed with status {response.status_code}", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"All users request failed: {str(e)}")
        return False

def test_contest_status(admin_token):
    """Test contest status endpoint"""
    print_test_header("Contest Status")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/contest/status",
            params={"token": admin_token},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Contest status retrieved successfully", data)
            return True
        else:
            print_result(False, f"Contest status request failed with status {response.status_code}", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"Contest status request failed: {str(e)}")
        return False

def test_contest_generate_code(admin_token):
    """Test contest generate code endpoint"""
    print_test_header("Contest Generate Code")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/contest/generate-code",
            json={"code_type": "monthly"},
            params={"token": admin_token},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Contest code generated successfully", data)
            return True
        else:
            print_result(False, f"Contest generate code request failed with status {response.status_code}", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"Contest generate code request failed: {str(e)}")
        return False

def test_contest_entries(admin_token):
    """Test contest entries endpoint"""
    print_test_header("Contest Entries")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/contest/entries",
            params={"token": admin_token},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Contest entries retrieved successfully", {
                "contest": data.get("contest"),
                "total_entries": len(data.get("entries", [])),
                "total_eligible": data.get("total_eligible", 0)
            })
            return True
        else:
            print_result(False, f"Contest entries request failed with status {response.status_code}", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"Contest entries request failed: {str(e)}")
        return False

def main():
    """Run all admin panel tests"""
    print(f"🚀 Starting Etheria Admin Panel Backend Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    results = {}
    
    # Test 1: Admin Login
    admin_token = test_admin_login()
    results["admin_login"] = admin_token is not None
    
    if admin_token:
        # Test 2: All Users Endpoint (equivalent to community/admin/all-users)
        results["all_users_endpoint"] = test_all_users_endpoint(admin_token)
        
        # Test 3: Contest Status
        results["contest_status"] = test_contest_status(admin_token)
        
        # Test 4: Contest Generate Code
        results["contest_generate_code"] = test_contest_generate_code(admin_token)
        
        # Test 5: Contest Entries
        results["contest_entries"] = test_contest_entries(admin_token)
    else:
        print("⚠️  Skipping token-based tests due to login failure")
        results["all_users_endpoint"] = False
        results["contest_status"] = False
        results["contest_generate_code"] = False
        results["contest_entries"] = False
    
    # Test 6: Admin Dashboard (using admin secret)
    results["admin_dashboard"] = test_admin_dashboard()
    
    # Test 7: Admin Participants (using admin secret)
    results["admin_participants"] = test_admin_participants()
    
    # Test 8: Admin Generate Code (using admin secret)
    results["admin_generate_code"] = test_admin_generate_code()
    
    # Summary
    print(f"\n{'='*60}")
    print("🏁 TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All admin panel tests PASSED!")
        return 0
    else:
        print("⚠️  Some admin panel tests FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())