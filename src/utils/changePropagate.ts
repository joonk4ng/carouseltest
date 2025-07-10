import { db } from '../db/dexieDatabase';
import { CellChange } from '../types/CTRTypes';

/**
 * Checks if two values should be considered the same for propagation purposes
 */
function valuesMatch(value1: string, value2: string): boolean {
  // If exact match, return true
  if (value1 === value2) return true;

  // Remove extra spaces and compare
  const clean1 = value1.trim().replace(/\s+/g, ' ');
  const clean2 = value2.trim().replace(/\s+/g, ' ');
  if (clean1 === clean2) return true;

  // Check for name variations (e.g., "John Smith" vs "J Smith" or "John S")
  const words1 = clean1.toLowerCase().split(' ');
  const words2 = clean2.toLowerCase().split(' ');

  // If one is a subset of the other
  const isSubset = words1.every(word => 
    words2.some(w2 => w2.startsWith(word) || word.startsWith(w2))
  ) || words2.every(word => 
    words1.some(w1 => w1.startsWith(word) || word.startsWith(w1))
  );

  return isSubset;
}

/**
 * Propagates changes forward in time from a specific date.
 * Will update all future dates that match the state from before the change.
 */
export async function propagateChangesForward(
  changes: CellChange[],
  fromDate: string
) {
  try {
    // Get all future dates
    const futureDates = await db.dates
      .where('date')
      .above(fromDate)
      .toArray();

    // For each future date
    for (const { date } of futureDates) {
      const tableData = await db.tableData
        .where({ date })
        .first();

      if (tableData) {
        const updates: { [key: string]: string } = {};
        let hasUpdates = false;

        // For each change, check if the current value matches what we're changing FROM
        for (const change of changes) {
          // Only update if the current value matches what we're changing from
          if (tableData[change.field] === change.oldValue) {
            updates[change.field] = change.newValue;
            hasUpdates = true;
          }
        }

        // If we have updates, apply them
        if (hasUpdates) {
          await db.tableData.update(date, updates);
          
          // Record the changes
          for (const change of changes) {
            if (updates[change.field]) {
              await db.changes.add({
                date,
                field: change.field,
                oldValue: change.oldValue,
                newValue: change.newValue,
                timestamp: Date.now()
              });
            }
          }
        } else {
          // If this date doesn't match, stop propagating further
          // This prevents updating days that were intentionally different
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error propagating changes:', error);
    throw error;
  }
} 