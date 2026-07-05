import { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ChevronLeft, ChevronRight, Calendar, Loader2, CalendarX } from 'lucide-react';
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
    setEditDateObj(new Date(`${event.appointmentDate}T${event.appointmentTime}`));
    setEditTime(event.appointmentTime);
    setAvailableSlots([]);
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
              <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-3 space-y-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">New date</label>
                  <div className="mt-2 rounded-xl border border-gray-700 bg-gray-950 p-2 shadow-inner">
                    <DatePicker
                      selected={editDateObj}
                      onChange={(date: Date | null) => {
                        setEditDateObj(date);
                        setEditDate(formatDateForInput(date));
                      }}
                      minDate={new Date()}
                      dateFormat="MMMM d, yyyy"
                      placeholderText="Select a date"
                      className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-brand-orange focus:outline-none"
                      wrapperClassName="w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">New time</label>
                  <div className="mt-2 rounded-xl border border-gray-700 bg-gray-950 p-2 shadow-inner">
                    <select
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      disabled={availabilityLoading}
                      className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-orange"
                    >
                      <option value="">Select a time slot</option>
                      {availableSlots.map((slot) => {
                        const remaining = slotCapacity !== null ? Math.max(slotCapacity - (slotCounts[slot] ?? 0), 0) : null;
                        return (
                          <option key={slot} value={slot}>{slot}{remaining !== null ? ` (${remaining} left)` : ''}</option>
                        );
                      })}
                    </select>
                  </div>
                  {availabilityLoading && <p className="text-xs text-gray-500 mt-2">Checking availability...</p>}
                  {!availabilityLoading && availableSlots.length === 0 && (
                    <p className="text-xs text-red-400 mt-2">No available slots for this date.</p>
                  )}
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
