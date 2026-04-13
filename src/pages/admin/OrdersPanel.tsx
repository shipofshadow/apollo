import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Loader2, PackageSearch, Printer, RefreshCw, Save, Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchAdminOrdersApi,
  updateAdminOrderPaymentApi,
  updateAdminOrderStatusApi,
  updateAdminOrderTrackingApi,
} from '../../services/api';
import type { ProductOrder, ProductOrderStatus } from '../../types';
import { formatPrice } from '../../utils/formatPrice';

const STATUS_OPTIONS: ProductOrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'cancelled',
];

const PAYMENT_OPTIONS = ['all', 'unpaid', 'paid', 'cod'] as const;
type PaymentFilter = (typeof PAYMENT_OPTIONS)[number];

const FULFILLMENT_OPTIONS = ['all', 'courier', 'walk_in'] as const;
type FulfillmentFilter = (typeof FULFILLMENT_OPTIONS)[number];

const STATUS_CLASSES: Record<ProductOrderStatus, string> = {
  pending: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
  confirmed: 'text-blue-300 border-blue-300/30 bg-blue-300/10',
  preparing: 'text-sky-300 border-sky-300/30 bg-sky-300/10',
  ready_for_pickup: 'text-violet-300 border-violet-300/30 bg-violet-300/10',
  out_for_delivery: 'text-cyan-300 border-cyan-300/30 bg-cyan-300/10',
  completed: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
  cancelled: 'text-rose-300 border-rose-300/30 bg-rose-300/10',
};

const PAYMENT_CLASSES: Record<'unpaid' | 'paid' | 'cod', string> = {
  unpaid: 'text-rose-300 border-rose-300/30 bg-rose-300/10',
  paid: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
  cod: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
};

const PAYMENT_MUTATIONS: Array<{ value: 'unpaid' | 'paid' | 'cod'; label: string }> = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'cod', label: 'Cash On Delivery' },
];

function labelStatus(status: ProductOrderStatus): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function labelPayment(payment: 'unpaid' | 'paid' | 'cod'): string {
  if (payment === 'cod') return 'Cash On Delivery';
  return payment.toUpperCase();
}

function labelFulfillment(type: 'courier' | 'walk_in'): string {
  return type === 'courier' ? 'Courier' : 'Walk-in Pickup';
}

function timelineTone(status: ProductOrderStatus): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-300/40 bg-emerald-300/10 text-emerald-300';
    case 'cancelled':
      return 'border-rose-300/40 bg-rose-300/10 text-rose-300';
    case 'pending':
      return 'border-amber-300/40 bg-amber-300/10 text-amber-300';
    default:
      return 'border-brand-orange/40 bg-brand-orange/10 text-brand-orange';
  }
}

function buildOrderMilestones(order: ProductOrder): Array<{ id: string; label: string; time: string; detail: string; tone: string }> {
  const milestones: Array<{ id: string; label: string; time: string; detail: string; tone: string }> = [
    {
      id: 'placed',
      label: 'Order Placed',
      time: formatDateTime(order.createdAt),
      detail: `${labelFulfillment(order.fulfillmentType)}  ${formatPrice(order.totalAmount)}`,
      tone: 'border-gray-700 bg-black/20 text-gray-300',
    },
    {
      id: 'payment',
      label: 'Payment Mode',
      time: formatDateTime(order.createdAt),
      detail: labelPayment(order.paymentStatus),
      tone: `border ${PAYMENT_CLASSES[order.paymentStatus]}`,
    },
    {
      id: 'status',
      label: 'Current Status',
      time: formatDateTime(order.updatedAt),
      detail: labelStatus(order.status),
      tone: `border ${timelineTone(order.status)}`,
    },
  ];

  if (order.trackingNumber) {
    milestones.push({
      id: 'tracking',
      label: 'Tracking Assigned',
      time: formatDateTime(order.updatedAt),
      detail: `${order.courierName || 'Courier'}  ${order.trackingNumber}`,
      tone: 'border-cyan-300/40 bg-cyan-300/10 text-cyan-300',
    });
  }

  return milestones;
}

function allowedStatusOptions(order: ProductOrder): ProductOrderStatus[] {
  const blocked = order.fulfillmentType === 'courier' ? 'ready_for_pickup' : 'out_for_delivery';
  return STATUS_OPTIONS.filter(status => status !== blocked || status === order.status);
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-PH');
}

export default function OrdersPanel() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProductOrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('all');
  const [search, setSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const PAGE_SIZE = 25;
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<number | null>(null);
  const [savingTrackingId, setSavingTrackingId] = useState<number | null>(null);
  const [savingPaymentId, setSavingPaymentId] = useState<number | null>(null);

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const loadOrders = async (targetPage = page) => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await fetchAdminOrdersApi(token, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        paymentStatus: paymentFilter === 'all' ? undefined : paymentFilter,
        fulfillmentType: fulfillmentFilter === 'all' ? undefined : fulfillmentFilter,
        query: search.trim() || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      setOrders(result.orders);
      setTotalOrders(result.total);
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to load orders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    void loadOrders(1);
  }, [token, statusFilter, paymentFilter, fulfillmentFilter, createdFrom, createdTo]);

  useEffect(() => {
    if (page === 1) return; // already triggered above on filter change
    void loadOrders(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPage(1);
      void loadOrders(1);
    }, 260);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const state = location.state as { openOrderId?: number } | null;
    const openOrderId = state?.openOrderId;
    if (!openOrderId) {
      return;
    }

    const target = orders.find(order => order.id === openOrderId);
    if (!target) {
      return;
    }

    setSelectedOrderId(openOrderId);
    navigate('/admin/orders', { replace: true });
  }, [location.state, navigate, orders]);

  const visibleOrders = orders;

  const totals = useMemo(() => {
    return {
      count: totalOrders,
      amount: visibleOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      pending: visibleOrders.filter(o => o.status === 'pending').length,
      unpaid: visibleOrders.filter(o => o.paymentStatus === 'unpaid').length,
    };
  }, [visibleOrders, totalOrders]);

  const onUpdateStatus = async (id: number, status: ProductOrderStatus) => {
    if (!token) return;
    setSavingStatusId(id);
    try {
      await updateAdminOrderStatusApi(token, id, status);
      showToast('Order status updated.', 'success');
      await loadOrders(page);
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update status.', 'error');
    } finally {
      setSavingStatusId(null);
    }
  };

  const onUpdateTracking = async (id: number, courierName: string, trackingNumber: string) => {
    if (!token) return;
    setSavingTrackingId(id);
    try {
      await updateAdminOrderTrackingApi(token, id, courierName, trackingNumber);
      showToast('Tracking details updated.', 'success');
      await loadOrders(page);
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update tracking.', 'error');
    } finally {
      setSavingTrackingId(null);
    }
  };

  const onUpdatePayment = async (id: number, paymentStatus: 'unpaid' | 'paid' | 'cod') => {
    if (!token) return;
    setSavingPaymentId(id);
    try {
      await updateAdminOrderPaymentApi(token, id, paymentStatus);
      showToast('Payment status updated.', 'success');
      await loadOrders(page);
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update payment status.', 'error');
    } finally {
      setSavingPaymentId(null);
    }
  };

  const exportCsv = () => {
    const header = [
      'Order Number',
      'Created At',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Fulfillment',
      'Status',
      'Payment Status',
      'Courier',
      'Tracking Number',
      'Subtotal',
      'Shipping Fee',
      'Total Amount',
      'Items',
    ];

    const escapeCell = (value: string | number) => {
      const text = String(value ?? '');
      return `"${text.replaceAll('"', '""')}"`;
    };

    const rows = visibleOrders.map(order => [
      order.orderNumber,
      order.createdAt,
      order.customerName,
      order.customerEmail,
      order.customerPhone,
      labelFulfillment(order.fulfillmentType),
      labelStatus(order.status),
      labelPayment(order.paymentStatus),
      order.courierName,
      order.trackingNumber,
      order.subtotal.toFixed(2),
      order.shippingFee.toFixed(2),
      order.totalAmount.toFixed(2),
      order.items.map(item => `${item.productName}${item.variationName ? ` (${item.variationName})` : ''} x${item.quantity}`).join(' | '),
    ]);

    const csv = [header, ...rows].map(row => row.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Orders</h2>
          <p className="text-sm text-gray-500 mt-1">Manage courier and walk-in checkout orders.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order, customer, email"
              className="w-full bg-brand-dark border border-gray-700 text-white pl-9 pr-3 py-2 rounded-sm text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProductOrderStatus | 'all')}
            className="bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{labelStatus(s)}</option>
            ))}
          </select>
          <select
            value={fulfillmentFilter}
            onChange={(e) => setFulfillmentFilter(e.target.value as FulfillmentFilter)}
            className="bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
          >
            <option value="all">All Fulfillment</option>
            {FULFILLMENT_OPTIONS.filter(o => o !== 'all').map(option => (
              <option key={option} value={option}>{labelFulfillment(option)}</option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            className="bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
          >
            <option value="all">All Payment</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="cod">Cash On Delivery</option>
          </select>
          <button
            type="button"
            onClick={() => void loadOrders(page)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange rounded-sm text-xs font-bold uppercase tracking-widest transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange rounded-sm text-xs font-bold uppercase tracking-widest transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-6">
        <div>
          <label className="text-[11px] uppercase tracking-widest text-gray-500 block mb-1">From</label>
          <input
            type="date"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
            className="bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest text-gray-500 block mb-1">To</label>
          <input
            type="date"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
            className="bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setCreatedFrom('');
            setCreatedTo('');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange rounded-sm text-xs font-bold uppercase tracking-widest transition-colors"
        >
          Clear Dates
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-gray-800 bg-brand-dark/70 rounded-sm px-4 py-3">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">Orders</p>
          <p className="text-xl font-black text-white mt-1">{totals.count}</p>
        </div>
        <div className="border border-gray-800 bg-brand-dark/70 rounded-sm px-4 py-3">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">Pending</p>
          <p className="text-xl font-black text-amber-300 mt-1">{totals.pending}</p>
        </div>
        <div className="border border-gray-800 bg-brand-dark/70 rounded-sm px-4 py-3">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">Unpaid</p>
          <p className="text-xl font-black text-rose-300 mt-1">{totals.unpaid}</p>
        </div>
        <div className="border border-gray-800 bg-brand-dark/70 rounded-sm px-4 py-3">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">Total Value</p>
          <p className="text-xl font-black text-brand-orange mt-1">{formatPrice(totals.amount)}</p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-brand-orange animate-spin" />
        </div>
      )}

      {!loading && visibleOrders.length === 0 && (
        <div className="text-center py-16 border border-gray-800 bg-brand-dark rounded-sm">
          <PackageSearch className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No orders found for the current filters.</p>
        </div>
      )}

      {!loading && visibleOrders.length > 0 && (
        <div className="space-y-3">
          {visibleOrders.map(order => (
            <div key={order.id} className="border border-gray-800 bg-brand-dark/70 rounded-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-white font-bold">{order.orderNumber}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {order.customerName}  {order.customerEmail}  {formatDateTime(order.createdAt)}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border ${STATUS_CLASSES[order.status]}`}>
                      {labelStatus(order.status)}
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border ${PAYMENT_CLASSES[order.paymentStatus]}`}>
                      {labelPayment(order.paymentStatus)}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border border-gray-700 text-gray-300 bg-black/20">
                      {labelFulfillment(order.fulfillmentType)}
                    </span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-brand-orange font-bold">{formatPrice(order.totalAmount)}</p>
                    <p className="text-[11px] uppercase tracking-widest text-gray-500">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange rounded-sm text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    View Details
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalOrders > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalOrders)} of {totalOrders} orders
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange rounded-sm text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span className="text-xs text-gray-400 px-2">Page {page} of {Math.ceil(totalOrders / PAGE_SIZE)}</span>
            <button
              type="button"
              disabled={page >= Math.ceil(totalOrders / PAGE_SIZE) || loading}
              onClick={() => setPage(p => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange rounded-sm text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          savingStatus={savingStatusId === selectedOrder.id}
          savingPayment={savingPaymentId === selectedOrder.id}
          savingTracking={savingTrackingId === selectedOrder.id}
          onClose={() => setSelectedOrderId(null)}
          onUpdateStatus={(status) => void onUpdateStatus(selectedOrder.id, status)}
          onUpdatePayment={(paymentStatus) => void onUpdatePayment(selectedOrder.id, paymentStatus)}
          onUpdateTracking={(courierName, trackingNumber) => void onUpdateTracking(selectedOrder.id, courierName, trackingNumber)}
          onViewReceipt={() => navigate(`/orders/${selectedOrder.id}/receipt`)}
        />
      )}
    </div>
  );
}

function OrderDetailDrawer({
  order,
  savingStatus,
  savingPayment,
  savingTracking,
  onClose,
  onUpdateStatus,
  onUpdatePayment,
  onUpdateTracking,
  onViewReceipt,
}: {
  order: ProductOrder;
  savingStatus: boolean;
  savingPayment: boolean;
  savingTracking: boolean;
  onClose: () => void;
  onUpdateStatus: (status: ProductOrderStatus) => void;
  onUpdatePayment: (paymentStatus: 'unpaid' | 'paid' | 'cod') => void;
  onUpdateTracking: (courierName: string, trackingNumber: string) => void;
  onViewReceipt: () => void;
}) {
  const milestones = useMemo(() => buildOrderMilestones(order), [order]);

  const nextStatus: ProductOrderStatus | null = (() => {
    switch (order.status) {
      case 'pending':
        return 'confirmed';
      case 'confirmed':
        return 'preparing';
      case 'preparing':
        return order.fulfillmentType === 'courier' ? 'out_for_delivery' : 'ready_for_pickup';
      case 'ready_for_pickup':
      case 'out_for_delivery':
        return 'completed';
      default:
        return null;
    }
  })();

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-2xl bg-brand-darker border-l border-gray-800 z-50 overflow-y-auto">
        <div className="sticky top-0 bg-brand-darker/95 backdrop-blur border-b border-gray-800 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500">Order Detail</p>
            <h3 className="text-lg font-bold text-white">{order.orderNumber}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onViewReceipt}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange rounded-sm text-xs font-bold uppercase tracking-widest transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 border border-gray-700 rounded-sm text-gray-400 hover:text-white hover:border-brand-orange transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoCard label="Customer" value={order.customerName} />
            <InfoCard label="Email" value={order.customerEmail} />
            <InfoCard label="Phone" value={order.customerPhone} />
            <InfoCard label="Placed" value={formatDateTime(order.createdAt)} />
            <InfoCard label="Fulfillment" value={labelFulfillment(order.fulfillmentType)} />
            <InfoCard label="Payment" value={labelPayment(order.paymentStatus)} />
          </div>

          {order.fulfillmentType === 'courier' && (
            <div className="border border-gray-800 bg-black/10 rounded-sm p-4">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Delivery Address</p>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">
                {order.deliveryAddress || 'N/A'}
                {(order.deliveryCity || order.deliveryProvince || order.deliveryPostalCode)
                  ? `\n${[order.deliveryCity, order.deliveryProvince, order.deliveryPostalCode].filter(Boolean).join(', ')}`
                  : ''}
              </p>
            </div>
          )}

          <div className="border border-gray-800 bg-black/10 rounded-sm p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Items</p>
            <div className="space-y-2">
              {order.items.map(item => (
                <div key={item.id} className="text-sm text-gray-300 flex justify-between gap-3">
                  <span>{item.productName}{item.variationName ? ` (${item.variationName})` : ''} x{item.quantity}</span>
                  <span>{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800 text-sm">
              <p className="flex justify-between text-gray-400"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></p>
              <p className="flex justify-between text-gray-400"><span>Shipping</span><span>{formatPrice(order.shippingFee)}</span></p>
              <p className="flex justify-between text-white font-bold mt-1"><span>Total</span><span>{formatPrice(order.totalAmount)}</span></p>
            </div>
          </div>

          <div className="border border-gray-800 bg-black/10 rounded-sm p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Order Timeline</p>
            <div className="space-y-2">
              {milestones.map((step) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div className={`mt-1 w-2 h-2 rounded-full border ${step.tone}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-white font-semibold">{step.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.time}</p>
                    <p className="text-xs text-gray-300 mt-1 break-words">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-800 bg-black/10 rounded-sm p-3">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Update Status</p>
              <div className="flex gap-2">
                <select
                  value={order.status}
                  onChange={(e) => onUpdateStatus(e.target.value as ProductOrderStatus)}
                  disabled={savingStatus}
                  className="flex-1 bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
                >
                  {allowedStatusOptions(order).map(s => (
                    <option key={s} value={s}>{labelStatus(s)}</option>
                  ))}
                </select>
                {savingStatus && <Loader2 className="w-4 h-4 text-brand-orange animate-spin mt-2" />}
              </div>
              {nextStatus && order.status !== 'cancelled' && (
                <button
                  type="button"
                  disabled={savingStatus}
                  onClick={() => onUpdateStatus(nextStatus)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 border border-brand-orange/40 text-brand-orange hover:text-white hover:bg-brand-orange text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-60"
                >
                  Advance to {labelStatus(nextStatus)}
                </button>
              )}
              <p className="text-[11px] text-gray-600 mt-2">Last updated: {formatDateTime(order.updatedAt)}</p>
            </div>

            <div className="border border-gray-800 bg-black/10 rounded-sm p-3">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Update Payment</p>
              <div className="flex gap-2 items-center">
                <select
                  value={order.paymentStatus}
                  onChange={(e) => onUpdatePayment(e.target.value as 'unpaid' | 'paid' | 'cod')}
                  disabled={savingPayment}
                  className="flex-1 bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
                >
                  {PAYMENT_MUTATIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {savingPayment && <Loader2 className="w-4 h-4 text-brand-orange animate-spin mt-0.5" />}
              </div>
            </div>

            <TrackingEditor
              order={order}
              busy={savingTracking}
              onSave={onUpdateTracking}
            />
          </div>

          {order.notes && (
            <div className="border border-gray-800 bg-black/10 rounded-sm p-4">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Order Notes</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-800 bg-black/10 rounded-sm px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-sm text-gray-200 mt-1 break-words">{value || 'N/A'}</p>
    </div>
  );
}

function TrackingEditor({
  order,
  busy,
  onSave,
}: {
  order: ProductOrder;
  busy: boolean;
  onSave: (courierName: string, trackingNumber: string) => void;
}) {
  const [courierName, setCourierName] = useState(order.courierName || '');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');

  useEffect(() => {
    setCourierName(order.courierName || '');
    setTrackingNumber(order.trackingNumber || '');
  }, [order.id, order.courierName, order.trackingNumber]);

  return (
    <div className="border border-gray-800 bg-black/10 rounded-sm p-3">
      <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Courier Tracking</p>
      <div className="space-y-2">
        <input
          value={courierName}
          onChange={(e) => setCourierName(e.target.value)}
          placeholder="Courier name"
          className="w-full bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
        />
        <input
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="Tracking number"
          className="w-full bg-brand-dark border border-gray-700 text-white px-3 py-2 rounded-sm text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(courierName, trackingNumber)}
          className="inline-flex items-center gap-2 px-3 py-2 border border-brand-orange/40 text-brand-orange hover:text-white hover:bg-brand-orange text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Tracking
        </button>
      </div>
    </div>
  );
}
