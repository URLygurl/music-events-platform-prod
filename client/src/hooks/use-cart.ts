/**
 * useCart — localStorage-backed cart hook.
 * Cart persists across page refreshes and is shared between
 * shop.tsx (grid) and product-detail.tsx.
 *
 * Dispatches/listens to "mvt_cart_update" CustomEvent so all
 * mounted components stay in sync without a global store.
 */

import { useState, useEffect, useCallback } from "react";

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
  quantity: number;
  selectedVariants?: Record<string, string>;
}

const CART_KEY = "mvt_cart";

function readCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("mvt_cart_update"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(readCart);

  // Sync from storage when another tab/component updates
  useEffect(() => {
    const sync = () => setItems(readCart());
    window.addEventListener("mvt_cart_update", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mvt_cart_update", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    const qty = item.quantity ?? 1;
    const cart = readCart();
    const idx = cart.findIndex(
      (c) =>
        c.productId === item.productId &&
        JSON.stringify(c.selectedVariants) === JSON.stringify(item.selectedVariants)
    );
    if (idx !== -1) {
      cart[idx].quantity += qty;
    } else {
      cart.push({ ...item, quantity: qty });
    }
    writeCart(cart);
    setItems([...cart]);
  }, []);

  const removeItem = useCallback((productId: number, selectedVariants?: Record<string, string>) => {
    const cart = readCart().filter(
      (c) =>
        !(c.productId === productId &&
          JSON.stringify(c.selectedVariants) === JSON.stringify(selectedVariants))
    );
    writeCart(cart);
    setItems([...cart]);
  }, []);

  const updateQty = useCallback((productId: number, delta: number, selectedVariants?: Record<string, string>) => {
    const cart = readCart()
      .map((c) => {
        if (
          c.productId === productId &&
          JSON.stringify(c.selectedVariants) === JSON.stringify(selectedVariants)
        ) {
          return { ...c, quantity: c.quantity + delta };
        }
        return c;
      })
      .filter((c) => c.quantity > 0);
    writeCart(cart);
    setItems([...cart]);
  }, []);

  const clearCart = useCallback(() => {
    writeCart([]);
    setItems([]);
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, removeItem, updateQty, clearCart, total, count };
}
