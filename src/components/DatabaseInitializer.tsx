import React, { useState, useEffect } from 'react';
import { databaseManager } from '../db/databaseManager';
import { stableCTRService } from '../db/stableDexieService';

interface DatabaseInitializerProps {
  children: React.ReactNode;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function DatabaseInitializer({ children, onReady, onError }: DatabaseInitializerProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const initializeDatabase = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      console.log('DatabaseInitializer: Starting database initialization...');
      
      // Wait for the database to be ready
      await stableCTRService.waitForDatabase();
      
      // Verify the database is working
      const isReady = await stableCTRService.isDatabaseReady();
      if (!isReady) {
        throw new Error('Database is not ready after initialization');
      }
      
      // Test a simple operation
      await stableCTRService.getPendingChangesCount();
      
      console.log('DatabaseInitializer: Database initialization successful');
      setIsReady(true);
      onReady?.();
    } catch (err) {
      const error = err as Error;
      console.error('DatabaseInitializer: Database initialization failed:', error);
      setError(error);
      onError?.(error);
      
      // Retry logic
      if (retryCount < maxRetries) {
        console.log(`DatabaseInitializer: Retrying initialization (${retryCount + 1}/${maxRetries})...`);
        setRetryCount(prev => prev + 1);
        
        // Wait before retrying
        setTimeout(() => {
          initializeDatabase();
        }, 2000 * (retryCount + 1)); // Exponential backoff
      } else {
        console.error('DatabaseInitializer: Max retries reached, giving up');
        setIsInitializing(false);
      }
    } finally {
      if (retryCount >= maxRetries || isReady) {
        setIsInitializing(false);
      }
    }
  };

  useEffect(() => {
    initializeDatabase();
  }, []);

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    initializeDatabase();
  };

  const handleReset = async () => {
    try {
      await databaseManager.reset();
      setRetryCount(0);
      setError(null);
      initializeDatabase();
    } catch (err) {
      console.error('Failed to reset database:', err);
      setError(err as Error);
    }
  };

  if (isInitializing) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          border: '2px solid #e0e0e0',
          borderRadius: '8px',
          padding: '30px',
          textAlign: 'center',
          maxWidth: '400px',
          backgroundColor: '#f9f9f9'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          
          <h3 style={{ margin: '0 0 10px', color: '#333' }}>
            Initializing Database
          </h3>
          
          <p style={{ margin: '0 0 15px', color: '#666' }}>
            {retryCount > 0 
              ? `Attempt ${retryCount + 1} of ${maxRetries + 1}...`
              : 'Setting up your local storage...'
            }
          </p>
          
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: '#e0e0e0',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '60%',
              height: '100%',
              backgroundColor: '#3498db',
              animation: 'pulse 2s ease-in-out infinite'
            }}></div>
          </div>
          
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          border: '2px solid #ff6b6b',
          borderRadius: '8px',
          padding: '30px',
          textAlign: 'center',
          maxWidth: '500px',
          backgroundColor: '#fff5f5'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            backgroundColor: '#ff6b6b',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'white',
            fontSize: '24px'
          }}>
            ⚠️
          </div>
          
          <h3 style={{ margin: '0 0 15px', color: '#d63031' }}>
            Database Initialization Failed
          </h3>
          
          <p style={{ margin: '0 0 20px', color: '#636e72', lineHeight: '1.5' }}>
            {error.message || 'An unknown error occurred while initializing the database.'}
          </p>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleRetry}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Retry
            </button>
            
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Reset Database
            </button>
          </div>
          
          <details style={{ marginTop: '20px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#636e72' }}>
              Technical Details
            </summary>
            <pre style={{
              backgroundColor: '#f8f9fa',
              padding: '10px',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              marginTop: '10px'
            }}>
              {error.stack || error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Preparing application...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 