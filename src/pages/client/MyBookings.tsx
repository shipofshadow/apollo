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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter">
          My <span className="text-brand-orange">Bookings</span>
        </h1>
        <Link
          to="/booking"
          className="flex items-center gap-2 bg-brand-orange text-white px-5 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
        >
          <PlusCircle className="w-4 h-4" /> New Booking
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
              className={`px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-sm border transition-colors ${
                filter === key
                  ? 'bg-brand-orange border-brand-orange text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              {label}
              <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${filter === key ? 'bg-white/20' : 'bg-gray-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
        </div>
      )}

      {/* Empty */}
      {status !== 'loading' && filtered.length === 0 && (
        <div className="text-center py-16 bg-brand-dark border border-gray-800 rounded-sm">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400 mb-4">
            {filter === 'all' ? "You don't have any bookings yet." : `No ${filter} bookings.`}
          </p>
          {filter === 'all' && (
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
            >
              <PlusCircle className="w-4 h-4" /> Book a Service
            </Link>
          )}
        </div>
      )}

      {/* Booking cards */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(b => (
            <div key={b.id} className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
              {/* Card header */}
              <button
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-900/40 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="shrink-0 w-12 h-12 bg-brand-orange/10 border border-brand-orange/20 rounded-sm flex flex-col items-center justify-center">
                    <span className="text-brand-orange text-xs font-bold leading-none">
                      {b.appointmentDate.split('-')[2]}
                    </span>
                    <span className="text-brand-orange/70 text-xs uppercase leading-none mt-0.5">
                      {new Date(b.appointmentDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short' })}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-bold">{b.serviceName}</p>
                    <p className="text-gray-500 text-sm">{b.appointmentTime} · {b.vehicleInfo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`hidden sm:inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[b.status]}`}>
                    {b.status}
                  </span>
                  {expanded === b.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </button>

              {/* Expanded details */}
              {expanded === b.id && (
                <div className="border-t border-gray-800 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-gray-500 block mb-1">Name</span>
                    <span className="text-gray-300">{b.name}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-widest text-gray-500 block mb-1">Phone</span>
                    <span className="text-gray-300">{b.phone}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-widest text-gray-500 block mb-1">Email</span>
                    <span className="text-gray-300">{b.email}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-widest text-gray-500 block mb-1">Status</span>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-sm border ${STATUS_STYLES[b.status]}`}>{b.status}</span>
                  </div>
                  {b.notes && (
                    <div className="sm:col-span-2">
                      <span className="text-xs uppercase tracking-widest text-gray-500 block mb-1">Notes</span>
                      <span className="text-gray-300">{b.notes}</span>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="text-xs uppercase tracking-widest text-gray-500 block mb-1">Booking ID</span>
                    <span className="text-gray-500 font-mono text-xs">{b.id}</span>
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
