import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Loader2, Sparkles, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import PageTransition from './animations/PageTransition';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CHAPTER_NAMES = {
  1: "Arjuna Vishada Yoga",
  2: "Sankhya Yoga",
  3: "Karma Yoga",
  4: "Jnana Karma Sanyasa Yoga",
  5: "Karma Sanyasa Yoga",
  6: "Dhyana Yoga",
  7: "Jnana Vijnana Yoga",
  8: "Aksara Brahma Yoga",
  9: "Raja Vidya Raja Guhya Yoga",
  10: "Vibhuti Yoga",
  11: "Visvarupa Darsana Yoga",
  12: "Bhakti Yoga",
  13: "Ksetra Ksetrajna Vibhaga Yoga",
  14: "Gunatraya Vibhaga Yoga",
  15: "Purusottama Yoga",
  16: "Daivasura Sampad Vibhaga Yoga",
  17: "Sraddhatraya Vibhaga Yoga",
  18: "Moksa Sanyasa Yoga",
};

function getChapterNumbers(chapters) {
  return Object.keys(chapters)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
}

function GitaReader() {
  const { showNotification } = useNotification();
  const [chapters, setChapters] = useState({});
  const [readingProgress, setReadingProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedVerseIndex, setSelectedVerseIndex] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/gita-chapters`);
        setChapters(response.data.chapters || {});
        setReadingProgress(response.data.reading_progress || {});
      } catch (error) {
        console.error('Error fetching chapters:', error);
        showNotification('Failed to load Gita chapters', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [showNotification]);

  const chapterNumbers = useMemo(() => getChapterNumbers(chapters), [chapters]);
  const currentChapter = selectedChapter ? chapters[selectedChapter] : null;
  const verses = currentChapter?.verses || [];
  const selectedVerse = selectedVerseIndex !== null ? verses[selectedVerseIndex] : null;

  const getChapterProgress = (chapterNum) => {
    const key = `chapter_${chapterNum}`;
    const progress = readingProgress[key];
    if (!progress || !chapters[chapterNum]) return 0;
    const total = chapters[chapterNum].verses.length;
    const completed = progress.completed_verses?.length || 0;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const isVerseCompleted = (chapterNum, verseNum) => {
    const key = `chapter_${chapterNum}`;
    return readingProgress[key]?.completed_verses?.includes(verseNum) || false;
  };

  const markVerseRead = async (chapterNum, verseNum) => {
    try {
      await axios.post(`${API_URL}/api/update-reading-progress`, {
        chapter: chapterNum,
        verse: verseNum,
      });

      const chapterKey = `chapter_${chapterNum}`;
      setReadingProgress((prev) => ({
        ...prev,
        [chapterKey]: {
          ...prev[chapterKey],
          chapter: chapterNum,
          completed_verses: [...(prev[chapterKey]?.completed_verses || []), verseNum].filter(
            (v, i, arr) => arr.indexOf(v) === i,
          ),
          last_read_verse: verseNum,
          last_read_date: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const selectChapter = (chapterNum) => {
    setSelectedChapter(chapterNum);
    setSelectedVerseIndex(null);
  };

  const selectVerse = async (index) => {
    if (!selectedChapter) return;
    const verse = verses[index];
    const verseNum = parseInt(verse?.verse_number || verse?.verse || index + 1, 10);
    setSelectedVerseIndex(index);
    await markVerseRead(selectedChapter, verseNum);
  };

  const goPrev = () => {
    if (selectedVerseIndex === null || selectedVerseIndex <= 0) return;
    selectVerse(selectedVerseIndex - 1);
  };

  const goNext = () => {
    if (selectedVerseIndex === null || selectedVerseIndex >= verses.length - 1) return;
    selectVerse(selectedVerseIndex + 1);
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="glass-panel flex h-[calc(100vh-80px)] items-center justify-center gap-3 p-6 text-slate-300">
          <Loader2 size={20} className="animate-spin text-cyan-300" />
          Loading Gita knowledge graph...
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="h-[calc(100vh-80px)] overflow-hidden p-6">
      <div className="grid h-full grid-cols-[280px_1fr_320px] gap-6">
        <aside className="glass-panel h-full overflow-y-auto p-4 scroll-smooth">
          <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <BookOpen size={16} className="text-cyan-300" />
            Gita Chapters
          </div>
          <div className="flex flex-col gap-3">
            {chapterNumbers.map((chapterNum) => {
              const active = chapterNum === selectedChapter;
              const progress = getChapterProgress(chapterNum);
              return (
                <button
                  key={chapterNum}
                  onClick={() => selectChapter(chapterNum)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-indigo-300/40 bg-indigo-500/20'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Chapter {chapterNum}</span>
                    <span>{progress}%</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{CHAPTER_NAMES[chapterNum]}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        </aside>

        <main className="glass-panel h-full overflow-y-auto p-4 sm:p-5">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {!selectedChapter ? (
            <div className="grid min-h-[300px] place-content-center text-center">
              <h2 className="text-xl font-semibold text-slate-100">AI Knowledge Explorer</h2>
              <p className="mt-1 text-sm text-slate-400">Choose a chapter to browse verses and insights.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    Chapter {selectedChapter}: {CHAPTER_NAMES[selectedChapter]}
                  </h2>
                  <p className="text-xs text-slate-400">{verses.length} verses available</p>
                </div>
                <div className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                  {getChapterProgress(selectedChapter)}% completed
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-2">
                {verses.map((verse, index) => {
                  const verseNum = parseInt(verse.verse_number || verse.verse || index + 1, 10);
                  const active = selectedVerseIndex === index;
                  const completed = isVerseCompleted(selectedChapter, verseNum);

                  return (
                    <motion.button
                      key={`${selectedChapter}-${verseNum}-${index}`}
                      onClick={() => selectVerse(index)}
                      className={`rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-cyan-300/55 bg-cyan-400/12 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                      }`}
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-slate-300">Verse {verseNum}</span>
                        {completed && <CheckCircle2 size={14} className="text-emerald-300" />}
                      </div>
                      <p className="line-clamp-3 text-xs leading-6 text-slate-400">
                        {(verse.text || verse.translation || verse.meaning || '').slice(0, 160)}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}
          </div>
        </main>

        <aside className="h-full overflow-y-auto">
          <div className="glass-panel sticky top-20 space-y-4 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Sparkles size={16} className="text-violet-300" />
            AI Insight Panel
          </div>

          <AnimatePresence mode="wait">
            {!selectedVerse ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-400"
              >
                Select any verse to view translation, meaning, and reflective AI context.
              </motion.div>
            ) : (
              <motion.div
                key={`verse-${selectedVerseIndex}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-indigo-200">Selected Verse</p>
                  <p className="mt-1 font-semibold">Verse {selectedVerse.verse_number || selectedVerse.verse || (selectedVerseIndex + 1)}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-slate-300">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">Translation</p>
                  {selectedVerse.text || selectedVerse.translation || 'No translation available.'}
                </div>

                {(selectedVerse.what_happened || selectedVerse.meaning) && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-slate-300">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-200">AI Insight</p>
                    {selectedVerse.what_happened || selectedVerse.meaning}
                  </div>
                )}

                {selectedVerse.krishna_vaani && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-cyan-100">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">Krishna Insight</p>
                    {selectedVerse.krishna_vaani}
                  </div>
                )}

                {selectedVerse.guidance && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-violet-100">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-200">Guidance</p>
                    {selectedVerse.guidance}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={goPrev}
                    disabled={selectedVerseIndex === null || selectedVerseIndex <= 0}
                    className="btn-ripple inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/15 disabled:opacity-40"
                  >
                    <ArrowLeft size={13} />
                    Prev
                  </button>
                  <button
                    onClick={goNext}
                    disabled={selectedVerseIndex === null || selectedVerseIndex >= verses.length - 1}
                    className="btn-ripple inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/15 disabled:opacity-40"
                  >
                    Next
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </aside>
      </div>
      </div>
    </PageTransition>
  );
}

export default GitaReader;
