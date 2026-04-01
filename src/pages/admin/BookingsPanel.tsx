import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Calendar, Clock, Loader2, XCircle, Eye, Search, X as XIcon, Trash2, AlertTriangle,
} from 'lucide-react';
import { fetchAllBookingsAsync, updateBookingStatusAsync } from '../../store/bookingSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';
import { deleteBookingApi } from '../../services/api';

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-500  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-[#1a1a1a]     text-gray-500    border-gray-800',
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
  const [search, setSearch] = useState('');
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (token) dispatch(fetchAllBookingsAsync(token));
  }, [token, dispatch]);

  const handleCancel = (id: string) => {
    if (!token) return;
    dispatch(updateBookingStatusAsync({ token, id, status: 'cancelled' }));
    showToast('Booking cancelled.', 'success');
  };

  const requestDelete = (id: string, customerName: string) => {
    if (!token || deleteBusyId) return;
    setDeleteTarget({ id, name: customerName });
  };

  const handleDelete = async (id: string) => {
    if (!token || deleteBusyId) return;
    setDeleteBusyId(id);
    try {
      await deleteBookingApi(token, id);
      await dispatch(fetchAllBookingsAsync(token));
      showToast('Booking deleted.', 'success');
      setDeleteTarget(null);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to delete booking.', 'error');
    } finally {
      setDeleteBusyId(null);
    }
  };

  const term = search.trim().toLowerCase();

  const filtered = appointments
    .filter(b => statusFilter === 'all' || b.status === statusFilter)
    .filter(b =>
      term === '' ||
      b.name.toLowerCase().includes(term) ||
      b.phone.toLowerCase().includes(term) ||
      b.vehicleInfo.toLowerCase().includes(term) ||
      b.serviceName.toLowerCase().includes(term) ||
      b.email.toLowerCase().includes(term)
    );

  const filters: Array<{ key: 'all' | Booking['status']; label: string }> = [
    { key: 'all',            label: 'All' },
    { key: 'pending',        label: 'Pending' },
    { key: 'confirmed',      label: 'Confirmed' },
    { key: 'awaiting_parts', label: 'Awaiting Parts' },
    { key: 'completed',      label: 'Completed' },
    { key: 'cancelled',      label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange/80 mb-2">
            Bookings
          </p>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">Customer Bookings</h2>
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-80 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, vehicle..."
            className="w-full bg-[#121212] border border-gray-800 text-white text-sm pl-9 pr-8 py-2.5 rounded focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 transition-all placeholder-gray-600 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Matrix */}
      <div className="flex flex-wrap gap-2">
        {filters.map(({ key, label }) => {
          const count = key === 'all' ? appointments.length : appointments.filter(b => b.status === key).length;
          const isActive = statusFilter === key;
          
          return (
            <button 
              key={key} 
              onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors rounded ${
                isActive
                  ? 'bg-brand-orange/10 border-brand-orange/50 text-brand-orange'
                  : 'bg-[#121212] border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {label}
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono leading-none ${
                isActive ? 'bg-brand-orange/20 text-brand-orange' : 'bg-gray-800 text-gray-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-lg bg-[#121212]/50">
          <Loader2 className="w-6 h-6 text-brand-orange animate-spin mb-3" />
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">Fetching Records...</p>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && status !== 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 border border-gray-800 border-dashed rounded-lg bg-[#121212]">
          <p className="text-gray-500 font-mono text-sm">
            {term ? `> No records matching query: "${search}"` : `> No records found for status: ${statusFilter}`}
          </p>
          {term && (
            <button onClick={() => setSearch('')} className="mt-4 px-4 py-2 border border-gray-700 hover:border-brand-orange hover:text-brand-orange text-xs text-gray-400 font-bold uppercase tracking-widest transition-colors rounded">
              Clear Query
            </button>
          )}
        </div>
      )}

      {/* Results Rendering */}
      {filtered.length > 0 && (
        <div className="bg-[#121212] border border-gray-800 rounded-lg overflow-hidden shadow-xl">
          
          {/* ── DESKTOP: DATA TABLE ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-[#151515] border-b border-gray-800">
                  {['Customer', 'Service / Vehicle', 'Appointment', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map(b => (
                  <tr
                    key={b.id}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => onView(b.id)}
                  >
                    {/* Client */}
                    <td className="px-5 py-4">
                      <p className="text-white font-bold text-sm">{b.name}</p>
                      <p className="text-gray-500 text-xs font-mono mt-0.5">{b.phone}</p>
                    </td>

                    {/* Service & Variations */}
                    <td className="px-5 py-4">
                      <p className="text-gray-200 font-semibold text-sm">{b.serviceName}</p>
                      
                      {b.selectedVariations && b.selectedVariations?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {b.selectedVariations.map(v => (
                            <span key={`${v.serviceId}-${v.variationId}`} className="inline-flex items-center text-[9px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400">
                              <span className="text-brand-orange/60 mr-1">+</span>{v.variationName}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-gray-600 text-[10px] uppercase tracking-widest font-mono mt-2 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-gray-600" /> {b.vehicleInfo}
                      </p>
                    </td>

                    {/* DateTime */}
                    <td className="px-5 py-4 text-gray-400 text-xs font-mono">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-600" /> {b.appointmentDate}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-600" /> {b.appointmentTime}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded border ${STATUS_STYLES[b.status]}`}>
                        {formatStatus(b.status)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onView(b.id)}
                          title="View Details"
                          className="flex items-center justify-center w-8 h-8 bg-[#181818] border border-gray-700 hover:border-brand-orange hover:text-brand-orange text-gray-400 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {b.status !== 'cancelled' && b.status !== 'completed' && (
                          <button onClick={() => handleCancel(b.id)}
                            title="Cancel Booking"
                            className="flex items-center justify-center w-8 h-8 bg-[#181818] border border-gray-700 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 text-gray-400 rounded transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); requestDelete(b.id, b.name); }}
                          title="Delete Booking"
                          disabled={deleteBusyId === b.id}
                          className="flex items-center justify-center w-8 h-8 bg-[#181818] border border-gray-700 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 text-gray-400 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {deleteBusyId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── MOBILE: CARD GRID ── */}
          <div className="md:hidden divide-y divide-gray-800/50">
            {filtered.map(b => (
              <div
                key={b.id}
                className="p-5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => onView(b.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-white font-bold text-sm leading-tight">{b.name}</p>
                    <p className="text-gray-500 text-[11px] font-mono mt-1">{b.phone}</p>
                  </div>
                  <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded border shrink-0 ${STATUS_STYLES[b.status]}`}>
                    {formatStatus(b.status)}
                  </span>
                </div>
                
                <div className="mb-4 bg-[#151515] border border-gray-800/80 p-3 rounded">
                  <p className="text-gray-200 text-sm font-semibold">{b.serviceName}</p>
                  
                  {b.selectedVariations && b.selectedVariations?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {b.selectedVariations.map(v => (
                        <span key={`${v.serviceId}-${v.variationId}`} className="inline-flex items-center text-[9px] font-mono bg-black/20 border border-white/5 px-1.5 py-0.5 rounded text-gray-400">
                          <span className="text-brand-orange/60 mr-1">+</span>{v.variationName}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-gray-500 text-[10px] uppercase tracking-widest font-mono mt-3 border-t border-gray-800/80 pt-2">
                    {b.vehicleInfo}
                  </p>
                </div>

                <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-600" /> {b.appointmentDate}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-600" /> {b.appointmentTime}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {b.status !== 'cancelled' && b.status !== 'completed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancel(b.id); }}
                        title="Cancel Booking"
                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); requestDelete(b.id, b.name); }}
                      title="Delete Booking"
                      disabled={deleteBusyId === b.id}
                      className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deleteBusyId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-md bg-[#101010] border border-red-500/30 rounded-lg shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-red-500/20 bg-red-500/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">Delete Booking</p>
                <h3 className="text-sm font-semibold text-white">This action cannot be undone.</h3>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-300">
                Permanently delete booking for <span className="font-semibold text-white">{deleteTarget.name}</span>?
              </p>
            </div>

            <div className="px-5 py-4 border-t border-gray-800 bg-[#0c0c0c] flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusyId !== null}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(deleteTarget.id)}
                disabled={deleteBusyId !== null}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-red-500/50 text-red-200 hover:bg-red-500/15 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteBusyId === deleteTarget.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{deleteBusyId === deleteTarget.id ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}