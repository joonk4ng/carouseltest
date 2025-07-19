import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getPDF } from '../utils/pdfStorage';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PDFViewerProps {
  pdfId: string;
  onLoad?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfId, onLoad, className, style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const pageNumRef = useRef<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPDF = async () => {
      if (!pdfId || !canvasRef.current) {
        console.log('Missing requirements:', { 
          hasPdfId: !!pdfId, 
          hasCanvas: !!canvasRef.current 
        });
        return;
      }

      try {
        console.log('Retrieving PDF from IndexedDB:', pdfId);
        const pdfData = await getPDF(pdfId);
        
        if (!pdfData) {
          throw new Error('PDF not found in storage');
        }

        console.log('Starting PDF load process');
        // Get the PDF blob from the stored data
        const pdfBlob = pdfData.pdf;
        
        // Convert blob to array buffer
        const arrayBuffer = await pdfBlob.arrayBuffer();
        console.log('Converted blob to array buffer', { 
          bufferSize: arrayBuffer.byteLength 
        });
        
        // Load the PDF document
        console.log('Creating PDF loading task');
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        console.log('Waiting for PDF document to load');
        const pdfDoc = await loadingTask.promise;
        
        if (!isMounted) {
          console.log('Component unmounted during load');
          pdfDoc.destroy();
          return;
        }

        console.log('PDF document loaded successfully', { 
          numPages: pdfDoc.numPages 
        });
        pdfDocRef.current = pdfDoc;

        // Load and render the first page
        console.log('Loading first page');
        const page = await pdfDoc.getPage(pageNumRef.current);
        console.log('Rendering page');
        await renderPage(page);
        console.log('Page rendered successfully');

        if (onLoad) {
          onLoad();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        console.error('Detailed PDF loading error:', {
          error,
          errorMessage,
          errorStack,
          pdfVersion: pdfjsLib.version,
          workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc
        });
        setError(errorMessage);
      }
    };

    const renderPage = async (page: any) => {
      if (!canvasRef.current || !containerRef.current) return;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Get container dimensions
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Get PDF page dimensions
      const viewport = page.getViewport({ scale: 1 });
      
      // Calculate scale to fit width
      const scaleWidth = containerWidth / viewport.width;
      const scaleHeight = containerHeight / viewport.height;
      const scale = Math.min(scaleWidth, scaleHeight);

      // Update viewport with new scale
      const scaledViewport = page.getViewport({ scale });

      // Set high DPI scaling if needed
      const outputScale = window.devicePixelRatio || 1;
      canvas.style.width = Math.floor(scaledViewport.width) + 'px';
      canvas.style.height = Math.floor(scaledViewport.height) + 'px';
      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);

      // Scale context for high DPI display
      context.scale(outputScale, outputScale);

      // Render PDF page
      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;
    };

    loadPDF();

    // Handle window resize
    const handleResize = () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.getPage(pageNumRef.current).then(renderPage);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfId, onLoad]);

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        ...style 
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

export default PDFViewer; 