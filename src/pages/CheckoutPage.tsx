import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PageSEO from '../components/PageSEO';
import { cartSubtotal, clearCart, readCart } from '../utils/cart';
import { createOrderApi } from '../services/api';
import { formatPrice } from '../utils/formatPrice';
import type { CartItem } from '../types';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);

  const [customerName, setCustomerName] = useState(user?.name ?? '');
  const [customerEmail, setCustomerEmail] = useState(user?.email ?? '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone ?? '');
  const [fulfillmentType, setFulfillmentType] = useState<'courier' | 'walk_in'>('courier');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryProvince, setDeliveryProvince] = useState('');
  const [deliveryPostalCode, setDeliveryPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setItems(readCart());
  }, []);

  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const shippingFee = fulfillmentType === 'courier' ? 150 : 0;
  const total = subtotal + shippingFee;

  const placeOrder = async () => {
    if (items.length === 0) {
      showToast('Your cart is empty.', 'error');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      showToast('Please complete your contact details.', 'error');
      return;
    }
    if (fulfillmentType === 'courier' && !deliveryAddress.trim()) {
      showToast('Delivery address is required for courier orders.', 'error');
      return;
    }

    setBusy(true);
    try {
      const { order } = await createOrderApi({
        customerName,
        customerEmail,
        customerPhone,
        fulfillmentType,
        deliveryAddress,
        deliveryCity,
        deliveryProvince,
        deliveryPostalCode,
        shippingFee,
        notes,
        items: items.map(item => ({
          productId: item.productId,
          variationId: item.variationId ?? null,
          quantity: item.quantity,
        })),
      }, token);

      clearCart();
      showToast(`Order ${order.orderNumber} placed successfully.`, 'success');

      if (token) {
        navigate('/client/orders');
      } else {
        navigate('/products');
      }
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to place order.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-darker pt-32 pb-20">
      <PageSEO title="Checkout" description="Complete your order at 1625 Auto Lab." />
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <h1 className="text-4xl font-display font-black text-white uppercase tracking-tight mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-gray-800 bg-brand-dark/80 rounded-sm p-4">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Contact Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full name" className="bg-black/20 border border-gray-700 text-white placeholder:text-gray-600 px-3 py-2.5 rounded-sm focus:outline-none focus:border-brand-orange transition-colors" />
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone" className="bg-black/20 border border-gray-700 text-white placeholder:text-gray-600 px-3 py-2.5 rounded-sm focus:outline-none focus:border-brand-orange transition-colors" />
                <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Email" className="md:col-span-2 bg-black/20 border border-gray-700 text-white placeholder:text-gray-600 px-3 py-2.5 rounded-sm focus:outline-none focus:border-brand-orange transition-colors" />
              </div>
            </div>

            <div className="border border-gray-800 bg-brand-dark/80 rounded-sm p-4">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Fulfillment</p>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setFulfillmentType('courier')} className={`px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border ${fulfillmentType === 'courier' ? 'bg-brand-orange border-brand-orange text-white' : 'border-gray-700 text-gray-300'}`}>Courier</button>
                <button type="button" onClick={() => setFulfillmentType('walk_in')} className={`px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border ${fulfillmentType === 'walk_in' ? 'bg-brand-orange border-brand-orange text-white' : 'border-gray-700 text-gray-300'}`}>Walk-in Pickup</button>
              </div>

              {fulfillmentType === 'courier' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Delivery address" className="md:col-span-2 bg-black/20 border border-gray-700 text-white placeholder:text-gray-600 px-3 py-2.5 rounded-sm min-h-20 focus:outline-none focus:border-brand-orange transition-colors" />
                  <input value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)} placeholder="City" className="bg-black/20 border border-gray-700 text-white placeholder:text-gray-600 px-3 py-2.5 rounded-sm focus:outline-none focus:border-brand-orange transition-colors" />
                  <input value={deliveryProvince} onChange={e => setDeliveryProvince(e.target.value)} placeholder="Province" className="bg-black/20 border border-gray-700 text-white placeholder:text-gray-600 px-3 py-2.5 rounded-sm focus:outline-none focus:border-brand-orange transition-colors" />
                  <input value={deliveryPostalCode} onChange={e => setDeliveryPostalCode(e.target.value)} placeholder="Postal code" className="bg-black/20 border border-gray-700 text-white placeholder:text-gray-600 px-3 py-2.5 rounded-sm focus:outline-none focus:border-brand-orange transition-colors" />
                </div>
              )}

              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Order notes (optional)" className="mt-3 w-full bg-black/20 border border-gray-700 text-white placeholder:text-gray-600 px-3 py-2.5 rounded-sm min-h-20 focus:outline-none focus:border-brand-orange transition-colors" />
            </div>
          </div>

          <div className="border border-gray-800 bg-brand-dark/80 rounded-sm p-5 h-fit">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Order Summary</p>
            <div className="space-y-2 mb-4">
              {items.map(item => (
                <p key={`${item.productId}:${item.variationId ?? 'base'}`} className="text-sm text-gray-300 flex justify-between gap-3">
                  <span className="truncate">{item.name} x{item.quantity}</span>
                  <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                </p>
              ))}
            </div>
            <p className="text-sm text-gray-300 flex justify-between mb-1"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></p>
            <p className="text-sm text-gray-300 flex justify-between mb-3"><span>Shipping</span><span>{formatPrice(shippingFee)}</span></p>
            <p className="text-base font-bold text-white flex justify-between mb-4"><span>Total</span><span>{formatPrice(total)}</span></p>
            <button
              type="button"
              onClick={() => void placeOrder()}
              disabled={busy || items.length === 0}
              className="w-full bg-brand-orange text-white px-4 py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {busy ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
