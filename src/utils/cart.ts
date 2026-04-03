import type { CartItem } from '../types';

const CART_KEY = 'apollo-cart-v1';

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartItem => {
      return item && typeof item === 'object'
        && (typeof item.productId === 'string' || typeof item.productId === 'number')
        && typeof item.quantity === 'number'
        && item.quantity > 0
        && typeof item.name === 'string'
        && typeof item.unitPrice === 'number';
    });
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('apollo:cart-updated'));
}

export function clearCart(): void {
  writeCart([]);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function addToCart(nextItem: CartItem): CartItem[] {
  const items = readCart();
  const key = `${nextItem.productId}:${nextItem.variationId ?? 'base'}`;
  const index = items.findIndex(i => `${i.productId}:${i.variationId ?? 'base'}` === key);

  if (index >= 0) {
    const existing = items[index];
    items[index] = {
      ...existing,
      quantity: existing.quantity + Math.max(1, nextItem.quantity),
      unitPrice: nextItem.unitPrice,
      variationName: nextItem.variationName,
      imageUrl: nextItem.imageUrl,
      name: nextItem.name,
    };
  } else {
    items.push({ ...nextItem, quantity: Math.max(1, nextItem.quantity) });
  }

  writeCart(items);
  return items;
}

export function updateCartItemQuantity(productId: number | string, variationId: number | null | undefined, quantity: number): CartItem[] {
  const items = readCart();
  const key = `${productId}:${variationId ?? 'base'}`;
  const next = items
    .map(item => {
      const itemKey = `${item.productId}:${item.variationId ?? 'base'}`;
      if (itemKey !== key) return item;
      return { ...item, quantity: Math.max(0, quantity) };
    })
    .filter(item => item.quantity > 0);

  writeCart(next);
  return next;
}

export function removeCartItem(productId: number | string, variationId: number | null | undefined): CartItem[] {
  const key = `${productId}:${variationId ?? 'base'}`;
  const next = readCart().filter(item => `${item.productId}:${item.variationId ?? 'base'}` !== key);
  writeCart(next);
  return next;
}
