import React from 'react';
import MainTable from './components/MainTable';
import { DatabaseInitializer } from './components/DatabaseInitializer';
import './App.css';
import './styles/theme.css';

export default function App() {
  return (
    <div className="App">
      <DatabaseInitializer
        onReady={() => console.log('App ready - database initialized')}
        onError={(error) => console.error('App error - database failed:', error)}
      >
        <MainTable />
      </DatabaseInitializer>
    </div>
  );
} 