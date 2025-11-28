# Krishna Vaani – The Gita-Based Emotional Guidance App

A beautiful web application that provides emotional guidance based on the Bhagavad Gita, using AI to understand your emotions and offer relevant wisdom.

## Features

- 🧠 **Emotion Detection**: AI-powered emotion classification from user input
- 📖 **Gita Guidance**: Relevant verses and teachings from the Bhagavad Gita
- 🕉️ **Krishna Vaani**: Personalized guidance in the voice of Krishna
- 📊 **Emotion Analysis**: Detailed breakdown of detected emotions
- ❤️ **Save Best Verse (Bookmark System)**: Save your favorite verses and guidance to build a personal wisdom library
- 📈 **Emotion Trends Dashboard**: Visual analytics showing your emotional journey over time with charts and insights
- 🎨 **Beautiful UI**: Modern, responsive design with smooth animations

## Project Structure

```
.
├── backend/
│   ├── app.py                 # Flask API server
│   ├── requirements.txt       # Python dependencies
│   ├── models/                # AI models
│   │   ├── gita_emotion_model/    # Emotion classification model
│   │   └── GitaAI_XTTS_Model/     # Text-to-speech model
│   └── dataset/
│       └── Gita.xlsx          # Gita dataset
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main React component
│   │   ├── App.css            # Styles
│   │   └── index.js           # React entry point
│   ├── public/
│   │   └── index.html         # HTML template
│   └── package.json           # Node dependencies
└── README.md
```

## Setup Instructions

### Backend Setup

1. **Install Git LFS** (if not already installed) to download the model file:
   - **Windows**: Download from [git-lfs.github.io](https://git-lfs.github.io/) or use `winget install Git.GitLFS`
   - **macOS**: `brew install git-lfs`
   - **Linux**: `sudo apt install git-lfs` or `sudo yum install git-lfs`
   
   Then initialize: `git lfs install`

2. **Download model files** (if you just cloned the repository):
```bash
git lfs pull
```

3. Navigate to the backend directory:
```bash
cd backend
```

4. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

5. Install dependencies:
```bash
pip install -r requirements.txt
```

6. Run the Flask server:
```bash
python app.py
```

The API will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, defaults to localhost:5000):
```env
REACT_APP_API_URL=http://localhost:5000
```

4. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

## Usage

1. Open the frontend application in your browser
2. Enter your feelings or describe your situation in the text area
3. Click "Get Guidance" to receive:
   - Detected emotion with confidence score
   - Personalized Krishna Vaani guidance
   - Relevant Gita verse and meaning
   - Detailed emotion analysis breakdown
4. **Save Verses**: Click "Save Verse" to bookmark your favorite guidance
5. **View Saved Verses**: Navigate to "Saved Verses" to see your personal library
6. **Emotion Dashboard**: Visit "Dashboard" to see:
   - Emotion trends over 7 or 30 days
   - Most frequent emotions
   - Emotional health score
   - Personalized insights
   - Emotion distribution charts
7. **Regenerate Guidance**: If the chapter or verse doesn't resonate with you, click "Read Again" to generate new guidance based on your emotion

### ⚠️ Important Note

**If you don't get a satisfying chapter or verse, click "Read Again" to generate a new guidance.** The system will provide a different verse from the Gita dataset based on your detected emotion. You can regenerate as many times as needed until you find guidance that resonates with you.

## API Endpoints

### POST `/api/guidance`
Get emotional guidance based on user input.

**Request:**
```json
{
  "input": "I'm feeling anxious about my upcoming exam"
}
```

**Response:**
```json
{
  "user_input": "I'm feeling anxious about my upcoming exam",
  "detected_emotion": "Anxiety/Worry",
  "confidence": 85.5,
  "emotion_breakdown": {
    "Anxiety/Worry": 85.5,
    "Anger/Frustration": 12.3,
    ...
  },
  "gita_guidance": {
    "verse": "Bhagavad Gita 2.47",
    "chapter": "Chapter 2",
    "guidance": "...",
    "meaning": "..."
  },
  "krishna_vaani": "Dear soul, I sense anxiety/worry in your heart..."
}
```

### GET `/api/health`
Health check endpoint.

### POST `/api/save-verse`
Save a verse to the user's personal library.

**Request:**
```json
{
  "chapter": "Chapter 2",
  "verse": "Verse 47",
  "chapter_number": 2,
  "verse_number": 47,
  "text": "कर्मण्येवाधिकारस्ते...",
  "meaning": "...",
  "guidance": "...",
  "krishna_vaani": "...",
  "emotion": "Anxiety/Worry"
}
```

### GET `/api/saved-verses`
Get all saved verses.

### DELETE `/api/saved-verse/<verse_id>`
Delete a saved verse by ID.

### GET `/api/emotion-history`
Get emotion history. Query parameter: `days` (default: 7)

### GET `/api/emotion-stats`
Get emotion statistics and analytics. Query parameter: `days` (default: 7)

**Response:**
```json
{
  "total_entries": 15,
  "emotion_counts": {...},
  "most_frequent_emotion": {
    "emotion": "Stress/Tension",
    "count": 6,
    "percentage": 40.0
  },
  "emotion_trends": [...],
  "emotional_health_score": 65,
  "insights": [...],
  "emotion_distribution": {...}
}
```

## Technologies Used

- **Backend**: Flask, PyTorch, Transformers, Pandas, Flask-CORS
- **Frontend**: React, React Router, Axios, Recharts
- **AI Models**: DistilBERT for emotion classification
- **Data Storage**: JSON-based storage (can be upgraded to database)

## Key Features Explained

### ⭐ Feature 1 — Save Best Verse (Bookmark System)
- Save any verse, Krishna Vaani, or guidance response
- Build your personal wisdom library
- Access saved verses anytime from the "Saved Verses" page
- Delete verses you no longer need

### ⭐ Feature 2 — Emotion Trends Dashboard
- **Emotion Trend Graph**: Line chart showing emotion patterns over 7 or 30 days
- **Most Frequent Emotion**: Highlights your dominant emotional state
- **Emotional Health Score**: Calculated based on positive vs negative emotions (0-100)
- **Personalized Insights**: AI-generated insights about your emotional patterns
- **Emotion Distribution**: Pie chart showing percentage breakdown of all emotions
- **Emotion Summary**: Detailed statistics and counts

## Environment Variables

### Backend

Create a `.env` file in the `backend/` directory (optional):

```env
OPENAI_API_KEY=your_openai_api_key_here
```

**Note**: The OpenAI API key is optional. If not provided, the chatbot will use template-based responses instead of ChatGPT-powered responses.

### Frontend

Create a `.env` file in the `frontend/` directory (optional):

```env
REACT_APP_API_URL=http://localhost:5000
```

## Project Requirements

### Backend Requirements
- Python 3.8+
- Flask
- PyTorch
- Transformers (Hugging Face)
- Pandas
- Flask-CORS
- OpenAI (optional, for ChatGPT integration)
- langdetect (for multilingual support)

### Frontend Requirements
- Node.js 14+
- React 18+
- React Router DOM
- Axios
- Recharts

## File Structure

```
Krishna-Vaani-The-Gita-Based-Emotional-Guidance-App/
├── backend/
│   ├── app.py                      # Main Flask API server
│   ├── requirements.txt            # Python dependencies
│   ├── .gitignore                  # Git ignore file
│   ├── data_storage.json           # User data storage (auto-generated)
│   ├── .env                        # Environment variables (create this)
│   ├── models/
│   │   └── gita_emotion_model/     # Emotion detection model
│   ├── dataset/
│   │   └── Gita.xlsx               # Gita dataset
│   └── test_model_accuracy.py      # Model accuracy testing script
├── frontend/
│   ├── src/
│   │   ├── App.js                  # Main React component
│   │   ├── App.css                 # Global styles
│   │   ├── index.js                # React entry point
│   │   ├── index.css               # Base styles
│   │   └── components/
│   │       ├── GuidancePage.js      # Main guidance page
│   │       ├── GuidancePage.css     # Guidance page styles
│   │       ├── SavedVersesPage.js  # Saved verses page
│   │       ├── SavedVersesPage.css # Saved verses styles
│   │       ├── EmotionDashboard.js # Emotion dashboard
│   │       ├── EmotionDashboard.css# Dashboard styles
│   │       ├── KrishnaChat.js      # Krishna chatbot component
│   │       └── KrishnaChat.css     # Chatbot styles
│   ├── public/
│   │   └── index.html              # HTML template
│   ├── package.json                # Node dependencies
│   ├── .gitignore                  # Git ignore file
│   └── .env                        # Environment variables (create this)
└── README.md                       # This file
```

## Notes

- Make sure you have the required model files in the `backend/models/gita_emotion_model/` directory
- The emotion labels are configured in `backend/app.py` (EMOTION_LABELS dictionary)
- The Gita dataset (`Gita.xlsx`) should be placed in `backend/dataset/` directory
- Data is stored in `backend/data_storage.json` (automatically created)
- The app tracks all guidance sessions for analytics
- Model accuracy can be tested using `python backend/test_model_accuracy.py`

## Model Files Setup

### ✅ Model File via Git LFS

The `model.safetensors` file (over 100MB) is tracked using **Git LFS** (Large File Storage) to handle the large file size. This means the model file **IS included** in the repository.

### For Users Cloning the Repository

When you clone this repository, you need to ensure Git LFS is installed to download the model file:

1. **Install Git LFS** (if not already installed):
   - **Windows**: Download from [git-lfs.github.io](https://git-lfs.github.io/) or use `winget install Git.GitLFS`
   - **macOS**: `brew install git-lfs`
   - **Linux**: `sudo apt install git-lfs` or `sudo yum install git-lfs`

2. **Initialize Git LFS** (if not already done):
```bash
git lfs install
```

3. **Clone the repository** (Git LFS files will be downloaded automatically):
```bash
git clone <repository-url>
cd Krishna-Vaani-The-Gita-Based-Emotional-Guidance-App
```

4. **If you already cloned without LFS**, pull the LFS files:
```bash
git lfs pull
```

### Verify Model File

After cloning, verify the model file exists:
```bash
ls -lh backend/models/gita_emotion_model/model.safetensors
```

The file should be over 100MB. If it's only a few KB, Git LFS didn't download it properly. Run `git lfs pull` again.

### Required Model Files

The `backend/models/gita_emotion_model/` directory should contain:
- `config.json` - Model configuration ✅ (included)
- `model.safetensors` - **Large model file (100+ MB) - Tracked via Git LFS** ✅
- `tokenizer_config.json` - Tokenizer configuration ✅ (included)
- `tokenizer.json` - Tokenizer data ✅ (included)
- `special_tokens_map.json` - Special tokens mapping ✅ (included)
- `vocab.txt` - Vocabulary file ✅ (included)

**All model files are included in the repository via Git LFS.**

## Troubleshooting

### Backend Issues
- **Model not loading**: 
  - Ensure `backend/models/gita_emotion_model/` contains all model files
  - **Important**: The `model.safetensors` file (100+ MB) is tracked via Git LFS. After cloning, run `git lfs pull` to download it.
  - Check that the file path is correct: `backend/models/gita_emotion_model/model.safetensors`
  - Verify file size: `model.safetensors` should be over 100MB. If it's only a few KB, Git LFS didn't download it. Run `git lfs pull`.
- **Dataset not found**: Check that `backend/dataset/Gita.xlsx` exists
- **Port already in use**: Change the port in `app.py` (default: 5000)
- **Git LFS not downloading files**: 
  - Ensure Git LFS is installed: `git lfs version`
  - Initialize Git LFS: `git lfs install`
  - Pull LFS files: `git lfs pull`

### Frontend Issues
- **API connection error**: Ensure backend is running on `http://localhost:5000`
- **Dependencies error**: Run `npm install` in the frontend directory
- **Build errors**: Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

## Features in Detail

### 🧠 Emotion Detection
- Uses hybrid approach: Keyword-based detection + AI model
- Supports 7 emotions: Peace/Calm, Anxiety/Worry, Anger/Frustration, Stress/Tension, Sadness/Grief, Confusion/Doubt, Joy/Happiness
- Shows complete emotion breakdown with confidence percentages
- Visual charts (bar chart and pie chart) for emotion analysis

### 💬 Krishna Chatbot
- Enable/disable chatbot toggle in input panel
- Multilingual support (responds in user's language)
- Uses ChatGPT API if available, otherwise template-based
- Maintains Krishna's character and spiritual tone
- Context-aware responses based on current guidance

### 📚 Saved Verses
- Save any verse with all details (chapter, verse, guidance, Krishna Vaani)
- View all saved verses in a beautiful grid layout
- "Read Again" button to view saved verse on home page
- Delete verses you no longer need

### 📊 Emotion Dashboard
- 7-day and 30-day emotion trend analysis
- Line chart showing emotion patterns over time
- Pie chart for emotion distribution
- Emotional health score (0-100)
- Personalized insights based on your emotional patterns
- Most frequent emotion statistics

## License

This project is for educational and spiritual guidance purposes.

