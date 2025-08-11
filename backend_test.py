import requests
import sys
import json
from datetime import datetime

class HyperlocalEventsAPITester:
    def __init__(self, base_url="https://87a98626-6942-48bd-a10d-da71463a8101.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_event_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_get_events(self):
        """Test getting all events"""
        success, response = self.run_test("Get All Events", "GET", "api/events", 200)
        if success and isinstance(response, list):
            print(f"   Found {len(response)} events")
            if len(response) > 0:
                print(f"   Sample event: {response[0].get('title', 'No title')}")
        return success

    def test_create_event(self):
        """Test creating a new event"""
        test_event = {
            "title": "Test Event - API Testing",
            "description": "This is a test event created during API testing",
            "category": "Technology",
            "date": "2025-02-01",
            "time": "2:00 PM",
            "location": "Test Venue",
            "address": "123 Test St, Test City",
            "latitude": 40.7580,
            "longitude": -73.9855,
            "organizer": "API Test Suite",
            "price": "Free",
            "image_url": "https://images.unsplash.com/photo-1515169067868-5387ec356754"
        }
        
        success, response = self.run_test("Create Event", "POST", "api/events", 200, data=test_event)
        if success and 'id' in response:
            self.created_event_id = response['id']
            print(f"   Created event with ID: {self.created_event_id}")
        return success

    def test_nearby_events(self):
        """Test getting nearby events"""
        # Test with NYC coordinates
        params = {
            'lat': 40.7589,
            'lng': -73.9851,
            'radius': 15.0
        }
        success, response = self.run_test("Get Nearby Events", "GET", "api/events/nearby", 200, params=params)
        if success and isinstance(response, list):
            print(f"   Found {len(response)} nearby events within 15km")
            for event in response[:3]:  # Show first 3 events
                if 'distance' in event:
                    print(f"   - {event.get('title', 'No title')}: {event['distance']}km away")
        return success

    def test_chat_without_location(self):
        """Test chat endpoint without location"""
        chat_data = {
            "message": "What music events are happening this weekend?",
            "preferences": ["Music"]
        }
        success, response = self.run_test("Chat Without Location", "POST", "api/chat", 200, data=chat_data)
        if success and 'response' in response:
            print(f"   Bot response length: {len(response['response'])} characters")
            print(f"   Recommended events: {len(response.get('recommended_events', []))}")
        return success

    def test_chat_with_location(self):
        """Test chat endpoint with location"""
        chat_data = {
            "message": "What events are near me?",
            "latitude": 40.7589,
            "longitude": -73.9851,
            "preferences": ["Music", "Arts & Culture"]
        }
        success, response = self.run_test("Chat With Location", "POST", "api/chat", 200, data=chat_data)
        if success and 'response' in response:
            print(f"   Bot response length: {len(response['response'])} characters")
            print(f"   Recommended events: {len(response.get('recommended_events', []))}")
            # Check if response mentions distance or location
            if 'km' in response['response'].lower() or 'distance' in response['response'].lower():
                print("   ✅ Response includes distance information")
            else:
                print("   ⚠️  Response may not include distance information")
        return success

    def test_delete_event(self):
        """Test deleting an event"""
        if not self.created_event_id:
            print("⚠️  Skipping delete test - no event ID available")
            return True
        
        success, response = self.run_test("Delete Event", "DELETE", f"api/events/{self.created_event_id}", 200)
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Hyperlocal Events API Tests")
        print("=" * 50)
        
        # Test basic endpoints
        self.test_health_check()
        self.test_get_events()
        self.test_nearby_events()
        
        # Test event creation and deletion
        self.test_create_event()
        self.test_delete_event()
        
        # Test chat functionality
        self.test_chat_without_location()
        self.test_chat_with_location()
        
        # Print results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed")
            return 1

def main():
    tester = HyperlocalEventsAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())