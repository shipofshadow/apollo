import { useState, useEffect, useMemo } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CalendarX, AlertCircle, Sparkles, CheckCircle2, User
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllBookingsAsync } from '../../store/bookingSlice';
import {
  fetchShopClosedDatesApi,
  fetchInquiryCalendarApi,
  fetchInquiryAvailabilityApi
} from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatStatus } from '../../utils/formatStatus';

const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
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
  pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
  confirmed: 'bg-green-500/10 text-green-400 border border-green-500/30',
  in_progress: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
  completed: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  cancelled: 'bg-gray-800 text-gray-400 border border-gray-700',
  awaiting_parts: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
};

const TYPE_BADGE: Record<'booking' | 'inquiry', string> = {
  booking: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
  inquiry: 'bg-brand-orange/10 text-brand-orange border border-brand-orange/30',
};

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-400',
  confirmed: 'bg-green-400',
  in_progress: 'bg-sky-400',
  completed: 'bg-blue-400',
  cancelled: 'bg-gray-500',
  awaiting_parts: 'bg-amber-400',
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

/* ── Calendar Skeleton Loader ───────────────────────────────────── */
function CalendarSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="h-20 bg-brand-dark border border-gray-800 rounded-xl" />
      <div className="h-16 bg-brand-dark border border-gray-800 rounded-xl" />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 h-96 bg-brand-dark border border-gray-800 rounded-xl" />
        <div className="xl:col-span-4 h-96 bg-brand-dark border border-gray-800 rounded-xl" />
      </div>
    </div>
  );
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
  const [slotCapacity, setSlotCapacity] = useState<number | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [closedDates, setClosedDates] = useState<{ date: string; reason: string | null; isYearly: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAvailability = async (date: string) => {
    if (!date) {
      setAvailableSlots([]);
      return;
    }

    try {
      const data = await fetchInquiryAvailabilityApi(date);
      setAvailableSlots(data.availableSlots ?? []);
      setSlotCapacity(typeof (data as any).slotCapacity === 'number' ? (data as any).slotCapacity : null);
    } catch {
      setAvailableSlots([]);
      setSlotCapacity(null);
    }
  };

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

  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      setSlotCapacity(null);
      return;
    }

    void loadAvailability(selectedDate);
  }, [selectedDate]);

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
  while (cells.length % 7 !== 0) cells.push(null);

  // Group all calendar events by date string
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    appointments.forEach((b) => {
      const list = map.get(b.appointmentDate) ?? [];
      list.push({ ...b, eventType: 'booking' });
      map.set(b.appointmentDate, list);
    });

    inquiries.forEach((i) => {
      const list = map.get(i.appointmentDate) ?? [];
      list.push({ ...i, eventType: 'inquiry' });
      map.set(i.appointmentDate, list);
    });
    return map;
  }, [appointments, inquiries]);

  const isoForDay = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const todayIso = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  const getClosureForDate = (dateIso: string) => {
    const exactMatch = closedDates.find(cd => cd.date === dateIso && !cd.isYearly);
    if (exactMatch) return exactMatch;
    const targetMonthDay = dateIso.slice(5);
    return closedDates.find(cd => cd.isYearly && cd.date.slice(5) === targetMonthDay);
  };

  // Calculated Stats for Current Month (zero API overhead)
  const monthStats = useMemo(() => {
    let totalAppointments = 0;
    let activeAppointments = 0;
    let inquiryCount = 0;
    let closedDaysCount = 0;

    for (let day = 1; day <= daysInMo; day++) {
      const iso = isoForDay(day);
      const evs = eventsByDate.get(iso) ?? [];
      totalAppointments += evs.length;
      activeAppointments += evs.filter(e => e.status !== 'cancelled').length;
      inquiryCount += evs.filter(e => e.eventType === 'inquiry').length;

      if (getClosureForDate(iso)) {
        closedDaysCount += 1;
      }
    }

    return { totalAppointments, activeAppointments, inquiryCount, closedDaysCount };
  }, [year, month, daysInMo, eventsByDate, closedDates]);

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];
  const selectedDateClosure = selectedDate ? getClosureForDate(selectedDate) : null;

  if (status === 'loading' || loading) {
    return <CalendarSkeleton />;
  }

  return (
    <div className="w-full space-y-6">

      {/* ── 1. Dashboard Header ───────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20 text-brand-orange shrink-0 mt-0.5">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Operations</span>
                <span className="text-gray-600 text-xs">•</span>
                <span className="text-xs text-gray-400">Schedule Overview</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-wide text-white mt-0.5">
                Booking Calendar
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
                Manage bookings, inquiries, availability, and shop schedule.
              </p>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2 shrink-0 bg-brand-darker border border-gray-800 p-1.5 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-all cursor-pointer"
            >
              Today
            </button>
            <div className="h-4 w-px bg-gray-800" />
            <button
              type="button"
              aria-label="Previous month"
              onClick={prevMonth}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white font-bold text-xs sm:text-sm min-w-[120px] text-center uppercase tracking-wider font-mono">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={nextMonth}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Error Display ──────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl bg-red-950/40 border border-red-500/30 p-4 text-xs sm:text-sm text-red-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="font-bold text-red-200 uppercase tracking-wide">Unable to load calendar</p>
            <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── 3. Summary Statistics Bar ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-brand-dark border border-gray-800 p-4 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Bookings</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-white mt-1">{monthStats.totalAppointments}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">scheduled in {MONTHS[month]}</p>
        </div>

        <div className="bg-brand-dark border border-gray-800 p-4 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Active Slots</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-green-400 mt-1">{monthStats.activeAppointments}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">confirmed / in progress</p>
        </div>

        <div className="bg-brand-dark border border-gray-800 p-4 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Inquiries</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-brand-orange mt-1">{monthStats.inquiryCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">pending confirmation</p>
        </div>

        <div className="bg-brand-dark border border-gray-800 p-4 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Closed Days</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-red-400 mt-1">{monthStats.closedDaysCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">holidays / events</p>
        </div>
      </div>

      {/* ── 4. Main Calendar & Command Center Split ───────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

        {/* ── Left: Calendar Grid (8 cols) ────────────────────────── */}
        <div className="xl:col-span-8 bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-gray-800 bg-brand-darker/60 text-center py-2.5">
            {DAYS_FULL.map((d, idx) => (
              <div key={d} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{DAYS_SHORT[idx]}</span>
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-gray-800/80">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="min-h-[90px] bg-brand-darker/30" />;
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
                  tabIndex={0}
                  role="button"
                  aria-label={`${iso}: ${dayEvents.length} events${closure ? ', shop closed' : ''}`}
                  onClick={() => setSelectedDate(iso === selectedDate ? null : iso)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedDate(iso === selectedDate ? null : iso); }}
                  className={`min-h-[95px] p-2 flex flex-col justify-between cursor-pointer transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-brand-orange ${
                    isSelected
                      ? 'bg-brand-orange/15 ring-2 ring-brand-orange shadow-inner'
                      : closure
                      ? 'bg-red-950/20 border-red-500/20 hover:bg-red-900/30'
                      : isToday
                      ? 'bg-brand-orange/5 hover:bg-brand-darker/60'
                      : 'hover:bg-brand-darker/60'
                  }`}
                >
                  {/* Top: Day Number & Status */}
                  <div className="flex items-center justify-between">
                    <span className={`w-6 h-6 rounded-full font-mono text-xs font-bold flex items-center justify-center ${
                      isToday
                        ? 'bg-brand-orange text-white shadow-md'
                        : closure
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isSelected
                        ? 'text-brand-orange font-black'
                        : 'text-gray-300'
                    }`}>
                      {day}
                    </span>

                    {isToday && (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-brand-orange hidden sm:inline">
                        TODAY
                      </span>
                    )}
                  </div>

                  {/* Middle: Events Preview */}
                  <div className="my-1.5 space-y-1">
                    {closure ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-[9px] text-red-400 font-bold uppercase tracking-wider">
                        <CalendarX className="w-3 h-3 shrink-0" />
                        <span className="truncate">Closed</span>
                      </div>
                    ) : (
                      <>
                        {dayEvents.slice(0, 2).map((event) => {
                          const timeFormatted = formatAppointmentTime(event.appointmentTime);
                          return (
                            <div
                              key={`${event.eventType}-${event.id}`}
                              className="flex items-center gap-1.5 px-1 py-0.5 rounded bg-brand-darker border border-gray-800 text-[10px] truncate"
                              title={`${event.eventType.toUpperCase()}: ${timeFormatted.time} ${timeFormatted.suffix} - ${
                                event.eventType === 'booking' ? event.serviceName : `${event.make} ${event.model}`
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[event.status]}`} />
                              <span className="font-mono text-gray-300 text-[9px] shrink-0">{timeFormatted.time}</span>
                              <span className="text-gray-400 truncate hidden sm:inline text-[9px]">
                                {event.eventType === 'booking' ? event.serviceName : `${event.make} ${event.model}`}
                              </span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] font-mono text-gray-500 px-1 font-semibold">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Bottom: Active Count Badge */}
                  <div className="flex items-center justify-between text-[9px]">
                    {activeCount > 0 ? (
                      <span className="font-mono font-bold text-brand-orange bg-brand-orange/10 px-1.5 py-0.5 rounded border border-brand-orange/20">
                        {activeCount} active
                      </span>
                    ) : <span />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Selected Day Command Center (4 cols) ──────────── */}
        <div className="xl:col-span-4 bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-800 bg-brand-darker/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-brand-orange shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white">
                {selectedDate
                  ? (() => {
                      const [y, m, d] = selectedDate.split('-').map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
                    })()
                  : 'Selected Day Details'}
              </h2>
            </div>

            {selectedDate && (
              <span className="text-[10px] font-mono font-bold uppercase bg-brand-orange/15 border border-brand-orange/30 text-brand-orange px-2 py-0.5 rounded">
                {selectedEvents.length} Events
              </span>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[700px] [scrollbar-width:thin]">
            
            {/* Empty State: No Date Selected */}
            {!selectedDate && (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-800 rounded-xl bg-brand-darker/30 p-6">
                <CalendarIcon className="w-10 h-10 text-gray-600 mb-3" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">Select a Day</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Choose a date on the calendar to inspect detailed bookings, inquiries, and availability metrics.
                </p>
              </div>
            )}

            {/* Selected Date Content */}
            {selectedDate && (() => {
              const bookingCount = selectedEvents.filter(e => e.eventType === 'booking').length;
              const inquiryCount = selectedEvents.filter(e => e.eventType === 'inquiry').length;

              return (
                <>
                  {/* Selected Day Stats */}
                  <div className="grid grid-cols-3 gap-2 bg-brand-darker border border-gray-800 p-3 rounded-lg text-center font-mono">
                    <div>
                      <span className="text-lg font-bold text-sky-400 block">{bookingCount}</span>
                      <span className="text-[9px] uppercase tracking-wider text-gray-500 font-sans font-semibold">Bookings</span>
                    </div>
                    <div>
                      <span className="text-lg font-bold text-brand-orange block">{inquiryCount}</span>
                      <span className="text-[9px] uppercase tracking-wider text-gray-500 font-sans font-semibold">Inquiries</span>
                    </div>
                    <div>
                      <span className="text-lg font-bold text-green-400 block">
                        {slotCapacity !== null ? Math.max(0, availableSlots.length) : '--'}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-gray-500 font-sans font-semibold">Slots Open</span>
                    </div>
                  </div>

                  {/* Shop Closed Banner */}
                  {selectedDateClosure && (
                    <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-4 space-y-1.5 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                          <CalendarX className="w-4 h-4 shrink-0" />
                          <span>Shop Closed</span>
                        </div>
                        {selectedDateClosure.isYearly && (
                          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 font-mono">
                            Yearly
                          </span>
                        )}
                      </div>
                      {selectedDateClosure.reason && (
                        <p className="text-xs text-red-300 font-medium">{selectedDateClosure.reason}</p>
                      )}
                    </div>
                  )}

                  {/* Empty Day Events */}
                  {selectedEvents.length === 0 && !selectedDateClosure && (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray-800 rounded-lg bg-brand-darker/20 p-6">
                      <CheckCircle2 className="w-8 h-8 text-gray-600 mb-2" />
                      <p className="text-xs font-semibold text-gray-400">No appointments scheduled</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">No bookings or inquiries exist for this date.</p>
                    </div>
                  )}

                  {/* Events List */}
                  {selectedEvents.map((event) => {
                    const timeFormatted = formatAppointmentTime(event.appointmentTime);
                    const isBooking = event.eventType === 'booking';

                    return (
                      <div
                        key={`${event.eventType}-${event.id}`}
                        onClick={() => event.eventType === 'inquiry' ? onView?.('inq-' + event.id) : onView?.(event.id)}
                        className="group relative bg-brand-darker border border-gray-800 rounded-xl p-4 transition-all duration-200 hover:border-brand-orange/60 hover:bg-brand-darker/90 cursor-pointer shadow-md overflow-hidden space-y-3"
                      >
                        {/* Status Left Accent Line */}
                        <div className={`absolute top-0 bottom-0 left-0 w-1 ${STATUS_DOT[event.status]}`} />

                        {/* Top Metadata Row */}
                        <div className="flex items-center justify-between gap-2 pl-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${TYPE_BADGE[event.eventType]}`}>
                              {isBooking ? 'Booking' : 'Inquiry'}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${STATUS_BADGE[event.status] ?? 'bg-gray-800 text-gray-400'}`}>
                              {formatStatus(event.status)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-gray-500 font-semibold group-hover:text-brand-orange transition-colors">
                            View details →
                          </span>
                        </div>

                        {/* Main Title & Client */}
                        <div className="pl-2 space-y-1">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wide truncate">
                            {isBooking ? event.serviceName : `${event.make} ${event.model}${event.year ? ` (${event.year})` : ''}`}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-300 font-medium">
                            <User className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <span className="truncate">{isBooking ? event.name : event.fullName}</span>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="pl-2 grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                          <div className="bg-brand-dark p-2.5 rounded-lg border border-gray-800">
                            <span className="text-[9px] uppercase tracking-widest text-gray-500 block mb-0.5">Time</span>
                            <span className="text-white font-bold block">{timeFormatted.time} {timeFormatted.suffix}</span>
                          </div>

                          <div className="bg-brand-dark p-2.5 rounded-lg border border-gray-800 min-w-0">
                            <span className="text-[9px] uppercase tracking-widest text-gray-500 block mb-0.5">
                              {isBooking ? 'Details' : 'Request'}
                            </span>
                            <span className="text-gray-300 text-[11px] block truncate">
                              {isBooking ? 'Confirmed slot' : (event.productToPurchase || 'Service inquiry')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}

          </div>
        </div>

      </div>

      {/* ── 5. Status Legend ──────────────────────────────────────── */}
      <div className="bg-brand-dark border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
        <div className="flex items-center gap-2 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
          <Sparkles className="w-3.5 h-3.5 text-brand-orange" /> Status Legend:
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          {Object.entries(STATUS_DOT).map(([s, cls]) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />
              <span className="text-gray-300 capitalize">{formatStatus(s as Booking['status'])}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
