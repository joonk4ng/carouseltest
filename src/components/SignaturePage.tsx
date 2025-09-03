// file for the signature page
import React from 'react';
import { SignatureCanvas } from './SignatureCanvas';
import '../styles/components/SignaturePage.css';

interface SignaturePageProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
}

// signature page component
const SignaturePage: React.FC<SignaturePageProps> = ({ onSave, onCancel }) => {
  // handle save
  const handleSave = (signatureData: string) => {
    console.log('SignaturePage: Saving signature...'); // Debug log
    onSave(signatureData);
  };

  return (
    <div className="signature-page">
      <div className="signature-page-content">
        <h2>Sign Document</h2>
        <div className="signature-page-canvas">
          <SignatureCanvas
            onSave={handleSave}
            onCancel={onCancel}
            showGuideLine={true}
          />
        </div>
      </div>
    </div>
  );
};

export default SignaturePage; 