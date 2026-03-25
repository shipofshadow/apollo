import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  HelpCircle, Loader2, AlertCircle, Plus, Pencil, Trash2, Save, X,
} from 'lucide-react';
import {
  fetchFaqsAsync, createFaqAsync, updateFaqAsync, deleteFaqAsync,
} from '../../store/faqSlice';
import type { FaqItem } from '../../types';
import type { AppDispatch, RootState } from '../../store';
import { useAuth } from '../../context/AuthContext';

type FaqForm = {
  id: number | null;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
};

const EMPTY_FORM: FaqForm = {
  id: null, question: '', answer: '', category: 'General', sortOrder: 0, isActive: true,
};

export default function FaqPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { items, status } = useSelector((s: RootState) => s.faq);

  const [editing,    setEditing]    = useState(false);
  const [current,    setCurrent]    = useState<FaqForm>(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [deleteConf, setDeleteConf] = useState<number | null>(null);

  useEffect(() => {
    if (token) dispatch(fetchFaqsAsync(token));
  }, [token, dispatch]);

  const openNew  = () => { setCurrent(EMPTY_FORM); setSaveError(null); setEditing(true); };
  const openEdit = (f: FaqItem) => {
    setCurrent({ id: f.id, question: f.question, answer: f.answer, category: f.category, sortOrder: f.sortOrder, isActive: f.isActive });
    setSaveError(null);
    setEditing(true);
  };
  const cancel = () => { setEditing(false); setSaveError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const data = {
      question:  current.question,
      answer:    current.answer,
      category:  current.category,
      sortOrder: current.sortOrder,
      isActive:  current.isActive,
    };
    try {
      if (current.id !== null) {
        await dispatch(updateFaqAsync({ token, id: current.id, data })).unwrap();
      } else {
        await dispatch(createFaqAsync({ token, data })).unwrap();
      }
      setEditing(false);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save FAQ.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (faq: FaqItem) => {
    if (!token) return;
    await dispatch(updateFaqAsync({ token, id: faq.id, data: { isActive: !faq.isActive } }));
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deleteFaqAsync({ token, id }));
    setDeleteConf(null);
  };

  const inputCls = 'w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm';

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {current.id ? 'Edit FAQ' : 'New FAQ'}
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

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Question *</label>
            <input required value={current.question}
              onChange={e => setCurrent(p => ({ ...p, question: e.target.value }))}
              className={inputCls} placeholder="e.g. How long does a retrofit take?" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Answer *</label>
            <textarea required rows={5} value={current.answer}
              onChange={e => setCurrent(p => ({ ...p, answer: e.target.value }))}
              className={`${inputCls} resize-none`}
              placeholder="Provide a clear and helpful answer…" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Category</label>
              <input value={current.category}
                onChange={e => setCurrent(p => ({ ...p, category: e.target.value }))}
                className={inputCls} placeholder="e.g. General, Booking, Billing" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
              <input type="number" value={current.sortOrder}
                onChange={e => setCurrent(p => ({ ...p, sortOrder: Number(e.target.value) }))}
                className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Status</label>
              <select value={current.isActive ? 'active' : 'inactive'}
                onChange={e => setCurrent(p => ({ ...p, isActive: e.target.value === 'active' }))}
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
              {current.id ? 'Save Changes' : 'Create FAQ'}
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
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">FAQ</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> New FAQ
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {items.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Question', 'Category', 'Sort', 'Status', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(faq => (
                <tr key={faq.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                  <td className="p-4 text-white font-bold max-w-xs">
                    <p className="truncate">{faq.question}</p>
                    <p className="text-xs text-gray-500 font-normal mt-0.5 truncate">{faq.answer}</p>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{faq.category}</td>
                  <td className="p-4 text-gray-400 text-sm">{faq.sortOrder}</td>
                  <td className="p-4">
                    <button onClick={() => handleToggleActive(faq)}
                      className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                        faq.isActive
                          ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}>
                      {faq.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(faq)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      {deleteConf === faq.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleDelete(faq.id)}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                            Confirm
                          </button>
                          <button onClick={() => setDeleteConf(null)}
                            className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConf(faq.id)}
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

      {items.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No FAQs yet. Click <strong>New FAQ</strong> to create one.</p>
        </div>
      )}
    </div>
  );
}
