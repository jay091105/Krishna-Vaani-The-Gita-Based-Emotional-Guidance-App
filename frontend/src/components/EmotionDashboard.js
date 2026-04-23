import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import {
  Heart, Zap, BookOpen, TrendingUp,
  Activity, Brain, CheckCircle, AlertCircle, Info
} from 'lucide-react';
import PageTransition from './animations/PageTransition';
import ScrollReveal from './animations/ScrollReveal';
import './EmotionDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const EMOTION_META = {
  'Peace/Calm':        { color: '#14B8A6', bg: 'rgba(20,184,166,0.12)',  icon: '😌' },
  'Anxiety/Worry':     { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  icon: '😰' },
  'Anger/Frustration': { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   icon: '😤' },
  'Stress/Tension':    { color: '#F97316', bg: 'rgba(249,115,22,0.12)',  icon: '😣' },
  'Sadness/Grief':     { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: '😢' },
  'Confusion/Doubt':   { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', icon: '😕' },
  'Joy/Happiness':     { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  icon: '😊' },
};

const CHART_COLORS = Object.values(EMOTION_META).map(e => e.color);

// ── Reusable Card ──────────────────────────────────────────────────────────────
function Card({ children, className = '', style = {}, animate = true }) {
  if (!animate) return <div className={`ed-card ${className}`} style={style}>{children}</div>;
  return (
    <motion.div
      className={`ed-card ${className}`}
      style={style}
      whileHover={{ scale: 1.02, boxShadow: '0 8px 32px rgba(20,184,166,0.13)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}

// ── KPI Widget ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, iconColor, iconBg, label, value, sub, accent }) {
  return (
    <Card className="ed-kpi">
      <div className="ed-kpi-icon" style={{ background: iconBg, color: iconColor }}>
        <Icon size={22} strokeWidth={2} />
      </div>
      <div className="ed-kpi-body">
        <p className="ed-kpi-label">{label}</p>
        <p className="ed-kpi-value" style={{ color: accent || iconColor }}>{value}</p>
        {sub && <p className="ed-kpi-sub">{sub}</p>}
      </div>
    </Card>
  );
}

// ── Circular Progress ──────────────────────────────────────────────────────────
function CircularScore({ score }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const label = score >= 70 ? 'Excellent' : score >= 50 ? 'Good' : score >= 30 ? 'Fair' : 'Needs Care';

  return (
    <Card className="ed-kpi ed-health-card">
      <div className="ed-kpi-icon" style={{ background: `${color}20`, color }}>
        <Heart size={22} strokeWidth={2} />
      </div>
      <div className="ed-kpi-body">
        <p className="ed-kpi-label">Emotional Health Score</p>
        <div className="ed-circle-wrap">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={r} fill="none"
              stroke={color} strokeWidth="10"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
            <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{score}</text>
            <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#9CA3AF">/100</text>
          </svg>
          <p className="ed-health-label" style={{ color }}>{label}</p>
        </div>
      </div>
    </Card>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ed-tooltip">
      <p className="ed-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="ed-tooltip-row">
          <span className="ed-tooltip-dot" style={{ background: p.color }} />
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function EmotionDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => { fetchStats(); }, [days]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/emotion-stats`, { params: { days } });
      setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const prepareTrendData = () => {
    if (!stats?.emotion_trends) return [];
    const allEmotions = new Set();
    stats.emotion_trends.forEach(d => Object.keys(d.emotions).forEach(e => allEmotions.add(e)));
    return stats.emotion_trends.map(d => {
      const row = { date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
      allEmotions.forEach(e => { row[e] = d.emotions[e] || 0; });
      return row;
    });
  };

  const preparePieData = () => {
    if (!stats?.emotion_distribution) return [];
    return Object.entries(stats.emotion_distribution).map(([name, value]) => ({
      name: name.split('/')[0], value: parseFloat(value), fullName: name
    }));
  };

  const prepareBarData = () => {
    if (!stats?.emotion_counts) return [];
    return Object.entries(stats.emotion_counts)
      .map(([name, count]) => ({ name: name.split('/')[0], count, fullName: name }))
      .sort((a, b) => b.count - a.count);
  };

  if (loading) return (
    <div className="ed-page">
      <div className="ed-loading">
        <div className="ed-spinner" />
        <p>Loading analytics...</p>
      </div>
    </div>
  );

  const trendData = prepareTrendData();
  const pieData   = preparePieData();
  const barData   = prepareBarData();
  const trendKeys = trendData.length ? Object.keys(trendData[0]).filter(k => k !== 'date') : [];

  return (
    <PageTransition>
    <div className="ed-page">
      {/* Header */}
      <div className="ed-header">
        <div>
          <h1 className="ed-title">Emotion Dashboard</h1>
          <p className="ed-subtitle">Track your emotional journey over time</p>
        </div>
        <div className="ed-time-pills">
          {[7, 30].map(d => (
            <button key={d} className={`ed-pill ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
              {d} Days
            </button>
          ))}
        </div>
      </div>

      {!stats || stats.total_entries === 0 ? (
        <Card className="ed-empty" animate={false}>
          <Brain size={48} color="#D1D5DB" />
          <h3>No emotion data yet</h3>
          <p>Start getting guidance to see your emotional trends</p>
        </Card>
      ) : (
        <>
          {/* ── KPI Row ── */}
          <ScrollReveal delay={0}>
          <div className="ed-kpi-grid">
            <CircularScore score={stats.emotional_health_score} />

            {stats.most_frequent_emotion && (
              <Card className="ed-kpi">
                <div className="ed-kpi-icon" style={{
                  background: EMOTION_META[stats.most_frequent_emotion.emotion]?.bg || 'rgba(20,184,166,0.12)',
                  color: EMOTION_META[stats.most_frequent_emotion.emotion]?.color || '#14B8A6',
                  fontSize: '1.4rem'
                }}>
                  {EMOTION_META[stats.most_frequent_emotion.emotion]?.icon || '🧠'}
                </div>
                <div className="ed-kpi-body">
                  <p className="ed-kpi-label">Most Frequent Emotion</p>
                  <p className="ed-kpi-value" style={{ color: EMOTION_META[stats.most_frequent_emotion.emotion]?.color || '#14B8A6' }}>
                    {stats.most_frequent_emotion.emotion}
                  </p>
                  <p className="ed-kpi-sub">
                    {stats.most_frequent_emotion.percentage}% &nbsp;·&nbsp; {stats.most_frequent_emotion.count} entries
                  </p>
                </div>
              </Card>
            )}

            <KpiCard icon={Activity} iconColor="#8B5CF6" iconBg="rgba(139,92,246,0.12)"
              label="Total Entries" value={stats.total_entries} sub="Emotion records logged" accent="#8B5CF6" />

            <KpiCard icon={TrendingUp} iconColor="#F59E0B" iconBg="rgba(245,158,11,0.12)"
              label="Tracking Period" value={`${days}d`} sub={`${trendData.length} data points`} accent="#F59E0B" />
          </div>
          </ScrollReveal>

          {/* ── Trend Line Chart ── */}
          {trendData.length > 0 && (
            <ScrollReveal delay={0.1}>
            <Card className="ed-chart-card">
              <div className="ed-chart-header">
                <div className="ed-chart-title-wrap">
                  <TrendingUp size={18} color="#14B8A6" />
                  <h3 className="ed-chart-title">Emotion Trend — {days} Days</h3>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    {trendKeys.map((emotion, i) => (
                      <linearGradient key={emotion} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tick={{ fill: '#9CA3AF' }} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tick={{ fill: '#9CA3AF' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '1rem' }} />
                  {trendKeys.map((emotion, i) => (
                    <Area key={emotion} type="monotone" dataKey={emotion}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5}
                      fill={`url(#grad-${i})`} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            </ScrollReveal>
          )}

          {/* ── Charts Row ── */}
          <ScrollReveal delay={0.15}>
          <div className="ed-charts-row">
            {pieData.length > 0 && (
              <Card className="ed-chart-card">
                <div className="ed-chart-header">
                  <div className="ed-chart-title-wrap">
                    <Brain size={18} color="#8B5CF6" />
                    <h3 className="ed-chart-title">Emotion Distribution</h3>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100}
                      paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={EMOTION_META[entry.fullName]?.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v.toFixed(1)}%`} contentStyle={{ borderRadius: 10, fontSize: '0.85rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}

            {barData.length > 0 && (
              <Card className="ed-chart-card">
                <div className="ed-chart-header">
                  <div className="ed-chart-title-wrap">
                    <Activity size={18} color="#F97316" />
                    <h3 className="ed-chart-title">Emotion Counts</h3>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" stroke="#9CA3AF" fontSize={12} tick={{ fill: '#9CA3AF' }} />
                    <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={12} tick={{ fill: '#6B7280' }} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={EMOTION_META[entry.fullName]?.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
          </ScrollReveal>

          {/* ── Bottom Row ── */}
          <ScrollReveal delay={0.2}>
          <div className="ed-bottom-row">
            <Card className="ed-summary-card">
              <div className="ed-chart-header">
                <div className="ed-chart-title-wrap">
                  <BookOpen size={18} color="#14B8A6" />
                  <h3 className="ed-chart-title">Emotion Summary</h3>
                </div>
              </div>
              <div className="ed-summary-list">
                {Object.entries(stats.emotion_counts || {}).map(([emotion, count]) => {
                  const meta = EMOTION_META[emotion] || { color: '#14B8A6', bg: 'rgba(20,184,166,0.1)', icon: '🧠' };
                  const pct = stats.total_entries ? ((count / stats.total_entries) * 100).toFixed(0) : 0;
                  return (
                    <div key={emotion} className="ed-summary-row">
                      <span className="ed-summary-emoji">{meta.icon}</span>
                      <span className="ed-summary-name">{emotion}</span>
                      <div className="ed-summary-bar-wrap">
                        <div className="ed-summary-bar" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                      <span className="ed-summary-count" style={{ color: meta.color }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {stats.insights?.length > 0 && (
              <Card className="ed-insights-card">
                <div className="ed-chart-header">
                  <div className="ed-chart-title-wrap">
                    <Zap size={18} color="#F59E0B" />
                    <h3 className="ed-chart-title">Personalized Insights</h3>
                  </div>
                </div>
                <ul className="ed-insights-list">
                  {stats.insights.map((insight, i) => (
                    <li key={i} className="ed-insight-item">
                      <span className="ed-insight-icon">
                        {i === 0 ? <CheckCircle size={16} color="#10B981" /> :
                         i === 1 ? <AlertCircle size={16} color="#F59E0B" /> :
                                   <Info size={16} color="#3B82F6" />}
                      </span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
          </ScrollReveal>
        </>
      )}
    </div>
    </PageTransition>
  );
}

export default EmotionDashboard;
