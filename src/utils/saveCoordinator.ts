import { stableCTRService } from '../db/stableDexieService';
import { CrewMember, CrewInfo } from '../types/CTRTypes';

interface SaveOptions {
  dateRange: string;
  data: CrewMember[];
  crewInfo: CrewInfo;
  saveType: 'auto' | 'manual';
  onProgress?: (message: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

class SaveCoordinator {
  private saveInProgress = false;
  private currentSaveType: 'auto' | 'manual' | null = null;
  private saveQueue: SaveOptions[] = [];
  private retryCount = 0;
  private maxRetries = 3;

  async saveRecord(options: SaveOptions): Promise<void> {
    const { dateRange, data, crewInfo, saveType, onProgress, onComplete, onError } = options;

    // If a save is already in progress, queue this save
    if (this.saveInProgress) {
      console.log(`${saveType} save queued - ${saveType} save already in progress`);
      this.saveQueue.push(options);
      return;
    }

    // If this is an auto-save but a manual save is in progress, skip it
    if (saveType === 'auto' && this.currentSaveType === 'manual') {
      console.log('Auto-save skipped - manual save in progress');
      return;
    }

    this.saveInProgress = true;
    this.currentSaveType = saveType;

    try {
      onProgress?.(`${saveType} save started...`);
      
      // Check if database is ready before attempting save
      const isReady = await stableCTRService.isDatabaseReady();
      if (!isReady) {
        throw new Error('Database is not ready');
      }
      
      const [date1, date2] = dateRange.split(' to ');
      await stableCTRService.saveRecord(date1, date2, data, crewInfo);
      
      onProgress?.(`${saveType} save completed`);
      onComplete?.();
      
      console.log(`${saveType} save successful:`, dateRange);
      this.retryCount = 0; // Reset retry count on success
    } catch (error) {
      console.error(`${saveType} save error:`, error);
      
      // Check if it's a database initialization error or database not ready
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Database failed to initialize') || 
          errorMessage.includes('Database is not ready') ||
          errorMessage.includes('Cannot read properties of undefined')) {
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`Retrying ${saveType} save (attempt ${this.retryCount}/${this.maxRetries})...`);
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
          
          // Retry the save
          this.saveInProgress = false;
          this.currentSaveType = null;
          await this.saveRecord(options);
          return;
        } else {
          console.error(`Max retries reached for ${saveType} save`);
        }
      }
      
      onError?.(error as Error);
    } finally {
      this.saveInProgress = false;
      this.currentSaveType = null;
      
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

  getCurrentSaveType(): 'auto' | 'manual' | null {
    return this.currentSaveType;
  }

  clearQueue(): void {
    this.saveQueue = [];
  }

  getQueueLength(): number {
    return this.saveQueue.length;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  resetRetryCount(): void {
    this.retryCount = 0;
  }
}

// Export singleton instance
export const saveCoordinator = new SaveCoordinator(); 