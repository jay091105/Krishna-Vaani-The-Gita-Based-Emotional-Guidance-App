import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import './App.css';
import GuidancePage from './components/GuidancePage';
import SavedVersesPage from './components/SavedVersesPage';
import EmotionDashboard from './components/EmotionDashboard';
import GitaReader from './components/GitaReader';
import KrishnaChat from './components/KrishnaChat';

function Navbar() {
  const { notificationsEnabled, toggleNotifications } = useNotification();

  return (
    <nav className="navbar">
      <div className="nav-logo-wrap">
        <Link to="/" className="nav-logo">
          Krishna Vaani
        </Link>
      </div>
      <div className="nav-links">
        <Link to="/dashboard" className="nav-link">Dashboard</Link>
        <Link to="/" className="nav-link">Guidance</Link>
        <Link to="/saved-verses" className="nav-link">Saved Verses</Link>
        <Link to="/gita-reader" className="nav-link">Gita Reader</Link>
      </div>
      <div className="nav-controls">
        <button
          className="nav-toggle-btn"
          onClick={toggleNotifications}
          title={notificationsEnabled ? 'Notifications ON' : 'Notifications OFF'}
        >
          {notificationsEnabled ? '🔔' : '🔕'}
        </button>
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
    <div className="App">
      <Navbar />
      <div className="page-content">
        <AnimatedRoutes />
      </div>
    </div>
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
