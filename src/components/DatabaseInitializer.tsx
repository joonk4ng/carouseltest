import React, { useState, useEffect } from 'react';
import { databaseManager } from '../db/databaseManager';

interface DatabaseInitializerProps {
  children: React.ReactNode;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function DatabaseInitializer({ children, onReady, onError }: DatabaseInitializerProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initDatabase() {
      try {
        setIsInitializing(true);
        setError(null);
        
        // Initialize database
        await databaseManager.getDatabase();
        
        // Verify it's ready
        const isReady = await databaseManager.isReady();
        if (!isReady) {
          throw new Error('Database failed to initialize');
        }
        
        setIsInitializing(false);
        onReady?.();
      } catch (err) {
        const error = err as Error;
        console.error('Database initialization failed:', error);
        setError(error);
        onError?.(error);
        setIsInitializing(false);
      }
    }

    initDatabase();

    // Cleanup
    return () => {
      databaseManager.closeDatabase().catch(console.error);
    };
  }, [onReady, onError]);

  if (isInitializing) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        margin: '10px'
      }}>
        Initializing database...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#fff5f5',
        border: '1px solid #fed7d7',
        borderRadius: '4px',
        color: '#c53030',
        margin: '10px'
      }}>
        <strong>Database Error:</strong> {error.message}
        <button
          onClick={() => window.location.reload()}
          style={{
            marginLeft: '10px',
            padding: '4px 8px',
            backgroundColor: '#e53e3e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
} 