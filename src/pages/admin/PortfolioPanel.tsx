import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ImageIcon, Loader2, AlertCircle, Plus, Pencil, Trash2, Save, X, Upload, Eye,
} from 'lucide-react';
import {
  fetchPortfolioAsync,
  createPortfolioItemAsync,
  updatePortfolioItemAsync,
  deletePortfolioItemAsync,
} from '../../store/portfolioSlice';
import { uploadAdminImageApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { PortfolioItem } from '../../types';
import { useAuth } from '../../context/AuthContext';

const UPLOAD_MAX_MB = 10;
function validateImageFile(file: File): string | null {
  return file.size > UPLOAD_MAX_MB * 1024 * 1024
    ? `Image must be under ${UPLOAD_MAX_MB} MB.`
    : null;
}

interface PortfolioForm {
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: PortfolioForm = {
  title: '', category: '', description: '', imageUrl: '', sortOrder: 0, isActive: true,
};

function itemToForm(p: PortfolioItem): PortfolioForm {
  return {
    title:       p.title,
    category:    p.category,
    description: p.description,
    imageUrl:    p.imageUrl,
    sortOrder:   p.sortOrder,
    isActive:    p.isActive,
  };
}

function formToPayload(f: PortfolioForm): Partial<Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>> {
  return {
    title:       f.title.trim(),
    category:    f.category.trim(),
    description: f.description.trim(),
    imageUrl:    f.imageUrl.trim(),
    sortOrder:   f.sortOrder,
    isActive:    f.isActive,
  };
}

export default function PortfolioPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { items, status } = useSelector((s: RootState) => s.portfolio);

  const [editing,      setEditing]      = useState(false);
  const [editId,       setEditId]       = useState<number | null>(null);
  const [form,         setForm]         = useState<PortfolioForm>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [deleteConf,   setDeleteConf]   = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [preview,      setPreview]      = useState<PortfolioItem | null>(null);

  useEffect(() => {
    if (token) dispatch(fetchPortfolioAsync(token));
  }, [token, dispatch]);

  const openNew  = () => { setForm(EMPTY_FORM); setEditId(null); setSaveError(null); setEditing(true); };
  const openEdit = (p: PortfolioItem) => { setForm(itemToForm(p)); setEditId(p.id); setSaveError(null); setEditing(true); };
  const cancel   = () => { setEditing(false); setEditId(null); setSaveError(null); };

  const set = (field: keyof PortfolioForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const payload = formToPayload(form);
    try {
      if (editId !== null) {
        await dispatch(updatePortfolioItemAsync({ token, id: editId, data: payload })).unwrap();
      } else {
        await dispatch(createPortfolioItemAsync({ token, data: payload })).unwrap();
      }
      setEditing(false);
      setEditId(null);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save portfolio item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deletePortfolioItemAsync({ token, id }));
    setDeleteConf(null);
  };

  // ── Edit / Create form ──────────────────────────────────────────────────────
  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {editId ? 'Edit Portfolio Item' : 'New Portfolio Item'}
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
            {/* Title */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Title *</label>
              <input required value={form.title} onChange={set('title')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="e.g. Subaru WRX STI" />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Category</label>
              <input value={form.category} onChange={set('category')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="e.g. Quad Projector Retrofit" />
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
              <input type="number" min={0} value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>

            {/* Description */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Description</label>
              <textarea rows={3} value={form.description} onChange={set('description')}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-none"
                placeholder="Describe the build — what was done, parts used, etc." />
            </div>

            {/* Image */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Image</label>
              <div className="flex gap-2">
                <input value={form.imageUrl} onChange={set('imageUrl')}
                  className="flex-1 bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                  placeholder="https://… or upload" />
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
                      const url = await uploadAdminImageApi(token, file, 'portfolio');
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
                <div className="relative mt-2 h-48 w-full rounded-sm border border-gray-700 overflow-hidden bg-gray-800">
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

            {/* Active toggle */}
            <div className="flex items-center gap-3 pt-2">
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
              {editId ? 'Save Changes' : 'Create Item'}
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

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Preview lightbox */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-brand-dark border border-gray-700 rounded-sm max-w-2xl w-full overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {preview.imageUrl && (
              <div className="aspect-[4/3] overflow-hidden bg-brand-gray">
                <img src={preview.imageUrl} alt={preview.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer" />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <span className="text-brand-orange text-xs font-bold uppercase tracking-widest">{preview.category}</span>
                  <h3 className="text-xl font-display font-bold text-white uppercase mt-1">{preview.title}</h3>
                </div>
                <button onClick={() => setPreview(null)} className="text-gray-500 hover:text-white transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {preview.description && (
                <p className="text-gray-400 text-sm leading-relaxed">{preview.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Portfolio</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> New Item
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {items.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No portfolio items yet. Click <strong>New Item</strong> to add your first build.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden group relative">
              {/* Image */}
              <div className="relative aspect-[4/3] bg-brand-gray overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-gray-700" />
                  </div>
                )}
                {!item.isActive && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="px-3 py-1 bg-gray-800 border border-gray-600 text-gray-400 text-xs font-bold uppercase tracking-widest rounded-sm">
                      Hidden
                    </span>
                  </div>
                )}
                {/* Preview button */}
                <button
                  onClick={() => setPreview(item)}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-brand-orange rounded-sm flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                  title="Preview">
                  <Eye className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Info */}
              <div className="p-4">
                <span className="text-brand-orange text-xs font-bold uppercase tracking-widest block truncate">{item.category || '—'}</span>
                <h3 className="text-white font-bold text-sm mt-0.5 truncate">{item.title}</h3>
                {item.description && (
                  <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="px-4 pb-4 flex items-center gap-2">
                <button onClick={() => openEdit(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                {deleteConf === item.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleDelete(item.id)}
                      className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                      Confirm
                    </button>
                    <button onClick={() => setDeleteConf(null)}
                      className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConf(item.id)}
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
