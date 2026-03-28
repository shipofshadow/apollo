import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ImageIcon, Loader2, AlertCircle, Plus, Pencil, Trash2, Save, X, Upload, Eye, Tag, Grid3X3, ChevronDown,
} from 'lucide-react';
import {
  fetchPortfolioAsync,
  createPortfolioItemAsync,
  updatePortfolioItemAsync,
  deletePortfolioItemAsync,
} from '../../store/portfolioSlice';
import {
  fetchPortfolioCategoriesAsync,
  createPortfolioCategoryAsync,
  updatePortfolioCategoryAsync,
  deletePortfolioCategoryAsync,
} from '../../store/portfolioCategoriesSlice';
import { uploadAdminImageApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { PortfolioItem, PortfolioCategory } from '../../types';
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
  images: string[];
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: PortfolioForm = {
  title: '', category: '', description: '', imageUrl: '', images: [], sortOrder: 0, isActive: true,
};

function itemToForm(p: PortfolioItem): PortfolioForm {
  return {
    title:       p.title,
    category:    p.category,
    description: p.description,
    imageUrl:    p.imageUrl,
    images:      Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : []),
    sortOrder:   p.sortOrder,
    isActive:    p.isActive,
  };
}

function formToPayload(f: PortfolioForm): Partial<Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>> {
  const images = f.images.filter(Boolean);
  return {
    title:       f.title.trim(),
    category:    f.category.trim(),
    description: f.description.trim(),
    imageUrl:    images[0] ?? f.imageUrl.trim(),
    images,
    sortOrder:   f.sortOrder,
    isActive:    f.isActive,
  };
}

type ActiveTab = 'items' | 'categories';

// ── Category form ─────────────────────────────────────────────────────────────

interface CategoryFormState {
  id: number | null;
  name: string;
  sortOrder: number;
}

const EMPTY_CAT: CategoryFormState = { id: null, name: '', sortOrder: 0 };

export default function PortfolioPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { items, status }               = useSelector((s: RootState) => s.portfolio);
  const { categories, status: catStatus } = useSelector((s: RootState) => s.portfolioCategories);

  const [activeTab, setActiveTab] = useState<ActiveTab>('items');

  // ── Item state ──────────────────────────────────────────────────────────────
  const [editing,       setEditing]       = useState(false);
  const [editId,        setEditId]        = useState<number | null>(null);
  const [form,          setForm]          = useState<PortfolioForm>(EMPTY_FORM);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [deleteConf,    setDeleteConf]    = useState<number | null>(null);
  const [imgUploading,  setImgUploading]  = useState(false);
  const [uploadingIdx,  setUploadingIdx]  = useState<number | null>(null);
  const [preview,       setPreview]       = useState<PortfolioItem | null>(null);
  const [previewImgIdx, setPreviewImgIdx] = useState(0);
  const multiFileRef = useRef<HTMLInputElement>(null);

  // ── Category state ──────────────────────────────────────────────────────────
  const [catEditing,   setCatEditing]   = useState(false);
  const [catForm,      setCatForm]      = useState<CategoryFormState>(EMPTY_CAT);
  const [catSaving,    setCatSaving]    = useState(false);
  const [catSaveError, setCatSaveError] = useState<string | null>(null);
  const [catDeleteConf, setCatDeleteConf] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      dispatch(fetchPortfolioAsync(token));
      dispatch(fetchPortfolioCategoriesAsync(token));
    }
  }, [token, dispatch]);

  // ── Item helpers ─────────────────────────────────────────────────────────────
  const openNew  = () => { setForm(EMPTY_FORM); setEditId(null); setSaveError(null); setEditing(true); };
  const openEdit = (p: PortfolioItem) => { setForm(itemToForm(p)); setEditId(p.id); setSaveError(null); setEditing(true); };
  const cancel   = () => { setEditing(false); setEditId(null); setSaveError(null); };

  const set = (field: keyof PortfolioForm) =>
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

  // Upload a single image and append to images array
  const handleUploadImage = async (file: File, replaceIdx?: number) => {
    if (!token) return;
    const sizeErr = validateImageFile(file);
    if (sizeErr) { setSaveError(sizeErr); return; }
    setImgUploading(true);
    if (replaceIdx !== undefined) setUploadingIdx(replaceIdx);
    try {
      const url = await uploadAdminImageApi(token, file, 'portfolio');
      setForm(p => {
        const imgs = [...p.images];
        if (replaceIdx !== undefined) {
          imgs[replaceIdx] = url;
        } else {
          imgs.push(url);
        }
        return { ...p, images: imgs, imageUrl: imgs[0] ?? url };
      });
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Image upload failed.');
    } finally {
      setImgUploading(false);
      setUploadingIdx(null);
    }
  };

  const handleMultiUpload = async (files: FileList) => {
    if (!token) return;
    const fileArr = Array.from(files);
    const errors: string[] = [];
    const validFiles: File[] = [];

    for (const file of fileArr) {
      const sizeErr = validateImageFile(file);
      if (sizeErr) { errors.push(sizeErr); } else { validFiles.push(file); }
    }
    if (errors.length > 0) { setSaveError(errors[0]); }
    if (validFiles.length === 0) return;

    setImgUploading(true);
    try {
      const urls = await Promise.all(
        validFiles.map(f => uploadAdminImageApi(token, f, 'portfolio'))
      );
      setForm(p => {
        const imgs = [...p.images, ...urls];
        return { ...p, images: imgs, imageUrl: imgs[0] ?? p.imageUrl };
      });
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Image upload failed.');
    } finally {
      setImgUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setForm(p => {
      const imgs = p.images.filter((_, i) => i !== idx);
      return { ...p, images: imgs, imageUrl: imgs[0] ?? '' };
    });
  };

  // ── Category helpers ─────────────────────────────────────────────────────────
  const openCatNew  = () => { setCatForm(EMPTY_CAT); setCatSaveError(null); setCatEditing(true); };
  const openCatEdit = (c: PortfolioCategory) => { setCatForm({ id: c.id, name: c.name, sortOrder: c.sortOrder }); setCatSaveError(null); setCatEditing(true); };
  const cancelCat   = () => { setCatEditing(false); setCatSaveError(null); };

  const handleCatSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCatSaving(true);
    setCatSaveError(null);
    try {
      if (catForm.id !== null) {
        await dispatch(updatePortfolioCategoryAsync({ token, id: catForm.id, data: { name: catForm.name, sortOrder: catForm.sortOrder } })).unwrap();
      } else {
        await dispatch(createPortfolioCategoryAsync({ token, data: { name: catForm.name, sortOrder: catForm.sortOrder } })).unwrap();
      }
      setCatEditing(false);
    } catch (err: unknown) {
      setCatSaveError((err as Error)?.message ?? 'Failed to save category.');
    } finally {
      setCatSaving(false);
    }
  };

  const handleCatDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deletePortfolioCategoryAsync({ token, id }));
    setCatDeleteConf(null);
  };

  // ── Render: Item form ────────────────────────────────────────────────────────
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

            {/* Category dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Category</label>
              <div className="relative">
                <select value={form.category} onChange={set('category')}
                  className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 pr-10 focus:outline-none focus:border-brand-orange rounded-sm appearance-none">
                  <option value="">— Select a category —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              </div>
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

            {/* Images gallery */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Images {form.images.length > 0 && <span className="text-gray-600 normal-case font-normal tracking-normal">({form.images.length})</span>}
                </label>
                <label className={`flex items-center gap-2 px-3 py-1.5 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange transition-colors rounded-sm cursor-pointer text-xs font-bold uppercase tracking-widest ${imgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {imgUploading && uploadingIdx === null ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Add Images
                  <input
                    ref={multiFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={imgUploading}
                    onChange={async e => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      await handleMultiUpload(files);
                      if (multiFileRef.current) multiFileRef.current.value = '';
                    }}
                  />
                </label>
              </div>

              {form.images.length === 0 && (
                <div className="border border-dashed border-gray-700 rounded-sm p-6 text-center text-gray-600 text-sm">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No images yet. Click <strong className="text-gray-400">Add Images</strong> to upload one or more.
                </div>
              )}

              {form.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {form.images.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-sm overflow-hidden border border-gray-700 bg-brand-gray">
                      {uploadingIdx === idx ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
                        </div>
                      ) : (
                        <>
                          <img src={url} alt={`Image ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          {/* Thumbnail badge */}
                          {idx === 0 && (
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-brand-orange text-white text-[10px] font-bold uppercase rounded-sm">
                              Cover
                            </span>
                          )}
                          {/* Overlay actions */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            {/* Replace */}
                            <label className="p-1.5 bg-brand-darker hover:bg-brand-orange text-white rounded-sm cursor-pointer transition-colors" title="Replace">
                              <Upload className="w-3 h-3" />
                              <input type="file" accept="image/*" className="hidden"
                                onChange={async e => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  await handleUploadImage(file, idx);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {/* Remove */}
                            <button type="button" onClick={() => removeImage(idx)}
                              className="p-1.5 bg-brand-darker hover:bg-red-500/80 text-white rounded-sm transition-colors" title="Remove">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
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

  // ── Render: Category form ─────────────────────────────────────────────────
  if (catEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {catForm.id ? 'Edit Category' : 'New Category'}
          </h2>
          <button onClick={cancelCat} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCatSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-6 max-w-md">
          {catSaveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {catSaveError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Category Name *</label>
            <input required value={catForm.name}
              onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
              placeholder="e.g. Quad Projector Retrofit" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
            <input type="number" min={0} value={catForm.sortOrder}
              onChange={e => setCatForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit" disabled={catSaving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {catSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {catForm.id ? 'Save Changes' : 'Create Category'}
            </button>
            <button type="button" onClick={cancelCat}
              className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Render: List ─────────────────────────────────────────────────────────────
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
            {preview.images && preview.images.length > 0 ? (
              <div className="relative aspect-[4/3] overflow-hidden bg-brand-gray">
                <img src={preview.images[previewImgIdx]} alt={preview.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer" />
                {preview.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewImgIdx(i => (i - 1 + preview.images.length) % preview.images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-brand-orange rounded-sm flex items-center justify-center transition-colors text-white">
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewImgIdx(i => (i + 1) % preview.images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-brand-orange rounded-sm flex items-center justify-center transition-colors text-white">
                      ›
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {preview.images.map((_, i) => (
                        <button key={i} type="button" onClick={() => setPreviewImgIdx(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === previewImgIdx ? 'bg-brand-orange' : 'bg-white/40 hover:bg-white/70'}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : preview.imageUrl ? (
              <div className="aspect-[4/3] overflow-hidden bg-brand-gray">
                <img src={preview.imageUrl} alt={preview.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer" />
              </div>
            ) : null}
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

      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-brand-darker border border-gray-800 rounded-sm p-1">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-sm transition-colors ${
              activeTab === 'items' ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <Grid3X3 className="w-4 h-4" /> Portfolio Items
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-sm transition-colors ${
              activeTab === 'categories' ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <Tag className="w-4 h-4" /> Categories
          </button>
        </div>
        {activeTab === 'items' ? (
          <button onClick={openNew}
            className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
            <Plus className="w-4 h-4" /> New Item
          </button>
        ) : (
          <button onClick={openCatNew}
            className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
            <Plus className="w-4 h-4" /> New Category
          </button>
        )}
      </div>

      {/* ── Items tab ── */}
      {activeTab === 'items' && (
        <>
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
              {items.map(item => {
                const coverImg = (item.images && item.images.length > 0) ? item.images[0] : item.imageUrl;
                const imgCount = item.images?.length ?? (item.imageUrl ? 1 : 0);
                return (
                  <div key={item.id} className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden group relative">
                    {/* Image */}
                    <div className="relative aspect-[4/3] bg-brand-gray overflow-hidden">
                      {coverImg ? (
                        <img src={coverImg} alt={item.title}
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
                      {/* Multiple image badge */}
                      {imgCount > 1 && (
                        <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/70 text-white text-xs font-bold rounded-sm">
                          <ImageIcon className="w-3 h-3" /> {imgCount}
                        </span>
                      )}
                      {/* Preview button */}
                      <button
                        onClick={() => { setPreviewImgIdx(0); setPreview(item); }}
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
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Categories tab ── */}
      {activeTab === 'categories' && (
        <>
          {catStatus === 'loading' && (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
          )}

          {categories.length === 0 && catStatus !== 'loading' && (
            <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
              <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No categories yet. Click <strong>New Category</strong> to add one.</p>
            </div>
          )}

          {categories.length > 0 && (
            <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
              <table className="w-full text-left min-w-[400px]">
                <thead>
                  <tr className="border-b border-gray-800 bg-brand-darker/50">
                    {['Name', 'Sort Order', 'Actions'].map(h => (
                      <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr key={cat.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                      <td className="p-4 text-white font-bold">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-brand-orange inline-block" />
                          {cat.name}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 text-sm">{cat.sortOrder}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openCatEdit(cat)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          {catDeleteConf === cat.id ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleCatDelete(cat.id)}
                                className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                                Confirm
                              </button>
                              <button onClick={() => setCatDeleteConf(null)}
                                className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setCatDeleteConf(cat.id)}
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
        </>
      )}
    </div>
  );
}

