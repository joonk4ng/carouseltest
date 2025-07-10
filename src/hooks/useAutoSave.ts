import { useState, useEffect, useCallback, useRef } from 'react';
import { saveCoordinator } from '../utils/saveCoordinator';
import { CrewMember, CrewInfo } from '../types/CTRTypes';

interface UseAutoSaveOptions {
  autoSaveDelay?: number; // milliseconds
  onSave?: (dateRange: string) => void;
  onError?: (error: Error) => void;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: number | null;
  saveNow: () => Promise<void>;
  trackChange: (field: string, oldValue: any, newValue: any) => void;
}

export function useAutoSave(
  dateRange: string | null,
  data: CrewMember[],
  crewInfo: CrewInfo,
  days: string[],
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const {
    autoSaveDelay = 2000,
    onSave,
    onError,
    onSaveStart,
    onSaveComplete
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Save function with simplified logic
  const saveNow = useCallback(async () => {
    if (!data.length) {
      console.log('Auto-save skipped: Empty data');
      return;
    }

    setIsSaving(true);
    console.log('Starting auto-save...', { dateRange, dataLength: data.length });
    
    try {
      onSaveStart?.();
      
      // Create the full date range from the days array if available
      const fullDateRange = dateRange ? `${dateRange} to ${days[1]}` : 'draft';
      
      await saveCoordinator.saveRecord({
        dateRange: fullDateRange,
        data,
        crewInfo,
        onProgress: (message) => {
          console.log('Auto-save progress:', message);
        },
        onComplete: () => {
          const timestamp = Date.now();
          setLastSaved(timestamp);
          if (dateRange) onSave?.(dateRange);
          console.log('Auto-save completed:', { dateRange: fullDateRange, timestamp });
        },
        onError: (error) => {
          console.error('Auto-save error:', error);
          onError?.(error);
        }
      });
    } catch (error) {
      console.error('Auto-save error:', error);
      onError?.(error as Error);
    } finally {
      setIsSaving(false);
      onSaveComplete?.();
    }
  }, [dateRange, data, crewInfo, days, onSave, onError, onSaveStart, onSaveComplete]);

  // Track changes and trigger auto-save
  const trackChange = useCallback((field: string, oldValue: any, newValue: any) => {
    if (oldValue === newValue) return;
    
    console.log('Change detected:', { field, oldValue, newValue });
    
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveNow();
    }, autoSaveDelay);
  }, [saveNow, autoSaveDelay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    lastSaved,
    saveNow,
    trackChange
  };
} 