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
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full h-full shadow-[0_8px_30px_rgb(0,0,0,0.8)] text-zinc-200 font-sans tracking-wide">
      
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800/80">
        <button
          type="button"
          onClick={goToday}
          className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-500 rounded transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          Today
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMonth(prev => prev === 0 ? (setYear(y => y - 1), 11) : prev - 1)}
            className="p-1.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 hover:border-zinc-600 rounded transition-all focus:outline-none"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-zinc-100 font-bold text-lg min-w-[140px] text-center uppercase tracking-wider">
            {MONTHS[month]} <span className="text-zinc-500 font-light">{year}</span>
          </span>
          <button
            type="button"
            onClick={() => setMonth(prev => prev === 11 ? (setYear(y => y + 1), 0) : prev + 1)}
            className="p-1.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 hover:border-zinc-600 rounded transition-all focus:outline-none"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Days of the Week Header */}
      <div className="grid grid-cols-7 mb-3">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-600">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="min-h-[72px]" />;
          
          const date = new Date(year, month, day);
          const iso = formatDateYMD(date);
          const selected = value?.toDateString() === date.toDateString();
          const todayIso = today.toDateString() === date.toDateString();
          const closed = isClosed(date);
          const available = isAvailable(date);
          const count = slotCounts[iso] ?? 0;
          const slotsLeft = slotCapacity - count;
          const isFull = count >= slotCapacity;

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
              className={`relative min-h-[72px] p-2 flex flex-col items-center justify-start rounded-lg border transition-all duration-200 ${cellStyle} ${cursorStyle}`}
            >
              {/* Date Number */}
              <div className={`w-7 h-7 flex items-center justify-center rounded text-sm font-semibold
                ${todayIso && !selected ? 'text-amber-500 border border-amber-500/30' : ''}
              `}>
                {day}
              </div>

              {/* Status Indicators */}
              <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center justify-end px-2">
                {showAvailabilityIndicators && available && !closed && (
                  <>
                    {isFull ? (
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${selected ? 'text-black/70' : 'text-red-500'}`}>Full</span>
                    ) : (
                      <div className="w-full flex items-center gap-1">
                        <div className={`h-1 flex-1 rounded-sm ${selected ? 'bg-black/20' : slotsLeft <= 1 ? 'bg-amber-500/50' : 'bg-emerald-500/50'}`} />
                        <span className={`text-[9px] font-bold ${selected ? 'text-black/70' : 'text-zinc-500'}`}>
                          {slotsLeft}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {closed && <div className="text-[10px] uppercase font-bold tracking-widest text-red-500/50">--</div>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Technical Legend */}
      <div className="mt-8 flex flex-wrap items-center justify-between pt-4 border-t border-zinc-800/80 px-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-4 rounded-sm bg-zinc-700" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-4 rounded-sm bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          <span className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-4 rounded-sm bg-red-900/50" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Closed</span>
        </div>
      </div>
    </div>
  );
};

export default CustomCalendar;