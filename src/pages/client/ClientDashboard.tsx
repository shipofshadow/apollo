import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Calendar, Clock, CheckCircle2, BadgeCheck, PlusCircle, Loader2, Zap } from 'lucide-react';
import { fetchMyBookingsAsync } from '../../store/bookingSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatStatus } from '../../utils/formatStatus';

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-400  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-gray-700      text-gray-400    border-gray-600',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

const STAT_LEFT_BORDER: Record<string, string> = {
  Total:     'border-brand-orange',
  Pending:   'border-yellow-400',
  Confirmed: 'border-green-400',
  Completed: 'border-blue-400',
};

export default function ClientDashboard() {
  const dispatch               = useDispatch<AppDispatch>();
  const navigate               = useNavigate();
  const { user, token }        = useAuth();
  const { appointments, status } = useSelector((s: RootState) => s.booking);

  useEffect(() => {
    if (token) dispatch(fetchMyBookingsAsync(token));
  }, [token, dispatch]);

  // Only show bookings that belong to the current user.
  // Guard against null user — if user isn't loaded yet, show nothing.
  const myBookings = !user
    ? []
    : appointments.filter(
        b => !b.id.startsWith('mock') && b.userId === user.id
      );
  const recent     = myBookings.slice(0, 5);

  const counts = {
    total:     myBookings.length,
    pending:   myBookings.filter(b => b.status === 'pending').length,
    confirmed: myBookings.filter(b => b.status === 'confirmed').length,
    completed: myBookings.filter(b => b.status === 'completed').length,
  };

  const stats = [
    { label: 'Total',     value: counts.total,     icon: Calendar,     color: 'text-brand-orange' },
    { label: 'Pending',   value: counts.pending,   icon: Clock,        color: 'text-yellow-400' },
    { label: 'Confirmed', value: counts.confirmed, icon: CheckCircle2, color: 'text-green-400' },
    { label: 'Completed', value: counts.completed, icon: BadgeCheck,   color: 'text-blue-400' },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Welcome hero */}
      <div className="relative bg-brand-dark border border-gray-800 rounded-sm overflow-hidden px-7 py-6">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/5 to-transparent pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange" />
        <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-1">Client Portal</p>
        <h1 className="text-2xl md:text-3xl font-display font-black text-white uppercase tracking-tighter">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">Here's a quick overview of your appointments and what's coming up.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className={`bg-brand-dark border-t-2 ${STAT_LEFT_BORDER[label]} border-x border-b border-gray-800 rounded-sm p-5`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-3xl font-display font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Recent Bookings</h2>
          <Link
            to="/client/bookings"
            className="text-brand-orange text-xs font-bold uppercase tracking-widest hover:text-orange-400 transition-colors"
          >
            View All →
          </Link>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 text-brand-orange animate-spin" />
          </div>
        )}

        {status !== 'loading' && recent.length === 0 && (
          <div className="text-center py-14 text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-4">You have no bookings yet.</p>
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-5 py-2.5 font-bold uppercase tracking-widest text-xs hover:bg-orange-600 transition-colors rounded-sm"
            >
              <PlusCircle className="w-4 h-4" /> Book a Service
            </Link>
          </div>
        )}

        {recent.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-800 bg-brand-darker/40">
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-600">Service</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-600">Date</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(b => (
                  <tr
                    key={b.id}
                    className="border-b border-gray-800/60 last:border-0 hover:bg-gray-900/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/client/bookings/${b.id}`)}
                  >
                    <td className="px-6 py-4 text-white font-semibold text-sm">{b.serviceName}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm tabular-nums">
                      {b.appointmentDate} · {b.appointmentTime}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[b.status]}`}>
                        {formatStatus(b.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="relative bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/10 to-transparent pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-7 py-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-brand-orange" />
              <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Quick Action</p>
            </div>
            <h3 className="text-white font-bold text-base">Ready for your next upgrade?</h3>
            <p className="text-gray-400 text-sm mt-0.5">Book a new appointment in under 2 minutes.</p>
          </div>
          <Link
            to="/booking"
            className="shrink-0 bg-brand-orange text-white px-5 py-2.5 font-bold uppercase tracking-widest text-xs hover:bg-orange-600 transition-colors rounded-sm flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> New Booking
          </Link>
        </div>
      </div>
    </div>
  );
}
