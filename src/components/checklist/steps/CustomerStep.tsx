import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Calendar, Search, Sparkles, CheckCircle2, Loader2, X, Car, Tag } from 'lucide-react';
import type { ChecklistWizardState } from '../types';
import { lookupReferenceApi, type ReferenceLookupResult } from '../../../services/api';

interface Props {
  state: ChecklistWizardState;
  token?: string | null;
  canAutoFill?: boolean;
  onChange: (customer: { name: string; email: string; phone?: string }) => void;
  onAutoFillAll?: (match: ReferenceLookupResult) => Promise<void> | void;
}

export default function CustomerStep({ state, token, canAutoFill, onChange, onAutoFillAll }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ReferenceLookupResult[]>([]);
  const [recentItems, setRecentItems] = useState<ReferenceLookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeFilledRef, setActiveFilledRef] = useState<string | null>(null);
  const [activeFilledName, setActiveFilledName] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Format current ISO date (YYYY-MM-DD) into readable display date
  const displayDate = new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Fetch initial recent bookings/inquiries for quick selection (admin/owner only)
  useEffect(() => {
    if (canAutoFill && token) {
      lookupReferenceApi('', token)
        .then((res) => {
          setRecentItems(res.results || []);
        })
        .catch(() => {});
    }

    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    if (refParam && refParam.trim().length >= 5) {
      lookupReferenceApi(refParam.trim(), token)
        .then((res) => {
          if (res.results && res.results.length > 0) {
            handleSelectResult(res.results[0]);
          }
        })
        .catch(() => {});
    }
  }, [canAutoFill, token]);

  // Handle outside click to close suggestion dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search backend when searchQuery changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = searchQuery.trim();
      if (!q) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      lookupReferenceApi(q, token)
        .then((res) => {
          setResults(res.results || []);
          setShowDropdown(true);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, canAutoFill, token]);

  const handleSelectResult = async (item: ReferenceLookupResult) => {
    if (onAutoFillAll) {
      await onAutoFillAll(item);
    } else {
      onChange({
        name: item.customerName || state.customer.name,
        email: item.customerEmail || state.customer.email,
        phone: item.contactNumber || state.customer.phone || '',
      });
    }

    setActiveFilledRef(item.referenceNumber || item.id);
    setActiveFilledName(item.customerName);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const displayList = searchQuery.trim() ? results : recentItems;

  return (
    <div className="space-y-6">
      {/* Step Title Header */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
          STEP 2 OF {state.inspectionMode === 'both' ? '8' : '7'}
        </span>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
          Customer Information
        </h2>
        <p className="text-xs text-gray-400 font-sans">
          {canAutoFill
            ? "Enter the client's details manually or search by Plate Number below to auto-fill customer, vehicle specs, and service choice."
            : "Enter the client's contact details for inspection documentation and report delivery."}
        </p>
      </div>

      {/* ── 1. Plate Number Lookup Bar ─────────── */}
      <div className="relative font-sans" ref={dropdownRef}>
        <div className="bg-gradient-to-r from-brand-darker via-[#181818] to-brand-darker border border-brand-orange/40 rounded-xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="ref-lookup-input" className="text-xs font-mono font-bold uppercase tracking-wider text-brand-orange flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-orange animate-pulse" />
              Plate Number Auto-Fill Lookup
            </label>
            <span className="text-[10px] font-mono text-gray-500 uppercase">Search Vehicle Plate #</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="ref-lookup-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Enter Plate Number (e.g. ABC 1234 or ABC-1234)..."
              className="w-full bg-black/60 border border-gray-700/80 rounded-lg pl-10 pr-10 py-3 text-white placeholder-gray-500 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-mono"
            />

            {loading ? (
              <Loader2 className="w-4 h-4 text-brand-orange animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setResults([]);
                }}
                className="p-1 text-gray-400 hover:text-white absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Quick Suggestion Pills */}
          {recentItems.length > 0 && !searchQuery && (
            <div className="pt-1 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] text-gray-500 font-mono uppercase shrink-0">Recent Shop Vehicles:</span>
              {recentItems.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-brand-orange/10 hover:bg-brand-orange/20 border border-brand-orange/30 text-brand-orange text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  <Tag className="w-3 h-3" />
                  {item.plateNumber ? (
                    <span className="text-emerald-400 font-extrabold">{item.plateNumber}</span>
                  ) : (
                    <span>{item.referenceNumber}</span>
                  )}
                  <span className="text-gray-400 font-normal truncate max-w-[120px]">({item.customerName})</span>
                </button>
              ))}
            </div>
          )}

          {/* Auto-Fill Banner Feedback */}
          {activeFilledRef && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between gap-3 text-xs text-emerald-400 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="truncate">
                  Auto-filled details from <strong>{activeFilledRef}</strong> ({activeFilledName})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveFilledRef(null);
                  setActiveFilledName(null);
                }}
                className="text-[10px] uppercase tracking-wider font-bold text-gray-400 hover:text-white cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Suggestion Dropdown Panel */}
        {showDropdown && (
          <div className="absolute z-30 left-0 right-0 top-full mt-2 bg-[#181818] border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto animate-in fade-in duration-150">
            <div className="p-2.5 bg-black/40 border-b border-gray-800 text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span>{searchQuery ? `Search Results (${results.length})` : `Recent Shop Vehicles & Inquiries`}</span>
              <span>Click item to auto-fill</span>
            </div>

            {displayList.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 font-mono">
                {searchQuery ? 'No matching inquiry or booking found for that Plate # or Reference No.' : 'No recent bookings available.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {displayList.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => handleSelectResult(item)}
                    className="w-full text-left p-3.5 hover:bg-brand-orange/10 transition-colors flex items-start justify-between gap-3 group cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.plateNumber ? (
                          <span className="px-2 py-0.5 text-xs font-mono font-extrabold uppercase bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded shadow-sm">
                            Plate: {item.plateNumber}
                          </span>
                        ) : null}
                        <span className="font-mono font-bold text-sm text-brand-orange group-hover:underline">
                          {item.referenceNumber}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${
                          item.type === 'inquiry'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        }`}>
                          {item.type}
                        </span>
                      </div>

                      <div className="text-xs text-white font-semibold truncate">
                        {item.customerName || 'Unnamed Client'}{' '}
                        {item.customerEmail && <span className="text-gray-400 font-normal font-mono">({item.customerEmail})</span>}
                      </div>

                      <div className="text-[11px] text-gray-400 flex items-center gap-3 truncate">
                        <span className="flex items-center gap-1">
                          <Car className="w-3 h-3 text-gray-500" />
                          {item.vehicleYear} {item.vehicleMake} {item.vehicleModel}
                        </span>
                        {item.plateNumber && (
                          <span className="font-mono font-bold text-gray-300">
                            [{item.plateNumber}]
                          </span>
                        )}
                        {item.serviceName && (
                          <span className="text-brand-orange/80 truncate">
                            • {item.serviceName}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] font-bold text-brand-orange uppercase tracking-wider group-hover:translate-x-1 transition-transform shrink-0 self-center">
                      Auto-Fill &rarr;
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Form Fields Card ──────────────────────────────────── */}
      <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-6 shadow-xl space-y-5">
        <div className="space-y-2 font-sans">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-brand-orange" /> Customer Name <span className="text-brand-orange">*</span>
          </label>
          <input
            type="text"
            required
            value={state.customer.name}
            onChange={(e) => onChange({ ...state.customer, name: e.target.value })}
            placeholder="Juan Dela Cruz"
            className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm"
          />
        </div>

        <div className="space-y-2 font-sans">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-brand-orange" /> Customer Email <span className="text-brand-orange">*</span>
          </label>
          <input
            type="email"
            required
            value={state.customer.email}
            onChange={(e) => onChange({ ...state.customer, email: e.target.value })}
            placeholder="juan@example.com"
            className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-mono"
          />
        </div>

        <div className="space-y-2 font-sans">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-brand-orange" /> Contact Phone Number
          </label>
          <input
            type="tel"
            value={state.customer.phone || ''}
            onChange={(e) => onChange({ ...state.customer, phone: e.target.value })}
            placeholder="0912 345 6789"
            className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-mono"
          />
        </div>

        <div className="space-y-2 font-sans">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-500" /> Inspection Date
          </label>
          <div className="flex items-center justify-between p-3.5 bg-[#121212] border border-gray-800/80 rounded-lg text-sm text-gray-300 font-mono">
            <span>{displayDate}</span>
            <span className="text-[10px] font-bold uppercase text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded border border-brand-orange/20">
              Read-only
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
