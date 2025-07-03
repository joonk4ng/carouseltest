import { CrewMember, CrewInfo } from '../types/CTRTypes';
import { databaseManager, CTRRecord, ChangeLog } from './databaseManager';

// Stable service class that uses the database manager
export class StableCTRService {
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const db = await databaseManager.getDatabase();
        
        // Verify database is ready
        if (!db || !db.isOpen()) {
          throw new Error('Database is not ready');
        }
        
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`${operationName} attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          console.log(`Retrying ${operationName} in ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
    
    throw new Error(`${operationName} failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  async saveRecord(date1: string, date2: string, data: CrewMember[], crewInfo: CrewInfo): Promise<void> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      const dateRange = `${date1} to ${date2}`;
      
      // Check if record exists to determine if this is a create or update
      const existingRecord = await db.ctrRecords.get(dateRange);
      const changeType: 'create' | 'update' = existingRecord ? 'update' : 'create';

      // Save the record
      await db.ctrRecords.put({
        id: dateRange,
        dateRange,
        data,
        crewInfo,
        lastModified: Date.now(),
        version: existingRecord ? (existingRecord.version + 1) : 1
      }, dateRange);

      // Log the change
      await this.logChange(dateRange, changeType, {
        data,
        crewInfo
      });

      console.log(`${changeType === 'create' ? 'Created' : 'Updated'} record for date range:`, dateRange);
    }, 'saveRecord');
  }

  async getRecord(dateRange: string): Promise<CTRRecord | undefined> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      return await db.ctrRecords.get(dateRange);
    }, 'getRecord');
  }

  async getAllDateRanges(): Promise<string[]> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      const records = await db.ctrRecords.toArray();
      return records.map(record => record.dateRange).sort();
    }, 'getAllDateRanges');
  }

  async deleteRecord(dateRange: string): Promise<void> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      const existingRecord = await db.ctrRecords.get(dateRange);
      if (existingRecord) {
        // Log the deletion
        await this.logChange(dateRange, 'delete', existingRecord);
        
        // Delete the record
        await db.ctrRecords.delete(dateRange);
        console.log('Deleted record for date range:', dateRange);
      }
    }, 'deleteRecord');
  }

  async getChangeHistory(dateRange: string): Promise<ChangeLog[]> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      return await db.changeLog
        .where('dateRange')
        .equals(dateRange)
        .reverse()
        .sortBy('timestamp');
    }, 'getChangeHistory');
  }

  async getChangesSince(timestamp: number): Promise<ChangeLog[]> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      return await db.changeLog
        .where('timestamp')
        .above(timestamp)
        .reverse()
        .sortBy('timestamp');
    }, 'getChangesSince');
  }

  async trackFieldChange(dateRange: string, field: string, oldValue: any, newValue: any): Promise<void> {
    return this.withRetry(async () => {
      await this.logChange(dateRange, 'update', {
        field,
        oldValue,
        newValue
      });
    }, 'trackFieldChange');
  }

  async savePendingChanges(): Promise<void> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      const pendingChanges = await db.pendingChanges.toArray();
      
      for (const pending of pendingChanges) {
        const record = await db.ctrRecords.get(pending.dateRange);
        if (record) {
          const updatedRecord = { ...record, ...pending.changes };
          await this.saveRecord(
            pending.dateRange.split(' to ')[0],
            pending.dateRange.split(' to ')[1],
            updatedRecord.data,
            updatedRecord.crewInfo
          );
        }
        
        // Remove the pending change
        await db.pendingChanges.delete(pending.id!);
      }
    }, 'savePendingChanges');
  }

  async addPendingChange(dateRange: string, changes: Partial<CTRRecord>): Promise<void> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      await db.pendingChanges.add({
        dateRange,
        changes,
        timestamp: Date.now()
      });
    }, 'addPendingChange');
  }

  async getPendingChangesCount(): Promise<number> {
    try {
      return await this.withRetry(async () => {
        const db = await databaseManager.getDatabase();
        return await db.pendingChanges.count();
      }, 'getPendingChangesCount');
    } catch (error) {
      console.error('Error getting pending changes count:', error);
      return 0;
    }
  }

  async clearPendingChanges(): Promise<void> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      await db.pendingChanges.clear();
    }, 'clearPendingChanges');
  }

  private async logChange(dateRange: string, changeType: 'create' | 'update' | 'delete', data: any): Promise<void> {
    try {
      return await this.withRetry(async () => {
        const db = await databaseManager.getDatabase();
        await db.changeLog.add({
          dateRange,
          changeType,
          ...data,
          timestamp: Date.now(),
          userId: 'current-user' // Could be enhanced with actual user tracking
        });
      }, 'logChange');
    } catch (error) {
      console.error('Error logging change:', error);
    }
  }

  async getDatabaseStats(): Promise<{
    totalRecords: number;
    totalChanges: number;
    pendingChanges: number;
    lastModified: number;
  }> {
    return this.withRetry(async () => {
      const db = await databaseManager.getDatabase();
      const [totalRecords, totalChanges, pendingChanges] = await Promise.all([
        db.ctrRecords.count(),
        db.changeLog.count(),
        db.pendingChanges.count()
      ]);

      const lastRecord = await db.ctrRecords
        .orderBy('lastModified')
        .reverse()
        .first();

      return {
        totalRecords,
        totalChanges,
        pendingChanges,
        lastModified: lastRecord?.lastModified || 0
      };
    }, 'getDatabaseStats');
  }

  async isDatabaseReady(): Promise<boolean> {
    try {
      return databaseManager.isReady();
    } catch (error) {
      console.error('Error checking database readiness:', error);
      return false;
    }
  }

  async waitForDatabase(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        await databaseManager.getDatabase();
        if (databaseManager.isReady()) {
          return;
        }
      } catch (error) {
        console.log(`Database not ready, attempt ${attempts + 1}/${maxAttempts}`);
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error('Database failed to initialize within timeout');
  }
}

// Export singleton instance
export const stableCTRService = new StableCTRService(); 