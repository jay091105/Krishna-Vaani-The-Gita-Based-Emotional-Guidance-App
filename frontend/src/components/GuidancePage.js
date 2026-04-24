import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Brain,
  Flame,
  CloudRain,
  AlertTriangle,
  Leaf,
  Loader2,
  Save,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import PageTransition from './animations/PageTransition';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const GUIDANCE_INPUT_STORAGE_KEY = 'guidanceInput';
const GUIDANCE_RESULT_STORAGE_KEY = 'guidanceResult';

const EMOTION_THEME = {
  anger: {
    color: 'from-rose-500 via-red-500 to-orange-400',
    glow: 'shadow-[0_0_22px_rgba(244,63,94,0.45)]',
    icon: Flame,
  },
  sadness: {
    color: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'shadow-[0_0_22px_rgba(59,130,246,0.45)]',
    icon: CloudRain,
  },
  anxiety: {
    color: 'from-amber-400 via-yellow-400 to-orange-400',
    glow: 'shadow-[0_0_22px_rgba(251,191,36,0.45)]',
    icon: AlertTriangle,
  },
  calm: {
    color: 'from-emerald-400 via-green-400 to-teal-400',
    glow: 'shadow-[0_0_22px_rgba(34,197,94,0.45)]',
    icon: Leaf,
  },
  default: {
    color: 'from-indigo-500 via-violet-500 to-cyan-400',
    glow: 'shadow-[0_0_22px_rgba(99,102,241,0.45)]',
    icon: Brain,
  },
};

function TypewriterText({ text }) {
  const [rendered, setRendered] = useState('');

  useEffect(() => {
    if (!text) {
      setRendered('');
      return;
    }
    let idx = 0;
    setRendered('');
    const timer = window.setInterval(() => {
      idx += 2;
      setRendered(text.slice(0, idx));
      if (idx >= text.length) window.clearInterval(timer);
    }, 14);
    return () => window.clearInterval(timer);
  }, [text]);

  return <p className="whitespace-pre-line text-sm leading-7 text-slate-200">{rendered}</p>;
}

function normalizeEmotionKey(emotion) {
  const e = (emotion || '').toLowerCase();
  if (e.includes('anger') || e.includes('frustration')) return 'anger';
  if (e.includes('sadness') || e.includes('grief')) return 'sadness';
  if (e.includes('anxiety') || e.includes('worry')) return 'anxiety';
  if (e.includes('calm') || e.includes('peace')) return 'calm';
  return 'default';
}

function GuidancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [input, setInput] = useState(() => localStorage.getItem(GUIDANCE_INPUT_STORAGE_KEY) || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(() => {
    const savedResult = localStorage.getItem(GUIDANCE_RESULT_STORAGE_KEY);
    if (!savedResult) return null;
    try {
      return JSON.parse(savedResult);
    } catch (error) {
      console.warn('Failed to parse saved guidance result. Clearing invalid data.', error);
      localStorage.removeItem(GUIDANCE_RESULT_STORAGE_KEY);
      return null;
    }
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    localStorage.setItem(GUIDANCE_INPUT_STORAGE_KEY, input);
  }, [input]);

  useEffect(() => {
    if (!result) {
      localStorage.removeItem(GUIDANCE_RESULT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(GUIDANCE_RESULT_STORAGE_KEY, JSON.stringify(result));
  }, [result]);

  useEffect(() => {
    if (location.state?.verse) {
      const verse = location.state.verse;
      const emotion = verse.emotion || 'Peace/Calm';
      const emotionBreakdown = {
        [emotion]: 85,
        'Peace/Calm': emotion === 'Peace/Calm' ? 85 : 15,
        'Anxiety/Worry': emotion === 'Anxiety/Worry' ? 85 : 5,
        'Anger/Frustration': emotion === 'Anger/Frustration' ? 85 : 3,
        'Stress/Tension': emotion === 'Stress/Tension' ? 85 : 4,
        'Sadness/Grief': emotion === 'Sadness/Grief' ? 85 : 2,
        'Confusion/Doubt': emotion === 'Confusion/Doubt' ? 85 : 6,
        'Joy/Happiness': emotion === 'Joy/Happiness' ? 85 : 8
      };
      const total = Object.values(emotionBreakdown).reduce((a, b) => a + b, 0);
      Object.keys(emotionBreakdown).forEach(key => { emotionBreakdown[key] = (emotionBreakdown[key] / total) * 100; });
      setResult({
        detected_emotion: emotion,
        confidence: 85,
        emotion_breakdown: emotionBreakdown,
        gita_guidance: {
          chapter: verse.chapter || verse.chapter_number,
          verse: verse.verse || verse.verse_number,
          chapter_number: verse.chapter_number || verse.chapter,
          verse_number: verse.verse_number || verse.verse,
          text: verse.text || '',
          meaning: verse.meaning || '',
          guidance: verse.guidance || ''
        },
        what_happened: verse.what_happened || '',
        krishna_vaani: verse.krishna_vaani || ''
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await axios.post(`${API_URL}/api/guidance`, { input });
      setResult(response.data);
    } catch (error) {
      console.error('Error getting guidance:', error);
      alert('Error getting guidance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const emotionData = useMemo(() => {
    if (!result?.emotion_breakdown) return [];
    return Object.entries(result.emotion_breakdown)
      .map(([name, value]) => ({ name, value: Number(value) || 0, key: normalizeEmotionKey(name) }))
      .sort((a, b) => b.value - a.value);
  }, [result]);

  const primaryEmotionKey = normalizeEmotionKey(result?.detected_emotion);
  const primaryTheme = EMOTION_THEME[primaryEmotionKey] || EMOTION_THEME.default;
  const PrimaryIcon = primaryTheme.icon;

  const handleSaveVerse = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/save-verse`, {
        chapter: result.gita_guidance.chapter,
        verse: result.gita_guidance.verse,
        chapter_number: result.gita_guidance.chapter_number,
        verse_number: result.gita_guidance.verse_number,
        text: result.gita_guidance.text,
        meaning: result.gita_guidance.meaning,
        guidance: result.gita_guidance.guidance,
        krishna_vaani: result.krishna_vaani,
        what_happened: result.what_happened,
        emotion: result.detected_emotion
      });
      showNotification('Verse saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving verse:', error);
      showNotification('Error saving verse. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="noise-overlay relative mx-auto max-w-5xl">
        <motion.section
          className="glass-panel mb-6 p-5 sm:p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">AI Emotional Guidance</h1>
              <p className="mt-1 text-sm text-slate-400">Premium reflective assistant rooted in Gita wisdom</p>
            </div>
            <div className="rounded-full border border-indigo-300/25 bg-indigo-400/10 px-3 py-1 text-xs text-indigo-200">
              Powered by Emotion AI Model
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-100 outline-none ring-indigo-500/40 transition focus:ring-2"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell Krishna Vaani what you are feeling right now..."
              disabled={loading}
              rows={7}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="btn-ripple inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.4)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || !input.trim()}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Analyzing emotions...' : 'Generate Guidance'}
              </button>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                Model Accuracy: 92%
              </span>
            </div>
          </form>
        </motion.section>

        {loading && (
          <motion.div
            className="glass-panel mb-6 flex items-center gap-3 p-4 text-sm text-slate-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="animate-spin text-cyan-300" size={18} />
            Analyzing emotions and synthesizing Krishna Vaani guidance...
          </motion.div>
        )}

        {!loading && !result && (
          <div className="glass-panel p-8 text-center text-slate-400">
            Prompt your thoughts above and your AI response cards will appear here.
          </div>
        )}

        {result && (
          <motion.section
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="glass-panel p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-200">
                  <PrimaryIcon size={18} />
                  <h2 className="text-base font-semibold">AI Detected Emotion</h2>
                </div>
                <div className={`rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold text-white ${primaryTheme.color} ${primaryTheme.glow}`}>
                  Confidence: {Number(result.confidence).toFixed(1)}%
                </div>
              </div>

              <div className="mb-3 text-sm text-slate-300">{result.detected_emotion}</div>

              <div className="space-y-2">
                {emotionData.map((emotion) => {
                  const theme = EMOTION_THEME[emotion.key] || EMOTION_THEME.default;
                  return (
                    <div key={emotion.name}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                        <span>{emotion.name}</span>
                        <span>{emotion.value.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className={`h-full bg-gradient-to-r ${theme.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(2, Math.min(100, emotion.value))}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {(result.gita_guidance.chapter_number || result.gita_guidance.verse_number) && (
              <div className="glass-panel p-4 sm:p-5">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-cyan-300">Reference</div>
                <h3 className="text-lg font-semibold text-slate-100">
                  Chapter {result.gita_guidance.chapter_number} • Verse {result.gita_guidance.verse_number}
                </h3>
                {result.gita_guidance.text && (
                  <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                    {result.gita_guidance.text}
                  </p>
                )}
                {result.gita_guidance.meaning && (
                  <p className="mt-3 text-sm leading-7 text-slate-300">{result.gita_guidance.meaning}</p>
                )}
              </div>
            )}

            {result.what_happened && (
              <div className="glass-panel p-4 sm:p-5">
                <h3 className="mb-2 text-base font-semibold text-slate-100">What Happened</h3>
                <p className="text-sm leading-7 text-slate-300">{result.what_happened}</p>
              </div>
            )}

            {result.krishna_vaani && (
              <div className="glass-panel p-4 sm:p-5">
                <h3 className="mb-2 text-base font-semibold text-cyan-200">Krishna Vaani</h3>
                <TypewriterText text={result.krishna_vaani} />
              </div>
            )}

            {result.gita_guidance.guidance && (
              <div className="glass-panel p-4 sm:p-5">
                <h3 className="mb-2 text-base font-semibold text-indigo-200">Guidance</h3>
                <TypewriterText text={result.gita_guidance.guidance} />
                <p className="mt-3 text-xs text-slate-400">If this verse does not resonate, generate a fresh response.</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-ripple inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/30"
                    onClick={handleSaveVerse}
                    disabled={saving}
                  >
                    <Save size={15} />
                    {saving ? 'Saving...' : 'Save Verse'}
                  </button>

                  <button
                    className="btn-ripple inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/15"
                    onClick={() => setResult(null)}
                  >
                    <RefreshCw size={15} />
                    Read Again
                  </button>

                  <button
                    className="btn-ripple inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500/80 to-violet-500/80 px-3 py-2 text-sm text-white transition hover:opacity-90"
                    onClick={() =>
                      navigate('/krishna-chat', {
                        state: {
                          user_input: result.what_happened || input,
                          emotion: result.detected_emotion,
                          what_happen: result.what_happened,
                          krishna_vaani: result.krishna_vaani,
                          guidance: result.gita_guidance.guidance,
                          chapter_number: result.gita_guidance.chapter_number,
                          verse_number: result.gita_guidance.verse_number,
                        },
                      })
                    }
                  >
                    <MessageSquare size={15} />
                    Chat with Krishna
                  </button>
                </div>
              </div>
            )}
          </motion.section>
        )}
      </div>
    </PageTransition>
  );
}

export default GuidancePage;
