import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Calendar, Loader2, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchMyBookingsAsync } from '../../store/bookingSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';

type Filter = 'all' | Booking['status'];

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/10  text-green-400  border-green-500/30',
  completed: 'bg-blue-500/10   text-blue-400   border-blue-500/30',
  cancelled: 'bg-gray-700      text-gray-400   border-gray-600',
};

const STATUS_STRIP: Record<Booking['status'], string> = {
  pending:   'bg-yellow-400',
  confirmed: 'bg-green-400',
  completed: 'bg-blue-400',
  cancelled: 'bg-gray-600',
};

export default function MyBookings() {
  const dispatch               = useDispatch<AppDispatch>();
  const { token }              = useAuth();
  const { appointments, status } = useSelector((s: RootState) => s.booking);

  const [filter,   setFilter]   = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (token) dispatch(fetchMyBookingsAsync(token));
  }, [token, dispatch]);

  const myBookings = appointments.filter(b => !b.id.startsWith('mock'));

  const filtered = filter === 'all'
    ? myBookings
    : myBookings.filter(b => b.status === filter);

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-1">Client Portal</p>
          <h1 className="text-2xl md:text-3xl font-display font-black text-white uppercase tracking-tighter">
            My Bookings
          </h1>
        </div>
        <Link
          to="/booking"
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
        >
          <PlusCircle className="w-3.5 h-3.5" /> New Booking
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label }) => {
          const count = key === 'all' ? myBookings.length : myBookings.filter(b => b.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest rounded-sm border transition-colors ${
                filter === key
                  ? 'bg-brand-orange border-brand-orange text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              {label}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${filter === key ? 'bg-white/20' : 'bg-gray-700 text-gray-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-brand-orange animate-spin" />
        </div>
      )}

      {/* Empty */}
      {status !== 'loading' && filtered.length === 0 && (
        <div className="text-center py-16 bg-brand-dark border border-gray-800 rounded-sm">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm mb-4">
            {filter === 'all' ? "You don't have any bookings yet." : `No ${filter} bookings.`}
          </p>
          {filter === 'all' && (
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Book a Service
            </Link>
          )}
        </div>
      )}

      {/* Booking cards */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(b => (
            <div key={b.id} className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
              {/* Card header */}
              <button
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-gray-900/30 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Status strip */}
                  <div className={`shrink-0 w-1 self-stretch rounded-full ${STATUS_STRIP[b.status]}`} />
                  {/* Date badge */}
                  <div className="shrink-0 w-10 h-10 bg-brand-darker border border-gray-800 rounded-sm flex flex-col items-center justify-center">
                    <span className="text-white text-xs font-black leading-none">
                      {b.appointmentDate.split('-')[2]}
                    </span>
                    <span className="text-gray-500 text-[9px] uppercase leading-none mt-0.5">
                      {new Date(b.appointmentDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">{b.serviceName}</p>
                    <p className="text-gray-500 text-xs truncate">{b.appointmentTime} · {b.vehicleInfo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`hidden sm:inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[b.status]}`}>
                    {b.status}
                  </span>
                  {expanded === b.id
                    ? <ChevronUp className="w-4 h-4 text-gray-600" />
                    : <ChevronDown className="w-4 h-4 text-gray-600" />}
                </div>
              </button>

              {/* Expanded details */}
              {expanded === b.id && (
                <div className="border-t border-gray-800 bg-brand-darker/40 px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                  {[
                    { label: 'Name',  value: b.name },
                    { label: 'Email', value: b.email },
                    { label: 'Phone', value: b.phone },
                    { label: 'Time',  value: `${b.appointmentDate} · ${b.appointmentTime}` },
                    ...(b.notes ? [{ label: 'Notes', value: b.notes }] : []),
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600 block mb-0.5">{label}</span>
                      <span className="text-gray-300 text-xs">{value}</span>
                    </div>
                  ))}
                  <div className="col-span-2 sm:col-span-3 pt-2 border-t border-gray-800 flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[b.status]}`}>{b.status}</span>
                    <span className="text-gray-600 font-mono text-[10px]">#{b.id}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

