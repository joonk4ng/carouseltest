import React, { useState, useEffect } from 'react';
import { stableCTRService } from '../db/stableDexieService';

export const DatabaseTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Testing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testDatabase = async () => {
      try {
        setStatus('Testing database connection...');
        
        // Test basic database operations
        const stats = await stableCTRService.getDatabaseStats();
        console.log('Database stats:', stats);
        
        setStatus('Database is working! ✅');
        console.log('Database test successful');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setStatus('Database test failed! ❌');
        console.error('Database test failed:', err);
      }
    };

    // Wait a bit before testing
    const timer = setTimeout(testDatabase, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '50px',
      left: '10px',
      background: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000,
      maxWidth: '300px'
    }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Database Test</h4>
      <div>Status: {status}</div>
      {error && (
        <div style={{ color: 'red', marginTop: '8px' }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}; 