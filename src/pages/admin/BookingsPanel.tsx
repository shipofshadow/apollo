import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Calendar, Clock, Package, Loader2,
  CheckCircle2, XCircle, Eye, X, Car, User, Mail, Phone,
  Wrench, FileText, Image as ImageIcon, PenLine, Hash,
} from 'lucide-react';
import { fetchAllBookingsAsync, updateBookingStatusAsync } from '../../store/bookingSlice';
import { updateBookingPartsApi } from '../../services/api';
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

export default function BookingsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { appointments, status } = useSelector((s: RootState) => s.booking);
  const [statusFilter, setStatusFilter] = useState<'all' | Booking['status']>('all');

  const [partsModal, setPartsModal] = useState<string | null>(null);
  const [partsNotes, setPartsNotes] = useState('');
  const [partsBusy,  setPartsBusy]  = useState(false);

  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (token) dispatch(fetchAllBookingsAsync(token));
  }, [token, dispatch]);

  const handleStatus = (id: string, newStatus: Booking['status']) => {
    if (!token) return;
    dispatch(updateBookingStatusAsync({ token, id, status: newStatus }));
  };

  const openPartsModal = (b: Booking) => {
    setPartsNotes(b.partsNotes ?? '');
    setPartsModal(b.id);
  };

  const handlePartsSave = async () => {
    if (!token || !partsModal) return;
    setPartsBusy(true);
    try {
      await updateBookingPartsApi(token, partsModal, true, partsNotes);
      dispatch(updateBookingStatusAsync({ token, id: partsModal, status: 'awaiting_parts' }));
    } catch { /* silently fail */ }
    finally { setPartsBusy(false); setPartsModal(null); }
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

      {partsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-gray-700 rounded-sm p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              <h3 className="text-white font-bold uppercase tracking-wide">Flag: Awaiting Parts</h3>
            </div>
            <p className="text-gray-400 text-sm">Describe which parts are in transit. The customer will be notified by email.</p>
            <textarea rows={4} value={partsNotes} onChange={e => setPartsNotes(e.target.value)}
              placeholder="e.g. Custom AES shrouds ordered from Japan — ETA 7–10 days"
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-purple-400 transition-colors resize-none rounded-sm text-sm" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPartsModal(null)}
                className="px-4 py-2 text-gray-400 border border-gray-700 hover:border-gray-500 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors">
                Cancel
              </button>
              <button onClick={handlePartsSave} disabled={partsBusy || !partsNotes.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50 flex items-center gap-2">
                {partsBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />} Save & Notify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {viewBooking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-brand-dark border border-gray-700 rounded-sm w-full max-w-2xl my-auto space-y-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-brand-darker/60">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-orange" />
                <h3 className="text-white font-bold uppercase tracking-wide">Booking Details</h3>
              </div>
              <button onClick={() => setViewBooking(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6 max-h-[80vh] overflow-y-auto">

              {/* Status row */}
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[viewBooking.status]}`}>
                  {formatStatus(viewBooking.status)}
                </span>
                <span className="text-gray-500 text-xs flex items-center gap-1">
                  <Hash className="w-3 h-3" />{viewBooking.id}
                </span>
              </div>

              {/* Customer */}
              <section>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Customer
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-brand-darker/60 border border-gray-800 rounded-sm px-4 py-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><User className="w-3 h-3" /> Name</p>
                    <p className="text-white text-sm font-semibold">{viewBooking.name}</p>
                  </div>
                  <div className="bg-brand-darker/60 border border-gray-800 rounded-sm px-4 py-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Mail className="w-3 h-3" /> Email</p>
                    <p className="text-gray-200 text-sm break-all">{viewBooking.email}</p>
                  </div>
                  <div className="bg-brand-darker/60 border border-gray-800 rounded-sm px-4 py-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Phone className="w-3 h-3" /> Phone</p>
                    <p className="text-gray-200 text-sm">{viewBooking.phone}</p>
                  </div>
                </div>
              </section>

              {/* Vehicle */}
              <section>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" /> Vehicle
                </p>
                <div className="bg-brand-darker/60 border border-gray-800 rounded-sm px-4 py-3">
                  <p className="text-white text-sm font-semibold">{viewBooking.vehicleInfo}</p>
                  {(viewBooking.vehicleYear || viewBooking.vehicleMake || viewBooking.vehicleModel) && (
                    <p className="text-gray-500 text-xs mt-1">
                      {[viewBooking.vehicleYear, viewBooking.vehicleMake, viewBooking.vehicleModel].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </section>

              {/* Service & Appointment */}
              <section>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" /> Service & Appointment
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 bg-brand-darker/60 border border-gray-800 rounded-sm px-4 py-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Calendar className="w-3 h-3" /> Date</p>
                    <p className="text-gray-200 text-sm">{viewBooking.appointmentDate}</p>
                  </div>
                  <div className="bg-brand-darker/60 border border-gray-800 rounded-sm px-4 py-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Time</p>
                    <p className="text-gray-200 text-sm">{viewBooking.appointmentTime}</p>
                  </div>
                  <div className="sm:col-span-3 bg-brand-darker/60 border border-gray-800 rounded-sm px-4 py-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Wrench className="w-3 h-3" /> Service(s)</p>
                    <p className="text-gray-200 text-sm">{viewBooking.serviceName}</p>
                  </div>
                </div>
              </section>

              {/* Notes */}
              {viewBooking.notes && (
                <section>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Notes
                  </p>
                  <div className="bg-brand-darker/60 border border-gray-800 rounded-sm px-4 py-3">
                    <p className="text-gray-200 text-sm whitespace-pre-wrap">{viewBooking.notes}</p>
                  </div>
                </section>
              )}

              {/* Parts Notes */}
              {viewBooking.partsNotes && (
                <section>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-purple-400" /> <span className="text-purple-400">Parts / Awaiting</span>
                  </p>
                  <div className="bg-purple-500/5 border border-purple-500/30 rounded-sm px-4 py-3">
                    <p className="text-purple-200 text-sm whitespace-pre-wrap">{viewBooking.partsNotes}</p>
                  </div>
                </section>
              )}

              {/* Reference Photos */}
              {viewBooking.mediaUrls && viewBooking.mediaUrls.length > 0 && (
                <section>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> Reference Photos ({viewBooking.mediaUrls.length})
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {viewBooking.mediaUrls.map((url, i) => (
                      <button key={i} onClick={() => setLightboxUrl(url)}
                        className="aspect-square overflow-hidden rounded-sm border border-gray-700 hover:border-brand-orange transition-colors">
                        <img src={url} alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Signature */}
              {viewBooking.signatureData && (
                <section>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                    <PenLine className="w-3.5 h-3.5" /> Waiver Signature
                  </p>
                  <div className="bg-brand-darker/60 border border-gray-800 rounded-sm p-3 flex items-center justify-center">
                    <img src={viewBooking.signatureData} alt="Customer signature"
                      className="max-w-full h-20 object-contain" />
                  </div>
                </section>
              )}

              {/* Booking meta */}
              <p className="text-xs text-gray-600 text-right">
                Submitted {new Date(viewBooking.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxUrl(null)}>
            <X className="w-7 h-7" />
          </button>
          <img src={lightboxUrl} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-sm"
            referrerPolicy="no-referrer" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border transition-colors ${
              statusFilter === key
                ? 'bg-brand-orange border-brand-orange text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            }`}>
            {label}
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${statusFilter === key ? 'bg-white/20' : 'bg-gray-800'}`}>
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

      {filtered.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Client', 'Vehicle', 'Service', 'Date & Time', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-b border-gray-800 hover:bg-brand-darker/40 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-white font-semibold">{b.name}</p>
                    <p className="text-gray-500 text-xs">{b.phone}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-300 text-sm">{b.vehicleInfo}</td>
                  <td className="px-5 py-4 text-gray-300 text-sm">{b.serviceName}</td>
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
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setViewBooking(b)}
                        title="View full booking details"
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-700/50 border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                        <Eye className="w-3 h-3" /> View
                      </button>
                      {b.status === 'pending' && (
                        <button onClick={() => handleStatus(b.id, 'confirmed')}
                          title="Confirm this booking"
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Confirm
                        </button>
                      )}
                      {(b.status === 'pending' || b.status === 'confirmed' || b.status === 'awaiting_parts') && (
                        <button onClick={() => openPartsModal(b)}
                          title="Flag as waiting for parts"
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <Package className="w-3 h-3" /> Parts
                        </button>
                      )}
                      {b.status === 'awaiting_parts' && (
                        <button onClick={() => handleStatus(b.id, 'confirmed')}
                          title="Parts arrived — resume this booking"
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Resume
                        </button>
                      )}
                      {(b.status === 'pending' || b.status === 'confirmed' || b.status === 'awaiting_parts') && (
                        <button onClick={() => handleStatus(b.id, 'cancelled')}
                          title="Cancel this booking"
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <XCircle className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button onClick={() => handleStatus(b.id, 'completed')}
                          title="Mark as completed"
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Complete
                        </button>
                      )}
                      {b.partsNotes && (
                        <span className="text-xs text-purple-400 italic truncate max-w-[120px]" title={b.partsNotes}>
                          📦 {b.partsNotes}
                        </span>
                      )}
                      {b.mediaUrls && b.mediaUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-800">
                          {b.mediaUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`Photo ${i + 1}`}
                                className="w-10 h-10 object-cover rounded-sm border border-gray-700 hover:border-brand-orange transition-colors"
                                referrerPolicy="no-referrer"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
