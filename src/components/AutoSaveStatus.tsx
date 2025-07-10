import React from 'react';

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
  return (
    <div className="auto-save-status">
      <div className="auto-save-status-content">
        <span className="auto-save-status-text">
          {isSaving ? 'Saving...' : 'Changes saved on blur'}
        </span>
        {lastSaved && (
          <span className="auto-save-status-time">
            Last saved: {new Date(lastSaved).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
} 