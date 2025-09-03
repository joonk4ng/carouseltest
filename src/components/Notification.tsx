// file for the notification component

import React from 'react';
import '../styles/Notification.css';

interface NotificationProps {
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  onClose: () => void;
  duration?: number;
}

// Notification component
export function Notification(props: NotificationProps) {
  // extract the props
  const { message, type, onClose, duration = 3000 } = props;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`notification notification-${type}`}>
      <div className="notification-content">
        {message}
      </div>
      <button className="notification-close" onClick={onClose}>×</button>
    </div>
  );
} 