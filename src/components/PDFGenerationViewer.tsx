import React from 'react';
import PDFPreviewViewer from './PDFPreviewViewer';
import '../styles/components/desktop/PDFGenerationViewer.css';
import '../styles/components/mobile/PDFGenerationViewer.css';

interface PDFGenerationViewerProps {
  pdfId: string;
  onClose?: () => void;
  onClearDrawing?: () => void;
  onSaveWithSignature?: () => void;
}

const PDFGenerationViewer: React.FC<PDFGenerationViewerProps> = ({
  pdfId,
  onClose,
  onClearDrawing,
  onSaveWithSignature
}) => {
  return (
    <div className="pdf-generation-viewer">
      <PDFPreviewViewer
        pdfId={pdfId}
        onLoad={onClose}
        className="pdf-viewer"
        onClearDrawing={onClearDrawing}
        onSaveWithSignature={onSaveWithSignature}
      />
    </div>
  );
};

export default PDFGenerationViewer; 