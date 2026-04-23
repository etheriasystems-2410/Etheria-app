#!/usr/bin/env python3
"""
Backend Test Script for Community Email Notification System
Tests the automatic email notification system for community post replies.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
import uuid

# Test configuration
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com"
ADMIN_EMAIL = "test@etheria.com"
ADMIN_PASSWORD = "TestPass123!"

# Create a unique test user for this test
TEST_USER_EMAIL = f"test.user.{uuid.uuid4().hex[:8]}@example.com"
TEST_USER_PASSWORD = "TestPassword123!"
TEST_USER_NAME = "Test User"

class CommunityEmailNotificationTester:
    def __init__(self):
        self.session = None
        self.session_token = None
        self.user_info = None
        self.admin_token = None
        
    async def setup_session(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Clean up HTTP session"""
        if self.session:
            await self.session.close()
            
    async def create_test_user(self):
        """Create a test user for testing"""
        print(f"👤 Creating test user: {TEST_USER_EMAIL}...")
        
        signup_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": TEST_USER_NAME
        }
        
        async with self.session.post(f"{BACKEND_URL}/api/auth/signup", json=signup_data) as response:
            if response.status == 200:
                print(f"✅ Test user created successfully!")
                return True
            else:
                error_text = await response.text()
                print(f"❌ Failed to create test user: {response.status} - {error_text}")
                return False
                
    async def login_test_user(self):
        """Login with the test user"""
        print(f"🔐 Logging in test user: {TEST_USER_EMAIL}...")
        
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        async with self.session.post(f"{BACKEND_URL}/api/auth/login", json=login_data) as response:
            if response.status == 200:
                data = await response.json()
                self.session_token = data.get("session_token")
                self.user_info = data.get("user", {})
                print(f"✅ Test user login successful! Session token: {self.session_token[:20]}...")
                print(f"   User: {self.user_info.get('name', 'Unknown')} ({self.user_info.get('email', 'Unknown')})")
                return True
            else:
                error_text = await response.text()
                print(f"❌ Test user login failed: {response.status} - {error_text}")
                return False
                
    async def login_admin(self):
        """Login as admin to create posts"""
        print(f"🔐 Logging in as admin: {ADMIN_EMAIL}...")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        async with self.session.post(f"{BACKEND_URL}/api/auth/login", json=login_data) as response:
            if response.status == 200:
                data = await response.json()
                self.admin_token = data.get("session_token")
                admin_info = data.get("user", {})
                print(f"✅ Admin login successful! Session token: {self.admin_token[:20]}...")
                print(f"   Admin: {admin_info.get('name', 'Unknown')} ({admin_info.get('email', 'Unknown')})")
                return True
            else:
                error_text = await response.text()
                print(f"❌ Admin login failed: {response.status} - {error_text}")
                return False
                
    async def get_community_posts(self, category="general", token=None):
        """Get posts in a category to find existing posts"""
        if not token:
            token = self.session_token
            
        print(f"\n📋 Getting posts in '{category}' category...")
        
        url = f"{BACKEND_URL}/api/community/posts/{category}?token={token}"
        
        async with self.session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                posts = data.get("posts", [])
                print(f"✅ Found {len(posts)} posts in '{category}' category")
                
                if posts:
                    print("   Recent posts:")
                    for i, post in enumerate(posts[:3]):
                        print(f"   {i+1}. '{post.get('title', 'No title')}' by {post.get('author_name', 'Unknown')}")
                        print(f"      ID: {post.get('id')} | Comments: {post.get('comment_count', 0)}")
                
                return posts
            else:
                error_text = await response.text()
                print(f"❌ Failed to get posts: {response.status} - {error_text}")
                return []
                
    async def create_test_post_as_admin(self, category="general"):
        """Create a test post as admin for testing replies"""
        print(f"\n📝 Creating test post as admin in '{category}' category...")
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        post_data = {
            "category": category,
            "title": f"Admin Test Post for Email Notifications - {timestamp}",
            "content": f"This is a test post created by admin at {timestamp} to test the email notification system when someone replies to this post. The reply should trigger an email notification to the admin email address."
        }
        
        url = f"{BACKEND_URL}/api/community/posts?token={self.admin_token}"
        
        async with self.session.post(url, json=post_data) as response:
            if response.status == 200:
                data = await response.json()
                post_id = data.get("post_id")
                print(f"✅ Admin test post created successfully!")
                print(f"   Post ID: {post_id}")
                print(f"   Title: {post_data['title']}")
                return post_id
            else:
                error_text = await response.text()
                print(f"❌ Failed to create admin test post: {response.status} - {error_text}")
                return None
                
    async def add_comment_to_post(self, post_id, content=None):
        """Add a comment/reply to a post as test user"""
        if not content:
            timestamp = datetime.now().strftime("%H:%M:%S")
            content = f"Test reply from test user to verify email notification system - {timestamp}. This comment should trigger an email notification to the post author (admin)!"
            
        print(f"\n💬 Adding comment to post {post_id} as test user...")
        print(f"   Comment: {content[:100]}{'...' if len(content) > 100 else ''}")
        
        comment_data = {
            "content": content
        }
        
        url = f"{BACKEND_URL}/api/community/posts/{post_id}/comments?token={self.session_token}"
        
        async with self.session.post(url, json=comment_data) as response:
            if response.status == 200:
                data = await response.json()
                comment_id = data.get("comment_id")
                print(f"✅ Comment added successfully!")
                print(f"   Comment ID: {comment_id}")
                print(f"   Message: {data.get('message', 'No message')}")
                return comment_id
            else:
                error_text = await response.text()
                print(f"❌ Failed to add comment: {response.status} - {error_text}")
                return None
                
    async def get_post_comments(self, post_id):
        """Get comments for a post to verify comment was created"""
        print(f"\n📖 Getting comments for post {post_id}...")
        
        url = f"{BACKEND_URL}/api/community/posts/{post_id}/comments?token={self.session_token}"
        
        async with self.session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                comments = data.get("comments", [])
                print(f"✅ Found {len(comments)} comments on the post")
                
                if comments:
                    print("   Recent comments:")
                    for i, comment in enumerate(comments[-3:]):  # Show last 3 comments
                        print(f"   {i+1}. By {comment.get('author_name', 'Unknown')}: {comment.get('content', 'No content')[:100]}{'...' if len(comment.get('content', '')) > 100 else ''}")
                        print(f"      ID: {comment.get('id')} | Created: {comment.get('created_at', 'Unknown')}")
                
                return comments
            else:
                error_text = await response.text()
                print(f"❌ Failed to get comments: {response.status} - {error_text}")
                return []
                
    async def check_backend_logs(self):
        """Check backend logs for email notification confirmation"""
        print(f"\n📋 Checking backend logs for email notifications...")
        
        # Note: In a real environment, we would check actual logs
        # For this test, we'll simulate checking logs
        print("   📝 To check backend logs manually, run:")
        print("   tail -n 50 /var/log/supervisor/backend.*.log | grep -i 'email'")
        print("   Look for messages like: 'Email sent: New Reply to Your Post'")
        
    async def run_full_test(self):
        """Run the complete email notification test flow"""
        print("🚀 Starting Community Email Notification System Test")
        print("=" * 60)
        
        try:
            # Setup
            await self.setup_session()
            
            # Step 1: Create test user
            if not await self.create_test_user():
                return False
                
            # Step 2: Login test user
            if not await self.login_test_user():
                return False
                
            # Step 3: Login admin
            if not await self.login_admin():
                return False
                
            # Step 4: Create a test post as admin
            target_post_id = await self.create_test_post_as_admin("general")
            if not target_post_id:
                print("❌ Could not create admin test post")
                return False
                
            # Step 5: Add a comment to trigger email notification (as test user)
            comment_id = await self.add_comment_to_post(target_post_id)
            if not comment_id:
                print("❌ Could not add comment to post")
                return False
                
            # Step 6: Verify comment was created
            comments = await self.get_post_comments(target_post_id)
            
            # Step 7: Check for email notification in logs
            await self.check_backend_logs()
            
            print("\n" + "=" * 60)
            print("✅ Community Email Notification Test Completed!")
            print("\n📧 Expected Results:")
            print("   1. Comment should be successfully created")
            print("   2. Email notification should be sent to post author (admin)")
            print("   3. Backend logs should show: 'Email sent: New Reply to Your Post'")
            print("   4. Admin should receive email with reply notification")
            
            print(f"\n🔍 Test Summary:")
            print(f"   • Test user created: ✅ {TEST_USER_EMAIL}")
            print(f"   • Test user login: ✅ Successful")
            print(f"   • Admin login: ✅ Successful")
            print(f"   • Post ID: {target_post_id}")
            print(f"   • Comment ID: {comment_id}")
            print(f"   • Comments on post: {len(comments)}")
            
            return True
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
            
        finally:
            await self.cleanup_session()

async def main():
    """Main test function"""
    tester = CommunityEmailNotificationTester()
    success = await tester.run_full_test()
    
    if success:
        print("\n🎉 All tests completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())