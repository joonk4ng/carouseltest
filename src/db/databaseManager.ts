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
  field?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: number;
  userId?: string;
}

// Extend Dexie to add our tables
class CTRDatabase extends Dexie {
  ctrRecords!: Table<CTRRecord>;
  changeLog!: Table<ChangeLog>;
  pendingChanges!: Table<{
    id?: number;
    dateRange: string;
    changes: Partial<CTRRecord>;
    timestamp: number;
  }>;

  constructor() {
    super('CTRDatabase');
    
    console.log('CTRDatabase constructor called');
    
    this.version(1).stores({
      ctrRecords: 'id, dateRange, lastModified',
      changeLog: '++id, dateRange, timestamp',
      pendingChanges: '++id, dateRange, timestamp'
    });

    console.log('Database schema defined');

    // Add hooks for change tracking
    this.ctrRecords.hook('creating', (primKey, obj: any) => {
      obj.lastModified = Date.now();
      obj.version = 1;
      return obj;
    });

    this.ctrRecords.hook('updating', (modifications: any, primKey, obj: any) => {
      modifications.lastModified = Date.now();
      modifications.version = (obj.version || 0) + 1;
      return modifications;
    });

    console.log('Database hooks configured');
  }
}

// Singleton Database Manager
class DatabaseManager {
  private static instance: DatabaseManager;
  private db: CTRDatabase | null = null;
  private initPromise: Promise<CTRDatabase> | null = null;
  private isInitialized = false;
  private initializationError: Error | null = null;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async getDatabase(): Promise<CTRDatabase> {
    // Ensure we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Database can only be accessed in browser environment');
    }

    // If there was an initialization error, throw it
    if (this.initializationError) {
      throw this.initializationError;
    }

    if (this.isInitialized && this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeDatabase();
    return this.initPromise;
  }

  private async initializeDatabase(): Promise<CTRDatabase> {
    try {
      console.log('Initializing database...');
      
      // Wait for DOM to be ready
      if (document.readyState !== 'complete') {
        console.log('Waiting for DOM to be ready...');
        await new Promise(resolve => {
          window.addEventListener('load', resolve);
        });
      }
      
      // Wait a bit more to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!this.db) {
        console.log('Creating new database instance...');
        this.db = new CTRDatabase();
      }

      if (!this.db.isOpen()) {
        console.log('Opening database...');
        await this.db.open();
        console.log('Database opened successfully');
      }

      // Verify the database is working by testing a simple operation
      try {
        await this.db.ctrRecords.count();
        console.log('Database connection verified');
      } catch (testError) {
        console.error('Database connection test failed:', testError);
        throw new Error('Database connection test failed');
      }

      this.isInitialized = true;
      this.initializationError = null;
      console.log('Database initialization complete');
      return this.db;
    } catch (error) {
      console.error('Database initialization failed:', error);
      this.initializationError = error as Error;
      this.initPromise = null;
      this.isInitialized = false;
      this.db = null;
      throw error;
    }
  }

  async closeDatabase(): Promise<void> {
    if (this.db && this.db.isOpen()) {
      await this.db.close();
      this.isInitialized = false;
      this.db = null;
      this.initPromise = null;
      this.initializationError = null;
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.db !== null && this.db.isOpen();
  }

  hasError(): boolean {
    return this.initializationError !== null;
  }

  getError(): Error | null {
    return this.initializationError;
  }

  async reset(): Promise<void> {
    await this.closeDatabase();
    this.initializationError = null;
    this.initPromise = null;
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();

// Export the database class for type checking
export { CTRDatabase }; 