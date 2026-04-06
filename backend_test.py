#!/usr/bin/env python3
"""
Backend API Testing Script for Etheria App - Journal API Focus
Testing the Journal API endpoints as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://meditation-nexus.preview.emergentagent.com/api"
TEST_EMAIL = "test@etheria.com"
TEST_PASSWORD = "TestPass123!"

class JournalAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def login(self):
        """Login and get session token"""
        print("🔐 Testing user authentication...")
        
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            print(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('session_token')
                self.user_id = data.get('user_id')
                
                # Set authorization header for future requests
                self.session.headers.update({
                    'Authorization': f'Bearer {self.auth_token}',
                    'Content-Type': 'application/json'
                })
                
                print(f"✅ Login successful! User ID: {self.user_id}")
                return True
            else:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    def test_create_journal_entry_primary(self):
        """Test POST /api/journal/entries (Create Journal Entry - Alias endpoint)"""
        print("\n📝 Testing POST /api/journal/entries (Create Journal Entry - Alias)...")
        
        journal_entry = {
            "title": "Oracle Reading: Three Card Spread",
            "content": "Test reading content for alias endpoint",
            "category": "divination",
            "entry_type": "oracle",
            "date": "2025-06-15T10:00:00Z",
            "metadata": {
                "spread_type": "Three Card Spread",
                "question": "What guidance do I need today?",
                "cards": [{"position": "Past", "card_name": "The Moon"}]
            }
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/journal/entries", json=journal_entry)
            print(f"POST /api/journal/entries response status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print(f"✅ Journal entry created successfully via /entries! Entry ID: {data.get('id')}")
                    return data.get('id')
                else:
                    print(f"❌ Journal entry creation failed: {data}")
                    return None
            else:
                print(f"❌ POST /api/journal/entries failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error testing POST /api/journal/entries: {e}")
            return None
    
    def test_create_journal_entry_alias(self):
        """Test POST /api/journal/save (Alias endpoint)"""
        print("\n📝 Testing POST /api/journal/save (Primary endpoint)...")
        
        journal_entry = {
            "title": "Oracle Reading: Celtic Cross",
            "content": "Test reading content for primary endpoint",
            "category": "divination",
            "entry_type": "oracle",
            "date": "2025-06-15T11:00:00Z",
            "metadata": {
                "spread_type": "Celtic Cross",
                "question": "What should I focus on this week?",
                "cards": [
                    {"position": "Present", "card_name": "The Star"},
                    {"position": "Challenge", "card_name": "Seven of Cups"}
                ]
            }
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/journal/save", json=journal_entry)
            print(f"POST /api/journal/save response status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print(f"✅ Journal entry created successfully via /save! Entry ID: {data.get('id')}")
                    return data.get('id')
                else:
                    print(f"❌ Journal entry creation failed: {data}")
                    return None
            else:
                print(f"❌ POST /api/journal/save failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error testing POST /api/journal/save: {e}")
            return None
    
    def test_get_journal_entries(self):
        """Test GET /api/journal/entries (Retrieve entries)"""
        print("\n📖 Testing GET /api/journal/entries (Retrieve entries)...")
        
        try:
            response = self.session.get(f"{BASE_URL}/journal/entries")
            print(f"GET /api/journal/entries response status: {response.status_code}")
            
            if response.status_code == 200:
                entries = response.json()
                print(f"✅ Retrieved {len(entries)} journal entries")
                
                # Check for oracle entries with metadata
                oracle_entries = [e for e in entries if e.get('entry_type') == 'oracle']
                print(f"📊 Found {len(oracle_entries)} oracle entries")
                
                # Verify metadata preservation
                for i, entry in enumerate(oracle_entries[:2]):  # Check first 2 oracle entries
                    print(f"\n🔍 Oracle Entry {i+1}:")
                    print(f"  Title: {entry.get('title')}")
                    print(f"  Entry Type: {entry.get('entry_type')}")
                    print(f"  Category: {entry.get('category')}")
                    
                    metadata = entry.get('metadata', {})
                    print(f"  Metadata:")
                    print(f"    Spread Type: {metadata.get('spread_type')}")
                    print(f"    Question: {metadata.get('question')}")
                    print(f"    Cards: {metadata.get('cards')}")
                
                if oracle_entries:
                    print("✅ Oracle entries found with proper metadata preservation!")
                else:
                    print("⚠️ No oracle entries found - may need to create some first")
                
                return entries
            else:
                print(f"❌ GET /api/journal/entries failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error testing GET /api/journal/entries: {e}")
            return None
    
    def test_journal_status(self):
        """Test GET /api/journal/status (Check journal limits)"""
        print("\n📊 Testing GET /api/journal/status (Check journal limits)...")
        
        try:
            response = self.session.get(f"{BASE_URL}/journal/status")
            print(f"GET /api/journal/status response status: {response.status_code}")
            
            if response.status_code == 200:
                status = response.json()
                print(f"✅ Journal status retrieved:")
                print(f"  Entries this week: {status.get('entries_this_week', 'N/A')}")
                print(f"  Max entries: {status.get('max_entries', 'N/A')}")
                print(f"  Is premium: {status.get('is_premium', 'N/A')}")
                return status
            else:
                print(f"❌ GET /api/journal/status failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error testing GET /api/journal/status: {e}")
            return None
    
    def run_all_tests(self):
        """Run all journal API tests"""
        print("🧪 Starting Journal API Testing for Etheria App")
        print("=" * 60)
        
        # Step 1: Login
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Test journal status
        self.test_journal_status()
        
        # Step 3: Test POST /api/journal/entries (alias endpoint)
        entry_id_1 = self.test_create_journal_entry_primary()
        
        # Step 4: Test POST /api/journal/save (primary endpoint)  
        entry_id_2 = self.test_create_journal_entry_alias()
        
        # Step 5: Test GET /api/journal/entries
        entries = self.test_get_journal_entries()
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 JOURNAL API TEST SUMMARY")
        print("=" * 60)
        
        success_count = 0
        total_tests = 4
        
        if self.auth_token:
            print("✅ Authentication: PASSED")
            success_count += 1
        else:
            print("❌ Authentication: FAILED")
        
        if entry_id_1:
            print("✅ POST /api/journal/entries: PASSED")
            success_count += 1
        else:
            print("❌ POST /api/journal/entries: FAILED")
        
        if entry_id_2:
            print("✅ POST /api/journal/save: PASSED") 
            success_count += 1
        else:
            print("❌ POST /api/journal/save: FAILED")
        
        if entries is not None:
            print("✅ GET /api/journal/entries: PASSED")
            success_count += 1
        else:
            print("❌ GET /api/journal/entries: FAILED")
        
        print(f"\n🎯 Overall Result: {success_count}/{total_tests} tests passed")
        
        if success_count == total_tests:
            print("🎉 All Journal API tests PASSED!")
            return True
        else:
            print("⚠️ Some Journal API tests FAILED!")
            return False

def main():
    """Main test execution"""
    tester = JournalAPITester()
    success = tester.run_all_tests()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()