export interface Day {
  date: string;
  on: string;
  off: string;
}

export interface CrewMember {
  name: string;
  classification: string;
  days: Day[];
}

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

export interface CellChange {
  field: string;
  oldValue: string | boolean | object | any[];
  newValue: string | boolean | object | any[];
}

export interface ChangeSet {
  changes: CellChange[];
  date: string;
  timestamp: number;
}

export interface TableData {
  date: string;
  [key: string]: string;  // Allow any string key for dynamic position/name pairs
}

export interface LastEdit {
  rowIndex: number;
  field: string;
  dayIndex?: number;  // For time entries
  originalValue: string;
}

// Legacy types removed - now using simple propagation system 