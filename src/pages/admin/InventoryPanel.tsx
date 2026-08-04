import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Boxes, Loader2, Plus, AlertTriangle, Wrench, ClipboardList, Search,
  Download, RefreshCw, PackageCheck, X, TrendingDown, TrendingUp,
  Package, Truck, ChevronRight, BarChart3, Archive, ArrowUpDown, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchInventoryItemsApi,
  createInventoryItemApi,
  adjustInventoryApi,
  fetchInventoryAlertsApi,
  fetchInventoryMovementsApi,
  fetchInventorySuppliersApi,
  createInventorySupplierApi,
  fetchPurchaseOrdersApi,
  createPurchaseOrderApi,
  updatePurchaseOrderStatusApi,
} from '../../services/api';
import type { InventoryItem, InventoryAlert, InventorySupplier, PurchaseOrder, InventoryMovement } from '../../types';
import { Breadcrumbs } from './_sharedComponents';

type AlertFilter = 'open' | 'resolved' | 'all';
type ActiveTab = 'stock' | 'alerts' | 'movements' | 'orders' | 'suppliers';

// ---------------------------------------------------------------------------
// Shared input/select styles
// ---------------------------------------------------------------------------
const inputCls = 'w-full bg-black/30 border border-gray-700 text-white placeholder-gray-600 px-3 py-2.5 rounded-sm text-sm focus:outline-none focus:border-brand-orange transition-colors';
const selectCls = `${inputCls} cursor-pointer appearance-none`;
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1';

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-brand-dark border border-gray-700/80 rounded-xl shadow-2xl shadow-black/60 animate-[slideUp_0.2s_ease]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({ icon, label, value, sub, tone = 'default' }: {
  icon: ReactNode; label: string; value: string; sub?: string; tone?: 'default' | 'warn' | 'success';
}) {
  const toneClass =
    tone === 'warn' ? 'border-red-800/50 bg-gradient-to-br from-red-950/30 to-brand-dark' :
    tone === 'success' ? 'border-green-800/50 bg-gradient-to-br from-green-950/20 to-brand-dark' :
    'border-gray-800 bg-gradient-to-br from-gray-900 to-brand-dark';
  const iconClass =
    tone === 'warn' ? 'text-red-400' :
    tone === 'success' ? 'text-green-400' :
    'text-brand-orange';

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${toneClass}`}>
      <div className={`w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center ${iconClass}`}>{icon}</div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-white font-display">{value}</p>
      {sub && <p className="text-[11px] text-gray-600">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------
function Tab({ active, onClick, children, badge }: { active: boolean; onClick: () => void; children: ReactNode; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm transition-all ${
        active ? 'bg-brand-orange text-white' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className={`min-w-[18px] h-[18px] text-[10px] rounded-full flex items-center justify-center px-1 font-bold ${active ? 'bg-white/20 text-white' : 'bg-red-500/80 text-white'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stock badge
// ---------------------------------------------------------------------------
function StockBadge({ qty, reorder }: { qty: number; reorder: number }) {
  if (qty === 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">Out of Stock</span>;
  if (qty <= reorder) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">Low Stock</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">In Stock</span>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function InventoryPanel() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('open');
  const [activeTab, setActiveTab] = useState<ActiveTab>('stock');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  // Modals
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);

  const [newItem, setNewItem] = useState({ sku: '', name: '', category: '', qtyOnHand: 0, reorderPoint: 0, unitCost: 0, supplierId: 0 });
  const [adjust, setAdjust] = useState({ itemId: 0, quantityDelta: 0, note: '' });
  const [newSupplier, setNewSupplier] = useState({ name: '', contactPerson: '', phone: '', email: '' });

  const loadAll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [itemsRes, alertsRes, suppliersRes, poRes, movementRes] = await Promise.all([
        fetchInventoryItemsApi(token, { search, lowStockOnly }),
        fetchInventoryAlertsApi(token, alertFilter, 150),
        fetchInventorySuppliersApi(token),
        fetchPurchaseOrdersApi(token, 80),
        fetchInventoryMovementsApi(token, 120),
      ]);
      setItems(itemsRes.items ?? []);
      setAlerts(alertsRes.alerts ?? []);
      setSuppliers(suppliersRes.suppliers ?? []);
      setPurchaseOrders(poRes.purchaseOrders ?? []);
      setMovements(movementRes.movements ?? []);
    } catch (e) {
      showToast((e as Error).message || 'Failed to load inventory.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => { void loadAll(); }, [token, search, lowStockOnly, alertFilter]);

  const lowStockCount = useMemo(() => items.filter(i => i.qtyOnHand <= i.reorderPoint).length, [items]);
  const totalValue = useMemo(() => items.reduce((sum, i) => sum + (i.qtyOnHand * (i.unitCost || 0)), 0), [items]);

  const exportCsv = (rows: Array<Record<string, string | number | null>>, fileName: string) => {
    if (rows.length === 0) { showToast('No rows to export.', 'error'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(row => headers.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName; link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateItem = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await createInventoryItemApi(token, { ...newItem, qtyOnHand: Number(newItem.qtyOnHand), reorderPoint: Number(newItem.reorderPoint), unitCost: Number(newItem.unitCost), supplierId: newItem.supplierId > 0 ? newItem.supplierId : null });
      showToast('Inventory item created.', 'success');
      setNewItem({ sku: '', name: '', category: '', qtyOnHand: 0, reorderPoint: 0, unitCost: 0, supplierId: 0 });
      setShowAddItem(false);
      await loadAll();
    } catch (e) {
      showToast((e as Error).message || 'Failed to create item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async () => {
    if (!token) return;
    if (!adjust.itemId || !adjust.quantityDelta) { showToast('Select an item and set non-zero quantity delta.', 'error'); return; }
    setSaving(true);
    try {
      await adjustInventoryApi(token, adjust);
      showToast('Stock adjusted.', 'success');
      setAdjust({ itemId: 0, quantityDelta: 0, note: '' });
      setAdjustTarget(null);
      setShowAdjust(false);
      await loadAll();
    } catch (e) {
      showToast((e as Error).message || 'Failed to adjust stock.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (item: InventoryItem) => {
    setAdjustTarget(item);
    setAdjust({ itemId: item.id, quantityDelta: 0, note: '' });
    setShowAdjust(true);
  };

  const handleCreateSupplier = async () => {
    if (!token) return;
    if (!newSupplier.name.trim()) { showToast('Supplier name is required.', 'error'); return; }
    setSaving(true);
    try {
      await createInventorySupplierApi(token, newSupplier);
      showToast('Supplier added.', 'success');
      setNewSupplier({ name: '', contactPerson: '', phone: '', email: '' });
      setShowAddSupplier(false);
      await loadAll();
    } catch (e) {
      showToast((e as Error).message || 'Failed to create supplier.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuickPO = async () => {
    if (!token) return;
    const low = items.filter(i => i.qtyOnHand <= i.reorderPoint).slice(0, 10);
    if (low.length === 0) { showToast('No low-stock items to reorder.', 'error'); return; }
    setSaving(true);
    try {
      await createPurchaseOrderApi(token, { supplierId: low[0].supplierId ?? null, notes: 'Auto-generated from low-stock items', items: low.map(i => ({ itemId: i.id, quantity: Math.max(i.reorderPoint - i.qtyOnHand, 1), unitCost: i.unitCost || 0 })) });
      showToast('Purchase order created from low-stock items.', 'success');
      await loadAll();
    } catch (e) {
      showToast((e as Error).message || 'Failed to create purchase order.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReceived = async (poId: number) => {
    if (!token) return;
    setSaving(true);
    try {
      await updatePurchaseOrderStatusApi(token, poId, 'received');
      showToast('Purchase order marked as received.', 'success');
      await loadAll();
    } catch (e) {
      showToast((e as Error).message || 'Failed to update purchase order.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Inventory & Parts' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange mb-1">Stock Management</p>
          <h2 className="text-3xl font-display font-bold uppercase tracking-wide text-white">Parts & Inventory</h2>
          <p className="text-sm text-gray-400 mt-1">Track parts, adjust stock, and manage suppliers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-bold uppercase tracking-wide transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddSupplier(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange text-xs font-bold uppercase tracking-wide transition-all"
          >
            <Truck className="w-3.5 h-3.5" /> Add Supplier
          </button>
          <button
            onClick={() => { setShowAdjust(true); setAdjustTarget(null); setAdjust({ itemId: 0, quantityDelta: 0, note: '' }); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange text-xs font-bold uppercase tracking-wide transition-all"
          >
            <ArrowUpDown className="w-3.5 h-3.5" /> Adjust Stock
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wide transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> New Item
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Boxes className="w-4 h-4" />} label="Total Items" value={String(items.length)} sub={`₱${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} total value`} />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Low / Out of Stock" value={String(lowStockCount)} tone={lowStockCount > 0 ? 'warn' : 'success'} />
        <StatCard icon={<ClipboardList className="w-4 h-4" />} label="Active Alerts" value={String(alerts.filter(a => a.status !== 'resolved').length)} tone={alerts.filter(a => a.status !== 'resolved').length > 0 ? 'warn' : 'default'} />
        <StatCard icon={<PackageCheck className="w-4 h-4" />} label="Purchase Orders" value={String(purchaseOrders.length)} sub={`${purchaseOrders.filter(po => po.status === 'ordered').length} ordered`} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            placeholder="Search by SKU, name, category…"
            className="w-full bg-brand-dark border border-gray-800 pl-9 pr-3 py-2.5 rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-orange transition-colors"
          />
        </div>
        <button
          onClick={() => setLowStockOnly(v => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-sm border text-xs font-bold uppercase tracking-wide transition-all ${lowStockOnly ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          {lowStockOnly ? 'Showing Low Stock' : 'Show Low Stock'}
        </button>
        <div className="flex gap-2">
          <button onClick={() => exportCsv(items.map(i => ({ sku: i.sku, name: i.name, linkedProducts: i.linkedProducts || '', category: i.category, qty: i.qtyOnHand, reorder: i.reorderPoint, cost: i.unitCost })), 'inventory_items.csv')} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-sm border border-gray-700 text-gray-500 hover:text-white text-xs font-bold uppercase tracking-wide transition-all">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-800 pb-3">
        <Tab active={activeTab === 'stock'} onClick={() => setActiveTab('stock')}><Package className="w-3.5 h-3.5" />Stock</Tab>
        <Tab active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} badge={alerts.filter(a => a.status !== 'resolved').length}><AlertTriangle className="w-3.5 h-3.5" />Alerts</Tab>
        <Tab active={activeTab === 'movements'} onClick={() => setActiveTab('movements')}><BarChart3 className="w-3.5 h-3.5" />Movements</Tab>
        <Tab active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} badge={purchaseOrders.filter(po => po.status === 'ordered').length}><Truck className="w-3.5 h-3.5" />Orders</Tab>
        <Tab active={activeTab === 'suppliers'} onClick={() => setActiveTab('suppliers')}><Archive className="w-3.5 h-3.5" />Suppliers</Tab>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-600">
          <Loader2 className="w-8 h-8 animate-spin text-brand-orange/40" />
          <p className="text-sm">Loading inventory…</p>
        </div>
      ) : (
        <>
          {/* ─── STOCK TAB ─── */}
          {activeTab === 'stock' && (
            <div className="rounded-xl border border-gray-800 overflow-hidden bg-brand-dark">
              {items.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-600">
                  <Boxes className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No inventory items yet.</p>
                  <button onClick={() => setShowAddItem(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wide transition-all mt-2">
                    <Plus className="w-3.5 h-3.5" /> Add Your First Item
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 bg-black/20">
                    <tr>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3 hidden md:table-cell">Category</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Reorder At</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Unit Cost</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Supplier</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {items.map(item => (
                      <tr key={item.id} className={`group hover:bg-white/[0.02] transition-colors ${item.qtyOnHand === 0 ? 'bg-red-950/10' : item.qtyOnHand <= item.reorderPoint ? 'bg-amber-950/10' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.sku}</td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{item.name}</p>
                          {item.linkedProducts && (
                            <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[200px]" title={item.linkedProducts}>
                              Links: <span className="text-gray-400">{item.linkedProducts}</span>
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{item.category || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-base font-bold ${item.qtyOnHand === 0 ? 'text-red-400' : item.qtyOnHand <= item.reorderPoint ? 'text-amber-400' : 'text-white'}`}>
                            {item.qtyOnHand}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{item.reorderPoint}</td>
                        <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                          {item.unitCost ? `₱${Number(item.unitCost).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{item.supplierName || '—'}</td>
                        <td className="px-4 py-3"><StockBadge qty={item.qtyOnHand} reorder={item.reorderPoint} /></td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openAdjust(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-gray-700 text-gray-400 hover:text-white hover:border-brand-orange text-[10px] font-bold uppercase tracking-wide transition-all opacity-0 group-hover:opacity-100"
                          >
                            <ArrowUpDown className="w-3 h-3" /> Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─── ALERTS TAB ─── */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{alerts.length} alerts found</p>
                <select value={alertFilter} onChange={e => setAlertFilter(e.target.value as AlertFilter)} className="bg-brand-dark border border-gray-700 text-sm text-white px-3 py-2 rounded-sm focus:outline-none focus:border-brand-orange">
                  <option value="open">Open Alerts</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </select>
              </div>
              {alerts.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-600 border border-gray-800 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No alerts for this filter.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(a => (
                    <div key={a.id} className={`flex items-start justify-between gap-4 p-4 rounded-lg border ${a.status === 'resolved' ? 'border-gray-800 bg-brand-dark opacity-60' : 'border-amber-800/40 bg-amber-950/20'}`}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${a.status === 'resolved' ? 'text-gray-600' : 'text-amber-400'}`} />
                        <div>
                          <p className="text-sm text-white font-medium">{a.itemName} <span className="text-gray-500 font-normal font-mono text-xs">({a.itemSku})</span></p>
                          <p className="text-xs text-gray-500 mt-0.5">{a.message}</p>
                          <p className="text-[10px] text-gray-600 mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${a.status === 'resolved' ? 'border-gray-700 text-gray-500' : 'border-amber-500/30 text-amber-400 bg-amber-500/10'}`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── MOVEMENTS TAB ─── */}
          {activeTab === 'movements' && (
            <div className="rounded-xl border border-gray-800 overflow-hidden bg-brand-dark">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-black/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{movements.length} movement records</p>
                <button onClick={() => exportCsv(movements.map(m => ({ sku: m.itemSku, name: m.itemName, type: m.movementType, delta: m.quantityDelta, actor: m.actorName, note: m.note, date: m.createdAt })), 'inventory_movements.csv')} className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-wide transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
              {movements.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-600">
                  <BarChart3 className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No movement records yet.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Delta</th>
                      <th className="px-4 py-3 hidden md:table-cell">Note</th>
                      <th className="px-4 py-3 hidden md:table-cell">Actor</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-white text-xs font-medium">{m.itemName}</p>
                          <p className="text-gray-600 font-mono text-[10px]">{m.itemSku}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-800 text-gray-300">{m.movementType}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-sm font-bold ${m.quantityDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {m.quantityDelta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{m.note || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{m.actorName || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{new Date(m.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─── ORDERS TAB ─── */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{purchaseOrders.length} purchase orders</p>
                {lowStockCount > 0 && (
                  <button disabled={saving} onClick={() => void handleCreateQuickPO()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Auto-Restock ({lowStockCount} items)
                  </button>
                )}
              </div>
              {purchaseOrders.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-600 border border-gray-800 rounded-xl">
                  <Truck className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No purchase orders yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {purchaseOrders.map(po => (
                    <div key={po.id} className="flex items-center justify-between gap-4 p-4 rounded-lg border border-gray-800 bg-brand-dark hover:border-gray-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-black/30 flex items-center justify-center text-gray-500">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium font-mono">{po.poNumber}</p>
                          <p className="text-xs text-gray-500">{po.supplierName || 'No supplier'} • {new Date(po.createdAt || '').toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${po.status === 'received' ? 'border-green-700/40 text-green-400 bg-green-500/10' : po.status === 'ordered' ? 'border-blue-700/40 text-blue-400 bg-blue-500/10' : 'border-amber-700/40 text-amber-400 bg-amber-500/10'}`}>
                          {po.status}
                        </span>
                        {po.status !== 'received' && (
                          <button disabled={saving} onClick={() => void handleMarkReceived(po.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-gray-700 text-gray-400 hover:text-white hover:border-green-500 text-[10px] font-bold uppercase tracking-wide transition-all disabled:opacity-50">
                            <CheckCircle2 className="w-3 h-3" /> Mark Received
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── SUPPLIERS TAB ─── */}
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{suppliers.length} suppliers</p>
                <button onClick={() => setShowAddSupplier(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wide transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Supplier
                </button>
              </div>
              {suppliers.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-600 border border-gray-800 rounded-xl">
                  <Truck className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No suppliers added yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {suppliers.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-800 bg-brand-dark hover:border-gray-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-black/30 flex items-center justify-center text-gray-500">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.contactPerson || 'No contact'} {s.phone ? `• ${s.phone}` : ''}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-700" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─────────────────── MODALS ─────────────────── */}

      {/* Add Item Modal */}
      <Modal open={showAddItem} onClose={() => setShowAddItem(false)} title="Add Inventory Item">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>SKU *</label>
              <input value={newItem.sku} onChange={e => setNewItem(p => ({ ...p, sku: e.target.value }))} placeholder="e.g. LED-H7-001" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Item Name *</label>
              <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="e.g. LED Bulb H7" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <input value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} placeholder="Lighting, Tools…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Supplier</label>
              <select value={newItem.supplierId} onChange={e => setNewItem(p => ({ ...p, supplierId: Number(e.target.value) }))} className={selectCls}>
                <option value={0}>— Optional —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Starting Stock</label>
              <input type="number" min={0} value={newItem.qtyOnHand} onChange={e => setNewItem(p => ({ ...p, qtyOnHand: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Low-Stock Alert At</label>
              <input type="number" min={0} value={newItem.reorderPoint} onChange={e => setNewItem(p => ({ ...p, reorderPoint: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unit Cost (₱)</label>
              <input type="number" min={0} step="0.01" value={newItem.unitCost} onChange={e => setNewItem(p => ({ ...p, unitCost: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddItem(false)} className="flex-1 py-2.5 rounded-sm border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wide transition-all">Cancel</button>
            <button disabled={saving || !newItem.sku || !newItem.name} onClick={() => void handleCreateItem()} className="flex-1 py-2.5 rounded-sm bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save Item
            </button>
          </div>
        </div>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title={adjustTarget ? `Adjust Stock — ${adjustTarget.name}` : 'Adjust Stock'}>
        <div className="space-y-4">
          {!adjustTarget && (
            <div>
              <label className={labelCls}>Select Item *</label>
              <select value={adjust.itemId} onChange={e => setAdjust(p => ({ ...p, itemId: Number(e.target.value) }))} className={selectCls}>
                <option value={0}>— Choose an item —</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name} (in stock: {i.qtyOnHand})</option>)}
              </select>
            </div>
          )}
          {adjustTarget && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-gray-800">
              <div className="w-8 h-8 rounded-md bg-brand-orange/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-brand-orange" />
              </div>
              <div>
                <p className="text-sm text-white font-medium">{adjustTarget.name}</p>
                <p className="text-xs text-gray-500">Current stock: <span className="text-white font-bold">{adjustTarget.qtyOnHand}</span></p>
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Quantity Delta *<span className="ml-1 font-normal normal-case text-gray-600">(use negative to deduct, e.g. -3)</span></label>
            <input type="number" value={adjust.quantityDelta} onChange={e => setAdjust(p => ({ ...p, quantityDelta: Number(e.target.value) }))} placeholder="+5 or -2" className={inputCls} />
            {adjust.quantityDelta !== 0 && adjustTarget && (
              <p className="text-xs text-gray-500 mt-1.5">
                New stock: <span className={`font-bold ${adjustTarget.qtyOnHand + adjust.quantityDelta < 0 ? 'text-red-400' : 'text-white'}`}>{adjustTarget.qtyOnHand + adjust.quantityDelta}</span>
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Reason / Note</label>
            <input value={adjust.note} onChange={e => setAdjust(p => ({ ...p, note: e.target.value }))} placeholder="e.g. Received shipment, Used in job #123" className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowAdjust(false); setAdjustTarget(null); }} className="flex-1 py-2.5 rounded-sm border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wide transition-all">Cancel</button>
            <button disabled={saving || (!adjust.itemId && !adjustTarget) || adjust.quantityDelta === 0} onClick={() => void handleAdjust()} className="flex-1 py-2.5 rounded-sm bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
              Save Adjustment
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Supplier Modal */}
      <Modal open={showAddSupplier} onClose={() => setShowAddSupplier(false)} title="Add Supplier">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Supplier Name *</label>
            <input value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))} placeholder="e.g. AutoParts PH" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact Person</label>
              <input value={newSupplier.contactPerson} onChange={e => setNewSupplier(p => ({ ...p, contactPerson: e.target.value }))} placeholder="Juan Dela Cruz" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={newSupplier.phone} onChange={e => setNewSupplier(p => ({ ...p, phone: e.target.value }))} placeholder="0912 345 6789" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={newSupplier.email} onChange={e => setNewSupplier(p => ({ ...p, email: e.target.value }))} placeholder="supplier@example.com" className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddSupplier(false)} className="flex-1 py-2.5 rounded-sm border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wide transition-all">Cancel</button>
            <button disabled={saving || !newSupplier.name.trim()} onClick={() => void handleCreateSupplier()} className="flex-1 py-2.5 rounded-sm bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save Supplier
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
