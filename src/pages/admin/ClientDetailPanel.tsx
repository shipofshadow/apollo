import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Car, Loader2, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchAdminClientBookingsApi,
  fetchAdminClientVehiclesApi,
} from '../../services/api';
import type { Booking, ClientAdminSummary, ClientVehicle } from '../../types';
import { formatStatus } from '../../utils/formatStatus';
import { StatusBadge, Breadcrumbs, Pager, TABLE_PAGE_SIZE } from './_sharedComponents';

const BOOKING_STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-500  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-[#1a1a1a]     text-gray-500    border-gray-800',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

type Props = {
  client: ClientAdminSummary;
  onBack: () => void;
  onViewBooking: (bookingId: string) => void;
};

export default function ClientDetailPanel({ client, onBack, onViewBooking }: Props) {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [bookingsPage, setBookingsPage] = useState(1);

  const bookingTotalPages = Math.max(1, Math.ceil(bookings.length / TABLE_PAGE_SIZE));
  const pagedBookings = useMemo(() => {
    const start = (bookingsPage - 1) * TABLE_PAGE_SIZE;
    return bookings.slice(start, start + TABLE_PAGE_SIZE);
  }, [bookings, bookingsPage]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoadingBookings(true);
      try {
        const { bookings: list } = await fetchAdminClientBookingsApi(token, client.id);
        setBookings(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (e) {
        showToast((e as Error).message ?? 'Failed to load bookings.', 'error');
      } finally {
        setLoadingBookings(false);
      }
    })();
  }, [token, client.id]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoadingVehicles(true);
      try {
        const { vehicles: list } = await fetchAdminClientVehiclesApi(token, client.id);
        setVehicles(list);
      } catch (e) {
        showToast((e as Error).message ?? 'Failed to load vehicles.', 'error');
      } finally {
        setLoadingVehicles(false);
      }
    })();
  }, [token, client.id]);

  useEffect(() => {
    setBookingsPage(1);
  }, [client.id]);

  useEffect(() => {
    setBookingsPage(prev => Math.min(prev, bookingTotalPages));
  }, [bookingTotalPages]);

  const isActive = client.is_active !== false;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Manage Clients', onClick: onBack }, { label: client.name }]} />

      {/* Back button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Clients
        </button>
      </div>

      {/* Client profile card */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-brand-orange/20 border-2 border-brand-orange/40 flex items-center justify-center shrink-0">
                <span className="text-brand-orange font-black text-xl uppercase">
                  {client.name?.[0] ?? 'C'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-display font-bold text-white">{client.name}</h2>
                  <StatusBadge isActive={isActive} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mt-0.5">Client</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-300">Bookings</p>
                <p className="text-lg font-bold text-white">{client.bookingCount}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Mail className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                <span>{client.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <User className="w-4 h-4 text-gray-500 shrink-0" />
              <span>Member since {new Date(client.created_at).toLocaleDateString()}</span>
            </div>
            {client.lastBookingAt && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                <span>Last booking: {new Date(client.lastBookingAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Vehicles */}
      <section className="rounded-xl border border-gray-800 bg-brand-dark p-5 space-y-4">
        <div className="flex items-center gap-1.5">
          <Car className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Registered Vehicles</p>
        </div>
        {loadingVehicles ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
          </div>
        ) : vehicles.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No vehicles registered.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {vehicles.map(v => (
              <div key={v.id} className="rounded-lg border border-gray-800 bg-brand-darker/70 overflow-hidden">
                {v.imageUrl && (
                  <img
                    src={v.imageUrl}
                    alt={`${v.year} ${v.make} ${v.model}`}
                    className="w-full h-32 object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="p-3">
                  <p className="text-white font-semibold text-sm">{v.year} {v.make} {v.model}</p>
                  {v.licensePlate && (
                    <p className="text-xs text-gray-400 mt-0.5">Plate: {v.licensePlate}</p>
                  )}
                  {v.vin && (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">VIN: {v.vin}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Booking history */}
      <section className="rounded-xl border border-gray-800 bg-brand-dark p-5 space-y-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Booking History</p>
        </div>
        {loadingBookings ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No bookings found.</p>
        ) : (
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                    <th className="py-2 px-3">Ref #</th>
                    <th className="py-2 px-3">Service</th>
                    <th className="py-2 px-3 hidden sm:table-cell">Vehicle</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBookings.map(b => (
                    <tr key={b.id} className="border-b border-gray-800/70">
                      <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{b.referenceNumber || b.id}</td>
                      <td className="py-2.5 px-3 text-white">{b.serviceName}</td>
                      <td className="py-2.5 px-3 text-gray-300 hidden sm:table-cell text-xs">{b.vehicleInfo || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-300 text-xs whitespace-nowrap">
                        {new Date(b.appointmentDate).toLocaleDateString()} {b.appointmentTime}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border ${BOOKING_STATUS_STYLES[b.status]}`}>
                          {formatStatus(b.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onViewBooking(b.id)}
                          className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-brand-orange hover:text-orange-300 transition-colors"
                        >
                          View Booking
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={bookingsPage} totalPages={bookingTotalPages} totalItems={bookings.length} onPageChange={setBookingsPage} />
          </div>
        )}
      </section>
    </div>
  );
}
