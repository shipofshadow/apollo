import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Loader2, PackageSearch, Printer, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchMyOrdersApi } from '../../services/api';
import type { ProductOrder } from '../../types';
import { formatPrice } from '../../utils/formatPrice';

function statusLabel(status: ProductOrder['status']): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function paymentLabel(payment: ProductOrder['paymentStatus']): string {
  return payment === 'cod' ? 'Cash On Delivery' : payment.toUpperCase();
}

function statusClass(status: ProductOrder['status']): string {
  switch (status) {
    case 'pending':
      return 'text-amber-300 border-amber-300/30 bg-amber-300/10';
    case 'confirmed':
      return 'text-blue-300 border-blue-300/30 bg-blue-300/10';
    case 'preparing':
      return 'text-sky-300 border-sky-300/30 bg-sky-300/10';
    case 'ready_for_pickup':
      return 'text-violet-300 border-violet-300/30 bg-violet-300/10';
    case 'out_for_delivery':
      return 'text-cyan-300 border-cyan-300/30 bg-cyan-300/10';
    case 'completed':
      return 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10';
    case 'cancelled':
      return 'text-rose-300 border-rose-300/30 bg-rose-300/10';
    default:
      return 'text-gray-300 border-gray-300/30 bg-gray-300/10';
  }
}

function paymentClass(payment: ProductOrder['paymentStatus']): string {
  if (payment === 'paid') return 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10';
  if (payment === 'cod') return 'text-amber-300 border-amber-300/30 bg-amber-300/10';
  return 'text-rose-300 border-rose-300/30 bg-rose-300/10';
}

export default function MyOrders() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProductOrder['status'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [copiedTracking, setCopiedTracking] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchMyOrdersApi(token)
      .then(({ orders }) => setOrders(orders))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [token]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }
      if (term === '') {
        return true;
      }
      return [order.orderNumber, order.customerName, order.customerEmail]
        .some(value => value.toLowerCase().includes(term));
    });
  }, [orders, search, statusFilter]);

  const totals = useMemo(() => {
    return {
      count: visibleOrders.length,
      active: visibleOrders.filter(o => !['completed', 'cancelled'].includes(o.status)).length,
      spent: visibleOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    };
  }, [visibleOrders]);

  const copyTracking = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTracking(value);
      showToast('Tracking number copied.', 'success');
      window.setTimeout(() => setCopiedTracking(''), 1800);
    } catch {
      showToast('Unable to copy tracking number.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-brand-darker via-brand-dark to-[#161515] p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange/90 mb-2">Client Portal</p>
        <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tight">My Orders</h1>
        <p className="mt-2 text-sm text-gray-400">Track courier or walk-in purchase status in real time.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order number"
              className="w-full bg-black/20 border border-gray-700 text-white pl-9 pr-3 py-2 rounded-md text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProductOrder['status'] | 'all')}
            className="bg-black/20 border border-gray-700 text-white px-3 py-2 rounded-md text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="ready_for_pickup">Ready for Pickup</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-gray-800 bg-brand-dark/70 rounded-xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-500">Orders</p>
            <p className="text-xl font-black text-white mt-1">{totals.count}</p>
          </div>
          <div className="border border-gray-800 bg-brand-dark/70 rounded-xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-500">Active</p>
            <p className="text-xl font-black text-brand-orange mt-1">{totals.active}</p>
          </div>
          <div className="border border-gray-800 bg-brand-dark/70 rounded-xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-500">Order Value</p>
            <p className="text-xl font-black text-emerald-300 mt-1">{formatPrice(totals.spent)}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-brand-orange animate-spin" />
        </div>
      )}

      {!loading && visibleOrders.length === 0 && (
        <div className="text-center py-14 bg-brand-dark border border-gray-800 rounded-xl">
          <PackageSearch className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-400 text-sm">No orders match your current filters.</p>
        </div>
      )}

      {!loading && visibleOrders.length > 0 && (
        <div className="space-y-3">
          {visibleOrders.map(order => (
            <div key={order.id} className="border border-gray-800 bg-brand-dark/70 rounded-xl p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-white font-bold">{order.orderNumber}</p>
                <span className={`text-xs uppercase tracking-widest px-2 py-1 rounded-md border ${statusClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {new Date(order.createdAt).toLocaleString('en-PH')} • {order.fulfillmentType === 'courier' ? 'Courier' : 'Walk-in Pickup'}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border ${paymentClass(order.paymentStatus)}`}>
                  {paymentLabel(order.paymentStatus)}
                </span>
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border border-gray-700 text-gray-300 bg-black/20">
                  {order.items.length} item{order.items.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1 mb-3">
                {order.items.map(item => (
                  <p key={item.id} className="text-sm text-gray-300 flex justify-between">
                    <span>{item.productName}{item.variationName ? ` (${item.variationName})` : ''} x{item.quantity}</span>
                    <span>{formatPrice(item.subtotal)}</span>
                  </p>
                ))}
              </div>
              {order.trackingNumber && (
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span>
                    Courier: <span className="text-white">{order.courierName || 'Assigned'}</span>
                  </span>
                  <span>•</span>
                  <span>
                    Tracking: <span className="text-brand-orange">{order.trackingNumber}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyTracking(order.trackingNumber)}
                    className="inline-flex items-center gap-1 px-2 py-1 border border-gray-700 rounded-md text-gray-300 hover:text-white hover:border-brand-orange transition-colors"
                  >
                    {copiedTracking === order.trackingNumber ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedTracking === order.trackingNumber ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${order.id}/receipt`)}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-orange transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  View Receipt
                </button>
                <p className="text-sm font-bold text-white">Total: {formatPrice(order.totalAmount)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
