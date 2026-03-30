import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export interface CustomCalendarProps {
  value: Date | null;
  onChange: (date: Date) => void;
  availableDates: Date[];
  closedDatesSet: Set<string>;
  slotCounts?: Record<string, number>;
  slotCapacity?: number;
}

const formatDateYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const CustomCalendar: React.FC<CustomCalendarProps> = ({ value, onChange, availableDates, closedDatesSet, slotCounts = {}, slotCapacity = 3 }) => {
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
    <div className="bg-brand-dark border border-gray-800 rounded-sm p-4 w-full max-w-lg md:max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <button onClick={goToday} className="px-2 py-1 text-xs font-bold uppercase tracking-widest border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors">Today</button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMonth(prev => {
                if (prev === 0) {
                  setYear(y => y - 1);
                  return 11;
                }
                return prev - 1;
              });
            }}
            className="p-1.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-bold text-sm min-w-[120px] text-center">{MONTHS[month]} {year}</span>
          <button
            onClick={() => {
              setMonth(prev => {
                if (prev === 11) {
                  setYear(y => y + 1);
                  return 0;
                }
                return prev + 1;
              });
            }}
            className="p-1.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-800 mb-1">
        {DAYS.map(d => (
          <div key={d} className="py-1 text-center text-xs font-bold uppercase tracking-widest text-gray-600">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="min-h-[40px] border-r border-b border-gray-800 last:border-r-0" />;
          const date = new Date(year, month, day);
          const iso = formatDateYMD(date);
          const selected = value && value.toDateString() === date.toDateString();
          const todayIso = today.toDateString() === date.toDateString();
          const closed = isClosed(date);
          const available = isAvailable(date);
          let bookingIndicator = null;
          if (available && !closed) {
            const count = slotCounts[iso] ?? 0;
            if (count >= slotCapacity) {
              bookingIndicator = <span className="text-[9px] text-red-400 font-bold">Full</span>;
            } else if (count > 0) {
              bookingIndicator = <span className="text-[9px] text-yellow-400 font-bold">{slotCapacity - count} left</span>;
            } else {
              bookingIndicator = <span className="text-[9px] text-green-400 font-bold">Available</span>;
            }
          }
          return (
            <button
              key={iso}
              onClick={() => available && !closed && (slotCounts[iso] ?? 0) < slotCapacity && onChange(date)}
              className={`min-h-[56px] md:min-h-[72px] border-r border-b border-gray-800 p-1.5 w-full h-full flex flex-col items-center justify-center transition-colors rounded-sm
                ${selected ? 'bg-brand-orange/10 border-brand-orange' : closed ? 'bg-red-500/5 border-red-500/30' : ''}
                ${available && !closed && (slotCounts[iso] ?? 0) < slotCapacity ? 'hover:bg-brand-orange/10 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
              `}
              disabled={!available || closed || (slotCounts[iso] ?? 0) >= slotCapacity}
            >
              <div className={`w-7 h-7 md:w-9 md:h-9 flex items-center justify-center rounded-full text-sm md:text-base font-bold mb-1
                ${todayIso ? 'bg-brand-orange text-white' : closed ? 'bg-red-500/20 text-red-400 border border-red-500/30' : selected ? 'text-brand-orange' : 'text-gray-400'}`}>{day}</div>
              {closed && <span className="text-[9px] text-red-400 font-bold">Closed</span>}
              {bookingIndicator}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CustomCalendar;
