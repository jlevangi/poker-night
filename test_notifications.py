#!/usr/bin/env python3
"""
Test script for notification functionality.
"""

import requests
import json


def test_notification_endpoints():
    """Test the notification API endpoints."""
    base_url = "http://localhost:5000"
    
    print("🧪 Testing Notification API Endpoints")
    print("=" * 50)
    
    # Test 1: Subscribe to notifications
    print("\n1. Testing subscription endpoint...")
    
    subscription_data = {
        "player_id": "pid_001",
        "session_id": "sid_20250820_001",
        "subscription": {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test_endpoint_123",
            "keys": {
                "auth": "test_auth_key_123",
                "p256dh": "test_p256dh_key_123"
            }
        }
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/notifications/subscribe",
            json=subscription_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 201:
            print("✅ Subscription test passed!")
        else:
            print("❌ Subscription test failed!")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed! Make sure Flask server is running on port 5000")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    
    # Test 2: Get player subscriptions
    print("\n2. Testing get subscriptions endpoint...")
    
    try:
        response = requests.get(f"{base_url}/api/notifications/subscriptions/pid_001")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Get subscriptions test passed!")
        else:
            print("❌ Get subscriptions test failed!")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    
    # Test 3: Unsubscribe
    print("\n3. Testing unsubscribe endpoint...")
    
    unsubscribe_data = {
        "player_id": "pid_001",
        "session_id": "sid_20250820_001"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/notifications/unsubscribe",
            json=unsubscribe_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Unsubscribe test passed!")
        else:
            print("❌ Unsubscribe test failed!")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    
    print("\n" + "=" * 50)
    print("✅ All notification endpoint tests completed!")
    return True


def test_session_summary():
    """Test session summary calculation locally."""
    print("\n🧪 Testing Session Summary Calculation")
    print("=" * 50)
    
    try:
        # Import our notification service
        import sys
        sys.path.append('/mnt/c/Users/pierc/git/poker-night')
        
        from app.services.notification_service import NotificationService
        from app import create_app
        
        # Create app context
        app = create_app()
        with app.app_context():
            notification_service = NotificationService()
            
            # Test with a fictional session ID
            print("\nTesting session summary calculation...")
            summary = notification_service.calculate_session_summary("test_session_123")
            
            print("Summary result:")
            print(json.dumps(summary, indent=2, default=str))
            
            if summary.get("error"):
                print("⚠️  Expected error (test session doesn't exist)")
            else:
                print("✅ Session summary calculation working!")
                
    except ImportError as e:
        print(f"❌ Import error: {str(e)}")
        print("Make sure you're in the correct directory with proper PYTHONPATH")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


if __name__ == "__main__":
    print("🚀 Starting Notification System Tests")
    print("Make sure Flask server is running on http://localhost:5000")
    print()
    
    # Test API endpoints
    endpoints_ok = test_notification_endpoints()
    
    # Test session summary calculation
    test_session_summary()
    
    print("\n🎉 Testing completed!")
    if endpoints_ok:
        print("Your notification system is ready for testing with a real browser!")
    else:
        print("Please check the Flask server and try again.")