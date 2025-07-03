import Dexie from 'dexie';

// Simple test to see if Dexie is working
export async function testDexie() {
  try {
    console.log('Testing Dexie initialization...');
    
    // Create a simple test database
    const testDb = new Dexie('TestDatabase');
    
    testDb.version(1).stores({
      test: 'id'
    });
    
    console.log('Dexie database created successfully');
    
    // Try to open it
    await testDb.open();
    console.log('Dexie database opened successfully');
    
    // Try a simple operation
    await testDb.table('test').add({ id: 1, name: 'test' });
    console.log('Dexie write operation successful');
    
    const result = await testDb.table('test').get(1);
    console.log('Dexie read operation successful:', result);
    
    await testDb.close();
    console.log('Dexie test completed successfully');
    
    return true;
  } catch (error) {
    console.error('Dexie test failed:', error);
    return false;
  }
}

// Test if Dexie is available at all
export function checkDexieAvailability() {
  try {
    console.log('Checking Dexie availability...');
    console.log('Dexie version:', Dexie.version);
    console.log('Dexie available:', typeof Dexie !== 'undefined');
    return typeof Dexie !== 'undefined';
  } catch (error) {
    console.error('Dexie not available:', error);
    return false;
  }
} 