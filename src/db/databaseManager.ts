import Dexie, { Table } from 'dexie';
import { CrewMember, CrewInfo } from '../types/CTRTypes';

// Define the database schema
export interface CTRRecord {
  id?: string; // date range as key (YYYY-MM-DD to YYYY-MM-DD)
  dateRange: string;
  data: CrewMember[];
  crewInfo: CrewInfo;
  lastModified: number;
  version: number;
}

export interface ChangeLog {
  id?: number;
  dateRange: string;
  changeType: 'create' | 'update' | 'delete';
  timestamp: number;
}

// Extend Dexie to add our tables
class CTRDatabase extends Dexie {
  ctrRecords!: Table<CTRRecord>;
  changeLog!: Table<ChangeLog>;

  constructor() {
    super('CTRDatabase');
    
    // Define schema
    this.version(1).stores({
      ctrRecords: 'id, dateRange, lastModified',
      changeLog: '++id, dateRange, timestamp'
    });
  }
}

// Simplified Database Manager
class DatabaseManager {
  private static instance: DatabaseManager;
  private db: CTRDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private async initialize(): Promise<void> {
    if (!this.db) {
      this.db = new CTRDatabase();
      await this.db.open();
    }
  }

  async getDatabase(): Promise<CTRDatabase> {
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;
    
    if (!this.db) {
      throw new Error('Database failed to initialize');
    }
    
    return this.db;
  }

  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const db = await this.getDatabase();
      return true;
    } catch (error) {
      console.error('Database not ready:', error);
      return false;
    }
  }
}

export const databaseManager = DatabaseManager.getInstance();

// Export the database class for type checking
export { CTRDatabase }; 