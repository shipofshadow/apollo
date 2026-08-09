import { useState, useEffect } from 'react';
import { Plus, Save, X, Trash2, AlertCircle, Loader2, Pencil, ChevronUp, ChevronDown, CheckSquare, ShieldCheck, FileSignature, Sparkles } from 'lucide-react';
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
      hasNotes: phase === 'before',
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
    return (
      <div className="p-8 flex items-center justify-center font-mono text-xs text-gray-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
        <span>Loading service checklist templates…</span>
      </div>
    );
  }

  const renderPhaseGroup = (phase: ChecklistPhase, title: string, description: string, icon: React.ReactNode) => {
    const phaseItems = items[phase] || [];
    
    return (
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-xl mb-6">
        <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-orange/10 border border-brand-orange/20 rounded-lg text-brand-orange">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-white font-bold font-display uppercase tracking-wide text-sm">{title}</h4>
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-brand-orange/10 text-brand-orange border border-brand-orange/30 rounded-full font-bold">
                  {phaseItems.length} {phaseItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{description}</p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={() => handleAddNew(phase)}
            className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-all shadow-lg cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
        
        <div className="p-4 md:p-6">
          {phaseItems.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-gray-800 rounded-xl text-gray-500 font-mono text-xs">
              No checklist items configured for this phase yet. Click <strong className="text-brand-orange font-bold">Add Item</strong> above.
            </div>
          ) : (
            <div className="space-y-2">
              {phaseItems.map((item, index) => (
                <div key={item.id} className="bg-brand-darker/70 border border-gray-800/80 hover:border-brand-orange/40 p-4 flex items-center gap-4 rounded-xl transition-all shadow-lg group">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(phase, index, 'up')}
                      disabled={index === 0}
                      className="text-gray-500 hover:text-white disabled:opacity-20 p-1 rounded hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(phase, index, 'down')}
                      disabled={index === phaseItems.length - 1}
                      className="text-gray-500 hover:text-white disabled:opacity-20 p-1 rounded hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.section && (
                        <span className="text-[9px] font-mono font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {item.section}
                        </span>
                      )}
                      <span className="text-sm font-bold text-white">{item.label}</span>
                      {item.hasNotes && (
                        <span className="text-[9px] font-mono font-bold bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/30 uppercase tracking-wider">
                          Includes Notes
                        </span>
                      )}
                    </div>
                    {item.description && <div className="text-xs text-gray-400 font-mono truncate">{item.description}</div>}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="p-2 border border-gray-800 hover:border-brand-orange text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Edit Item"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-2 border border-gray-800 hover:border-red-500/40 text-gray-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {error && (
        <div className="bg-red-950/50 border border-red-500/40 text-red-400 px-5 py-4 rounded-xl text-sm flex items-center justify-between gap-3 shadow-xl font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden w-full max-w-lg shadow-2xl space-y-6 font-sans">
            <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> {editingItem.id ? 'Edit Checklist Item' : 'New Checklist Item'}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-gray-400 hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Item Label *</label>
                <input
                  type="text"
                  value={editingItem.label}
                  onChange={e => setEditingItem({ ...editingItem, label: e.target.value })}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm font-sans"
                  placeholder="e.g. Low Beam Projector Alignment"
                  autoFocus
                />
              </div>
              
              {editingItem.phase === 'after' && (
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Section Group Title</label>
                  <input
                    type="text"
                    value={editingItem.section || ''}
                    onChange={e => setEditingItem({ ...editingItem, section: e.target.value })}
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm font-sans"
                    placeholder="e.g. Function Check"
                  />
                  <p className="text-[11px] text-gray-500 font-mono">Groups related items in the After-Installation checklist view.</p>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={editingItem.description || ''}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm resize-none"
                  placeholder="Detailed inspection criteria..."
                />
              </div>
              
              <div className="p-4 bg-brand-darker border border-gray-800 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono font-bold uppercase text-white">Notes Field Requirement</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Appends a text area to record technician notes during inspection.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.hasNotes}
                    onChange={e => setEditingItem({ ...editingItem, hasNotes: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-brand-dark/80 border-t border-gray-800/80 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingItem(null)}
                className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editingItem.label}
                className="flex items-center gap-2 bg-brand-orange text-white px-7 py-2.5 text-xs font-mono font-bold uppercase tracking-widest hover:bg-orange-600 transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        {renderPhaseGroup('before', 'Before Installation', 'Items to inspect when the vehicle arrives. Unlocks when booking status is In Progress.', <CheckSquare className="w-5 h-5" />)}
        {renderPhaseGroup('after', 'After Installation', 'Items to verify before vehicle release. Unlocks when booking status is Completed.', <ShieldCheck className="w-5 h-5" />)}
        {renderPhaseGroup('acknowledgement', 'Customer Acknowledgement', 'Text displayed at the bottom of the PDF report beside the signature block.', <FileSignature className="w-5 h-5" />)}
      </div>
    </div>
  );
}
