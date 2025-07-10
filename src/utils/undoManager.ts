import { CrewMember, CrewInfo } from '../types/CTRTypes';

interface StateSnapshot {
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

export class UndoManager {
  private history: StateSnapshot[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 50;
  private lastRecordTime: number = 0;
  private minTimeBetweenRecords: number = 500; // Minimum time between records in milliseconds

  constructor(initialState: StateSnapshot) {
    this.pushState(initialState);
  }

  private pushState(state: StateSnapshot) {
    // Remove any future states if we're not at the end
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new state
    this.history.push(this.cloneState(state));
    this.currentIndex++;

    // Remove oldest states if we exceed maxHistory
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }

    // Update last record time
    this.lastRecordTime = Date.now();
  }

  private cloneState(state: StateSnapshot): StateSnapshot {
    return {
      data: JSON.parse(JSON.stringify(state.data)),
      crewInfo: JSON.parse(JSON.stringify(state.crewInfo)),
      checkboxStates: { ...state.checkboxStates },
      customEntries: [...state.customEntries]
    };
  }

  private hasSignificantChange(oldState: StateSnapshot, newState: StateSnapshot): boolean {
    // Check if the number of crew members has changed
    if (oldState.data.length !== newState.data.length) {
      return true;
    }

    // Check if any crew member's data has changed
    const hasCrewChange = oldState.data.some((oldMember, index) => {
      const newMember = newState.data[index];
      if (!newMember) return true;

      // Check name and classification changes
      if (oldMember.name !== newMember.name || oldMember.classification !== newMember.classification) {
        return true;
      }

      // Check day changes
      if (oldMember.days.length !== newMember.days.length) {
        return true;
      }

      return oldMember.days.some((oldDay, dayIndex) => {
        const newDay = newMember.days[dayIndex];
        if (!newDay) return true;
        return oldDay.on !== newDay.on || oldDay.off !== newDay.off || oldDay.date !== newDay.date;
      });
    });

    if (hasCrewChange) return true;

    // Check if crew info has changed
    if (
      oldState.crewInfo.crewName !== newState.crewInfo.crewName ||
      oldState.crewInfo.crewNumber !== newState.crewInfo.crewNumber ||
      oldState.crewInfo.fireName !== newState.crewInfo.fireName ||
      oldState.crewInfo.fireNumber !== newState.crewInfo.fireNumber
    ) {
      return true;
    }

    // Check if checkbox states have changed
    const hasCheckboxChange = Object.keys(oldState.checkboxStates).some(
      key => oldState.checkboxStates[key as keyof typeof oldState.checkboxStates] !== 
             newState.checkboxStates[key as keyof typeof oldState.checkboxStates]
    );
    if (hasCheckboxChange) return true;

    // Check if custom entries have changed
    if (oldState.customEntries.length !== newState.customEntries.length) {
      return true;
    }
    const hasCustomEntriesChange = oldState.customEntries.some(
      (entry, index) => entry !== newState.customEntries[index]
    );
    if (hasCustomEntriesChange) return true;

    return false;
  }

  public recordChange(newState: StateSnapshot) {
    const now = Date.now();
    const timeSinceLastRecord = now - this.lastRecordTime;

    // Get current state
    const currentState = this.currentIndex >= 0 ? this.history[this.currentIndex] : null;

    // Only record if:
    // 1. There is no current state, or
    // 2. Enough time has passed since last record AND there is a significant change
    if (!currentState || 
        (timeSinceLastRecord >= this.minTimeBetweenRecords && 
         this.hasSignificantChange(currentState, newState))) {
      this.pushState(newState);
    }
  }

  public canUndo(): boolean {
    return this.currentIndex > 0;
  }

  public undo(): StateSnapshot | null {
    if (!this.canUndo()) {
      return null;
    }

    this.currentIndex--;
    return this.cloneState(this.history[this.currentIndex]);
  }

  public clear() {
    this.history = [];
    this.currentIndex = -1;
  }

  public getCurrentState(): StateSnapshot | null {
    if (this.currentIndex >= 0) {
      return this.cloneState(this.history[this.currentIndex]);
    }
    return null;
  }
} 