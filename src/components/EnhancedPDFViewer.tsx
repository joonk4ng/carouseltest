// React component for the enhanced PDF viewer with signature integration and PDF flattening
// 
// Features:
// - Loads and displays PDF documents
// - Allows users to draw signatures on a transparent overlay
// - Flattens the entire PDF (including signature) into a single image layer
// - Prevents modification of signatures and form fields after saving
// - Creates a new PDF with flattened content for secure document storage
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getPDF } from '../utils/pdfStorage';
import '../styles/EnhancedPDFViewer.css';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateExportFilename } from '../utils/filenameGenerator';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
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
  // Callback function called before signing (for sneaky save)
  onBeforeSign?: () => Promise<void>;
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
  onBeforeSign,
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
  const [isSigned, setIsSigned] = useState(false);
  const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // Detect Chrome on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isChrome = /Chrome/.test(navigator.userAgent);
  const isChromeIOS = isIOS && isChrome;

  // Helper function to flatten PDF content to image
  const flattenPDFToImage = useCallback(async (pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<Blob> => {
    if (!canvasRef.current) {
      throw new Error('Canvas not available for flattening');
    }

    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 3.0 }); // Higher scale for better quality
    
    // Create a temporary canvas for flattening
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) {
      throw new Error('Could not get canvas context for flattening');
    }

    // Fill with white background
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Render PDF page to the temporary canvas
    await page.render({
      canvasContext: tempCtx,
      viewport: viewport
    }).promise;

    // Convert canvas to blob with high quality
    return new Promise<Blob>((resolve, reject) => {
      tempCanvas.toBlob((blob) => {
        if (blob) {
          console.log('🔍 EnhancedPDFViewer: PDF flattened to image, size:', blob.size, 'bytes');
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png', 1.0);
    });
  }, []);

  // Helper function to create flattened PDF from images
  const createFlattenedPDF = useCallback(async (
    pdfImageBlob: Blob, 
    signatureImageBlob: Blob | null
  ): Promise<Uint8Array> => {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Convert image blobs to Uint8Array
    const pdfImageBytes = new Uint8Array(await pdfImageBlob.arrayBuffer());
    const pdfImage = await pdfDoc.embedPng(pdfImageBytes);
    
    // Create a page with the same dimensions as the PDF image
    const page = pdfDoc.addPage([pdfImage.width, pdfImage.height]);
    
    // Draw the flattened PDF image
    page.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width: pdfImage.width,
      height: pdfImage.height,
    });

    // If there's a signature, overlay it
    if (signatureImageBlob) {
      const signatureImageBytes = new Uint8Array(await signatureImageBlob.arrayBuffer());
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
      
      // Scale signature to match page dimensions
      page.drawImage(signatureImage, {
        x: 0,
        y: 0,
        width: pdfImage.width,
        height: pdfImage.height,
      });
    }

    // Save the flattened PDF
    return await pdfDoc.save();
  }, []);

  // Log platform info for debugging
  useEffect(() => {
    console.log('🔍 EnhancedPDFViewer: Platform Info:', {
      isIOS,
      isChrome,
      isChromeIOS,
      userAgent: navigator.userAgent
    });
    
    if (isChromeIOS) {
      console.log('🔍 EnhancedPDFViewer: Chrome on iOS detected - applying special handling');
    }
  }, [isIOS, isChrome, isChromeIOS]);

  // PDF rendering
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

    // Add touch event listeners with passive: false
    container.addEventListener('touchstart', preventDefault, options);
    container.addEventListener('touchmove', preventDefault, options);
    container.addEventListener('touchend', preventDefault, options);

    return () => {
      container.removeEventListener('touchstart', preventDefault);
      container.removeEventListener('touchmove', preventDefault);
      container.removeEventListener('touchend', preventDefault);
    };
  }, [isDrawingMode]);

  // get the touch position for the draw canvas
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

  // starts the drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawCanvasRef.current || !isDrawingMode) return;
    
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

  // draws the signature
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawCanvasRef.current || !lastPosRef.current || !isDrawingMode) return;
    
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

    // get the context for the draw canvas
    const ctx = drawCanvasRef.current.getContext('2d');
    if (!ctx) return;

    // begin the path
    ctx.beginPath();
    ctx.strokeStyle = '#000000'; // Default black color
    ctx.lineWidth = 2; // Default line width
    ctx.lineCap = 'round';
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

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
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Handles the saving of the PDF with the signature (flattened)
  const handleSave = async () => {
    setIsDrawingMode(false);
    if (!canvasRef.current || !drawCanvasRef.current || !onSave || !pdfDocRef.current) return;

    try {
      console.log('🔍 EnhancedPDFViewer: Starting PDF flattening process...');

      // Get both canvases
      const baseCanvas = canvasRef.current;
      const drawCanvas = drawCanvasRef.current;

      // Create a temporary canvas to combine both layers for preview
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

      // Check if there's a signature to flatten by checking if the canvas has any non-transparent pixels
      const drawCtx = drawCanvas.getContext('2d');
      let hasSignature = false;
      let signatureImageBlob: Blob | null = null;

      if (drawCtx) {
        try {
          const imageData = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
          const data = imageData.data;
          
          // Check if there are any non-transparent pixels (alpha > 0)
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) {
              hasSignature = true;
              break;
            }
          }
        } catch (e) {
          console.log('🔍 EnhancedPDFViewer: Error checking signature pixels, assuming no signature:', e);
          hasSignature = false;
        }
      }

      if (hasSignature) {
        // Get the signature canvas content as a PNG
        signatureImageBlob = await new Promise<Blob>((resolve) => {
          drawCanvas.toBlob((blob) => {
            resolve(blob!);
          }, 'image/png');
        });
        console.log('🔍 EnhancedPDFViewer: Signature detected, will be flattened');
      } else {
        console.log('🔍 EnhancedPDFViewer: No signature detected, flattening PDF only');
      }

      // Flatten the PDF to an image
      console.log('🔍 EnhancedPDFViewer: Flattening PDF content to image...');
      const flattenedPdfImage = await flattenPDFToImage(pdfDocRef.current);

      // Create the flattened PDF
      console.log('🔍 EnhancedPDFViewer: Creating flattened PDF...');
      const flattenedPdfBytes = await createFlattenedPDF(flattenedPdfImage, signatureImageBlob);
      const flattenedPdfBlob = new Blob([flattenedPdfBytes], { type: 'application/pdf' });
      
      console.log('🔍 EnhancedPDFViewer: Flattened PDF created successfully');
      console.log('🔍 EnhancedPDFViewer: Flattened PDF bytes length:', flattenedPdfBytes.length);
      console.log('🔍 EnhancedPDFViewer: Flattened PDF blob size:', flattenedPdfBlob.size, 'bytes');

      // Set the signed state and store the flattened PDF blob
      setIsSigned(true);
      setSignedPdfBlob(flattenedPdfBlob);
      
      // Save the flattened PDF
      onSave(flattenedPdfBlob, previewImage);

      // Create a URL for the flattened PDF blob and trigger download
      const url = URL.createObjectURL(flattenedPdfBlob);
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
        link.download = 'signed_document_flattened.pdf';
      }
      
      console.log('🔍 EnhancedPDFViewer: Downloading flattened PDF with filename:', link.download);
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error saving flattened PDF:', err);
      setError('Failed to save flattened PDF with signature.');
    }
  };

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

  const toggleDrawingMode = async () => {
    // If we're about to enable drawing mode and there's a sneaky save callback, call it
    if (!isDrawingMode && onBeforeSign) {
      try {
        await onBeforeSign();
      } catch (error) {
        console.error('Error during sneaky save before signing:', error);
        // Continue with signing even if sneaky save fails
      }
    }
    
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
    <div className={`enhanced-pdf-viewer ${className || ''}`} style={style} ref={containerRef}>
      <div className="canvas-container">
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
                className={`draw-btn ${isDrawingMode ? 'active' : ''}`}
                title="Sign"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
                Sign
              </button>
              <button onClick={handleSave} className="save-btn" title="Save Flattened PDF">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                </svg>
                Save
              </button>
              <button onClick={clearDrawing} className="clear-btn" title="Undo">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                </svg>
                Undo
              </button>
            </div>
          </>
        )}
      </div>


    </div>
  );
};

export default EnhancedPDFViewer; 