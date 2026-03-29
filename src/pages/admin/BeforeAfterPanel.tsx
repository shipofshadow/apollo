import { useEffect, useState } from 'react';
import { AlertCircle, Camera, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import {
  createBeforeAfterItemApi,
  deleteBeforeAfterItemApi,
  fetchBeforeAfterItemsApi,
  updateBeforeAfterItemApi,
  uploadAdminImageApi,
} from '../../services/api';
import type { BeforeAfterItem } from '../../types';
import { useAuth } from '../../context/AuthContext';

type BeforeAfterForm = {
  title: string;
  description: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  sortOrder: number;
  isActive: boolean;
};

const EMPTY_FORM: BeforeAfterForm = {
  title: '',
  description: '',
  beforeImageUrl: '',
  afterImageUrl: '',
  sortOrder: 0,
  isActive: true,
};

function itemToForm(item: BeforeAfterItem): BeforeAfterForm {
  return {
    title: item.title,
    description: item.description,
    beforeImageUrl: item.beforeImageUrl,
    afterImageUrl: item.afterImageUrl,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
}

export default function BeforeAfterPanel() {
  const { token } = useAuth();

  const [items, setItems] = useState<BeforeAfterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BeforeAfterForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<'before' | 'after' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConf, setDeleteConf] = useState<number | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { items: data } = await fetchBeforeAfterItemsApi(token);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadItems();
  }, [token]);

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setEditing(true);
  };

  const openEdit = (item: BeforeAfterItem) => {
    setEditId(item.id);
    setForm(itemToForm(item));
    setSaveError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setSaveError(null);
  };

  const handleImageUpload = async (field: 'before' | 'after', file: File) => {
    if (!token) return;

    setUploadingField(field);
    try {
      const url = await uploadAdminImageApi(token, file, 'before-after');
      if (field === 'before') {
        setForm(prev => ({ ...prev, beforeImageUrl: url }));
      } else {
        setForm(prev => ({ ...prev, afterImageUrl: url }));
      }
    } catch (err: unknown) {
      setSaveError((err as Error).message ?? 'Failed to upload image.');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    setSaveError(null);

    const payload = {
      title: form.title,
      description: form.description,
      beforeImageUrl: form.beforeImageUrl,
      afterImageUrl: form.afterImageUrl,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };

    try {
      if (editId !== null) {
        await updateBeforeAfterItemApi(token, editId, payload);
      } else {
        await createBeforeAfterItemApi(token, payload);
      }
      await loadItems();
      setEditing(false);
    } catch (err: unknown) {
      setSaveError((err as Error).message ?? 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await deleteBeforeAfterItemApi(token, id);
    await loadItems();
    setDeleteConf(null);
  };

  const inputCls = 'w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm';

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {editId ? 'Edit Before/After Item' : 'New Before/After Item'}
          </h2>
          <button onClick={cancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-5">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Title *</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Worn Lens to Crystal Clear Output"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(prev => ({ ...prev, sortOrder: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Description *</label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className={`${inputCls} resize-none`}
              placeholder="Describe the transformation shown in this pair."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Before Image URL *</label>
              <input
                required
                value={form.beforeImageUrl}
                onChange={e => setForm(prev => ({ ...prev, beforeImageUrl: e.target.value }))}
                className={inputCls}
                placeholder="https://..."
              />
              <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-orange hover:text-orange-400 cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                {uploadingField === 'before' ? 'Uploading…' : 'Upload Before'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageUpload('before', file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              {form.beforeImageUrl && (
                <img src={form.beforeImageUrl} alt="Before preview" className="h-24 w-full object-cover border border-gray-800 rounded-sm" referrerPolicy="no-referrer" />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">After Image URL *</label>
              <input
                required
                value={form.afterImageUrl}
                onChange={e => setForm(prev => ({ ...prev, afterImageUrl: e.target.value }))}
                className={inputCls}
                placeholder="https://..."
              />
              <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-orange hover:text-orange-400 cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                {uploadingField === 'after' ? 'Uploading…' : 'Upload After'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageUpload('after', file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              {form.afterImageUrl && (
                <img src={form.afterImageUrl} alt="After preview" className="h-24 w-full object-cover border border-gray-800 rounded-sm" referrerPolicy="no-referrer" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Status</label>
            <select
              value={form.isActive ? 'active' : 'inactive'}
              onChange={e => setForm(prev => ({ ...prev, isActive: e.target.value === 'active' }))}
              className={`${inputCls} appearance-none`}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? 'Save Changes' : 'Create Item'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm"
            >
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
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Before/After</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
        >
          <Plus className="w-4 h-4" /> New Item
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {!loading && items.length === 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500 text-sm">
          No before/after items yet.
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[860px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Title', 'Before', 'After', 'Sort', 'Status', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                  <td className="p-4 max-w-xs">
                    <p className="text-white font-bold truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                  </td>
                  <td className="p-4">
                    <img src={item.beforeImageUrl} alt={`${item.title} before`} className="h-16 w-24 object-cover rounded-sm border border-gray-800" referrerPolicy="no-referrer" />
                  </td>
                  <td className="p-4">
                    <img src={item.afterImageUrl} alt={`${item.title} after`} className="h-16 w-24 object-cover rounded-sm border border-gray-800" referrerPolicy="no-referrer" />
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{item.sortOrder}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm ${
                      item.isActive
                        ? 'bg-green-500/15 text-green-400 border border-green-500/40'
                        : 'bg-gray-700/40 text-gray-400 border border-gray-600'
                    }`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                    {deleteConf === item.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void handleDelete(item.id)}
                          className="px-2 py-1 bg-red-500/20 border border-red-500/40 text-red-400 rounded-sm text-xs font-bold uppercase tracking-widest"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConf(null)}
                          className="px-2 py-1 border border-gray-700 text-gray-400 rounded-sm text-xs font-bold uppercase tracking-widest"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 text-gray-400 hover:text-brand-orange transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConf(item.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
