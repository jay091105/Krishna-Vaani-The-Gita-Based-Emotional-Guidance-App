import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import PageTransition from './animations/PageTransition';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const APP_SYMBOL = 'AI';
const CHAT_EMOTION_STORAGE_KEY = 'chatSelectedEmotion';

const EMOTION_CHOICES = [
  'Auto Detect',
  'Peace/Calm',
  'Anxiety/Worry',
  'Anger/Frustration',
  'Stress/Tension',
  'Sadness/Grief',
  'Confusion/Doubt',
  'Joy/Happiness',
];

// ── Typing animation bubble ────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div className="flex max-w-[86%] items-start gap-2 self-start">
      <div className="mt-0.5 grid h-8 w-8 place-content-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 text-sm shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        {APP_SYMBOL}
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ── Verse reference pill ───────────────────────────────────────────────────────
function VerseRef({ chapter, verse, translation }) {
  const [open, setOpen] = useState(false);
  if (!chapter || !verse) return null;
  return (
    <div className="mt-2">
      <button
        className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
        onClick={() => setOpen((o) => !o)}
      >
        📖 Chapter {chapter} · Verse {verse}
        <span className="ml-1 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && translation && (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs italic leading-6 text-slate-300">
          "{translation}"
        </div>
      )}
    </div>
  );
}

// ── Single message bubble ──────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.type === 'user';
  const paragraphs = (msg.text || '').split('\n\n').filter(Boolean);

  return (
    <motion.div
      className={`flex max-w-[86%] gap-2 ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {!isUser && (
        <div className="mt-0.5 grid h-8 w-8 place-content-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 text-sm shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          {APP_SYMBOL}
        </div>
      )}

      <div
        className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-tr-sm bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_10px_25px_rgba(99,102,241,0.35)]'
            : 'rounded-tl-sm border border-white/10 bg-white/[0.04] text-slate-100'
        }`}
      >
        <div className="space-y-2 text-sm leading-7">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {msg.verse_references?.map((vr, i) => (
          <VerseRef key={i} chapter={vr.chapter} verse={vr.verse} translation={vr.translation} />
        ))}

        <div className={`mt-2 text-right text-[11px] ${isUser ? 'text-indigo-100/80' : 'text-slate-400'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {isUser && (
        <div className="mt-0.5 grid h-8 w-8 place-content-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm shadow-[0_0_15px_rgba(99,102,241,0.4)]">
          🙏
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function KrishnaChat({ guidanceContext: propContext }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Accept context from router state (Guidance page redirect) or prop (embedded)
  const routeContext = location.state || null;
  const context = routeContext || propContext || {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState(() => {
    const stored = localStorage.getItem(CHAT_EMOTION_STORAGE_KEY) || 'Auto Detect';
    if (stored === 'Auto Detect' || EMOTION_CHOICES.includes(stored)) return stored;
    return 'Auto Detect';
  });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(CHAT_EMOTION_STORAGE_KEY, selectedEmotion);
  }, [selectedEmotion]);

  useEffect(() => {
    const contextEmotion = context.emotion;
    if (contextEmotion && EMOTION_CHOICES.includes(contextEmotion)) {
      setSelectedEmotion(contextEmotion);
    }
  }, [context.emotion]);

  // Initial greeting on mount
  useEffect(() => {
    const emotion = context.emotion || '';
    const greeting = emotion
      ? `Namaste. I see you are feeling ${emotion.toLowerCase()}. I am here with you. Share what is in your heart, and let the wisdom of the Gita bring clarity to your path.`
      : 'Namaste. I am here, always with you. Share what is in your heart, and let the wisdom of the Gita bring clarity to your path.';

    setMessages([{
      type: 'krishna',
      text: greeting,
      timestamp: new Date().toISOString(),
      verse_references: [],
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    const userMsg = { type: 'user', text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Build chat_history from current messages (exclude greeting for brevity)
    const chatHistory = messages.slice(1).map(m => ({ type: m.type, text: m.text }));

    try {
      const res = await axios.post(`${API_URL}/api/rag-chat`, {
        message: text,
        selected_emotion: selectedEmotion,
        context: {
          user_input:    context.user_input    || '',
          emotion:       context.emotion       || '',
          what_happen:   context.what_happen   || '',
          krishna_vaani: context.krishna_vaani || '',
          guidance:      context.guidance      || '',
        },
        chat_history: chatHistory,
      });

      setMessages(prev => [...prev, {
        type: 'krishna',
        text: res.data.response,
        timestamp: res.data.timestamp || new Date().toISOString(),
        verse_references: res.data.verse_references || [],
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        type: 'krishna',
        text: 'Forgive me, dear seeker. Something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
        verse_references: [],
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const isStandalone = !!routeContext;

  return (
    <PageTransition>
    <div className="glass-panel mx-auto flex h-[calc(100vh-160px)] w-full max-w-6xl flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900/70 to-slate-800/50 px-5 py-4">
        <div className="flex items-center gap-3">
          {isStandalone && (
            <button
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
          )}

          <div className="grid h-10 w-10 place-content-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 text-lg shadow-[0_0_18px_rgba(34,211,238,0.45)]">
            {APP_SYMBOL}
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Chat with Krishna</h2>
            <p className="text-sm text-slate-400">
              {context.emotion
                ? `Guidance for: ${context.emotion}`
                : 'Bhagavad Gita · RAG-powered wisdom'}
            </p>
          </div>
        </div>

        {context.chapter_number && context.verse_number && (
          <div className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
            📖 Ch {context.chapter_number} · V {context.verse_number}
          </div>
        )}
      </div>

      <div className="border-b border-white/10 bg-slate-900/35 px-5 py-3">
        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">Emotion Mode for chat response</div>
        <div className="flex flex-wrap gap-2">
          {EMOTION_CHOICES.map((emotionChoice) => {
            const active = selectedEmotion === emotionChoice;
            return (
              <button
                key={emotionChoice}
                type="button"
                onClick={() => setSelectedEmotion(emotionChoice)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? 'border-cyan-300/45 bg-cyan-400/20 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {emotionChoice}
              </button>
            );
          })}
        </div>
      </div>

      {isStandalone && context.krishna_vaani && (
        <div className="flex items-start gap-2 border-b border-cyan-300/20 bg-cyan-400/10 px-5 py-3">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Previous guidance</span>
          <span className="line-clamp-2 text-sm italic text-slate-300">"{context.krishna_vaani}"</span>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-950/25 px-5 py-5">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        </AnimatePresence>
        {loading && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      <form className="flex gap-3 border-t border-white/10 bg-slate-900/40 px-5 py-4" onSubmit={handleSend}>
        <motion.input
          ref={inputRef}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400/35 transition placeholder:text-slate-400 focus:ring-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Krishna anything..."
          disabled={loading}
          autoComplete="off"
          whileFocus={{ scale: 1.005 }}
          transition={{ duration: 0.2 }}
        />

        <button
          type="submit"
          className="btn-ripple grid h-12 w-12 place-content-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] transition hover:brightness-110 disabled:opacity-50"
          disabled={loading || !input.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
    </PageTransition>
  );
}

export default KrishnaChat;
