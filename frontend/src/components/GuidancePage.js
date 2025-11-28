import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNotification } from '../contexts/NotificationContext';
import './GuidancePage.css';
import KrishnaChat from './KrishnaChat';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const EMOTION_COLORS = {
  'Peace/Calm': '#10B981',
  'Anxiety/Worry': '#F59E0B',
  'Anger/Frustration': '#EF4444',
  'Stress/Tension': '#F97316',
  'Sadness/Grief': '#6B7280',
  'Confusion/Doubt': '#3B82F6',
  'Joy/Happiness': '#8B5CF6'
};

function GuidancePage() {
  const location = useLocation();
  const { showNotification } = useNotification();
  const [input, setInput] = useState(() => {
    // Load from localStorage or location state
    const saved = localStorage.getItem('krishna_vaani_input');
    return saved || '';
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [chatbotEnabled, setChatbotEnabled] = useState(false);

  // Handle navigation from Saved Verses page
  useEffect(() => {
    if (location.state?.verse) {
      const verse = location.state.verse;
      // Create a realistic emotion breakdown for charts
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
      // Normalize to 100% total
      const total = Object.values(emotionBreakdown).reduce((a, b) => a + b, 0);
      Object.keys(emotionBreakdown).forEach(key => {
        emotionBreakdown[key] = (emotionBreakdown[key] / total) * 100;
      });
      
      // Reconstruct the result from saved verse
      const reconstructedResult = {
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
      };
      setResult(reconstructedResult);
      // Clear location state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Save input to localStorage whenever it changes
  useEffect(() => {
    if (input) {
      localStorage.setItem('krishna_vaani_input', input);
    }
  }, [input]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.post(`${API_URL}/api/guidance`, {
        input: input
      });
      setResult(response.data);
    } catch (error) {
      console.error('Error getting guidance:', error);
      alert('Error getting guidance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVerse = async () => {
    if (!result) return;

    setSaving(true);
    try {
      const verseData = {
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
      };

      await axios.post(`${API_URL}/api/save-verse`, verseData);
      showNotification('Verse saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving verse:', error);
      showNotification('Error saving verse. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const prepareEmotionData = () => {
    if (!result || !result.emotion_breakdown) return [];
    
    // Get all emotions from breakdown
    const breakdown = result.emotion_breakdown || {};
    
    // Create data for ALL emotions, including those with 0%
    const allEmotions = Object.keys(EMOTION_COLORS);
    const emotionData = allEmotions.map(emotion => ({
      name: emotion.split('/')[0],
      value: parseFloat((breakdown[emotion] || 0).toFixed(1)),
      fullName: emotion
    }));
    
    // Sort by value (highest first)
    return emotionData.sort((a, b) => b.value - a.value);
  };

  const prepareBarData = () => {
    if (!result || !result.emotion_breakdown) return [];
    
    // Get all emotions from breakdown
    const breakdown = result.emotion_breakdown || {};
    
    // Create data for ALL emotions, including those with 0%
    const allEmotions = Object.keys(EMOTION_COLORS);
    const barData = allEmotions.map(emotion => ({
      emotion: emotion.split('/')[0],
      confidence: parseFloat((breakdown[emotion] || 0).toFixed(1)),
      fullName: emotion
    }));
    
    // Sort by confidence (highest first)
    return barData.sort((a, b) => b.confidence - a.confidence);
  };

  return (
    <div className="ai-dashboard-page">
      <div className="dashboard-container">
        {/* LEFT COLUMN - Input Panel & Charts */}
        <div className="left-column">
          <div className="dashboard-card input-panel">
            <div className="panel-header">
              <h3 className="panel-title">Share Your Feelings</h3>
              <div className="ai-badge">Emotion AI</div>
            </div>
            
            <form onSubmit={handleSubmit} className="input-form">
              <textarea
                className="ai-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your feelings, situation, or what you're going through..."
                disabled={loading}
                rows={8}
              />
              
              <div className="input-controls">
                <div className="chatbot-toggle-inline">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={chatbotEnabled}
                      onChange={(e) => setChatbotEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider-inline"></span>
                    <span className="toggle-text">Enable Chatbot</span>
                  </label>
                </div>
              </div>
              
              <button 
                type="submit" 
                className="ai-primary-btn"
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner-small"></span>
                    Analyzing...
                  </>
                ) : (
                  'Get Krishna Vaani'
                )}
              </button>
            </form>

            <div className="tech-tags">
              <span className="tech-tag">Emotion AI</span>
              <span className="tech-tag">Gita Wisdom</span>
              <span className="tech-tag">Insights</span>
            </div>
          </div>

          {/* Charts Section - Only show after result */}
          {result && (
            <>
              {/* Emotion Detected Panel */}
              <div className="dashboard-card emotion-panel fade-in">
                <div className="panel-header">
                  <h3 className="panel-title">Emotion Detected</h3>
                  <div className="confidence-score">{result.confidence}%</div>
                </div>
                
                <div className="primary-emotion">
                  <div className={`emotion-badge-large ${result.detected_emotion.toLowerCase().replace('/', '-').replace(' ', '-')}`}>
                    {result.detected_emotion}
                  </div>
                  {result.emotion_breakdown && (
                    <div className="primary-emotion-explanation">
                      <span className="explanation-text">
                        Selected as primary emotion with {result.confidence.toFixed(1)}% confidence
                        {(() => {
                          const sorted = Object.entries(result.emotion_breakdown)
                            .sort((a, b) => b[1] - a[1])
                            .filter(([emotion]) => emotion !== result.detected_emotion);
                          const secondHighest = sorted[0];
                          if (secondHighest && secondHighest[1] > 0) {
                            const diff = result.confidence - secondHighest[1];
                            return diff > 5 
                              ? ` (${diff.toFixed(1)}% higher than ${secondHighest[0]})`
                              : ` (similar to ${secondHighest[0]})`;
                          }
                          return '';
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                {result.emotion_breakdown && (
                  <div className="emotion-analytics">
                    {/* Complete Emotion Breakdown List */}
                    <div className="emotion-list-container">
                      <h4 className="chart-title">Complete Emotion Analysis</h4>
                      <div className="emotion-list">
                        {prepareEmotionData().map((entry, index) => (
                          <div 
                            key={index} 
                            className={`emotion-list-item ${entry.fullName === result.detected_emotion ? 'primary-emotion-item' : ''}`}
                          >
                            <div className="emotion-list-label">
                              <span 
                                className="emotion-color-dot" 
                                style={{ backgroundColor: EMOTION_COLORS[entry.fullName] || '#3B82F6' }}
                              ></span>
                              <span className="emotion-name">{entry.fullName}</span>
                              {entry.fullName === result.detected_emotion && (
                                <span className="primary-badge">Primary</span>
                              )}
                            </div>
                            <div className="emotion-list-value">
                              <span className={`emotion-percentage ${entry.fullName === result.detected_emotion ? 'primary-percentage' : ''}`}>
                                {entry.value.toFixed(1)}%
                              </span>
                              <div className="emotion-progress-bar">
                                <div 
                                  className={`emotion-progress-fill ${entry.fullName === result.detected_emotion ? 'primary-progress' : ''}`}
                                  style={{ 
                                    width: `${Math.min(entry.value, 100)}%`,
                                    backgroundColor: EMOTION_COLORS[entry.fullName] || '#3B82F6'
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="chart-container">
                      <h4 className="chart-title">Emotion Confidence Distribution</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={prepareBarData()} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                          <XAxis 
                            dataKey="emotion" 
                            stroke="#6B7280" 
                            fontSize={10}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            stroke="#6B7280" 
                            fontSize={11}
                            domain={[0, 100]}
                            label={{ value: 'Confidence %', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#FFFFFF', 
                              border: '1px solid #E0F2FE',
                              borderRadius: '8px',
                              fontSize: '0.8rem'
                            }}
                            formatter={(value) => `${value.toFixed(1)}%`}
                          />
                          <Bar dataKey="confidence" radius={[6, 6, 0, 0]}>
                            {prepareBarData().map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={EMOTION_COLORS[entry.fullName] || '#3B82F6'} 
                                opacity={entry.confidence > 0 ? 1 : 0.3}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="pie-chart-container">
                      <h4 className="chart-title">Emotion Breakdown</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={prepareEmotionData()}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent, value }) => {
                              if (value > 0) {
                                return percent > 3 ? `${name}\n${(percent * 100).toFixed(1)}%` : '';
                              }
                              return '';
                            }}
                            outerRadius={90}
                            innerRadius={35}
                            fill="#8884d8"
                            dataKey="value"
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          >
                            {prepareEmotionData().map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={EMOTION_COLORS[entry.fullName] || '#3B82F6'} 
                                opacity={entry.value > 0 ? 1 : 0.2}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#FFFFFF', 
                              border: '1px solid #E0F2FE',
                              borderRadius: '8px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                              fontSize: '0.85rem'
                            }}
                            formatter={(value) => `${value.toFixed(1)}%`}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={50}
                            wrapperStyle={{ fontSize: '0.75rem', color: '#6B7280' }}
                            iconType="circle"
                            formatter={(value, entry) => {
                              const data = prepareEmotionData().find(d => d.name === value);
                              return `${value}: ${data ? data.value.toFixed(1) : '0.0'}%`;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Chatbot - Only show if enabled and result exists */}
              {chatbotEnabled && result && (
                <div className="dashboard-card chatbot-panel fade-in">
                  <KrishnaChat 
                    guidanceContext={{
                      chapter_number: result.gita_guidance.chapter_number,
                      chapter: result.gita_guidance.chapter,
                      verse_number: result.gita_guidance.verse_number,
                      verse: result.gita_guidance.verse,
                      emotion: result.detected_emotion,
                      what_happened: result.what_happened,
                      krishna_vaani: result.krishna_vaani,
                      text: result.gita_guidance.text,
                      meaning: result.gita_guidance.meaning,
                      guidance: result.gita_guidance.guidance
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN - Results Only */}
        <div className="right-column">
          {loading && (
            <div className="dashboard-card loading-state">
              <div className="loading-content">
                <div className="ai-spinner"></div>
                <p>Analyzing emotions and generating guidance...</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Chapter & Verse Reference */}
              {(result.gita_guidance.chapter || result.gita_guidance.verse_number) && (
                <div className="dashboard-card verse-reference-panel fade-in">
                  <div className="panel-header">
                    <h3 className="panel-title">Gita Reference</h3>
                  </div>
                  <div className="verse-reference-content">
                    <div className="verse-title-large">
                      Chapter {result.gita_guidance.chapter_number} • Verse {result.gita_guidance.verse_number}
                    </div>
                    {result.gita_guidance.text && (
                      <div className="verse-sanskrit-display">{result.gita_guidance.text}</div>
                    )}
                    {result.gita_guidance.meaning && (
                      <div className="verse-meaning-display">{result.gita_guidance.meaning}</div>
                    )}
                  </div>
                </div>
              )}

              {/* What Happened */}
              {result.what_happened && (
                <div className="dashboard-card what-happened-panel fade-in">
                  <div className="panel-header">
                    <h3 className="panel-title">What Happened</h3>
                  </div>
                  <div className="content-box">
                    <p className="content-text">{result.what_happened}</p>
                  </div>
                </div>
              )}

              {/* Krishna Vaani */}
              {result.krishna_vaani && (
                <div className="dashboard-card krishna-vaani-panel fade-in">
                  <div className="panel-header">
                    <h3 className="panel-title">Krishna Vaani</h3>
                    <div className="scroll-icon">📜</div>
                  </div>
                  <div className="krishna-message-box">
                    <p className="krishna-message-text">{result.krishna_vaani}</p>
                  </div>
                </div>
              )}

              {/* Guidance */}
              {result.gita_guidance.guidance && (
                <div className="dashboard-card guidance-panel fade-in">
                  <div className="panel-header">
                    <h3 className="panel-title">Guidance</h3>
                  </div>
                  <div className="content-box">
                    <p className="content-text">{result.gita_guidance.guidance}</p>
                  </div>

                  <div className="disclaimer-box">
                    <div className="disclaimer-icon"></div>
                    <div className="disclaimer-text">
                      <strong>Note:</strong> If the chapter or verse doesn't resonate with you, click "Read Again" to generate a new guidance based on your emotion.
                    </div>
                  </div>

                  <div className="action-buttons-row">
                    <button
                      className="ai-action-btn save-action"
                      onClick={handleSaveVerse}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Verse'}
                    </button>
                    <button
                      className="ai-action-btn reset-action"
                      onClick={() => {
                        setResult(null);
                        setChatbotEnabled(false);
                        // Keep input, don't clear it
                      }}
                    >
                      Read Again
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !result && (
            <div className="dashboard-card empty-state">
              <p className="empty-text">Your emotional analysis and guidance will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GuidancePage;
