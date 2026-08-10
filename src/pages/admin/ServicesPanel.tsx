import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Wrench, Loader2, AlertCircle, Plus, Pencil, Trash2, Save, X, Upload,
  Search, EyeOff, Clock, Tag, Layers, ArrowLeft,
  CheckCircle2, Sparkles
} from 'lucide-react';
import {
  fetchServicesAsync, createServiceAsync, updateServiceAsync, deleteServiceAsync,
} from '../../store/servicesSlice';
import { uploadAdminImageApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Service, ServiceVariation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import VariationsManager from '../../components/VariationsManager';
import { formatPrice } from '../../utils/formatPrice';

const ICON_OPTIONS = ['Lightbulb', 'MonitorPlay', 'ShieldAlert', 'CarFront', 'Zap', 'Wrench'];

const UPLOAD_MAX_MB = 10;
function validateImageFile(file: File): string | null {
  return file.size > UPLOAD_MAX_MB * 1024 * 1024
    ? `Image must be under ${UPLOAD_MAX_MB} MB.`
    : null;
}

type ServiceForm = {
  title: string; description: string; fullDescription: string;
  icon: string; imageUrl: string; duration: string;
  startingPrice: string; features: string; sortOrder: number; isActive: boolean;
  slug: string;
};

const EMPTY_FORM: ServiceForm = {
  title: '', description: '', fullDescription: '', icon: 'Wrench',
  imageUrl: '', duration: '', startingPrice: '', features: '', sortOrder: 0, isActive: true,
  slug: '',
};

function serviceToForm(s: Service): ServiceForm {
  return {
    title: s.title, description: s.description, fullDescription: s.fullDescription,
    icon: s.icon, imageUrl: s.imageUrl, duration: s.duration,
    startingPrice: s.startingPrice,
    features: s.features.join('\n'),
    sortOrder: s.sortOrder, isActive: s.isActive,
    slug: s.slug,
  };
}

function toSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formToPayload(f: ServiceForm) {
  return {
    ...f,
    features: f.features.split('\n').map(l => l.trim()).filter(Boolean),
  };
}

export default function ServicesPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { items: services, status } = useSelector((s: RootState) => s.services);

  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConf, setDeleteConf] = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [variations, setVariations] = useState<ServiceVariation[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');

  useEffect(() => {
    if (token) dispatch(fetchServicesAsync(token));
  }, [token, dispatch]);

  const openNew = () => { setForm(EMPTY_FORM); setEditId(null); setSlugEdited(false); setSaveError(null); setVariations([]); setEditing(true); };
  const openEdit = (s: Service) => { setForm(serviceToForm(s)); setEditId(s.id); setSlugEdited(false); setSaveError(null); setVariations(s.variations ?? []); setEditing(true); };
  const cancel = () => { setEditing(false); setEditId(null); setSlugEdited(false); setSaveError(null); setVariations([]); if (token) dispatch(fetchServicesAsync(token)); };

  const set = (field: keyof ServiceForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      if (field === 'slug') setSlugEdited(true);
      setForm(p => {
        const next = { ...p, [field]: value };
        if (field === 'title' && !slugEdited) {
          next.slug = toSlug(value);
        }
        return next;
      });
    };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const payload = formToPayload(form);
    try {
      if (editId !== null) {
        await dispatch(updateServiceAsync({ token, id: editId, data: payload })).unwrap();
        setEditing(false);
        setEditId(null);
        setVariations([]);
      } else {
        const newService = await dispatch(createServiceAsync({ token, data: payload })).unwrap();
        setEditId(newService.id);
        setVariations(newService.variations ?? []);
      }
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

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchesSearch =
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? s.isActive
          : !s.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [services, searchQuery, statusFilter]);

  const activeCount = useMemo(() => services.filter(s => s.isActive).length, [services]);
  const hiddenCount = useMemo(() => services.filter(s => !s.isActive).length, [services]);
  const variationsCount = useMemo(() => services.filter(s => (s.variations?.length ?? 0) > 0).length, [services]);

  if (editing) {
    return (
      <div className="space-y-8 pb-20 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-5">
          <div>
            <button
              onClick={cancel}
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Service Catalog
            </button>
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight flex items-center gap-3">
              <Wrench className="w-6 h-6 text-brand-orange" />
              {editId ? `Edit Service: ${form.title || 'Untitled'}` : 'Create New Service'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-3 bg-red-950/50 border border-red-500/40 text-red-400 px-5 py-4 rounded-xl text-sm shadow-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Service Details &amp; Configuration
              </h3>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Required fields marked *</span>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 flex items-center justify-between">
                    <span>Title *</span>
                    <span className="text-[10px] text-gray-500 font-normal">Customer facing</span>
                  </label>
                  <input
                    required
                    value={form.title}
                    onChange={set('title')}
                    placeholder="e.g. Quad Bi-LED Projector Retrofit"
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange font-sans text-sm placeholder:text-gray-600 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 flex items-center justify-between">
                    <span>Slug *</span>
                    <span className="text-[10px] font-mono text-gray-500">URL Identifier</span>
                  </label>
                  <input
                    required
                    value={form.slug}
                    onChange={set('slug')}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    title="Lowercase letters, digits and hyphens only (e.g. headlight-retrofits)"
                    placeholder="e.g. quad-biled-retrofit"
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange font-mono text-sm placeholder:text-gray-600 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Short Description * <span className="font-normal text-gray-500 text-[10px]">(Appears on catalog cards)</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Brief summary highlighting the key transformation..."
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm resize-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Full Description <span className="font-normal text-gray-500 text-[10px]">(Appears on detail overview page)</span>
                </label>
                <textarea
                  rows={5}
                  value={form.fullDescription}
                  onChange={set('fullDescription')}
                  placeholder="Detailed breakdown of components, installation procedure, and warranties..."
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm resize-y transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Category Icon</label>
                  <select
                    value={form.icon}
                    onChange={set('icon')}
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange font-mono text-sm appearance-none transition-colors cursor-pointer"
                  >
                    {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Featured Image Asset</label>
                  <div className="flex gap-2">
                    <input
                      value={form.imageUrl}
                      onChange={set('imageUrl')}
                      placeholder="https://... or upload local file"
                      className="flex-1 bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm placeholder:text-gray-600 transition-colors font-mono"
                    />
                    <label className={`flex items-center gap-2 px-4 py-3 bg-gray-800 border border-gray-700 hover:border-brand-orange text-gray-200 hover:text-white rounded-lg transition-colors cursor-pointer text-xs font-mono font-bold uppercase tracking-wider ${imgUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      {imgUploading ? <Loader2 className="w-4 h-4 animate-spin text-brand-orange" /> : <Upload className="w-4 h-4 text-brand-orange" />}
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={imgUploading}
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file || !token) return;
                          const sizeErr = validateImageFile(file);
                          if (sizeErr) { setSaveError(sizeErr); e.target.value = ''; return; }
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
                        }}
                      />
                    </label>
                  </div>

                  {form.imageUrl && (
                    <div className="relative mt-3 h-36 w-full rounded-lg border border-gray-800 overflow-hidden bg-brand-darker">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                      </div>
                      <img
                        src={form.imageUrl}
                        alt={form.title || 'Preview'}
                        className="w-full h-full object-cover opacity-0 transition-opacity duration-300 relative z-10"
                        onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, imageUrl: '' }))}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-md transition-colors z-20 cursor-pointer"
                        title="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Estimated Duration</label>
                  <input
                    value={form.duration}
                    onChange={set('duration')}
                    placeholder="e.g. 4–6 Hours"
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange font-mono text-sm placeholder:text-gray-600 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Starting Price (₱)</label>
                  <input
                    value={form.startingPrice}
                    onChange={set('startingPrice')}
                    placeholder="e.g. ₱13,750"
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange font-mono text-sm placeholder:text-gray-600 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Sort Priority Order</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange font-mono text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 flex items-center justify-between">
                  <span>Key Features &amp; Included Specs</span>
                  <span className="text-[10px] font-mono text-gray-500">One feature per line</span>
                </label>
                <textarea
                  rows={5}
                  value={form.features}
                  onChange={set('features')}
                  placeholder={"Bi-LED Projector Conversions\nRGBW Demon Eyes\nLaser High Beam Optics"}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange font-mono text-sm resize-y placeholder:text-gray-700 transition-colors"
                />
              </div>

              <div className="pt-4 border-t border-gray-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-white">Catalog Visibility Status</p>
                  <p className="text-[11px] text-gray-500">Controls whether clients can view and inquire about this service on the website.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="ml-3 text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
                    {form.isActive ? 'Active (Visible)' : 'Hidden (Draft)'}
                  </span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-brand-dark/80 border-t border-gray-800/80 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancel}
                className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-brand-orange text-white px-7 py-2.5 text-xs font-mono font-bold uppercase tracking-widest hover:bg-orange-600 transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{editId ? 'Save Changes' : 'Create Service'}</span>
              </button>
            </div>
          </div>
        </form>

        {editId !== null && token && (
          <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                <Layers className="w-4 h-4" /> Package Variations &amp; Upgrades
              </h3>
              <span className="text-[10px] font-mono text-gray-500">Tiered pricing &amp; build configurations</span>
            </div>
            <div className="p-6">
              <VariationsManager
                variations={variations}
                parentId={editId}
                parentType="service"
                token={token}
                onSaved={v => setVariations(v as ServiceVariation[])}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-brand-orange/10 border border-brand-orange/20 rounded-lg">
              <Wrench className="w-5 h-5 text-brand-orange" />
            </div>
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
              Service Catalog
            </h2>
          </div>
          <p className="text-xs text-gray-400 font-mono">
            Manage automotive service offerings, package variations, and job checklist templates.
          </p>
        </div>

        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Service</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Total Services</p>
            <p className="text-2xl font-mono font-bold text-white mt-1">{services.length}</p>
          </div>
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Active Listed</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">{activeCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Hidden Drafts</p>
            <p className="text-2xl font-mono font-bold text-amber-400 mt-1">{hiddenCount}</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <EyeOff className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">With Packages</p>
            <p className="text-2xl font-mono font-bold text-sky-400 mt-1">{variationsCount}</p>
          </div>
          <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search services by title, slug or spec..."
            className="w-full bg-brand-darker border border-gray-800 text-white pl-10 pr-4 py-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange placeholder:text-gray-600 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex bg-brand-darker p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-brand-orange text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              All ({services.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-colors ${
                statusFilter === 'active' ? 'bg-brand-orange text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('hidden')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-colors ${
                statusFilter === 'hidden' ? 'bg-brand-orange text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Hidden ({hiddenCount})
            </button>
          </div>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16 bg-[#121212] border border-gray-800/80 rounded-xl shadow-xl">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
            <p className="text-xs font-mono uppercase tracking-wider text-gray-400">Loading service catalog...</p>
          </div>
        </div>
      )}

      {filteredServices.length === 0 && status !== 'loading' && (
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-12 text-center shadow-xl space-y-4">
          <div className="w-16 h-16 bg-gray-800/50 border border-gray-700/50 rounded-2xl flex items-center justify-center mx-auto text-gray-500">
            <Wrench className="w-8 h-8 opacity-60" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">No services found</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'No service packages match your current search or filter criteria.'
                : 'Your catalog is empty. Click New Service above to add your first offering.'}
            </p>
          </div>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              className="text-xs font-mono uppercase tracking-wider text-brand-orange hover:underline cursor-pointer"
            >
              Clear Search Filters
            </button>
          )}
        </div>
      )}

      {filteredServices.length > 0 && (
        <div className="space-y-4">
          {filteredServices.map(svc => {
            const hasVariations = (svc.variations?.length ?? 0) > 0;
            return (
              <div
                key={svc.id}
                className="bg-[#121212] border border-gray-800/80 hover:border-brand-orange/40 rounded-xl p-5 sm:p-6 transition-all duration-200 shadow-xl flex flex-col md:flex-row items-start justify-between gap-6 group"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-brand-darker rounded-lg border border-gray-800 shrink-0 overflow-hidden relative group-hover:border-gray-700 transition-colors">
                    {svc.imageUrl ? (
                      <img
                        src={svc.imageUrl}
                        alt={svc.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-1">
                        <Wrench className="w-6 h-6" />
                        <span className="text-[9px] font-mono text-gray-600 uppercase">No Image</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-white font-bold text-lg group-hover:text-brand-orange transition-colors truncate">
                        {svc.title}
                      </h3>
                      {svc.isActive ? (
                        <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1 shrink-0">
                          <EyeOff className="w-3 h-3" /> Hidden
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-[10px] font-mono text-gray-500 bg-brand-darker border border-gray-800 rounded">
                        /{svc.slug}
                      </span>
                    </div>

                    <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed font-sans">
                      {svc.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {svc.startingPrice && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/30">
                          <Tag className="w-3 h-3" /> {formatPrice(svc.startingPrice)}
                        </span>
                      )}

                      {svc.duration && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-gray-300 bg-brand-darker border border-gray-800">
                          <Clock className="w-3 h-3 text-gray-400" /> {svc.duration}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-gray-400 bg-brand-darker border border-gray-800">
                        <CheckCircle2 className="w-3 h-3 text-gray-500" /> {svc.features.length} Features
                      </span>

                      {hasVariations && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/30">
                          <Layers className="w-3 h-3" /> {svc.variations!.length} Packages
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-start w-full md:w-auto justify-end border-t md:border-t-0 border-gray-800/80 pt-3 md:pt-0">
                  <button
                    onClick={() => openEdit(svc)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-800/70 hover:bg-brand-orange border border-gray-700 hover:border-brand-orange text-gray-200 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Package
                  </button>

                  {deleteConf === svc.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(svc.id)}
                        className="px-3 py-2 bg-red-600 text-white text-xs font-mono font-bold uppercase rounded-lg hover:bg-red-700 transition-colors shadow-md cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setDeleteConf(null)}
                        className="px-3 py-2 border border-gray-700 text-gray-400 hover:text-white text-xs font-mono uppercase rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConf(svc.id)}
                      className="p-2 border border-gray-800 hover:border-red-500/40 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
