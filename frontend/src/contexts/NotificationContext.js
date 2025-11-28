import React, { createContext, useContext, useState } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('notificationsEnabled');
    return saved !== null ? saved === 'true' : true; // Default: enabled
  });

  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success', duration = 3000) => {
    if (!notificationsEnabled) return;

    setNotification({ message, type, id: Date.now() });

    setTimeout(() => {
      setNotification(null);
    }, duration);
  };

  const toggleNotifications = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    localStorage.setItem('notificationsEnabled', newValue.toString());
  };

  return (
    <NotificationContext.Provider value={{ 
      notificationsEnabled, 
      toggleNotifications, 
      showNotification,
      notification 
    }}>
      {children}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <div className="notification-content">
            <span className="notification-icon">
              {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="notification-message">{notification.message}</span>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

