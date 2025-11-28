"""
Test script to check model accuracy
Run this script to test your emotion detection model with sample inputs
"""

import requests
import json

API_URL = "http://localhost:5000"

# Test cases with expected emotions
test_cases = [
    {"text": "I feel so anxious about my exams tomorrow", "expected": "Anxiety/Worry"},
    {"text": "I'm really angry at my boss for treating me unfairly", "expected": "Anger/Frustration"},
    {"text": "I'm stressed out with all these deadlines", "expected": "Stress/Tension"},
    {"text": "I feel sad and lonely today", "expected": "Sadness/Grief"},
    {"text": "I'm confused about what to do next", "expected": "Confusion/Doubt"},
    {"text": "I feel peaceful and content right now", "expected": "Peace/Calm"},
    {"text": "I'm so happy and joyful today!", "expected": "Joy/Happiness"},
    {"text": "I'm worried about my future", "expected": "Anxiety/Worry"},
    {"text": "Everything is overwhelming me", "expected": "Stress/Tension"},
    {"text": "I feel calm and centered", "expected": "Peace/Calm"},
    {"text": "I'm frustrated with this situation", "expected": "Anger/Frustration"},
    {"text": "I don't know what to do, I'm so confused", "expected": "Confusion/Doubt"},
    {"text": "I feel great and positive today", "expected": "Joy/Happiness"},
    {"text": "I'm feeling down and depressed", "expected": "Sadness/Grief"},
    {"text": "I'm at peace with myself", "expected": "Peace/Calm"}
]

def test_model():
    """Test the model accuracy"""
    print("=" * 60)
    print("Testing Emotion Detection Model Accuracy")
    print("=" * 60)
    
    try:
        response = requests.post(
            f"{API_URL}/api/test-model-accuracy",
            json={"test_cases": test_cases},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n📊 Model Test Results:")
            print(f"   Total Tests: {data['total_tests']}")
            print(f"   Correct Predictions: {data['correct_predictions']}")
            print(f"   Accuracy: {data['accuracy']}%")
            
            print(f"\n📋 Model Information:")
            print(f"   Model Type: {data['model_info']['model_type']}")
            print(f"   Problem Type: {data['model_info']['problem_type']}")
            print(f"   Number of Labels: {data['model_info']['num_labels']}")
            print(f"   Emotion Labels: {', '.join(data['model_info']['emotion_labels'])}")
            
            print(f"\n📝 Detailed Results:")
            print("-" * 60)
            for i, result in enumerate(data['results'], 1):
                status = "✅" if result['correct'] else "❌"
                print(f"\n{status} Test {i}:")
                print(f"   Input: {result['input']}")
                print(f"   Expected: {result['expected']}")
                print(f"   Predicted: {result['predicted']} (Confidence: {result['confidence']}%)")
                if not result['correct']:
                    print(f"   ⚠️  Mismatch detected!")
            
            print("\n" + "=" * 60)
            print(f"Overall Accuracy: {data['accuracy']}%")
            print("=" * 60)
            
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
    
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to the API.")
        print("   Make sure the backend server is running on http://localhost:5000")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_model()

