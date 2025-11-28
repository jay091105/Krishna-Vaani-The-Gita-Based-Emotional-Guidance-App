import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../contexts/NotificationContext';
import './GitaReader.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CHAPTER_NAMES = {
  1: "Arjuna Vishada Yoga (The Yoga of Arjuna's Dejection)",
  2: "Sankhya Yoga (The Yoga of Knowledge)",
  3: "Karma Yoga (The Yoga of Action)",
  4: "Jnana Karma Sanyasa Yoga (The Yoga of Knowledge and Renunciation)",
  5: "Karma Sanyasa Yoga (The Yoga of Renunciation)",
  6: "Dhyana Yoga (The Yoga of Meditation)",
  7: "Jnana Vijnana Yoga (The Yoga of Knowledge and Wisdom)",
  8: "Aksara Brahma Yoga (The Yoga of the Imperishable Brahman)",
  9: "Raja Vidya Raja Guhya Yoga (The Yoga of Royal Knowledge and Royal Secret)",
  10: "Vibhuti Yoga (The Yoga of Divine Glories)",
  11: "Visvarupa Darsana Yoga (The Yoga of the Vision of the Universal Form)",
  12: "Bhakti Yoga (The Yoga of Devotion)",
  13: "Ksetra Ksetrajna Vibhaga Yoga (The Yoga of the Field and the Knower of the Field)",
  14: "Gunatraya Vibhaga Yoga (The Yoga of the Three Gunas)",
  15: "Purusottama Yoga (The Yoga of the Supreme Person)",
  16: "Daivasura Sampad Vibhaga Yoga (The Yoga of the Divine and Demoniac Natures)",
  17: "Sraddhatraya Vibhaga Yoga (The Yoga of the Three Kinds of Faith)",
  18: "Moksa Sanyasa Yoga (The Yoga of Liberation and Renunciation)"
};

function GitaReader() {
  const { showNotification } = useNotification();
  const [chapters, setChapters] = useState({});
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [selectedVerseIndex, setSelectedVerseIndex] = useState(null);
  const [readingProgress, setReadingProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChapters();
  }, []);

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
  };

  const handleVerseSelect = async (verseNum, verseIndex) => {
    setSelectedVerse(verseNum);
    setSelectedVerseIndex(verseIndex); // Store the index for unique selection
    
    // Update reading progress
    try {
      await axios.post(`${API_URL}/api/update-reading-progress`, {
        chapter: selectedChapter,
        verse: verseNum
      });
      
      // Update local state
      const chapterKey = `chapter_${selectedChapter}`;
      setReadingProgress(prev => ({
        ...prev,
        [chapterKey]: {
          ...prev[chapterKey],
          chapter: selectedChapter,
          completed_verses: [...(prev[chapterKey]?.completed_verses || []), verseNum].filter((v, i, arr) => arr.indexOf(v) === i),
          last_read_verse: verseNum,
          last_read_date: new Date().toISOString()
        }
      }));
      
      showNotification('Reading progress updated!', 'success');
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const getChapterProgress = (chapterNum) => {
    const chapterKey = `chapter_${chapterNum}`;
    const progress = readingProgress[chapterKey];
    if (!progress || !chapters[chapterNum]) return 0;
    
    const totalVerses = chapters[chapterNum].verses.length;
    const completed = progress.completed_verses?.length || 0;
    return totalVerses > 0 ? Math.round((completed / totalVerses) * 100) : 0;
  };

  const isVerseCompleted = (chapterNum, verseNum) => {
    const chapterKey = `chapter_${chapterNum}`;
    const progress = readingProgress[chapterKey];
    return progress?.completed_verses?.includes(verseNum) || false;
  };

  if (loading) {
    return (
      <div className="gita-reader-page">
        <div className="reader-container">
          <div className="dashboard-card loading-state">
            <div className="loading-content">
              <div className="ai-spinner"></div>
              <p>Loading Gita chapters...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentChapter = selectedChapter ? chapters[selectedChapter] : null;
  
  const currentVerse = currentChapter && selectedVerse !== null && selectedVerseIndex !== null
    ? currentChapter.verses[selectedVerseIndex]
    : (currentChapter && selectedVerse !== null
      ? currentChapter.verses.find((v, idx) => {
          const vNum = v.verse_number || v.verse;
          const displayNum = (vNum && vNum > 0 && !isNaN(vNum)) ? parseInt(vNum) : (idx + 1);
          return parseInt(displayNum) === parseInt(selectedVerse);
        })
      : null);

  return (
    <div className="gita-reader-page">
      <div className="reader-container">
        <div className="page-header-modern">
          <h1 className="page-title">Bhagavad Gita Reader</h1>
          <p className="page-subtitle">Read all 18 chapters verse by verse</p>
        </div>

        <div className="reader-layout">
          {/* Chapter List */}
          <div className="chapters-sidebar">
            <h3 className="sidebar-title">Chapters</h3>
            <div className="chapters-list">
              {Object.keys(chapters)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(chapterNum => {
                  const progress = getChapterProgress(parseInt(chapterNum));
                  const isSelected = selectedChapter === parseInt(chapterNum);
                  
                  return (
                    <div
                      key={chapterNum}
                      className={`chapter-item ${isSelected ? 'active' : ''} fade-in`}
                      onClick={() => handleChapterSelect(parseInt(chapterNum))}
                    >
                      <div className="chapter-item-header">
                        <span className="chapter-number">Chapter {chapterNum}</span>
                        <span className="chapter-progress">{progress}%</span>
                      </div>
                      <div className="chapter-name">{CHAPTER_NAMES[chapterNum] || `Chapter ${chapterNum}`}</div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Main Content */}
          <div className="reader-main">
            {!selectedChapter ? (
              <div className="dashboard-card welcome-card fade-in">
                <div className="welcome-content">
                  <div className="welcome-icon">🕉</div>
                  <h2>Welcome to the Gita Reader</h2>
                  <p>Select a chapter from the sidebar to begin reading</p>
                  <p className="welcome-stats">
                    {Object.keys(chapters).length} Chapters Available
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Chapter Header */}
                <div className="dashboard-card chapter-header fade-in">
                  <h2 className="chapter-title">
                    Chapter {selectedChapter}: {CHAPTER_NAMES[selectedChapter]}
                  </h2>
                  <div className="chapter-meta">
                    <span>{currentChapter.verses.length} Verses</span>
                    <span>•</span>
                    <span>{getChapterProgress(selectedChapter)}% Complete</span>
                  </div>
                </div>

                {/* Verse List */}
                <div className="verses-list">
                  {currentChapter.verses.length === 0 ? (
                    <div className="dashboard-card empty-state-modern">
                      <div className="empty-content">
                        <p>No verses found for this chapter</p>
                      </div>
                    </div>
                  ) : (
                    currentChapter.verses.map((verse, index) => {
                      // Use verse_number if available, otherwise use index+1 for display
                      const verseNum = verse.verse_number || verse.verse;
                      // If verseNum is still not available or is invalid, use sequential numbering
                      const displayVerseNum = (verseNum && verseNum > 0 && !isNaN(verseNum)) ? parseInt(verseNum) : (index + 1);
                      
                      // Use a unique identifier for selection (combination of verse number and index)
                      const verseUniqueId = `${selectedChapter}-${displayVerseNum}-${index}`;
                      const isCompleted = isVerseCompleted(selectedChapter, displayVerseNum);
                      // Only select if the index matches (prevents all verses with same number from being selected)
                      const isSelected = selectedVerseIndex === index;
                      
                      return (
                        <div
                          key={`verse-${verseUniqueId}`}
                          className={`verse-item ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''} slide-in`}
                          style={{ animationDelay: `${index * 0.05}s` }}
                          onClick={() => handleVerseSelect(displayVerseNum, index)}
                        >
                          <div className="verse-item-header">
                            <span className="verse-number">Verse {displayVerseNum}</span>
                            {isCompleted && <span className="completed-badge">✓ Read</span>}
                          </div>
                          {verse.text && (
                            <div className="verse-preview">
                              {verse.text.substring(0, 100)}...
                            </div>
                          )}
                          {!verse.text && verse.meaning && (
                            <div className="verse-preview">
                              {verse.meaning.substring(0, 100)}...
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Verse Detail */}
                {currentVerse && (
                  <div className="dashboard-card verse-detail fade-in">
                    <div className="verse-detail-header">
                      <h3>Chapter {selectedChapter}, Verse {selectedVerse}</h3>
                      <button
                        className="mark-read-btn"
                        onClick={() => handleVerseSelect(selectedVerse)}
                      >
                        {isVerseCompleted(selectedChapter, selectedVerse) ? '✓ Marked as Read' : 'Mark as Read'}
                      </button>
                    </div>

                    {currentVerse.text && (
                      <div className="verse-section">
                        <div className="verse-text">{currentVerse.text}</div>
                      </div>
                    )}

                    {currentVerse.meaning && (
                      <div className="verse-section">
                        <div className="verse-content">{currentVerse.meaning}</div>
                      </div>
                    )}

                    {currentVerse.what_happened && (
                      <div className="verse-section">
                        <div className="verse-label">What Happened</div>
                        <div className="verse-content">{currentVerse.what_happened}</div>
                      </div>
                    )}

                    {currentVerse.krishna_vaani && (
                      <div className="verse-section krishna-section">
                        <div className="verse-label">Krishna Vaani</div>
                        <div className="verse-content">{currentVerse.krishna_vaani}</div>
                      </div>
                    )}

                    {currentVerse.guidance && (
                      <div className="verse-section">
                        <div className="verse-label">Guidance</div>
                        <div className="verse-content">{currentVerse.guidance}</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GitaReader;

