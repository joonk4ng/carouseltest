import React, { useState, useEffect } from 'react';
import { stableCTRService } from '../db/stableDexieService';
import { ChangeLog } from '../db/databaseManager';

interface AutoSaveStatusProps {
  dateRange: string | null;
  isSaving: boolean;
  lastSaved: number | null;
  pendingChangesCount: number;
  onShowChangeHistory: () => void;
}

export const AutoSaveStatus: React.FC<AutoSaveStatusProps> = ({
  dateRange,
  isSaving,
  lastSaved,
  pendingChangesCount,
  onShowChangeHistory
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [changeHistory, setChangeHistory] = useState<ChangeLog[]>([]);

  // Load change history when date range changes
  useEffect(() => {
    if (dateRange && showHistory) {
      loadChangeHistory();
    }
  }, [dateRange, showHistory]);

  const loadChangeHistory = async () => {
    if (!dateRange) return;
    
    try {
      const history = await stableCTRService.getChangeHistory(dateRange);
      setChangeHistory(history);
    } catch (error) {
      console.error('Error loading change history:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'create': return '📝';
      case 'update': return '✏️';
      case 'delete': return '🗑️';
      default: return '📄';
    }
  };

  const getChangeDescription = (change: ChangeLog) => {
    if (change.field) {
      return `${change.field}: "${change.oldValue}" → "${change.newValue}"`;
    }
    return `${change.changeType} record`;
  };

  return (
    <div className="auto-save-status">
      <div className="status-bar">
        <div className="status-indicators">
          {isSaving && (
            <div className="status-item saving">
              <span className="spinner">⏳</span>
              <span>Saving...</span>
            </div>
          )}
          
          {lastSaved && (
            <div className="status-item saved">
              <span>✅</span>
              <span>Last saved: {formatTimestamp(lastSaved)}</span>
            </div>
          )}
          
          {pendingChangesCount > 0 && (
            <div className="status-item pending">
              <span>📝</span>
              <span>{pendingChangesCount} pending changes</span>
            </div>
          )}
        </div>
        
        {dateRange && (
          <button 
            className="history-btn"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide' : 'Show'} History
          </button>
        )}
      </div>

      {showHistory && dateRange && (
        <div className="change-history">
          <h4>Change History for {dateRange}</h4>
          <div className="history-list">
            {changeHistory.length === 0 ? (
              <div className="history-item">
                <span>No changes recorded yet.</span>
              </div>
            ) : (
              changeHistory.map((change, index) => (
                <div key={change.id || index} className="history-item">
                  <div className="history-header">
                    <span className="change-icon">{getChangeIcon(change.changeType)}</span>
                    <span className="change-time">{formatTimestamp(change.timestamp)}</span>
                  </div>
                  <div className="change-description">
                    {getChangeDescription(change)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 