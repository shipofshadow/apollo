import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Calendar, Clock, Loader2, XCircle, Eye, Search, X as XIcon, Trash2, AlertTriangle, Download,
  Car
} from 'lucide-react';
import { fetchAllBookingsAsync, updateBookingStatusAsync } from '../../store/bookingSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';
import { 
  deleteBookingApi, fetchBookingByIdApi, fetchBuildUpdatesApi,
  fetchInquiryCalendarApi, deleteInquiryApi, updateInquiryStatusApi,
  fetchShopClosedDatesApi
} from '../../services/api';
import { generateJobCompletionPDF } from '../../utils/generateJobCompletionPDF';

const STATUS_STYLES: Record<string, string> = {
  pending:        'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400  border border-green-500/30',
  in_progress:    'bg-sky-500/10    text-sky-400    border border-sky-500/30',
  completed:      'bg-blue-500/10   text-blue-400   border border-blue-500/30',
  cancelled:      'bg-gray-800       text-gray-400   border border-gray-700',
  awaiting_parts: 'bg-amber-500/10  text-amber-400  border border-amber-500/30',
};

interface InquiryEvent {
  id: string;
  fullName: string;
  appointmentDate: string;
  appointmentTime: string;
  make: string;
  model: string;
  year?: string | number;
  productToPurchase: string;
  status: string;
  contactNumber?: string;
  emailAddress?: string;
  facebookName?: string;
  plateNumber?: string;
}

type PanelEventItem = (Booking & { eventType: 'booking' }) | (InquiryEvent & { eventType: 'inquiry' });

function slotToMinutes(slot: string): number {
  if (!slot) return 0;
  const [timePart, ampm] = slot.split(' ');
  const [hourRaw, minuteRaw] = timePart.split(':').map(Number);
  let hour = hourRaw || 0;
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + (minuteRaw || 0);
}

interface Props {
  onView: (bookingId: string) => void;
}

/* ── Table Skeleton Loader ─────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="h-14 bg-brand-dark border border-gray-800 rounded-xl" />
      <div className="h-96 bg-brand-dark border border-gray-800 rounded-xl" />
    </div>
  );
}

export default function BookingsPanel({ onView }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const { appointments, status } = useSelector((s: RootState) => s.booking);
  
  const [inquiries, setInquiries] = useState<InquiryEvent[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'booking' | 'inquiry'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'booking' | 'inquiry' } | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      dispatch(fetchAllBookingsAsync(token));
      fetchInquiryCalendarApi(token ?? '')
        .then(data => setInquiries(data.events ?? []))
        .catch(err => console.error(err));
      fetchShopClosedDatesApi()
        .catch(() => {});
    }
  }, [token, dispatch]);

  const handleCancelBooking = (id: string) => {
    if (!token) return;
    dispatch(updateBookingStatusAsync({ token, id, status: 'cancelled' }));
    showToast('Booking cancelled.', 'success');
  };

  const handleCancelInquiry = async (id: string) => {
    if (!token) return;
    try {
      const res = await updateInquiryStatusApi(token, id, 'cancelled');
      setInquiries((prev) => prev.map((iq) => iq.id === id ? { ...iq, status: res.inquiry.status } : iq));
      showToast('Inquiry cancelled.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to cancel inquiry.', 'error');
    }
  };

  const requestDelete = (item: PanelEventItem) => {
    if (!token || deleteBusyId) return;
    setDeleteTarget({ 
      id: item.id, 
      name: item.eventType === 'booking' ? item.name : item.fullName, 
      type: item.eventType 
    });
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget || deleteBusyId) return;
    setDeleteBusyId(deleteTarget.id);
    try {
      if (deleteTarget.type === 'booking') {
        await deleteBookingApi(token, deleteTarget.id);
        await dispatch(fetchAllBookingsAsync(token));
      } else {
        await deleteInquiryApi(token, deleteTarget.id);
        setInquiries(prev => prev.filter(i => i.id !== deleteTarget.id));
      }
      showToast('Record deleted.', 'success');
      setDeleteTarget(null);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to delete record.', 'error');
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleDownloadPdf = async (rowBooking: Booking) => {
    if (!token) return;
    if (rowBooking.status !== 'completed') {
      showToast('PDF is available only for completed bookings.', 'error');
      return;
    }
    setPdfBusyId(rowBooking.id);
    try {
      const [{ booking }, { updates }] = await Promise.all([
        fetchBookingByIdApi(token, rowBooking.id),
        fetchBuildUpdatesApi(token, rowBooking.id).catch(() => ({ updates: [] })),
      ]);
      await generateJobCompletionPDF(booking, {
        buildUpdates: updates,
        includeAdminExtras: true,
      });
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to generate booking PDF.', 'error');
    } finally {
      setPdfBusyId(null);
    }
  };

  const term = search.trim().toLowerCase();

  const allItems: PanelEventItem[] = [
    ...appointments.map(b => ({ ...b, eventType: 'booking' as const })),
    ...inquiries.map(i => ({ ...i, eventType: 'inquiry' as const }))
  ];
  
  allItems.sort((a, b) => {
    const dA = new Date(`${a.appointmentDate}T00:00:00`).getTime();
    const dB = new Date(`${b.appointmentDate}T00:00:00`).getTime();
    if (dA !== dB) return dB - dA;
    return slotToMinutes(b.appointmentTime) - slotToMinutes(a.appointmentTime);
  });

  const filtered = allItems
    .filter(item => typeFilter === 'all' || item.eventType === typeFilter)
    .filter(item => !dateFilter || item.appointmentDate === dateFilter)
    .filter(item => {
      if (term === '') return true;
      if (item.eventType === 'booking') {
        return (
          item.name.toLowerCase().includes(term) ||
          item.phone.toLowerCase().includes(term) ||
          item.vehicleInfo.toLowerCase().includes(term) ||
          item.serviceName.toLowerCase().includes(term) ||
          item.email.toLowerCase().includes(term)
        );
      } else {
        return (
          item.fullName.toLowerCase().includes(term) ||
          (item.contactNumber && item.contactNumber.toLowerCase().includes(term)) ||
          `${item.make} ${item.model}`.toLowerCase().includes(term) ||
          item.productToPurchase.toLowerCase().includes(term) ||
          (item.emailAddress && item.emailAddress.toLowerCase().includes(term))
        );
      }
    });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const typeFilters: Array<{ key: 'all' | 'booking' | 'inquiry'; label: string }> = [
    { key: 'all', label: 'All Records' },
    { key: 'booking', label: 'Bookings' },
    { key: 'inquiry', label: 'Inquiries' },
  ];

  // Calculated Stats
  const totalBookingsCount = appointments.length;
  const totalInquiriesCount = inquiries.length;
  const activeCount = allItems.filter(i => i.status !== 'cancelled').length;
  const completedCount = allItems.filter(i => i.status === 'completed').length;

  return (
    <div className="w-full space-y-6">

      {/* ── 1. Dashboard Header ───────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20 text-brand-orange shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Appointments</span>
                <span className="text-gray-600 text-xs">•</span>
                <span className="text-xs text-gray-400">Master Schedule</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-wide text-white mt-0.5">
                Customer Appointments
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
                View, filter, manage, and download completion reports for shop appointments and inquiries.
              </p>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
            {/* Date Filter */}
            <div className="relative w-full sm:w-44">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="date"
                value={dateFilter}
                onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-brand-darker border border-gray-800 text-white text-xs pl-9 pr-8 py-2.5 rounded-lg focus:outline-none focus:border-brand-orange transition-all font-mono [color-scheme:dark]"
              />
              {dateFilter && (
                <button
                  onClick={() => { setDateFilter(''); setCurrentPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search name, phone, vehicle…"
                className="w-full bg-brand-darker border border-gray-800 text-white text-xs pl-9 pr-8 py-2.5 rounded-lg focus:outline-none focus:border-brand-orange transition-all placeholder-gray-600 font-mono"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setCurrentPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Statistics Summary Bar ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-brand-dark border border-gray-800 p-4 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Records</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-white mt-1">{allItems.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{totalBookingsCount} bookings • {totalInquiriesCount} inquiries</p>
        </div>

        <div className="bg-brand-dark border border-gray-800 p-4 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Active Schedule</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-green-400 mt-1">{activeCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">upcoming &amp; in progress</p>
        </div>

        <div className="bg-brand-dark border border-gray-800 p-4 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Service Inquiries</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-brand-orange mt-1">{totalInquiriesCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">requests awaiting confirmation</p>
        </div>

        <div className="bg-brand-dark border border-gray-800 p-4 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Completed Jobs</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-blue-400 mt-1">{completedCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">finished &amp; archived</p>
        </div>
      </div>

      {/* ── 3. Segmented Type Filter ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        {typeFilters.map(({ key, label }) => {
          const count = key === 'all' ? allItems.length : allItems.filter(b => b.eventType === key).length;
          const isActive = typeFilter === key;
          
          return (
            <button 
              key={key} 
              type="button"
              onClick={() => { setTypeFilter(key); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider border transition-all rounded-lg cursor-pointer ${
                isActive
                  ? 'bg-brand-orange text-white border-brand-orange shadow-md'
                  : 'bg-brand-dark border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
              }`}
            >
              <span>{label}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 4. Loading State ──────────────────────────────────────── */}
      {status === 'loading' && <TableSkeleton />}

      {/* ── 5. Empty State ────────────────────────────────────────── */}
      {filtered.length === 0 && status !== 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-800 rounded-xl bg-brand-dark p-6 text-center">
          <Calendar className="w-10 h-10 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">No Records Found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            {term 
              ? `No appointments or inquiries match your query "${search}".` 
              : dateFilter 
              ? `No records found scheduled for ${dateFilter}.` 
              : `No ${typeFilter} records currently available.`}
          </p>
          {(term || dateFilter) && (
            <button
              onClick={() => { setSearch(''); setDateFilter(''); setCurrentPage(1); }}
              className="mt-4 px-4 py-2 border border-gray-700 hover:border-brand-orange text-brand-orange hover:bg-brand-orange/10 text-xs font-bold uppercase tracking-widest transition-colors rounded-lg cursor-pointer"
            >
              Clear Search Filters
            </button>
          )}
        </div>
      )}

      {/* ── 6. Results Data Table & Mobile Cards ─────────────────── */}
      {filtered.length > 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-brand-darker border-b border-gray-800">
                  {['Customer / Contact', 'Service & Vehicle', 'Appointment Schedule', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {paginatedItems.map(item => {
                  const isBooking = item.eventType === 'booking';
                  return (
                    <tr
                      key={`${item.eventType}-${item.id}`}
                      className="hover:bg-brand-darker/60 transition-colors cursor-pointer group"
                      onClick={() => isBooking ? onView(item.id) : onView('inq-' + item.id)}
                    >
                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isBooking 
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' 
                              : 'bg-brand-orange/10 text-brand-orange border-brand-orange/30'
                          }`}>
                            {isBooking ? 'Booking' : 'Inquiry'}
                          </span>
                          <span className="text-white font-bold text-sm">
                            {isBooking ? item.name : item.fullName}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs font-mono">
                          {isBooking ? item.phone : (item.contactNumber || item.emailAddress || 'No Contact')}
                        </p>
                      </td>

                      {/* Service / Vehicle */}
                      <td className="px-5 py-4">
                        <p className="text-gray-200 font-semibold text-xs sm:text-sm">
                          {isBooking ? item.serviceName : (item.productToPurchase || 'Service Inquiry')}
                        </p>

                        {isBooking && item.selectedVariations && item.selectedVariations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {item.selectedVariations.map(v => (
                              <span key={`${v.serviceId}-${v.variationId}`} className="inline-flex items-center text-[9px] font-mono bg-brand-darker border border-gray-800 px-1.5 py-0.5 rounded text-gray-400">
                                <span className="text-brand-orange mr-1">+</span>{v.variationName}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-gray-500 text-[10px] uppercase font-mono mt-1 flex items-center gap-1.5">
                          <Car className="w-3 h-3 text-gray-500" />
                          <span>
                            {isBooking 
                              ? item.vehicleInfo 
                              : `${item.make} ${item.model} ${item.year ? `(${item.year})` : ''} ${item.plateNumber ? `[${item.plateNumber}]` : ''}`}
                          </span>
                        </p>
                      </td>

                      {/* Schedule */}
                      <td className="px-5 py-4 text-gray-300 text-xs font-mono">
                        <div className="flex items-center gap-1.5 mb-1 font-semibold text-white">
                          <Calendar className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                          <span>{item.appointmentDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>{item.appointmentTime}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border inline-block ${
                          STATUS_STYLES[item.status] || 'bg-gray-800 text-gray-300 border-gray-700'
                        }`}>
                          {formatStatus(item.status as any)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => isBooking ? onView(item.id) : onView('inq-' + item.id)}
                            title="View Details"
                            className="p-2 rounded-lg bg-brand-darker border border-gray-800 hover:border-brand-orange text-gray-400 hover:text-brand-orange transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isBooking && item.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadPdf(item)}
                              title="Download Completion PDF"
                              disabled={pdfBusyId === item.id}
                              className="p-2 rounded-lg bg-brand-darker border border-gray-800 hover:border-blue-400 text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {pdfBusyId === item.id ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Download className="w-4 h-4" />}
                            </button>
                          )}

                          {item.status !== 'cancelled' && item.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => isBooking ? handleCancelBooking(item.id) : handleCancelInquiry(item.id)}
                              title={`Cancel ${isBooking ? 'Booking' : 'Inquiry'}`}
                              className="p-2 rounded-lg bg-brand-darker border border-gray-800 hover:border-red-500 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); requestDelete(item); }}
                            title={`Delete ${isBooking ? 'Booking' : 'Inquiry'}`}
                            disabled={deleteBusyId === item.id}
                            className="p-2 rounded-lg bg-brand-darker border border-gray-800 hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {deleteBusyId === item.id ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-gray-800">
            {paginatedItems.map(item => {
              const isBooking = item.eventType === 'booking';
              return (
                <div
                  key={`${item.eventType}-${item.id}`}
                  className="p-4 hover:bg-brand-darker/60 transition-colors cursor-pointer space-y-3"
                  onClick={() => isBooking ? onView(item.id) : onView('inq-' + item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-block mb-1 ${
                        isBooking ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' : 'bg-brand-orange/10 text-brand-orange border-brand-orange/30'
                      }`}>
                        {isBooking ? 'Booking' : 'Inquiry'}
                      </span>
                      <h3 className="text-sm font-bold text-white leading-tight">
                        {isBooking ? item.name : item.fullName}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {isBooking ? item.phone : (item.contactNumber || item.emailAddress || 'No Contact')}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border shrink-0 ${
                      STATUS_STYLES[item.status] || 'bg-gray-800 text-gray-300'
                    }`}>
                      {formatStatus(item.status as any)}
                    </span>
                  </div>

                  <div className="bg-brand-darker p-3 rounded-lg border border-gray-800 space-y-1">
                    <p className="text-xs font-semibold text-gray-200">
                      {isBooking ? item.serviceName : (item.productToPurchase || 'Service Inquiry')}
                    </p>
                    <p className="text-[10px] font-mono uppercase text-gray-400 flex items-center gap-1">
                      <Car className="w-3 h-3 text-gray-500" />
                      <span>
                        {isBooking 
                          ? item.vehicleInfo 
                          : `${item.make} ${item.model} ${item.year ? `(${item.year})` : ''} ${item.plateNumber ? `[${item.plateNumber}]` : ''}`}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-1">
                    <div className="flex items-center gap-3 text-gray-300">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-brand-orange" /> {item.appointmentDate}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-500" /> {item.appointmentTime}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isBooking && item.status === 'completed' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleDownloadPdf(item); }}
                          title="Download PDF"
                          disabled={pdfBusyId === item.id}
                          className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          {pdfBusyId === item.id ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Download className="w-4 h-4" />}
                        </button>
                      )}

                      {item.status !== 'cancelled' && item.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); isBooking ? handleCancelBooking(item.id) : handleCancelInquiry(item.id); }}
                          title="Cancel"
                          className="p-1.5 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); requestDelete(item); }}
                        title="Delete"
                        disabled={deleteBusyId === item.id}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        {deleteBusyId === item.id ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-gray-800 bg-brand-darker gap-4">
              <p className="text-xs text-gray-400 font-mono text-center sm:text-left">
                Showing <span className="text-white font-bold font-mono">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-white font-bold font-mono">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="text-white font-bold font-mono">{filtered.length}</span> results
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-800 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Prev
                </button>
                <div className="flex items-center gap-1 font-mono text-xs font-bold">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg transition-colors cursor-pointer ${
                        page === currentPage
                          ? 'bg-brand-orange text-white'
                          : 'border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-800 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── 7. Delete Confirmation Modal ──────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-brand-dark border border-gray-800 rounded-xl shadow-2xl overflow-hidden space-y-4 p-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Delete Record</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Confirm Deletion
                </h3>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to permanently delete the {deleteTarget.type} record for <strong className="text-white">{deleteTarget.name}</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusyId !== null}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteBusyId !== null}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-md inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deleteBusyId === deleteTarget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{deleteBusyId === deleteTarget.id ? 'Deleting…' : 'Delete Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}