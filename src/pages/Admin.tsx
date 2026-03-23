import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import {
  BarChart3, Package, FileText, Calendar, LogOut, Wrench,
  TrendingUp, Activity, Eye, EyeOff, AlertCircle, Loader2,
  CheckCircle2, XCircle, Clock, Plus, Pencil, Trash2, Save, X,
} from 'lucide-react';
import { fetchAllBookingsAsync, updateBookingStatusAsync } from '../store/bookingSlice';
import {
  fetchServicesAsync, createServiceAsync,
  updateServiceAsync, deleteServiceAsync,
} from '../store/servicesSlice';
import { addPost, updatePost, deletePost, toggleStatus } from '../store/contentSlice';
import type { AppDispatch, RootState } from '../store';
import type { Booking, Service } from '../types';
import type { ContentPost } from '../store/contentSlice';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/10  text-green-400  border-green-500/30',
  completed: 'bg-blue-500/10   text-blue-400   border-blue-500/30',
  cancelled: 'bg-gray-700      text-gray-400   border-gray-600',
};

const ICON_OPTIONS = ['Lightbulb', 'MonitorPlay', 'ShieldAlert', 'CarFront', 'Zap', 'Wrench'];

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

  useEffect(() => {
    if (token) dispatch(fetchAllBookingsAsync(token));
  }, [token, dispatch]);

  const handleStatus = (id: string, newStatus: Booking['status']) => {
    if (!token) return;
    dispatch(updateBookingStatusAsync({ token, id, status: newStatus }));
  };

  const filtered = statusFilter === 'all'
    ? appointments
    : appointments.filter(b => b.status === statusFilter);

  const filters: Array<{ key: 'all' | Booking['status']; label: string }> = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">Client Bookings</h2>

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
                    <div className="flex items-center gap-2">
                      {b.status === 'pending' && (
                        <button onClick={() => handleStatus(b.id, 'confirmed')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Confirm
                        </button>
                      )}
                      {(b.status === 'pending' || b.status === 'confirmed') && (
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
  const [deleteConf, setDeleteConf] = useState<number | null>(null);

  useEffect(() => {
    if (token) dispatch(fetchServicesAsync(token));
  }, [token, dispatch]);

  const openNew = () => { setForm(EMPTY_FORM); setEditId(null); setEditing(true); };
  const openEdit = (s: Service) => { setForm(serviceToForm(s)); setEditId(s.id); setEditing(true); };
  const cancel = () => { setEditing(false); setEditId(null); };

  const set = (field: keyof ServiceForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    const payload = formToPayload(form);
    if (editId !== null) {
      await dispatch(updateServiceAsync({ token, id: editId, data: payload }));
    } else {
      await dispatch(createServiceAsync({ token, data: payload }));
    }
    setSaving(false);
    setEditing(false);
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
              <input value={form.imageUrl} onChange={set('imageUrl')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="https://…" />
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


// ── Content panel – Redux-backed ─────────────────────────────────────────────
type PostForm = { id: number | null; title: string; type: 'Blog' | 'Portfolio'; content: string; status: 'Draft' | 'Published' };
const EMPTY_POST: PostForm = { id: null, title: '', type: 'Blog', content: '', status: 'Draft' };

function ContentPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const posts    = useSelector((s: RootState) => s.content.posts);

  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState<PostForm>(EMPTY_POST);

  const openNew  = ()           => { setCurrent(EMPTY_POST); setEditing(true); };
  const openEdit = (p: ContentPost) => { setCurrent({ ...p }); setEditing(true); };
  const cancel   = ()           => setEditing(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (current.id) {
      dispatch(updatePost(current as ContentPost));
    } else {
      dispatch(addPost({ title: current.title, type: current.type, content: current.content, status: current.status }));
    }
    setEditing(false);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Title *</label>
              <input required value={current.title} onChange={e => setCurrent(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Type</label>
              <select value={current.type} onChange={e => setCurrent(p => ({ ...p, type: e.target.value as 'Blog' | 'Portfolio' }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm appearance-none">
                <option value="Blog">Blog</option>
                <option value="Portfolio">Portfolio</option>
              </select>
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
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Content *</label>
              <textarea required rows={12} value={current.content}
                onChange={e => setCurrent(p => ({ ...p, content: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white p-4 focus:outline-none focus:border-brand-orange rounded-sm resize-none"
                placeholder="Write your content here…" />
            </div>
          </div>
          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit"
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
              <Save className="w-4 h-4" /> Save
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
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Manage Content</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
        <table className="w-full text-left min-w-[500px]">
          <thead>
            <tr className="border-b border-gray-800 bg-brand-darker/50">
              {['Title', 'Type', 'Status', 'Actions'].map(h => (
                <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map(post => (
              <tr key={post.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                <td className="p-4 text-white font-bold">{post.title}</td>
                <td className="p-4 text-gray-400 text-sm">{post.type}</td>
                <td className="p-4">
                  <button onClick={() => dispatch(toggleStatus(post.id))}
                    className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                      post.status === 'Published'
                        ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>
                    {post.status}
                  </button>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(post)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => dispatch(deletePost(post.id))}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-500 hover:border-red-500/50 hover:text-red-400 text-xs font-bold uppercase rounded-sm transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">No posts yet.</td></tr>
            )}
          </tbody>
        </table>
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
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">Dashboard Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { label: 'Total Revenue',   value: '₱1,347,500', icon: Activity,   sub: '+12% from last month', color: 'text-green-500' },
                { label: 'Active Bookings', value: '42',         icon: Calendar,   sub: '+5 new this week',     color: 'text-green-500' },
                { label: 'Website Visits',  value: '1,204',      icon: TrendingUp, sub: 'Last 30 days',         color: 'text-gray-500'  },
              ].map(({ label, value, icon: Icon, sub, color }) => (
                <div key={label} className="bg-brand-dark p-6 border border-gray-800 rounded-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">{label}</h3>
                    <Icon className="w-5 h-5 text-brand-orange" />
                  </div>
                  <p className="text-3xl font-display font-bold text-white">{value}</p>
                  <p className={`text-sm mt-2 ${color}`}>{sub}</p>
                </div>
              ))}
            </div>
            <div className="bg-brand-dark p-6 border border-gray-800 rounded-sm h-80 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Revenue chart coming soon</p>
              </div>
            </div>
          </div>
        );

      case 'services':     return <ServicesPanel />;
      case 'content':      return <ContentPanel />;
      case 'appointments': return <BookingsPanel />;

      case 'products':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Manage Products</h2>
              <button className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>
            <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Full product CRUD coming soon.</p>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-brand-darker flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-brand-dark border-r border-gray-800 flex-shrink-0 flex flex-col md:min-h-[calc(100vh-6rem)]">
        <div className="p-6 border-b border-gray-800">
          <p className="text-white font-display font-bold uppercase tracking-widest text-sm">Admin Panel</p>
          <p className="text-gray-500 text-xs truncate mt-1">{user.email}</p>
        </div>
        <nav className="p-4 space-y-2 flex-grow">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors rounded-sm ${
                activeTab === key ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800 mt-auto">
          <button onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors rounded-sm">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto pb-24 md:pb-10">
        {renderContent()}
      </div>
    </div>
  );
}
