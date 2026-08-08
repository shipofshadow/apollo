import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Loader2, PlusCircle, ChevronDown, ChevronUp,
  Calendar, Clock, Car, Phone, Mail, MapPin, Facebook, Hash,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchMyInquiriesApi } from '../../services/api';
import { formatStatus } from '../../utils/formatStatus';

const STATUS_STYLES: Record<string, string> = {
  pending:        'bg-amber-500/10 text-amber-400  border-amber-500/30',
  confirmed:      'bg-blue-500/10  text-blue-400   border-blue-500/30',
  in_progress:    'bg-brand-orange/10 text-brand-orange border-brand-orange/30',
  completed:      'bg-emerald-500/10 text-emerald-400  border-emerald-500/30',
  cancelled:      'bg-red-500/10   text-red-400    border-red-500/30',
};

const STATUS_STRIP: Record<string, string> = {
  pending:        'bg-amber-400',
  confirmed:      'bg-blue-400',
  in_progress:    'bg-brand-orange',
  completed:      'bg-emerald-400',
  cancelled:      'bg-red-500',
};

const STATUS_DOT: Record<string, string> = {
  pending:        'bg-amber-400',
  confirmed:      'bg-blue-400',
  in_progress:    'bg-brand-orange',
  completed:      'bg-emerald-400',
  cancelled:      'bg-red-500',
};

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 font-bold leading-none mb-0.5">{label}</p>
        <p className="text-sm text-gray-300 truncate">{value}</p>
      </div>
    </div>
  );
}

export default function MyInquiries() {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user) return;

    setLoading(true);
    fetchMyInquiriesApi(token)
      .then(res => setInquiries(res.inquiries || []))
      .catch(() => showToast('Failed to load inquiries', 'error'))
      .finally(() => setLoading(false));
  }, [token, user, showToast]);

  const filtered = filter === 'all'
    ? inquiries
    : inquiries.filter(i => i.status === filter);

  const activeCount = inquiries.filter(i => ['pending', 'confirmed', 'in_progress'].includes(i.status)).length;
  const doneCount = inquiries.filter(i => i.status === 'completed').length;

  const tabs = [
    { key: 'all',         label: 'All' },
    { key: 'pending',     label: 'Pending' },
    { key: 'confirmed',   label: 'Confirmed' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed',   label: 'Completed' },
    { key: 'cancelled',   label: 'Cancelled' },
  ];

  const formatDateLong = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-PH', {
      weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    });

  const formatSubmittedAt = (raw: string) => {
    if (!raw) return '';
    try {
      return new Date(raw).toLocaleDateString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch {
      return raw;
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedId(prev => (prev === id ? null : id));

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gradient-to-br from-brand-darker via-brand-dark to-[#161515] p-5 md:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-orange/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-20 h-36 w-36 rounded-full bg-blue-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange/90 mb-2">Client Portal</p>
            <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tight">
              My Inquiries
            </h1>
            <p className="mt-2 text-sm text-gray-400 max-w-xl">
              Track your service inquiries and appointment schedules.
            </p>
          </div>

          <Link
            to="/customer-form"
            className="inline-flex items-center justify-center gap-2 bg-brand-orange text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-md"
          >
            <PlusCircle className="w-3.5 h-3.5" /> New Inquiry
          </Link>
        </div>

        {/* Stats */}
        <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-800/90 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Total</p>
            <p className="text-2xl font-black text-white mt-1">{inquiries.length}</p>
          </div>
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-amber-300">Active</p>
            <p className="text-2xl font-black text-amber-200 mt-1">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-blue-400/30 bg-blue-500/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-blue-300">Completed</p>
            <p className="text-2xl font-black text-blue-200 mt-1">{doneCount}</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="rounded-xl border border-gray-800 bg-brand-dark/60 p-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(({ key, label }) => {
            const count = key === 'all' ? inquiries.length : inquiries.filter(i => i.status === key).length;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 px-3.5 py-2 text-xs font-bold uppercase tracking-widest rounded-md border transition-colors ${
                  filter === key
                    ? 'bg-brand-orange border-brand-orange text-white'
                    : 'border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white bg-[#171717]'
                }`}
              >
                {label}
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${filter === key ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-brand-orange animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 bg-brand-dark border border-gray-800 rounded-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800/60 mb-4">
            <MessageSquare className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-white font-bold text-lg mb-1">
            {filter === 'all' ? 'No inquiries yet' : `No ${formatStatus(filter)} inquiries`}
          </p>
          <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
            {filter === 'all'
              ? 'Submit a service inquiry and it will appear here for you to track.'
              : `You don't have any ${formatStatus(filter).toLowerCase()} inquiries right now.`}
          </p>
          {filter === 'all' && (
            <Link
              to="/customer-form"
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-md"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Submit an Inquiry
            </Link>
          )}
        </div>
      )}

      {/* Inquiry cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(i => {
            const isExpanded = expandedId === i.id;
            return (
              <div
                key={i.id}
                className="group relative bg-gradient-to-r from-brand-dark to-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-700"
              >
                {/* Status strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_STRIP[i.status] ?? 'bg-gray-500'}`} />

                {/* Main clickable row */}
                <button
                  type="button"
                  onClick={() => toggleExpand(i.id)}
                  className="w-full flex items-center gap-4 min-w-0 flex-1 pl-5 pr-4 py-4 md:py-5 text-left"
                >
                  {/* Date badge */}
                  <div className="shrink-0 w-12 h-12 bg-brand-darker border border-gray-700 rounded-md flex flex-col items-center justify-center">
                    <span className="text-white text-xs font-black leading-none">
                      {i.appointmentDate ? i.appointmentDate.split('-')[2] : '--'}
                    </span>
                    <span className="text-gray-500 text-[9px] uppercase leading-none mt-0.5">
                      {i.appointmentDate
                        ? new Date(i.appointmentDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short' })
                        : '--'}
                    </span>
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <p className="text-white font-bold text-sm md:text-base truncate">
                        {i.productToPurchase || 'General Inquiry'}
                      </p>
                      {/* Mobile status badge */}
                      <span className={`sm:hidden inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md border ${STATUS_STYLES[i.status] ?? 'bg-gray-500'}`}>
                        {formatStatus(i.status)}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs truncate">
                      {i.appointmentDate ? formatDateLong(i.appointmentDate) : 'No date'}{' '}
                      {i.appointmentTime && <span className="text-brand-orange font-semibold">@ {i.appointmentTime}</span>}
                    </p>
                    <p className="text-gray-600 text-[11px] truncate mt-0.5">
                      {i.yearModel} {i.make} {i.model}
                      {i.createdAt && <span> · Submitted {formatSubmittedAt(i.createdAt)}</span>}
                    </p>
                  </div>

                  {/* Desktop status + expand chevron */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-md border ${STATUS_STYLES[i.status] ?? 'bg-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[i.status] ?? 'bg-gray-500'}`} />
                      {formatStatus(i.status)}
                    </span>
                    <span className="text-gray-500 group-hover:text-gray-300 transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </button>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="pl-5 pr-4 pb-5 border-t border-gray-800/60">
                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

                      {/* Schedule */}
                      <div className="col-span-full">
                        <p className="text-[10px] uppercase tracking-widest text-brand-orange/70 font-bold mb-2">Schedule</p>
                        <div className="flex flex-wrap gap-5">
                          <DetailRow
                            icon={Calendar}
                            label="Date"
                            value={i.appointmentDate ? formatDateLong(i.appointmentDate) : 'Not set'}
                          />
                          <DetailRow
                            icon={Clock}
                            label="Time"
                            value={i.appointmentTime || 'Not set'}
                          />
                        </div>
                      </div>

                      {/* Vehicle */}
                      <div className="col-span-full">
                        <p className="text-[10px] uppercase tracking-widest text-brand-orange/70 font-bold mb-2">Vehicle</p>
                        <div className="flex flex-wrap gap-5">
                          <DetailRow
                            icon={Car}
                            label="Vehicle"
                            value={`${i.yearModel} ${i.make} ${i.model}`.trim() || 'N/A'}
                          />
                          {i.plateNumber && (
                            <DetailRow icon={Hash} label="Plate" value={i.plateNumber} />
                          )}
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="col-span-full">
                        <p className="text-[10px] uppercase tracking-widest text-brand-orange/70 font-bold mb-2">Contact Info</p>
                        <div className="flex flex-wrap gap-5">
                          <DetailRow icon={Phone} label="Phone" value={i.contactNumber} />
                          <DetailRow icon={Mail} label="Email" value={i.emailAddress} />
                          {i.facebookName && (
                            <DetailRow icon={Facebook} label="Facebook" value={i.facebookName} />
                          )}
                          {i.address && (
                            <DetailRow icon={MapPin} label="Address" value={i.address} />
                          )}
                        </div>
                      </div>

                      {/* Service */}
                      {i.productToPurchase && (
                        <div className="col-span-full">
                          <p className="text-[10px] uppercase tracking-widest text-brand-orange/70 font-bold mb-1">Service / Product</p>
                          <p className="text-sm text-gray-300 leading-relaxed">{i.productToPurchase}</p>
                        </div>
                      )}
                    </div>

                    {/* Inquiry reference ID */}
                    <div className="mt-4 pt-3 border-t border-gray-800/50 flex items-center justify-between flex-wrap gap-2">
                      <p className="text-[10px] text-gray-600 font-mono truncate">
                        Ref: {i.id}
                      </p>
                      {i.createdAt && (
                        <p className="text-[10px] text-gray-600">
                          Submitted on {formatSubmittedAt(i.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
