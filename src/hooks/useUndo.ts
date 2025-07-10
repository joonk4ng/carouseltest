import { useState, useEffect, useCallback } from 'react';
import { UndoManager } from '../utils/undoManager';
import { CrewMember, CrewInfo } from '../types/CTRTypes';

interface UseUndoState {
  data: CrewMember[];
  crewInfo: CrewInfo;
  checkboxStates: {
    noMealsLodging: boolean;
    noMeals: boolean;
    travel: boolean;
    noLunch: boolean;
    hotline: boolean;
  };
  customEntries: string[];
}

interface UseUndoOptions {
  onStateChange?: (state: UseUndoState) => void;
  onUndoStateChange?: (canUndo: boolean) => void;
}

export function useUndo(
  initialState: UseUndoState,
  options: UseUndoOptions = {}
) {
  const [undoManager] = useState(() => new UndoManager(initialState));
  const [canUndo, setCanUndo] = useState(false);

  // Update canUndo state whenever the undo manager state changes
  const updateCanUndo = useCallback(() => {
    const newCanUndo = undoManager.canUndo();
    setCanUndo(newCanUndo);
    options.onUndoStateChange?.(newCanUndo);
  }, [undoManager, options.onUndoStateChange]);

  // Record a new state
  const recordState = useCallback((state: UseUndoState) => {
    undoManager.recordChange(state);
    updateCanUndo();
  }, [undoManager, updateCanUndo]);

  // Perform undo operation
  const undo = useCallback(() => {
    const previousState = undoManager.undo();
    if (previousState) {
      options.onStateChange?.(previousState);
      updateCanUndo();
    }
    return previousState;
  }, [undoManager, options.onStateChange, updateCanUndo]);

  // Clear undo history
  const clearHistory = useCallback(() => {
    undoManager.clear();
    updateCanUndo();
  }, [undoManager, updateCanUndo]);

  // Initialize canUndo state
  useEffect(() => {
    updateCanUndo();
  }, [updateCanUndo]);

  return {
    recordState,
    undo,
    canUndo,
    clearHistory
  };
} 