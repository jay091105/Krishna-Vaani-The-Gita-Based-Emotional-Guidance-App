import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './SavedVersesPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const EMOTIONS = [
  'All',
  'Peace/Calm',
  'Joy/Happiness',
  'Anxiety/Worry',
  'Stress/Tension',
  'Anger/Frustration',
  'Sadness/Grief',
  'Confusion/Doubt'
];

function SavedVersesPage() {
  const [savedVerses, setSavedVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [selectedEmotion, setSelectedEmotion] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSavedVerses();
  }, []);

  const fetchSavedVerses = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/saved-verses`);
      setSavedVerses(response.data.saved_verses || []);
    } catch (error) {
      console.error('Error fetching saved verses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (verseId) => {
    if (!window.confirm('Are you sure you want to delete this verse?')) return;

    setDeleting(verseId);
    try {
      await axios.delete(`${API_URL}/api/saved-verse/${verseId}`);
      setSavedVerses(savedVerses.filter(v => v.id !== verseId));
    } catch (error) {
      console.error('Error deleting verse:', error);
      alert('Error deleting verse. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleReadAgain = (verse) => {
    // Navigate to home with verse data
    navigate('/', { 
      state: { 
        verse: {
          ...verse,
          chapter: verse.chapter || verse.chapter_number,
          verse: verse.verse || verse.verse_number,
          chapter_number: verse.chapter_number || verse.chapter,
          verse_number: verse.verse_number || verse.verse
        }
      } 
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
      minute: '2-digit'
    });
  };

  // Filter verses by selected emotion
  const filteredVerses = selectedEmotion === 'All' 
    ? savedVerses 
    : savedVerses.filter(verse => verse.emotion === selectedEmotion);

  if (loading) {
    return (
      <div className="saved-verses-page">
        <div className="saved-container">
          <div className="dashboard-card loading-state">
            <div className="loading-content">
              <div className="ai-spinner"></div>
              <p>Loading your saved verses...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-verses-page">
      <div className="saved-container">
        <div className="page-header-modern">
          <h1 className="page-title">My Saved Verses</h1>
          <p className="page-subtitle">Your personal wisdom library</p>
        </div>

        {/* Emotion Filter Buttons */}
        {savedVerses.length > 0 && (
          <div className="emotion-filters">
            {EMOTIONS.map(emotion => (
              <button
                key={emotion}
                className={`emotion-filter-btn ${selectedEmotion === emotion ? 'active' : ''}`}
                onClick={() => setSelectedEmotion(emotion)}
              >
                {emotion}
                {emotion !== 'All' && (
                  <span className="filter-count">
                    ({savedVerses.filter(v => v.emotion === emotion).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {savedVerses.length === 0 ? (
          <div className="dashboard-card empty-state-modern">
            <div className="empty-content">
              <div className="empty-icon"></div>
              <h3>No saved verses yet</h3>
              <p>Start saving verses from your guidance to build your personal library!</p>
            </div>
          </div>
        ) : filteredVerses.length === 0 ? (
          <div className="dashboard-card empty-state-modern">
            <div className="empty-content">
              <div className="empty-icon"></div>
              <h3>No verses found for {selectedEmotion}</h3>
              <p>Try selecting a different emotion filter</p>
            </div>
          </div>
        ) : (
          <div className="verses-grid-modern">
            {filteredVerses.map((verse) => (
              <div key={verse.id} className="dashboard-card verse-card-modern slide-in">
                <div className="verse-card-header-modern">
                  <div className="verse-title-modern">
                    {verse.chapter_number || verse.chapter} • Verse {verse.verse_number || verse.verse}
                  </div>
                  {verse.emotion && (
                    <span className="emotion-badge-modern">
                      {verse.emotion}
                    </span>
                  )}
                </div>

                {verse.text && (
                  <div className="verse-text-modern">
                    <div className="verse-label">Sanskrit</div>
                    <p>{verse.text}</p>
                  </div>
                )}

                {verse.meaning && (
                  <div className="verse-content-modern">
                    <div className="verse-label">Meaning</div>
                    <p>{verse.meaning}</p>
                  </div>
                )}

                {verse.what_happened && (
                  <div className="verse-content-modern">
                    <div className="verse-label">What Happened</div>
                    <p>{verse.what_happened}</p>
                  </div>
                )}

                {verse.krishna_vaani && (
                  <div className="verse-content-modern krishna-section">
                    <div className="verse-label">Krishna Vaani</div>
                    <p>{verse.krishna_vaani}</p>
                  </div>
                )}

                {verse.guidance && (
                  <div className="verse-content-modern">
                    <div className="verse-label">Guidance</div>
                    <p>{verse.guidance}</p>
                  </div>
                )}

                <div className="verse-footer-modern">
                  <div className="verse-date-modern">
                    Saved on {formatDate(verse.timestamp)}
                  </div>
                  <div className="verse-actions-modern">
                    <button
                      className="ai-action-btn read-action"
                      onClick={() => handleReadAgain(verse)}
                    >
                      Read Again
                    </button>
                    <button
                      className="ai-action-btn delete-action"
                      onClick={() => handleDelete(verse.id)}
                      disabled={deleting === verse.id}
                    >
                      {deleting === verse.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SavedVersesPage;
