import { useState, useEffect, useRef } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { ChevronLeft, ChevronRight, Calendar, Loader2, CalendarX, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllBookingsAsync } from '../../store/bookingSlice';
import {
  fetchShopClosedDatesApi,
  fetchInquiryCalendarApi,
  fetchInquiryAvailabilityApi,
  deleteInquiryApi,
  rescheduleInquiryApi,
  updateInquiryStatusApi,
} from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatStatus } from '../../utils/formatStatus';
import { ModalShell } from './_sharedComponents';
import CustomCalendar from '../../components/CustomCalendar';

const STATUS_DOT: Record<Booking['status'] | string, string> = {
  pending:        'bg-yellow-400',
  confirmed:      'bg-green-400',
  completed:      'bg-blue-400',
  cancelled:      'bg-gray-500',
  awaiting_parts: 'bg-purple-400',
};

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface Props {
  onView?: (bookingId: string) => void;
  isAdminPage?: boolean;
}

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
}

type CalendarEventItem = (Booking & { eventType: 'booking' }) | (InquiryEvent & { eventType: 'inquiry' });

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30',
  confirmed: 'bg-green-500/10 text-green-300 border border-green-500/30',
  completed: 'bg-blue-500/10 text-sky-300 border border-blue-500/30',
  cancelled: 'bg-gray-700 text-gray-300 border border-gray-600',
  awaiting_parts: 'bg-purple-500/10 text-purple-300 border border-purple-500/30',
};

const TYPE_BADGE: Record<'booking' | 'inquiry', string> = {
  booking: 'bg-sky-500/10 text-sky-300 border border-sky-500/20',
  inquiry: 'bg-brand-orange/10 text-brand-orange border border-brand-orange/20',
};

const formatAppointmentTime = (value?: string | null) => {
  if (!value) {
    return { time: '--:--', suffix: '' };
  }

  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{1,2}:\d{2})(?:\s*([ap]\.?m\.?))?$/i);
  if (!match) {
    return { time: normalized, suffix: '' };
  }

  const [, time, meridiem] = match;
  const suffix = meridiem ? meridiem.replace(/\./g, '').toUpperCase() : '';
  return { time, suffix };
};

const formatDateForInput = (date: Date | null) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value?: string | null): Date | null => {
  if (!value) return null;

  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};



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
    return '11:59 PM';
  }
  const h = Math.floor(endRaw / 60) % 24;
  const m = endRaw % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, 'h:mm aa');
}

function formatCloseTimeString(closeTime: string): string {
  if (!closeTime) return '';
  if (closeTime === '00:00' || closeTime === '24:00') return '11:59 PM';
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

export default function CalendarPanel({ onView }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { appointments, status } = useSelector((s: RootState) => s.booking);

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [closedDates, setClosedDates] = useState<{ date: string; reason: string | null; isYearly: boolean }[]>([]);
  const [inquiries, setInquiries] = useState<InquiryEvent[]>([]);
  const [viewingEvent, setViewingEvent] = useState<CalendarEventItem | null>(null);
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  const openInquiryModal = async (event: CalendarEventItem) => {
    setViewingEvent(event);
    setIsEditingInquiry(false);
    setModalError(null);
    setEditDate(event.appointmentDate);
    setEditDateObj(parseDateOnly(event.appointmentDate));
    setEditTime(event.appointmentTime);
    setAvailableSlots([]);
    setEditDayIsOpen(true);
    setEditClosureReason(null);
    setEditCloseTime('18:00');
    if (event.eventType === 'inquiry') {
      await loadAvailability(event.appointmentDate);
    }
  };

  const closeInquiryModal = () => {
    setViewingEvent(null);
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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (showStatusMenu && statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showStatusMenu]);

  const saveInquirySchedule = async () => {
    if (!viewingEvent || viewingEvent.eventType !== 'inquiry' || !token) return;
    if (!editDate || !editTime) {
      setModalError('Please select a valid date and time.');
      return;
    }

    setActionLoading(true);
    setModalError(null);

    try {
      await rescheduleInquiryApi(token, viewingEvent.id, editDate, editTime);
      setInquiries((prev) => prev.map((inquiry) => inquiry.id === viewingEvent.id ? { ...inquiry, appointmentDate: editDate, appointmentTime: editTime } : inquiry));
      if (selectedDate === viewingEvent.appointmentDate) {
        setSelectedDate(editDate);
      }
      setViewingEvent((current) => current && current.eventType === 'inquiry' ? { ...current, appointmentDate: editDate, appointmentTime: editTime } : current);
      setIsEditingInquiry(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save schedule changes.');
    } finally {
      setActionLoading(false);
    }
  };

  const changeInquiryStatus = async (newStatus: string) => {
    if (!viewingEvent || viewingEvent.eventType !== 'inquiry' || !token) return;
    setStatusLoading(true);
    setModalError(null);
    try {
      const res = await updateInquiryStatusApi(token, viewingEvent.id, newStatus);
      const updated = res.inquiry;
      setInquiries((prev) => prev.map((iq) => iq.id === updated.id ? { ...iq, status: updated.status } : iq));
      setViewingEvent((cur) => cur && cur.eventType === 'inquiry' ? { ...cur, status: updated.status } : cur);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  };

  const deleteInquiry = async (id: string) => {
    if (!token) return;
    if (!window.confirm('Delete this inquiry from the calendar?')) return;

    setActionLoading(true);
    setModalError(null);

    try {
      const result = await deleteInquiryApi(token, id);
      if (!result.deleted) {
        throw new Error('Unable to delete inquiry.');
      }
      setInquiries((prev) => prev.filter((inquiry) => inquiry.id !== id));
      if (viewingEvent?.id === id) {
        closeInquiryModal();
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to delete inquiry.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (token) dispatch(fetchAllBookingsAsync(token));
    fetchShopClosedDatesApi()
      .then(data => setClosedDates((data as { closedDates: { date: string; reason: string | null; isYearly: boolean }[] }).closedDates ?? []))
      .catch(() => {});

    const loadInquiries = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInquiryCalendarApi();
        setInquiries(data.events ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load inquiry calendar.');
      } finally {
        setLoading(false);
      }
    };

    void loadInquiries();
  }, [token, dispatch]);

  // Load availability for the currently selected day so event cards can show remaining spots
  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      setSlotCounts({});
      setSlotCapacity(null);
      return;
    }

    void loadAvailability(selectedDate);
  }, [selectedDate]);

  const renderFetchStatus = () => {
    if (status === 'loading' || loading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-sm bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-200">
          {error}
        </div>
      );
    }

    return null;
  };


  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(null);
  };

  // Build calendar grid
  const firstDay  = new Date(year, month, 1).getDay();  // 0=Sun
  const daysInMo  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  // Group all calendar events by date string, including bookings and inquiries
  const eventsByDate = new Map<string, CalendarEventItem[]>();

  appointments.forEach((b) => {
    const list = eventsByDate.get(b.appointmentDate) ?? [];
    list.push({ ...b, eventType: 'booking' });
    eventsByDate.set(b.appointmentDate, list);
  });

  inquiries.forEach((i) => {
    const list = eventsByDate.get(i.appointmentDate) ?? [];
    list.push({ ...i, eventType: 'inquiry' });
    eventsByDate.set(i.appointmentDate, list);
  });

  const isoForDay = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const todayIso = today.toISOString().split('T')[0];

  // Helper to find closure for a specific date (handles yearly closures)
  const getClosureForDate = (dateIso: string) => {
    // First check exact match (one-time closure)
    const exactMatch = closedDates.find(cd => cd.date === dateIso && !cd.isYearly);
    if (exactMatch) return exactMatch;

    // Then check yearly closures by month-day
    const targetMonthDay = dateIso.slice(5); // MM-DD
    return closedDates.find(cd => cd.isYearly && cd.date.slice(5) === targetMonthDay);
  };

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-display font-bold text-white uppercase tracking-wide">
          Booking Calendar
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            className="p-1.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-bold text-xs min-w-[120px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {renderFetchStatus()}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="xl:col-span-2 bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-800">
            {DAYS.map(d => (
              <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="min-h-[72px] border-r border-b border-gray-800 last:border-r-0" />;
              }
              const iso = isoForDay(day);
              const dayEvents = eventsByDate.get(iso) ?? [];
              const closure = getClosureForDate(iso);
              const isToday = iso === todayIso;
              const isSelected = iso === selectedDate;
              const activeCount = dayEvents.filter((e) => e.status !== 'cancelled').length;

              return (
                <div
                  key={iso}
                  onClick={() => setSelectedDate(iso === selectedDate ? null : iso)}
                  className={`min-h-[64px] border-r border-b border-gray-800 p-1 cursor-pointer transition-colors hover:bg-gray-800/60 ${
                    isSelected ? 'bg-brand-orange/10 border-brand-orange' : closure ? 'bg-red-500/5 border-red-500/30' : ''
                  }`}
                >
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1 ${
                    isToday
                      ? 'bg-brand-orange text-white'
                      : closure
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : isSelected
                      ? 'text-brand-orange'
                      : 'text-gray-400'
                  }`}>
                    {day}
                  </div>

                  {closure && (
                    <div className="flex items-center gap-1 mb-1 px-1 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[9px] truncate">
                      <CalendarX className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="text-red-400 font-semibold truncate">Closed</span>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={`${event.eventType}-${event.id}`}
                        className="flex items-center gap-1 overflow-hidden"
                        title={
                          event.eventType === 'booking'
                            ? `${event.name} – ${event.serviceName}`
                            : `${event.fullName} – ${event.make} ${event.model}`
                        }
                      >
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${STATUS_DOT[event.status]}`} />
                        <span className="text-[9px] text-gray-400 truncate leading-tight hidden sm:block">
                          {event.eventType === 'booking'
                            ? event.serviceName.split(' ').slice(0, 2).join(' ')
                            : `${event.make} ${event.model}`}
                        </span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-[9px] text-gray-600">+{dayEvents.length - 2} more</p>
                    )}
                  </div>

                  {activeCount > 0 && (
                    <div className="mt-0.5">
                      <span className="text-[9px] font-bold text-brand-orange">{activeCount}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-orange" />
            <span className="text-sm font-bold text-white uppercase tracking-widest">
              {selectedDate
                ? (() => {
                    const [y, m, d] = selectedDate.split('-').map(Number);
                    return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
                  })()
                : 'Select a day'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
            {!selectedDate && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-600 gap-2">
                <Calendar className="w-8 h-8 opacity-30" />
                <p className="text-xs">Click a day to see bookings</p>
              </div>
            )}

            {selectedDate && (() => {
              const closure = getClosureForDate(selectedDate);
              const hasEvents = selectedEvents.length > 0;
              return (
                <>
                  {closure && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-sm p-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <CalendarX className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-sm font-bold text-red-400 uppercase tracking-widest">Shop Closed</span>
                        {closure.isYearly && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 ml-auto shrink-0">Yearly</span>
                        )}
                      </div>
                      {closure.reason && (
                        <p className="text-xs text-red-300">{closure.reason}</p>
                      )}
                    </div>
                  )}
                  {!hasEvents && !closure && (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-600 gap-2">
                      <Calendar className="w-8 h-8 opacity-30" />
                      <p className="text-xs">No appointments on this day</p>
                    </div>
                  )}
                  {selectedEvents.map((event) => (
                    <div
                      key={`${event.eventType}-${event.id}`}
                      onClick={() => event.eventType === 'inquiry' ? void openInquiryModal(event) : onView?.(event.id)}
                      className="group flex flex-col gap-2 rounded-2xl border border-gray-800 bg-brand-dark p-2.5 transition-colors hover:border-brand-orange/50 hover:bg-brand-darker cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-1.5 self-stretch rounded-full ${STATUS_DOT[event.status]}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <span className={`text-[10px] uppercase tracking-[0.25em] px-2 py-1 rounded-full ${TYPE_BADGE[event.eventType]}`}>
                              {event.eventType === 'booking' ? 'Booking' : 'Inquiry'}
                            </span>
                            <span className={`text-[10px] uppercase tracking-[0.25em] px-2 py-1 rounded-full ${STATUS_BADGE[event.status] ?? 'bg-gray-900 text-gray-300 border border-gray-700'}`}>
                              {formatStatus(event.status)}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-white truncate leading-tight">
                            {event.eventType === 'booking'
                              ? event.serviceName
                              : `${event.make} ${event.model}${event.year ? ` ${event.year}` : ''}`}
                          </h3>
                          <p className="text-gray-400 text-xs truncate">
                            {event.eventType === 'booking'
                              ? event.name
                              : event.fullName}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500">Time</p>
                          <div className="mt-2 flex items-center gap-2">
                            <p className="text-sm font-bold text-white">{formatAppointmentTime(event.appointmentTime).time} {formatAppointmentTime(event.appointmentTime).suffix}</p>
                            {slotCapacity !== null && event.appointmentTime && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800/60 border border-gray-700 text-gray-200">{Math.max(slotCapacity - (slotCounts[event.appointmentTime] ?? 0), 0)} left</span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500">Contact</p>
                          <p className="mt-2 text-sm text-white break-words">
                            {event.eventType === 'booking'
                              ? `${event.email} • ${event.phone}`
                              : `${event.emailAddress ?? 'No email'}${event.contactNumber ? ` • ${event.contactNumber}` : ''}`}
                          </p>
                        </div>
                      </div>
                      {event.eventType === 'inquiry' && (
                        <div className="rounded-2xl border border-gray-800 bg-brand-dark p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500">Product</p>
                          <p className="mt-2 text-sm font-bold text-white">{event.productToPurchase || 'Service inquiry'}</p>
                        </div>
                      )}
                      {event.eventType === 'booking' && (
                        <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500">Details</p>
                      )}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
        <span className="font-bold uppercase tracking-widest">Legend:</span>
        {Object.entries(STATUS_DOT).map(([s, cls]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cls}`} />
            {formatStatus(s as Booking['status'])}
          </span>
        ))}
      </div>

      {viewingEvent && viewingEvent.eventType === 'inquiry' && (
        <ModalShell
          title="Inquiry Schedule"
          description="View, edit, or delete this inquiry appointment."
          onClose={closeInquiryModal}
          size="2xl"
        >
          <div className="space-y-4">
              <div className="rounded-lg border border-gray-800 bg-gray-900/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Customer</p>
                <p className="mt-1 text-lg font-bold text-white leading-snug">{viewingEvent.fullName}</p>
                <p className="text-xs text-gray-300 mt-1 truncate">{viewingEvent.emailAddress ?? 'No email'}{viewingEvent.contactNumber ? ` • ${viewingEvent.contactNumber}` : ''}</p>
              </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Vehicle</p>
                <p className="mt-1 text-sm font-bold text-white">{viewingEvent.make} {viewingEvent.model}{viewingEvent.year ? ` ${viewingEvent.year}` : ''}</p>
                <p className="text-xs text-gray-400 mt-1">{viewingEvent.productToPurchase || 'Service inquiry'}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3 flex flex-col justify-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</p>
                <div className="mt-1 relative" ref={statusMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowStatusMenu((s) => !s)}
                    disabled={statusLoading}
                    className={`flex items-center gap-2 text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full focus:outline-none ${STATUS_BADGE[viewingEvent.status] ?? 'bg-gray-900 text-gray-300 border border-gray-700'}`}
                  >
                    <span>{formatStatus(viewingEvent.status)}</span>
                    <span className="text-xs opacity-80">▾</span>
                  </button>
                  {showStatusMenu && (
                    <div className="absolute right-0 mt-2 w-44 rounded-md border border-gray-800 bg-gray-950 z-50 shadow-lg overflow-hidden">
                      {Object.keys(STATUS_BADGE).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setShowStatusMenu(false); changeInquiryStatus(s); }}
                          disabled={statusLoading}
                          className={`w-full text-left px-3 py-2 text-sm ${s === viewingEvent.status ? 'bg-gray-900' : 'hover:bg-gray-900/60'}`}
                        >
                          <span className={`inline-block w-2 h-2 mr-2 rounded-full ${STATUS_DOT[s] ?? 'bg-gray-500'}`} />{formatStatus(s)}
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
                          <p className="mt-1 text-sm font-bold text-white">{viewingEvent.appointmentDate} • {viewingEvent.appointmentTime}</p>
                          {slotCapacity !== null && viewingEvent.appointmentTime && (() => {
                            const rem = Math.max((slotCapacity - (slotCounts[viewingEvent.appointmentTime] ?? 0)), 0);
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
                          // compute openMinutes (fallback 6:00) and next-day close handling
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
                                  const displayTime = (slot === '12:00 AM' && typeof closeMinutes !== 'undefined' && closeMinutes > 1439) ? '11:59 PM' : slot;

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
                onClick={() => viewingEvent && deleteInquiry(viewingEvent.id)}
                disabled={actionLoading}
                className="rounded-md border border-red-500/30 bg-transparent px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
