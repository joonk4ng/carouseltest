// React component for the enhanced PDF viewer
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getPDF } from '../utils/pdfStorage';
import '../styles/EnhancedPDFViewer.css';
import { PDFDocument } from 'pdf-lib';
import { generateExportFilename } from '../utils/filenameGenerator';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Set the PDF.js worker source to the local file in public directory with version
  const workerVersion = '5.2.133'; // Match this with your pdfjs-dist version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdfjskit/pdfjs/build/pdf.worker.mjs?v=${workerVersion}`;
}

// Configure PDF.js options for small PDFs
const pdfOptions = {
  disableAutoFetch: true,     // Disable fetching of external resources for small PDFs
  disableStream: true,        // Disable streaming for small PDFs
  disableFontFace: false,     // Allow using system fonts
  useSystemFonts: true,       // Prefer system fonts when available
  enableXfa: true,            // Enable XFA form support
  isEvalSupported: false,     // Disable eval for security
  maxImageSize: 4096 * 4096,  // Set maximum image size
  cMapUrl: undefined,         // Don't try to load external character maps
  standardFontDataUrl: undefined  // Don't try to load external fonts
};

// Defines properties for the EnhancedPDFViewer component
interface EnhancedPDFViewerProps {
  // PDF ID - unique identifier for the PDF
  pdfId?: string;
  // Callback function for saving the PDF
  onSave?: (pdfData: Blob, previewImage: Blob) => void;
  // Class name for the component
  className?: string;
  // Style for the component
  style?: React.CSSProperties;
  // Read only state - whether the component is read only
  readOnly?: boolean;
  crewInfo?: {
    crewNumber: string;
    fireName: string;
    fireNumber: string;
  };
  date?: string;
}

const EnhancedPDFViewer: React.FC<EnhancedPDFViewerProps> = ({
  pdfId,
  onSave,
  className,
  style,
  readOnly = false,
  crewInfo,
  date
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#000000');
  const [drawWidth, setDrawWidth] = useState(2);
  const [isSigned, setIsSigned] = useState(false);
  const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  const renderPDF = useCallback(async (pdfDoc: pdfjsLib.PDFDocumentProxy) => {
    if (!canvasRef.current || !drawCanvasRef.current) return;

    try {
      setIsLoading(true);
      const page = await pdfDoc.getPage(1); // Always render first page
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', {
        alpha: false,  // Optimize for non-transparent content
        willReadFrequently: false  // Optimize for write-only operations
      });
      
      const drawCanvas = drawCanvasRef.current;
      const drawContext = drawCanvas.getContext('2d', {
        alpha: true,
        willReadFrequently: true  // Drawing needs read operations
      });

      if (!context || !drawContext) return;

      // Get the PDF's original dimensions
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Calculate optimal scale based on container size
      const container = containerRef.current;
      if (container) {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const scale = Math.min(
          containerWidth / viewport.width,
          containerHeight / viewport.height
        );
        viewport.scale = scale;
      }
      
      // Set canvas sizes to match viewport
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      drawCanvas.height = viewport.height;
      drawCanvas.width = viewport.width;

      // Clear both canvases
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

      // Render PDF page with optimized settings
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      setIsLoading(false);
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Failed to render page. Please try again.');
      setIsLoading(false);
    }
  }, []);

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawCanvasRef.current) return { x: 0, y: 0 };
    const touch = e.touches[0];
    const rect = drawCanvasRef.current.getBoundingClientRect();
    const scaleX = drawCanvasRef.current.width / rect.width;
    const scaleY = drawCanvasRef.current.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawCanvasRef.current) return;
    e.preventDefault();
    let pos;
    if ('touches' in e) {
      pos = getTouchPos(e as React.TouchEvent<HTMLCanvasElement>);
    } else {
      const rect = drawCanvasRef.current.getBoundingClientRect();
      const scaleX = drawCanvasRef.current.width / rect.width;
      const scaleY = drawCanvasRef.current.height / rect.height;
      pos = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
    lastPosRef.current = pos;
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawCanvasRef.current || !lastPosRef.current) return;
    e.preventDefault();
    let currentPos;
    if ('touches' in e) {
      currentPos = getTouchPos(e as React.TouchEvent<HTMLCanvasElement>);
    } else {
      const rect = drawCanvasRef.current.getBoundingClientRect();
      const scaleX = drawCanvasRef.current.width / rect.width;
      const scaleY = drawCanvasRef.current.height / rect.height;
      currentPos = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    const ctx = drawCanvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawWidth;
    ctx.lineCap = 'round';
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    lastPosRef.current = currentPos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const clearDrawing = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = async () => {
    if (!canvasRef.current || !drawCanvasRef.current || !onSave || !pdfDocRef.current) return;

    try {
      // Get both canvases
      const baseCanvas = canvasRef.current;
      const drawCanvas = drawCanvasRef.current;

      // Create a temporary canvas to combine both layers
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = baseCanvas.width;
      tempCanvas.height = baseCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) return;

      // Draw the base PDF
      tempCtx.drawImage(baseCanvas, 0, 0);
      // Draw the annotations on top
      tempCtx.drawImage(drawCanvas, 0, 0);

      // Get the combined preview as PNG
      const previewImage = await new Promise<Blob>((resolve) => {
        tempCanvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/png');
      });

      // Get the drawing canvas content as a PNG for annotations
      const annotationImage = await new Promise<Blob>((resolve) => {
        drawCanvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/png');
      });

      // Convert the original PDF to Uint8Array
      const pdfBytes = await pdfDocRef.current.getData();
      
      // Load the PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // Convert PNG blob to Uint8Array
      const annotationBytes = new Uint8Array(await annotationImage.arrayBuffer());
      
      // Embed the PNG image
      const annotationPngImage = await pdfDoc.embedPng(annotationBytes);
      
      // Get page dimensions
      const { width, height } = firstPage.getSize();
      
      // Draw the annotation image on top of the PDF
      firstPage.drawImage(annotationPngImage, {
        x: 0,
        y: 0,
        width,
        height,
        opacity: 1,
      });

      // Save the PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedPdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      
      // Set the signed state and store the signed PDF blob
      setIsSigned(true);
      setSignedPdfBlob(modifiedPdfBlob);
      
      onSave(modifiedPdfBlob, previewImage);
    } catch (err) {
      console.error('Error saving PDF:', err);
      setError('Failed to save PDF with annotations.');
    }
  };

  const handleDownload = async () => {
    try {
      if (!pdfDocRef.current) return;

      // Get the current PDF data
      const pdfBytes = await pdfDocRef.current.getData();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      // Create a URL for the PDF blob
      const url = URL.createObjectURL(pdfBlob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename using crew info if available
      if (crewInfo && date) {
        link.download = generateExportFilename({
          date,
          crewNumber: crewInfo.crewNumber,
          fireName: crewInfo.fireName,
          fireNumber: crewInfo.fireNumber,
          type: 'PDF'
        });
      } else {
        link.download = 'signed_document.pdf';
      }
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Failed to download PDF.');
    }
  };

  const handlePrint = async () => {
    try {
      if (!pdfDocRef.current) {
        throw new Error('PDF document not loaded');
      }

      if (!canvasRef.current || !containerRef.current) {
        throw new Error('PDF viewer not properly initialized');
      }

      // Create and append print-specific styles
      const style = document.createElement('style');
      style.id = 'pdf-print-style';
      style.textContent = `
        @media print {
          body * {
            visibility: hidden !important;
          }
          .enhanced-pdf-viewer {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          .enhanced-pdf-viewer .toolbar,
          .enhanced-pdf-viewer .draw-canvas {
            display: none !important;
          }
          .enhanced-pdf-viewer .pdf-canvas {
            visibility: visible !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            page-break-after: avoid !important;
          }
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `;
      document.head.appendChild(style);

      // Store current scroll position and zoom
      const container = containerRef.current;
      const originalScroll = {
        top: container.scrollTop,
        left: container.scrollLeft
      };

      try {
        // Ensure the PDF is rendered at optimal print quality
        const page = await pdfDocRef.current.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for print quality
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error('Could not get canvas context');
        }

        // Update canvas dimensions for print
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render at high quality
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        // Print
        window.print();

      } finally {
        // Clean up print styles
        const printStyle = document.getElementById('pdf-print-style');
        if (printStyle) {
          printStyle.remove();
        }

        // Restore original scroll position
        if (container) {
          container.scrollTop = originalScroll.top;
          container.scrollLeft = originalScroll.left;
        }

        // Re-render at normal quality if needed
        renderPDF(pdfDocRef.current);
      }

    } catch (err) {
      console.error('Error printing PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to print PDF.');
    }
  };

  const toggleDrawingMode = () => {
    setIsDrawingMode(!isDrawingMode);
  };

  useEffect(() => {
    let mounted = true;
    let currentPdf: pdfjsLib.PDFDocumentProxy | null = null;

    const loadPDF = async () => {
      if (!pdfId) return;

      try {
        setIsLoading(true);
        setError(null);
        
        const storedPDF = await getPDF(pdfId);
        if (!storedPDF || !mounted) return;

        // Create a buffer for loading
        const arrayBuffer = await storedPDF.pdf.arrayBuffer();
        if (!mounted) return;

        // Create loading task
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          ...pdfOptions
        });
        
        const pdf = await loadingTask.promise;
        
        if (!mounted) {
          pdf.destroy();
          return;
        }

        // Clean up previous PDF document
        if (pdfDocRef.current) {
          pdfDocRef.current.destroy();
        }

        currentPdf = pdf;
        pdfDocRef.current = pdf;

        await renderPDF(pdf);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        if (mounted) {
          setError('Failed to load PDF. Please try again.');
          setIsLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      mounted = false;
      if (currentPdf) {
        currentPdf.destroy();
      }
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfId, renderPDF]);

  return (
    <div className={`enhanced-pdf-viewer ${className || ''}`} style={style}>
      <div className="canvas-container" ref={containerRef}>
        {error && <div className="error-message">{error}</div>}
        {isLoading && <div className="loading">Loading PDF...</div>}
        <canvas ref={canvasRef} className="pdf-canvas" />
        {!readOnly && (
          <>
            <canvas
              ref={drawCanvasRef}
              className="draw-canvas"
              style={{ pointerEvents: isDrawingMode ? 'auto' : 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="toolbar">
              <button 
                onClick={toggleDrawingMode} 
                className={`icon-btn draw-btn ${isDrawingMode ? 'active' : ''}`} 
                title="Draw"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button onClick={clearDrawing} className="icon-btn clear-btn" title="Clear Drawing">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
              <button onClick={handleSave} className="icon-btn save-btn" title="Save with Signature">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                </svg>
              </button>
              <button onClick={handleDownload} className="icon-btn download-btn" title="Download PDF">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
              </button>
              <button onClick={handlePrint} className="icon-btn print-btn" title="Print">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {!readOnly && (
        <div className="drawing-controls">
          <input
            type="color"
            value={drawColor}
            onChange={(e) => setDrawColor(e.target.value)}
            title="Drawing Color"
            className="color-picker"
          />
          <input
            type="range"
            min="1"
            max="10"
            value={drawWidth}
            onChange={(e) => setDrawWidth(Number(e.target.value))}
            title="Drawing Width"
            className="width-slider"
          />
        </div>
      )}
    </div>
  );
};

export default EnhancedPDFViewer; 