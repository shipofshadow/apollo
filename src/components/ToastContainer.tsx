import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import type { ToastVariant } from '../context/ToastContext';

// ── Config ────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-brand-dark border-green-500/50  text-green-400',
  error:   'bg-brand-dark border-red-500/50    text-red-400',
  warning: 'bg-brand-dark border-yellow-500/50 text-yellow-400',
  info:    'bg-brand-dark border-brand-orange/50 text-brand-orange',
};

const VARIANT_ICONS: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
};

// ── Toast container ───────────────────────────────────────────────────────────

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      {toasts.map(toast => {
        const Icon = VARIANT_ICONS[toast.variant];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 border rounded-sm shadow-lg animate-slideUp ${VARIANT_STYLES[toast.variant]}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm flex-grow text-white leading-snug">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 text-gray-500 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
