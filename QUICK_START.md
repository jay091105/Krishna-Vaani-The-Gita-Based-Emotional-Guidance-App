# Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Backend Setup

```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

Backend will run on `http://localhost:5000`

### Step 2: Frontend Setup (New Terminal)

```bash
cd frontend
npm install
npm start
```

Frontend will open at `http://localhost:3000`

## ✨ Features to Try

1. **Get Guidance**: Enter your feelings and get personalized Gita guidance
2. **Save Verses**: Click "❤️ Save Verse" on any guidance result
3. **View Saved Verses**: Navigate to "📚 Saved Verses" in the navbar
4. **Emotion Dashboard**: Click "📊 Dashboard" to see your emotional trends

## 🎯 What You'll See

### Home Page (Guidance)
- Input text area for your feelings
- Emotion detection with confidence score
- Krishna Vaani personalized message
- Gita verse with meaning and guidance
- **Save Verse** button
- Emotion breakdown chart

### Saved Verses Page
- All your bookmarked verses
- Delete and re-read options
- Organized by date

### Emotion Dashboard
- **7/30 Day Trends**: Line chart showing emotion patterns
- **Most Frequent Emotion**: Big card with percentage
- **Emotional Health Score**: 0-100 score with status
- **Pie Chart**: Emotion distribution
- **Insights**: AI-generated personalized insights
- **Summary Stats**: Total entries and emotion counts

## 🔧 Troubleshooting

- **Backend not starting?** Check if port 5000 is available
- **Frontend not connecting?** Verify backend is running on `http://localhost:5000`
- **Model errors?** Ensure model files are in `backend/models/gita_emotion_model/`
- **No data showing?** Get some guidance first to generate data!

## 📝 Notes

- Data is automatically saved in `backend/data_storage.json`
- All guidance sessions are tracked for analytics
- You can switch between 7-day and 30-day views in the dashboard

Enjoy your spiritual journey! 🕉️

