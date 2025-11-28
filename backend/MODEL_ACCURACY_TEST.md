# Model Accuracy Testing Guide

## How to Test Your Emotion Detection Model

### Method 1: Using the Test Script (Recommended)

1. **Start your backend server:**
   ```bash
   cd backend
   python app.py
   ```

2. **Run the test script in a new terminal:**
   ```bash
   cd backend
   python test_model_accuracy.py
   ```

3. **View the results:**
   - The script will show:
     - Total number of test cases
     - Number of correct predictions
     - Overall accuracy percentage
     - Detailed results for each test case

### Method 2: Using the API Endpoint Directly

You can test the model accuracy by sending a POST request to `/api/test-model-accuracy`:

**Using curl:**
```bash
curl -X POST http://localhost:5000/api/test-model-accuracy \
  -H "Content-Type: application/json" \
  -d '{
    "test_cases": [
      {"text": "I feel anxious", "expected": "Anxiety/Worry"},
      {"text": "I am happy", "expected": "Joy/Happiness"}
    ]
  }'
```

**Using Python:**
```python
import requests

response = requests.post(
    "http://localhost:5000/api/test-model-accuracy",
    json={
        "test_cases": [
            {"text": "I feel anxious", "expected": "Anxiety/Worry"},
            {"text": "I am happy", "expected": "Joy/Happiness"}
        ]
    }
)

print(response.json())
```

### Understanding the Results

The test endpoint returns:
- **total_tests**: Number of test cases run
- **correct_predictions**: Number of correct predictions
- **accuracy**: Overall accuracy percentage
- **results**: Detailed results for each test case
- **model_info**: Information about the model

### Model Information

Your model uses:
- **Model Type**: DistilBertForSequenceClassification
- **Problem Type**: multi_label_classification (can predict multiple emotions)
- **Number of Labels**: 7 emotions
- **Emotion Labels**: 
  - Peace/Calm
  - Anxiety/Worry
  - Anger/Frustration
  - Stress/Tension
  - Sadness/Grief
  - Confusion/Doubt
  - Joy/Happiness

### Improving Model Accuracy

If accuracy is low, consider:
1. **Check the model threshold**: Currently set to 30% (0.3)
2. **Review training data**: Ensure the model was trained on similar text
3. **Adjust confidence filtering**: Modify the threshold in `predict_emotion()` function
4. **Retrain the model**: If accuracy is consistently low, you may need to retrain with more data

### Current Model Settings

- **Threshold**: 30% (emotions below this are filtered out)
- **Minimum Confidence**: 25% (below this defaults to Peace/Calm)
- **Normalization**: Emotion breakdown is normalized to sum to 100%

