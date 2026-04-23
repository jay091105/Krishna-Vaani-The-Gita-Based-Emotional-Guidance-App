import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from '../contexts/NotificationContext';
import PageTransition from './animations/PageTransition';
import './GitaReader.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CHAPTER_NAMES = {
  1:  "Arjuna Vishada Yoga",
  2:  "Sankhya Yoga",
  3:  "Karma Yoga",
  4:  "Jnana Karma Sanyasa Yoga",
  5:  "Karma Sanyasa Yoga",
  6:  "Dhyana Yoga",
  7:  "Jnana Vijnana Yoga",
  8:  "Aksara Brahma Yoga",
  9:  "Raja Vidya Raja Guhya Yoga",
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

const CHAPTER_SUBTITLES = {
  1:  "The Yoga of Arjuna's Dejection",
  2:  "The Yoga of Knowledge",
  3:  "The Yoga of Action",
  4:  "The Yoga of Knowledge and Renunciation",
  5:  "The Yoga of Renunciation",
  6:  "The Yoga of Meditation",
  7:  "The Yoga of Knowledge and Wisdom",
  8:  "The Yoga of the Imperishable Brahman",
  9:  "The Yoga of Royal Knowledge and Royal Secret",
  10: "The Yoga of Divine Glories",
  11: "The Yoga of the Vision of the Universal Form",
  12: "The Yoga of Devotion",
  13: "The Yoga of the Field and the Knower of the Field",
  14: "The Yoga of the Three Gunas",
  15: "The Yoga of the Supreme Person",
  16: "The Yoga of the Divine and Demoniac Natures",
  17: "The Yoga of the Three Kinds of Faith",
  18: "The Yoga of Liberation and Renunciation",
};

const getChapterNumbers = (chapterMap) =>
  Object.keys(chapterMap)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);

// ── Verse detail — continuous reading layout ───────────────────────────────────
function VerseDetail({ translation, whatHappened, krishnaVaani, guidance }) {
  return (
    <div className="gr-detail">

      {translation && (
        <div className="gr-detail-section">
          <span className="gr-detail-label">Translation</span>
          <p className="gr-detail-translation">{translation}</p>
        </div>
      )}

      {whatHappened && (
        <>
          <div className="gr-detail-divider" />
          <div className="gr-detail-section">
            <span className="gr-detail-label">What Happened</span>
            <p className="gr-detail-body">{whatHappened}</p>
          </div>
        </>
      )}

      {krishnaVaani && (
        <>
          <div className="gr-detail-divider" />
          <div className="gr-detail-krishna">
            <div className="gr-krishna-eyebrow">
              <span className="gr-krishna-om">🕉</span>
              Krishna Vaani
            </div>
            <p className="gr-krishna-text">{krishnaVaani}</p>
          </div>
        </>
      )}

      {guidance && (
        <>
          <div className="gr-detail-divider" />
          <div className="gr-detail-section">
            <span className="gr-detail-label">Guidance</span>
            <p className="gr-detail-body">{guidance}</p>
          </div>
        </>
      )}

      {!translation && !whatHappened && !krishnaVaani && !guidance && (
        <p className="gr-no-content">No detailed content available for this verse.</p>
      )}
    </div>
  );
}

// ── Verse detail modal ─────────────────────────────────────────────────────────
function VerseModal({ verse, chapterNum, verseNum, isCompleted, onClose, onMarkRead, onPrev, onNext, hasPrev, hasNext }) {
  const overlayRef = useRef(null);

  // Lock body scroll when modal is open, close on Escape, navigate on arrow keys
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handler = (e) => {
      if (e.key === 'Escape')                onClose();
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft'  && hasPrev) onPrev();
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <motion.div
      className="gr-modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="gr-modal"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Modal header */}
        <div className="gr-modal-header">
          <div>
            <div className="gr-modal-chapter">Chapter {chapterNum} · Verse {verseNum}</div>
            <div className="gr-modal-title">{CHAPTER_NAMES[chapterNum] || `Chapter ${chapterNum}`}</div>
          </div>
          <div className="gr-modal-actions">
            <button
              className={`gr-mark-btn ${isCompleted ? 'done' : ''}`}
              onClick={onMarkRead}
            >
              {isCompleted ? '✓ Read' : 'Mark as Read'}
            </button>
            <button className="gr-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Content — continuous reading flow */}
        <div className="gr-modal-body">
          <VerseDetail
            translation={verse.text || verse.translation || ''}
            whatHappened={verse.what_happened || verse.what_happen || verse.meaning || ''}
            krishnaVaani={verse.krishna_vaani || verse.KrishnaVani || ''}
            guidance={verse.guidance || verse.Guidance || ''}
          />
        </div>

        {/* Prev / Next navigation */}
        <div className="gr-modal-nav">
          <button
            className="gr-nav-btn"
            onClick={onPrev}
            disabled={!hasPrev}
          >
            ← Prev
          </button>
          <span className="gr-nav-label">Verse {verseNum}</span>
          <button
            className="gr-nav-btn"
            onClick={onNext}
            disabled={!hasNext}
          >
            Next →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Verse card ─────────────────────────────────────────────────────────────────
function VerseCard({ verse, index, chapterNum, isSelected, isCompleted, onClick }) {
  const verseNum     = verse.verse_number || verse.verse;
  const displayNum   = (verseNum && verseNum > 0 && !isNaN(verseNum)) ? parseInt(verseNum) : (index + 1);
  const preview      = verse.text || verse.translation || verse.meaning || '';

  return (
    <motion.div
      className={`gr-verse-card ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''}`}
      onClick={onClick}
      whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(55,48,163,0.13)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ transitionDelay: `${Math.min(index * 0.03, 0.3)}s` }}
    >
      <div className="gr-card-header">
        <span className="gr-verse-num">Verse {displayNum}</span>
        {isCompleted && <span className="gr-read-badge">✓ Read</span>}
      </div>
      {preview && (
        <p className="gr-card-preview">{preview.substring(0, 110)}{preview.length > 110 ? '…' : ''}</p>
      )}
      <div className="gr-card-footer">
        <span className="gr-card-cta">Tap to explore →</span>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function GitaReader() {
  const { showNotification } = useNotification();
  const [chapters, setChapters]               = useState({});
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedVerse, setSelectedVerse]     = useState(null);
  const [selectedVerseIndex, setSelectedVerseIndex] = useState(null);
  const [readingProgress, setReadingProgress] = useState({});
  const [loading, setLoading]                 = useState(true);
  const [modalVerse, setModalVerse]           = useState(null);   // { verse, verseNum, index }

  useEffect(() => { fetchChapters(); }, []);

  const fetchChapters = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/gita-chapters`);
      setChapters(response.data.chapters || {});
      setReadingProgress(response.data.reading_progress || {});
    } catch (error) {
      console.error('Error fetching chapters:', error);
      showNotification('Error loading Gita chapters', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChapterSelect = (chapterNum) => {
    setSelectedChapter(chapterNum);
    setSelectedVerse(null);
    setSelectedVerseIndex(null);
    setModalVerse(null);
  };

  const handleVerseSelect = async (verseNum, verseIndex) => {
    setSelectedVerse(verseNum);
    setSelectedVerseIndex(verseIndex);
    try {
      await axios.post(`${API_URL}/api/update-reading-progress`, {
        chapter: selectedChapter,
        verse: verseNum,
      });
      const chapterKey = `chapter_${selectedChapter}`;
      setReadingProgress(prev => ({
        ...prev,
        [chapterKey]: {
          ...prev[chapterKey],
          chapter: selectedChapter,
          completed_verses: [...(prev[chapterKey]?.completed_verses || []), verseNum]
            .filter((v, i, arr) => arr.indexOf(v) === i),
          last_read_verse: verseNum,
          last_read_date: new Date().toISOString(),
        },
      }));
      showNotification('Reading progress updated!', 'success');
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const openModal = (verse, verseNum, index) => {
    setModalVerse({ verse, verseNum, index });
    handleVerseSelect(verseNum, index);
  };

  const closeModal = () => setModalVerse(null);

  const navigateModal = (direction) => {
    if (!modalVerse || !currentChapter) return;
    const nextIndex = modalVerse.index + direction;
    if (nextIndex < 0 || nextIndex >= currentChapter.verses.length) return;
    const nextVerse  = currentChapter.verses[nextIndex];
    const verseNum   = nextVerse.verse_number || nextVerse.verse;
    const displayNum = (verseNum && verseNum > 0 && !isNaN(verseNum))
      ? parseInt(verseNum) : (nextIndex + 1);
    openModal(nextVerse, displayNum, nextIndex);
  };

  const getChapterProgress = (chapterNum) => {
    const key      = `chapter_${chapterNum}`;
    const progress = readingProgress[key];
    if (!progress || !chapters[chapterNum]) return 0;
    const total     = chapters[chapterNum].verses.length;
    const completed = progress.completed_verses?.length || 0;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const isVerseCompleted = (chapterNum, verseNum) => {
    const key = `chapter_${chapterNum}`;
    return readingProgress[key]?.completed_verses?.includes(verseNum) || false;
  };

  const chapterNumbers  = getChapterNumbers(chapters);
  const currentChapter  = selectedChapter ? chapters[selectedChapter] : null;

  if (loading) {
    return (
      <PageTransition>
        <div className="gr-page">
          <div className="gr-loading">
            <div className="gr-spinner" />
            <p>Loading Gita chapters…</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="gr-page">
        {/* ── Page header ── */}
        <div className="gr-page-header">
          <div>
            <h1 className="gr-page-title">Bhagavad Gita Reader</h1>
            <p className="gr-page-sub">Read all 18 chapters verse by verse</p>
          </div>
          {selectedChapter && (
            <div className="gr-progress-badge">
              {getChapterProgress(selectedChapter)}% of Chapter {selectedChapter} read
            </div>
          )}
        </div>

        <div className="gr-layout">
          {/* ── Chapter sidebar ── */}
          <aside className="gr-sidebar">
            <div className="gr-sidebar-title">18 Chapters</div>
            <div className="gr-chapter-list">
              {chapterNumbers.map(num => {
                const pct        = getChapterProgress(num);
                const isSelected = selectedChapter === num;
                return (
                  <motion.div
                    key={num}
                    className={`gr-chapter-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleChapterSelect(num)}
                    whileHover={{ x: 3 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  >
                    <div className="gr-chapter-row">
                      <span className="gr-chapter-num">Ch {num}</span>
                      <span className="gr-chapter-pct">{pct}%</span>
                    </div>
                    <div className="gr-chapter-name">{CHAPTER_NAMES[num]}</div>
                    <div className="gr-chapter-bar">
                      <div className="gr-chapter-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="gr-main">
            <AnimatePresence mode="wait">
              {!selectedChapter ? (
                <motion.div
                  key="welcome"
                  className="gr-welcome"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="gr-welcome-icon">🕉</div>
                  <h2 className="gr-welcome-title">Welcome to the Gita Reader</h2>
                  <p className="gr-welcome-sub">Select a chapter from the sidebar to begin your journey</p>
                  <div className="gr-welcome-stat">{chapterNumbers.length} Chapters · 700 Verses</div>
                </motion.div>
              ) : (
                <motion.div
                  key={`chapter-${selectedChapter}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Chapter header */}
                  <div className="gr-chapter-header">
                    <div>
                      <h2 className="gr-chapter-title">
                        Chapter {selectedChapter}: {CHAPTER_NAMES[selectedChapter]}
                      </h2>
                      <p className="gr-chapter-subtitle">{CHAPTER_SUBTITLES[selectedChapter]}</p>
                    </div>
                    <div className="gr-chapter-meta">
                      <span>{currentChapter?.verses.length ?? 0} Verses</span>
                      <span className="gr-dot">·</span>
                      <span>{getChapterProgress(selectedChapter)}% Complete</span>
                    </div>
                  </div>

                  {/* Verse grid */}
                  {!currentChapter?.verses.length ? (
                    <div className="gr-empty">No verses found for this chapter.</div>
                  ) : (
                    <div className="gr-verse-grid">
                      {currentChapter.verses.map((verse, index) => {
                        const verseNum   = verse.verse_number || verse.verse;
                        const displayNum = (verseNum && verseNum > 0 && !isNaN(verseNum))
                          ? parseInt(verseNum) : (index + 1);
                        return (
                          <VerseCard
                            key={`${selectedChapter}-${displayNum}-${index}`}
                            verse={verse}
                            index={index}
                            chapterNum={selectedChapter}
                            isSelected={selectedVerseIndex === index}
                            isCompleted={isVerseCompleted(selectedChapter, displayNum)}
                            onClick={() => openModal(verse, displayNum, index)}
                          />
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* ── Verse detail modal ── */}
        <AnimatePresence>
          {modalVerse && (
            <VerseModal
              verse={modalVerse.verse}
              chapterNum={selectedChapter}
              verseNum={modalVerse.verseNum}
              isCompleted={isVerseCompleted(selectedChapter, modalVerse.verseNum)}
              onClose={closeModal}
              onMarkRead={() => handleVerseSelect(modalVerse.verseNum, modalVerse.index)}
              onPrev={() => navigateModal(-1)}
              onNext={() => navigateModal(1)}
              hasPrev={modalVerse.index > 0}
              hasNext={currentChapter && modalVerse.index < currentChapter.verses.length - 1}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

export default GitaReader;
