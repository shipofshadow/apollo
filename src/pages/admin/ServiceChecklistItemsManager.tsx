import { useState, useEffect } from 'react';
import { Plus, Save, X, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import {
  fetchServiceChecklistItemsApi,
  createServiceChecklistItemApi,
  updateServiceChecklistItemApi,
  deleteServiceChecklistItemApi,
  reorderServiceChecklistItemsApi,
} from '../../services/api';
import type { ServiceChecklistItem, ChecklistPhase } from '../../types';

interface ServiceChecklistItemsManagerProps {
  serviceId: number;
  token: string;
}

export default function ServiceChecklistItemsManager({ serviceId, token }: ServiceChecklistItemsManagerProps) {
  const [items, setItems] = useState<{
    before: ServiceChecklistItem[];
    after: ServiceChecklistItem[];
    acknowledgement: ServiceChecklistItem[];
  }>({ before: [], after: [], acknowledgement: [] });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const [editingItem, setEditingItem] = useState<Partial<ServiceChecklistItem> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadItems();
  }, [serviceId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await fetchServiceChecklistItemsApi(token, serviceId);
      setItems(data.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load checklist items');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = (phase: ChecklistPhase) => {
    setEditingItem({
      phase,
      label: '',
      description: '',
      section: '',
      hasNotes: phase === 'before', // default for before
      sortOrder: (items[phase]?.length || 0) * 10
    });
  };

  const handleEdit = (item: ServiceChecklistItem) => {
    setEditingItem(item);
  };

  const handleSave = async () => {
    if (!editingItem || !editingItem.label) return;
    try {
      setSaving(true);
      if (editingItem.id) {
        await updateServiceChecklistItemApi(token, serviceId, editingItem.id, editingItem);
      } else {
        await createServiceChecklistItemApi(token, serviceId, editingItem);
      }
      setEditingItem(null);
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this checklist item?')) return;
    try {
      setLoading(true);
      await deleteServiceChecklistItemApi(token, serviceId, id);
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
      setLoading(false);
    }
  };

  const handleMove = async (phase: ChecklistPhase, index: number, direction: 'up' | 'down') => {
    const list = [...items[phase]];
    if (direction === 'up' && index > 0) {
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
    } else if (direction === 'down' && index < list.length - 1) {
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
    } else {
      return;
    }
    
    setItems({ ...items, [phase]: list });
    try {
      await reorderServiceChecklistItemsApi(token, serviceId, list.map(i => i.id));
    } catch (err: any) {
      setError(err.message || 'Failed to reorder');
      await loadItems();
    }
  };

  if (loading && !items.before.length && !items.after.length) {
    return <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-orange" /></div>;
  }

  const renderPhaseGroup = (phase: ChecklistPhase, title: string, description: string) => {
    const phaseItems = items[phase] || [];
    
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="text-white font-bold uppercase tracking-widest">{title}</h4>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>
          <button 
            type="button" 
            onClick={() => handleAddNew(phase)}
            className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-sm transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Item
          </button>
        </div>
        
        {phaseItems.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-gray-800 text-gray-500 text-sm">
            No items in this checklist phase yet.
          </div>
        ) : (
          <div className="space-y-2">
            {phaseItems.map((item, index) => (
              <div key={item.id} className="bg-gray-900 border border-gray-800 p-3 flex items-center gap-3 rounded-sm group">
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => handleMove(phase, index, 'up')} disabled={index === 0}
                    className="text-gray-600 hover:text-white disabled:opacity-30 p-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button type="button" onClick={() => handleMove(phase, index, 'down')} disabled={index === phaseItems.length - 1}
                    className="text-gray-600 hover:text-white disabled:opacity-30 p-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.section && <span className="text-[10px] bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded uppercase tracking-wider">{item.section}</span>}
                    <span className="text-sm text-gray-200">{item.label}</span>
                    {item.hasNotes && <span className="text-[10px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800/50">Has Notes</span>}
                  </div>
                  {item.description && <div className="text-xs text-gray-500 mt-1 truncate">{item.description}</div>}
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                  <button type="button" onClick={() => handleEdit(item)} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-sm">
                    <Save className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => handleDelete(item.id)} className="p-2 bg-red-900/30 hover:bg-red-500/80 text-red-400 hover:text-white rounded-sm">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-brand-dark border border-gray-800 p-6 rounded-sm w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-4">
              {editingItem.id ? 'Edit Checklist Item' : 'New Checklist Item'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Label *</label>
                <input type="text" value={editingItem.label} onChange={e => setEditingItem({ ...editingItem, label: e.target.value })}
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 mt-1 focus:outline-none focus:border-brand-orange rounded-sm"
                  placeholder="e.g. Low Beam" autoFocus />
              </div>
              
              {editingItem.phase === 'after' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Section Group</label>
                  <input type="text" value={editingItem.section || ''} onChange={e => setEditingItem({ ...editingItem, section: e.target.value })}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 mt-1 focus:outline-none focus:border-brand-orange rounded-sm"
                    placeholder="e.g. Function Check" />
                  <p className="text-[10px] text-gray-500 mt-1">Groups items together in the After checklist.</p>
                </div>
              )}
              
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Description (optional)</label>
                <input type="text" value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 mt-1 focus:outline-none focus:border-brand-orange rounded-sm" />
              </div>
              
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 text-sm font-bold uppercase tracking-widest">
                  <input type="checkbox" checked={editingItem.hasNotes}
                    onChange={e => setEditingItem({ ...editingItem, hasNotes: e.target.checked })}
                    className="accent-brand-orange w-4 h-4" />
                  Include Notes Field
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-800">
              <button onClick={handleSave} disabled={saving || !editingItem.label}
                className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Item
              </button>
              <button onClick={() => setEditingItem(null)}
                className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-900/50 p-6 rounded-sm border border-gray-800/50">
        {renderPhaseGroup('before', 'Before Installation', 'Items to check when the vehicle arrives. Unlocks when status is In Progress.')}
        {renderPhaseGroup('after', 'After Installation', 'Items to verify before releasing the vehicle. Unlocks when status is Completed.')}
        {renderPhaseGroup('acknowledgement', 'Customer Acknowledgement', 'Text displayed at the bottom of the PDF next to the signature.')}
      </div>
    </div>
  );
}
