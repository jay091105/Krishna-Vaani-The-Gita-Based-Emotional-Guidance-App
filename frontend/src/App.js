import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import './App.css';
import GuidancePage from './components/GuidancePage';
import SavedVersesPage from './components/SavedVersesPage';
import EmotionDashboard from './components/EmotionDashboard';
import GitaReader from './components/GitaReader';

function Navbar() {
  const { notificationsEnabled, toggleNotifications } = useNotification();

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          Krishna Vaani
        </Link>
        <div className="nav-links">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/saved-verses" className="nav-link">Saved Verses</Link>
          <Link to="/gita-reader" className="nav-link">Gita Reader</Link>
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <div className="nav-controls">
            <button 
              className="nav-toggle-btn" 
              onClick={toggleNotifications}
              title={notificationsEnabled ? "Notifications ON" : "Notifications OFF"}
            >
              {notificationsEnabled ? '🔔' : '🔕'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  return (
    <div className="App">
      <Navbar />
      <Routes>
        <Route path="/" element={<GuidancePage />} />
        <Route path="/saved-verses" element={<SavedVersesPage />} />
        <Route path="/gita-reader" element={<GitaReader />} />
        <Route path="/dashboard" element={<EmotionDashboard />} />
      </Routes>
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

