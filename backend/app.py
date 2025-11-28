from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
import json
import os
from datetime import datetime
import random
from openai import OpenAI
from dotenv import load_dotenv

# Language detection
try:
    from langdetect import detect, DetectorFactory
    DetectorFactory.seed = 0  # for consistent results
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False
    print("Warning: langdetect not installed. Using simple language detection.")

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize model and tokenizer
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'gita_emotion_model')
GITA_DATASET_PATH = os.path.join(os.path.dirname(__file__), 'dataset', 'Gita.xlsx')
DATA_STORAGE_PATH = os.path.join(os.path.dirname(__file__), 'data_storage.json')

# Emotion labels mapping (adjust based on your model)
EMOTION_LABELS = {
    0: "Peace/Calm",
    1: "Anxiety/Worry",
    2: "Anger/Frustration",
    3: "Stress/Tension",
    4: "Sadness/Grief",
    5: "Confusion/Doubt",
    6: "Joy/Happiness"
}

# Load model and tokenizer
print("Loading model...")
tokenizer = DistilBertTokenizer.from_pretrained(MODEL_PATH)
model = DistilBertForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()
print("Model loaded successfully!")

# Initialize OpenAI client (optional - only if API key is provided)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
openai_client = None
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    print("OpenAI API initialized successfully!")
else:
    print("Warning: OPENAI_API_KEY not found. Using template-based responses.")

# Load Gita dataset
gita_df = None
dataset_columns = []
try:
    gita_df = pd.read_excel(GITA_DATASET_PATH)
    dataset_columns = list(gita_df.columns)
    print(f"Gita dataset loaded: {len(gita_df)} verses")
    print(f"Dataset columns: {dataset_columns}")
    # Print first row to see data structure
    if len(gita_df) > 0:
        print("\nSample row data:")
        for col in dataset_columns:
            print(f"  {col}: {gita_df.iloc[0].get(col, 'N/A')}")
except Exception as e:
    print(f"Warning: Could not load Gita dataset: {e}")

# Initialize data storage
def init_storage():
    if not os.path.exists(DATA_STORAGE_PATH):
        with open(DATA_STORAGE_PATH, 'w') as f:
            json.dump({"saved_verses": [], "emotion_history": []}, f)

def load_storage():
    init_storage()
    with open(DATA_STORAGE_PATH, 'r') as f:
        return json.load(f)

def save_storage(data):
    with open(DATA_STORAGE_PATH, 'w') as f:
        json.dump(data, f, indent=2)

def keyword_based_emotion_detection(text):
    """Fallback keyword-based emotion detection for better accuracy"""
    text_lower = text.lower()
    
    # Keyword mapping with weights (more matches = higher confidence)
    emotion_keywords = {
        "Anxiety/Worry": ["anxious", "anxiety", "worried", "worry", "nervous", "uneasy", "apprehensive", "fearful", "concerned", "tense"],
        "Anger/Frustration": ["angry", "anger", "frustrated", "frustration", "mad", "irritated", "annoyed", "furious", "rage", "resentful"],
        "Stress/Tension": ["stressed", "stress", "overwhelmed", "pressure", "tension", "strained", "burdened", "pressured", "overwhelming"],
        "Sadness/Grief": ["sad", "sadness", "depressed", "depression", "lonely", "down", "grief", "sorrow", "melancholy", "unhappy", "miserable"],
        "Confusion/Doubt": ["confused", "confusion", "doubt", "uncertain", "unsure", "unclear", "bewildered", "perplexed", "puzzled", "don't know"],
        "Joy/Happiness": ["happy", "happiness", "joy", "joyful", "cheerful", "glad", "delighted", "pleased", "great", "positive", "excited", "elated"],
        "Peace/Calm": ["peaceful", "peace", "calm", "content", "serene", "tranquil", "relaxed", "centered", "balanced", "at peace"]
    }
    
    emotion_scores = {}
    for emotion, keywords in emotion_keywords.items():
        score = sum(1 for keyword in keywords if keyword in text_lower)
        if score > 0:
            emotion_scores[emotion] = score
    
    if emotion_scores:
        # Get emotion with highest score
        primary_emotion = max(emotion_scores.items(), key=lambda x: x[1])[0]
        max_score = max(emotion_scores.values())
        total_score = sum(emotion_scores.values())
        
        # Calculate confidence: primary emotion gets higher confidence based on dominance
        # If primary has 2x more matches than others, give it high confidence
        if max_score >= 2 and max_score > total_score - max_score:
            confidence = min(95.0, 60.0 + (max_score / total_score) * 35.0)
        else:
            # If tied or close, use proportional confidence
            confidence = min(85.0, (max_score / total_score) * 100) if total_score > 0 else 50.0
        
        # Create breakdown with weighted percentages
        # Primary emotion gets proportionally more, others get less
        emotion_breakdown = {}
        for emotion, score in emotion_scores.items():
            if emotion == primary_emotion:
                # Primary gets higher percentage (capped at 95% to leave room)
                emotion_breakdown[emotion] = min(95.0, (score / total_score) * 100 + 15.0)
            else:
                # Others get lower percentage
                emotion_breakdown[emotion] = max(0.0, (score / total_score) * 100 - 10.0)
        
        # Ensure primary is highest (but don't exceed 100%)
        other_max = max([v for k, v in emotion_breakdown.items() if k != primary_emotion], default=0)
        if emotion_breakdown[primary_emotion] <= other_max:
            # Set primary to be higher, but cap at 100%
            emotion_breakdown[primary_emotion] = min(100.0, other_max + 5.0)
        
        # Cap all values at 100%
        for emotion in emotion_breakdown:
            emotion_breakdown[emotion] = min(100.0, max(0.0, emotion_breakdown[emotion]))
        
        return primary_emotion, confidence, emotion_breakdown
    
    return None, None, None

def predict_emotion(text):
    """Predict emotion from text using hybrid approach: model + keyword fallback"""
    if not text or not text.strip():
        return "Peace/Calm", 50.0, {"Peace/Calm": 50.0}
    
    # First try keyword-based detection (more reliable for common phrases)
    keyword_emotion, keyword_conf, keyword_breakdown = keyword_based_emotion_detection(text)
    
    # Get model prediction
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512, padding=True)
    
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.sigmoid(logits)
    
    # Get all probabilities from model
    all_probs = {}
    for idx, label in EMOTION_LABELS.items():
        if idx < probabilities.shape[1]:
            prob_value = float(probabilities[0][idx].item())
            all_probs[label] = prob_value * 100
    
    # Get model's primary prediction
    primary_idx = torch.argmax(probabilities, dim=1).item()
    model_emotion = EMOTION_LABELS.get(primary_idx, "Peace/Calm")
    model_confidence = float(probabilities[0][primary_idx].item() * 100)
    
    # Hybrid decision: Prioritize keyword-based detection (more reliable)
    # Only use model if keyword detection fails or has very low confidence
    if keyword_emotion and keyword_conf >= 40.0:
        # Use keyword-based detection (primary method - more reliable)
        primary_emotion = keyword_emotion
        confidence = keyword_conf
        # Merge keyword breakdown with model probabilities for complete picture
        # Use keyword breakdown for detected emotions, model for others
        emotion_breakdown = {}
        for emotion in EMOTION_LABELS.values():
            if emotion in keyword_breakdown:
                # Use keyword-based percentage (already normalized)
                emotion_breakdown[emotion] = keyword_breakdown[emotion]
            else:
                # Use model probability (raw, not normalized) for non-keyword emotions
                emotion_breakdown[emotion] = all_probs.get(emotion, 0.0)
        method = "keyword-based"
    elif model_confidence > 70.0:
        # Use model prediction only if very high confidence
        primary_emotion = model_emotion
        confidence = model_confidence
        # Use raw model probabilities for all emotions (not normalized)
        emotion_breakdown = all_probs.copy()
        method = "model-based (high confidence)"
    elif keyword_emotion:
        # Use keyword even with lower confidence
        primary_emotion = keyword_emotion
        confidence = max(keyword_conf, 50.0)
        # Merge keyword with model
        emotion_breakdown = {}
        for emotion in EMOTION_LABELS.values():
            if emotion in keyword_breakdown:
                emotion_breakdown[emotion] = keyword_breakdown[emotion]
            else:
                emotion_breakdown[emotion] = all_probs.get(emotion, 0.0)
        method = "keyword-based (low confidence)"
    else:
        # Fallback to model or default
        if model_confidence > 40.0:
            primary_emotion = model_emotion
            confidence = model_confidence
            # Use all model probabilities
            emotion_breakdown = all_probs.copy()
            method = "model-based (fallback)"
        else:
            primary_emotion = "Peace/Calm"
            confidence = 50.0
            # Default breakdown with all emotions
            emotion_breakdown = {}
            for emotion in EMOTION_LABELS.values():
                if emotion == "Peace/Calm":
                    emotion_breakdown[emotion] = 50.0
                elif emotion == "Anxiety/Worry":
                    emotion_breakdown[emotion] = 20.0
                elif emotion == "Stress/Tension":
                    emotion_breakdown[emotion] = 15.0
                elif emotion == "Confusion/Doubt":
                    emotion_breakdown[emotion] = 15.0
                else:
                    emotion_breakdown[emotion] = 0.0
            method = "default"
    
    # CRITICAL FIX: Ensure primary emotion is always the highest in breakdown
    # Also ensure all percentages are between 0-100%
    if emotion_breakdown:
        # First, cap all values at 100% and ensure non-negative
        for emotion in emotion_breakdown:
            emotion_breakdown[emotion] = max(0.0, min(100.0, emotion_breakdown[emotion]))
        
        # Find the actual highest emotion in the breakdown
        highest_emotion = max(emotion_breakdown.items(), key=lambda x: x[1])[0]
        highest_value = emotion_breakdown[highest_emotion]
        
        # If primary emotion is not the highest, make it the highest
        if primary_emotion != highest_emotion:
            # Adjust: set primary to be slightly higher than the current highest, but cap at 100%
            new_primary_value = min(100.0, highest_value + 2.0)
            # If that would make it too close to 100%, scale down others slightly
            if new_primary_value >= 99.0:
                # Scale down all others proportionally to make room
                scale_factor = 0.95
                for emotion in emotion_breakdown:
                    if emotion != primary_emotion:
                        emotion_breakdown[emotion] = emotion_breakdown[emotion] * scale_factor
                new_primary_value = min(100.0, max(emotion_breakdown.values()) + 2.0)
            
            emotion_breakdown[primary_emotion] = new_primary_value
            # Update confidence to match (capped at 100%)
            confidence = min(100.0, new_primary_value)
            print(f" Adjusted: {primary_emotion} set to {confidence:.2f}% (was {emotion_breakdown.get(primary_emotion, 0):.2f}%, highest was {highest_emotion} at {highest_value:.2f}%)")
        else:
            # Primary is already highest, but ensure it's clearly the highest and not over 100%
            second_highest = sorted([(k, v) for k, v in emotion_breakdown.items() if k != primary_emotion], 
                                  key=lambda x: x[1], reverse=True)
            if second_highest:
                current_primary = emotion_breakdown[primary_emotion]
                # If too close to second highest, increase primary (but cap at 100%)
                if current_primary <= second_highest[0][1] + 1.0:
                    new_primary_value = min(100.0, second_highest[0][1] + 2.0)
                    emotion_breakdown[primary_emotion] = new_primary_value
                    confidence = min(100.0, new_primary_value)
                # If primary is over 100%, cap it
                elif current_primary > 100.0:
                    emotion_breakdown[primary_emotion] = 100.0
                    confidence = 100.0
                else:
                    confidence = min(100.0, current_primary)
            else:
                # No other emotions, just cap at 100%
                emotion_breakdown[primary_emotion] = min(100.0, emotion_breakdown[primary_emotion])
                confidence = emotion_breakdown[primary_emotion]
        
        # Final safety check: ensure all values are 0-100%
        for emotion in emotion_breakdown:
            emotion_breakdown[emotion] = max(0.0, min(100.0, emotion_breakdown[emotion]))
        
        # Ensure confidence is also capped
        confidence = min(100.0, max(0.0, confidence))
    
    # Debug output
    print(f"\n=== Emotion Detection ({method}) ===")
    print(f"Input: {text[:100]}...")
    print(f"Keyword Detection: {keyword_emotion} ({keyword_conf:.2f}%)" if keyword_emotion else "Keyword Detection: None")
    print(f"Model Prediction: {model_emotion} ({model_confidence:.2f}%)")
    print(f"Final Decision: {primary_emotion} ({confidence:.2f}%)")
    print(f"Emotion Breakdown (sorted):")
    for emotion, conf in sorted(emotion_breakdown.items(), key=lambda x: x[1], reverse=True):
        marker = "✓ PRIMARY" if emotion == primary_emotion else " "
        print(f"  {marker} {emotion}: {conf:.2f}%")
    print(f"=======================\n")
    
    return primary_emotion, confidence, emotion_breakdown

def get_column_value(row, possible_names, default=""):
    """Helper function to get column value with multiple possible column names"""
    for name in possible_names:
        if name in row.index and pd.notna(row[name]):
            value = row[name]
            if pd.isna(value):
                return default
            return str(value).strip()
    return default

def get_gita_guidance(emotion):
    """Get relevant Gita verse based on emotion from dataset"""
    if gita_df is None or len(gita_df) == 0:
        # Fallback verses
        fallback_verses = {
            "Anxiety/Worry": {
                "chapter": 2,
                "verse": 47,
                "text": "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
                "meaning": "You have the right to perform your duty, but you are not entitled to the fruits of your actions.",
                "guidance": "Focus on your actions, not the results. Do your best and let go of anxiety about outcomes.",
                "what_happened": "You are feeling anxious about outcomes.",
                "krishna_vaani": "हे अर्जुन, मैं तुम्हारी चिंता को समझता हूँ। तुम्हारा कर्म ही तुम्हारा अधिकार है, फल की चिंता मत करो।"
            },
            "Anger/Frustration": {
                "chapter": 2,
                "verse": 56,
                "text": "दु:खेष्वनुद्विग्नमनाः सुखेषु विगतस्पृहः",
                "meaning": "One whose mind remains undisturbed in sorrow and is free from desire in pleasure.",
                "guidance": "Maintain equanimity in both joy and sorrow. This is the path to inner peace.",
                "what_happened": "You are experiencing anger or frustration.",
                "krishna_vaani": "प्रिय आत्मा, क्रोध मन को अशांत करता है। शांति और संतुलन बनाए रखो।"
            },
            "Stress/Tension": {
                "chapter": 6,
                "verse": 35,
                "text": "असंशयं महाबाहो मनो दुर्निग्रहं चलम्",
                "meaning": "The mind is restless and difficult to control, but it can be controlled through practice and detachment.",
                "guidance": "Practice meditation and detachment to calm your restless mind.",
                "what_happened": "You are feeling stressed or tense.",
                "krishna_vaani": "हे मित्र, तनाव स्वाभाविक है, लेकिन अभ्यास से मन को वश में किया जा सकता है।"
            }
        }
        return fallback_verses.get(emotion, fallback_verses["Anxiety/Worry"])
    
    # Try to find relevant verse from dataset
    try:
        verse = None
        
        # Try to filter by emotion if Emotion column exists
        emotion_keywords = [emotion.split('/')[0].lower(), emotion.lower()]
        if 'Emotion' in gita_df.columns:
            for keyword in emotion_keywords:
                relevant = gita_df[gita_df['Emotion'].astype(str).str.contains(keyword, case=False, na=False)]
                if len(relevant) > 0:
                    verse = relevant.iloc[random.randint(0, len(relevant)-1)]
                    break
        
        # If no match found, select random verse
        if verse is None:
            verse = gita_df.iloc[random.randint(0, len(gita_df)-1)]
        
        # Get values with flexible column name matching - try actual dataset column names first
        # Based on terminal output: "What happen", "KrishnaVani", "Guidance"
        chapter = get_column_value(verse, ['chapter_number'] + dataset_columns, 2)
        verse_num = get_column_value(verse, ['chapter_verse'] + dataset_columns, 47)
        text = get_column_value(verse, ['Text', 'text', 'Verse Text', 'Verse_Text', 'Sanskrit', 'VerseText'] + dataset_columns, '')
        meaning = get_column_value(verse, ['translation'] + dataset_columns, '')
        # Use exact column names from dataset (terminal shows: "What happen", "KrishnaVani", "Guidance")
        guidance = get_column_value(verse, ['Guidance'] + dataset_columns, '')
        what_happened = get_column_value(verse, ['What happen'] + dataset_columns, '')
        krishna_vaani = get_column_value(verse, ['KrishnaVani'] + dataset_columns, '')
        
        # Debug: Print what we found
        print(f"\n=== Extracted Data ===")
        print(f"What happen: {what_happened[:100] if what_happened else 'NOT FOUND'}...")
        print(f"KrishnaVani: {krishna_vaani[:100] if krishna_vaani else 'NOT FOUND'}...")
        print(f"Guidance: {guidance[:100] if guidance else 'NOT FOUND'}...")
        print(f"Chapter: {chapter}, Verse: {verse_num}")
        print(f"=====================\n")
        
        # Convert chapter and verse to int
        try:
            chapter = int(float(chapter)) if chapter else 2
        except:
            chapter = 2
        
        try:
            verse_num = int(float(verse_num)) if verse_num else 47
        except:
            verse_num = 47
        
        return {
            "chapter": chapter,
            "verse": verse_num,
            "text": text if text else "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
            "meaning": meaning if meaning else "Focus on your duty, not the results.",
            "guidance": guidance if guidance else "Do your best and trust the process.",
            "what_happened": what_happened if what_happened else f"You are experiencing {emotion.split('/')[0].lower()}.",
            "krishna_vaani": krishna_vaani if krishna_vaani else f"हे अर्जुन, {guidance if guidance else 'मैं तुम्हारे साथ हूँ।'}"
        }
    except Exception as e:
        print(f"Error getting Gita verse: {e}")
        import traceback
        traceback.print_exc()
        return {
            "chapter": 2,
            "verse": 47,
            "text": "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
            "meaning": "You have the right to perform your duty, but you are not entitled to the fruits of your actions.",
            "guidance": "Focus on your actions, not the results.",
            "what_happened": f"You are experiencing {emotion.split('/')[0].lower()}.",
            "krishna_vaani": "हे अर्जुन, मैं तुम्हारे साथ हूँ।"
        }

def generate_krishna_vaani(emotion, guidance_data):
    """Get Krishna Vaani from dataset (already included in guidance_data)"""
    # Krishna Vaani is already extracted from dataset in get_gita_guidance
    return guidance_data.get('krishna_vaani', f"हे अर्जुन, {guidance_data.get('guidance', 'मैं तुम्हारे साथ हूँ।')} मैं तुम्हारे साथ हूँ।")

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "message": "Krishna Vaani API is running"})

@app.route('/api/guidance', methods=['POST'])
def get_guidance():
    try:
        data = request.json
        user_input = data.get('input', '')
        
        if not user_input:
            return jsonify({"error": "Input is required"}), 400
        
        # Predict emotion
        emotion, confidence, emotion_breakdown = predict_emotion(user_input)
        
        # Get Gita guidance
        guidance_data = get_gita_guidance(emotion)
        
        # Generate Krishna Vaani
        krishna_vaani = generate_krishna_vaani(emotion, guidance_data)
        
        # Save emotion history
        storage = load_storage()
        emotion_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_input": user_input,
            "emotion": emotion,
            "confidence": confidence,
            "emotion_breakdown": emotion_breakdown,
            "verse": f"Chapter {guidance_data['chapter']}, Verse {guidance_data['verse']}",
            "type": "guidance"
        }
        storage["emotion_history"].append(emotion_entry)
        save_storage(storage)
        
        # Final safety check: ensure confidence and all breakdown values are 0-100%
        confidence = max(0.0, min(100.0, confidence))
        for emotion_key in emotion_breakdown:
            emotion_breakdown[emotion_key] = max(0.0, min(100.0, emotion_breakdown[emotion_key]))
        
        response = {
            "user_input": user_input,
            "detected_emotion": emotion,
            "confidence": round(confidence, 2),
            "emotion_breakdown": {k: round(v, 2) for k, v in emotion_breakdown.items()},
            "what_happened": guidance_data.get('what_happened', f"You are experiencing {emotion.split('/')[0].lower()}."),
            "gita_guidance": {
                "verse": f"Chapter {guidance_data['chapter']}, Verse {guidance_data['verse']}",
                "chapter": f"Chapter {guidance_data['chapter']}",
                "verse_number": guidance_data['verse'],
                "chapter_number": guidance_data['chapter'],
                "text": guidance_data['text'],
                "meaning": guidance_data['meaning'],
                "guidance": guidance_data['guidance']
            },
            "krishna_vaani": krishna_vaani
        }
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/save-verse', methods=['POST'])
def save_verse():
    try:
        data = request.json
        storage = load_storage()
        
        verse_data = {
            "id": len(storage["saved_verses"]) + 1,
            "timestamp": datetime.now().isoformat(),
            "chapter": data.get('chapter'),
            "verse": data.get('verse'),
            "chapter_number": data.get('chapter_number'),
            "verse_number": data.get('verse_number'),
            "text": data.get('text'),
            "meaning": data.get('meaning'),
            "guidance": data.get('guidance'),
            "krishna_vaani": data.get('krishna_vaani'),
            "what_happened": data.get('what_happened'),
            "emotion": data.get('emotion')
        }
        
        storage["saved_verses"].append(verse_data)
        save_storage(storage)
        
        return jsonify({"success": True, "message": "Verse saved successfully", "verse": verse_data})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/saved-verses', methods=['GET'])
def get_saved_verses():
    try:
        storage = load_storage()
        return jsonify({"saved_verses": storage["saved_verses"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/saved-verse/<int:verse_id>', methods=['DELETE'])
def delete_saved_verse(verse_id):
    try:
        storage = load_storage()
        storage["saved_verses"] = [v for v in storage["saved_verses"] if v.get('id') != verse_id]
        save_storage(storage)
        return jsonify({"success": True, "message": "Verse deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/emotion-history', methods=['GET'])
def get_emotion_history():
    try:
        storage = load_storage()
        days = request.args.get('days', 7, type=int)
        
        # Filter by days
        cutoff_date = datetime.now().timestamp() - (days * 24 * 60 * 60)
        history = []
        for entry in storage["emotion_history"]:
            entry_time = datetime.fromisoformat(entry["timestamp"]).timestamp()
            if entry_time >= cutoff_date:
                history.append(entry)
        
        return jsonify({"emotion_history": history})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/emotion-stats', methods=['GET'])
def get_emotion_stats():
    try:
        storage = load_storage()
        days = request.args.get('days', 7, type=int)
        
        cutoff_date = datetime.now().timestamp() - (days * 24 * 60 * 60)
        history = []
        for entry in storage["emotion_history"]:
            entry_time = datetime.fromisoformat(entry["timestamp"]).timestamp()
            if entry_time >= cutoff_date:
                history.append(entry)
        
        if not history:
            return jsonify({
                "total_entries": 0,
                "emotion_counts": {},
                "most_frequent_emotion": None,
                "emotion_trends": [],
                "emotional_health_score": 0,
                "insights": []
            })
        
        # Count emotions
        emotion_counts = {}
        for entry in history:
            emotion = entry.get("emotion", "Unknown")
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        # Most frequent emotion
        most_frequent = max(emotion_counts.items(), key=lambda x: x[1]) if emotion_counts else (None, 0)
        most_frequent_percentage = (most_frequent[1] / len(history) * 100) if history else 0
        
        # Calculate emotional health score (higher for positive emotions)
        positive_emotions = ["Peace/Calm", "Joy/Happiness"]
        negative_emotions = ["Anxiety/Worry", "Anger/Frustration", "Stress/Tension", "Sadness/Grief"]
        
        positive_count = sum(emotion_counts.get(e, 0) for e in positive_emotions)
        negative_count = sum(emotion_counts.get(e, 0) for e in negative_emotions)
        
        if len(history) > 0:
            health_score = int((positive_count / len(history)) * 100)
        else:
            health_score = 0
        
        # Generate insights
        insights = []
        if most_frequent[0] in negative_emotions:
            insights.append(f"You were most frequently experiencing {most_frequent[0].split('/')[0]} this week.")
        if positive_count > negative_count:
            insights.append("Your emotional state has been improving!")
        if len(history) >= 3:
            recent_emotions = [h.get("emotion") for h in history[-3:]]
            if all(e in positive_emotions for e in recent_emotions):
                insights.append("You've been feeling more peaceful recently.")
        
        # Emotion trends by day
        from collections import defaultdict
        daily_emotions = defaultdict(lambda: defaultdict(int))
        for entry in history:
            date = datetime.fromisoformat(entry["timestamp"]).strftime("%Y-%m-%d")
            emotion = entry.get("emotion", "Unknown")
            daily_emotions[date][emotion] += 1
        
        emotion_trends = []
        for date in sorted(daily_emotions.keys())[-days:]:
            day_data = {"date": date, "emotions": dict(daily_emotions[date])}
            emotion_trends.append(day_data)
        
        return jsonify({
            "total_entries": len(history),
            "emotion_counts": emotion_counts,
            "most_frequent_emotion": {
                "emotion": most_frequent[0],
                "count": most_frequent[1],
                "percentage": round(most_frequent_percentage, 2)
            },
            "emotion_trends": emotion_trends,
            "emotional_health_score": health_score,
            "insights": insights,
            "emotion_distribution": {k: round((v / len(history)) * 100, 1) for k, v in emotion_counts.items()} if history else {}
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/krishna-chat', methods=['POST'])
def krishna_chat():
    """Krishna chatbot endpoint - responds as Krishna using Gita context"""
    try:
        data = request.json
        user_message = data.get('message', '')
        context = data.get('context', {})  # Should contain chapter, verse, emotion, what_happened, krishna_vaani
        
        if not user_message:
            return jsonify({"error": "Message is required"}), 400
        
        # Extract context
        chapter = context.get('chapter', 'Unknown')
        verse = context.get('verse', 'Unknown')
        emotion = context.get('emotion', 'Unknown')
        what_happened = context.get('what_happened', '')
        krishna_vaani = context.get('krishna_vaani', '')
        verse_text = context.get('verse_text', '')
        verse_meaning = context.get('verse_meaning', '')
        guidance = context.get('guidance', '')
        
        # Generate Krishna's response following the format
        krishna_response = generate_krishna_chat_response(
            user_message, chapter, verse, emotion, what_happened, 
            krishna_vaani, verse_text, verse_meaning, guidance
        )
        
        # Save chat history
        storage = load_storage()
        if 'chat_history' not in storage:
            storage['chat_history'] = []
        
        chat_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_message": user_message,
            "krishna_response": krishna_response,
            "context": context
        }
        storage['chat_history'].append(chat_entry)
        save_storage(storage)
        
        return jsonify({
            "response": krishna_response,
            "timestamp": chat_entry["timestamp"]
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def generate_krishna_chat_response(user_message, chapter, verse, emotion, what_happened, 
                                   krishna_vaani, verse_text, verse_meaning, guidance):
    """Generate Krishna's response using ChatGPT API if available, otherwise use templates"""
    
    # Try using ChatGPT API if available
    if openai_client:
        try:
            return generate_krishna_response_with_chatgpt(
                user_message, chapter, verse, emotion, what_happened,
                krishna_vaani, verse_text, verse_meaning, guidance
            )
        except Exception as e:
            print(f"Error with ChatGPT API: {e}")
            print("Falling back to template-based response...")
            # Fall through to template-based response
    
    # Template-based response (fallback or when API key not available)
    return generate_krishna_template_response(
        user_message, chapter, verse, emotion, what_happened,
        krishna_vaani, verse_text, verse_meaning, guidance
    )

def detect_user_language(text):
    """Detect user's language from their message"""
    if not text or not text.strip():
        return "en"
    
    # First check for Hindi/Devanagari script (most reliable)
    if any('\u0900' <= char <= '\u097F' for char in text):
        return "hi"
    
    # Try using langdetect if available
    if LANGDETECT_AVAILABLE:
        try:
            detected = detect(text)
            # Map common language codes
            if detected in ['hi', 'mr', 'gu', 'pa', 'bn', 'ne']:  # Indian languages
                return "hi"
            return detected
        except:
            pass
    
    # Fallback: Check for common Hindi words
    hindi_words = ['क्या', 'कैसे', 'क्यों', 'मैं', 'तुम', 'है', 'हूं', 'हो', 'मुझे', 'आप', 'यह', 'वह']
    text_lower = text.lower()
    if any(word in text for word in hindi_words):
        return "hi"
    
    # Default to English
    return "en"

def generate_krishna_response_with_chatgpt(user_message, chapter, verse, emotion, what_happened,
                                           krishna_vaani, verse_text, verse_meaning, guidance):
    """Generate Krishna's response using ChatGPT API"""
    
    # Detect language from user message
    detected_lang_code = detect_user_language(user_message)
    detected_language = "Hindi" if detected_lang_code == "hi" else "English"
    
    # Build system prompt for Krishna character with language support
    system_prompt = f"""You are Krishna, the divine guide from the Bhagavad Gita. You are speaking to Arjuna (or addressing the user as "my child", "dear soul", or "Parth").

IMPORTANT LANGUAGE INSTRUCTION:
- The user is communicating in {detected_language}
- You MUST respond in the SAME LANGUAGE as the user's message
- If the user writes in Hindi, respond in Hindi
- If the user writes in English, respond in English
- If the user writes in any other language, respond in that same language
- Maintain the spiritual and compassionate tone of Krishna in whatever language you use

CRITICAL: You MUST respond to what the user is actually asking:
- If they ask "give more" or "tell more" or "explain more" - provide MORE DETAILED explanation
- If they ask "next verse" or "another verse" - provide information about a DIFFERENT verse (you can suggest another relevant verse)
- If they ask "explain" or "what does this mean" - provide DEEPER explanation of the verse
- If they ask "what should I do" or "guidance" - provide PRACTICAL step-by-step guidance
- If they ask a specific question - ANSWER THAT QUESTION directly
- DO NOT give the same generic response every time - ADAPT to what they're asking

Your role:
- Speak with calmness, wisdom, and compassion, just as Krishna guided Arjuna
- Address the user as "Arjuna", "my child", "dear soul", or "Parth" (or equivalent in the user's language)
- Explain Gita teachings in a simple but spiritual way
- Give clear emotional guidance based on the user's feelings
- Maintain Bhagavad Gita tone: spiritual, compassionate, detached, truthful
- Do NOT break character
- Do NOT speak like a modern chatbot
- You are Krishna giving divine guidance
- ALWAYS respond to the user's actual question or request

Your response format:
1. Address the user with compassion (in their language)
2. Directly respond to what they asked (if they asked for more, give more; if they asked for next verse, give next verse info)
3. If relevant, acknowledge their emotion using Gita-based psychology
4. Explain the meaning of the given verse (or a different verse if they asked for next verse)
5. Connect the verse to the user's current situation
6. Give a direct yet gentle piece of guidance
7. End with a short Krishna-style reassurance

Keep responses meaningful and appropriate to what they asked. Always respond in the same language as the user's message."""
    
    # Build context for the conversation
    context_info = f"""Context from the Gita:
- Chapter: {chapter}
- Verse: {verse}
- User's Emotion: {emotion}
- What Happened: {what_happened if what_happened else 'Not specified'}
- Verse Text: {verse_text if verse_text else 'Not available'}
- Verse Meaning: {verse_meaning if verse_meaning else 'Not available'}
- Guidance: {guidance if guidance else 'Not available'}
- Krishna Vaani: {krishna_vaani if krishna_vaani else 'Not available'}

Use this context fully while replying. Reference the specific chapter and verse when relevant."""
    
    # Create the user message with context
    full_user_message = f"{context_info}\n\nUser's question/message: {user_message}"
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",  # You can use "gpt-4" for better responses
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": full_user_message}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        krishna_response = response.choices[0].message.content.strip()
        return krishna_response
    
    except Exception as e:
        print(f"OpenAI API error: {e}")
        raise

def generate_krishna_template_response(user_message, chapter, verse, emotion, what_happened,
                                      krishna_vaani, verse_text, verse_meaning, guidance):
    """Generate Krishna's response using templates (fallback) - supports Hindi and English"""
    
    # Detect language
    detected_lang_code = detect_user_language(user_message)
    is_hindi = detected_lang_code == "hi"
    
    # Analyze user's message to understand what they're asking
    user_msg_lower = user_message.lower()
    
    # Check for common question patterns
    asking_for_more = any(phrase in user_msg_lower for phrase in [
        'more', 'give more', 'tell more', 'explain more', 'aur batao', 'और बताओ', 
        'aur', 'more detail', 'detailed', 'विस्तार से', 'batao', 'बताओ'
    ])
    
    asking_for_next_verse = any(phrase in user_msg_lower for phrase in [
        'next verse', 'next shloka', 'next', 'अगला श्लोक', 'अगला', 'next verse please',
        'another verse', 'दूसरा श्लोक', 'अन्य श्लोक', 'doosra shlok', 'दूसरा'
    ])
    
    asking_for_explanation = any(phrase in user_msg_lower for phrase in [
        'explain', 'what does this mean', 'meaning', 'samjhao', 'समझाओ', 
        'kaise', 'कैसे', 'kyon', 'क्यों', 'how', 'why', 'matlab', 'मतलब'
    ])
    
    asking_for_guidance = any(phrase in user_msg_lower for phrase in [
        'guidance', 'help', 'what should i do', 'kya kare', 'क्या करें', 
        'advice', 'suggest', 'salah', 'सलाह', 'kya karna chahiye', 'क्या करना चाहिए'
    ])
    
    # If asking for next verse, get a different verse from dataset
    if asking_for_next_verse:
        try:
            new_guidance = get_gita_guidance(emotion)
            chapter = new_guidance.get('chapter', chapter)
            verse = new_guidance.get('verse', verse)
            verse_text = new_guidance.get('text', verse_text)
            verse_meaning = new_guidance.get('meaning', verse_meaning)
            guidance = new_guidance.get('guidance', guidance)
            what_happened = new_guidance.get('what_happened', what_happened)
            krishna_vaani = new_guidance.get('krishna_vaani', krishna_vaani)
        except:
            pass  # Keep original values if error
    
    if is_hindi:
        # Hindi addresses
        addresses = ["अर्जुन", "मेरे बच्चे", "प्रिय आत्मा", "पार्थ"]
        address = addresses[abs(hash(user_message)) % len(addresses)]
        
        # Hindi emotion acknowledgments
        emotion_acknowledgments = {
            "Anxiety/Worry": "मैं तुम्हारे हृदय में बेचैनी देख रहा हूँ, {}। यह चिंता परिणामों से लगाव से उत्पन्न होती है। गीता हमें सिखाती है कि चिंता विशिष्ट परिणामों की इच्छा से जन्म लेती है।",
            "Anger/Frustration": "तुम्हारे भीतर क्रोध की आग जल रही है, {}। यह भावना बुद्धि को धुंधला करती है और दुख पैदा करती है। याद रखो, क्रोध अधूरी इच्छाओं से जन्म लेता है।",
            "Stress/Tension": "तुम्हारा मन तनाव से भरा है, {}। यह तनाव उस चीज़ को नियंत्रित करने की कोशिश से आता है जो तुम्हारे नियंत्रण से बाहर है।",
            "Sadness/Grief": "मैं तुम्हारे हृदय में दुख का बोझ महसूस कर रहा हूँ, {}। दुख स्वाभाविक है, लेकिन याद रखो यह अस्थायी है, जैसे आकाश में बादल गुजरते हैं।",
            "Peace/Calm": "तुम्हारा हृदय शांति में है, {}। यह शांति समझ और स्वीकृति का फल है।",
            "Confusion/Doubt": "तुम्हारे मन में भ्रम है, {}। जीवन की जटिलताओं का सामना करते समय संदेह स्वाभाविक है। ज्ञान और अभ्यास से स्पष्टता आती है।",
            "Joy/Happiness": "तुम्हारा हृदय आनंद से भरा है, {}। यह खुशी, जब साझा की जाती है, तो बढ़ती है और दूसरों में प्रकाश लाती है।"
        }
        
        # Respond based on what user is asking
        if asking_for_next_verse:
            emotion_ack = f"निश्चित रूप से, {address}। यहाँ एक और श्लोक है जो तुम्हारी स्थिति के लिए प्रासंगिक है।"
        elif asking_for_more:
            emotion_ack = f"बेशक, {address}। मैं तुम्हें और विस्तार से समझाता हूँ।"
        elif asking_for_explanation:
            emotion_ack = f"मैं तुम्हें समझाता हूँ, {address}।"
        elif asking_for_guidance:
            emotion_ack = f"मैं तुम्हारी मदद करूंगा, {address}।"
        else:
            emotion_ack = emotion_acknowledgments.get(emotion, f"मैं तुम्हारी स्थिति को समझता हूँ, {address}।")
        
        if not (asking_for_next_verse or asking_for_more or asking_for_explanation or asking_for_guidance):
            emotion_ack = emotion_ack.format(address)
        
        # Verse explanation in Hindi
        if verse_text and verse_meaning:
            if asking_for_explanation or asking_for_more:
                verse_explanation = f"अध्याय {chapter}, श्लोक {verse} में, गीता प्रकट करती है: '{verse_text}'।\n\nइसका गहरा अर्थ है: {verse_meaning}।\n\nयह श्लोक हमें सिखाता है कि जीवन में हमारा ध्यान कर्म पर होना चाहिए, फल पर नहीं। जब हम परिणामों की चिंता छोड़ देते हैं, तो हमारा मन शांत रहता है और हम अपना सर्वश्रेष्ठ दे पाते हैं।"
            else:
                verse_explanation = f"अध्याय {chapter}, श्लोक {verse} में, गीता प्रकट करती है: '{verse_text}'। इसका अर्थ है: {verse_meaning}।"
        elif chapter != 'Unknown' and verse != 'Unknown':
            verse_explanation = f"अध्याय {chapter}, श्लोक {verse} में, गीता तुम्हारी स्थिति के लिए ज्ञान प्रदान करती है।"
        else:
            verse_explanation = "गीता तुम्हारी स्थिति के लिए कालातीत ज्ञान प्रदान करती है।"
        
        # Connection to situation in Hindi
        if asking_for_more or asking_for_explanation:
            if what_happened and guidance:
                situation_connection = f"तुम्हारी स्थिति के संदर्भ में: {what_happened}\n\nयह श्लोक सीधे तुम्हारी स्थिति से जुड़ता है क्योंकि यह हमें सिखाता है कि {guidance}\n\nइसका मतलब है कि तुम्हें अपने कर्म पर ध्यान देना चाहिए, न कि परिणामों पर। जब तुम अपना काम पूरी निष्ठा से करते हो, तो परिणाम अपने आप सही हो जाते हैं।"
            elif guidance:
                situation_connection = f"यह श्लोक तुम्हारी वर्तमान स्थिति से जुड़ता है। विस्तार से कहें तो: {guidance}\n\nइसका अभ्यास करने के लिए, हर दिन अपने कर्तव्य को पूरी ईमानदारी से निभाओ, लेकिन परिणाम की चिंता मत करो।"
            elif what_happened:
                situation_connection = f"तुम्हारी स्थिति मुझे {what_happened} की याद दिलाती है। गीता हमें सिखाती है कि ऐसे क्षणों का सामना समभाव से करें। इसका मतलब है कि तुम्हें न तो सफलता पर अत्यधिक खुश होना चाहिए और न ही असफलता पर अत्यधिक दुखी।"
            else:
                situation_connection = "गीता का ज्ञान जीवन की सभी स्थितियों पर लागू होता है, तुम्हारी स्थिति पर भी। यह हमें सिखाता है कि जीवन में संतुलन बनाए रखना कितना महत्वपूर्ण है।"
        else:
            if what_happened and guidance:
                situation_connection = f"जैसे {what_happened}, यह श्लोक सीधे तुम्हारी स्थिति से बात करता है। यहाँ ज्ञान यह है कि {guidance}"
            elif guidance:
                situation_connection = f"यह श्लोक तुम्हारी वर्तमान स्थिति से जुड़ता है। मार्गदर्शन यह है: {guidance}"
            elif what_happened:
                situation_connection = f"तुम्हारी स्थिति मुझे {what_happened} की याद दिलाती है। गीता हमें सिखाती है कि ऐसे क्षणों का सामना समभाव से करें।"
            else:
                situation_connection = "गीता का ज्ञान जीवन की सभी स्थितियों पर लागू होता है, तुम्हारी स्थिति पर भी।"
        
        # Direct guidance in Hindi
        if asking_for_guidance or asking_for_more:
            direct_guidance = f"इसलिए, {address}, यहाँ तुम्हारे लिए कुछ व्यावहारिक मार्गदर्शन है:\n\n1. अपने कर्तव्य पर ध्यान दो, परिणामों पर नहीं\n2. अपने कर्म को समर्पण और ईमानदारी से करो\n3. परिणामों की चिंता को छोड़ दो - वे अपने आप सही होंगे\n4. हर दिन ध्यान या प्रार्थना के लिए कुछ समय निकालो\n5. जो हो रहा है उसे स्वीकार करो और आगे बढ़ो\n\nयह आंतरिक शांति का मार्ग है।"
        else:
            direct_guidance = f"इसलिए, {address}, परिणामों से लगाव के बिना अपने कर्तव्य पर ध्यान दो। अपने कर्म को समर्पण के साथ करो, लेकिन परिणामों की चिंता को छोड़ दो। यह आंतरिक शांति का मार्ग है।"
        
        # Hindi reassurances
        reassurances = [
            "याद रखो, मैं हमेशा तुम्हारे साथ हूँ, जीवन के युद्धक्षेत्र में तुम्हारा मार्गदर्शन करता हूँ।",
            "विश्वास रखो, {}। धर्म का मार्ग तुम्हें शांति की ओर ले जाएगा।",
            "प्रक्रिया पर भरोसा रखो, {}। हर चुनौती एक शिक्षक है जो छुपा हुआ है।",
            "तुम जितना जानते हो उससे कहीं अधिक मजबूत हो, {}। गीता का ज्ञान तुम्हारी ढाल है।"
        ]
        reassurance = reassurances[abs(hash(user_message)) % len(reassurances)].format(address)
        
    else:
        # English addresses
        addresses = ["Arjuna", "my child", "dear soul", "Parth"]
        address = addresses[abs(hash(user_message)) % len(addresses)]
        
        # English emotion acknowledgments
        emotion_acknowledgments = {
            "Anxiety/Worry": "I see the restlessness in your heart, {}. This anxiety arises from attachment to outcomes. The Gita teaches us that worry is born from desire for specific results.",
            "Anger/Frustration": "The fire of anger burns within you, {}. This emotion clouds wisdom and creates suffering. Remember, anger is born from unfulfilled desires.",
            "Stress/Tension": "Your mind is burdened with tension, {}. This stress comes from trying to control what is beyond your control.",
            "Sadness/Grief": "I feel the weight of sorrow in your heart, {}. Grief is natural, but remember it is temporary, like clouds passing through the sky.",
            "Peace/Calm": "Your heart is at peace, {}. This tranquility is the fruit of understanding and acceptance.",
            "Confusion/Doubt": "Confusion clouds your mind, {}. Doubt is natural when facing life's complexities. Clarity comes through knowledge and practice.",
            "Joy/Happiness": "Your heart is filled with joy, {}. This happiness, when shared, multiplies and brings light to others."
        }
        
        # Respond based on what user is asking
        if asking_for_next_verse:
            emotion_ack = f"Certainly, {address}. Here is another verse relevant to your situation."
        elif asking_for_more:
            emotion_ack = f"Of course, {address}. Let me explain in more detail."
        elif asking_for_explanation:
            emotion_ack = f"Let me explain, {address}."
        elif asking_for_guidance:
            emotion_ack = f"I will help you, {address}."
        else:
            emotion_ack = emotion_acknowledgments.get(emotion, f"I understand your state, {address}.")
            emotion_ack = emotion_ack.format(address)
        
        # Verse explanation in English
        if verse_text and verse_meaning:
            if asking_for_explanation or asking_for_more:
                verse_explanation = f"In Chapter {chapter}, Verse {verse}, the Gita reveals: '{verse_text}'.\n\nThis verse has a deeper meaning: {verse_meaning}.\n\nThis teaching reminds us that in life, our focus should be on our actions (karma), not on the results (phala). When we release our attachment to outcomes, our mind remains calm and we can perform at our best."
            else:
                verse_explanation = f"In Chapter {chapter}, Verse {verse}, the Gita reveals: '{verse_text}'. This means: {verse_meaning}."
        elif chapter != 'Unknown' and verse != 'Unknown':
            verse_explanation = f"In Chapter {chapter}, Verse {verse}, the Gita offers wisdom for your situation."
        else:
            verse_explanation = "The Gita offers timeless wisdom for your situation."
        
        # Connection to situation in English
        if asking_for_more or asking_for_explanation:
            if what_happened and guidance:
                situation_connection = f"In the context of your situation: {what_happened}\n\nThis verse connects directly to your situation because it teaches us that {guidance}\n\nThis means you should focus on your duty, not on the results. When you perform your work with complete dedication, the results naturally turn out right."
            elif guidance:
                situation_connection = f"This verse connects to your current state. In detail: {guidance}\n\nTo practice this, perform your duty with complete honesty every day, but don't worry about the outcome."
            elif what_happened:
                situation_connection = f"Your situation reminds me of {what_happened}. The Gita teaches us to face such moments with equanimity. This means you should neither be overly happy in success nor overly sad in failure."
            else:
                situation_connection = "The Gita's wisdom applies to all situations in life, including yours. It teaches us how important it is to maintain balance in life."
        else:
            if what_happened and guidance:
                situation_connection = f"Just as {what_happened}, this verse speaks directly to your situation. The wisdom here is that {guidance}"
            elif guidance:
                situation_connection = f"This verse connects to your current state. The guidance is: {guidance}"
            elif what_happened:
                situation_connection = f"Your situation reminds me of {what_happened}. The Gita teaches us to face such moments with equanimity."
            else:
                situation_connection = "The Gita's wisdom applies to all situations in life, including yours."
        
        # Direct guidance in English
        if asking_for_guidance or asking_for_more:
            direct_guidance = f"Therefore, {address}, here is some practical guidance for you:\n\n1. Focus on your duty, not the results\n2. Perform your actions with dedication and honesty\n3. Release anxiety about outcomes - they will naturally be right\n4. Set aside some time each day for meditation or prayer\n5. Accept what is happening and move forward\n\nThis is the path to inner peace."
        else:
            direct_guidance = f"Therefore, {address}, focus on your duty without attachment to results. Perform your actions with dedication, but release the anxiety about outcomes. This is the path to inner peace."
        
        # English reassurances
        reassurances = [
            "Remember, I am always with you, guiding you through the battlefield of life.",
            "Have faith, {}. The path of dharma will lead you to peace.",
            "Trust in the process, {}. Every challenge is a teacher in disguise.",
            "You are stronger than you know, {}. The Gita's wisdom is your shield."
        ]
        reassurance = reassurances[abs(hash(user_message)) % len(reassurances)].format(address)
    
    # Combine into full response
    full_response = f"{emotion_ack}\n\n{verse_explanation}\n\n{situation_connection}\n\n{direct_guidance}\n\n{reassurance}"
    
    return full_response

@app.route('/api/gita-chapters', methods=['GET'])
def get_gita_chapters():
    """Get all chapters and verses from Gita dataset"""
    try:
        if gita_df is None or len(gita_df) == 0:
            print("ERROR: Gita dataset is None or empty")
            return jsonify({"error": "Gita dataset not available"}), 404
        
        print(f"DEBUG: Processing {len(gita_df)} rows from dataset")
        print(f"DEBUG: Dataset columns: {list(gita_df.columns)}")
        
        # Group verses by chapter
        chapters = {}
        rows_processed = 0
        rows_added = 0
        rows_skipped = 0
        
        for idx, row in gita_df.iterrows():
            rows_processed += 1
            # Try multiple column name variations
            chapter_num = None
            verse_num = None
            
            # Try different column name patterns for chapter
            for col in ['chapter_number', 'Chapter', 'chapter', 'Chapter Number', 'CHAPTER', 'Chapter_Number']:
                if col in row.index and pd.notna(row[col]):
                    try:
                        val = str(row[col]).strip()
                        if val:
                            chapter_num = int(float(val))
                            break
                    except:
                        continue
            
            # Try different column name patterns for verse
            for col in ['chapter_verse', 'verse', 'Verse', 'verse_number', 'Verse Number', 'VERSE', 'Verse_Number', 'chapter_verse_number']:
                if col in row.index and pd.notna(row[col]):
                    try:
                        val = str(row[col]).strip()
                        if val:
                            verse_num = int(float(val))
                            break
                    except:
                        continue
            
            # If still not found, try dataset_columns with get_column_value
            if not chapter_num:
                chapter_num = get_column_value(row, ['chapter_number'] + dataset_columns, None)
                if chapter_num:
                    try:
                        chapter_num = int(float(str(chapter_num).strip()))
                    except:
                        chapter_num = None
            
            if not verse_num:
                verse_num = get_column_value(row, ['chapter_verse'] + dataset_columns, None)
                if verse_num:
                    try:
                        verse_num = int(float(str(verse_num).strip()))
                    except:
                        verse_num = None
            
            # If verse_num is still missing or invalid, try to extract from text or use sequential
            if not verse_num or verse_num <= 0:
                # Try to find verse number in the text or other columns
                text_col = get_column_value(row, ['Text', 'text', 'Verse Text'] + dataset_columns, '')
                if text_col:
                    # Try to extract verse number from text (e.g., "Verse 2" or "2.1")
                    import re
                    verse_match = re.search(r'verse\s*(\d+)', text_col, re.IGNORECASE)
                    if verse_match:
                        verse_num = int(verse_match.group(1))
                    else:
                        # Count existing verses in this chapter to assign sequential number
                        if chapter_num in chapters:
                            existing_verses = len(chapters[chapter_num]["verses"])
                            verse_num = existing_verses + 1
                        else:
                            verse_num = 1
                else:
                    # Count existing verses in this chapter to assign sequential number
                    if chapter_num in chapters:
                        existing_verses = len(chapters[chapter_num]["verses"])
                        verse_num = existing_verses + 1
                    else:
                        verse_num = 1
                if rows_processed <= 10:  # Only print first 10 warnings
                    print(f"WARNING: Row {idx} missing verse number, assigned {verse_num} for chapter {chapter_num}")
            
            if chapter_num and verse_num and 1 <= chapter_num <= 18:
                if chapter_num not in chapters:
                    chapters[chapter_num] = {
                        "chapter_number": chapter_num,
                        "verses": []
                    }
                
                verse_data = {
                    "verse_number": verse_num,
                    "verse": verse_num,  # Add both for compatibility
                    "text": get_column_value(row, ['Text', 'text', 'Verse Text', 'Verse_Text', 'Sanskrit', 'VerseText'] + dataset_columns, ''),
                    "meaning": get_column_value(row, ['translation', 'Translation', 'Meaning', 'meaning'] + dataset_columns, ''),
                    "guidance": get_column_value(row, ['Guidance', 'guidance'] + dataset_columns, ''),
                    "what_happened": get_column_value(row, ['What happen', 'What Happen', 'what_happened'] + dataset_columns, ''),
                    "krishna_vaani": get_column_value(row, ['KrishnaVani', 'Krishna Vaani', 'krishna_vaani'] + dataset_columns, ''),
                    "emotion": get_column_value(row, ['Emotion', 'emotion'] + dataset_columns, ''),
                    "row_index": idx  # Add row index for debugging
                }
                
                # Allow all verses - even if same verse_number, they might be different entries
                # Use a composite key (chapter, verse, row_index) to ensure uniqueness
                chapters[chapter_num]["verses"].append(verse_data)
                rows_added += 1
            else:
                rows_skipped += 1
                if rows_skipped <= 5:  # Only print first 5 skipped rows
                    print(f"DEBUG: Skipped row {idx} - chapter: {chapter_num}, verse: {verse_num}")
        
        print(f"DEBUG: Processed {rows_processed} rows, added {rows_added} verses, skipped {rows_skipped} rows")
        
        # Sort verses within each chapter by verse_number, then by row_index
        for chapter_num in chapters:
            chapters[chapter_num]["verses"].sort(key=lambda x: (x.get("verse_number", 0), x.get("row_index", 0)))
        
        # Fix verse numbers: if all verses have the same number or numbers are missing, reassign sequentially
        for chapter_num in chapters:
            verse_list = chapters[chapter_num]["verses"]
            verse_nums = [v.get("verse_number", 0) for v in verse_list]
            unique_verses = len(set(verse_nums))
            
            # Check if verse numbers are valid and sequential
            # If all verses have the same number (like all are 1), or if unique count is too low, reassign
            max_verse_num = max(verse_nums) if verse_nums else 0
            min_verse_num = min(verse_nums) if verse_nums else 0
            
            # If all verses have same number, or if max verse number is less than total verses, reassign
            needs_reassignment = (
                unique_verses <= 1 or  # All same number
                (unique_verses < len(verse_list) * 0.5 and max_verse_num < len(verse_list)) or  # Too many duplicates
                max_verse_num == 1  # All are verse 1
            )
            
            if needs_reassignment:
                print(f"DEBUG: Chapter {chapter_num} has {unique_verses} unique verse numbers (max: {max_verse_num}) out of {len(verse_list)} verses. Reassigning sequentially...")
                for idx, verse in enumerate(verse_list, start=1):
                    old_num = verse.get("verse_number", 0)
                    verse["verse_number"] = idx
                    verse["verse"] = idx
                    if idx <= 5:  # Only print first 5
                        print(f"  Verse {idx}: was {old_num}, now {idx}")
        
        # Remove row_index from final output (it was just for sorting)
        for chapter_num in chapters:
            for verse in chapters[chapter_num]["verses"]:
                verse.pop("row_index", None)
        
        print(f"DEBUG: Found {len(chapters)} chapters")
        for ch_num in sorted(chapters.keys()):
            verse_nums = [v.get("verse_number") for v in chapters[ch_num]["verses"]]
            unique_verses = len(set(verse_nums))
            print(f"  Chapter {ch_num}: {len(chapters[ch_num]['verses'])} verses (unique verse numbers: {unique_verses})")
            if len(verse_nums) > 0:
                print(f"    Verse numbers: {sorted(set(verse_nums))[:20]}{'...' if len(set(verse_nums)) > 20 else ''}")
        
        # Load reading progress
        storage = load_storage()
        reading_progress = storage.get('reading_progress', {})
        
        return jsonify({
            "chapters": chapters,
            "reading_progress": reading_progress,
            "total_chapters": len(chapters)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/update-reading-progress', methods=['POST'])
def update_reading_progress():
    """Update reading progress for a chapter/verse"""
    try:
        data = request.json
        chapter = data.get('chapter')
        verse = data.get('verse')
        
        if not chapter or not verse:
            return jsonify({"error": "Chapter and verse required"}), 400
        
        storage = load_storage()
        if 'reading_progress' not in storage:
            storage['reading_progress'] = {}
        
        chapter_key = f"chapter_{chapter}"
        if chapter_key not in storage['reading_progress']:
            storage['reading_progress'][chapter_key] = {
                "chapter": chapter,
                "completed_verses": [],
                "last_read_verse": None,
                "last_read_date": None
            }
        
        if verse not in storage['reading_progress'][chapter_key]["completed_verses"]:
            storage['reading_progress'][chapter_key]["completed_verses"].append(verse)
        
        storage['reading_progress'][chapter_key]["last_read_verse"] = verse
        storage['reading_progress'][chapter_key]["last_read_date"] = datetime.now().isoformat()
        
        save_storage(storage)
        
        return jsonify({"success": True, "message": "Progress updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/test-model-accuracy', methods=['POST'])
def test_model_accuracy():
    """Test model accuracy with sample inputs"""
    try:
        data = request.json
        test_cases = data.get('test_cases', [])
        
        # Default test cases if none provided
        if not test_cases:
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
                {"text": "I feel calm and centered", "expected": "Peace/Calm"}
            ]
        
        results = []
        correct = 0
        total = len(test_cases)
        
        for test_case in test_cases:
            text = test_case.get('text', '')
            expected = test_case.get('expected', '')
            
            if not text:
                continue
            
            # Predict emotion
            predicted, confidence, breakdown = predict_emotion(text)
            
            # Check if prediction matches expected (fuzzy match)
            is_correct = False
            if expected:
                # Check exact match or if expected is in predicted (handles "Anxiety/Worry" vs "Anxiety")
                if predicted == expected or expected.split('/')[0].lower() in predicted.lower():
                    is_correct = True
                    correct += 1
            
            results.append({
                "input": text,
                "expected": expected,
                "predicted": predicted,
                "confidence": round(confidence, 2),
                "correct": is_correct,
                "emotion_breakdown": breakdown
            })
        
        accuracy = (correct / total * 100) if total > 0 else 0
        
        return jsonify({
            "total_tests": total,
            "correct_predictions": correct,
            "accuracy": round(accuracy, 2),
            "results": results,
            "model_info": {
                "model_type": "DistilBertForSequenceClassification",
                "problem_type": "multi_label_classification",
                "num_labels": len(EMOTION_LABELS),
                "emotion_labels": list(EMOTION_LABELS.values())
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    init_storage()
    app.run(debug=True, port=5000)

