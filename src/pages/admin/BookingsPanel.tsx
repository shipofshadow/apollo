// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Calendar, Clock, Loader2, XCircle, Eye, Search, X as XIcon, Trash2, AlertTriangle, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { fetchAllBookingsAsync, updateBookingStatusAsync } from '../../store/bookingSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';
import { 
  deleteBookingApi, fetchBookingByIdApi, fetchBuildUpdatesApi,
  fetchInquiryCalendarApi, deleteInquiryApi, updateInquiryStatusApi,
  fetchInquiryAvailabilityApi, rescheduleInquiryApi, fetchShopClosedDatesApi
} from '../../services/api';
import { generateJobCompletionPDF } from '../../utils/generateJobCompletionPDF';

const STATUS_STYLES: Record<string, string> = {
  pending:        'bg-yellow-500/10 text-yellow-500  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  in_progress:    'bg-sky-500/10    text-sky-400     border-sky-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-[#1a1a1a]     text-gray-500    border-gray-800',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
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
  const [timePart, ampm] = slot.split(' ');
  const [hourRaw, minuteRaw] = timePart.split(':').map(Number);
  let hour = hourRaw;
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + (minuteRaw || 0);
}

function slotCompletionLabel(slot: string, totalHours: number): string {
  const start = slotToMinutes(slot);
  const endRaw = start + totalHours * 60;
  if (endRaw >= 24 * 60) {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    return format(d, 'h:mm aa');
  }
  const h = Math.floor(endRaw / 60) % 24;
  const m = endRaw % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, 'h:mm aa');
}

function formatCloseTimeString(closeTime: string): string {
  if (!closeTime) return '';
  const [hStr, mStr] = closeTime.split(':');
  const h = Number(hStr);
  const m = Number(mStr || '0');
  const d = new Date();
  d.setHours(h === 24 ? 0 : h, m, 0, 0);
  return format(d, 'h:mm aa');
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDateForInput(date: Date | null) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
interface Props {
  onView: (bookingId: string) => void;
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

  // Inquiry Modal state
  const [viewingInquiry, setViewingInquiry] = useState<InquiryEvent | null>(null);
  const [isEditingInquiry, setIsEditingInquiry] = useState(false);
  const [editDate, setEditDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [closedDates, setClosedDates] = useState<{ date: string; reason: string | null; isYearly: boolean }[]>([]);
  const [editDayIsOpen, setEditDayIsOpen] = useState(true);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [slotCapacity, setSlotCapacity] = useState<number | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  useEffect(() => {
    if (token) {
      dispatch(fetchAllBookingsAsync(token));
      fetchInquiryCalendarApi(token ?? '')
        .then(data => setInquiries(data.events ?? []))
        .catch(err => console.error(err));
      fetchShopClosedDatesApi()
        .then(data => setClosedDates((data as any).closedDates ?? []))
        .catch(() => {});
    }
  }, [token, dispatch]);

  const loadAvailability = async (date: string) => {
    if (!date) {
      setAvailableSlots([]);
      return;
    }
    setAvailabilityLoading(true);
    setModalError(null);
    try {
      const data = await fetchInquiryAvailabilityApi(date);
      setAvailableSlots(data.availableSlots ?? []);
      setSlotCounts(data.slotCounts ?? {});
      setSlotCapacity(typeof (data as any).slotCapacity === 'number' ? (data as any).slotCapacity : null);
      setEditDayIsOpen(typeof (data as any).isOpen === 'boolean' ? (data as any).isOpen : true);
      setEditClosureReason(typeof (data as any).closureReason === 'string' ? (data as any).closureReason : null);
      setEditCloseTime(typeof (data as any).closeTime === 'string' ? (data as any).closeTime : '18:00');
    } catch (err) {
      setAvailableSlots([]);
      setSlotCounts({});
      setSlotCapacity(null);
      setModalError(err instanceof Error ? err.message : 'Unable to load available slots.');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  useEffect(() => {
    if (isEditingInquiry && editDate) {
      void loadAvailability(editDate);
    }
  }, [isEditingInquiry, editDate]);

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
        if (viewingInquiry?.id === deleteTarget.id) {
          setViewingInquiry(null);
        }
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
  
  // Sort by date (descending) and then time
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
    { key: 'all',            label: 'All' },
    { key: 'booking',        label: 'Bookings' },
    { key: 'inquiry',        label: 'Inquiries' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange/80 mb-2">
            Bookings & Inquiries
          </p>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">Customer Appointments</h2>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
          {/* Date Picker */}
          <div className="relative w-full sm:w-48 shrink-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#121212] border border-gray-800 text-white text-sm pl-9 pr-8 py-2.5 rounded focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 transition-all font-mono [color-scheme:dark]"
            />
            {dateFilter && (
              <button
                onClick={() => { setDateFilter(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by name, phone, vehicle..."
              className="w-full bg-[#121212] border border-gray-800 text-white text-sm pl-9 pr-8 py-2.5 rounded focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 transition-all placeholder-gray-600 font-mono"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Matrix */}
      <div className="flex flex-wrap gap-2">
        {typeFilters.map(({ key, label }) => {
          const count = key === 'all' ? allItems.length : allItems.filter(b => b.eventType === key).length;
          const isActive = typeFilter === key;
          
          return (
            <button 
              key={key} 
              onClick={() => { setTypeFilter(key as any); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors rounded ${
                isActive
                  ? 'bg-brand-orange/10 border-brand-orange/50 text-brand-orange'
                  : 'bg-[#121212] border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {label}
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono leading-none ${
                isActive ? 'bg-brand-orange/20 text-brand-orange' : 'bg-gray-800 text-gray-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-lg bg-[#121212]/50">
          <Loader2 className="w-6 h-6 text-brand-orange animate-spin mb-3" />
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">Fetching Records...</p>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && status !== 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 border border-gray-800 border-dashed rounded-lg bg-[#121212]">
          <p className="text-gray-500 font-mono text-sm">
            {term ? `> No records matching query: "${search}"` : dateFilter ? `> No records on ${dateFilter}` : `> No records found for type: ${typeFilter}`}
          </p>
          {(term || dateFilter) && (
            <button onClick={() => { setSearch(''); setDateFilter(''); setCurrentPage(1); }} className="mt-4 px-4 py-2 border border-gray-700 hover:border-brand-orange hover:text-brand-orange text-xs text-gray-400 font-bold uppercase tracking-widest transition-colors rounded">
              Clear Query
            </button>
          )}
        </div>
      )}

      {/* Results Rendering */}
      {filtered.length > 0 && (
        <div className="bg-[#121212] border border-gray-800 rounded-lg overflow-hidden shadow-xl">
          
          {/* ── DESKTOP: DATA TABLE ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-[#151515] border-b border-gray-800">
                  {['Customer', 'Service / Vehicle', 'Appointment', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {paginatedItems.map(item => (
                  <tr
                    key={`${item.eventType}-${item.id}`}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => item.eventType === 'booking' ? onView(item.id) : onView('inq-' + item.id)}
                  >
                    {/* Client */}
                    <td className="px-5 py-4">
                      {item.eventType === 'booking' ? (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-bold uppercase tracking-widest bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded">Booking</span>
                            <p className="text-white font-bold text-sm">{item.name}</p>
                          </div>
                          <p className="text-gray-500 text-xs font-mono mt-0.5">{item.phone}</p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-bold uppercase tracking-widest bg-brand-orange/10 text-brand-orange border border-brand-orange/30 px-1.5 py-0.5 rounded">Inquiry</span>
                            <p className="text-white font-bold text-sm">{item.fullName}</p>
                          </div>
                          <p className="text-gray-500 text-xs font-mono mt-0.5">{item.contactNumber ?? item.emailAddress ?? 'No Contact'}</p>
                        </>
                      )}
                    </td>

                    {/* Service & Variations */}
                    <td className="px-5 py-4">
                      {item.eventType === 'booking' ? (
                        <>
                          <p className="text-gray-200 font-semibold text-sm">{item.serviceName}</p>
                          {item.selectedVariations && item.selectedVariations?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {item.selectedVariations.map(v => (
                                <span key={`${v.serviceId}-${v.variationId}`} className="inline-flex items-center text-[9px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400">
                                  <span className="text-brand-orange/60 mr-1">+</span>{v.variationName}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-gray-600 text-[10px] uppercase tracking-widest font-mono mt-2 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-gray-600" /> {item.vehicleInfo}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-200 font-semibold text-sm">{item.productToPurchase || 'Service Inquiry'}</p>
                          <p className="text-gray-600 text-[10px] uppercase tracking-widest font-mono mt-2 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-gray-600" /> {item.make} {item.model} {item.year ? `(${item.year})` : ''} {item.plateNumber ? `[${item.plateNumber}]` : ''}
                          </p>
                        </>
                      )}
                    </td>

                    {/* DateTime */}
                    <td className="px-5 py-4 text-gray-400 text-xs font-mono">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-600" /> {item.appointmentDate}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-600" /> {item.appointmentTime}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded border ${STATUS_STYLES[item.status] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                        {formatStatus(item.status as any)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => item.eventType === 'booking' ? onView(item.id) : onView('inq-' + item.id)}
                          title="View Details"
                          className="flex items-center justify-center w-8 h-8 bg-[#181818] border border-gray-700 hover:border-brand-orange hover:text-brand-orange text-gray-400 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {item.eventType === 'booking' && item.status === 'completed' && (
                          <button
                            onClick={() => void handleDownloadPdf(item)}
                            title="Download PDF"
                            disabled={pdfBusyId === item.id}
                            className="flex items-center justify-center w-8 h-8 bg-[#181818] border border-gray-700 hover:border-blue-400 hover:text-blue-300 text-gray-400 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {pdfBusyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </button>
                        )}
                        
                        {item.status !== 'cancelled' && item.status !== 'completed' && (
                          <button onClick={() => item.eventType === 'booking' ? handleCancelBooking(item.id) : handleCancelInquiry(item.id)}
                            title={`Cancel ${item.eventType === 'booking' ? 'Booking' : 'Inquiry'}`}
                            className="flex items-center justify-center w-8 h-8 bg-[#181818] border border-gray-700 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 text-gray-400 rounded transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); requestDelete(item); }}
                          title={`Delete ${item.eventType === 'booking' ? 'Booking' : 'Inquiry'}`}
                          disabled={deleteBusyId === item.id}
                          className="flex items-center justify-center w-8 h-8 bg-[#181818] border border-gray-700 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 text-gray-400 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {deleteBusyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── MOBILE: CARD GRID ── */}
          <div className="md:hidden divide-y divide-gray-800/50">
            {paginatedItems.map(item => (
              <div
                key={`${item.eventType}-${item.id}`}
                className="p-5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => item.eventType === 'booking' ? onView(item.id) : onView('inq-' + item.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    {item.eventType === 'booking' ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded">Booking</span>
                          <p className="text-white font-bold text-sm leading-tight">{item.name}</p>
                        </div>
                        <p className="text-gray-500 text-[11px] font-mono mt-1">{item.phone}</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-brand-orange/10 text-brand-orange border border-brand-orange/30 px-1.5 py-0.5 rounded">Inquiry</span>
                          <p className="text-white font-bold text-sm leading-tight">{item.fullName}</p>
                        </div>
                        <p className="text-gray-500 text-[11px] font-mono mt-1">{item.contactNumber ?? item.emailAddress ?? 'No Contact'}</p>
                      </>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded border shrink-0 ${STATUS_STYLES[item.status] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                    {formatStatus(item.status as any)}
                  </span>
                </div>
                
                <div className="mb-4 bg-[#151515] border border-gray-800/80 p-3 rounded">
                  {item.eventType === 'booking' ? (
                    <>
                      <p className="text-gray-200 text-sm font-semibold">{item.serviceName}</p>
                      {item.selectedVariations && item.selectedVariations?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.selectedVariations.map(v => (
                            <span key={`${v.serviceId}-${v.variationId}`} className="inline-flex items-center text-[9px] font-mono bg-black/20 border border-white/5 px-1.5 py-0.5 rounded text-gray-400">
                              <span className="text-brand-orange/60 mr-1">+</span>{v.variationName}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-mono mt-3 border-t border-gray-800/80 pt-2">
                        {item.vehicleInfo}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-200 text-sm font-semibold">{item.productToPurchase || 'Service Inquiry'}</p>
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-mono mt-3 border-t border-gray-800/80 pt-2 flex flex-wrap items-center gap-1.5">
                        {item.make} {item.model} {item.year ? `(${item.year})` : ''} {item.plateNumber ? `[${item.plateNumber}]` : ''}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-600" /> {item.appointmentDate}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-600" /> {item.appointmentTime}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {item.eventType === 'booking' && item.status === 'completed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDownloadPdf(item); }}
                        title="Download PDF"
                        disabled={pdfBusyId === item.id}
                        className="p-1.5 text-gray-500 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {pdfBusyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </button>
                    )}

                    {item.status !== 'cancelled' && item.status !== 'completed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); item.eventType === 'booking' ? handleCancelBooking(item.id) : handleCancelInquiry(item.id); }}
                        title={`Cancel ${item.eventType === 'booking' ? 'Booking' : 'Inquiry'}`}
                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); requestDelete(item); }}
                      title={`Delete ${item.eventType === 'booking' ? 'Booking' : 'Inquiry'}`}
                      disabled={deleteBusyId === item.id}
                      className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deleteBusyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-gray-800 bg-[#151515] gap-4">
              <p className="text-xs text-gray-500 font-mono text-center sm:text-left">
                Showing <span className="text-white font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-white font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="text-white font-bold">{filtered.length}</span> results
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-700 rounded text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded text-xs font-bold font-mono transition-colors ${
                        page === currentPage
                          ? 'bg-brand-orange text-white'
                          : 'border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-700 rounded text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-md bg-[#101010] border border-red-500/30 rounded-lg shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-red-500/20 bg-red-500/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">Delete {deleteTarget.type === 'booking' ? 'Booking' : 'Inquiry'}</p>
                <h3 className="text-sm font-semibold text-white">This action cannot be undone.</h3>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-300">
                Permanently delete {deleteTarget.type} for <span className="font-semibold text-white">{deleteTarget.name}</span>?
              </p>
            </div>

            <div className="px-5 py-4 border-t border-gray-800 bg-[#0c0c0c] flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusyId !== null}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBusyId !== null}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-red-500/50 text-red-200 hover:bg-red-500/15 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteBusyId === deleteTarget.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{deleteBusyId === deleteTarget.id ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}