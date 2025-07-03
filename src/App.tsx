import React from 'react';
import MainTable from './components/MainTable';
import { DatabaseInitializer } from './components/DatabaseInitializer';

export default function App() {
  return (
    <DatabaseInitializer
      onReady={() => console.log('App ready - database initialized')}
      onError={(error) => console.error('App error - database failed:', error)}
    >
      <MainTable />
    </DatabaseInitializer>
  );
} 