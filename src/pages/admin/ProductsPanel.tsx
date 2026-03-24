import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Package, DollarSign, Loader2, AlertCircle, Plus, Pencil, Trash2, Save, X, Upload,
} from 'lucide-react';
import {
  fetchProductsAsync, createProductAsync, updateProductAsync, deleteProductAsync,
} from '../../store/productsSlice';
import { uploadAdminImageApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Product } from '../../types';
import { useAuth } from '../../context/AuthContext';

const UPLOAD_MAX_MB = 10;
function validateImageFile(file: File): string | null {
  return file.size > UPLOAD_MAX_MB * 1024 * 1024
    ? `Image must be under ${UPLOAD_MAX_MB} MB.`
    : null;
}

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

export default function ProductsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { items: products, status } = useSelector((s: RootState) => s.products);

  const [editing,      setEditing]      = useState(false);
  const [editId,       setEditId]       = useState<number | null>(null);
  const [form,         setForm]         = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [deleteConf,   setDeleteConf]   = useState<number | null>(null);
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
                    if (sizeErr) { setSaveError(sizeErr); e.target.value = ''; return; }
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
