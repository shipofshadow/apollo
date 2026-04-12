import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Calendar, Loader2, PlusCircle, ChevronRight, Download } from 'lucide-react';
import { fetchMyBookingsAsync } from '../../store/bookingSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';
import { fetchBookingByIdApi } from '../../services/api';
import { generateJobCompletionPDF } from '../../utils/generateJobCompletionPDF';

type Filter = 'all' | Booking['status'];

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-400  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-gray-700      text-gray-400    border-gray-600',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

const STATUS_STRIP: Record<Booking['status'], string> = {
  pending:        'bg-yellow-400',
  confirmed:      'bg-green-400',
  completed:      'bg-blue-400',
  cancelled:      'bg-gray-600',
  awaiting_parts: 'bg-purple-400',
};

export default function MyBookings() {
  const dispatch               = useDispatch<AppDispatch>();
  const { token, user }        = useAuth();
  const { showToast }          = useToast();
  const { appointments, status } = useSelector((s: RootState) => s.booking);

  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (token) dispatch(fetchMyBookingsAsync(token));
  }, [token, dispatch]);

  // Only show bookings that belong to the logged-in user.
  // Guard against null user — if user isn't loaded yet, show nothing.
  const myBookings = !user
    ? []
    : appointments.filter(
        b => b.userId === user.id
      );

  const filtered = filter === 'all'
    ? myBookings
    : myBookings.filter(b => b.status === filter);

  const activeCount = myBookings.filter(b => b.status === 'pending' || b.status === 'confirmed' || b.status === 'awaiting_parts').length;
  const doneCount = myBookings.filter(b => b.status === 'completed').length;

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all',            label: 'All' },
    { key: 'pending',        label: 'Pending' },
    { key: 'confirmed',      label: 'Confirmed' },
    { key: 'awaiting_parts', label: 'Awaiting Parts' },
    { key: 'completed',      label: 'Completed' },
    { key: 'cancelled',      label: 'Cancelled' },
  ];

  const formatDateLong = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleDownloadPdf = async (booking: Booking) => {
    if (!token) return;

    try {
      const fullBooking = (await fetchBookingByIdApi(token, booking.id)).booking;

      if (fullBooking.status !== 'completed') {
        showToast('Job sheet is available only for completed bookings.', 'error');
        return;
      }

      await generateJobCompletionPDF(fullBooking);
    } catch {
      showToast('Failed to generate job sheet PDF.', 'error');
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gradient-to-br from-brand-darker via-brand-dark to-[#161515] p-5 md:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-orange/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-20 h-36 w-36 rounded-full bg-red-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange/90 mb-2">Client Portal</p>
            <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tight">
              My Bookings
            </h1>
            <p className="mt-2 text-sm text-gray-400 max-w-xl">
              Track your appointments, monitor current progress, and quickly open booking details.
            </p>
          </div>

          <Link
            to="/booking"
            className="inline-flex items-center justify-center gap-2 bg-brand-orange text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-md"
          >
            <PlusCircle className="w-3.5 h-3.5" /> New Booking
          </Link>
        </div>

        <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-800/90 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Total</p>
            <p className="text-2xl font-black text-white mt-1">{myBookings.length}</p>
          </div>
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-amber-300">Active</p>
            <p className="text-2xl font-black text-amber-200 mt-1">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-blue-400/30 bg-blue-500/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-blue-300">Completed</p>
            <p className="text-2xl font-black text-blue-200 mt-1">{doneCount}</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="rounded-xl border border-gray-800 bg-brand-dark/60 p-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(({ key, label }) => {
            const count = key === 'all' ? myBookings.length : myBookings.filter(b => b.status === key).length;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 px-3.5 py-2 text-xs font-bold uppercase tracking-widest rounded-md border transition-colors ${
                  filter === key
                    ? 'bg-brand-orange border-brand-orange text-white'
                    : 'border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white bg-[#171717]'
                }`}
              >
                {label}
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${filter === key ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-brand-orange animate-spin" />
        </div>
      )}

      {/* Empty */}
      {status !== 'loading' && filtered.length === 0 && (
        <div className="text-center py-16 bg-brand-dark border border-gray-800 rounded-xl">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm mb-4">
            {filter === 'all' ? "You haven't booked any appointments yet. Let's get started!" : `No ${filter === 'awaiting_parts' ? 'awaiting parts' : filter} bookings right now.`}
          </p>
          {filter === 'all' && (
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-md"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Book a Service
            </Link>
          )}
        </div>
      )}

      {/* Booking cards — each is a link to the detail page */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(b => (
            <Link
              key={b.id}
              to={`/client/bookings/${b.id}`}
              className="group relative bg-gradient-to-r from-brand-dark to-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-all flex items-stretch"
            >
              {/* Status strip */}
              <div className={`shrink-0 w-1 self-stretch ${STATUS_STRIP[b.status]}`} />

              <div className="flex items-center gap-4 min-w-0 flex-1 p-4 md:p-5">
                {/* Date badge */}
                <div className="shrink-0 w-12 h-12 bg-brand-darker border border-gray-700 rounded-md flex flex-col items-center justify-center">
                  <span className="text-white text-xs font-black leading-none">
                    {b.appointmentDate.split('-')[2]}
                  </span>
                  <span className="text-gray-500 text-[9px] uppercase leading-none mt-0.5">
                    {new Date(b.appointmentDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short' })}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-white font-bold text-sm md:text-base truncate">{b.serviceName}</p>
                    <span className={`sm:hidden inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md border ${STATUS_STYLES[b.status]}`}>
                      {formatStatus(b.status)}
                    </span>
                  </div>
                  <p className="text-gray-300 text-xs mt-1 truncate">{formatDateLong(b.appointmentDate)} at {b.appointmentTime}</p>
                  <p className="text-gray-500 text-xs truncate mt-0.5">Vehicle: {b.vehicleInfo}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 pr-4 md:pr-5">
                <span className={`hidden sm:inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-md border ${STATUS_STYLES[b.status]}`}>
                  {formatStatus(b.status)}
                </span>
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">
                  View
                </span>
                {b.status === 'completed' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleDownloadPdf(b);
                    }}
                    title="Download Job Sheet (PDF)"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-700 text-gray-400 hover:border-brand-orange hover:text-brand-orange rounded-md transition-colors text-[10px] font-bold uppercase tracking-widest"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                )}
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
