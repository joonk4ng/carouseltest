import { CrewMember, CrewInfo } from '../types/CTRTypes';
import { databaseManager, CTRRecord, ChangeLog } from './databaseManager';

// Simplified service class that uses the database manager
export class StableCTRService {
  async saveRecord(date1: string, date2: string, data: CrewMember[], crewInfo: CrewInfo): Promise<void> {
    const db = await databaseManager.getDatabase();
    const dateRange = `${date1} to ${date2}`;
    
    // Get existing record to determine version
    const existingRecord = await db.ctrRecords.get(dateRange);
    const version = existingRecord ? existingRecord.version + 1 : 1;

    // Save the record
    await db.ctrRecords.put({
      id: dateRange,
      dateRange,
      data,
      crewInfo,
      lastModified: Date.now(),
      version
    });

    // Log the change
    await db.changeLog.add({
      dateRange,
      changeType: existingRecord ? 'update' : 'create',
      timestamp: Date.now()
    });
  }

  async getRecord(dateRange: string): Promise<CTRRecord | undefined> {
    const db = await databaseManager.getDatabase();
    return await db.ctrRecords.get(dateRange);
  }

  async getAllDateRanges(): Promise<string[]> {
    const db = await databaseManager.getDatabase();
    const records = await db.ctrRecords.toArray();
    return records.map(record => record.dateRange).sort();
  }

  async deleteRecord(dateRange: string): Promise<void> {
    const db = await databaseManager.getDatabase();
    
    // Log the deletion
    await db.changeLog.add({
      dateRange,
      changeType: 'delete',
      timestamp: Date.now()
    });
    
    // Delete the record
    await db.ctrRecords.delete(dateRange);
  }

  async getDatabaseStats(): Promise<{
    totalRecords: number;
    totalChanges: number;
    lastModified: number;
  }> {
    const db = await databaseManager.getDatabase();
    const [records, changes] = await Promise.all([
      db.ctrRecords.count(),
      db.changeLog.count()
    ]);

    const lastRecord = await db.ctrRecords
      .orderBy('lastModified')
      .last();

    return {
      totalRecords: records,
      totalChanges: changes,
      lastModified: lastRecord?.lastModified || 0
    };
  }
}

// Export singleton instance
export const stableCTRService = new StableCTRService(); 