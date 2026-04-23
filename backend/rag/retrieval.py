"""
rag.retrieval — MongoDB-backed verse retrieval for the RAG pipeline.

Public API
----------
get_relevant_verses(emotion, message, context, top_k=4) -> list[dict]
"""
from __future__ import annotations

import logging
import random
import re

from pymongo import ASCENDING

from db import get_gita_verses_collection

logger = logging.getLogger(__name__)

# Emotion → MongoDB query tags (mirrors EMOTION_TO_QUERY_TAGS in app.py)
EMOTION_TO_QUERY_TAGS: dict[str, list[str]] = {
    "Peace/Calm":        ["peace", "calm", "serene", "balance", "tranquil"],
    "Anxiety/Worry":     ["anxiety", "worry", "fear", "guilt", "concern", "nervous"],
    "Anger/Frustration": ["anger", "frustration", "rage", "irritation", "fury"],
    "Stress/Tension":    ["stress", "tension", "pressure", "overwhelm", "burden"],
    "Sadness/Grief":     ["sadness", "grief", "sorrow", "loss", "depression"],
    "Confusion/Doubt":   ["confusion", "doubt", "uncertainty", "hesitation", "unclear"],
    "Joy/Happiness":     ["joy", "happiness", "motivation", "delight", "inspiration"],
}


def _format_verse(document: dict) -> dict:
    """Normalise a raw MongoDB verse document into a consistent response shape."""
    verse_number   = document.get("verse_number")
    chapter_number = document.get("chapter_number")
    chapter_title  = document.get("chapter_title")
    chapter_label  = document.get("chapter_label") or (f"Chapter {chapter_number}" if chapter_number else "")
    verse_label    = document.get("chapter_verse") or (f"Verse {verse_number}" if verse_number else "")

    return {
        "id":            str(document.get("_id") or document.get("id") or ""),
        "chapter_number": chapter_number,
        "chapter_title":  chapter_title,
        "chapter":        chapter_label,
        "chapter_label":  chapter_label,
        "verse_number":   verse_number,
        "verse":          verse_label,
        "chapter_verse":  document.get("chapter_verse") or verse_label,
        "translation":    document.get("translation") or "",
        "emotion_tags":   document.get("emotion_tags") or [],
        "what_happen":    document.get("what_happen") or "",
        "what_happened":  document.get("what_happen") or "",
        "krishna_vaani":  document.get("krishna_vaani") or "",
        "guidance":       document.get("guidance") or "",
        "text":           document.get("translation") or "",
        "meaning":        document.get("what_happen") or "",
    }


def get_relevant_verses(
    emotion: str,
    message: str,
    context: dict,
    top_k: int = 4,
) -> list[dict]:
    """
    Retrieve the *top_k* Gita verses most relevant to *emotion* + *message*.

    Strategy
    --------
    1. Query ``gita_verses`` collection by ``emotion_tags`` matching the
       emotion's canonical tag list.
    2. If fewer than *top_k* results, pad with chapter-ordered fallback verses.
    3. Score each candidate:
       - +2.0 per matching emotion tag
       - +1.0 per user keyword found in translation / what_happen text
       - +rand(0, 0.5) for result diversity
    4. Return top *top_k* formatted verse dicts.

    Parameters
    ----------
    emotion  : detected emotion label, e.g. "Confusion/Doubt"
    message  : current user message
    context  : guidance context dict (user_input, what_happen, krishna_vaani, guidance)
    top_k    : number of verses to return
    """
    query_tags = [t.lower() for t in EMOTION_TO_QUERY_TAGS.get(emotion, [emotion.lower()])]

    # Build keyword set from message + all context fields
    context_text = " ".join([
        message,
        context.get("user_input", ""),
        context.get("what_happen", ""),
        context.get("krishna_vaani", ""),
        context.get("guidance", ""),
    ]).lower()
    user_words = set(re.findall(r"[a-zA-Z']{3,}", context_text))

    collection = get_gita_verses_collection()

    # Primary query: emotion tag match
    candidates: list[dict] = list(collection.find({"emotion_tags": {"$in": query_tags}}))
    logger.debug("RAG retrieval: emotion=%s, primary_candidates=%d", emotion, len(candidates))

    # Fallback: pad with chapter-ordered verses if too few
    if len(candidates) < top_k:
        seen_ids = {c.get("_id") for c in candidates}
        extras = list(
            collection.find({})
            .sort([("chapter_number", ASCENDING), ("verse_number", ASCENDING)])
            .limit(20)
        )
        candidates.extend([v for v in extras if v.get("_id") not in seen_ids])

    # Score candidates
    scored: list[tuple[float, dict]] = []
    for verse in candidates:
        score = 0.0
        verse_tags = [str(t).lower() for t in verse.get("emotion_tags", [])]

        # Tag overlap score
        score += sum(
            2.0 for qt in query_tags
            if any(qt in vt or vt in qt for vt in verse_tags)
        )

        # Keyword overlap with user text
        verse_text = f"{verse.get('translation', '')} {verse.get('what_happen', '')}".lower()
        score += sum(1.0 for w in user_words if w in verse_text)

        # Small random nudge for variety across repeated queries
        score += random.uniform(0, 0.5)
        scored.append((score, verse))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_verses = [_format_verse(v) for _, v in scored[:top_k]]
    logger.debug("RAG retrieval: returning %d verses", len(top_verses))
    return top_verses
