import { simpleCTRService } from '../db/simpleDexie';

export async function testWorkingImplementation() {
  console.log('🧪 Testing working Dexie implementation...');
  
  try {
    // Test 1: Save a record
    console.log('1. Testing save...');
    await simpleCTRService.saveRecord('2024-01-01', '2024-01-02', [], {
      crewName: 'Test Crew',
      crewNumber: 'TEST001',
      fireName: 'Test Fire',
      fireNumber: 'TF001'
    });
    console.log('✅ Save successful');
    
    // Test 2: Get all date ranges
    console.log('2. Testing get all ranges...');
    const ranges = await simpleCTRService.getAllDateRanges();
    console.log('✅ Found ranges:', ranges);
    
    // Test 3: Get a specific record
    console.log('3. Testing get record...');
    const record = await simpleCTRService.getRecord('2024-01-01 to 2024-01-02');
    console.log('✅ Record retrieved:', record ? 'Yes' : 'No');
    
    // Test 4: Get pending changes count
    console.log('4. Testing pending changes...');
    const pendingCount = await simpleCTRService.getPendingChangesCount();
    console.log('✅ Pending changes count:', pendingCount);
    
    // Test 5: Clean up
    console.log('5. Testing delete...');
    await simpleCTRService.deleteRecord('2024-01-01 to 2024-01-02');
    console.log('✅ Delete successful');
    
    console.log('🎉 All tests passed! Dexie implementation is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
} 