# Krishna Vaani — Complete Technical Documentation

---

## 1. What This Project Does

Krishna Vaani is a full-stack spiritual guidance application that:

1. Accepts a user's emotional situation in plain text (English or Hindi)
2. Detects the dominant emotion using keyword-based scoring
3. Retrieves the most relevant Bhagavad Gita verses from MongoDB Atlas
4. Generates a Krishna-style spiritual response using a local LLM (phi3:mini via Ollama)
5. Stores every interaction for emotion tracking, trend analysis, and health scoring
6. Provides a conversational RAG chatbot for deeper follow-up guidance
7. Lets users read all 18 chapters of the Gita verse by verse with progress tracking

---

## 2. System Architecture

```
User (React Frontend)
        │
        ▼
Flask REST API  (app.py)
        │
        ├── Emotion Detection Engine   (_detect_emotion)
        │
        ├── Verse Retrieval            (rag/retrieval.py)
        │         └── MongoDB Atlas    (gita_verses collection)
        │
        ├── Response Generation        (rag/generator.py)
        │         └── Ollama phi3:mini (local LLM)
        │                └── Fallback: Template Engine
        │
        └── MongoDB Atlas
              ├── gita_verses          (all Gita verses + emotion tags)
              ├── user_inputs          (emotion history)
              ├── saved_verses         (user bookmarks)
              └── reading_progress     (chapter/verse tracking)
```

---

## 3. Data Source — Gita.xlsx

**File:** `backend/dataset/Gita.xlsx`

This Excel file is the primary knowledge base. It contains every verse of the Bhagavad Gita with the following columns:

| Column | Description |
|---|---|
| `chapter_number` | Integer chapter number (1–18) |
| `chapter_title` | Sanskrit chapter name |
| `chapter_verse` | Verse reference string (e.g. "1.1", "2.47") |
| `translation` | English translation of the verse |
| `emotion_tags` | List of emotion keywords (e.g. `["anxiety", "fear", "doubt"]`) |
| `what_happen` | Story context — what was happening at this point in the Gita |
| `KrishnaVani` | Krishna's direct spiritual message for this verse |
| `Guidance` | Practical life advice derived from the verse |

### How data_loader.py imports it

On first startup, `ensure_gita_verses_loaded()` checks if `gita_verses` collection is empty. If yes:

1. Opens `Gita.xlsx` with `openpyxl` in read-only mode
2. Reads row 1 as headers, normalises them (strips spaces, lowercases, removes special chars)
3. For each data row, extracts all 8 fields using flexible alias matching
   - e.g. `"KrishnaVani"`, `"Krishna Vani"`, `"krishna_vaani"` all map to the same field
4. Parses `emotion_tags` — handles string, comma-separated, Python list literal formats
5. Parses `verse_number` — handles formats like `"1.1"`, `"1-1"`, `"Verse 1"`
6. Inserts all documents into MongoDB with `insert_many(ordered=False)`
7. On subsequent startups, skips import entirely (idempotent)

---

## 4. app.py — The Flask Application

### 4.1 Startup Sequence

```
python app.py
    │
    ├── db.py loads at import time
    │     └── Reads MONGO_URI from .env, validates, creates MongoClient
    │
    ├── _initialize_app_data()  [thread-safe, runs once]
    │     ├── ensure_indexes()          → creates all MongoDB indexes
    │     └── ensure_gita_verses_loaded() → imports Excel if collection empty
    │
    ├── verify_mongo_connection()       → pings Atlas, logs result
    │
    └── app.run(host=0.0.0.0, port=5000)
```

### 4.2 All API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/` | Health ping |
| GET | `/api/health` | Health check |
| POST | `/api/guidance` | Main route — detect emotion, find verse, return guidance |
| POST | `/api/save-verse` | Save a verse to user's library |
| GET | `/api/saved-verses` | Fetch all saved verses |
| DELETE | `/api/saved-verse/<id>` | Delete a saved verse |
| GET | `/api/emotion-history` | Emotion history for last N days |
| GET | `/api/emotion-stats` | Aggregated stats, trends, health score |
| GET | `/api/gita-chapters` | All 18 chapters with verses + reading progress |
| POST | `/api/update-reading-progress` | Mark a verse as read |
| POST | `/api/krishna-chat` | Simple chat (no RAG) |
| POST | `/api/rag-chat` | Full RAG chat with phi3:mini |

---

## 5. Emotion Detection — How It Works

**Function:** `_detect_emotion(text)` in `app.py`

This is a pure keyword-scoring system. No ML model is used for emotion detection.

### Step-by-Step Algorithm

```
Input: "I feel so stressed about my exams and I'm afraid of failing"

Step 1 — Initialise scores
  { Peace/Calm: 0, Anxiety/Worry: 0, Anger/Frustration: 0,
    Stress/Tension: 0, Sadness/Grief: 0, Confusion/Doubt: 0, Joy/Happiness: 0 }

Step 2 — Keyword scan (each match = +2 points)
  EMOTION_KEYWORDS lookup:
  "stressed"  → Stress/Tension    += 2   → score: 2
  "afraid"    → Anxiety/Worry     += 2   → score: 2
  "fear"      → Anxiety/Worry     += 2   → score: 4

Step 3 — Pattern boosts (each match = +2 points)
  "exam"      → Stress/Tension    += 2   → score: 4
  "fear"      → Anxiety/Worry     += 2   → score: 6
  "fail"      → Sadness/Grief     += 2   → score: 2

Step 4 — Final scores
  { Stress/Tension: 4, Anxiety/Worry: 6, Sadness/Grief: 2, others: 0 }

Step 5 — Normalise to percentages
  total = 12
  Anxiety/Worry:  6/12 * 100 = 50.0%
  Stress/Tension: 4/12 * 100 = 33.3%
  Sadness/Grief:  2/12 * 100 = 16.7%

Step 6 — Primary emotion = highest score = "Anxiety/Worry"

Step 7 — Confidence calculation
  confidence = min(95.0,  50 + (6/12) * 50)
             = min(95.0,  50 + 25)
             = 75.0%

Output: ("Anxiety/Worry", 75.0, { breakdown dict })
```

### Keyword Dictionary

| Emotion | Keywords |
|---|---|
| Anxiety/Worry | anxious, anxiety, worried, worry, nervous, fear, afraid, tense |
| Anger/Frustration | angry, anger, frustrated, frustration, mad, furious, irritated |
| Stress/Tension | stressed, stress, overwhelmed, pressure, tension, burdened |
| Sadness/Grief | sad, sadness, depressed, lonely, grief, sorrow, miserable |
| Confusion/Doubt | confused, confusion, doubt, uncertain, unsure, unclear, perplexed |
| Joy/Happiness | happy, happiness, joy, joyful, excited, delighted, glad |
| Peace/Calm | peaceful, peace, calm, content, serene, relaxed, centered |

### Pattern Boosts (Contextual)

| Words in text | Emotion boosted | Boost |
|---|---|---|
| future, career, life, decision | Confusion/Doubt | +2 |
| fail, failure, lose, lost | Sadness/Grief | +2 |
| pressure, deadline, exam | Stress/Tension | +2 |
| fear, scared, what if | Anxiety/Worry | +2 |
| angry, hate, annoyed | Anger/Frustration | +2 |

### Fallback Rules (when all scores = 0)

| Condition | Result | Confidence |
|---|---|---|
| Text has fewer than 5 words | Confusion/Doubt | 50% |
| Text has 5+ words but no keyword match | Stress/Tension | 50% |

### Confidence Formula

```
confidence = min(95.0,  50 + (top_score / total_score) * 50)
```

- Minimum possible confidence: 50% (fallback cases)
- Maximum possible confidence: 95% (hard cap)
- A single emotion dominating all scores → approaches 95%
- Evenly split scores → approaches 50%

---

## 6. Verse Prediction — How a Verse is Selected

### 6.1 For the Guidance Page (`_verse_for_emotion`)

```
Input: emotion = "Anxiety/Worry", user_input = "I am worried about my future"

Step 1 — Get query tags from EMOTION_TO_QUERY_TAGS
  ["anxiety", "worry", "fear", "guilt", "concern", "nervous"]

Step 2 — MongoDB query
  gita_verses.find({ emotion_tags: { $in: ["anxiety","worry","fear",...] } })
  → returns N candidate verses

Step 3 — Fallback if fewer than 3 candidates
  Fetch top 25 verses sorted by chapter_number ASC, verse_number ASC
  Append any not already in candidates

Step 4 — Score each candidate
  For each verse:
    score = 0
    if any query_tag overlaps with verse's emotion_tags → score += 3.0
    for each word in user_input: if word in (translation + what_happen) → score += 1
    score += random.uniform(0, 1)   ← diversity nudge

Step 5 — Sort by score descending, take top 10

Step 6 — random.choice(top_10)   ← prevents always returning same verse

Output: formatted verse dict
```

### 6.2 Scoring Thresholds

| Score component | Value | Meaning |
|---|---|---|
| Emotion tag match | +3.0 per matching tag | Strong signal — verse is tagged for this emotion |
| Keyword overlap | +1.0 per matching word | Verse text mentions words from user's input |
| Random nudge | +0 to +0.5 | Prevents identical results on repeated queries |
| Fallback threshold | < 3 candidates | Triggers chapter-ordered fallback padding |
| Top-N selection | Top 10 scored | Pool for random selection |

---

## 7. RAG Pipeline — Full Flow

The RAG (Retrieval-Augmented Generation) pipeline powers the `/api/rag-chat` endpoint.

```
POST /api/rag-chat
{ message, context, chat_history }
        │
        ▼
Step 1: Emotion resolution
  Use context.emotion if provided
  Otherwise: _detect_emotion(message)
        │
        ▼
Step 2: rag/retrieval.py — get_relevant_verses()
  Query MongoDB by emotion tags
  Score candidates (tag overlap + keyword overlap + random)
  Return top 4 formatted verse dicts
        │
        ▼
Step 3: rag/prompt_builder.py — build_messages()
  Build Ollama messages list:
    [system: Krishna persona rules]
    [user: context block with emotion + situation + retrieved verses]
    [assistant: "I am ready to respond"]
    [user/assistant: last 3 chat exchanges]
    [user: current message]
        │
        ▼
Step 4: rag/generator.py — generate_krishna_response()
  Call ollama.chat(model="phi3:mini", messages=..., options={...})
  If Ollama fails → _fallback_response() (template engine)
        │
        ▼
Step 5: Return JSON
  { response, verse_references (top 2), emotion, timestamp }
```

---

## 8. RAG Retrieval — Scoring Detail

**File:** `rag/retrieval.py`

### Scoring Formula Per Verse

```python
score = 0.0

# Tag overlap: +2.0 for each query tag that partially matches a verse tag
score += sum(
    2.0 for qt in query_tags
    if any(qt in vt or vt in qt for vt in verse_tags)
)

# Keyword overlap: +1.0 for each 3+ letter word from user text found in verse
score += sum(1.0 for w in user_words if w in verse_text)

# Diversity nudge
score += random.uniform(0, 0.5)
```

### Retrieval Thresholds

| Parameter | Value | Purpose |
|---|---|---|
| `top_k` | 4 | Number of verses retrieved per query |
| Fallback trigger | < `top_k` primary results | Pads with chapter-ordered verses |
| Fallback limit | 20 verses | Max verses fetched in fallback |
| Tag match weight | +2.0 per tag | Prioritises emotion-tagged verses |
| Keyword weight | +1.0 per word | Personalises to user's specific words |
| Min word length | 3 characters | Filters out stop words like "is", "am", "to" |

---

## 9. LLM Generation — phi3:mini via Ollama

**File:** `rag/generator.py`

### Model Configuration

| Parameter | Value | Effect |
|---|---|---|
| Model | `phi3:mini` | Microsoft's 3.8B parameter model, fast on CPU |
| temperature | 0.75 | Balanced creativity — not too random, not too rigid |
| top_p | 0.9 | Nucleus sampling — considers top 90% probability mass |
| num_predict | 512 | Max tokens in response (~350–400 words) |

### System Prompt Rules (sent to phi3:mini)

```
You are Lord Krishna speaking directly to a seeker in the style of the Bhagavad Gita.
- Speak with calm, deep wisdom — never preachy or robotic
- Address the seeker warmly: "Dear one", "O Arjuna", "O seeker"
- Always reference the retrieved Gita verses naturally
- Keep the response focused: 3–5 paragraphs maximum
- End with one short, memorable closing line
- Do NOT use bullet points or numbered lists
- Respond in the same language the seeker used (Hindi or English)
```

### Context Injected Into Every Request

```
[CONTEXT]
Seeker's emotion: Anxiety/Worry
Original situation: I am worried about my future career
What happened: (from previous guidance)
Previous Krishna Vaani given: (from previous guidance)
Previous guidance given: (from previous guidance)

[RELEVANT GITA VERSES]
  • Chapter 2, Verse 47: "You have a right to perform your duties..."
    Krishna Vaani: "..."
    [emotion tags: anxiety, worry, duty]
  • Chapter 6, Verse 5: "..."
    ...
```

### Fallback Behaviour

If Ollama is not running or returns an error:
- `ResponseError` → logs warning, uses template engine
- Any other exception → logs warning, uses template engine
- Template engine always produces a valid response using the same retrieved verses

---

## 10. Emotional Health Score

**Function:** `_build_stats(days)` in `app.py`

```
positive = count(Peace/Calm entries) + count(Joy/Happiness entries)
negative = total_entries - positive

health_score = clamp(0–100,  50 + ((positive - negative) / total_entries) * 25)
```

### Score Interpretation

| Score Range | Status |
|---|---|
| 70–100 | Excellent |
| 50–69 | Good |
| 30–49 | Fair |
| 0–29 | Needs Care |

### Examples

| Scenario | Score |
|---|---|
| All entries are Peace/Calm or Joy | 75 |
| Equal positive and negative | 50 |
| All entries are Stress/Anxiety | 25 |
| 60% positive, 40% negative | 55 |

---

## 11. MongoDB Collections

### gita_verses
Populated once from Gita.xlsx. Never modified at runtime.

```json
{
  "chapter_number": 2,
  "chapter_title": "Sankhya Yoga",
  "chapter_verse": "2.47",
  "translation": "You have a right to perform your prescribed duties...",
  "emotion_tags": ["duty", "action", "detachment", "karma"],
  "what_happen": "Krishna explains the concept of Nishkama Karma...",
  "krishna_vaani": "Act without attachment to results...",
  "guidance": "Focus on your effort, not the outcome...",
  "verse_number": 47,
  "chapter_label": "Chapter 2"
}
```

**Indexes:** `emotion_tags` (asc), `chapter_number` (asc), `chapter_number + verse_number` (unique)

### user_inputs
Every guidance request and emotion history entry.

```json
{
  "id": "uuid",
  "doc_type": "emotion_history",
  "emotion": "Anxiety/Worry",
  "input": "user's raw text",
  "confidence": 75.0,
  "emotion_breakdown": { "Anxiety/Worry": 50.0, "Stress/Tension": 33.3, ... },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Indexes:** `timestamp` (desc), `emotion` (asc)

### saved_verses
User-bookmarked verses.

```json
{
  "id": "uuid",
  "doc_type": "saved_verse",
  "chapter_number": 2,
  "verse_number": 47,
  "emotion": "Anxiety/Worry",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Indexes:** `timestamp` (desc), `emotion` (asc), `id` (unique)

### reading_progress
Per-chapter reading progress.

```json
{
  "id": "chapter_2",
  "chapter": 2,
  "completed_verses": [1, 2, 47],
  "last_read_verse": 47,
  "last_read_date": "2024-01-01T00:00:00Z"
}
```

**Indexes:** `chapter` (unique), `last_read_date` (desc)

---

## 12. Complete Request Flow — POST /api/guidance

```
User types: "I feel so lost and confused about my life decisions"

1. _safe_text()          → strips whitespace
2. _detect_emotion()     → "Confusion/Doubt", 75.0%, { breakdown }
   - "confused" keyword  → +2
   - "life" pattern      → +2
   - "decision" pattern  → +2
   - total score = 6, confidence = min(95, 50 + (6/6)*50) = 100 → capped at 95

3. _verse_for_emotion("Confusion/Doubt", user_input)
   - query_tags = ["confusion","doubt","uncertainty","hesitation","unclear"]
   - MongoDB: find verses where emotion_tags $in query_tags
   - Score each, pick random from top 10
   - Returns: Chapter 4, Verse 38 (example)

4. _krishna_message("Confusion/Doubt", user_input)
   - Gets verse again (separate call)
   - Extracts krishna_vaani + guidance from verse
   - Falls back to EMOTION_TEMPLATES if fields empty

5. _insert_document(user_inputs, { full record })
   - Adds UUID id + UTC timestamp
   - Stores in MongoDB

6. Returns JSON:
   {
     "detected_emotion": "Confusion/Doubt",
     "confidence": 95.0,
     "emotion_breakdown": { "Confusion/Doubt": 100.0, others: 0 },
     "gita_guidance": { chapter, verse, translation, guidance, ... },
     "krishna_vaani": "When the path is hidden...",
     "what_happened": "I feel so lost...",
     "stored_id": "uuid"
   }
```

---

## 13. Known Limitations

| Area | Limitation |
|---|---|
| Emotion detection | Keyword-only — cannot detect sarcasm, mixed emotions in complex sentences, or emotions expressed without trigger words |
| Language support | Keywords are English-only — Hindi input will fall through to the 50% confidence fallback |
| Verse selection | Random element means the same input can return different verses on repeated calls |
| phi3:mini | 3.8B parameter model — responses are good but not as nuanced as larger models |
| No embeddings | Retrieval uses keyword overlap, not semantic similarity — a verse about "inner peace" won't match "I feel calm" unless those exact words appear |
| Confidence cap | Hard-capped at 95% — never reports 100% confidence even on perfect keyword matches |
