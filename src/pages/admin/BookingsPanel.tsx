import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Calendar, Clock, Loader2, XCircle, Eye,
} from 'lucide-react';
import { fetchAllBookingsAsync, updateBookingStatusAsync } from '../../store/bookingSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-400  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-gray-700      text-gray-400    border-gray-600',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

interface Props {
  onView: (bookingId: string) => void;
}

export default function BookingsPanel({ onView }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const { appointments, status } = useSelector((s: RootState) => s.booking);
  const [statusFilter, setStatusFilter] = useState<'all' | Booking['status']>('all');

  useEffect(() => {
    if (token) dispatch(fetchAllBookingsAsync(token));
  }, [token, dispatch]);

  const handleCancel = (id: string) => {
    if (!token) return;
    dispatch(updateBookingStatusAsync({ token, id, status: 'cancelled' }));
    showToast('Booking cancelled.', 'success');
  };

  const filtered = statusFilter === 'all'
    ? appointments
    : appointments.filter(b => b.status === statusFilter);

  const filters: Array<{ key: 'all' | Booking['status']; label: string }> = [
    { key: 'all',            label: 'All' },
    { key: 'pending',        label: 'Pending' },
    { key: 'confirmed',      label: 'Confirmed' },
    { key: 'awaiting_parts', label: 'Awaiting Parts' },
    { key: 'completed',      label: 'Completed' },
    { key: 'cancelled',      label: 'Cancelled' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">Client Bookings</h2>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border transition-colors ${
              statusFilter === key
                ? 'bg-brand-orange border-brand-orange text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            }`}>
            {label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${statusFilter === key ? 'bg-white/20' : 'bg-gray-800'}`}>
              {key === 'all' ? appointments.length : appointments.filter(b => b.status === key).length}
            </span>
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
        </div>
      )}

      {filtered.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No {statusFilter !== 'all' ? statusFilter : ''} bookings found.</p>
        </div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <>
          {/* ── Desktop (md+): table ── */}
          <div className="hidden md:block bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-800 bg-brand-darker/50">
                  {['Client', 'Service', 'Date & Time', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr
                    key={b.id}
                    className="border-b border-gray-800 hover:bg-brand-darker/40 transition-colors cursor-pointer"
                    onClick={() => onView(b.id)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-white font-semibold">{b.name}</p>
                      <p className="text-gray-500 text-xs">{b.phone}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-300 text-sm">
                      <p>{b.serviceName}</p>
                      <p className="text-gray-600 text-xs mt-0.5">{b.vehicleInfo}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-300 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" /> {b.appointmentDate}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-gray-500" /> {b.appointmentTime}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[b.status]}`}>
                        {formatStatus(b.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onView(b.id)}
                          title="View full booking details"
                          className="flex items-center gap-1 px-3 py-1.5 bg-brand-orange/10 border border-brand-orange/30 text-brand-orange hover:bg-brand-orange/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <Eye className="w-3 h-3" /> View
                        </button>
                        {b.status !== 'cancelled' && b.status !== 'completed' && (
                          <button onClick={() => handleCancel(b.id)}
                            title="Cancel this booking"
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile (< md): cards ── */}
          <div className="md:hidden space-y-3">
            {filtered.map(b => (
              <div
                key={b.id}
                className="bg-brand-dark border border-gray-800 rounded-sm p-4 cursor-pointer hover:border-gray-600 transition-colors"
                onClick={() => onView(b.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-white font-semibold text-sm">{b.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{b.phone}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm border shrink-0 ${STATUS_STYLES[b.status]}`}>
                    {formatStatus(b.status)}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mb-1">{b.serviceName}</p>
                <p className="text-gray-600 text-xs mb-3">{b.vehicleInfo}</p>
                <div className="flex items-center gap-3 text-gray-400 text-xs mb-3">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-gray-600" /> {b.appointmentDate}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-gray-600" /> {b.appointmentTime}</span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800" onClick={e => e.stopPropagation()}>
                  <button onClick={() => onView(b.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-orange/10 border border-brand-orange/30 text-brand-orange hover:bg-brand-orange/20 text-xs font-bold uppercase rounded-sm transition-colors">
                    <Eye className="w-3 h-3" /> View
                  </button>
                  {b.status !== 'cancelled' && b.status !== 'completed' && (
                    <button onClick={() => handleCancel(b.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                      <XCircle className="w-3 h-3" /> Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
