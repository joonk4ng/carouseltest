import { openDB } from 'idb';
import { ctrDataServiceWithTracking } from '../db/dexieDatabase';
import { CrewMember, CrewInfo } from '../types/CTRTypes';

interface OldCTRRecord {
  dateRange: string;
  data: CrewMember[];
  crewInfo: CrewInfo;
}

// Migration utility to transfer data from old IndexedDB to new Dexie system
export class MigrationUtils {
  private static readonly OLD_DB_NAME = 'ctr-database';
  private static readonly OLD_STORE_NAME = 'ctr_records';

  // Check if migration is needed
  static async needsMigration(): Promise<boolean> {
    try {
      // Check if old database exists
      const oldDb = await openDB(this.OLD_DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('ctr_records')) {
            db.createObjectStore('ctr_records');
          }
        },
      });

      const oldRecords = await oldDb.getAll(this.OLD_STORE_NAME);
      
      // Check if new database has any records
      const newDateRanges = await ctrDataServiceWithTracking.getAllDateRanges();
      
      // If old database has records but new database doesn't, migration is needed
      return oldRecords.length > 0 && newDateRanges.length === 0;
    } catch (error) {
      console.log('Old database not found, no migration needed');
      return false;
    }
  }

  // Perform migration from old IndexedDB to new Dexie system
  static async migrateData(): Promise<{
    success: boolean;
    migratedCount: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      migratedCount: 0,
      errors: [] as string[]
    };

    try {
      console.log('Starting migration from old IndexedDB to Dexie...');

      // Open old database
      const oldDb = await openDB(this.OLD_DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('ctr_records')) {
            db.createObjectStore('ctr_records');
          }
        },
      });

      // Get all records from old database
      const oldRecords = await oldDb.getAll(this.OLD_STORE_NAME);
      console.log(`Found ${oldRecords.length} records to migrate`);

      // Migrate each record
      for (const oldRecord of oldRecords) {
        try {
          const { dateRange, data, crewInfo } = oldRecord as OldCTRRecord;
          const [date1, date2] = dateRange.split(' to ');

          // Save to new Dexie database
          await ctrDataServiceWithTracking.saveRecord(date1, date2, data, crewInfo);
          result.migratedCount++;

          console.log(`Migrated: ${dateRange}`);
        } catch (error) {
          const errorMsg = `Failed to migrate ${oldRecord.dateRange}: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Verify migration
      const newDateRanges = await ctrDataServiceWithTracking.getAllDateRanges();
      console.log(`Migration complete. New database has ${newDateRanges.length} records`);

      result.success = result.migratedCount > 0 && result.errors.length === 0;

      // Optionally, you can delete the old database after successful migration
      if (result.success) {
        console.log('Migration successful. You can now delete the old database if needed.');
      }

    } catch (error) {
      const errorMsg = `Migration failed: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    return result;
  }

  // Backup old data before migration
  static async backupOldData(): Promise<{
    success: boolean;
    backupData: OldCTRRecord[];
    error?: string;
  }> {
    try {
      const oldDb = await openDB(this.OLD_DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('ctr_records')) {
            db.createObjectStore('ctr_records');
          }
        },
      });

      const oldRecords = await oldDb.getAll(this.OLD_STORE_NAME);
      
      return {
        success: true,
        backupData: oldRecords as OldCTRRecord[]
      };
    } catch (error) {
      return {
        success: false,
        backupData: [],
        error: `Backup failed: ${error}`
      };
    }
  }

  // Get database statistics for comparison
  static async getDatabaseStats(): Promise<{
    oldDatabase: {
      exists: boolean;
      recordCount: number;
    };
    newDatabase: {
      recordCount: number;
      changeCount: number;
      pendingChanges: number;
    };
  }> {
    const stats = {
      oldDatabase: {
        exists: false,
        recordCount: 0
      },
      newDatabase: {
        recordCount: 0,
        changeCount: 0,
        pendingChanges: 0
      }
    };

    try {
      // Check old database
      const oldDb = await openDB(this.OLD_DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('ctr_records')) {
            db.createObjectStore('ctr_records');
          }
        },
      });
      
      const oldRecords = await oldDb.getAll(this.OLD_STORE_NAME);
      stats.oldDatabase.exists = true;
      stats.oldDatabase.recordCount = oldRecords.length;
    } catch (error) {
      console.log('Old database not found');
    }

    try {
      // Check new database
      const newStats = await ctrDataServiceWithTracking.getDatabaseStats();
      stats.newDatabase = {
        recordCount: newStats.totalRecords,
        changeCount: newStats.totalChanges,
        pendingChanges: newStats.pendingChanges
      };
    } catch (error) {
      console.log('New database not accessible');
    }

    return stats;
  }

  // Clean up old database (use with caution!)
  static async cleanupOldDatabase(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // This is a destructive operation - use with caution!
      const oldDb = await openDB(this.OLD_DB_NAME, 1);
      oldDb.close();
      
      // Delete the database
      await indexedDB.deleteDatabase(this.OLD_DB_NAME);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Cleanup failed: ${error}`
      };
    }
  }
} 