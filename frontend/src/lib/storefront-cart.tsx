"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Client-side storefront cart (seller_storefront_context.md §5.4/§12, S4).
 * No backend Cart model on purpose — persisted in localStorage, which is
 * already origin-scoped per seller subdomain (the same isolation property
 * auth tokens rely on, custom_domain_context.md §2), so one seller's cart
 * can never leak into another's page.
 *
 * Checkout submission (POST /public/storefront/orders, S3) isn't built yet
 * — the cart page below shows real totals but the checkout button is a
 * disabled "coming soon" state until then.
 */

const STORAGE_KEY = "bsol_storefront_cart";

export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  thumbnail: string | null;
  unitPrice: number;
  quantity: number;
  productType: "physical" | "digital" | null;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => { ok: boolean; error?: string };
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  itemCount: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  // Mixed cart (physical + digital in one order) isn't allowed — the same
  // rule the landing-page checkout enforces (digital_product_context.md).
  // Enforced here too so a customer finds out at "Add to Cart", not after
  // filling in the whole checkout form.
  const addItem = useCallback<CartContextValue["addItem"]>((item, quantity = 1) => {
    let result: { ok: boolean; error?: string } = { ok: true };

    setItems((prev) => {
      const conflicting = prev.find((p) => p.productType && item.productType && p.productType !== item.productType);
      if (conflicting) {
        result = { ok: false, error: "cross_type" };
        return prev;
      }

      const existing = prev.find((p) => p.productId === item.productId);
      if (existing) {
        return prev.map((p) => (p.productId === item.productId ? { ...p, quantity: p.quantity + quantity } : p));
      }

      return [...prev, { ...item, quantity }];
    });

    return result;
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((p) => p.productId !== productId)
        : prev.map((p) => (p.productId === productId ? { ...p, quantity } : p)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, clear, itemCount, subtotal }),
    [items, addItem, removeItem, updateQuantity, clear, itemCount, subtotal],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider (frontend/src/app/store/layout.tsx)");
  }
  return ctx;
}
