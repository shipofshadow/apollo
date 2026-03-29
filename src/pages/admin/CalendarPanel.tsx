import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Loader2, Clock, CalendarX } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllBookingsAsync } from '../../store/bookingSlice';
import { fetchShopClosedDatesApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatStatus } from '../../utils/formatStatus';

const STATUS_DOT: Record<Booking['status'], string> = {
  pending:        'bg-yellow-400',
  confirmed:      'bg-green-400',
  completed:      'bg-blue-400',
  cancelled:      'bg-gray-500',
  awaiting_parts: 'bg-purple-400',
};

const STATUS_BADGE: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-400  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-gray-700      text-gray-400    border-gray-600',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface Props {
  onView: (bookingId: string) => void;
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

  useEffect(() => {
    if (token) dispatch(fetchAllBookingsAsync(token));
    fetchShopClosedDatesApi()
      .then(data => setClosedDates((data as { closedDates: { date: string; reason: string | null; isYearly: boolean }[] }).closedDates ?? []))
      .catch(() => {});
  }, [token, dispatch]);

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

  // Group bookings by date string
  const bookingsByDate = new Map<string, Booking[]>();
  appointments.forEach(b => {
    const list = bookingsByDate.get(b.appointmentDate) ?? [];
    list.push(b);
    bookingsByDate.set(b.appointmentDate, list);
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

  const selectedBookings = selectedDate ? (bookingsByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
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
          <span className="text-white font-bold text-sm min-w-[140px] text-center">
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

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="xl:col-span-2 bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-800">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-bold uppercase tracking-widest text-gray-600">
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
              const iso   = isoForDay(day);
              const bks   = bookingsByDate.get(iso) ?? [];
              const closure = getClosureForDate(iso);
              const isToday     = iso === todayIso;
              const isSelected  = iso === selectedDate;
              const activeCount = bks.filter(b => b.status !== 'cancelled').length;

              return (
                <div
                  key={iso}
                  onClick={() => setSelectedDate(iso === selectedDate ? null : iso)}
                  className={`min-h-[72px] border-r border-b border-gray-800 p-1.5 cursor-pointer transition-colors hover:bg-gray-800/60 ${
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
                      <span className="text-red-400 font-bold truncate">Closed</span>
                    </div>
                  )}

                  {/* Show up to 2 booking dots / labels */}
                  <div className="space-y-0.5">
                    {bks.slice(0, 2).map(b => (
                      <div
                        key={b.id}
                        className="flex items-center gap-1 overflow-hidden"
                        title={`${b.name} – ${b.serviceName}`}
                      >
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${STATUS_DOT[b.status]}`} />
                        <span className="text-[9px] text-gray-400 truncate leading-tight hidden sm:block">
                          {b.serviceName.split(' ').slice(0, 2).join(' ')}
                        </span>
                      </div>
                    ))}
                    {bks.length > 2 && (
                      <p className="text-[9px] text-gray-600">+{bks.length - 2} more</p>
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
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
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

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {!selectedDate && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-600 gap-2">
                <Calendar className="w-8 h-8 opacity-30" />
                <p className="text-xs">Click a day to see bookings</p>
              </div>
            )}

            {selectedDate && (() => {
              const closure = getClosureForDate(selectedDate);
              const hasBookings = selectedBookings.length > 0;
              return (
                <>
                  {closure && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-sm p-3 space-y-1.5">
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
                  {!hasBookings && !closure && (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-600 gap-2">
                      <Calendar className="w-8 h-8 opacity-30" />
                      <p className="text-xs">No bookings on this day</p>
                    </div>
                  )}
                  {selectedBookings.map(b => (
                    <div
                      key={b.id}
                      onClick={() => onView(b.id)}
                      className="group flex gap-3 p-3 bg-brand-darker border border-gray-800 rounded-sm cursor-pointer hover:border-gray-700 transition-colors"
                    >
                      <div className={`shrink-0 w-0.5 self-stretch rounded-full ${STATUS_DOT[b.status]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-semibold truncate">{b.name}</p>
                        <p className="text-gray-500 text-xs truncate">{b.serviceName}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-2.5 h-2.5 text-gray-600" />
                          <span className="text-gray-600 text-[10px]">{b.appointmentTime}</span>
                        </div>
                        <span className={`inline-block mt-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-sm border ${STATUS_BADGE[b.status]}`}>
                          {formatStatus(b.status)}
                        </span>
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
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
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
