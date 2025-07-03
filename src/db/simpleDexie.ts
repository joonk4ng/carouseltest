import Dexie, { Table } from 'dexie';
import { CrewMember, CrewInfo } from '../types/CTRTypes';
import { CTRDatabase, initializeDatabase } from './dexieDatabase';

// Simple interface for our records
interface CTRRecord {
  id?: string;
  dateRange: string;
  data: CrewMember[];
  crewInfo: CrewInfo;
}

// Simple service class that uses the same database instance
export class SimpleCTRService {
  private db: CTRDatabase | null = null;

  constructor() {
    // Initialize database when service is created
    this.initDB();
  }

  private async initDB() {
    if (!this.db) {
      this.db = await initializeDatabase();
    }
  }

  private async ensureDB() {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Database failed to initialize');
    }
  }

  async saveRecord(date1: string, date2: string, data: CrewMember[], crewInfo: CrewInfo): Promise<void> {
    await this.ensureDB();
    
    try {
      const dateRange = `${date1} to ${date2}`;
      
      await this.db!.ctrRecords.put({
        id: dateRange,
        dateRange,
        data,
        crewInfo,
        lastModified: Date.now(),
        version: 1
      }, dateRange);
      
      console.log('Saved record:', dateRange);
    } catch (error) {
      console.error('Error saving record:', error);
      throw error;
    }
  }

  async getRecord(dateRange: string): Promise<CTRRecord | undefined> {
    await this.ensureDB();
    
    try {
      return await this.db!.ctrRecords.get(dateRange);
    } catch (error) {
      console.error('Error getting record:', error);
      throw error;
    }
  }

  async getAllDateRanges(): Promise<string[]> {
    await this.ensureDB();
    
    try {
      const records = await this.db!.ctrRecords.toArray();
      return records.map(record => record.dateRange).sort();
    } catch (error) {
      console.error('Error getting all date ranges:', error);
      throw error;
    }
  }

  async deleteRecord(dateRange: string): Promise<void> {
    await this.ensureDB();
    
    try {
      await this.db!.ctrRecords.delete(dateRange);
      console.log('Deleted record:', dateRange);
    } catch (error) {
      console.error('Error deleting record:', error);
      throw error;
    }
  }

  // Stub methods for compatibility
  async getChangeHistory(): Promise<any[]> { return []; }
  async getChangesSince(): Promise<any[]> { return []; }
  async trackFieldChange(): Promise<void> { }
  async savePendingChanges(): Promise<void> { }
  async addPendingChange(): Promise<void> { }
  async getPendingChangesCount(): Promise<number> { return 0; }
  async clearPendingChanges(): Promise<void> { }
  async getDatabaseStats() {
    await this.ensureDB();
    
    try {
      const totalRecords = await this.db!.ctrRecords.count();
      return { totalRecords, totalChanges: 0, pendingChanges: 0, lastModified: Date.now() };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return { totalRecords: 0, totalChanges: 0, pendingChanges: 0, lastModified: 0 };
    }
  }
}

// Export singleton
export const simpleCTRService = new SimpleCTRService(); 