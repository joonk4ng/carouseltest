import React, { useState } from 'react';
import PDFPreviewViewer from './PDFPreviewViewer';
import SignaturePage from './SignaturePage';
import '../styles/components/desktop/PDFGenerationViewer.css';
import '../styles/components/mobile/PDFGenerationViewer.css';

// Defines properties for the PDFGenerationViewer component
interface PDFGenerationViewerProps {
  pdfId: string;
  onClose?: () => void;
  onClearDrawing?: () => void;
  onSaveWithSignature?: (signatureData: string) => void;
}

// Defines the PDFGenerationViewer component
const PDFGenerationViewer: React.FC<PDFGenerationViewerProps> = ({
  pdfId,
  onClose,
  onClearDrawing,
  onSaveWithSignature
}) => {
  const [showSignaturePage, setShowSignaturePage] = useState(false);

  const handleSaveSignature = (signatureData: string) => {
    if (onSaveWithSignature) {
      onSaveWithSignature(signatureData);
    }
    setShowSignaturePage(false);
  };

  const handleCancelSignature = () => {
    setShowSignaturePage(false);
  };

  return (
    <>
      <div className="pdf-generation-viewer">
        <PDFPreviewViewer
          pdfId={pdfId}
          onLoad={onClose}
          className="pdf-viewer"
          onClearDrawing={onClearDrawing}
          onSaveWithSignature={() => setShowSignaturePage(true)}
        />
      </div>
      {showSignaturePage && (
        <SignaturePage
          onSave={handleSaveSignature}
          onCancel={handleCancelSignature}
        />
      )}
    </>
  );
};

export default PDFGenerationViewer; 