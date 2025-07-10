import React, { useEffect, useState } from 'react';
import '../styles/AutoSaveStatus.css';

interface AutoSaveStatusProps {
  dateRange: string | null;
  isSaving: boolean;
  lastSaved: number | null;
}

export function AutoSaveStatus({ 
  dateRange, 
  isSaving, 
  lastSaved
}: AutoSaveStatusProps) {
  const [visible, setVisible] = useState(true);

  // Hide the status after 3 seconds when saved
  useEffect(() => {
    if (!isSaving && lastSaved) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [isSaving, lastSaved]);

  if (!visible && !isSaving) return null;

  const statusClass = isSaving ? 'saving' : 'saved';

  return (
    <div className={`auto-save-status ${statusClass}`}>
      <div className="auto-save-status-content">
        <span className="auto-save-status-text">
          {isSaving ? 'Saving changes...' : 'All changes saved'}
        </span>
        {lastSaved && (
          <span className="auto-save-status-time">
            {new Date(lastSaved).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
} 