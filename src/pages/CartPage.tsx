import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CartItem } from '../types';
import { cartSubtotal, readCart, removeCartItem, updateCartItemQuantity } from '../utils/cart';
import { formatPrice } from '../utils/formatPrice';
import PageSEO from '../components/PageSEO';

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener('apollo:cart-updated', sync as EventListener);
    return () => window.removeEventListener('apollo:cart-updated', sync as EventListener);
  }, []);

  const subtotal = useMemo(() => cartSubtotal(items), [items]);

  return (
    <div className="min-h-screen bg-brand-darker pt-32 pb-20">
      <PageSEO title="Your Cart" description="Review your selected products before checkout." />
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tight">Cart</h1>
          <Link to="/products" className="text-brand-orange text-sm font-bold uppercase tracking-widest hover:text-white transition-colors">
            Continue Shopping
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-sm border border-gray-800 bg-brand-dark/70 p-10 text-center">
            <ShoppingCart className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">Your cart is empty.</p>
            <Link to="/products" className="inline-block bg-brand-orange text-white px-5 py-2.5 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-orange-600 transition-colors">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {items.map(item => (
                <div key={`${item.productId}:${item.variationId ?? 'base'}`} className="border border-gray-800 bg-brand-dark/70 rounded-sm p-4 flex gap-4 items-center">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-sm border border-gray-700" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-16 h-16 rounded-sm border border-gray-700 bg-black/20" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold truncate">{item.name}</p>
                    {item.variationName && <p className="text-xs text-gray-500">{item.variationName}</p>}
                    <p className="text-brand-orange text-sm font-bold">{formatPrice(item.unitPrice)}</p>
                  </div>
                  <div className="flex items-center border border-gray-700 rounded-sm">
                    <button
                      type="button"
                      onClick={() => setItems(updateCartItemQuantity(item.productId, item.variationId, item.quantity - 1))}
                      className="px-2 py-1 text-gray-300 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 py-1 text-sm text-white font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setItems(updateCartItemQuantity(item.productId, item.variationId, item.quantity + 1))}
                      className="px-2 py-1 text-gray-300 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems(removeCartItem(item.productId, item.variationId))}
                    className="text-gray-500 hover:text-red-400"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border border-gray-800 bg-brand-dark/80 rounded-sm p-5 h-fit">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Summary</p>
              <p className="text-white text-sm flex justify-between mb-2"><span>Items</span><span>{items.length}</span></p>
              <p className="text-white text-sm flex justify-between mb-4"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></p>
              <button
                type="button"
                onClick={() => navigate('/checkout')}
                className="w-full bg-brand-orange text-white px-4 py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-orange-600 transition-colors"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
