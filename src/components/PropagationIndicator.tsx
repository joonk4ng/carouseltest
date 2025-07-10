import React from 'react';
import '../styles/PropagationIndicator.css';

interface PropagationIndicatorProps {
  isVisible: boolean;
  message: string;
}

export const PropagationIndicator: React.FC<PropagationIndicatorProps> = ({ isVisible, message }) => {
  if (!isVisible) return null;

  return (
    <div className="propagation-indicator">
      <div className="propagation-content">
        <div className="propagation-spinner"></div>
        <span>{message}</span>
      </div>
    </div>
  );
}; 