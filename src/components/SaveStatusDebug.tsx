import React, { useState, useEffect } from 'react';
import { saveCoordinator } from '../utils/saveCoordinator';
import { stableCTRService } from '../db/stableDexieService';

export const SaveStatusDebug: React.FC = () => {
  const [saveStatus, setSaveStatus] = useState({
    isSaveInProgress: false,
    currentSaveType: null as 'auto' | 'manual' | null,
    queueLength: 0,
    databaseStats: {
      totalRecords: 0,
      totalChanges: 0,
      pendingChanges: 0,
      lastModified: 0
    },
    isDatabaseReady: false,
    error: null as string | null
  });

  const updateStatus = async () => {
    try {
      const stats = await stableCTRService.getDatabaseStats();
      setSaveStatus(prev => ({
        ...prev,
        isSaveInProgress: saveCoordinator.isSaveInProgress(),
        currentSaveType: saveCoordinator.getCurrentSaveType(),
        queueLength: saveCoordinator.getQueueLength(),
        databaseStats: stats,
        isDatabaseReady: true,
        error: null
      }));
    } catch (error) {
      console.error('Error updating save status:', error);
      setSaveStatus(prev => ({
        ...prev,
        isDatabaseReady: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 2000); // Reduced frequency to avoid overwhelming
    return () => clearInterval(interval);
  }, []);

  const clearQueue = () => {
    saveCoordinator.clearQueue();
    updateStatus();
  };

  if (!saveStatus.isDatabaseReady) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 1000,
        maxWidth: '300px'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#856404' }}>Database Status</h4>
        <div style={{ color: '#856404' }}>
          {saveStatus.error ? (
            <div>Error: {saveStatus.error}</div>
          ) : (
            <div>Initializing database...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000,
      maxWidth: '300px'
    }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Save Status Debug</h4>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Save Status:</strong>
        <div>In Progress: {saveStatus.isSaveInProgress ? '✅' : '❌'}</div>
        <div>Type: {saveStatus.currentSaveType || 'None'}</div>
        <div>Queue: {saveStatus.queueLength}</div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <strong>Database Stats:</strong>
        <div>Records: {saveStatus.databaseStats.totalRecords}</div>
        <div>Changes: {saveStatus.databaseStats.totalChanges}</div>
        <div>Pending: {saveStatus.databaseStats.pendingChanges}</div>
        <div>Last Modified: {new Date(saveStatus.databaseStats.lastModified).toLocaleTimeString()}</div>
      </div>

      <button 
        onClick={clearQueue}
        style={{
          background: '#dc3545',
          color: 'white',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          cursor: 'pointer'
        }}
      >
        Clear Queue
      </button>
    </div>
  );
}; 