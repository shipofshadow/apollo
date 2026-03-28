import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Wrench, Loader2, AlertCircle, Plus, Pencil, Trash2, Save, X, Upload,
} from 'lucide-react';
import {
  fetchServicesAsync, createServiceAsync, updateServiceAsync, deleteServiceAsync,
} from '../../store/servicesSlice';
import { uploadAdminImageApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Service, ServiceVariation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import VariationsManager from '../../components/VariationsManager';

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

  const [editing,      setEditing]      = useState(false);
  const [editId,       setEditId]       = useState<number | null>(null);
  const [form,         setForm]         = useState<ServiceForm>(EMPTY_FORM);
  const [slugEdited,   setSlugEdited]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [deleteConf,   setDeleteConf]   = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [variations,   setVariations]   = useState<ServiceVariation[]>([]);

  useEffect(() => {
    if (token) dispatch(fetchServicesAsync(token));
  }, [token, dispatch]);

  const openNew  = () => { setForm(EMPTY_FORM); setEditId(null); setSlugEdited(false); setSaveError(null); setVariations([]); setEditing(true); };
  const openEdit = (s: Service) => { setForm(serviceToForm(s)); setEditId(s.id); setSlugEdited(false); setSaveError(null); setVariations(s.variations ?? []); setEditing(true); };
  const cancel   = () => { setEditing(false); setEditId(null); setSlugEdited(false); setSaveError(null); setVariations([]); };

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
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Slug * <span className="font-normal text-gray-600">(URL identifier, e.g. headlight-retrofits)</span>
              </label>
              <input required value={form.slug} onChange={set('slug')}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                title="Lowercase letters, digits and hyphens only (e.g. headlight-retrofits)"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm font-mono" />
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

          {/* Variations – only shown when editing an existing service */}
          {editId !== null && token && (
            <div className="pt-2 border-t border-gray-800">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-3">
                Package Variations
                <span className="ml-2 font-normal text-gray-600">(each with its own images &amp; specs)</span>
              </label>
              <VariationsManager
                variations={variations}
                parentId={editId}
                parentType="service"
                token={token}
                onSaved={v => setVariations(v as ServiceVariation[])}
              />
            </div>
          )}

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
