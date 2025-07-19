// React component for the enhanced PDF viewer with signature integration
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getPDF } from '../utils/pdfStorage';
import '../styles/EnhancedPDFViewer.css';
import { PDFDocument } from 'pdf-lib';
import { generateExportFilename } from '../utils/filenameGenerator';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
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
  const [zoomLevel, setZoomLevel] = useState(1);

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
      
      // retrieves the draw canvas
      const drawCanvas = drawCanvasRef.current;
      // retrieves the drawing context
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
        
        // For signing purposes, we want the PDF to be as large as possible
        // Calculate scales for both width and height
        const scaleWidth = containerWidth / viewport.width;
        const scaleHeight = containerHeight / viewport.height;
        
        // Use the larger scale to maximize PDF size for better signing experience
        // But ensure it doesn't exceed container bounds and cap at 200% for usability
        const scale = Math.min(Math.max(scaleWidth, scaleHeight), 2.0);
        
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
    // return error messages
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Failed to render page. Please try again.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add touch event listeners with passive: false
    const options = { passive: false };
    
    const preventDefault = (e: TouchEvent) => {
      // Only prevent default if we're drawing on the canvas
      if (isDrawingMode && e.target === drawCanvasRef.current) {
        e.preventDefault();
      }
    };

    // add event listeners for the touch events
    container.addEventListener('touchstart', preventDefault, options);
    container.addEventListener('touchmove', preventDefault, options);
    container.addEventListener('touchend', preventDefault, options);

    // return a function to clean up the event listeners
    return () => {
      container.removeEventListener('touchstart', preventDefault);
      container.removeEventListener('touchmove', preventDefault);
      container.removeEventListener('touchend', preventDefault);
    };
  }, [isDrawingMode]);

  // Detect zoom level changes
  useEffect(() => {
    const updateZoomLevel = () => {
      const zoom = window.visualViewport?.scale || 1;
      setZoomLevel(zoom);
    };

    // Initial zoom level
    updateZoomLevel();

    // Listen for zoom changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateZoomLevel);
      window.visualViewport.addEventListener('scroll', updateZoomLevel);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateZoomLevel);
        window.visualViewport.removeEventListener('scroll', updateZoomLevel);
      }
    };
  }, []);

  // function to get the touch position
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // if the draw canvas is not ready, return 0,0
    if (!drawCanvasRef.current) return { x: 0, y: 0 };
    // retrieves the touch
    const touch = e.touches[0];
    // retrieves the bounding client rect
    const rect = drawCanvasRef.current.getBoundingClientRect();
    // retrieves the scale
    const scaleX = drawCanvasRef.current.width / rect.width;
    // retrieves the scale
    const scaleY = drawCanvasRef.current.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  };

  // starts the drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawCanvasRef.current || !isDrawingMode) return;
    
    // retrieves the position
    let pos;
    // if the event is a touch event, get the touch position
    if ('touches' in e) {
      // get the touch position
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

  // draws the signature
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawCanvasRef.current || !lastPosRef.current || !isDrawingMode) return;
    
    // retrieves the current position
    let currentPos;
    // if the event is a touch event, get the touch position
    if ('touches' in e) {
      currentPos = getTouchPos(e as React.TouchEvent<HTMLCanvasElement>);
    } else {
      // if the event is a mouse event, get the mouse position
      const rect = drawCanvasRef.current.getBoundingClientRect();
      const scaleX = drawCanvasRef.current.width / rect.width;
      const scaleY = drawCanvasRef.current.height / rect.height;
      currentPos = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    // retrieves the context
    const ctx = drawCanvasRef.current.getContext('2d');
    if (!ctx) return;

    // begins the path
    ctx.beginPath();
    // sets the stroke style
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawWidth;
    ctx.lineCap = 'round';
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    // updates the last position
    lastPosRef.current = currentPos;
  };

  // stops the drawing
  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  // clears the drawing
  const clearDrawing = () => {
    setIsDrawingMode(false);
    // retrieves the canvas
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    // retrieves the context
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // clears the drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // function to handle the saving of the PDF with the signature
  const handleSave = async () => {
    // sets the drawing mode to false
    setIsDrawingMode(false);
    // if the canvas is not ready, return
    if (!canvasRef.current || !drawCanvasRef.current || !onSave || !pdfDocRef.current) return;

    try {
      // retrieves both canvases
      const baseCanvas = canvasRef.current;
      const drawCanvas = drawCanvasRef.current;

      // Create a temporary canvas to combine both layers
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = baseCanvas.width;
      tempCanvas.height = baseCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      // if the context is not ready, return
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
      
      // Save the PDF
      onSave(modifiedPdfBlob, previewImage);

      // Create a URL for the PDF blob and trigger download
      const url = URL.createObjectURL(modifiedPdfBlob);
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
      console.error('Error saving PDF:', err);
      setError('Failed to save PDF with annotations.');
    }
  };

  // function to handle the downloading of the PDF (unused)
  const handleDownload = async () => {
    setIsDrawingMode(false);
    if (!pdfDocRef.current) return;

    try {
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

  // function to handle the printing of the PDF (unused)
  const handlePrint = async () => {
    setIsDrawingMode(false);
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
  };

  // function to activate the drawing mode when the button is clicked
  const toggleDrawingMode = () => {
    setIsDrawingMode(prev => !prev);
    // Clear any existing drawing when toggling mode
    if (drawCanvasRef.current) {
      const ctx = drawCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
      }
    }
    // Reset drawing state
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  // use effect to load the PDF
  useEffect(() => {
    let mounted = true;
    let currentPdf: pdfjsLib.PDFDocumentProxy | null = null;

    // function to load the PDF
    const loadPDF = async () => {
      if (!pdfId) return;

      try {
        // sets the loading state to true
        setIsLoading(true);
        // sets the error to null
        setError(null);
        
        // retrieves the stored PDF
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
        
        // loads the PDF
        const pdf = await loadingTask.promise;
        
        // if the PDF is not mounted, destroy the PDF and return
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
    <div className={`enhanced-pdf-viewer ${className || ''}`} style={style} ref={containerRef}>
      <div 
        className="canvas-container"
        style={{ 
          width: '100%', 
          height: '100%', 
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center', // Center for better vertical centering
          padding: '20px', // Add padding to prevent PDF from touching edges
          position: 'relative'
        }}
      >
        {error && <div className="error-message">{error}</div>}
        {isLoading && <div className="loading">Loading PDF...</div>}
        <canvas 
          ref={canvasRef} 
          className="pdf-canvas"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
        />
        {!readOnly && (
          <canvas
            ref={drawCanvasRef}
            className="draw-canvas"
            style={{ 
              pointerEvents: isDrawingMode ? 'auto' : 'none',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        )}
      </div>
      
      {/* Move toolbar outside canvas container to avoid zoom issues */}
      {!readOnly && (
        <div 
          className="toolbar fixed-toolbar"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'bottom center',
            height: `${60 / zoomLevel}px`,
            minHeight: `${50 / zoomLevel}px`
          }}
        >
          <button
            onClick={toggleDrawingMode}
            className={`draw-btn ${isDrawingMode ? 'active' : ''}`}
            title="Sign"
            style={{
              fontSize: `${18 / zoomLevel}px`,
              minHeight: `${60 / zoomLevel}px`
            }}
          >
            <svg viewBox="0 0 24 24" width={`${24 / zoomLevel}`} height={`${24 / zoomLevel}`}>
              <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Sign
          </button>
          <button 
            onClick={handleSave} 
            className="save-btn" 
            title="Finished"
            style={{
              fontSize: `${18 / zoomLevel}px`,
              minHeight: `${60 / zoomLevel}px`
            }}
          >
            <svg viewBox="0 0 24 24" width={`${24 / zoomLevel}`} height={`${24 / zoomLevel}`}>
              <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
            </svg>
            Finished
          </button>
          <button 
            onClick={clearDrawing} 
            className="clear-btn" 
            title="Undo"
            style={{
              fontSize: `${18 / zoomLevel}px`,
              minHeight: `${60 / zoomLevel}px`
            }}
          >
            <svg viewBox="0 0 24 24" width={`${24 / zoomLevel}`} height={`${24 / zoomLevel}`}>
              <path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
            </svg>
            Undo
          </button>
        </div>
      )}
    </div>
  );
};

export default EnhancedPDFViewer; 