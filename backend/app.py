from __future__ import annotations

import logging
import re
import random
import threading
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from bson import ObjectId
from pymongo import DESCENDING, ASCENDING
from pymongo.errors import PyMongoError

from data_loader import ensure_gita_verses_loaded
from db import (
    ensure_indexes,
    get_gita_verses_collection,
    get_reading_progress_collection,
    get_saved_verses_collection,
    get_user_inputs_collection,
    verify_mongo_connection,
)
from rag.retrieval import get_relevant_verses
from rag.generator import generate_krishna_response

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

_INITIALIZATION_LOCK = threading.Lock()
_INITIALIZED = False

# ── Load DistilBERT emotion model ──────────────────────────────────────────────
_EMOTION_MODEL = None
_EMOTION_TOKENIZER = None
MODEL_PATH = Path(__file__).resolve().parent / "models" / "gita_emotion_model"

try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    import torch

    _EMOTION_TOKENIZER = AutoTokenizer.from_pretrained(str(MODEL_PATH))
    _EMOTION_MODEL = AutoModelForSequenceClassification.from_pretrained(str(MODEL_PATH))
    _EMOTION_MODEL.eval()
    logger.info("DistilBERT emotion model loaded from %s", MODEL_PATH)
except Exception as exc:
    logger.warning("Failed to load DistilBERT model: %s — using keyword fallback", exc)

EMOTIONS = [
    "Peace/Calm",
    "Anxiety/Worry",
    "Anger/Frustration",
    "Stress/Tension",
    "Sadness/Grief",
    "Confusion/Doubt",
    "Joy/Happiness",
]

EMOTION_KEYWORDS = {
    "Anxiety/Worry": ["anxious", "anxiety", "worried", "worry", "nervous", "fear", "afraid", "tense"],
    "Anger/Frustration": ["angry", "anger", "frustrated", "frustration", "mad", "furious", "irritated"],
    "Stress/Tension": ["stressed", "stress", "overwhelmed", "pressure", "tension", "burdened"],
    "Sadness/Grief": ["sad", "sadness", "depressed", "lonely", "grief", "sorrow", "miserable"],
    "Confusion/Doubt": ["confused", "confusion", "doubt", "uncertain", "unsure", "unclear", "perplexed"],
    "Joy/Happiness": ["happy", "happiness", "joy", "joyful", "excited", "delighted", "glad"],
    "Peace/Calm": ["peaceful", "peace", "calm", "content", "serene", "relaxed", "centered"],
}

EMOTION_TEMPLATES = {
    "Peace/Calm": {
        "krishna_vaani": "Breathe with me. Stillness is not emptiness; it is the ground where wisdom becomes clear.",
        "guidance": "Stay rooted in your steadiness and continue with gentle discipline.",
    },
    "Anxiety/Worry": {
        "krishna_vaani": "Do not let the mind run ahead of your feet. Take one step, then the next, and let faith steady you.",
        "guidance": "Pause, simplify the next action, and return to the breath before the mind spirals.",
    },
    "Anger/Frustration": {
        "krishna_vaani": "Fire can destroy, but it can also illuminate. Let your energy become clear action instead of unrest.",
        "guidance": "Separate the feeling from the response, then choose the next wise action.",
    },
    "Stress/Tension": {
        "krishna_vaani": "Even the heavy load becomes manageable when it is carried with order and composure.",
        "guidance": "Reduce the burden into smaller tasks and protect your attention from overload.",
    },
    "Sadness/Grief": {
        "krishna_vaani": "Your sorrow is seen. What is loved is never truly erased; it becomes part of your depth.",
        "guidance": "Let grief move through you without judgment and seek one small source of support.",
    },
    "Confusion/Doubt": {
        "krishna_vaani": "When the path is hidden, do not force the whole journey. Light the next step and walk it honestly.",
        "guidance": "Name the uncertainty, ask for clarity, and make one reversible decision.",
    },
    "Joy/Happiness": {
        "krishna_vaani": "Joy is a blessing when it is shared. Let gratitude make it deeper and more enduring.",
        "guidance": "Savor the moment, express gratitude, and keep your heart open to others.",
    },
}

EMOTION_TO_QUERY_TAGS = {
    "Peace/Calm": ["peace", "calm", "serene", "balance", "tranquil"],
    "Anxiety/Worry": ["anxiety", "worry", "fear", "guilt", "concern", "nervous"],
    "Anger/Frustration": ["anger", "frustration", "rage", "irritation", "fury"],
    "Stress/Tension": ["stress", "tension", "pressure", "overwhelm", "burden"],
    "Sadness/Grief": ["sadness", "grief", "sorrow", "loss", "depression"],
    "Confusion/Doubt": ["confusion", "doubt", "uncertainty", "hesitation", "unclear"],
    "Joy/Happiness": ["joy", "happiness", "motivation", "delight", "inspiration"],
}




def _initialize_app_data() -> None:
    global _INITIALIZED
    if _INITIALIZED:
        return

    with _INITIALIZATION_LOCK:
        if _INITIALIZED:
            return
        ensure_indexes()
        ensure_gita_verses_loaded()
        _INITIALIZED = True


def _format_gita_verse(document: dict, *, index: int | None = None) -> dict:
    verse_number   = document.get("verse_number") or index
    chapter_number = document.get("chapter_number")
    chapter_title  = document.get("chapter_title")
    chapter_label  = document.get("chapter_label") or (f"Chapter {chapter_number}" if chapter_number else "Chapter 1")
    verse_label    = document.get("chapter_verse") or (f"Verse {verse_number}" if verse_number else "")

    return {
        "id": str(document.get("_id") or document.get("id") or ""),
        "chapter_number": chapter_number,
        "chapter_title": chapter_title,
        "chapter": chapter_label,
        "chapter_label": chapter_label,
        "chapter_num": chapter_label,
        "verse_number": verse_number,
        "verse": verse_label,
        "chapter_verse": document.get("chapter_verse") or verse_label,
        "translation": document.get("translation") or "",
        "emotion_tags": document.get("emotion_tags") or [],
        "what_happen": document.get("what_happen") or "",
        "what_happened": document.get("what_happen") or "",
        "krishna_vaani": document.get("krishna_vaani") or "",
        "KrishnaVani": document.get("krishna_vaani") or "",
        "guidance": document.get("guidance") or "",
        "Guidance": document.get("guidance") or "",
        "text": document.get("translation") or "",
        "meaning": document.get("what_happen") or "",
    }


def _load_gita_chapters() -> dict:
    chapters: dict[int, list[dict]] = defaultdict(list)
    projection = {
        "chapter_number": 1,
        "chapter_title": 1,
        "chapter_verse": 1,
        "translation": 1,
        "emotion_tags": 1,
        "what_happen": 1,
        "krishna_vaani": 1,
        "guidance": 1,
        "verse_number": 1,
        "chapter_label": 1,
    }

    for document in get_gita_verses_collection().find({}, projection).sort([("chapter_number", ASCENDING), ("verse_number", ASCENDING)]):
        chapter_number = document.get("chapter_number")
        if chapter_number is None or int(chapter_number) <= 0:
            continue
        chapters[int(chapter_number)].append(_format_gita_verse(document, index=len(chapters[int(chapter_number)]) + 1))

    result: dict[str, dict] = {}
    for chapter_number in sorted(chapters):
        verses = chapters[chapter_number]
        title = verses[0].get("chapter_title") if verses else f"Chapter {chapter_number}"
        result[str(chapter_number)] = {
            "chapter_number": chapter_number,
            "chapter_num": f"Chapter {chapter_number}",
            "chapter_title": title,
            "name": title,
            "verses": verses,
        }

    return result


def _serialize_value(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(item) for key, item in value.items()}
    return value


def _serialize_document(document: dict) -> dict:
    serialized = {key: _serialize_value(value) for key, value in document.items() if key != "_id"}
    if "id" not in serialized and "_id" in document:
        serialized["id"] = str(document["_id"])
    return serialized


def _fetch_documents(collection, query: dict, *, sort_field: str | None = "timestamp") -> list[dict]:
    cursor = collection.find(query)
    if sort_field:
        cursor = cursor.sort(sort_field, DESCENDING)
    return [_serialize_document(document) for document in cursor]


def _insert_document(collection, document: dict) -> dict:
    payload = dict(document)
    payload.setdefault("id", str(uuid.uuid4()))
    payload.setdefault("timestamp", datetime.now(timezone.utc))
    collection.insert_one(payload)
    return payload


def _upsert_reading_progress(chapter_number: int, verse) -> dict:
    now = datetime.now(timezone.utc)
    chapter_key = f"chapter_{chapter_number}"
    progress_document = {
        "id": chapter_key,
        "doc_type": "reading_progress",
        "chapter": chapter_number,
        "completed_verses": [],
        "last_read_verse": None,
        "last_read_date": None,
        "timestamp": now,
        "updated_at": now,
    }

    collection = get_reading_progress_collection()
    existing = collection.find_one({"chapter": chapter_number}) or {}
    completed = set(existing.get("completed_verses", []))
    completed.add(verse)
    progress_document["completed_verses"] = sorted(completed)
    progress_document["last_read_verse"] = verse
    progress_document["last_read_date"] = now

    collection.update_one(
        {"chapter": chapter_number},
        {"$set": progress_document},
        upsert=True,
    )
    return progress_document


def _load_reading_progress() -> dict:
    try:
        documents = list(get_reading_progress_collection().find({}, {"_id": 0}).sort("chapter", ASCENDING))
    except PyMongoError:
        return {}

    reading_progress: dict[str, dict] = {}
    for document in documents:
        chapter_number = document.get("chapter")
        if chapter_number is None:
            continue
        reading_progress[f"chapter_{chapter_number}"] = {
            "chapter": chapter_number,
            "completed_verses": document.get("completed_verses", []),
            "last_read_verse": document.get("last_read_verse"),
            "last_read_date": document.get("last_read_date"),
        }
    return reading_progress


def _safe_text(value) -> str:
    return str(value or "").strip()


# ── Label mapping: model output index → emotion name ──────────────────────────
# The model was trained with 7 labels in this order (matches EMOTIONS list order)
_LABEL_MAP: dict[int, str] = {
    0: "Peace/Calm",
    1: "Anxiety/Worry",
    2: "Anger/Frustration",
    3: "Stress/Tension",
    4: "Sadness/Grief",
    5: "Confusion/Doubt",
    6: "Joy/Happiness",
}


def _detect_emotion_keywords(text: str) -> tuple[str, float, dict[str, float]]:
    """Keyword-based fallback when the DistilBERT model is unavailable."""
    scores = {emotion: 0 for emotion in EMOTIONS}

    for emotion, keywords in EMOTION_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                scores[emotion] += 2

    if any(w in text for w in ["future", "career", "life", "decision"]):
        scores["Confusion/Doubt"] += 2
    if any(w in text for w in ["fail", "failure", "lose", "lost"]):
        scores["Sadness/Grief"] += 2
    if any(w in text for w in ["pressure", "deadline", "exam"]):
        scores["Stress/Tension"] += 2
    if any(w in text for w in ["fear", "scared", "what if"]):
        scores["Anxiety/Worry"] += 2
    if any(w in text for w in ["angry", "hate", "annoyed"]):
        scores["Anger/Frustration"] += 2

    if all(s == 0 for s in scores.values()):
        default = "Confusion/Doubt" if len(text.split()) < 5 else "Stress/Tension"
        return default, 50.0, {e: 0.0 for e in EMOTIONS}

    total = sum(scores.values())
    breakdown = {e: round((s / total) * 100, 2) for e, s in scores.items()}
    primary = max(scores, key=scores.get)
    confidence = min(95.0, 50 + (scores[primary] / total) * 50)
    return primary, round(confidence, 2), breakdown


def _detect_emotion(text: str) -> tuple[str, float, dict[str, float]]:
    """
    Detect emotion using the fine-tuned DistilBERT model.
    Falls back to keyword scoring if the model is not loaded.

    Returns: (primary_emotion, confidence_percent, breakdown_dict)
    """
    text = (text or "").strip()
    if not text:
        return "Confusion/Doubt", 50.0, {e: 0.0 for e in EMOTIONS}

    # ── DistilBERT model path ──────────────────────────────────────────────────
    if _EMOTION_MODEL is not None and _EMOTION_TOKENIZER is not None:
        try:
            import torch
            inputs = _EMOTION_TOKENIZER(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=512,
                padding=True,
            )
            with torch.no_grad():
                logits = _EMOTION_MODEL(**inputs).logits

            # Multi-label: sigmoid → probabilities per class
            probs = torch.sigmoid(logits).squeeze().tolist()
            if isinstance(probs, float):
                probs = [probs]

            # Map to emotion names
            breakdown: dict[str, float] = {}
            for idx, prob in enumerate(probs):
                emotion_name = _LABEL_MAP.get(idx)
                if emotion_name:
                    breakdown[emotion_name] = round(prob * 100, 2)

            # Fill any missing emotions with 0
            for e in EMOTIONS:
                breakdown.setdefault(e, 0.0)

            # Primary = highest probability
            primary = max(breakdown, key=breakdown.get)
            confidence = min(95.0, breakdown[primary])

            # Fallback if model is uncertain (all probs very low)
            if confidence < 20.0:
                logger.debug("Model confidence too low (%.1f%%), using keyword fallback", confidence)
                return _detect_emotion_keywords(text.lower())

            logger.debug("DistilBERT detected: %s (%.1f%%)", primary, confidence)
            return primary, round(confidence, 2), breakdown

        except Exception as exc:
            logger.warning("DistilBERT inference error: %s — using keyword fallback", exc)

    # ── Keyword fallback ───────────────────────────────────────────────────────
    return _detect_emotion_keywords(text.lower())


def _verse_for_emotion(emotion: str, user_input: str = "") -> dict:
    query_tags = [tag.lower() for tag in EMOTION_TO_QUERY_TAGS.get(emotion, [emotion.lower()])]
    user_words = [word for word in re.findall(r"[a-zA-Z']+", (user_input or "").lower()) if word]

    collection = get_gita_verses_collection()
    candidates = list(collection.find({"emotion_tags": {"$in": query_tags}}))
    if len(candidates) < 3:
        fallback_candidates = list(collection.find({}, {"_id": 1}).sort([("chapter_number", ASCENDING), ("verse_number", ASCENDING)]).limit(25))
        seen_ids = {candidate.get("_id") for candidate in candidates}
        candidates.extend([candidate for candidate in fallback_candidates if candidate.get("_id") not in seen_ids])

    if not candidates:
        return {
            "chapter": "Chapter 1",
            "chapter_number": 1,
            "chapter_title": "Arjuna Viṣāda Yoga",
            "chapter_num": "Chapter 1",
            "chapter_verse": "1.1",
            "verse": "1.1",
            "verse_number": 1,
            "translation": "",
            "emotion_tags": [],
            "what_happen": "",
            "what_happened": "",
            "KrishnaVani": "",
            "krishna_vaani": "",
            "Guidance": "",
            "guidance": "",
            "text": "",
            "meaning": "",
        }

    scored_rows = []
    for candidate in candidates:
        score = 0.0
        candidate_tags = [str(tag).lower() for tag in candidate.get("emotion_tags", [])]
        if any(query_tag in tag for tag in query_tags for query_tag in candidate_tags):
            score += 3.0

        text = f"{candidate.get('translation', '')} {candidate.get('what_happen', '')}".lower()
        score += sum(1 for word in user_words if word in text)
        score += random.uniform(0, 1)
        scored_rows.append((score, candidate))

    scored_rows.sort(key=lambda item: item[0], reverse=True)
    top_rows = [candidate for _, candidate in scored_rows[:10]]
    selected = random.choice(top_rows or [candidates[0]])
    return _format_gita_verse(selected)


def _krishna_message(emotion: str, user_input: str) -> str:
    verse = _verse_for_emotion(emotion, user_input)
    krishna_vani = _safe_text(verse.get("krishna_vaani") or verse.get("KrishnaVani"))
    guidance = _safe_text(verse.get("guidance") or verse.get("Guidance"))

    if krishna_vani and guidance:
        return f"{krishna_vani} {guidance}"

    template = EMOTION_TEMPLATES.get(emotion, EMOTION_TEMPLATES["Peace/Calm"])
    return f"{template['krishna_vaani']} {template['guidance']}"



def _filtered_history(days: int) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = {"doc_type": "emotion_history", "timestamp": {"$gte": cutoff}}
    return _fetch_documents(get_user_inputs_collection(), query)


def _build_stats(days: int) -> dict:
    history = _filtered_history(days)
    counts = Counter(entry.get("emotion", "Unknown") for entry in history)
    total_entries = len(history)

    if counts:
        most_emotion, most_count = counts.most_common(1)[0]
        most_frequent = {
            "emotion": most_emotion,
            "count": most_count,
            "percentage": round((most_count / total_entries) * 100, 1) if total_entries else 0.0,
        }
    else:
        most_frequent = None

    trends: dict[str, dict[str, int]] = defaultdict(lambda: {emotion: 0 for emotion in EMOTIONS})
    for entry in history:
        timestamp = entry.get("timestamp")
        emotion = entry.get("emotion", "Peace/Calm")
        try:
            parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except Exception:
            continue
        day_key = parsed.date().isoformat()
        trends[day_key][emotion] = trends[day_key].get(emotion, 0) + 1

    ordered_trends = [
        {"date": day, "emotions": emotions}
        for day, emotions in sorted(trends.items())
    ]

    positive = counts.get("Peace/Calm", 0) + counts.get("Joy/Happiness", 0)
    negative = total_entries - positive
    health_score = 50
    if total_entries:
        health_score = int(max(0, min(100, 50 + ((positive - negative) / total_entries) * 25)))

    distribution = {
        emotion: round((counts.get(emotion, 0) / total_entries) * 100, 1) if total_entries else 0.0
        for emotion in EMOTIONS
    }

    insights = []
    if most_frequent:
        insights.append(f"Your most frequent emotion is {most_frequent['emotion']}.")
    if positive >= negative:
        insights.append("Your recent pattern leans toward steadier states.")
    else:
        insights.append("Your recent pattern suggests extra support and rest may help.")

    return {
        "total_entries": total_entries,
        "emotion_counts": dict(counts),
        "most_frequent_emotion": most_frequent,
        "emotion_trends": ordered_trends,
        "emotional_health_score": health_score,
        "insights": insights,
        "emotion_distribution": distribution,
    }


@app.get("/")
def index():
    return jsonify({"status": "ok", "service": "krishna-vaani-backend"})


@app.get("/api/health")
def health():
    return jsonify({"status": "healthy"})


@app.post("/api/guidance")
def guidance():
    payload = request.get_json(silent=True) or {}
    user_input = _safe_text(payload.get("input"))
    if not user_input:
        return jsonify({"error": "input is required"}), 400

    emotion, confidence, breakdown = _detect_emotion(user_input)
    verse = _verse_for_emotion(emotion)
    krishna_vaani = _krishna_message(emotion, user_input)

    try:
        stored_document = _insert_document(
            get_user_inputs_collection(),
            {
                "doc_type": "emotion_history",
                "emotion": emotion,
                "input": user_input,
                "user_input": user_input,
                "confidence": confidence,
                "emotion_breakdown": breakdown,
                "gita_guidance": verse,
                "krishna_vaani": krishna_vaani,
                "what_happened": user_input,
            }
        )
    except PyMongoError as exc:
        app.logger.exception("Failed to store guidance submission in MongoDB")
        return jsonify({"error": f"Failed to store user input: {exc}"}), 500

    return jsonify(
        {
            "user_input": user_input,
            "detected_emotion": emotion,
            "confidence": confidence,
            "emotion_breakdown": breakdown,
            "gita_guidance": verse,
            "krishna_vaani": krishna_vaani,
            "what_happened": user_input,
            "stored_id": stored_document.get("id"),
        }
    )


@app.post("/api/save-verse")
def save_verse():
    payload = request.get_json(silent=True) or {}
    verse = dict(payload)
    verse["doc_type"] = "saved_verse"
    verse.setdefault("id", str(uuid.uuid4()))
    verse.setdefault("timestamp", datetime.now(timezone.utc))
    try:
        get_saved_verses_collection().insert_one(verse)
    except PyMongoError as exc:
        app.logger.exception("Failed to save verse in MongoDB")
        return jsonify({"error": f"Failed to save verse: {exc}"}), 500

    return jsonify({"success": True, "verse": _serialize_document(verse)})


@app.get("/api/saved-verses")
def saved_verses():
    try:
        verses = _fetch_documents(get_saved_verses_collection(), {"doc_type": "saved_verse"})
    except PyMongoError as exc:
        app.logger.exception("Failed to fetch saved verses from MongoDB")
        return jsonify({"error": f"Failed to load saved verses: {exc}"}), 500

    return jsonify({"saved_verses": verses})


@app.delete("/api/saved-verse/<verse_id>")
def delete_saved_verse(verse_id: str):
    try:
        result = get_saved_verses_collection().delete_one({"doc_type": "saved_verse", "id": verse_id})
    except PyMongoError as exc:
        app.logger.exception("Failed to delete saved verse from MongoDB")
        return jsonify({"error": f"Failed to delete verse: {exc}"}), 500

    return jsonify({"success": True, "deleted": result.deleted_count})


@app.get("/api/emotion-history")
def emotion_history():
    try:
        days = int(request.args.get("days", 7))
    except (TypeError, ValueError):
        return jsonify({"error": "days must be a valid number"}), 400

    try:
        history = _filtered_history(days)
    except PyMongoError as exc:
        app.logger.exception("Failed to fetch emotion history from MongoDB")
        return jsonify({"error": f"Failed to load emotion history: {exc}"}), 500

    return jsonify({"emotion_history": history})


@app.get("/api/emotion-stats")
def emotion_stats():
    try:
        days = int(request.args.get("days", 7))
    except (TypeError, ValueError):
        return jsonify({"error": "days must be a valid number"}), 400

    try:
        return jsonify(_build_stats(days))
    except PyMongoError as exc:
        app.logger.exception("Failed to build emotion stats from MongoDB")
        return jsonify({"error": f"Failed to build emotion stats: {exc}"}), 500


@app.get("/api/gita-chapters")
def gita_chapters():
    return jsonify({"chapters": _load_gita_chapters(), "reading_progress": _load_reading_progress()})


@app.post("/api/update-reading-progress")
def update_reading_progress():
    payload = request.get_json(silent=True) or {}
    chapter = payload.get("chapter")
    verse = payload.get("verse")
    if chapter is None or verse is None:
        return jsonify({"error": "chapter and verse are required"}), 400

    try:
        chapter_number = int(chapter)
    except (TypeError, ValueError):
        return jsonify({"error": "chapter must be a valid number"}), 400

    if chapter_number < 1:
        return jsonify({"error": "chapter must be greater than zero"}), 400

    try:
        _upsert_reading_progress(chapter_number, verse)
    except PyMongoError as exc:
        app.logger.exception("Failed to update reading progress in MongoDB")
        return jsonify({"error": f"Failed to update reading progress: {exc}"}), 500

    return jsonify({"success": True, "message": "Progress updated"})



@app.post("/api/rag-chat")
def rag_chat():
    payload = request.get_json(silent=True) or {}
    message = _safe_text(payload.get("message"))
    if not message:
        return jsonify({"error": "message is required"}), 400

    context      = payload.get("context") or {}
    chat_history = payload.get("chat_history") or []

    # Resolve emotion from context or re-detect from message
    emotion = _safe_text(context.get("emotion") or context.get("detected_emotion"))
    if not emotion:
        emotion, _, _ = _detect_emotion(message)

    try:
        # 1. Retrieve relevant Gita verses from MongoDB
        retrieved_verses = get_relevant_verses(
            emotion=emotion,
            message=message,
            context=context,
            top_k=4,
        )

        # 2. Generate Krishna-style response
        response_text = generate_krishna_response(
            message=message,
            emotion=emotion,
            context=context,
            retrieved_verses=retrieved_verses,
            chat_history=chat_history,
        )

        # 3. Build verse references for frontend display (top 2)
        verse_refs = [
            {
                "chapter":       v.get("chapter_number"),
                "verse":         v.get("verse_number"),
                "chapter_verse": v.get("chapter_verse", ""),
                "translation":   (v.get("translation") or v.get("text", ""))[:150],
                "emotion_tags":  v.get("emotion_tags", []),
            }
            for v in retrieved_verses[:2]
        ]

        return jsonify({
            "response":         response_text,
            "verse_references": verse_refs,
            "emotion":          emotion,
            "timestamp":        datetime.now(timezone.utc).isoformat(),
        })

    except PyMongoError as exc:
        app.logger.exception("RAG chat MongoDB error")
        return jsonify({"error": f"Database error: {exc}"}), 500
    except Exception as exc:
        app.logger.exception("RAG chat error")
        return jsonify({"error": str(exc)}), 500


@app.post("/api/update-progress")
def update_progress_alias():
    return update_reading_progress()



if __name__ == "__main__":
    _initialize_app_data()
    verify_mongo_connection()
    app.run(host="0.0.0.0", port=5000, debug=False)