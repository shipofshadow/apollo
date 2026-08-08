// @ts-nocheck
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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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
  plateNumber?: string;
}

type CalendarEventItem = (Booking & { eventType: 'booking' }) | (InquiryEvent & { eventType: 'inquiry' });

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-transparent text-yellow-500 border border-yellow-500/40',
  confirmed: 'bg-transparent text-green-500 border border-green-500/40',
  in_progress: 'bg-transparent text-sky-500 border border-sky-500/40',
  completed: 'bg-transparent text-blue-500 border border-blue-500/40',
  cancelled: 'bg-transparent text-gray-400 border border-gray-700',
  awaiting_parts: 'bg-transparent text-amber-500 border border-amber-500/40',
};

// Statuses that apply to inquiries only — awaiting_parts is booking-only.

const TYPE_BADGE: Record<'booking' | 'inquiry', string> = {
  booking: 'bg-transparent text-sky-400 border border-sky-400/40',
  inquiry: 'bg-transparent text-[#f97316] border border-[#f97316]/40',
};

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-green-500',
  in_progress: 'bg-sky-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-gray-500',
  awaiting_parts: 'bg-amber-500',
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

export default function CalendarPanel({ onView }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { appointments, status } = useSelector((s: RootState) => s.booking);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<InquiryEvent[]>([]);
  const [viewingEvent, setViewingEvent] = useState<CalendarEventItem | null>(null);
  const [isEditingInquiry, setIsEditingInquiry] = useState(false);
  const [editDate, setEditDate] = useState<string>('');
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
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [closedDates, setClosedDates] = useState<{ date: string; reason: string | null; isYearly: boolean }[]>([]);
  const [editDayIsOpen, setEditDayIsOpen] = useState(true);

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

  useEffect(() => {
    if (token) dispatch(fetchAllBookingsAsync(token));
    fetchShopClosedDatesApi()
      .then(data => setClosedDates((data as { closedDates: { date: string; reason: string | null; isYearly: boolean }[] }).closedDates ?? []))
      .catch(() => { });

    const loadInquiries = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInquiryCalendarApi(token ?? '');
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
  const firstDay = new Date(year, month, 1).getDay();  // 0=Sun
  const daysInMo = new Date(year, month + 1, 0).getDate();
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

  const todayIso = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

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
                  className={`min-h-[64px] border-r border-b border-gray-800 p-1 cursor-pointer transition-colors hover:bg-gray-800/60 ${isSelected ? 'bg-brand-orange/10 border-brand-orange' : closure ? 'bg-red-500/5 border-red-500/30' : ''
                    }`}
                >
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1 ${isToday
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
                  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
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
                      onClick={() => event.eventType === 'inquiry' ? onView?.('inq-' + event.id) : onView?.(event.id)}
                      className="group relative flex flex-col gap-3 rounded-[20px] border border-gray-800 bg-[#14161a] p-4 transition-colors hover:border-brand-orange/50 hover:bg-[#1a1c22] cursor-pointer overflow-hidden"
                    >
                      {/* Left Accent Bar */}
                      <div className={`absolute left-3 top-4 bottom-4 w-1.5 rounded-full ${STATUS_DOT[event.status]}`} />

                      <div className="pl-6 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className={`text-[9px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full ${TYPE_BADGE[event.eventType]}`}>
                            {event.eventType === 'booking' ? 'Booking' : 'Inquiry'}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full ${STATUS_BADGE[event.status] ?? 'bg-transparent text-gray-300 border border-gray-700'}`}>
                            {formatStatus(event.status)}
                          </span>
                        </div>
                        <h3 className="text-[16px] font-black uppercase text-white truncate leading-none mb-1 font-display tracking-wide">
                          {event.eventType === 'booking'
                            ? event.serviceName
                            : `${event.make} ${event.model}${event.year ? ` ${event.year}` : ''}`}
                        </h3>
                        <p className="text-gray-400 text-[13px] truncate">
                          {event.eventType === 'booking'
                            ? event.name
                            : event.fullName}
                        </p>
                        <p className="text-gray-500 text-[12px] mt-0.5 truncate">
                          {event.eventType === 'booking'
                            ? `${event.email} • ${event.phone}`
                            : `${event.emailAddress || 'No email'}${event.contactNumber ? ` • ${event.contactNumber}` : ''}`}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 pl-6">
                        <div className="rounded-[12px] border border-gray-800/60 bg-[#0d1015] p-4 flex flex-col items-start">
                          <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500 mb-3">Time</p>
                          <p className="text-[16px] font-black text-white leading-tight">{formatAppointmentTime(event.appointmentTime).time}</p>
                          <p className="text-[16px] font-black text-white leading-tight">{formatAppointmentTime(event.appointmentTime).suffix}</p>
                        </div>
                        <div className="rounded-[12px] border border-gray-800/60 bg-[#0d1015] p-4 flex flex-col items-start min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500 mb-3">
                            {event.eventType === 'booking' ? 'Details' : 'Product'}
                          </p>
                          <p className="text-[14px] font-bold text-white leading-snug break-words w-full">
                            {event.eventType === 'booking' ? 'Booking Details' : (event.productToPurchase || 'Service inquiry')}
                          </p>
                          {event.plateNumber && (
                            <p className="text-[12px] text-gray-400 mt-auto pt-4">Plate: {event.plateNumber}</p>
                          )}
                        </div>
                      </div>

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
    </div>
  );
}
