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
import { ModalShell } from './_sharedComponents';
import CustomCalendar from '../../components/CustomCalendar';

const STATUS_STYLES: Record<string, string> = {
  pending:        'bg-yellow-500/10 text-yellow-500  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  in_progress:    'bg-sky-500/10    text-sky-400     border-sky-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-[#1a1a1a]     text-gray-500    border-gray-800',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

const STATUS_DOT: Record<string, string> = {
  pending:        'bg-yellow-400',
  confirmed:      'bg-green-400',
  in_progress:    'bg-sky-400',
  completed:      'bg-blue-400',
  cancelled:      'bg-gray-500',
  awaiting_parts: 'bg-purple-400',
};

const INQUIRY_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;

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

const parseDateOnly = (value?: string | null): Date | null => {
  if (!value) return null;
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

interface Props {
  onView: (bookingId: string) => void;
}

export default function BookingsPanel({ onView }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const { appointments, status } = useSelector((s: RootState) => s.booking);
  
  const [inquiries, setInquiries] = useState<InquiryEvent[]>([]);
  const [closedDates, setClosedDates] = useState<{ date: string; reason: string | null; isYearly: boolean }[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'booking' | 'inquiry' } | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  // Inquiry Modal state
  const [viewingInquiry, setViewingInquiry] = useState<InquiryEvent | null>(null);
  const [isEditingInquiry, setIsEditingInquiry] = useState(false);
  const [editDate, setEditDate] = useState<string>('');
  const [editDateObj, setEditDateObj] = useState<Date | null>(null);
  const [editTime, setEditTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [editDayIsOpen, setEditDayIsOpen] = useState(true);
  const [editClosureReason, setEditClosureReason] = useState<string | null>(null);
  const [editCloseTime, setEditCloseTime] = useState('18:00');
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [slotCapacity, setSlotCapacity] = useState<number | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (token) {
      dispatch(fetchAllBookingsAsync(token));
      fetchInquiryCalendarApi()
        .then(data => setInquiries(data.events ?? []))
        .catch(err => console.error(err));
      fetchShopClosedDatesApi()
        .then(data => setClosedDates((data as any).closedDates ?? []))
        .catch(() => {});
    }
  }, [token, dispatch]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (showStatusMenu && statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showStatusMenu]);

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

  const openInquiryModal = async (event: InquiryEvent) => {
    setViewingInquiry(event);
    setIsEditingInquiry(false);
    setModalError(null);
    setEditDate(event.appointmentDate);
    setEditDateObj(parseDateOnly(event.appointmentDate));
    setEditTime(event.appointmentTime);
    setAvailableSlots([]);
    setEditDayIsOpen(true);
    setEditClosureReason(null);
    setEditCloseTime('18:00');
    await loadAvailability(event.appointmentDate);
  };

  const closeInquiryModal = () => {
    setViewingInquiry(null);
    setIsEditingInquiry(false);
    setModalError(null);
    setAvailableSlots([]);
    setSlotCounts({});
    setSlotCapacity(null);
    setEditDate('');
    setEditTime('');
    setEditDayIsOpen(true);
    setEditClosureReason(null);
    setEditCloseTime('18:00');
  };

  const saveInquirySchedule = async () => {
    if (!viewingInquiry || !token) return;
    if (!editDate || !editTime) {
      setModalError('Please select a valid date and time.');
      return;
    }
    setActionLoading(true);
    setModalError(null);
    try {
      await rescheduleInquiryApi(token, viewingInquiry.id, editDate, editTime);
      setInquiries((prev) => prev.map((inq) => inq.id === viewingInquiry.id ? { ...inq, appointmentDate: editDate, appointmentTime: editTime } : inq));
      setViewingInquiry((current) => current ? { ...current, appointmentDate: editDate, appointmentTime: editTime } : current);
      setIsEditingInquiry(false);
      showToast('Inquiry rescheduled.', 'success');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save schedule changes.');
    } finally {
      setActionLoading(false);
    }
  };

  const changeInquiryStatus = async (newStatus: string) => {
    if (!viewingInquiry || !token) return;
    setStatusLoading(true);
    setModalError(null);
    setShowStatusMenu(false);
    try {
      const res = await updateInquiryStatusApi(token, viewingInquiry.id, newStatus);
      const updated = res.inquiry;
      setInquiries((prev) => prev.map((iq) => iq.id === updated.id ? { ...iq, status: updated.status } : iq));
      setViewingInquiry((cur) => cur ? { ...cur, status: updated.status } : cur);
      showToast('Status updated.', 'success');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  };

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
          closeInquiryModal();
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
    .filter(item => statusFilter === 'all' || item.status === statusFilter)
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

  const filters: Array<{ key: 'all' | string; label: string }> = [
    { key: 'all',            label: 'All' },
    { key: 'pending',        label: 'Pending' },
    { key: 'confirmed',      label: 'Confirmed' },
    { key: 'awaiting_parts', label: 'Awaiting Parts' },
    { key: 'in_progress',    label: 'In Progress' },
    { key: 'completed',      label: 'Completed' },
    { key: 'cancelled',      label: 'Cancelled' },
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

        {/* Search */}
        <div className="relative w-full lg:w-80 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, vehicle..."
            className="w-full bg-[#121212] border border-gray-800 text-white text-sm pl-9 pr-8 py-2.5 rounded focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 transition-all placeholder-gray-600 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Matrix */}
      <div className="flex flex-wrap gap-2">
        {filters.map(({ key, label }) => {
          const count = key === 'all' ? allItems.length : allItems.filter(b => b.status === key).length;
          const isActive = statusFilter === key;
          
          return (
            <button 
              key={key} 
              onClick={() => setStatusFilter(key)}
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
            {term ? `> No records matching query: "${search}"` : `> No records found for status: ${statusFilter}`}
          </p>
          {term && (
            <button onClick={() => setSearch('')} className="mt-4 px-4 py-2 border border-gray-700 hover:border-brand-orange hover:text-brand-orange text-xs text-gray-400 font-bold uppercase tracking-widest transition-colors rounded">
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
                {filtered.map(item => (
                  <tr
                    key={`${item.eventType}-${item.id}`}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => item.eventType === 'booking' ? onView(item.id) : openInquiryModal(item)}
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
                        <button onClick={() => item.eventType === 'booking' ? onView(item.id) : openInquiryModal(item)}
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
            {filtered.map(item => (
              <div
                key={`${item.eventType}-${item.id}`}
                className="p-5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => item.eventType === 'booking' ? onView(item.id) : openInquiryModal(item)}
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

      {/* Inquiry Modal */}
      {viewingInquiry && (
        <ModalShell
          title="Inquiry Schedule"
          description="View, edit, or delete this inquiry appointment."
          onClose={closeInquiryModal}
          size="2xl"
        >
          <div className="space-y-4">
              <div className="rounded-lg border border-gray-800 bg-gray-900/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Customer</p>
                <p className="mt-1 text-lg font-bold text-white leading-snug">{viewingInquiry.fullName}</p>
                <p className="text-xs text-gray-300 mt-1 truncate">{viewingInquiry.emailAddress ?? 'No email'}{viewingInquiry.contactNumber ? ` • ${viewingInquiry.contactNumber}` : ''}</p>
              </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Vehicle</p>
                <p className="mt-1 text-sm font-bold text-white">{viewingInquiry.make} {viewingInquiry.model}{viewingInquiry.year ? ` ${viewingInquiry.year}` : ''}</p>
                <p className="text-xs text-gray-400 mt-1">{viewingInquiry.productToPurchase || 'Service inquiry'}</p>
                {viewingInquiry.plateNumber && (
                  <p className="text-xs text-gray-400 mt-1">Plate: {viewingInquiry.plateNumber}</p>
                )}
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3 flex flex-col justify-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</p>
                <div className="mt-1 relative" ref={statusMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowStatusMenu((s) => !s)}
                    disabled={statusLoading}
                    className={`flex items-center gap-2 text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full focus:outline-none ${STATUS_STYLES[viewingInquiry.status] ?? 'bg-gray-900 text-gray-300 border border-gray-700'}`}
                  >
                    <span>{formatStatus(viewingInquiry.status as any)}</span>
                    <span className="text-xs opacity-80">▾</span>
                  </button>
                  {showStatusMenu && (
                    <div className="absolute right-0 mt-2 w-44 rounded-md border border-gray-800 bg-gray-950 z-50 shadow-lg overflow-hidden">
                      {INQUIRY_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { changeInquiryStatus(s); }}
                          disabled={statusLoading}
                          className={`w-full text-left px-3 py-2 text-sm ${s === viewingInquiry.status ? 'bg-gray-900' : 'hover:bg-gray-900/60'}`}
                        >
                          <span className={`inline-block w-2 h-2 mr-2 rounded-full ${STATUS_DOT[s] ?? 'bg-gray-500'}`} />{formatStatus(s as any)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

                  <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Scheduled appointment</p>
                        <div className="flex items-center gap-2">
                          <p className="mt-1 text-sm font-bold text-white">{viewingInquiry.appointmentDate} • {viewingInquiry.appointmentTime}</p>
                          {slotCapacity !== null && viewingInquiry.appointmentTime && (() => {
                            const rem = Math.max((slotCapacity - (slotCounts[viewingInquiry.appointmentTime] ?? 0)), 0);
                            const cls = rem === 0
                              ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                              : rem === 1
                                ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30'
                                : 'bg-green-500/10 text-green-300 border border-green-500/30';
                            return (
                              <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{rem} left</span>
                            );
                          })()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditingInquiry(true)}
                        className="rounded-md border border-brand-orange/30 bg-transparent px-3 py-1 text-xs font-semibold text-brand-orange transition hover:bg-brand-orange/6"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

            {isEditingInquiry && (
              <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-3 space-y-3">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-400">New date</p>
                    <CustomCalendar
                      value={editDateObj}
                      onChange={(date: Date) => {
                        setEditDateObj(date);
                        setEditDate(formatDateForInput(date));
                        setEditTime('');
                      }}
                      availableDates={(() => {
                        const dates: Date[] = [];
                        const cursor = new Date();
                        cursor.setHours(0, 0, 0, 0);
                        for (let index = 0; index < 14; index += 1) {
                          dates.push(new Date(cursor));
                          cursor.setDate(cursor.getDate() + 1);
                        }
                        return dates;
                      })()}
                      closedDatesSet={new Set(closedDates.map((item) => item.date))}
                      allowAnyDate={true}
                      showAvailabilityIndicators={false}
                    />
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-400">
                        <Clock className="h-3.5 w-3.5" /> New time
                      </label>
                      {availabilityLoading && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                        </span>
                      )}
                    </div>

                    {!editDate ? (
                      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 bg-black/20 p-6 text-center">
                        <Calendar className="mb-3 h-8 w-8 text-gray-700" />
                        <p className="text-sm text-gray-500">Select a date from the calendar to view available time slots.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {!availabilityLoading && !editDayIsOpen && (
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-center text-sm text-amber-300">
                            {editClosureReason
                              ? `Currently not accepting appointments – ${editClosureReason}.`
                              : 'Currently not accepting appointments for this date.'}
                          </div>
                        )}

                        {!availabilityLoading && editDayIsOpen && (() => {
                          let openMinutes = 6 * 60;

                          const [closeHStr, closeMStr] = editCloseTime.split(':');
                          const closeHNum = Number(closeHStr || '0');
                          const closeMNum = Number(closeMStr || '0');
                          let closeMinutes = (closeHNum % 24) * 60 + closeMNum;
                          if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

                          const now = new Date();
                          const nowMinutes = now.getHours() * 60 + now.getMinutes();
                          const isTodaySelected = !!editDateObj && isSameLocalDay(editDateObj, now);
                          const visibleSlots = availableSlots.filter((time) => {
                            let slotTimeMinutes = slotToMinutes(time);
                            if (slotTimeMinutes < openMinutes) slotTimeMinutes += 24 * 60;
                            return slotTimeMinutes <= closeMinutes && (!isTodaySelected || slotTimeMinutes > nowMinutes);
                          });

                          return (
                            <>
                              <p className="border-b border-gray-800 pb-3 text-xs text-gray-500">
                                {editDayIsOpen
                                  ? `We are currently accepting appointments from 6:00 AM to ${formatCloseTimeString(editCloseTime)}.`
                                  : 'We are currently not accepting appointments for this date.'}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {visibleSlots.length === 0 && !isTodaySelected && (
                                  <p className="col-span-full rounded-lg border border-brand-orange/10 bg-brand-orange/5 px-3 py-6 text-center text-sm text-brand-orange/80">
                                    No available slots for this date.
                                  </p>
                                )}
                                {visibleSlots.length === 0 && isTodaySelected && (
                                  <p className="col-span-full rounded-lg border border-brand-orange/10 bg-brand-orange/5 px-3 py-6 text-center text-sm text-brand-orange/80">
                                    No available slots left for today.
                                  </p>
                                )}
                                {visibleSlots.map((slot) => {
                                  const isSelected = editTime === slot;
                                  const completion = slotCompletionLabel(slot, 4);
                                  const takenCount = slotCounts[slot] ?? 0;
                                  const spotsLeft = (slotCapacity ?? 2) - takenCount;
                                  const almostFull = spotsLeft === 1;
                                  const displayTime = slot;

                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => setEditTime(slot)}
                                      className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition-all duration-200 focus:outline-none ${
                                        isSelected
                                          ? 'border-brand-orange bg-brand-orange text-white shadow-[0_0_10px_rgba(255,102,0,0.3)]'
                                          : 'border-gray-700 bg-black/20 text-gray-300 hover:border-brand-orange/70 hover:bg-black/40 hover:text-white'
                                      }`}
                                    >
                                      <span className="text-sm font-bold tracking-wide">{displayTime}</span>
                                      <span className={`mt-1 text-[10px] ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                                        done by {completion}
                                      </span>
                                      {spotsLeft > 0 && (
                                        <span className={`mt-1 text-[10px] font-semibold ${isSelected ? 'text-white' : almostFull ? 'text-brand-orange' : 'text-gray-500'}`}>
                                          {almostFull ? 'Last spot!' : `${spotsLeft} spots left`}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                {modalError && (
                  <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-200">
                    {modalError}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditingInquiry(false)}
                    disabled={actionLoading}
                    className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-gray-300 hover:border-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveInquirySchedule}
                    disabled={actionLoading || !editDate || !editTime}
                    className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-black disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  requestDelete({ ...viewingInquiry, eventType: 'inquiry' } as any);
                }}
                disabled={actionLoading}
                className="rounded-md border border-red-500/30 bg-transparent px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}