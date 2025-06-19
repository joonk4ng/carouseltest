// Handles the preview of the PDF with the signature
import React, { useEffect, useState } from 'react';
import { getPDF } from '../utils/pdfStorage';
import '../styles/components/desktop/PDFPreviewViewer.css';
import '../styles/components/mobile/PDFPreviewViewer.css';

// Defines properties for the PDFPreviewViewer component
interface PDFPreviewViewerProps {
  pdfId: string;
  onLoad?: () => void;
  className?: string;
  style?: React.CSSProperties;
  onClearDrawing?: () => void;
  onSaveWithSignature?: () => void;
}

// Defines the PDFPreviewViewer component
const PDFPreviewViewer: React.FC<PDFPreviewViewerProps> = ({ 
  pdfId, 
  onLoad, 
  className, 
  style,
  onClearDrawing,
  onSaveWithSignature 
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      if (!pdfId) {
        console.log('No PDF ID provided');
        return;
      }

      try {
        console.log('Retrieving PDF data from IndexedDB:', pdfId);
        const pdfData = await getPDF(pdfId);
        
        if (!pdfData) {
          throw new Error('PDF not found in storage');
        }

        if (!pdfData.preview) {
          throw new Error('No preview available for this PDF');
        }

        // Create a URL for the preview blob
        const url = URL.createObjectURL(pdfData.preview);
        
        if (isMounted) {
          setPreviewUrl(url);
          setLoading(false);
          if (onLoad) {
            onLoad();
          }
        }
      } catch (error) {
        console.error('Error loading preview:', error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Failed to load preview');
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
      // Clean up the preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [pdfId, onLoad]);

  // Handles the downloading of the PDF
  const handleDownloadPDF = async () => {
    try {
      const pdfData = await getPDF(pdfId);
      if (!pdfData) {
        throw new Error('PDF not found in storage');
      }

      // Create a URL for the PDF blob
      const url = URL.createObjectURL(pdfData.pdf);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfData.metadata.filename || 'document.pdf';
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setError(error instanceof Error ? error.message : 'Failed to download PDF');
    }
  };

  // Handles the printing of the PDF
  const handlePrint = async () => {
    try {
      const pdfData = await getPDF(pdfId);
      if (!pdfData) {
        throw new Error('PDF not found in storage');
      }

      // Create a URL for the PDF blob
      const url = URL.createObjectURL(pdfData.pdf);
      
      // Create a temporary iframe for printing
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      
      document.body.appendChild(printFrame);

      // Set the iframe source to the PDF URL
      printFrame.src = url;

      // Wait for the PDF to load in the iframe
      printFrame.onload = () => {
        try {
          // Try to print
          printFrame.contentWindow?.print();
          
          // Remove the iframe after printing
          setTimeout(() => {
            document.body.removeChild(printFrame);
            URL.revokeObjectURL(url);
          }, 1000);
        } catch (err) {
          console.error('Error during print:', err);
          document.body.removeChild(printFrame);
          URL.revokeObjectURL(url);
          setError('Failed to print PDF');
        }
      };
    } catch (error) {
      console.error('Error preparing PDF for print:', error);
      setError(error instanceof Error ? error.message : 'Failed to prepare PDF for printing');
    }
  };

  // Handles the selection of the action
  const handleActionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const action = event.target.value;
    switch (action) {
      case 'clear':
        onClearDrawing?.();
        break;
      case 'save':
        onSaveWithSignature?.();
        break;
      case 'download':
        handleDownloadPDF();
        break;
      case 'print':
        handlePrint();
        break;
    }
    // Reset the select to default option
    event.target.value = 'default';
  };

  if (loading) {
    return <div>Loading preview...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className={`pdf-preview-viewer ${className || ''}`}>
      {previewUrl && (
        <>
          <img src={previewUrl} alt="PDF Preview" />
          <div className="pdf-preview-actions">
            <select 
              className="action-select"
              onChange={handleActionSelect}
              defaultValue="default"
            >
              <option value="default" disabled>Select an action...</option>
              {onClearDrawing && <option value="clear">Clear Drawing</option>}
              {onSaveWithSignature && <option value="save">Save with Signature</option>}
              <option value="download">Download PDF</option>
              <option value="print">Print PDF</option>
            </select>
            <div className="button-bar">
              {onClearDrawing && (
                <button 
                  onClick={onClearDrawing}
                  className="clear-drawing-button"
                >
                  Clear Drawing
                </button>
              )}
              {onSaveWithSignature && (
                <button 
                  onClick={onSaveWithSignature}
                  className="save-signature-button"
                >
                  Save with Signature
                </button>
              )}
              <button 
                onClick={handleDownloadPDF}
                className="download-pdf-button"
              >
                Download PDF
              </button>
              <button 
                onClick={handlePrint}
                className="print-pdf-button"
              >
                Print PDF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PDFPreviewViewer; 