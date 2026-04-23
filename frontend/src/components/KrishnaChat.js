import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import PageTransition from './animations/PageTransition';
import './KrishnaChat.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ── Typing animation bubble ────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div className="kc-message kc-krishna">
      <div className="kc-avatar">🕉</div>
      <div className="kc-bubble kc-bubble-krishna">
        <div className="kc-typing">
          <span /><span /><span />
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
    <div className="kc-verse-ref">
      <button className="kc-verse-pill" onClick={() => setOpen(o => !o)}>
        📖 Chapter {chapter} · Verse {verse}
        <span className="kc-verse-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && translation && (
        <div className="kc-verse-expand">"{translation}"</div>
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
      className={`kc-message ${isUser ? 'kc-user' : 'kc-krishna'}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {!isUser && <div className="kc-avatar">🕉</div>}
      <div className={`kc-bubble ${isUser ? 'kc-bubble-user' : 'kc-bubble-krishna'}`}>
        <div className="kc-text">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {msg.verse_references?.map((vr, i) => (
          <VerseRef key={i} chapter={vr.chapter} verse={vr.verse} translation={vr.translation} />
        ))}
        <div className="kc-time">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUser && <div className="kc-avatar kc-avatar-user">🙏</div>}
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
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

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
    <div className={`kc-page ${isStandalone ? 'kc-standalone' : 'kc-embedded'}`}>
      {/* Header */}
      <div className="kc-header">
        <div className="kc-header-left">
          {isStandalone && (
            <button className="kc-back-btn" onClick={() => navigate(-1)}>← Back</button>
          )}
          <div className="kc-header-avatar">🕉</div>
          <div>
            <h2 className="kc-header-title">Chat with Krishna</h2>
            <p className="kc-header-sub">
              {context.emotion
                ? `Guidance for: ${context.emotion}`
                : 'Bhagavad Gita · RAG-powered wisdom'}
            </p>
          </div>
        </div>
        {context.chapter_number && context.verse_number && (
          <div className="kc-context-pill">
            📖 Ch {context.chapter_number} · V {context.verse_number}
          </div>
        )}
      </div>

      {/* Context banner (only when coming from Guidance page) */}
      {isStandalone && context.krishna_vaani && (
        <div className="kc-context-banner">
          <span className="kc-banner-label">Previous guidance</span>
          <span className="kc-banner-text">"{context.krishna_vaani}"</span>
        </div>
      )}

      {/* Messages */}
      <div className="kc-messages">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        </AnimatePresence>
        {loading && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="kc-input-row" onSubmit={handleSend}>
        <motion.input
          ref={inputRef}
          className="kc-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Krishna anything..."
          disabled={loading}
          autoComplete="off"
          whileFocus={{ scale: 1.01, boxShadow: '0 0 0 3px rgba(20,184,166,0.18)' }}
          transition={{ duration: 0.2 }}
        />
        <button type="submit" className="kc-send-btn" disabled={loading || !input.trim()}>
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
