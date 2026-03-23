import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Calendar, Clock, CheckCircle, XCircle, PlusCircle, Loader2 } from 'lucide-react';
import { fetchMyBookingsAsync } from '../../store/bookingSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/10  text-green-400  border-green-500/30',
  completed: 'bg-blue-500/10   text-blue-400   border-blue-500/30',
  cancelled: 'bg-gray-700      text-gray-400   border-gray-600',
};

export default function ClientDashboard() {
  const dispatch               = useDispatch<AppDispatch>();
  const { user, token }        = useSelector((s: RootState) => s.auth);
  const { appointments, status } = useSelector((s: RootState) => s.booking);

  // Load this client's bookings on mount
  useEffect(() => {
    if (token) dispatch(fetchMyBookingsAsync(token));
  }, [token, dispatch]);

  const myBookings = appointments.filter(b => !b.id.startsWith('mock'));
  const recent     = myBookings.slice(0, 5);

  const counts = {
    total:     myBookings.length,
    pending:   myBookings.filter(b => b.status === 'pending').length,
    confirmed: myBookings.filter(b => b.status === 'confirmed').length,
    completed: myBookings.filter(b => b.status === 'completed').length,
  };

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter">
          Welcome back, <span className="text-brand-orange">{user?.name?.split(' ')[0]}</span>
        </h1>
        <p className="text-gray-400 mt-1">Here's a summary of your appointments.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: counts.total,     icon: Calendar,     color: 'text-brand-orange' },
          { label: 'Pending',   value: counts.pending,   icon: Clock,        color: 'text-yellow-400' },
          { label: 'Confirmed', value: counts.confirmed, icon: CheckCircle,  color: 'text-green-400' },
          { label: 'Completed', value: counts.completed, icon: XCircle,      color: 'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-3xl font-display font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">Recent Bookings</h2>
          <Link
            to="/client/bookings"
            className="text-brand-orange text-sm font-bold uppercase tracking-widest hover:text-orange-400 transition-colors"
          >
            View All
          </Link>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        )}

        {status !== 'loading' && recent.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>You have no bookings yet.</p>
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 mt-4 bg-brand-orange text-white px-6 py-3 font-bold uppercase tracking-widest text-sm hover:bg-orange-600 transition-colors rounded-sm"
            >
              <PlusCircle className="w-4 h-4" /> Book a Service
            </Link>
          </div>
        )}

        {recent.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[540px]">
              <thead>
                <tr className="border-b border-gray-800 bg-brand-darker/50">
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">Service</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">Date</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(b => (
                  <tr key={b.id} className="border-b border-gray-800 hover:bg-gray-900/40 transition-colors">
                    <td className="px-6 py-4 text-white font-semibold">{b.serviceName}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {b.appointmentDate} · {b.appointmentTime}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[b.status]}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick action */}
      <div className="bg-brand-orange/10 border border-brand-orange/30 rounded-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-lg">Ready for your next upgrade?</h3>
          <p className="text-gray-400 text-sm mt-1">Book a new appointment in under 2 minutes.</p>
        </div>
        <Link
          to="/booking"
          className="shrink-0 bg-brand-orange text-white px-6 py-3 font-bold uppercase tracking-widest text-sm hover:bg-orange-600 transition-colors rounded-sm flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" /> New Booking
        </Link>
      </div>
    </div>
  );
}
