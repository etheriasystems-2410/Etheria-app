#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Psychic Awareness App
Tests all endpoints with realistic data and proper error handling
"""

import requests
import json
import uuid
from datetime import datetime
import time

# Backend URL from frontend .env
BACKEND_URL = "https://meditation-nexus.preview.emergentagent.com/api"

class PsychicAppTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = {}
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        self.test_results[test_name] = {
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
    
    def test_root_endpoint(self):
        """Test the root API endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Psychic Awareness API" in data["message"]:
                    self.log_test("Root Endpoint", True, "API is accessible")
                    return True
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Root Endpoint", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Connection error: {str(e)}")
            return False
    
    def test_training_modules(self):
        """Test GET /api/training/modules"""
        try:
            response = self.session.get(f"{BACKEND_URL}/training/modules")
            if response.status_code == 200:
                modules = response.json()
                if isinstance(modules, list) and len(modules) == 9:
                    # Verify structure of modules
                    required_fields = ["id", "title", "description", "lessons", "category"]
                    categories = set()
                    for module in modules:
                        if not all(field in module for field in required_fields):
                            self.log_test("Training Modules", False, "Missing required fields in module")
                            return False
                        categories.add(module["category"])
                    
                    # Check if we have all three categories
                    expected_categories = {"beginner", "intermediate", "advanced"}
                    if categories == expected_categories:
                        self.log_test("Training Modules", True, f"9 modules with all categories: {categories}")
                        return True
                    else:
                        self.log_test("Training Modules", False, f"Missing categories. Found: {categories}")
                        return False
                else:
                    self.log_test("Training Modules", False, f"Expected 9 modules, got {len(modules) if isinstance(modules, list) else 'non-list'}")
                    return False
            else:
                self.log_test("Training Modules", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Training Modules", False, f"Error: {str(e)}")
            return False
    
    def test_oracle_draw(self):
        """Test POST /api/oracle/draw"""
        try:
            response = self.session.post(f"{BACKEND_URL}/oracle/draw")
            if response.status_code == 200:
                reading = response.json()
                required_fields = ["card", "interpretation", "timestamp"]
                if all(field in reading for field in required_fields):
                    card = reading["card"]
                    card_fields = ["name", "element", "description", "keywords"]
                    if all(field in card for field in card_fields):
                        # Check if interpretation is meaningful (not just fallback)
                        interpretation = reading["interpretation"]
                        if len(interpretation) > 50:  # Reasonable interpretation length
                            self.log_test("Oracle Draw", True, f"Drew card: {card['name']} ({card['element']})")
                            return reading  # Return for save test
                        else:
                            self.log_test("Oracle Draw", False, "Interpretation too short - likely AI failure")
                            return reading  # Still return for save test
                    else:
                        self.log_test("Oracle Draw", False, "Card missing required fields")
                        return None
                else:
                    self.log_test("Oracle Draw", False, "Response missing required fields")
                    return None
            else:
                self.log_test("Oracle Draw", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_test("Oracle Draw", False, f"Error: {str(e)}")
            return None
    
    def test_oracle_save(self, reading_data=None):
        """Test POST /api/oracle/save"""
        if not reading_data:
            # Create test reading data
            reading_data = {
                "card": {
                    "name": "The Sacred Ember",
                    "element": "Fire",
                    "description": "Inner spark and divine inspiration",
                    "keywords": ["inspiration", "motivation", "divine spark", "purpose"]
                },
                "interpretation": "This is a test interpretation for the Sacred Ember card. It represents the divine spark within you that guides your spiritual journey.",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/oracle/save",
                json=reading_data,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                result = response.json()
                if result.get("success") and "message" in result:
                    self.log_test("Oracle Save", True, "Reading saved successfully")
                    return True
                else:
                    self.log_test("Oracle Save", False, f"Unexpected response: {result}")
                    return False
            else:
                self.log_test("Oracle Save", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Oracle Save", False, f"Error: {str(e)}")
            return False
    
    def test_oracle_readings(self):
        """Test GET /api/oracle/readings"""
        try:
            response = self.session.get(f"{BACKEND_URL}/oracle/readings")
            if response.status_code == 200:
                readings = response.json()
                if isinstance(readings, list):
                    self.log_test("Oracle Readings", True, f"Retrieved {len(readings)} saved readings")
                    return True
                else:
                    self.log_test("Oracle Readings", False, "Response is not a list")
                    return False
            else:
                self.log_test("Oracle Readings", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Oracle Readings", False, f"Error: {str(e)}")
            return False
    
    def test_spirit_guides_chat(self):
        """Test POST /api/spirit-guides/chat"""
        guides = ["Ignis", "Aqua", "Terra", "Aether"]
        elements = ["Fire", "Water", "Earth", "Air"]
        
        for guide, element in zip(guides, elements):
            try:
                message_data = {
                    "guide": guide,
                    "element": element,
                    "message": f"Hello {guide}, I seek guidance on my spiritual journey. What wisdom do you have for me today?",
                    "history": []
                }
                
                response = self.session.post(
                    f"{BACKEND_URL}/spirit-guides/chat",
                    json=message_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if "response" in result and len(result["response"]) > 20:
                        # Check if it's a fallback response (indicates AI failure)
                        if "disturbance in our connection" in result["response"]:
                            self.log_test(f"Spirit Guide {guide}", False, "AI budget exceeded - fallback response")
                        else:
                            self.log_test(f"Spirit Guide {guide}", True, f"Received guidance from {guide}")
                    else:
                        self.log_test(f"Spirit Guide {guide}", False, "Empty or invalid response")
                else:
                    self.log_test(f"Spirit Guide {guide}", False, f"Status: {response.status_code}")
                
                # Small delay between requests
                time.sleep(0.5)
                
            except Exception as e:
                self.log_test(f"Spirit Guide {guide}", False, f"Error: {str(e)}")
    
    def test_meditation_generate(self):
        """Test POST /api/meditation/generate-guided"""
        test_cases = [
            {"duration_minutes": 5, "focus": "stress relief"},
            {"duration_minutes": 10, "focus": "chakra balancing"},
            {"duration_minutes": 15, "focus": "spiritual awakening"}
        ]
        
        for case in test_cases:
            try:
                response = self.session.post(
                    f"{BACKEND_URL}/meditation/generate-guided",
                    params=case,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    required_fields = ["script", "duration", "focus"]
                    if all(field in result for field in required_fields):
                        if len(result["script"]) > 100:  # Reasonable script length
                            self.log_test(f"Meditation {case['focus']}", True, f"{case['duration_minutes']}min meditation generated")
                        else:
                            self.log_test(f"Meditation {case['focus']}", False, "Script too short - likely AI failure")
                    else:
                        self.log_test(f"Meditation {case['focus']}", False, "Missing required fields")
                else:
                    self.log_test(f"Meditation {case['focus']}", False, f"Status: {response.status_code}")
                
                # Small delay between requests
                time.sleep(0.5)
                
            except Exception as e:
                self.log_test(f"Meditation {case['focus']}", False, f"Error: {str(e)}")
    
    def test_journal_save(self):
        """Test POST /api/journal/save"""
        test_entries = [
            {
                "title": "Morning Meditation Insights",
                "content": "Today during my meditation, I experienced a profound sense of connection with the universe. The visualization of golden light filling my chakras was particularly powerful.",
                "category": "meditation",
                "mood": "peaceful",
                "tags": ["meditation", "chakras", "visualization"]
            },
            {
                "title": "Oracle Reading Reflection",
                "content": "The Fire Phoenix card I drew today really resonated with my current life situation. I'm going through a major transformation in my career.",
                "category": "oracle",
                "mood": "contemplative",
                "tags": ["oracle", "transformation", "career"]
            }
        ]
        
        saved_ids = []
        for entry in test_entries:
            try:
                response = self.session.post(
                    f"{BACKEND_URL}/journal/save",
                    json=entry,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("success") and "id" in result:
                        saved_ids.append(result["id"])
                        self.log_test(f"Journal Save ({entry['category']})", True, f"Entry saved with ID: {result['id']}")
                    else:
                        self.log_test(f"Journal Save ({entry['category']})", False, f"Unexpected response: {result}")
                else:
                    self.log_test(f"Journal Save ({entry['category']})", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test(f"Journal Save ({entry['category']})", False, f"Error: {str(e)}")
        
        return saved_ids
    
    def test_journal_entries(self):
        """Test GET /api/journal/entries"""
        try:
            response = self.session.get(f"{BACKEND_URL}/journal/entries")
            if response.status_code == 200:
                entries = response.json()
                if isinstance(entries, list):
                    self.log_test("Journal Entries", True, f"Retrieved {len(entries)} journal entries")
                    return True
                else:
                    self.log_test("Journal Entries", False, "Response is not a list")
                    return False
            else:
                self.log_test("Journal Entries", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Journal Entries", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests in priority order"""
        print("🔮 Starting Psychic Awareness App Backend Testing")
        print("=" * 60)
        
        # Test basic connectivity first
        if not self.test_root_endpoint():
            print("❌ Cannot connect to backend - stopping tests")
            return self.test_results
        
        print("\n🎯 HIGH PRIORITY TESTS")
        print("-" * 30)
        
        # High priority tests
        self.test_training_modules()
        
        # Oracle tests
        oracle_reading = self.test_oracle_draw()
        self.test_oracle_save(oracle_reading)
        self.test_oracle_readings()
        
        # Spirit guides (known to have budget issues)
        self.test_spirit_guides_chat()
        
        print("\n📊 MEDIUM PRIORITY TESTS")
        print("-" * 30)
        
        # Medium priority tests
        self.test_meditation_generate()
        
        # Journal tests
        self.test_journal_save()
        self.test_journal_entries()
        
        print("\n" + "=" * 60)
        print("🏁 Testing Complete")
        
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
    tester = PsychicAppTester()
    results = tester.run_all_tests()