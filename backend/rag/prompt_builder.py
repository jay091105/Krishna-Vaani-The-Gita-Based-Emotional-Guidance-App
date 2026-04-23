"""
rag.prompt_builder — Builds system + user messages for the Ollama LLM call.

Public API
----------
build_messages(message, context, retrieved_verses, chat_history) -> list[dict]
build_prompt(...)  -> str   (legacy plain-text version, kept for compatibility)
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_SYSTEM_TEMPLATE = """\
You are Lord Krishna speaking directly to a seeker (Arjuna) in the style of the Bhagavad Gita.

Rules:
- Speak with calm, deep wisdom — never preachy or robotic.
- Address the seeker warmly: "Dear one", "O Arjuna", "O seeker", etc.
- Always reference the retrieved Gita verses naturally in your response.
- Keep the response focused: 3–5 paragraphs maximum.
- End with one short, memorable closing line.
- Do NOT use bullet points or numbered lists.
- Do NOT repeat the seeker's words back verbatim.
- Respond in the same language the seeker used (Hindi or English).
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
    user_input    = context.get("user_input", "")
    what_happen   = context.get("what_happen", "")
    krishna_vaani = context.get("krishna_vaani", "")
    guidance      = context.get("guidance", "")

    # ── Format retrieved verses ────────────────────────────────────────────────
    verse_block_lines: list[str] = []
    for v in retrieved_verses:
        ch          = v.get("chapter_number", "?")
        vn          = v.get("verse_number", "?")
        translation = v.get("translation") or v.get("text", "")
        kv          = v.get("krishna_vaani", "")
        tags        = ", ".join(v.get("emotion_tags", []))
        verse_block_lines.append(
            f"  • Chapter {ch}, Verse {vn}: \"{translation}\""
            + (f"\n    Krishna Vaani: \"{kv}\"" if kv else "")
            + f"\n    [emotion tags: {tags}]"
        )
    verse_block = "\n".join(verse_block_lines) or "  (no verses retrieved)"

    # ── Build context block injected into the first user turn ─────────────────
    context_block = (
        f"[CONTEXT]\n"
        f"Seeker's emotion: {emotion}\n"
        f"Original situation: {user_input}\n"
        f"What happened: {what_happen}\n"
        f"Previous Krishna Vaani given: {krishna_vaani}\n"
        f"Previous guidance given: {guidance}\n"
        f"\n[RELEVANT GITA VERSES]\n{verse_block}\n"
    )

    messages: list[dict] = [{"role": "system", "content": _SYSTEM_TEMPLATE}]

    # ── Inject context as a hidden system note before history ─────────────────
    messages.append({"role": "user", "content": context_block})
    messages.append({
        "role": "assistant",
        "content": "I have received the seeker's context and the relevant Gita verses. I am ready to respond with wisdom."
    })

    # ── Replay last 3 exchanges from chat history ──────────────────────────────
    for turn in chat_history[-6:]:
        role    = "user" if turn.get("type") == "user" else "assistant"
        content = turn.get("text", "").strip()
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
