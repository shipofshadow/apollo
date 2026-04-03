import { useRef, useEffect, useCallback, useState } from 'react';
import { Trash2, X, PenLine } from 'lucide-react'; // Added X and PenLine icons

interface Props {
  value: string;           
  onChange: (data: string) => void;
  isModal?: boolean;       // Toggle modal behavior
}

export default function SignaturePad({ value, onChange, isModal = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const [isOpen, setIsOpen] = useState(false); // Modal state

  // Added isOpen and isModal dependencies so it repopulates when modal mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [value, isOpen, isModal]);

  const getPos = (
    e: MouseEvent | TouchEvent,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.strokeStyle = '#000000'; 
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const stopDrawing = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  }, [onChange]);

  // Added isOpen and isModal to ensure event listeners bind to the dynamic canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown',  startDrawing);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove',  draw,         { passive: false });
    canvas.addEventListener('touchend',   stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown',  startDrawing);
      canvas.removeEventListener('mousemove',  draw);
      canvas.removeEventListener('mouseup',    stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove',  draw);
      canvas.removeEventListener('touchend',   stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing, isOpen, isModal]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  // Reusable core pad UI to avoid duplicating the code block
  const CanvasUI = (
    <>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Signature / Waiver Consent *
        </label>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      <p className="text-xs text-gray-600 mb-2">Use your finger or mouse to draw your signature in the box below.</p>
      
      <div className="relative border border-gray-700 rounded-sm bg-gray-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full h-32 cursor-crosshair touch-none"
          style={{ display: 'block' }}
        />
        {!value && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-center px-4 text-xs text-gray-400 select-none">
            Sign here — I accept responsibility for custom electrical work on my vehicle
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-600 leading-relaxed mt-2">
        By signing above, you acknowledge that custom electrical/optical modifications may void OEM warranties
        and agree to hold 1625 Auto Lab harmless for any pre-existing issues unrelated to the work performed.
      </p>
    </>
  );

  // Return the modal setup if requested
  if (isModal) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Signature / Waiver Consent *
        </label>
        
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full h-24 border border-gray-700 border-dashed rounded-sm bg-brand-darker flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-white hover:border-gray-500 transition-colors overflow-hidden"
        >
          {value ? (
            <div className="w-full h-full bg-gray-50 flex items-center justify-center">
              <img src={value} alt="Signature Preview" className="h-full object-contain" />
            </div>
          ) : (
            <>
              <PenLine className="w-5 h-5" />
              <span className="text-xs">Click to Sign Document</span>
            </>
          )}
        </button>

        {/* Overlay */}
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#111] border border-gray-800 p-5 rounded-md w-full max-w-2xl shadow-2xl relative">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              {CanvasUI}
              
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full mt-4 bg-white text-black font-bold py-2 rounded-sm hover:bg-gray-200 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fall back to standard inline layout
  return <div className="space-y-2">{CanvasUI}</div>;
}
