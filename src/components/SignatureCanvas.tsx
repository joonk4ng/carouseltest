import React, { useRef, useEffect, useState } from 'react';
import '../styles/components/SignatureCanvas.css';

interface Point {
  x: number;
  y: number;
}

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
  showGuideLine?: boolean;
  lineColor?: string;
  lineWidth?: number;
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onSave,
  onCancel,
  showGuideLine = true,
  lineColor = '#000000',
  lineWidth = 2
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);

  // Prevent default touch behavior
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      e.preventDefault();
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', preventDefault, { passive: false });
      container.addEventListener('touchmove', preventDefault, { passive: false });
      container.addEventListener('touchend', preventDefault, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', preventDefault);
        container.removeEventListener('touchmove', preventDefault);
        container.removeEventListener('touchend', preventDefault);
      }
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    // Set canvas size based on container size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Scale context for high DPI display
    context.scale(dpr, dpr);
    
    // Set up context properties
    context.strokeStyle = lineColor;
    context.lineWidth = lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    // Draw guide line
    if (showGuideLine) {
      drawGuideLine(context);
    }
  }, [lineColor, lineWidth, showGuideLine]);

  const drawGuideLine = (context: CanvasRenderingContext2D) => {
    const { width, height } = context.canvas;
    context.beginPath();
    context.moveTo(width * 0.1, height * 0.7);
    context.lineTo(width * 0.9, height * 0.7);
    context.strokeStyle = '#ccc';
    context.lineWidth = 1;
    context.stroke();
  };

  const getTouchCoordinates = (e: TouchEvent): Point => {
    const touch = e.touches[0];
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = 'touches' in e ? getTouchCoordinates(e as unknown as TouchEvent) : {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY
    };
    
    if (contextRef.current) {
      contextRef.current.beginPath();
      contextRef.current.moveTo(point.x, point.y);
      setIsDrawing(true);
      setLastPoint(point);
      setHasSignature(true);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !contextRef.current || !lastPoint) return;

    const point = 'touches' in e ? getTouchCoordinates(e as unknown as TouchEvent) : {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY
    };

    // Draw smooth line
    contextRef.current.beginPath();
    contextRef.current.moveTo(lastPoint.x, lastPoint.y);
    contextRef.current.lineTo(point.x, point.y);
    contextRef.current.stroke();
    setLastPoint(point);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    
    if (!canvas || !context) return;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (showGuideLine) {
      drawGuideLine(context);
    }
    setHasSignature(false);
  };

  const saveSignature = () => {
    if (!canvasRef.current || !hasSignature) return;
    
    // Add metadata to the signature
    const timestamp = new Date().toISOString();
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      context.font = '10px Arial';
      context.fillStyle = '#999999';
      context.fillText(`Signed: ${timestamp}`, 5, canvas.height - 5);
    }
    
    const signatureData = canvas.toDataURL('image/png');
    onSave(signatureData);
  };

  const handleActionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const action = event.target.value;
    switch (action) {
      case 'clear':
        clearCanvas();
        break;
      case 'save':
        saveSignature();
        break;
      case 'cancel':
        onCancel();
        break;
    }
    // Reset the select to default option
    event.target.value = 'default';
  };

  return (
    <>
      <div className="signature-overlay" onTouchMove={e => e.preventDefault()} />
      <div className="signature-canvas-container" ref={containerRef}>
        <div className="signature-canvas-wrapper">
          <canvas
            ref={canvasRef}
            className="signature-canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasSignature && (
            <div className="signature-canvas-placeholder">
              Sign here
            </div>
          )}
          {showGuideLine && <div className="signature-guide-line" />}
        </div>
        <div className="signature-canvas-actions">
          <select 
            className="action-select"
            onChange={handleActionSelect}
            defaultValue="default"
          >
            <option value="default" disabled>Select an action...</option>
            <option value="clear">Clear Drawing</option>
            <option value="save" disabled={!hasSignature}>Save</option>
            <option value="cancel">Cancel</option>
          </select>
          <div className="button-bar">
            <button
              onClick={clearCanvas}
              className="signature-button clear-button"
              type="button"
              disabled={!hasSignature}
            >
              Clear
            </button>
            <button
              onClick={saveSignature}
              className="signature-button save-button"
              type="button"
              disabled={!hasSignature}
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="signature-button cancel-button"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}; 