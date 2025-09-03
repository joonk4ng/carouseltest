// types for the CTR
export interface Day {
  date: string;
  on: string;
  off: string;
}

// initialize object for crew member
export interface CrewMember {
  name: string;
  classification: string;
  days: Day[];
}

// initialize object for crew info
export interface CrewInfo {
  crewName: string;
  crewNumber: string;
  fireName: string;
  fireNumber: string;
  checkboxStates?: {
    noMealsLodging: boolean;
    noMeals: boolean;
    travel: boolean;
    noLunch: boolean;
    hotline: boolean;
  };
  customEntries?: string[];
}

// initialize object for cell change
export interface CellChange {
  field: string;
  oldValue: string | boolean | object | any[];
  newValue: string | boolean | object | any[];
}

// initialize object for change set
export interface ChangeSet {
  changes: CellChange[];
  date: string;
  timestamp: number;
}

// initialize object for table data
export interface TableData {
  date: string;
  [key: string]: string;  // Allow any string key for dynamic position/name pairs
}

// initialize object for last edit
export interface LastEdit {
  rowIndex: number;
  field: string;
  dayIndex?: number;  // For time entries
  originalValue: string;
}

// Legacy types removed - now using simple propagation system 