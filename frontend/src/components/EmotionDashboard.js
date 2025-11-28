import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './EmotionDashboard.css';

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

const CHART_COLORS = ['#14B8A6', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#6B7280'];

function EmotionDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchStats();
  }, [days]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/emotion-stats`, {
        params: { days }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const prepareTrendData = () => {
    if (!stats || !stats.emotion_trends) return [];

    const allEmotions = new Set();
    stats.emotion_trends.forEach(day => {
      Object.keys(day.emotions).forEach(emotion => allEmotions.add(emotion));
    });

    return stats.emotion_trends.map(day => {
      const data = { date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
      allEmotions.forEach(emotion => {
        data[emotion] = day.emotions[emotion] || 0;
      });
      return data;
    });
  };

  const preparePieData = () => {
    if (!stats || !stats.emotion_distribution) return [];
    return Object.entries(stats.emotion_distribution).map(([name, value]) => ({
      name: name.split('/')[0],
      value: parseFloat(value),
      fullName: name
    }));
  };

  const getHealthScoreColor = (score) => {
    if (score >= 70) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const getHealthStatus = (score) => {
    if (score >= 70) return 'Excellent';
    if (score >= 50) return 'Good';
    if (score >= 30) return 'Fair';
    return 'Needs Attention';
  };

  if (loading) {
    return (
      <div className="emotion-dashboard">
        <div className="dashboard-container">
          <div className="dashboard-card loading-state">
            <div className="loading-content">
              <div className="ai-spinner"></div>
              <p>Loading emotion analytics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const trendData = prepareTrendData();
  const pieData = preparePieData();

  return (
    <div className="emotion-dashboard">
      <div className="dashboard-container">
        <div className="page-header-modern">
          <h1 className="page-title">Emotion Dashboard</h1>
          <p className="page-subtitle">Track your emotional journey over time</p>
        </div>

        <div className="dashboard-controls-modern">
          <div className="time-selector-modern">
            <button
              className={`time-btn-modern ${days === 7 ? 'active' : ''}`}
              onClick={() => setDays(7)}
            >
              7 Days
            </button>
            <button
              className={`time-btn-modern ${days === 30 ? 'active' : ''}`}
              onClick={() => setDays(30)}
            >
              30 Days
            </button>
          </div>
        </div>

        {!stats || stats.total_entries === 0 ? (
          <div className="dashboard-card empty-state-modern">
            <div className="empty-content">
              <div className="empty-icon"></div>
              <h3>No emotion data yet</h3>
              <p>Start getting guidance to see your emotional trends!</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="stats-grid-modern">
              {/* Health Score Card */}
              <div className="dashboard-card stat-card-modern">
                <div className="panel-header">
                  <h3 className="panel-title">Emotional Health Score</h3>
                </div>
                <div className="health-score-display-modern">
                  <div
                    className="health-score-circle-modern"
                    style={{ borderColor: getHealthScoreColor(stats.emotional_health_score) }}
                  >
                    <div className="score-value-modern" style={{ color: getHealthScoreColor(stats.emotional_health_score) }}>
                      {stats.emotional_health_score}
                    </div>
                  </div>
                  <div className="health-status-modern">
                    <div className="score-max-modern">/100</div>
                    <div className="status-text-modern" style={{ color: getHealthScoreColor(stats.emotional_health_score) }}>
                      {getHealthStatus(stats.emotional_health_score)}
                    </div>
                    <div className="status-subtitle-modern">Emotional Stability</div>
                  </div>
                </div>
              </div>

              {/* Most Frequent Emotion */}
              {stats.most_frequent_emotion && (
                <div className="dashboard-card stat-card-modern">
                  <div className="panel-header">
                    <h3 className="panel-title">Most Frequent Emotion</h3>
                  </div>
                  <div className="frequent-emotion-display-modern">
                    <div className="frequent-emotion-name-modern">
                      {stats.most_frequent_emotion.emotion}
                    </div>
                    <div className="frequent-emotion-percentage-modern">
                      {stats.most_frequent_emotion.percentage}%
                    </div>
                    <div className="frequent-emotion-count-modern">
                      {stats.most_frequent_emotion.count} occurrences
                    </div>
                  </div>
                </div>
              )}

              {/* Total Entries */}
              <div className="dashboard-card stat-card-modern">
                <div className="panel-header">
                  <h3 className="panel-title">Total Entries</h3>
                </div>
                <div className="stat-value-large-modern">
                  {stats.total_entries}
                </div>
                <div className="stat-label-modern">Emotion Records</div>
              </div>
            </div>

            {/* Emotion Trend Chart */}
            {trendData.length > 0 && (
              <div className="dashboard-card chart-card-modern fade-in">
                <div className="panel-header">
                  <h3 className="panel-title">Emotion Trend ({days} Days)</h3>
                </div>
                <div className="chart-wrapper-modern">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#6B7280" 
                        fontSize={12}
                        tick={{ fill: '#6B7280' }}
                      />
                      <YAxis 
                        stroke="#6B7280" 
                        fontSize={12}
                        tick={{ fill: '#6B7280' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#FFFFFF', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '0.85rem', color: '#6B7280' }}
                      />
                      {Object.keys(trendData[0] || {}).filter(key => key !== 'date').map((emotion, idx) => (
                        <Line
                          key={emotion}
                          type="monotone"
                          dataKey={emotion}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: CHART_COLORS[idx % CHART_COLORS.length] }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Charts Grid */}
            <div className="charts-grid-modern">
              {/* Pie Chart */}
              {pieData.length > 0 && (
                <div className="dashboard-card chart-card-modern fade-in">
                  <div className="panel-header">
                    <h3 className="panel-title">Emotion Distribution</h3>
                  </div>
                  <div className="chart-wrapper-modern">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={EMOTION_COLORS[entry.fullName] || CHART_COLORS[index % CHART_COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#FFFFFF', 
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Insights */}
              {stats.insights && stats.insights.length > 0 && (
                <div className="dashboard-card insights-card-modern fade-in">
                  <div className="panel-header">
                    <h3 className="panel-title">Personalized Insights</h3>
                  </div>
                  <ul className="insights-list-modern">
                    {stats.insights.map((insight, idx) => (
                      <li key={idx} className="insight-item-modern">
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Emotion Summary */}
            <div className="dashboard-card summary-card-modern fade-in">
              <div className="panel-header">
                <h3 className="panel-title">Emotion Summary</h3>
              </div>
              <div className="emotion-counts-modern">
                {Object.entries(stats.emotion_counts || {}).map(([emotion, count]) => (
                  <div key={emotion} className="emotion-count-item-modern">
                    <span className="emotion-count-name-modern">{emotion}</span>
                    <span className="emotion-count-value-modern">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default EmotionDashboard;
