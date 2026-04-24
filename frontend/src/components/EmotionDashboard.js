import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { Brain, TrendingUp, Gauge, Activity, Loader2 } from 'lucide-react';
import PageTransition from './animations/PageTransition';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const EMOTION_COLORS = {
  'Peace/Calm': '#22c55e',
  'Anxiety/Worry': '#facc15',
  'Anger/Frustration': '#ef4444',
  'Stress/Tension': '#f59e0b',
  'Sadness/Grief': '#3b82f6',
  'Confusion/Doubt': '#a78bfa',
  'Joy/Happiness': '#22d3ee',
};

function GlowCard({ children, className = '' }) {
  return (
    <div className={`glass-panel ${className}`}>
      {children}
    </div>
  );
}

function EmotionDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/emotion-stats`, { params: { days } });
        setStats(res.data);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [days]);

  const trendData = useMemo(() => {
    if (!stats?.emotion_trends) return [];
    return stats.emotion_trends.map((point) => {
      const vals = Object.values(point.emotions || {});
      const avg = vals.length ? vals.reduce((acc, v) => acc + Number(v || 0), 0) / vals.length : 0;
      return {
        date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        avg: Number(avg.toFixed(1)),
      };
    });
  }, [stats]);

  const donutData = useMemo(() => {
    if (!stats?.emotion_distribution) return [];
    return Object.entries(stats.emotion_distribution)
      .map(([name, value]) => ({
        name,
        value: Number(value) || 0,
      }))
      .filter((d) => d.value > 0);
  }, [stats]);

  const countData = useMemo(() => {
    if (!stats?.emotion_counts) return [];
    return Object.entries(stats.emotion_counts)
      .map(([name, count]) => ({
        name: name.split('/')[0],
        fullName: name,
        count: Number(count) || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const dominantEmotion = stats?.most_frequent_emotion?.emotion || 'N/A';
  const dominantPct = stats?.most_frequent_emotion?.percentage || 0;

  if (loading) {
    return (
      <PageTransition>
        <div className="p-4 sm:p-5">
          <div className="glass-panel flex min-h-[300px] items-center justify-center gap-3 p-6 text-slate-300">
            <Loader2 size={20} className="animate-spin text-cyan-300" />
            Loading AI analytics...
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Emotion Intelligence Dashboard</h1>
            <p className="text-sm text-slate-400">Prediction Confidence and trend intelligence</p>
          </div>
          <div className="flex gap-2">
            {[7, 30].map((range) => (
              <button
                key={range}
                onClick={() => setDays(range)}
                className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                  days === range
                    ? 'border-indigo-300/40 bg-indigo-500/20 text-indigo-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {range} Days
              </button>
            ))}
          </div>
        </section>

        {!stats || stats.total_entries === 0 ? (
          <GlowCard className="p-8 text-center text-slate-300">
            <Brain className="mx-auto mb-3 text-slate-400" />
            No emotion data found yet. Create guidance entries to unlock analytics.
          </GlowCard>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <GlowCard className="p-4">
                <p className="text-xs text-slate-400">Emotional Health</p>
                <p className="mt-2 text-2xl font-bold text-emerald-300">{stats.emotional_health_score}/100</p>
              </GlowCard>
              <GlowCard className="p-4">
                <p className="text-xs text-slate-400">Dominant Emotion</p>
                <p className="mt-2 text-lg font-semibold text-cyan-200">{dominantEmotion}</p>
                <p className="text-xs text-slate-400">{dominantPct}% of entries</p>
              </GlowCard>
              <GlowCard className="p-4">
                <p className="text-xs text-slate-400">Entries Logged</p>
                <p className="mt-2 text-2xl font-bold text-indigo-200">{stats.total_entries}</p>
              </GlowCard>
              <GlowCard className="p-4">
                <p className="text-xs text-slate-400">Model Confidence</p>
                <p className="mt-2 text-lg font-semibold text-violet-200">High Stability</p>
                <p className="text-xs text-slate-400">AI signal consistency active</p>
              </GlowCard>
            </section>

            <section className="grid gap-4 lg:grid-cols-5">
              <GlowCard className="p-4 lg:col-span-3">
                <div className="mb-3 flex items-center gap-2 text-slate-200">
                  <TrendingUp size={16} className="text-cyan-300" />
                  <h2 className="text-sm font-semibold">Emotion Trend</h2>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15,23,42,0.92)',
                        border: '1px solid rgba(148,163,184,0.25)',
                        borderRadius: 12,
                        color: '#e2e8f0',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      dot={{ r: 2 }}
                      activeDot={{ r: 5 }}
                      style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.7))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </GlowCard>

              <GlowCard className="p-4 lg:col-span-2">
                <div className="mb-3 flex items-center gap-2 text-slate-200">
                  <Gauge size={16} className="text-indigo-300" />
                  <h2 className="text-sm font-semibold">Distribution Donut</h2>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={105}
                      paddingAngle={2}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={EMOTION_COLORS[entry.name] || '#6366f1'} />
                      ))}
                    </Pie>
                    <text x="50%" y="49%" textAnchor="middle" fill="#e2e8f0" fontSize="18" fontWeight="700">
                      {dominantPct}%
                    </text>
                    <text x="50%" y="57%" textAnchor="middle" fill="#94a3b8" fontSize="12">
                      Top Emotion
                    </text>
                    <Tooltip
                      formatter={(v) => `${Number(v).toFixed(1)}%`}
                      contentStyle={{
                        background: 'rgba(15,23,42,0.92)',
                        border: '1px solid rgba(148,163,184,0.25)',
                        borderRadius: 12,
                        color: '#e2e8f0',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </GlowCard>
            </section>

            <GlowCard className="p-4">
              <div className="mb-3 flex items-center gap-2 text-slate-200">
                <Activity size={16} className="text-amber-300" />
                <h2 className="text-sm font-semibold">Emotion Count Bars</h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={countData} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 12 }} width={90} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,23,42,0.92)',
                      border: '1px solid rgba(148,163,184,0.25)',
                      borderRadius: 12,
                      color: '#e2e8f0',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {countData.map((entry) => (
                      <Cell key={entry.fullName} fill={EMOTION_COLORS[entry.fullName] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlowCard>
          </>
        )}
      </div>
    </PageTransition>
  );
}

export default EmotionDashboard;
