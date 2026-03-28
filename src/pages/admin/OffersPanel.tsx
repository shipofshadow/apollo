import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Tag, Loader2, AlertCircle, Plus, Pencil, Trash2, Save, X,
} from 'lucide-react';
import {
  fetchOffersAsync, createOfferAsync, updateOfferAsync, deleteOfferAsync,
} from '../../store/offersSlice';
import { fetchServicesAsync } from '../../store/servicesSlice';
import { fetchProductsAsync } from '../../store/productsSlice';
import type { Offer } from '../../types';
import type { AppDispatch, RootState } from '../../store';
import { useAuth } from '../../context/AuthContext';

type OfferForm = {
  title: string;
  subtitle: string;
  description: string;
  badgeText: string;
  ctaText: string;
  ctaUrl: string;
  linkedServiceId: number | null;
  linkedProductId: number | null;
  sortOrder: number;
  isActive: boolean;
};

const EMPTY_FORM: OfferForm = {
  title: '',
  subtitle: '',
  description: '',
  badgeText: 'Limited Time Offer',
  ctaText: 'Claim Your Offer',
  ctaUrl: '#contact',
  linkedServiceId: null,
  linkedProductId: null,
  sortOrder: 0,
  isActive: true,
};

function offerToForm(o: Offer): OfferForm {
  return {
    title:            o.title,
    subtitle:         o.subtitle,
    description:      o.description,
    badgeText:        o.badgeText,
    ctaText:          o.ctaText,
    ctaUrl:           o.ctaUrl,
    linkedServiceId:  o.linkedServiceId,
    linkedProductId:  o.linkedProductId,
    sortOrder:        o.sortOrder,
    isActive:         o.isActive,
  };
}

export default function OffersPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { items, status }      = useSelector((s: RootState) => s.offers);
  const { items: services }    = useSelector((s: RootState) => s.services);
  const { items: products }    = useSelector((s: RootState) => s.products);

  const [editing,    setEditing]    = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [form,       setForm]       = useState<OfferForm>(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [deleteConf, setDeleteConf] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      dispatch(fetchOffersAsync(token));
      dispatch(fetchServicesAsync(token));
      dispatch(fetchProductsAsync(token));
    }
  }, [token, dispatch]);

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setEditing(true);
  };

  const openEdit = (o: Offer) => {
    setEditId(o.id);
    setForm(offerToForm(o));
    setSaveError(null);
    setEditing(true);
  };

  const cancel = () => { setEditing(false); setSaveError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const data: Partial<Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>> = {
      title:            form.title,
      subtitle:         form.subtitle,
      description:      form.description,
      badgeText:        form.badgeText,
      ctaText:          form.ctaText,
      ctaUrl:           form.ctaUrl,
      linkedServiceId:  form.linkedServiceId,
      linkedProductId:  form.linkedProductId,
      sortOrder:        form.sortOrder,
      isActive:         form.isActive,
    };
    try {
      if (editId !== null) {
        await dispatch(updateOfferAsync({ token, id: editId, data })).unwrap();
      } else {
        await dispatch(createOfferAsync({ token, data })).unwrap();
      }
      setEditing(false);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save offer.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (o: Offer) => {
    if (!token) return;
    await dispatch(updateOfferAsync({ token, id: o.id, data: { isActive: !o.isActive } }));
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deleteOfferAsync({ token, id }));
    setDeleteConf(null);
  };

  const inputCls = 'w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm';

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {editId ? 'Edit Offer' : 'New Offer'}
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
              <input required value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className={inputCls} placeholder="e.g. Free Demon Eyes With Any Retrofit" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Subtitle</label>
              <input value={form.subtitle}
                onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))}
                className={inputCls} placeholder="e.g. This month only" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Description</label>
            <textarea rows={3} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className={`${inputCls} resize-none`}
              placeholder="Describe the offer details…" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Badge Text</label>
              <input value={form.badgeText}
                onChange={e => setForm(p => ({ ...p, badgeText: e.target.value }))}
                className={inputCls} placeholder="e.g. Limited Time Offer" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Button Text</label>
              <input value={form.ctaText}
                onChange={e => setForm(p => ({ ...p, ctaText: e.target.value }))}
                className={inputCls} placeholder="e.g. Claim Your Offer" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Button Link</label>
              <input value={form.ctaUrl}
                onChange={e => setForm(p => ({ ...p, ctaUrl: e.target.value }))}
                className={inputCls} placeholder="e.g. #contact or /services/retrofits" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Linked Service (optional)</label>
              <select
                value={form.linkedServiceId ?? ''}
                onChange={e => setForm(p => ({ ...p, linkedServiceId: e.target.value ? Number(e.target.value) : null, linkedProductId: null }))}
                className={`${inputCls} appearance-none`}>
                <option value="">— None —</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Linked Product (optional)</label>
              <select
                value={form.linkedProductId ?? ''}
                onChange={e => setForm(p => ({ ...p, linkedProductId: e.target.value ? Number(e.target.value) : null, linkedServiceId: null }))}
                className={`${inputCls} appearance-none`}>
                <option value="">— None —</option>
                {products.map(pr => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
              <input type="number" value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: Number(e.target.value) }))}
                className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Status</label>
              <select value={form.isActive ? 'active' : 'inactive'}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'active' }))}
                className={`${inputCls} appearance-none`}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? 'Save Changes' : 'Create Offer'}
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
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Offers</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> New Offer
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {items.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Title', 'Badge', 'CTA', 'Linked To', 'Sort', 'Status', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(offer => {
                const linkedService = offer.linkedServiceId
                  ? services.find(s => s.id === offer.linkedServiceId)
                  : null;
                const linkedProduct = offer.linkedProductId
                  ? products.find(p => p.id === offer.linkedProductId)
                  : null;

                return (
                  <tr key={offer.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                    <td className="p-4 text-white font-bold max-w-xs">
                      <p className="truncate">{offer.title}</p>
                      {offer.subtitle && (
                        <p className="text-xs text-gray-500 font-normal mt-0.5 truncate">{offer.subtitle}</p>
                      )}
                    </td>
                    <td className="p-4 text-gray-400 text-sm truncate max-w-[120px]">{offer.badgeText}</td>
                    <td className="p-4 text-gray-400 text-sm">
                      <span className="truncate block max-w-[120px]">{offer.ctaText}</span>
                    </td>
                    <td className="p-4 text-gray-400 text-sm">
                      {linkedService && (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-sm text-xs font-bold uppercase">
                          Service: {linkedService.title}
                        </span>
                      )}
                      {linkedProduct && (
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-sm text-xs font-bold uppercase">
                          Product: {linkedProduct.name}
                        </span>
                      )}
                      {!linkedService && !linkedProduct && (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-400 text-sm">{offer.sortOrder}</td>
                    <td className="p-4">
                      <button onClick={() => handleToggleActive(offer)}
                        className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                          offer.isActive
                            ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}>
                        {offer.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(offer)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        {deleteConf === offer.id ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleDelete(offer.id)}
                              className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                              Confirm
                            </button>
                            <button onClick={() => setDeleteConf(null)}
                              className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConf(offer.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-500 hover:border-red-500/50 hover:text-red-400 text-xs font-bold uppercase rounded-sm transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No offers yet. Click <strong>New Offer</strong> to create one.</p>
        </div>
      )}
    </div>
  );
}
