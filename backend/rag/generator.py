"""
rag.generator — Krishna-style response generation via Ollama llama3:latest.

Public API
----------
generate_krishna_response(message, emotion, context, retrieved_verses, chat_history) -> str
"""
from __future__ import annotations

import logging
import random

import ollama
from ollama import ResponseError

from rag.prompt_builder import build_messages

logger = logging.getLogger(__name__)

OLLAMA_MODEL   = "phi3:mini"
OLLAMA_TIMEOUT = 60          # seconds — llama3 on CPU can be slow

# ── Fallback templates (used when Ollama is unavailable) ──────────────────────

_OPENINGS: dict[str, str] = {
    "Confusion/Doubt":   "O seeker, your question arises from a sincere heart.",
    "Anxiety/Worry":     "Dear one, I see the restlessness in your words.",
    "Stress/Tension":    "O Arjuna, even the mightiest warrior feels the weight of burden.",
    "Sadness/Grief":     "Beloved soul, grief is the shadow of love — and love is never wrong.",
    "Anger/Frustration": "O warrior, your fire is not your enemy — it is misdirected energy.",
    "Peace/Calm":        "O steady one, you walk already on the right path.",
    "Joy/Happiness":     "O joyful soul, this lightness you feel is the nature of your true self.",
}

_PRACTICAL: dict[str, str] = {
    "Confusion/Doubt":   "When the path is unclear, do not force the whole journey at once. Light one step, walk it honestly, then light the next.",
    "Anxiety/Worry":     "The mind that worries about tomorrow robs today of its peace. Return to this breath, this moment, this single action.",
    "Stress/Tension":    "Reduce the burden into its smallest parts. You need not carry everything at once — only what belongs to this moment.",
    "Sadness/Grief":     "Let the grief move through you without resistance. What you feel deeply, you have loved deeply — and that is sacred.",
    "Anger/Frustration": "Before you act from anger, pause. Ask: what is the wise response here? Then act from clarity, not from heat.",
    "Peace/Calm":        "Protect this stillness. It is your greatest strength. Act from it, speak from it, decide from it.",
    "Joy/Happiness":     "Share this joy — it multiplies when given. And let gratitude anchor it so it does not fade.",
}

_CLOSINGS: list[str] = [
    "You are not alone on this path. I walk with you.",
    "The Gita is not a book of answers — it is a mirror. Look into it and you will find yourself.",
    "Act without attachment to outcome, and peace will follow naturally.",
    "Every question you ask sincerely brings you one step closer to clarity.",
]


def _fallback_response(
    message: str,
    emotion: str,
    context: dict,
    retrieved_verses: list[dict],
) -> str:
    """Template-driven fallback used when Ollama is unavailable."""
    user_input         = context.get("user_input", "")
    prev_krishna_vaani = context.get("krishna_vaani", "")
    prev_guidance      = context.get("guidance", "")

    primary_verse       = retrieved_verses[0] if retrieved_verses else {}
    ch                  = primary_verse.get("chapter_number", "")
    vn                  = primary_verse.get("verse_number", "")
    translation         = primary_verse.get("translation") or primary_verse.get("text", "")
    verse_guidance      = primary_verse.get("guidance", "")
    verse_krishna_vaani = primary_verse.get("krishna_vaani", "")
    verse_ref           = f"Chapter {ch}, Verse {vn}" if ch and vn else ""

    msg_lower          = message.lower()
    is_expressing_pain = any(w in msg_lower for w in ["still", "can't", "cannot", "hard", "difficult", "struggling", "pain", "hurt"])
    is_asking          = any(w in msg_lower for w in ["why", "how", "explain", "what", "tell me"])
    is_gratitude       = any(w in msg_lower for w in ["thank", "thanks", "helpful", "good", "great"])

    parts: list[str] = [_OPENINGS.get(emotion, "Dear seeker,")]

    if is_expressing_pain:
        parts.append("I hear that this is still difficult. Know that struggle itself is the teacher — it is not a sign that you are failing, but that you are growing.")
    elif is_asking:
        parts.append("You ask with sincerity, and sincerity is the first step toward wisdom. Let me illuminate this further.")
    elif is_gratitude:
        parts.append("Your gratitude itself is a form of devotion. Continue on this path with an open heart.")
    else:
        snippet = message[:80] + ("..." if len(message) > 80 else "")
        parts.append(f'Your words — "{snippet}" — carry the weight of a genuine seeker.')

    if user_input:
        snippet = user_input[:100] + ("..." if len(user_input) > 100 else "")
        parts.append(f'You came to me feeling {emotion.lower()}, sharing: "{snippet}". This feeling is not your identity — it is a passing state, like clouds before the sun.')

    if translation and verse_ref:
        parts.append(f'The Gita speaks directly to this in {verse_ref}:\n"{translation}"\nThis verse reminds us that the soul is eternal and unchanging, while circumstances are temporary and ever-shifting.')
    elif prev_krishna_vaani:
        parts.append(f"As I said before: {prev_krishna_vaani}")

    if verse_krishna_vaani:
        parts.append(verse_krishna_vaani)
    elif verse_guidance:
        parts.append(verse_guidance)
    elif prev_guidance:
        parts.append(f"Remember the guidance: {prev_guidance}")

    parts.append(_PRACTICAL.get(emotion, "Act with awareness, speak with kindness, and rest in the knowledge that you are guided."))

    if len(retrieved_verses) > 1:
        v2  = retrieved_verses[1]
        ch2 = v2.get("chapter_number", "")
        vn2 = v2.get("verse_number", "")
        t2  = v2.get("translation") or v2.get("text", "")
        if ch2 and vn2 and t2:
            parts.append(f'Also consider Chapter {ch2}, Verse {vn2}: "{t2[:120]}{"..." if len(t2) > 120 else ""}"')

    parts.append(random.choice(_CLOSINGS))
    return "\n\n".join(parts)


def generate_krishna_response(
    message: str,
    emotion: str,
    context: dict,
    retrieved_verses: list[dict],
    chat_history: list[dict],
) -> str:
    """
    Generate a Krishna-style response using llama3:latest via Ollama.

    Falls back to the template-driven response if Ollama is not running
    or returns an error, so the app always works even without Ollama.

    Parameters
    ----------
    message           : current user message
    emotion           : detected emotion label
    context           : guidance context dict
    retrieved_verses  : formatted verse dicts from retrieval.py
    chat_history      : previous conversation turns
    """
    messages = build_messages(
        message=message,
        context=context,
        retrieved_verses=retrieved_verses,
        chat_history=chat_history,
    )

    try:
        logger.info("Calling Ollama model=%s", OLLAMA_MODEL)
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=messages,
            options={
                "temperature": 0.75,
                "top_p": 0.9,
                "num_predict": 512,   # max tokens in response
            },
        )
        text = response["message"]["content"].strip()
        logger.info("Ollama response received: %d chars", len(text))
        return text

    except ResponseError as exc:
        logger.warning("Ollama ResponseError (model=%s): %s — using fallback", OLLAMA_MODEL, exc)
    except Exception as exc:
        logger.warning("Ollama unavailable (%s) — using fallback", exc)

    return _fallback_response(message, emotion, context, retrieved_verses)
