import { useState, useEffect, useCallback, useRef } from 'react';
import { stableCTRService } from '../db/stableDexieService';
import { saveCoordinator } from '../utils/saveCoordinator';
import { CrewMember, CrewInfo } from '../types/CTRTypes';

interface UseAutoSaveOptions {
  autoSaveDelay?: number; // milliseconds
  enableAutoSave?: boolean;
  onSave?: (dateRange: string) => void;
  onError?: (error: Error) => void;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: number | null;
  pendingChangesCount: number;
  saveNow: () => Promise<void>;
  trackChange: (field: string, oldValue: any, newValue: any) => void;
  clearPendingChanges: () => Promise<void>;
  isSaveInProgress: boolean; // New flag to coordinate with manual saves
}

export function useAutoSave(
  dateRange: string | null,
  data: CrewMember[],
  crewInfo: CrewInfo,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const {
    autoSaveDelay = 2000, // 2 seconds default
    enableAutoSave = true,
    onSave,
    onError,
    onSaveStart,
    onSaveComplete
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const [isSaveInProgress, setIsSaveInProgress] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<{ data: CrewMember[]; crewInfo: CrewInfo }>({ data: [], crewInfo: {} as CrewInfo });

  // Check for pending changes with retry logic
  const updatePendingChangesCount = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const count = await stableCTRService.getPendingChangesCount();
        setPendingChangesCount(count);
        return;
      } catch (error) {
        attempts++;
        console.error(`Error getting pending changes count (attempt ${attempts}/${maxAttempts}):`, error);
        
        if (attempts < maxAttempts) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        } else {
          // Set count to 0 on final failure
          setPendingChangesCount(0);
        }
      }
    }
  }, []);

  // Save function with coordination and database readiness check
  const saveNow = useCallback(async () => {
    if (!dateRange || !data.length) return;
    
    // Check if a save is already in progress
    if (saveCoordinator.isSaveInProgress()) {
      console.log('Save already in progress, skipping auto-save');
      return;
    }

    // Check if database is ready
    try {
      const isReady = await stableCTRService.isDatabaseReady();
      if (!isReady) {
        console.log('Database not ready, skipping auto-save');
        return;
      }
    } catch (error) {
      console.error('Error checking database readiness:', error);
      return;
    }

    setIsSaving(true);
    setIsSaveInProgress(true);
    
    try {
      onSaveStart?.();
      
      await saveCoordinator.saveRecord({
        dateRange,
        data,
        crewInfo,
        saveType: 'auto',
        onProgress: (message) => {
          console.log('Auto-save progress:', message);
        },
        onComplete: () => {
          setLastSaved(Date.now());
          updatePendingChangesCount();
          onSave?.(dateRange);
          console.log('Auto-saved:', dateRange);
        },
        onError: (error) => {
          console.error('Auto-save error:', error);
          onError?.(error);
        }
      });
    } finally {
      setIsSaving(false);
      setIsSaveInProgress(false);
      onSaveComplete?.();
    }
  }, [dateRange, data, crewInfo, onSave, onError, onSaveStart, onSaveComplete, updatePendingChangesCount]);

  // Track individual field changes
  const trackChange = useCallback((field: string, oldValue: any, newValue: any) => {
    if (!dateRange) return;

    // Simple service doesn't track individual changes, just trigger auto-save
    updatePendingChangesCount();
  }, [dateRange, updatePendingChangesCount]);

  // Clear pending changes with retry logic
  const clearPendingChanges = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        await stableCTRService.clearPendingChanges();
        await updatePendingChangesCount();
        return;
      } catch (error) {
        attempts++;
        console.error(`Error clearing pending changes (attempt ${attempts}/${maxAttempts}):`, error);
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }
  }, [updatePendingChangesCount]);

  // Auto-save effect with coordination and database readiness check
  useEffect(() => {
    if (!enableAutoSave || !dateRange) return;

    // Deep comparison to detect changes
    const hasDataChanged = JSON.stringify(data) !== JSON.stringify(lastDataRef.current.data);
    const hasCrewInfoChanged = JSON.stringify(crewInfo) !== JSON.stringify(lastDataRef.current.crewInfo);

    if (hasDataChanged || hasCrewInfoChanged) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(async () => {
        // Check if database is ready before attempting auto-save
        try {
          const isReady = await stableCTRService.isDatabaseReady();
          if (!isReady) {
            console.log('Database not ready, skipping auto-save');
            return;
          }
          
          // Only auto-save if no save is in progress
          if (!saveCoordinator.isSaveInProgress()) {
            saveNow();
          }
        } catch (error) {
          console.error('Error checking database readiness for auto-save:', error);
        }
      }, autoSaveDelay);

      // Update last data reference
      lastDataRef.current = { data: [...data], crewInfo: { ...crewInfo } };
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [dateRange, data, crewInfo, enableAutoSave, autoSaveDelay, saveNow]);

  // Initialize pending changes count
  useEffect(() => {
    updatePendingChangesCount();
  }, [updatePendingChangesCount]);

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
    pendingChangesCount,
    saveNow,
    trackChange,
    clearPendingChanges,
    isSaveInProgress
  };
} 