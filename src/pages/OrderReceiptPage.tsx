import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchOrderByIdApi } from '../services/api';
import type { ProductOrder } from '../types';
import { formatPrice } from '../utils/formatPrice';

function fmtDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function labelFulfillment(type: 'courier' | 'walk_in'): string {
  return type === 'courier' ? 'Courier Delivery' : 'Walk-in Pickup';
}

function labelPayment(payment: 'unpaid' | 'paid' | 'cod'): string {
  if (payment === 'cod') return 'Cash On Delivery';
  return payment === 'paid' ? 'Paid' : 'Unpaid';
}

function labelStatus(status: ProductOrder['status']): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function OrderReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [order, setOrder] = useState<ProductOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !id) return;
    fetchOrderByIdApi(token, Number(id))
      .then(({ order }) => setOrder(order))
      .catch((e: Error) => setError(e.message ?? 'Order not found.'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center text-gray-500 text-sm">Loading receipt…</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-700 font-medium mb-3">{error || 'Order not found.'}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-blue-600 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print-only global styles injected via a style tag */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .receipt-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* No-print toolbar */}
      <div className="no-print bg-gray-100 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

      {/* Receipt */}
      <div className="min-h-screen bg-gray-100 flex justify-center py-10 px-4 print:bg-white print:py-0">
        <div
          ref={printRef}
          className="receipt-page bg-white w-full max-w-2xl shadow-lg border border-gray-200 print:shadow-none print:border-0"
        >
          {/* Header */}
          <div className="px-10 pt-10 pb-6 border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">Receipt</p>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">1625 Auto Lab</h1>
                <p className="text-sm text-gray-500 mt-0.5">Auto Detailing &amp; Accessories</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-widest">Order Number</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{order.orderNumber}</p>
                <p className="text-xs text-gray-500 mt-1">{fmtDate(order.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Customer & Fulfillment */}
          <div className="px-10 py-6 grid grid-cols-2 gap-6 border-b border-gray-200">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Billed To</p>
              <p className="text-sm font-semibold text-gray-900">{order.customerName}</p>
              <p className="text-sm text-gray-600">{order.customerEmail}</p>
              <p className="text-sm text-gray-600">{order.customerPhone}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Fulfillment</p>
              <p className="text-sm font-semibold text-gray-900">{labelFulfillment(order.fulfillmentType)}</p>
              {order.fulfillmentType === 'courier' && (
                <div className="mt-1">
                  <p className="text-sm text-gray-600">
                    {[order.deliveryAddress, order.deliveryCity, order.deliveryProvince, order.deliveryPostalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {order.courierName && (
                    <p className="text-sm text-gray-600 mt-0.5">
                      {order.courierName}
                      {order.trackingNumber ? ` — ${order.trackingNumber}` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status row */}
          <div className="px-10 py-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 mr-2">Status</span>
              <span className="font-semibold text-gray-900">{labelStatus(order.status)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 mr-2">Payment</span>
              <span className="font-semibold text-gray-900">{labelPayment(order.paymentStatus)}</span>
            </div>
          </div>

          {/* Items table */}
          <div className="px-10 py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] uppercase tracking-widest text-gray-400">
                  <th className="text-left pb-2 font-medium">Item</th>
                  <th className="text-right pb-2 font-medium w-16">Qty</th>
                  <th className="text-right pb-2 font-medium w-28">Unit Price</th>
                  <th className="text-right pb-2 font-medium w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map(item => (
                  <tr key={item.id}>
                    <td className="py-2.5 text-gray-800">
                      {item.productName}
                      {item.variationName ? (
                        <span className="text-gray-500"> — {item.variationName}</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right text-gray-700">{item.quantity}</td>
                    <td className="py-2.5 text-right text-gray-700">{formatPrice(item.unitPrice)}</td>
                    <td className="py-2.5 text-right text-gray-900 font-medium">{formatPrice(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-10 pb-8 border-t border-gray-200 pt-4">
            <div className="ml-auto max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Shipping Fee</span>
                <span>{formatPrice(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-gray-900 border-t border-gray-300 pt-2 mt-2">
                <span>Total</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="px-10 pb-8">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Order Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="px-10 py-5 bg-gray-50 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">Thank you for your order. — 1625 Auto Lab</p>
          </div>
        </div>
      </div>
    </>
  );
}
