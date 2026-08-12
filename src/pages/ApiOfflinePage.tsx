import { useState } from 'react';
import { WifiOff, RefreshCw, Mail, Phone, Copy, Check, MapPin, ExternalLink, ShieldAlert } from 'lucide-react';
import { probeBackendOnline, markApiOnline } from '../services/api';

interface ApiOfflinePageProps {
  onRetrySuccess?: () => void;
}

export default function ApiOfflinePage({ onRetrySuccess }: ApiOfflinePageProps) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const contactEmail = '1625autolab@gmail.com';

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const isOnline = await probeBackendOnline();
      if (isOnline) {
        markApiOnline();
        if (onRetrySuccess) {
          onRetrySuccess();
        } else {
          window.location.reload();
        }
      } else {
        setRetryError('Server is still unreachable. Please wait a moment and try again.');
      }
    } catch {
      setRetryError('Unable to connect to server.');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-brand-orange selection:text-white">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-orange/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glassmorphic Container */}
      <div className="relative max-w-xl w-full bg-[#121212]/90 border border-gray-800/80 rounded-2xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl space-y-8 animate-fade-in text-center">
        {/* Animated Offline Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shadow-[0_0_30px_rgba(249,115,22,0.15)]">
              <WifiOff className="w-10 h-10 animate-pulse" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 border-4 border-[#121212] flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            </div>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-semibold uppercase tracking-widest">
            <ShieldAlert className="w-3.5 h-3.5" /> System Temporarily Offline
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wider font-mono text-white">
            Server Connection Unavailable
          </h1>
          <p className="text-sm text-gray-400 font-mono leading-relaxed max-w-md mx-auto">
            We are currently experiencing connection issues with our backend system. Please try reconnecting below, or contact us directly.
          </p>
        </div>

        {/* Contact Email Section */}
        <div className="bg-brand-darker/90 border border-gray-800 rounded-xl p-5 space-y-4 text-left">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-brand-orange flex items-center gap-2">
            <Mail className="w-4 h-4" /> Need Immediate Assistance?
          </div>
          <p className="text-xs font-mono text-gray-300 leading-normal">
            For urgent schedule requests, inquiries, or shop support, please contact us at:
          </p>

          {/* Email Badge & Copy Link */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-brand-dark p-3 rounded-lg border border-gray-800">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 text-brand-orange shrink-0" />
              <a
                href={`mailto:${contactEmail}`}
                className="text-xs font-mono font-bold text-white hover:text-brand-orange transition-colors truncate"
              >
                {contactEmail}
              </a>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-md text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-gray-700"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Email
                  </>
                )}
              </button>
              <a
                href={`mailto:${contactEmail}`}
                className="px-3 py-1.5 bg-brand-orange/20 hover:bg-brand-orange text-brand-orange hover:text-white rounded-md text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 border border-brand-orange/40"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Email Us
              </a>
            </div>
          </div>

          {/* Secondary Phone Numbers */}
          <div className="pt-2 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-400">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-500" />
              <span>09564500292 / 09393308263</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <MapPin className="w-3.5 h-3.5" />
              <span>Cainta, Rizal</span>
            </div>
          </div>
        </div>

        {/* Retry Alert / Feedback */}
        {retryError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs font-mono text-red-400 animate-fade-in">
            {retryError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full sm:w-auto px-6 py-3 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            <span>{retrying ? 'Checking Connection...' : 'Retry Connection'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
