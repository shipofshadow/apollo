import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Boxes, Loader2, Plus, AlertTriangle, Wrench, ClipboardList, Search, Download, RefreshCw, PackageCheck } from 'lucide-react';
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

export default function InventoryPanel() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('open');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const [newItem, setNewItem] = useState({ sku: '', name: '', category: '', qtyOnHand: 0, reorderPoint: 0, unitCost: 0, supplierId: 0 });
  const [adjust, setAdjust] = useState({ itemId: 0, quantityDelta: 0, note: '' });
  const [newSupplier, setNewSupplier] = useState({ name: '', contactPerson: '', phone: '', email: '' });

  const btnBase = 'inline-flex items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';
  const btnPrimary = `${btnBase} border-brand-orange bg-brand-orange text-white hover:bg-orange-600 hover:border-orange-600`;
  const btnSecondary = `${btnBase} border-gray-700 bg-brand-darker text-gray-200 hover:text-white hover:border-gray-500`;
  const btnGhost = `${btnBase} border-gray-700 bg-transparent text-gray-300 hover:text-white hover:border-brand-orange`;

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

  const exportCsv = (rows: Array<Record<string, string | number | null>>, fileName: string) => {
    if (rows.length === 0) {
      showToast('No rows to export.', 'error');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(key => {
        const value = row[key];
        const safe = String(value ?? '').replace(/"/g, '""');
        return `"${safe}"`;
      }).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateItem = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await createInventoryItemApi(token, {
        sku: newItem.sku,
        name: newItem.name,
        category: newItem.category,
        qtyOnHand: Number(newItem.qtyOnHand),
        reorderPoint: Number(newItem.reorderPoint),
        unitCost: Number(newItem.unitCost),
        supplierId: newItem.supplierId > 0 ? newItem.supplierId : null,
      });
      showToast('Inventory item created.', 'success');
      setNewItem({ sku: '', name: '', category: '', qtyOnHand: 0, reorderPoint: 0, unitCost: 0, supplierId: 0 });
      await loadAll();
    } catch (e) {
      showToast((e as Error).message || 'Failed to create item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async () => {
    if (!token) return;
    if (!adjust.itemId || !adjust.quantityDelta) {
      showToast('Select an item and set non-zero quantity delta.', 'error');
      return;
    }

    setSaving(true);
    try {
      await adjustInventoryApi(token, adjust);
      showToast('Stock adjusted.', 'success');
      setAdjust({ itemId: 0, quantityDelta: 0, note: '' });
      await loadAll();
    } catch (e) {
      showToast((e as Error).message || 'Failed to adjust stock.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!token) return;
    if (!newSupplier.name.trim()) {
      showToast('Supplier name is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      await createInventorySupplierApi(token, newSupplier);
      showToast('Supplier added.', 'success');
      setNewSupplier({ name: '', contactPerson: '', phone: '', email: '' });
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
    if (low.length === 0) {
      showToast('No low-stock items to reorder.', 'error');
      return;
    }

    setSaving(true);
    try {
      await createPurchaseOrderApi(token, {
        supplierId: low[0].supplierId ?? null,
        notes: 'Auto-generated from low-stock items',
        items: low.map(i => ({ itemId: i.id, quantity: Math.max(i.reorderPoint - i.qtyOnHand, 1), unitCost: i.unitCost || 0 })),
      });
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

      <section className="rounded-xl border border-gray-800 bg-gradient-to-r from-brand-darker to-brand-dark p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">Stock Management</p>
        <h2 className="text-2xl font-display font-bold uppercase tracking-wide text-white">Parts and Inventory</h2>
        <p className="text-sm text-gray-300 mt-1">Track parts, check low-stock items, and create supplier orders in one place.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard icon={<Boxes className="w-4 h-4" />} label="Inventory Items" value={String(items.length)} />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Low Stock" value={String(lowStockCount)} tone="warn" />
        <StatCard icon={<ClipboardList className="w-4 h-4" />} label="Alerts" value={String(alerts.length)} tone="warn" />
        <StatCard icon={<PackageCheck className="w-4 h-4" />} label="Purchase Orders" value={String(purchaseOrders.length)} />
      </div>

      <section className="rounded-xl border border-gray-800 bg-brand-dark p-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              placeholder="Search by SKU, name, category"
              className="w-full bg-brand-darker border border-gray-700 pl-9 pr-3 py-2 rounded-sm text-sm text-white"
            />
          </div>

          <div className="lg:col-span-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLowStockOnly(v => !v)}
              className={`${btnSecondary} ${lowStockOnly ? 'border-brand-orange bg-brand-orange/20 text-white' : ''}`}
            >
              Show Low Stock Only
            </button>
            <select
              value={alertFilter}
              onChange={e => setAlertFilter(e.target.value as AlertFilter)}
              className="bg-brand-darker border border-gray-700 text-sm text-white px-2 py-2 rounded-sm"
            >
              <option value="open">Open Alerts</option>
              <option value="resolved">Resolved Alerts</option>
              <option value="all">All Alerts</option>
            </select>
          </div>

          <div className="lg:col-span-4 flex flex-wrap items-center gap-2 justify-start lg:justify-end">
            <button type="button" onClick={() => exportCsv(items.map(i => ({ sku: i.sku, name: i.name, category: i.category, qtyOnHand: i.qtyOnHand, reorderPoint: i.reorderPoint, unitCost: i.unitCost })), 'inventory_items.csv')} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Download Items</button>
            <button type="button" onClick={() => exportCsv(alerts.map(a => ({ itemSku: a.itemSku, itemName: a.itemName, status: a.status, qtySnapshot: a.qtySnapshot, reorderPointSnapshot: a.reorderPointSnapshot, message: a.message, createdAt: a.createdAt })), 'inventory_alerts.csv')} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Download Alerts</button>
            <button type="button" onClick={() => exportCsv(movements.map(m => ({ itemSku: m.itemSku, itemName: m.itemName, movementType: m.movementType, quantityDelta: m.quantityDelta, actorName: m.actorName, createdAt: m.createdAt, note: m.note })), 'inventory_movements.csv')} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Download History</button>
            <button type="button" onClick={() => void loadAll()} className={btnGhost}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="py-12 text-gray-400 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading inventory...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="xl:col-span-4 rounded-xl border border-gray-800 bg-brand-dark p-4 space-y-4">
            <div className="rounded-lg border border-gray-800 bg-brand-darker/50 p-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-300 inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add New Item</h3>
              <p className="text-xs text-gray-500 mt-1">Add a part so your team can track available stock.</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] uppercase tracking-widest text-gray-500 col-span-1">SKU *</label>
                <label className="text-[11px] uppercase tracking-widest text-gray-500 col-span-1">Item Name *</label>
                <input value={newItem.sku} onChange={e => setNewItem(p => ({ ...p, sku: e.target.value }))} placeholder="e.g. LED-H7-001" className="w-full input" />
                <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="e.g. LED Bulb H7" className="w-full input" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-gray-500">Category</label>
                  <input value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} placeholder="Lighting, Harness, Tools..." className="w-full input" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-gray-500">Supplier</label>
                  <select value={newItem.supplierId} onChange={e => setNewItem(p => ({ ...p, supplierId: Number(e.target.value) }))} className="w-full input">
                    <option value={0}>Supplier (optional)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-gray-500">Starting Stock</label>
                  <input type="number" value={newItem.qtyOnHand} onChange={e => setNewItem(p => ({ ...p, qtyOnHand: Number(e.target.value) }))} placeholder="0" className="w-full input" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-gray-500">Low-Stock Alert At</label>
                  <input type="number" value={newItem.reorderPoint} onChange={e => setNewItem(p => ({ ...p, reorderPoint: Number(e.target.value) }))} placeholder="0" className="w-full input" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-gray-500">Cost Per Item</label>
                  <input type="number" value={newItem.unitCost} onChange={e => setNewItem(p => ({ ...p, unitCost: Number(e.target.value) }))} placeholder="0.00" className="w-full input" />
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-gray-800 bg-brand-darker/40 p-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-[11px] text-gray-500">Required fields: SKU and Item Name.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setNewItem({ sku: '', name: '', category: '', qtyOnHand: 0, reorderPoint: 0, unitCost: 0, supplierId: 0 })}
                  className={btnGhost}
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={saving || !newItem.sku || !newItem.name}
                  onClick={() => void handleCreateItem()}
                  className={btnPrimary}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Item
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-800 space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-gray-500 inline-flex items-center gap-1.5"><Wrench className="w-4 h-4" />Update Stock</p>
              <select value={adjust.itemId} onChange={e => setAdjust(p => ({ ...p, itemId: Number(e.target.value) }))} className="w-full input">
                <option value={0}>Select inventory item</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.sku} - {i.name}</option>)}
              </select>
              <input type="number" value={adjust.quantityDelta} onChange={e => setAdjust(p => ({ ...p, quantityDelta: Number(e.target.value) }))} placeholder="Add or subtract stock (example: 5 or -2)" className="w-full input" />
              <input value={adjust.note} onChange={e => setAdjust(p => ({ ...p, note: e.target.value }))} placeholder="Reason / note" className="w-full input" />
              <button
                type="button"
                disabled={saving || adjust.itemId === 0 || adjust.quantityDelta === 0}
                onClick={() => void handleAdjust()}
                className={`${btnSecondary} w-full`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} Save Stock Update
              </button>
            </div>

            <div className="pt-3 border-t border-gray-800 space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-gray-500">Supplier</p>
              <input value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))} placeholder="Supplier name" className="w-full input" />
              <input value={newSupplier.contactPerson} onChange={e => setNewSupplier(p => ({ ...p, contactPerson: e.target.value }))} placeholder="Contact person" className="w-full input" />
              <button
                type="button"
                disabled={saving || !newSupplier.name.trim()}
                onClick={() => void handleCreateSupplier()}
                className={`${btnSecondary} w-full`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Supplier
              </button>
            </div>
          </section>

          <section className="xl:col-span-8 rounded-xl border border-gray-800 bg-brand-dark p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-300">Stock Overview</h3>
              <button type="button" disabled={saving} onClick={() => void handleCreateQuickPO()} className={btnPrimary}>Create Restock Order</button>
            </div>

            <div className="max-h-64 overflow-auto rounded-sm border border-gray-800">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-500 uppercase tracking-widest border-b border-gray-800 sticky top-0 bg-brand-dark">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Reorder</th>
                    <th className="px-3 py-2">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id} className="border-b border-gray-800/60">
                      <td className="px-3 py-2 text-gray-300">{i.sku}</td>
                      <td className="px-3 py-2 text-white">{i.name}</td>
                      <td className="px-3 py-2 text-gray-400">{i.category || '-'}</td>
                      <td className={`px-3 py-2 ${i.qtyOnHand <= i.reorderPoint ? 'text-red-300' : 'text-gray-300'}`}>{i.qtyOnHand}</td>
                      <td className="px-3 py-2 text-gray-400">{i.reorderPoint}</td>
                      <td className="px-3 py-2 text-gray-500">{i.supplierName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-sm border border-gray-800 p-3 bg-brand-darker/40">
                <p className="text-[11px] uppercase tracking-widest text-gray-500">Low-stock alerts</p>
                <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                  {alerts.length === 0 ? <p className="text-sm text-gray-500">No alerts for this filter.</p> : alerts.slice(0, 12).map(a => (
                    <p key={a.id} className="text-xs text-gray-300">{a.itemSku} • {a.message}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-sm border border-gray-800 p-3 bg-brand-darker/40">
                <p className="text-[11px] uppercase tracking-widest text-gray-500">Supplier Orders</p>
                <div className="mt-2 space-y-2 max-h-36 overflow-auto">
                  {purchaseOrders.length === 0 ? <p className="text-sm text-gray-500">No purchase orders yet.</p> : purchaseOrders.slice(0, 12).map(po => (
                    <div key={po.id} className="text-xs text-gray-300 flex items-center justify-between gap-2">
                      <span>{po.poNumber} • {po.status}</span>
                      {po.status !== 'received' && (
                        <button type="button" disabled={saving} onClick={() => void handleMarkReceived(po.id)} className="inline-flex items-center justify-center rounded-sm border border-gray-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-300 transition-colors hover:border-brand-orange hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">Mark as Received</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-gray-800 p-3 bg-brand-darker/40">
              <p className="text-[11px] uppercase tracking-widest text-gray-500">Recent Movements</p>
              <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                {movements.length === 0 ? <p className="text-sm text-gray-500">No movement records yet.</p> : movements.slice(0, 12).map(m => (
                  <p key={m.id} className="text-xs text-gray-300">{m.itemSku} • {m.movementType} • {m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta} • {new Date(m.createdAt).toLocaleString()}</p>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tone = 'default' }: { icon: ReactNode; label: string; value: string; tone?: 'default' | 'warn' }) {
  return (
    <div className={`rounded-sm border p-3 ${tone === 'warn' ? 'border-red-900/60 bg-red-950/20' : 'border-gray-800 bg-brand-dark'}`}>
      <p className="text-[11px] uppercase tracking-widest text-gray-500 inline-flex items-center gap-1.5">{icon}{label}</p>
      <p className="text-white text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
