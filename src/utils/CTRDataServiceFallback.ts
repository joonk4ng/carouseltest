import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { CrewMember, CrewInfo } from '../types/CTRTypes';

interface CTRData extends DBSchema {
  ctr_records: {
    key: string; // date range as key (YYYY-MM-DD to YYYY-MM-DD)
    value: {
      dateRange: string;
      data: CrewMember[];
      crewInfo: CrewInfo;
    };
  };
}

class CTRDataServiceFallback {
  private db: IDBPDatabase<CTRData> | null = null;
  private readonly DB_NAME = 'ctr-database';
  private readonly STORE_NAME = 'ctr_records';

  async initDB() {
    if (!this.db) {
      this.db = await openDB<CTRData>(this.DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('ctr_records')) {
            db.createObjectStore('ctr_records');
          }
        },
      });
    }
    return this.db;
  }

  private formatDateRange(date1: string, date2: string): string {
    return `${date1} to ${date2}`;
  }

  async saveRecord(date1: string, date2: string, data: CrewMember[], crewInfo: CrewInfo) {
    const db = await this.initDB();
    const dateRange = this.formatDateRange(date1, date2);
    console.log('Saving date range:', dateRange);
    await db.put(this.STORE_NAME, {
      dateRange,
      data,
      crewInfo
    }, dateRange);
  }

  async getRecord(dateRange: string) {
    const db = await this.initDB();
    console.log('Getting record for date range:', dateRange);
    return db.get(this.STORE_NAME, dateRange);
  }

  async getAllDateRanges(): Promise<string[]> {
    const db = await this.initDB();
    const ranges = await db.getAllKeys(this.STORE_NAME);
    console.log('All date ranges:', ranges);
    return ranges;
  }

  async deleteRecord(dateRange: string) {
    const db = await this.initDB();
    await db.delete(this.STORE_NAME, dateRange);
  }

  // Stub methods for compatibility with Dexie interface
  async getChangeHistory(dateRange: string): Promise<any[]> {
    return []; // No change history in fallback
  }

  async getChangesSince(timestamp: number): Promise<any[]> {
    return []; // No change history in fallback
  }

  async trackFieldChange(dateRange: string, field: string, oldValue: any, newValue: any): Promise<void> {
    // No change tracking in fallback
  }

  async savePendingChanges(): Promise<void> {
    // No pending changes in fallback
  }

  async addPendingChange(dateRange: string, changes: any): Promise<void> {
    // No pending changes in fallback
  }

  async getPendingChangesCount(): Promise<number> {
    return 0; // No pending changes in fallback
  }

  async clearPendingChanges(): Promise<void> {
    // No pending changes in fallback
  }

  async getDatabaseStats(): Promise<{
    totalRecords: number;
    totalChanges: number;
    pendingChanges: number;
    lastModified: number;
  }> {
    const db = await this.initDB();
    const totalRecords = await db.count(this.STORE_NAME);
    return {
      totalRecords,
      totalChanges: 0,
      pendingChanges: 0,
      lastModified: Date.now()
    };
  }
}

// Export singleton instance
export const ctrDataServiceFallback = new CTRDataServiceFallback(); 