import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bookmark, Sparkles, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import PageTransition from './animations/PageTransition';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const EMOTIONS = [
  'All',
  'Peace/Calm',
  'Joy/Happiness',
  'Anxiety/Worry',
  'Stress/Tension',
  'Anger/Frustration',
  'Sadness/Grief',
  'Confusion/Doubt',
];

function SavedVersesPage() {
  const [savedVerses, setSavedVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [selectedEmotion, setSelectedEmotion] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSavedVerses = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/saved-verses`);
        setSavedVerses(response.data.saved_verses || []);
      } catch (error) {
        console.error('Error fetching saved verses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedVerses();
  }, []);

  const filteredVerses = useMemo(() => {
    if (selectedEmotion === 'All') return savedVerses;
    return savedVerses.filter((verse) => verse.emotion === selectedEmotion);
  }, [savedVerses, selectedEmotion]);

  const handleDelete = async (verseId) => {
    if (!window.confirm('Are you sure you want to delete this verse?')) return;
    setDeleting(verseId);
    try {
      await axios.delete(`${API_URL}/api/saved-verse/${verseId}`);
      setSavedVerses((prev) => prev.filter((v) => v.id !== verseId));
    } catch (error) {
      console.error('Error deleting verse:', error);
      alert('Error deleting verse. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleReadAgain = (verse) => {
    navigate('/', {
      state: {
        verse: {
          ...verse,
          chapter: verse.chapter || verse.chapter_number,
          verse: verse.verse || verse.verse_number,
          chapter_number: verse.chapter_number || verse.chapter,
          verse_number: verse.verse_number || verse.verse,
        },
      },
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="glass-panel flex min-h-[280px] items-center justify-center gap-3 p-6 text-slate-300">
          <Loader2 className="animate-spin text-cyan-300" size={20} />
          Loading AI memory cards...
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        <section className="glass-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">AI Memory Vault</h1>
              <p className="text-sm text-slate-400">Saved verses with emotional context and model insights</p>
            </div>
            <div className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-xs text-violet-100">
              <Sparkles size={13} className="mr-1 inline" />
              AI Insight Archive
            </div>
          </div>
        </section>

        {savedVerses.length > 0 && (
          <section className="flex flex-wrap gap-2">
            {EMOTIONS.map((emotion) => (
              <button
                key={emotion}
                className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                  selectedEmotion === emotion
                    ? 'border-cyan-300/45 bg-cyan-400/20 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
                onClick={() => setSelectedEmotion(emotion)}
              >
                {emotion}
                {emotion !== 'All' && ` (${savedVerses.filter((v) => v.emotion === emotion).length})`}
              </button>
            ))}
          </section>
        )}

        {savedVerses.length === 0 ? (
          <div className="glass-panel p-8 text-center text-slate-300">
            <Bookmark className="mx-auto mb-3 text-slate-400" />
            <h3 className="text-lg font-semibold">No saved verses yet</h3>
            <p className="mt-1 text-sm text-slate-400">Save verses from guidance to build your AI wisdom library.</p>
          </div>
        ) : filteredVerses.length === 0 ? (
          <div className="glass-panel p-8 text-center text-slate-300">
            <h3 className="text-lg font-semibold">No verses for {selectedEmotion}</h3>
            <p className="mt-1 text-sm text-slate-400">Choose a different emotion filter.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredVerses.map((verse, index) => (
              <motion.article
                key={verse.id}
                className="glass-panel p-4 transition hover:shadow-[0_0_28px_rgba(99,102,241,0.35)]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.3) }}
                whileHover={{ scale: 1.015 }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-slate-100">
                    Chapter {verse.chapter_number || verse.chapter} • Verse {verse.verse_number || verse.verse}
                  </h4>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[11px] text-violet-100">
                      AI Insight
                    </span>
                    {verse.emotion && (
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-100">
                        {verse.emotion}
                      </span>
                    )}
                  </div>
                </div>

                {verse.text && (
                  <p className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm italic text-slate-300">
                    {verse.text}
                  </p>
                )}

                {verse.meaning && <p className="mb-2 text-sm leading-7 text-slate-300">{verse.meaning}</p>}
                {verse.what_happened && <p className="mb-2 text-sm leading-7 text-slate-300">{verse.what_happened}</p>}
                {verse.krishna_vaani && (
                  <p className="mb-2 rounded-xl border border-indigo-300/15 bg-indigo-500/10 p-3 text-sm leading-7 text-indigo-100">
                    {verse.krishna_vaani}
                  </p>
                )}
                {verse.guidance && <p className="text-sm leading-7 text-slate-300">{verse.guidance}</p>}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Saved on {formatDate(verse.timestamp)}</span>
                  <div className="flex gap-2">
                    <button
                      className="btn-ripple inline-flex items-center gap-1 rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs text-indigo-100 transition hover:bg-indigo-500/30"
                      onClick={() => handleReadAgain(verse)}
                    >
                      <RotateCcw size={12} />
                      Read Again
                    </button>
                    <button
                      className="btn-ripple inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-50"
                      onClick={() => handleDelete(verse.id)}
                      disabled={deleting === verse.id}
                    >
                      <Trash2 size={12} />
                      {deleting === verse.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default SavedVersesPage;
