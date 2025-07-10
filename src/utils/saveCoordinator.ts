import { stableCTRService } from '../db/stableDexieService';
import { CrewMember, CrewInfo } from '../types/CTRTypes';
import { databaseManager } from '../db/databaseManager';

interface SaveOptions {
  dateRange: string;
  data: CrewMember[];
  crewInfo: CrewInfo;
  onProgress?: (message: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

class SaveCoordinator {
  private saveInProgress = false;
  private saveQueue: SaveOptions[] = [];
  private retryCount = 0;
  private maxRetries = 3;

  private async ensureDatabase(): Promise<boolean> {
    try {
      return await databaseManager.isReady();
    } catch (error) {
      console.error('Database check failed:', error);
      return false;
    }
  }

  async saveRecord(options: SaveOptions): Promise<void> {
    const { dateRange, data, crewInfo, onProgress, onComplete, onError } = options;

    // If a save is already in progress, queue this save
    if (this.saveInProgress) {
      console.log('Save queued - save already in progress');
      this.saveQueue.push(options);
      return;
    }

    this.saveInProgress = true;

    try {
      onProgress?.('Save started...');
      
      // Ensure database is ready
      const isDatabaseReady = await this.ensureDatabase();
      if (!isDatabaseReady) {
        throw new Error('Database is not ready');
      }
      
      const [date1, date2] = dateRange.split(' to ');
      await stableCTRService.saveRecord(date1, date2, data, crewInfo);
      
      onProgress?.('Save completed');
      onComplete?.();
      
      console.log('Save successful:', dateRange);
      this.retryCount = 0; // Reset retry count on success
    } catch (error) {
      console.error('Save error:', error);
      
      // Check if we should retry
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying save (attempt ${this.retryCount}/${this.maxRetries})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * this.retryCount));
        
        // Reset save state
        this.saveInProgress = false;
        
        // Retry the save
        await this.saveRecord(options);
        return;
      }
      
      onError?.(error as Error);
    } finally {
      this.saveInProgress = false;
      
      // Process queued saves
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.saveQueue.length === 0) return;

    const nextSave = this.saveQueue.shift();
    if (nextSave) {
      await this.saveRecord(nextSave);
    }
  }

  isSaveInProgress(): boolean {
    return this.saveInProgress;
  }
}

// Export singleton instance
export const saveCoordinator = new SaveCoordinator(); 