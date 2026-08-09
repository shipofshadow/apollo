import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Boxes, Loader2, Plus, AlertTriangle, Wrench, ClipboardList, Search, Download, RefreshCw, PackageCheck, Truck, ArrowRightLeft } from 'lucide-react';
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
      showToast((e as Error).message || 'Failed to load inventory data.', 'error');
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
      showToast('No inventory records to export.', 'error');
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
    showToast(`Exported ${fileName}`, 'success');
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
      showToast('Inventory item created successfully.', 'success');
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
      showToast('Select an item and set a non-zero quantity delta.', 'error');
      return;
    }

    setSaving(true);
    try {
      await adjustInventoryApi(token, adjust);
      showToast('Stock level adjusted successfully.', 'success');
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
      showToast('Supplier created successfully.', 'success');
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
      showToast('No low-stock items requiring reorder.', 'error');
      return;
    }

    setSaving(true);
    try {
      await createPurchaseOrderApi(token, {
        supplierId: low[0].supplierId ?? null,
        notes: 'Auto-generated restock order for low-stock items',
        items: low.map(i => ({ itemId: i.id, quantity: Math.max(i.reorderPoint - i.qtyOnHand, 1), unitCost: i.unitCost || 0 })),
      });
      showToast('Purchase order created for low-stock items.', 'success');
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
      showToast('Purchase order marked as received and stock updated.', 'success');
      await loadAll();
    } catch (e) {
      showToast((e as Error).message || 'Failed to update purchase order.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-20">
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Inventory & Parts' }]} />

      {/* Top Hero Header */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
              <Boxes className="w-6 h-6 text-brand-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange">Shop Operations</p>
              </div>
              <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white">Parts &amp; Inventory Control</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="flex items-center gap-2 bg-brand-darker border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-orange' : 'text-brand-orange'}`} />
            <span>Sync Stock Data</span>
          </button>
        </div>
      </section>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Boxes className="w-5 h-5 text-sky-400" />} label="Total Parts Catalog" value={String(items.length)} />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-amber-400" />} label="Low Stock Items" value={String(lowStockCount)} tone={lowStockCount > 0 ? 'warn' : 'default'} />
        <StatCard icon={<ClipboardList className="w-5 h-5 text-red-400" />} label="Active Alerts" value={String(alerts.length)} tone={alerts.length > 0 ? 'warn' : 'default'} />
        <StatCard icon={<PackageCheck className="w-5 h-5 text-emerald-400" />} label="Purchase Orders" value={String(purchaseOrders.length)} />
      </div>

      {/* Search & Export Toolbar */}
      <section className="rounded-xl border border-gray-800/80 bg-[#121212] p-5 shadow-xl space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              placeholder="Search part by SKU, name, or category..."
              className="w-full bg-brand-darker border border-gray-800 pl-10 pr-4 py-2.5 rounded-lg text-xs font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-orange"
            />
          </div>

          <div className="lg:col-span-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLowStockOnly(v => !v)}
              className={`px-4 py-2.5 rounded-lg border text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                lowStockOnly
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 font-bold'
                  : 'border-gray-800 bg-brand-darker text-gray-400 hover:text-white'
              }`}
            >
              Low Stock Only
            </button>
            <select
              value={alertFilter}
              onChange={e => setAlertFilter(e.target.value as AlertFilter)}
              className="bg-brand-darker border border-gray-800 text-xs font-mono font-bold uppercase tracking-wider text-gray-300 px-3 py-2.5 rounded-lg focus:outline-none focus:border-brand-orange cursor-pointer"
            >
              <option value="open">Open Alerts</option>
              <option value="resolved">Resolved Alerts</option>
              <option value="all">All Alerts</option>
            </select>
          </div>

          <div className="lg:col-span-4 flex flex-wrap items-center gap-2 justify-start lg:justify-end font-mono text-xs">
            <button
              type="button"
              onClick={() => exportCsv(items.map(i => ({ sku: i.sku, name: i.name, category: i.category, qtyOnHand: i.qtyOnHand, reorderPoint: i.reorderPoint, unitCost: i.unitCost })), 'inventory_items.csv')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-800 bg-brand-darker text-gray-300 hover:text-white hover:border-gray-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-brand-orange" /> Download Catalog
            </button>
            <button
              type="button"
              onClick={() => exportCsv(alerts.map(a => ({ itemSku: a.itemSku, itemName: a.itemName, status: a.status, qtySnapshot: a.qtySnapshot, reorderPointSnapshot: a.reorderPointSnapshot, message: a.message, createdAt: a.createdAt })), 'inventory_alerts.csv')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-800 bg-brand-darker text-gray-300 hover:text-white hover:border-gray-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-brand-orange" /> Download Alerts
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="py-20 text-xs font-mono text-gray-400 flex items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-brand-orange" />
          <span>Fetching inventory catalog and supplier logs…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column: Input Forms */}
          <section className="xl:col-span-5 space-y-6">
            {/* Create Item Card */}
            <div className="rounded-xl border border-gray-800/80 bg-[#121212] p-5 shadow-2xl space-y-4">
              <div className="border-b border-gray-800/80 pb-3 flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Inventory Item
                </h3>
              </div>

              <div className="space-y-3 font-sans">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">SKU *</label>
                    <input
                      value={newItem.sku}
                      onChange={e => setNewItem(p => ({ ...p, sku: e.target.value }))}
                      placeholder="e.g. LED-H7-001"
                      className="w-full bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Item Name *</label>
                    <input
                      value={newItem.name}
                      onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. LED Projector Lens"
                      className="w-full bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-brand-orange"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Category</label>
                    <input
                      value={newItem.category}
                      onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                      placeholder="Lighting, Harness, Optics..."
                      className="w-full bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Supplier</label>
                    <select
                      value={newItem.supplierId}
                      onChange={e => setNewItem(p => ({ ...p, supplierId: Number(e.target.value) }))}
                      className="w-full bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-brand-orange cursor-pointer"
                    >
                      <option value={0}>Unassigned Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Initial Qty</label>
                    <input
                      type="number"
                      value={newItem.qtyOnHand}
                      onChange={e => setNewItem(p => ({ ...p, qtyOnHand: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Reorder At</label>
                    <input
                      type="number"
                      value={newItem.reorderPoint}
                      onChange={e => setNewItem(p => ({ ...p, reorderPoint: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Unit Cost (₱)</label>
                    <input
                      type="number"
                      value={newItem.unitCost}
                      onChange={e => setNewItem(p => ({ ...p, unitCost: Number(e.target.value) }))}
                      placeholder="0.00"
                      className="w-full bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800/80 flex items-center justify-end gap-2 font-mono text-xs">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setNewItem({ sku: '', name: '', category: '', qtyOnHand: 0, reorderPoint: 0, unitCost: 0, supplierId: 0 })}
                  className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={saving || !newItem.sku || !newItem.name}
                  onClick={() => void handleCreateItem()}
                  className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2 font-bold uppercase tracking-wider rounded-lg shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Save Item</span>
                </button>
              </div>
            </div>

            {/* Adjust Stock Form Card */}
            <div className="rounded-xl border border-gray-800/80 bg-[#121212] p-5 shadow-2xl space-y-3 font-sans">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Quick Stock Adjustment
              </h3>
              <select
                value={adjust.itemId}
                onChange={e => setAdjust(p => ({ ...p, itemId: Number(e.target.value) }))}
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value={0}>Select inventory item...</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name} (Stock: {i.qtyOnHand})</option>)}
              </select>
              <input
                type="number"
                value={adjust.quantityDelta}
                onChange={e => setAdjust(p => ({ ...p, quantityDelta: Number(e.target.value) }))}
                placeholder="Quantity change (e.g. +5 or -2)"
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange"
              />
              <input
                value={adjust.note}
                onChange={e => setAdjust(p => ({ ...p, note: e.target.value }))}
                placeholder="Adjustment reason / internal note..."
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-2.5 rounded-lg text-xs focus:outline-none focus:border-brand-orange"
              />
              <button
                type="button"
                disabled={saving || adjust.itemId === 0 || adjust.quantityDelta === 0}
                onClick={() => void handleAdjust()}
                className="w-full flex items-center justify-center gap-2 bg-brand-darker border border-gray-800 hover:border-brand-orange text-gray-300 hover:text-white px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 text-brand-orange" />}
                <span>Apply Stock Adjustment</span>
              </button>
            </div>

            {/* Add Supplier Form Card */}
            <div className="rounded-xl border border-gray-800/80 bg-[#121212] p-5 shadow-2xl space-y-3 font-sans">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                <Truck className="w-4 h-4" /> Add Vendor / Supplier
              </h3>
              <input
                value={newSupplier.name}
                onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))}
                placeholder="Supplier company name *"
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-2.5 rounded-lg text-xs focus:outline-none focus:border-brand-orange"
              />
              <input
                value={newSupplier.contactPerson}
                onChange={e => setNewSupplier(p => ({ ...p, contactPerson: e.target.value }))}
                placeholder="Contact person / manager..."
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-2.5 rounded-lg text-xs focus:outline-none focus:border-brand-orange"
              />
              <button
                type="button"
                disabled={saving || !newSupplier.name.trim()}
                onClick={() => void handleCreateSupplier()}
                className="w-full flex items-center justify-center gap-2 bg-brand-darker border border-gray-800 hover:border-brand-orange text-gray-300 hover:text-white px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-brand-orange" />}
                <span>Save Supplier</span>
              </button>
            </div>
          </section>

          {/* Right Column: Catalog Overview & Activity Panels */}
          <section className="xl:col-span-7 space-y-6">
            {/* Inventory Overview Table Card */}
            <div className="rounded-xl border border-gray-800/80 bg-[#121212] overflow-hidden shadow-2xl space-y-4">
              <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between gap-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-brand-orange" /> Stock Catalog Overview
                </h3>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleCreateQuickPO()}
                  className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4" /> Auto Restock Order
                </button>
              </div>

              <div className="max-h-80 overflow-auto border-t border-gray-800/80">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-black/40 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800/80 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">In Stock</th>
                      <th className="px-4 py-3">Reorder At</th>
                      <th className="px-4 py-3">Supplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-gray-300">
                    {items.map(i => {
                      const isLow = i.qtyOnHand <= i.reorderPoint;
                      return (
                        <tr key={i.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 font-bold text-brand-orange">{i.sku}</td>
                          <td className="px-4 py-3 text-white font-bold">{i.name}</td>
                          <td className="px-4 py-3 text-gray-400">{i.category || '—'}</td>
                          <td className="px-4 py-3 font-bold">
                            <span className={`px-2 py-0.5 rounded ${isLow ? 'bg-red-500/10 text-red-400 border border-red-500/30 font-bold' : 'text-emerald-400'}`}>
                              {i.qtyOnHand}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{i.reorderPoint}</td>
                          <td className="px-4 py-3 text-gray-400">{i.supplierName || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Low Stock Alerts & Supplier Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-800/80 bg-[#121212] p-5 shadow-xl space-y-3 font-mono">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Low-Stock System Alerts
                </p>
                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No active alerts for this filter.</p>
                  ) : alerts.slice(0, 10).map(a => (
                    <div key={a.id} className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-200">
                      <span className="font-bold">{a.itemSku}:</span> {a.message}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-800/80 bg-[#121212] p-5 shadow-xl space-y-3 font-mono">
                <p className="text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-2">
                  <PackageCheck className="w-4 h-4" /> Supplier Purchase Orders
                </p>
                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                  {purchaseOrders.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No purchase orders created yet.</p>
                  ) : purchaseOrders.slice(0, 10).map(po => (
                    <div key={po.id} className="p-2.5 rounded-lg border border-gray-800 bg-brand-darker text-xs text-gray-300 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-white">{po.poNumber}</span>
                        <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded bg-black/40 text-gray-400 border border-gray-800">
                          {po.status}
                        </span>
                      </div>
                      {po.status !== 'received' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleMarkReceived(po.id)}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/20 transition-colors cursor-pointer"
                        >
                          Mark Received
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Movements Log Card */}
            <div className="rounded-xl border border-gray-800/80 bg-[#121212] p-5 shadow-xl space-y-3 font-mono">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-brand-orange" /> Recent Inventory Movement Audit Log
              </p>
              <div className="space-y-2 max-h-44 overflow-auto pr-1">
                {movements.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No stock movements recorded yet.</p>
                ) : movements.slice(0, 12).map(m => (
                  <div key={m.id} className="p-2.5 rounded-lg border border-gray-800 bg-brand-darker text-xs text-gray-300 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-brand-orange">{m.itemSku}</span>
                      <span className="mx-1.5 text-gray-500">•</span>
                      <span className="capitalize">{m.movementType}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className={`font-bold ${m.quantityDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                      </span>
                      <span className="text-gray-500">{new Date(m.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                    </div>
                  </div>
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
    <div className={`rounded-xl border p-5 shadow-xl font-mono ${tone === 'warn' ? 'border-amber-500/40 bg-amber-950/20' : 'border-gray-800/80 bg-[#121212]'}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">{icon}{label}</p>
      <p className="text-white text-2xl font-black mt-1.5">{value}</p>
    </div>
  );
}
