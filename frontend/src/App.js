import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import GuidancePage from './components/GuidancePage';
import SavedVersesPage from './components/SavedVersesPage';
import EmotionDashboard from './components/EmotionDashboard';
import GitaReader from './components/GitaReader';
import KrishnaChat from './components/KrishnaChat';
import AppLayout from './components/AppLayout';

const NAV_LINKS = [
  { to: '/', label: 'Guidance' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/saved-verses', label: 'Saved Verses' },
  { to: '/gita-reader', label: 'Gita Reader' },
];

function Navbar() {
  const { notificationsEnabled, toggleNotifications } = useNotification();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 place-content-center rounded-xl border border-indigo-300/30 bg-gradient-to-br from-indigo-500/30 to-cyan-400/20 text-sm text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.35)]">
            AI
          </div>
          <div className="min-w-0">
            <NavLink to="/" className="truncate text-base font-semibold tracking-tight text-slate-100">
              Krishna Vaani
            </NavLink>
            <p className="truncate text-[11px] text-slate-400">Powered by Emotion AI Model</p>
          </div>
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-white/10 text-cyan-200 shadow-[0_0_20px_rgba(99,102,241,0.35)]'
                    : 'text-slate-300 hover:bg-white/5 hover:text-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <button
          className="btn-ripple rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200 transition hover:bg-cyan-300/20"
          onClick={toggleNotifications}
          title={notificationsEnabled ? 'Notifications ON' : 'Notifications OFF'}
        >
          {notificationsEnabled ? 'Alerts On' : 'Alerts Off'}
        </button>
      </div>

      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 md:hidden">
        {NAV_LINKS.map((item) => (
          <NavLink
            key={`mobile-${item.to}`}
            to={item.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition ${
                isActive ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/5 text-slate-300'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<GuidancePage />} />
        <Route path="/saved-verses" element={<SavedVersesPage />} />
        <Route path="/gita-reader" element={<GitaReader />} />
        <Route path="/dashboard" element={<EmotionDashboard />} />
        <Route path="/krishna-chat" element={<KrishnaChat />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppContent() {
  return (
    <AppLayout>
      <Navbar />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <AnimatedRoutes />
      </div>
    </AppLayout>
  );
}

function App() {
  return (
    <NotificationProvider>
      <Router>
        <AppContent />
      </Router>
    </NotificationProvider>
  );
}

export default App;
