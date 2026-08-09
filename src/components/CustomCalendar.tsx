import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface CustomCalendarProps {
  value: Date | null;
  onChange: (date: Date) => void;
  availableDates: Date[];
  closedDatesSet: Set<string>;
  slotCounts?: Record<string, number>;
  slotCapacity?: number;
  showAvailabilityIndicators?: boolean;
  allowAnyDate?: boolean;
}

const formatDateYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Cap how many availability dots we draw per cell so a large slotCapacity
// never forces a cell (or the page) wider than its grid column allows.
const MAX_DOTS = 3;

const CustomCalendar: React.FC<CustomCalendarProps> = ({
  value,
  onChange,
  availableDates,
  closedDatesSet,
  slotCounts = {},
  slotCapacity = 2,
  showAvailabilityIndicators = true,
  allowAnyDate = false,
}) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMo = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isAvailable = (date: Date) => availableDates.some(d => d.toDateString() === date.toDateString());
  const isClosed = (date: Date) => closedDatesSet.has(formatDateYMD(date));

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl sm:rounded-2xl p-3 xs:p-4 sm:p-6 w-full max-w-full box-border shadow-[0_8px_30px_rgb(0,0,0,0.8)] text-zinc-200 font-sans tracking-wide overflow-hidden">

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 mb-5 sm:mb-8 pb-4 border-b border-zinc-800/80">
        <div className="order-2 sm:order-1 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMonth(prev => prev === 0 ? (setYear(y => y - 1), 11) : prev - 1)}
            className="p-1.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 hover:border-zinc-600 rounded transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <span className="text-zinc-100 font-bold text-sm sm:text-md text-center uppercase tracking-wider whitespace-nowrap">
            {MONTHS[month]} <span className="text-zinc-500 font-light">{year}</span>
          </span>
          <button
            type="button"
            onClick={() => setMonth(prev => prev === 11 ? (setYear(y => y + 1), 0) : prev + 1)}
            className="p-1.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 hover:border-zinc-600 rounded transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="order-1 sm:order-2 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-500 rounded transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          Today
        </button>
      </div>

      {/* Days of the Week Header */}
      <div className="grid grid-cols-7 mb-2 sm:mb-3">
        {DAYS.map(d => (
          <div key={d} className="py-1 sm:py-2 text-center text-[9px] sm:text-[11px] font-bold uppercase tracking-widest text-zinc-600">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="aspect-square" />;

          const date = new Date(year, month, day);
          const iso = formatDateYMD(date);
          const selected = value?.toDateString() === date.toDateString();
          const todayIso = today.toDateString() === date.toDateString();
          const closed = isClosed(date);
          const available = isAvailable(date);
          const count = slotCounts[iso] ?? 0;
          const slotsLeft = slotCapacity - count;
          const isFull = count >= slotCapacity;
          const dotCount = Math.max(0, Math.min(slotsLeft, slotCapacity, MAX_DOTS));

          const canSelect = allowAnyDate ? !closed : available && !closed;

          // Determine Cell State
          let cellStyle = "bg-zinc-900/40 border-transparent text-zinc-300";
          let cursorStyle = "cursor-not-allowed opacity-40 grayscale";

          if (closed) {
            cellStyle = "bg-red-950/10 border-red-900/30 text-red-500/50";
            cursorStyle = "cursor-not-allowed opacity-50";
          } else if (canSelect) {
            cursorStyle = "cursor-pointer hover:bg-zinc-800 hover:border-zinc-600";
            cellStyle = "bg-zinc-900 border-zinc-800/80 text-zinc-100";

            if (selected) {
              cellStyle = "bg-amber-500 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]";
              cursorStyle = "cursor-default";
            }
          }

          return (
            <button
              key={iso}
              type="button"
              onClick={() => canSelect && onChange(date)}
              disabled={!canSelect}
              className={`aspect-square min-w-0 p-0.5 xs:p-1 sm:p-1.5 flex flex-col items-center rounded-md sm:rounded-lg border transition-all duration-200 ${cellStyle} ${cursorStyle}`}
            >
              {/* Date number — grows to fill available space, centered */}
              <div className="flex-1 flex items-center justify-center min-h-0">
                <div className={`w-5 h-5 xs:w-6 xs:h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded text-[11px] xs:text-xs sm:text-sm font-semibold
                  ${todayIso && !selected ? 'text-amber-500 border border-amber-500/30' : ''}
                `}>
                  {day}
                </div>
              </div>

              {/* Bottom indicator row — fixed height so it never overlaps the number */}
              <div className="h-3 sm:h-4 w-full flex items-center justify-center px-0.5 sm:px-1.5 overflow-hidden">
                {showAvailabilityIndicators && available && !closed && (
                  isFull ? (
                    <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider leading-none ${selected ? 'text-black/60' : 'text-red-500'}`}>
                      Full
                    </span>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: dotCount }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-1 h-1 rounded-full shrink-0 ${selected
                            ? 'bg-black/30'
                            : slotsLeft <= 1
                              ? 'bg-amber-500'
                              : 'bg-emerald-500/70'
                            }`}
                        />
                      ))}
                    </div>
                  )
                )}
                {closed && (
                  <div className="w-3 sm:w-4 h-0.5 rounded-full bg-red-700/40" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Technical Legend */}
      <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-2 pt-4 border-t border-zinc-800/80 px-1 sm:px-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-4 rounded-sm bg-zinc-700 shrink-0" />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-500 font-semibold whitespace-nowrap">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-4 rounded-sm bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0" />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-amber-500 font-semibold whitespace-nowrap">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-4 rounded-sm bg-red-900/50 shrink-0" />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-600 font-semibold whitespace-nowrap">Closed</span>
        </div>
      </div>
    </div>
  );
};

export default CustomCalendar;