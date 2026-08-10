import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RotateCcw, PenTool, Maximize2, Minimize2, Check, X } from 'lucide-react';

interface SignatureCanvasProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  error?: string;
}

export default function SignatureCanvas({
  value,
  onChange,
  label = 'Customer Signature',
  error,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Setup inline canvas with white background & black stroke
  const setupCanvas = useCallback((targetCanvas: HTMLCanvasElement | null, currentVal: string | null) => {
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const rect = targetCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    targetCanvas.width = rect.width * dpr;
    targetCanvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);

    // Clear canvas background for transparent signature overlay
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000'; // Black stroke signature

    // If an existing signature image exists, draw it onto the white canvas
    if (currentVal && currentVal.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.src = currentVal;
    }
  }, []);

  useEffect(() => {
    setupCanvas(canvasRef.current, value || null);
    const handleResize = () => setupCanvas(canvasRef.current, value || null);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas, value]);

  useEffect(() => {
    if (isFullscreen) {
      setTimeout(() => {
        setupCanvas(fullscreenCanvasRef.current, value || null);
      }, 50);
    }
  }, [isFullscreen, setupCanvas, value]);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    targetCanvas: HTMLCanvasElement
  ) => {
    const rect = targetCanvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    isFs: boolean
  ) => {
    setIsDrawing(true);
    const canvas = isFs ? fullscreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    isFs: boolean
  ) => {
    if (!isDrawing) return;
    const canvas = isFs ? fullscreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = (isFs: boolean) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = isFs ? fullscreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;

    if (hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const handleClear = (isFs: boolean = false) => {
    const canvas = isFs ? fullscreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    setHasSignature(false);
    onChange(null);
  };

  return (
    <div className="space-y-2 font-sans">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono uppercase tracking-widest text-gray-300 font-bold flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-brand-orange" />
          {label} <span className="text-brand-orange">*</span>
        </label>

        <div className="flex items-center gap-3">
          {hasSignature && (
            <button
              type="button"
              onClick={() => handleClear(false)}
              className="text-xs text-gray-400 hover:text-brand-orange flex items-center gap-1 font-mono uppercase transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="text-xs text-brand-orange hover:text-orange-400 bg-brand-orange/10 border border-brand-orange/30 px-2.5 py-1 rounded-lg flex items-center gap-1 font-mono font-bold uppercase transition-all cursor-pointer shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Fullscreen Mode
          </button>
        </div>
      </div>

      {/* Inline White Signature Pad Canvas */}
      <div
        className={`relative bg-white border-2 rounded-xl overflow-hidden transition-all touch-none shadow-xl ${
          error ? 'border-red-500 ring-2 ring-red-500/30' : 'border-gray-300 hover:border-brand-orange'
        }`}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={(e) => startDrawing(e, false)}
          onMouseMove={(e) => draw(e, false)}
          onMouseUp={() => stopDrawing(false)}
          onMouseLeave={() => stopDrawing(false)}
          onTouchStart={(e) => startDrawing(e, false)}
          onTouchMove={(e) => draw(e, false)}
          onTouchEnd={() => stopDrawing(false)}
          className="w-full h-44 cursor-crosshair block"
        />

        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400 font-medium">
              Sign here with finger / stylus (White Pad &bull; Black Ink)
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400 font-mono mt-1">{error}</p>}

      {/* FULLSCREEN SIGNATURE MODAL */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg p-4 sm:p-6 flex flex-col justify-between no-print animate-in fade-in">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
                FULLSCREEN SIGNATURE PAD
              </span>
              <h3 className="text-lg font-display font-black text-white uppercase tracking-tight">
                {label}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleClear(true)}
                className="px-3 py-1.5 bg-brand-darker border border-gray-800 hover:border-gray-600 text-gray-300 hover:text-white text-xs font-mono font-bold uppercase rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-brand-orange" /> Clear Pad
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-2 bg-brand-darker border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Fullscreen White Signature Canvas */}
          <div className="my-4 flex-1 bg-white border-4 border-brand-orange/60 rounded-2xl overflow-hidden relative shadow-2xl touch-none">
            <canvas
              ref={fullscreenCanvasRef}
              onMouseDown={(e) => startDrawing(e, true)}
              onMouseMove={(e) => draw(e, true)}
              onMouseUp={() => stopDrawing(true)}
              onMouseLeave={() => stopDrawing(true)}
              onTouchStart={(e) => startDrawing(e, true)}
              onTouchMove={(e) => draw(e, true)}
              onTouchEnd={() => stopDrawing(true)}
              className="w-full h-full cursor-crosshair block"
            />

            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <span className="text-sm font-mono uppercase tracking-widest text-gray-400 font-bold bg-white/90 px-4 py-2 rounded-xl shadow-md border border-gray-200">
                  Sign cleanly on this full-screen canvas
                </span>
              </div>
            )}
          </div>

          {/* Fullscreen Footer Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="px-5 py-3 bg-brand-darker border border-gray-800 hover:border-gray-700 text-gray-300 text-xs font-mono font-bold uppercase rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <Minimize2 className="w-4 h-4 text-brand-orange" /> Exit Fullscreen
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="px-8 py-3.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-mono font-bold uppercase tracking-widest rounded-xl transition-all shadow-xl flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Save &amp; Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
