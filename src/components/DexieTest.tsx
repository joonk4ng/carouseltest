import React, { useEffect, useState } from 'react';
import { testDexie, checkDexieAvailability } from '../debug/dexieTest';
import { simpleCTRService } from '../db/simpleDexie';

export const DexieTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      addResult('Starting Dexie tests...');
      
      // Test 1: Check if Dexie is available
      addResult('Test 1: Checking Dexie availability');
      const dexieAvailable = checkDexieAvailability();
      addResult(`Dexie available: ${dexieAvailable}`);
      
      if (!dexieAvailable) {
        addResult('ERROR: Dexie is not available');
        return;
      }
      
      // Test 2: Basic Dexie functionality
      addResult('Test 2: Testing basic Dexie functionality');
      const basicTestResult = await testDexie();
      addResult(`Basic test result: ${basicTestResult}`);
      
      // Test 3: Our simple service
      addResult('Test 3: Testing our simple service');
      try {
        await simpleCTRService.saveRecord('2024-01-01', '2024-01-02', [], {
          crewName: 'Test Crew',
          crewNumber: 'TEST001',
          fireName: 'Test Fire',
          fireNumber: 'TF001'
        });
        addResult('Simple service save: SUCCESS');
        
        const ranges = await simpleCTRService.getAllDateRanges();
        addResult(`Simple service get ranges: SUCCESS (${ranges.length} ranges)`);
        
        await simpleCTRService.deleteRecord('2024-01-01 to 2024-01-02');
        addResult('Simple service delete: SUCCESS');
        
      } catch (error) {
        addResult(`Simple service error: ${error}`);
      }
      
      addResult('All tests completed');
      
    } catch (error) {
      addResult(`Test error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
      <h3>Dexie Debug Test</h3>
      <button 
        onClick={runTests} 
        disabled={isRunning}
        style={{ marginBottom: '10px' }}
      >
        {isRunning ? 'Running Tests...' : 'Run Dexie Tests'}
      </button>
      
      <div style={{ 
        maxHeight: '300px', 
        overflowY: 'auto', 
        border: '1px solid #eee', 
        padding: '10px',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        {testResults.length === 0 ? (
          <div>No test results yet. Click "Run Dexie Tests" to start.</div>
        ) : (
          testResults.map((result, index) => (
            <div key={index} style={{ marginBottom: '2px' }}>
              {result}
            </div>
          ))
        )}
      </div>
    </div>
  );
}; 