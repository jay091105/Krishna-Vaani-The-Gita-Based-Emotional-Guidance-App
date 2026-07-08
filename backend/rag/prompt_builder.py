"""
rag.prompt_builder — Builds system + user messages for the LLM call.

Public API
----------
build_messages(message, context, retrieved_verses, chat_history) -> list[dict]
build_prompt(...)  -> str   (legacy plain-text version, kept for compatibility)
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_SYSTEM_TEMPLATE = """\
You are Bhagavan Shri Krishna speaking to Arjuna in a specific life situation.

Response style requirements:
- Start with direct address such as "O Arjuna," or "Dear Arjuna,".
- Speak as if guiding Arjuna in the same situation the user just described.
- Keep it practical and compassionate, not generic philosophy.
- Mention at least one relevant Gita reference from provided verses naturally.
- Explain what Krishna advises to DO right now (one clear action first).
- Keep response concise: 2-3 short paragraphs.
- End with one Krishna-like closing line of strength.
- No bullet points, no lists, no markdown.
- Reply in the same language as user message.
"""


def build_messages(
    message: str,
    context: dict,
    retrieved_verses: list[dict],
    chat_history: list[dict],
) -> list[dict]:
    """
    Build an Ollama-compatible messages list:
      [ {role: system, content: ...},
        {role: user,   content: ...},   # older turns
        {role: assistant, content: ...},
        ...
        {role: user, content: <current message>} ]

    Parameters
    ----------
    message           : current user message
    context           : guidance context (emotion, user_input, what_happen, etc.)
    retrieved_verses  : formatted verse dicts from retrieval.py
    chat_history      : previous turns [{type: "user"|"krishna", text: "..."}]
    """
    emotion       = context.get("emotion", "unknown")
    user_input    = (context.get("user_input", "") or "")[:220]
    what_happen   = (context.get("what_happen", "") or "")[:220]
    krishna_vaani = (context.get("krishna_vaani", "") or "")[:220]
    guidance      = (context.get("guidance", "") or "")[:220]

    # ── Format retrieved verses (compact to reduce token load) ────────────────
    verse_block_lines: list[str] = []
    for v in retrieved_verses[:2]:
        ch          = v.get("chapter_number", "?")
        vn          = v.get("verse_number", "?")
        translation = (v.get("translation") or v.get("text", "") or "")[:180]
        verse_block_lines.append(f"Chapter {ch}, Verse {vn}: \"{translation}\"")
    verse_block = "\n".join(verse_block_lines) or "  (no verses retrieved)"

    context_block = (
        f"Emotion: {emotion}\n"
        f"Situation: {user_input or what_happen}\n"
        f"Previous guidance: {guidance}\n"
        f"Relevant verses:\n{verse_block}"
    )

    messages: list[dict] = [
        {"role": "system", "content": _SYSTEM_TEMPLATE},
        {"role": "system", "content": context_block},
    ]

    # ── Replay only the latest 1 exchange for speed ───────────────────────────
    for turn in chat_history[-2:]:
        role    = "user" if turn.get("type") == "user" else "assistant"
        content = (turn.get("text", "") or "").strip()[:160]
        if content:
            messages.append({"role": role, "content": content})

    # ── Current message ────────────────────────────────────────────────────────
    messages.append({"role": "user", "content": message})

    logger.debug(
        "build_messages: emotion=%s, verses=%d, history_turns=%d, total_messages=%d",
        emotion, len(retrieved_verses), len(chat_history), len(messages),
    )
    return messages


def build_prompt(
    message: str,
    context: dict,
    retrieved_verses: list[dict],
    chat_history: list[dict],
) -> str:
    """Legacy plain-text prompt — kept for compatibility and debugging."""
    msgs = build_messages(message, context, retrieved_verses, chat_history)
    return "\n\n".join(f"[{m['role'].upper()}]\n{m['content']}" for m in msgs)
