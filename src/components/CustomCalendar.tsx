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
  slotCapacity = 3, 
  showAvailabilityIndicators = true 
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
    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 w-full max-w-md md:max-w-xl mx-auto shadow-2xl text-slate-200">
      
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={goToday} 
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        >
          Today
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMonth(prev => prev === 0 ? (setYear(y => y - 1), 11) : prev - 1)}
            className="p-2 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-semibold text-base min-w-[130px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={() => setMonth(prev => prev === 11 ? (setYear(y => y + 1), 0) : prev + 1)}
            className="p-2 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Days of the Week Header */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
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

          // Determine Cell State
          let cellStyle = "bg-transparent";
          let cursorStyle = "cursor-not-allowed opacity-50";

          if (closed) {
            cellStyle = "bg-red-950/20";
          } else if (available) {
            cursorStyle = "cursor-pointer hover:bg-slate-800";
            
            if (selected) {
              cellStyle = "bg-orange-500/20 ring-1 ring-orange-500";
            }
          }

          return (
            <button
              key={iso}
              onClick={() => available && !closed && onChange(date)}
              disabled={!available || closed}
              className={`min-h-[72px] p-2 flex flex-col items-center justify-start rounded-xl transition-all ${cellStyle} ${cursorStyle}`}
            >
              {/* Date Number Container */}
              <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm
                ${todayIso && !selected ? 'bg-slate-800 text-white font-bold' : ''}
                ${selected ? 'bg-orange-500 text-white' : ''}
              `}>
                {day}
              </div>

              {/* Status Indicators (Dots instead of text) */}
              <div className="mt-1 flex flex-col items-center gap-1 h-6">
                {showAvailabilityIndicators && available && !closed && (
                  <>
                    {isFull ? (
                      <span className="text-[10px] text-red-400 font-medium tracking-tight">Full</span>
                    ) : (
                      <span className={`text-[10px] font-medium tracking-tight ${slotsLeft <= 1 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {slotsLeft} left
                      </span>
                    )}
                  </>
                )}
                {closed && <div className="w-1.5 h-1.5 rounded-full bg-red-500/50 mt-1" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Minimal Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-200" />
          <span className="text-xs text-slate-400">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          <span className="text-xs text-slate-400">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500/50" />
          <span className="text-xs text-slate-400">Closed</span>
        </div>
      </div>
    </div>
  );
};

export default CustomCalendar;