import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import {
  BarChart3, Package, FileText, Calendar, LogOut, Wrench,
  TrendingUp, Activity, Eye, EyeOff, AlertCircle, Loader2,
  CheckCircle2, XCircle, Clock, Plus, Pencil, Trash2, Save, X, ArrowLeft,
  Phone, Mail, Lock, CheckCircle, UserCog, DollarSign, Upload,
} from 'lucide-react';
import logo from '../assets/logo.png';
import { fetchAllBookingsAsync, updateBookingStatusAsync } from '../store/bookingSlice';
import {
  fetchServicesAsync, createServiceAsync,
  updateServiceAsync, deleteServiceAsync,
} from '../store/servicesSlice';
import {
  fetchBlogPostsAsync, createBlogPostAsync, updateBlogPostAsync, deleteBlogPostAsync,
} from '../store/contentSlice';
import {
  fetchProductsAsync, createProductAsync,
  updateProductAsync, deleteProductAsync,
} from '../store/productsSlice';
import { updateProfileAsync, clearAuthError } from '../store/authSlice';
import { fetchAdminStatsApi, updateBookingPartsApi, updateShopHoursApi, fetchShopHoursApi, uploadAdminImageApi, type AdminStats } from '../services/api';
import type { AppDispatch, RootState } from '../store';
import type { Booking, Service, Product } from '../types';
import type { ContentPost } from '../store/contentSlice';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-400  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-gray-700      text-gray-400    border-gray-600',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

const ICON_OPTIONS = ['Lightbulb', 'MonitorPlay', 'ShieldAlert', 'CarFront', 'Zap', 'Wrench'];

const UPLOAD_MAX_MB = 10;

/** Returns an error string if the file exceeds the allowed size, or null if OK. */
function validateImageFile(file: File): string | null {
  if (file.size > UPLOAD_MAX_MB * 1024 * 1024) {
    return `Image must be under ${UPLOAD_MAX_MB} MB.`;
  }
  return null;
}

type ServiceForm = {
  title: string; description: string; fullDescription: string;
  icon: string; imageUrl: string; duration: string;
  startingPrice: string; features: string; sortOrder: number; isActive: boolean;
};

const EMPTY_FORM: ServiceForm = {
  title: '', description: '', fullDescription: '', icon: 'Wrench',
  imageUrl: '', duration: '', startingPrice: '', features: '', sortOrder: 0, isActive: true,
};

function serviceToForm(s: Service): ServiceForm {
  return {
    title: s.title, description: s.description, fullDescription: s.fullDescription,
    icon: s.icon, imageUrl: s.imageUrl, duration: s.duration,
    startingPrice: s.startingPrice,
    features: s.features.join('\n'),
    sortOrder: s.sortOrder, isActive: s.isActive,
  };
}

function formToPayload(f: ServiceForm) {
  return {
    ...f,
    features: f.features.split('\n').map(l => l.trim()).filter(Boolean),
  };
}

// ── Admin login screen ────────────────────────────────────────────────────────
function AdminLogin() {
  const { status, error, login, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [pw,    setPw]    = useState('');
  const [show,  setShow]  = useState(false);

  useEffect(() => () => { clearError(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, pw).catch(() => {});
  };

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker flex items-center justify-center">
      <div className="bg-brand-dark p-8 rounded-sm border border-gray-800 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter">
            Admin <span className="text-brand-orange">Login</span>
          </h1>
          <p className="text-gray-400 mt-2">Enter your admin credentials</p>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm mb-6 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
              placeholder="admin@example.com" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Password</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)}
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 pr-12 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                placeholder="••••••••" />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={status === 'loading'}
            className="w-full bg-brand-orange text-white font-bold uppercase tracking-widest py-4 hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 rounded-sm">
            {status === 'loading'
              ? <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5" />
              : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Bookings panel ────────────────────────────────────────────────────────────
function BookingsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { appointments, status } = useSelector((s: RootState) => s.booking);
  const [statusFilter, setStatusFilter] = useState<'all' | Booking['status']>('all');

  // Parts tracking modal state
  const [partsModal,  setPartsModal]  = useState<string | null>(null); // booking id
  const [partsNotes,  setPartsNotes]  = useState('');
  const [partsBusy,   setPartsBusy]   = useState(false);

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
      // Also update status to awaiting_parts
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

      {/* Parts modal */}
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
              <button onClick={() => setPartsModal(null)} className="px-4 py-2 text-gray-400 border border-gray-700 hover:border-gray-500 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors">Cancel</button>
              <button onClick={handlePartsSave} disabled={partsBusy || !partsNotes.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50 flex items-center gap-2">
                {partsBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />} Save & Notify
              </button>
            </div>
          </div>
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
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {b.status === 'pending' && (
                        <button onClick={() => handleStatus(b.id, 'confirmed')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Confirm
                        </button>
                      )}
                      {(b.status === 'pending' || b.status === 'confirmed' || b.status === 'awaiting_parts') && (
                        <button onClick={() => openPartsModal(b)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <Package className="w-3 h-3" /> Parts
                        </button>
                      )}
                      {b.status === 'awaiting_parts' && (
                        <button onClick={() => handleStatus(b.id, 'confirmed')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Resume
                        </button>
                      )}
                      {(b.status === 'pending' || b.status === 'confirmed' || b.status === 'awaiting_parts') && (
                        <button onClick={() => handleStatus(b.id, 'cancelled')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <XCircle className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button onClick={() => handleStatus(b.id, 'completed')}
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

// ── Services CRUD panel ───────────────────────────────────────────────────────
function ServicesPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { items: services, status } = useSelector((s: RootState) => s.services);

  const [editing,    setEditing]    = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [form,       setForm]       = useState<ServiceForm>(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [deleteConf, setDeleteConf] = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => {
    if (token) dispatch(fetchServicesAsync(token));
  }, [token, dispatch]);

  const openNew = () => { setForm(EMPTY_FORM); setEditId(null); setSaveError(null); setEditing(true); };
  const openEdit = (s: Service) => { setForm(serviceToForm(s)); setEditId(s.id); setSaveError(null); setEditing(true); };
  const cancel = () => { setEditing(false); setEditId(null); setSaveError(null); };

  const set = (field: keyof ServiceForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const payload = formToPayload(form);
    try {
      if (editId !== null) {
        await dispatch(updateServiceAsync({ token, id: editId, data: payload })).unwrap();
      } else {
        await dispatch(createServiceAsync({ token, data: payload })).unwrap();
      }
      setEditing(false);
      setEditId(null);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save service.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deleteServiceAsync({ token, id }));
    setDeleteConf(null);
  };

  // ── Form view ──
  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {editId ? 'Edit Service' : 'New Service'}
          </h2>
          <button onClick={cancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-6">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Title *</label>
              <input required value={form.title} onChange={set('title')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Short Description * (card)</label>
              <textarea required rows={2} value={form.description} onChange={set('description')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-none" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Full Description (detail page)</label>
              <textarea rows={5} value={form.fullDescription} onChange={set('fullDescription')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-none" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Icon</label>
              <select value={form.icon} onChange={set('icon')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm appearance-none">
                {ICON_OPTIONS.map(ic => <option key={ic}>{ic}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Image URL</label>
              <div className="flex gap-2">
                <input value={form.imageUrl} onChange={set('imageUrl')}
                  className="flex-1 bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                  placeholder="https://… or upload below" />
                <label className={`flex items-center gap-2 px-4 py-3 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange transition-colors rounded-sm cursor-pointer text-sm font-bold uppercase tracking-widest ${imgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span className="hidden sm:inline">Upload</span>
                  <input type="file" accept="image/*" className="hidden" disabled={imgUploading} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file || !token) return;
                    const sizeErr = validateImageFile(file);
                    if (sizeErr) {
                      setSaveError(sizeErr);
                      e.target.value = '';
                      return;
                    }
                    setImgUploading(true);
                    try {
                      const url = await uploadAdminImageApi(token, file, 'services');
                      setForm(p => ({ ...p, imageUrl: url }));
                    } catch (err: unknown) {
                      setSaveError((err as Error)?.message ?? 'Image upload failed.');
                    } finally {
                      setImgUploading(false);
                      e.target.value = '';
                    }
                  }} />
                </label>
              </div>
              {form.imageUrl && (
                <div className="relative mt-2 h-32 w-full rounded-sm border border-gray-700 overflow-hidden bg-gray-800">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                  </div>
                  <img src={form.imageUrl} alt={form.title || 'Preview'}
                    className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                    onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                    referrerPolicy="no-referrer"
                  />
                  <button type="button" onClick={() => setForm(p => ({ ...p, imageUrl: '' }))}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/70 text-white rounded-sm transition-colors"
                    title="Remove image">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Duration</label>
              <input value={form.duration} onChange={set('duration')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="e.g. 4–6 Hours" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Starting Price (₱)</label>
              <input value={form.startingPrice} onChange={set('startingPrice')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="e.g. ₱13,750 or Consultation" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Key Features &amp; Benefits <span className="font-normal text-gray-600">(one per line)</span>
              </label>
              <textarea rows={6} value={form.features} onChange={set('features')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-y font-mono text-sm"
                placeholder="Bi-LED Projector Conversions&#10;RGBW Demon Eyes&#10;…" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
              <input type="number" min={0} value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 text-sm font-bold uppercase tracking-widest">
                <input type="checkbox" checked={form.isActive}
                  onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                  className="accent-brand-orange w-4 h-4" />
                Active (visible on site)
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? 'Save Changes' : 'Create Service'}
            </button>
            <button type="button" onClick={cancel}
              className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── List view ──
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Services</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> New Service
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {services.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No services yet. Click <strong>New Service</strong> to create one.</p>
        </div>
      )}

      {services.length > 0 && (
        <div className="space-y-3">
          {services.map(svc => (
            <div key={svc.id} className="bg-brand-dark border border-gray-800 rounded-sm p-5 flex items-start gap-4">
              {svc.imageUrl && (
                <img src={svc.imageUrl} alt={svc.title}
                  className="w-16 h-16 object-cover rounded-sm shrink-0 border border-gray-700"
                  referrerPolicy="no-referrer" />
              )}
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-white font-bold text-lg truncate">{svc.title}</h3>
                  {!svc.isActive && (
                    <span className="shrink-0 px-2 py-0.5 text-xs font-bold uppercase bg-gray-800 text-gray-500 rounded-sm border border-gray-700">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm line-clamp-1">{svc.description}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  {svc.duration      && <span className="bg-gray-800 px-2 py-0.5 rounded">{svc.duration}</span>}
                  {svc.startingPrice && <span className="bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded font-bold">{svc.startingPrice}</span>}
                  <span className="bg-gray-800 px-2 py-0.5 rounded">{svc.features.length} features</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(svc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                {deleteConf === svc.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleDelete(svc.id)}
                      className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                      Confirm
                    </button>
                    <button onClick={() => setDeleteConf(null)}
                      className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConf(svc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-500 hover:border-red-500/50 hover:text-red-400 text-xs font-bold uppercase rounded-sm transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Blog posts panel – API-backed ────────────────────────────────────────────
type PostForm = { id: number | null; title: string; content: string; status: 'Draft' | 'Published'; coverImage: string };
const EMPTY_POST: PostForm = { id: null, title: '', content: '', status: 'Draft', coverImage: '' };

function ContentPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { posts, status } = useSelector((s: RootState) => s.content);

  const [editing,    setEditing]    = useState(false);
  const [current,    setCurrent]    = useState<PostForm>(EMPTY_POST);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [deleteConf, setDeleteConf] = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => {
    if (token) dispatch(fetchBlogPostsAsync(token));
  }, [token, dispatch]);

  const openNew  = ()              => { setCurrent(EMPTY_POST); setSaveError(null); setEditing(true); };
  const openEdit = (p: ContentPost) => {
    setCurrent({ id: p.id, title: p.title, content: p.content, status: p.status, coverImage: p.coverImage ?? '' });
    setSaveError(null);
    setEditing(true);
  };
  const cancel   = ()              => { setEditing(false); setSaveError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const data = {
      title: current.title,
      content: current.content,
      status: current.status,
      ...(current.coverImage ? { coverImage: current.coverImage } : {}),
    };
    try {
      if (current.id !== null) {
        await dispatch(updateBlogPostAsync({ token, id: current.id, data })).unwrap();
      } else {
        await dispatch(createBlogPostAsync({ token, data })).unwrap();
      }
      setEditing(false);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save blog post.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (post: ContentPost) => {
    if (!token) return;
    await dispatch(updateBlogPostAsync({
      token,
      id: post.id,
      data: { status: post.status === 'Published' ? 'Draft' : 'Published' },
    }));
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deleteBlogPostAsync({ token, id }));
    setDeleteConf(null);
  };

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {current.id ? 'Edit Post' : 'New Post'}
          </h2>
          <button onClick={cancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-6">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Title *</label>
              <input required value={current.title} onChange={e => setCurrent(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Status</label>
              <select value={current.status} onChange={e => setCurrent(p => ({ ...p, status: e.target.value as 'Draft' | 'Published' }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm appearance-none">
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Cover Image</label>
              <div className="flex gap-2">
                <input value={current.coverImage} onChange={e => setCurrent(p => ({ ...p, coverImage: e.target.value }))}
                  className="flex-1 bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                  placeholder="https://… or upload below" />
                <label className={`flex items-center gap-2 px-4 py-3 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange transition-colors rounded-sm cursor-pointer text-sm font-bold uppercase tracking-widest ${imgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span className="hidden sm:inline">Upload</span>
                  <input type="file" accept="image/*" className="hidden" disabled={imgUploading} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file || !token) return;
                    const sizeErr = validateImageFile(file);
                    if (sizeErr) {
                      setSaveError(sizeErr);
                      e.target.value = '';
                      return;
                    }
                    setImgUploading(true);
                    try {
                      const url = await uploadAdminImageApi(token, file, 'blog');
                      setCurrent(p => ({ ...p, coverImage: url }));
                    } catch (err: unknown) {
                      setSaveError((err as Error)?.message ?? 'Image upload failed.');
                    } finally {
                      setImgUploading(false);
                      e.target.value = '';
                    }
                  }} />
                </label>
              </div>
              {current.coverImage && (
                <div className="relative mt-2 h-32 w-full rounded-sm border border-gray-700 overflow-hidden bg-gray-800">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                  </div>
                  <img src={current.coverImage} alt={current.title || 'Preview'}
                    className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                    onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                    referrerPolicy="no-referrer"
                  />
                  <button type="button" onClick={() => setCurrent(p => ({ ...p, coverImage: '' }))}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/70 text-white rounded-sm transition-colors"
                    title="Remove image">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Content *</label>
              <textarea required rows={12} value={current.content}
                onChange={e => setCurrent(p => ({ ...p, content: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white p-4 focus:outline-none focus:border-brand-orange rounded-sm resize-none"
                placeholder="Write your blog post here…" />
            </div>
          </div>
          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {current.id ? 'Save Changes' : 'Publish'}
            </button>
            <button type="button" onClick={cancel}
              className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Blog Posts</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {posts.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Title', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                  <td className="p-4 text-white font-bold">{post.title}</td>
                  <td className="p-4">
                    <button onClick={() => handleToggleStatus(post)}
                      className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                        post.status === 'Published'
                          ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}>
                      {post.status}
                    </button>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(post)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      {deleteConf === post.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleDelete(post.id)}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                            Confirm
                          </button>
                          <button onClick={() => setDeleteConf(null)}
                            className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConf(post.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-500 hover:border-red-500/50 hover:text-red-400 text-xs font-bold uppercase rounded-sm transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {posts.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No blog posts yet. Click <strong>New Post</strong> to create one.</p>
        </div>
      )}
    </div>
  );
}

// ── Products panel ────────────────────────────────────────────────────────────

interface ProductForm {
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  features: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '', description: '', price: '', category: '',
  imageUrl: '', features: '', sortOrder: 0, isActive: true,
};

function productToForm(p: Product): ProductForm {
  return {
    name:        p.name,
    description: p.description,
    price:       String(p.price),
    category:    p.category,
    imageUrl:    p.imageUrl,
    features:    p.features.join('\n'),
    sortOrder:   p.sortOrder,
    isActive:    p.isActive,
  };
}

function productFormToPayload(f: ProductForm): Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> {
  return {
    name:        f.name.trim(),
    description: f.description.trim(),
    price:       parseFloat(f.price) || 0,
    category:    f.category.trim(),
    imageUrl:    f.imageUrl.trim(),
    features:    f.features.split('\n').map(l => l.trim()).filter(Boolean),
    sortOrder:   f.sortOrder,
    isActive:    f.isActive,
  };
}

function ProductsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { items: products, status } = useSelector((s: RootState) => s.products);

  const [editing,    setEditing]    = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [form,       setForm]       = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [deleteConf, setDeleteConf] = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => {
    if (token) dispatch(fetchProductsAsync(token));
  }, [token, dispatch]);

  const openNew  = () => { setForm(EMPTY_PRODUCT_FORM); setEditId(null); setSaveError(null); setEditing(true); };
  const openEdit = (p: Product) => { setForm(productToForm(p)); setEditId(p.id); setSaveError(null); setEditing(true); };
  const cancel   = () => { setEditing(false); setEditId(null); setSaveError(null); };

  const set = (field: keyof ProductForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const payload = productFormToPayload(form);
    try {
      if (editId !== null) {
        await dispatch(updateProductAsync({ token, id: editId, data: payload })).unwrap();
      } else {
        await dispatch(createProductAsync({ token, data: payload })).unwrap();
      }
      setEditing(false);
      setEditId(null);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deleteProductAsync({ token, id }));
    setDeleteConf(null);
  };

  const handleToggleActive = async (p: Product) => {
    if (!token) return;
    await dispatch(updateProductAsync({ token, id: p.id, data: { isActive: !p.isActive } }));
  };

  // ── Form view ──
  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {editId ? 'Edit Product' : 'New Product'}
          </h2>
          <button onClick={cancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-6">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Name *</label>
              <input required value={form.name} onChange={set('name')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Description</label>
              <textarea rows={3} value={form.description} onChange={set('description')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-none" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Price (₱) *</label>
              <input required type="number" min={0} step="0.01" value={form.price} onChange={set('price')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Category</label>
              <input value={form.category} onChange={set('category')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="e.g. Headlights, Audio…" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Image URL</label>
              <div className="flex gap-2">
                <input value={form.imageUrl} onChange={set('imageUrl')}
                  className="flex-1 bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                  placeholder="https://… or upload below" />
                <label className={`flex items-center gap-2 px-4 py-3 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange transition-colors rounded-sm cursor-pointer text-sm font-bold uppercase tracking-widest ${imgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span className="hidden sm:inline">Upload</span>
                  <input type="file" accept="image/*" className="hidden" disabled={imgUploading} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file || !token) return;
                    const sizeErr = validateImageFile(file);
                    if (sizeErr) {
                      setSaveError(sizeErr);
                      e.target.value = '';
                      return;
                    }
                    setImgUploading(true);
                    try {
                      const url = await uploadAdminImageApi(token, file, 'products');
                      setForm(p => ({ ...p, imageUrl: url }));
                    } catch (err: unknown) {
                      setSaveError((err as Error)?.message ?? 'Image upload failed.');
                    } finally {
                      setImgUploading(false);
                      e.target.value = '';
                    }
                  }} />
                </label>
              </div>
              {form.imageUrl && (
                <div className="relative mt-2 h-32 w-full rounded-sm border border-gray-700 overflow-hidden bg-gray-800">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                  </div>
                  <img src={form.imageUrl} alt={form.name || 'Preview'}
                    className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                    onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                    referrerPolicy="no-referrer"
                  />
                  <button type="button" onClick={() => setForm(p => ({ ...p, imageUrl: '' }))}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/70 text-white rounded-sm transition-colors"
                    title="Remove image">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Features <span className="font-normal text-gray-600">(one per line)</span>
              </label>
              <textarea rows={5} value={form.features} onChange={set('features')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-y font-mono text-sm"
                placeholder="Feature one&#10;Feature two&#10;…" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
              <input type="number" min={0} value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 text-sm font-bold uppercase tracking-widest">
                <input type="checkbox" checked={form.isActive}
                  onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                  className="accent-brand-orange w-4 h-4" />
                Active (visible on site)
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? 'Save Changes' : 'Create Product'}
            </button>
            <button type="button" onClick={cancel}
              className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── List view ──
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Products</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {products.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No products yet. Click <strong>Add Product</strong> to create one.</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="space-y-3">
          {products.map(prod => (
            <div key={prod.id} className="bg-brand-dark border border-gray-800 rounded-sm p-5 flex items-start gap-4">
              {prod.imageUrl && (
                <img src={prod.imageUrl} alt={prod.name}
                  className="w-16 h-16 object-cover rounded-sm shrink-0 border border-gray-700"
                  referrerPolicy="no-referrer" />
              )}
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-white font-bold text-lg truncate">{prod.name}</h3>
                  {!prod.isActive && (
                    <span className="shrink-0 px-2 py-0.5 text-xs font-bold uppercase bg-gray-800 text-gray-500 rounded-sm border border-gray-700">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm line-clamp-1">{prod.description}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                  {prod.category && (
                    <span className="bg-gray-800 px-2 py-0.5 rounded">{prod.category}</span>
                  )}
                  <span className="bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded font-bold flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> ₱{prod.price.toLocaleString()}
                  </span>
                  {prod.features.length > 0 && (
                    <span className="bg-gray-800 px-2 py-0.5 rounded">{prod.features.length} features</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleToggleActive(prod)}
                  title={prod.isActive ? 'Deactivate' : 'Activate'}
                  className={`px-3 py-1.5 border text-xs font-bold uppercase rounded-sm transition-colors
                    ${prod.isActive
                      ? 'border-gray-700 text-gray-400 hover:border-yellow-500/50 hover:text-yellow-400'
                      : 'border-green-500/40 text-green-400 hover:border-green-400'}`}>
                  {prod.isActive ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => openEdit(prod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                {deleteConf === prod.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-400 font-bold">Sure?</span>
                    <button onClick={() => handleDelete(prod.id)}
                      className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-sm hover:bg-red-700 transition-colors">
                      Yes
                    </button>
                    <button onClick={() => setDeleteConf(null)}
                      className="px-2 py-1 border border-gray-700 text-gray-400 text-xs font-bold rounded-sm hover:text-white transition-colors">
                      No
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConf(prod.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-red-500/50 hover:text-red-400 text-xs font-bold uppercase rounded-sm transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Analytics panel ───────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const { token } = useAuth();
  const [stats,   setStats]   = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchAdminStatsApi(token)
      .then(setStats)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm text-sm">
      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
    </div>
  );

  const topCards = [
    { label: 'Total Bookings',  value: stats?.totalBookings    ?? 0, icon: Calendar,    color: 'text-gray-400'       },
    { label: 'Active Bookings', value: stats?.activeBookings   ?? 0, icon: Activity,    color: 'text-green-400'      },
    { label: 'Completed',       value: stats?.completedBookings ?? 0, icon: CheckCircle2, color: 'text-blue-400'     },
    { label: 'New This Month',  value: stats?.bookingsThisMonth ?? 0, icon: TrendingUp,  color: 'text-brand-orange'  },
  ];

  const statusRows = [
    { label: 'Pending',   value: stats?.pendingBookings   ?? 0, color: 'text-yellow-400' },
    { label: 'Confirmed', value: stats?.confirmedBookings ?? 0, color: 'text-green-400'  },
    { label: 'Completed', value: stats?.completedBookings ?? 0, color: 'text-blue-400'   },
    { label: 'Cancelled', value: stats?.cancelledBookings ?? 0, color: 'text-gray-400'   },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Dashboard Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {topCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-brand-dark p-6 border border-gray-800 rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">{label}</h3>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-3xl font-display font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Bookings by Status</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-800">
          {statusRows.map(({ label, value, color }) => (
            <div key={label} className="p-5 text-center">
              <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Account settings panel ────────────────────────────────────────────────────
function AccountSettingsPanel() {
  const dispatch               = useDispatch<AppDispatch>();
  const { user, token, status, error } = useAuth();

  const [info,     setInfo]    = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw,       setPw]      = useState({ newPw: '', confirm: '' });
  const [showPw,   setShowPw]  = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [saved,    setSaved]   = useState(false);

  useEffect(() => {
    if (user) setInfo({ name: user.name, phone: user.phone ?? '' });
  }, [user]);

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    setSaved(false);
    if (!token) return;
    dispatch(updateProfileAsync({ token, data: { name: info.name, phone: info.phone } }))
      .unwrap()
      .then(() => setSaved(true))
      .catch(() => {});
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    setSaved(false);
    if (pw.newPw !== pw.confirm) { setLocalErr('Passwords do not match.'); return; }
    if (pw.newPw.length < 8)     { setLocalErr('Password must be at least 8 characters.'); return; }
    if (!token) return;
    dispatch(updateProfileAsync({
      token,
      data: { password: pw.newPw, password_confirmation: pw.confirm },
    }))
      .unwrap()
      .then(() => { setSaved(true); setPw({ newPw: '', confirm: '' }); })
      .catch(() => {});
  };

  const displayError = localErr || error;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Account Settings</h2>

      {/* Avatar card */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm px-6 py-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-orange/20 border-2 border-brand-orange/50 flex items-center justify-center shrink-0">
          <span className="text-brand-orange font-black text-xl uppercase">
            {user?.name?.[0] ?? 'A'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-base truncate">{user?.name}</p>
          <p className="text-gray-500 text-sm truncate flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 shrink-0" /> {user?.email}
          </p>
        </div>
        <span className="ml-auto shrink-0 px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border border-brand-orange/30 text-brand-orange bg-brand-orange/10">
          {user?.role}
        </span>
      </div>

      {/* Feedback */}
      {saved && !displayError && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-sm text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> Changes saved successfully.
        </div>
      )}
      {displayError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {displayError}
        </div>
      )}

      {/* Personal info */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Personal Information</h3>
        </div>
        <form onSubmit={handleInfoSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> Email Address
            </label>
            <input
              type="email" value={user?.email ?? ''} disabled
              className="w-full bg-brand-darker border border-gray-800 text-gray-600 px-4 py-2.5 rounded-sm cursor-not-allowed text-sm"
            />
            <p className="text-[11px] text-gray-700">Email cannot be changed.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Name</label>
              <input
                type="text" required value={info.name}
                onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Phone Number
              </label>
              <input
                type="tel" value={info.phone}
                onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
                placeholder="09XXXXXXXXX"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit" disabled={status === 'loading'}
              className="bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
            >
              {status === 'loading' ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-brand-orange" /> Change Password
          </h3>
        </div>
        <form onSubmit={handlePwSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw.newPw}
                  onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))}
                  autoComplete="new-password"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 pr-10 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
                  placeholder="At least 8 characters"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Confirm Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit" disabled={status === 'loading' || !pw.newPw}
              className="bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
            >
              {status === 'loading' ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');

  if (!user)    return <AdminLogin />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const tabs = [
    { key: 'analytics',    label: 'Analytics', icon: BarChart3  },
    { key: 'services',     label: 'Services',  icon: Wrench     },
    { key: 'content',      label: 'Content',   icon: FileText   },
    { key: 'appointments', label: 'Bookings',  icon: Calendar   },
    { key: 'products',     label: 'Products',  icon: Package    },
    { key: 'settings',     label: 'Settings',  icon: UserCog    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':    return <AnalyticsPanel />;
      case 'services':     return <ServicesPanel />;
      case 'content':      return <ContentPanel />;
      case 'appointments': return <BookingsPanel />;
      case 'settings':     return <AccountSettingsPanel />;

      case 'products':     return <ProductsPanel />;

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-brand-darker flex flex-col">
      {/* Top bar */}
      <header className="h-16 bg-brand-dark border-b border-gray-800 flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <img src={logo} alt="1625 Autolab" className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
          <span className="hidden sm:block text-gray-600 text-lg select-none">/</span>
          <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-brand-orange">Admin Panel</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Site
          </a>
          <div className="w-px h-5 bg-gray-700" />
          <button onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 md:w-60 bg-brand-dark border-r border-gray-800 flex-shrink-0 flex flex-col">
          {/* User card */}
          <div className="p-4 md:p-5 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-brand-orange/20 border-2 border-brand-orange/40 flex items-center justify-center shrink-0">
                <span className="text-brand-orange font-black text-sm uppercase">
                  {user.name?.[0] ?? 'A'}
                </span>
              </div>
              <div className="hidden md:block min-w-0">
                <p className="text-white font-bold text-sm truncate leading-tight">{user.name}</p>
                <p className="text-gray-500 text-xs truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-2 md:p-3 space-y-0.5 flex-grow">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-sm relative ${
                  activeTab === key
                    ? 'text-brand-orange bg-brand-orange/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}>
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-brand-orange rounded-r-full transition-opacity ${activeTab === key ? 'opacity-100' : 'opacity-0'}`} />
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Logout (mobile only) */}
          <div className="md:hidden p-2 border-t border-gray-800">
            <button onClick={() => logout()}
              className="w-full flex items-center justify-center px-3 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8 lg:p-10">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
