#!/usr/bin/env python3
"""
Additional test for warn action in Admin Panel Moderation
"""

import asyncio
import aiohttp
import json

# Backend URL from environment
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "etheriasystems@gmail.com"
ADMIN_PASSWORD = "$Tory2410"

async def test_warn_action():
    """Test the warn action specifically"""
    session = aiohttp.ClientSession()
    
    try:
        # Login as admin
        login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        async with session.post(f"{BACKEND_URL}/api/auth/login", json=login_data) as response:
            data = await response.json()
            admin_token = data["session_token"]
        
        print("🔐 Admin logged in successfully")
        
        # Get users for test flag
        users_url = f"{BACKEND_URL}/api/community/admin/all-users?token={admin_token}&limit=10"
        async with session.get(users_url) as response:
            users_data = await response.json()
            users = users_data.get("users", [])
            
            # Find a non-admin user
            test_user = None
            for user in users:
                if not user.get("is_admin"):
                    test_user = user
                    break
        
        if not test_user:
            print("❌ No non-admin users found")
            return
        
        print(f"📝 Selected test user: {test_user.get('email')}")
        
        # Create test flag
        flag_data = {
            "user_id": test_user.get("user_id") or test_user.get("id"),
            "content_type": "test_warn",
            "content": "Test content for warn action testing",
            "reason": "Test flag for warn action"
        }
        
        create_url = f"{BACKEND_URL}/api/community/admin/create-test-flag?token={admin_token}"
        async with session.post(create_url, json=flag_data) as response:
            create_data = await response.json()
            test_flag_id = create_data.get("flag_id")
        
        print(f"🚩 Test flag created: {test_flag_id}")
        
        # Test warn action
        warn_url = f"{BACKEND_URL}/api/community/admin/flag/{test_flag_id}/action?token={admin_token}&action=warn"
        async with session.post(warn_url) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✅ Warn action executed successfully")
                print(f"   Message: {data.get('message')}")
                print(f"   Flag count: {data.get('flag_count', 'N/A')}")
                if data.get('suspension'):
                    print(f"   🚨 User suspended!")
            else:
                error_text = await response.text()
                print(f"❌ Warn action failed: {response.status} - {error_text}")
        
        # Verify flag is processed
        pending_url = f"{BACKEND_URL}/api/community/admin/pending-flags?token={admin_token}"
        async with session.get(pending_url) as response:
            data = await response.json()
            flags = data.get("flags", [])
            
            # Check if our test flag is still pending
            still_pending = any(flag.get('id') == test_flag_id for flag in flags)
            if still_pending:
                print(f"❌ Flag {test_flag_id} is still pending")
            else:
                print(f"✅ Flag {test_flag_id} processed successfully")
        
    finally:
        await session.close()

if __name__ == "__main__":
    asyncio.run(test_warn_action())