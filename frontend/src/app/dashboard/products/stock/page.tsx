"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "স্টক ম্যানেজমেন্ট",
    loading: "লোড হচ্ছে...",
    noProducts: "স্টক ট্র্যাকযোগ্য কোনো পণ্য নেই।",
    name: "পণ্য",
    currentStock: "বর্তমান স্টক",
    lowAlert: "সতর্কতা সীমা",
    adjust: "পরিবর্তন",
    reason: "কারণ",
    adjustTitle: "স্টক পরিবর্তন",
    adjustLabel: "পরিবর্তনের পরিমাণ (+ বা -)",
    reasonLabel: "কারণ",
    save: "সংরক্ষণ",
    cancel: "বাতিল",
    saving: "সংরক্ষণ হচ্ছে...",
  },
  en: {
    pageTitle: "Stock Management",
    loading: "Loading...",
    noProducts: "No stock-tracked products.",
    name: "Product",
    currentStock: "Current Stock",
    lowAlert: "Low Alert",
    adjust: "Adjust",
    reason: "Reason",
    adjustTitle: "Adjust Stock",
    adjustLabel: "Adjustment (+ or -)",
    reasonLabel: "Reason",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
  },
};

type Product = {
  id: number; name: string; sku: string | null;
  stock: number; low_stock_alert: number; unit: string;
};

export default function StockPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const token = getStoredToken();

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all products with track_stock, get multiple pages if needed
      const res = await fetch(`${API}/products?per_page=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        const tracked = (d.data as Product[]).filter(() => true); // track_stock comes from backend filter
        setProducts(tracked);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void fetchStock(); }, [fetchStock]);

  const openAdjust = (p: Product) => { setAdjusting(p); setAmount(0); setReason(""); };
  const closeAdjust = () => setAdjusting(null);

  const handleAdjust = async () => {
    if (!adjusting || amount === 0) return;
    setSaving(true);
    try {
      await fetch(`${API}/products/${adjusting.id}/adjust-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, reason }),
      });
      closeAdjust();
      void fetchStock();
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserShell activeKey="stock-management" defaultExpandedKey="products"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.name}</th>
              <th className="px-4 py-3 text-center">{txt.currentStock}</th>
              <th className="px-4 py-3 text-center hidden md:table-cell">{txt.lowAlert}</th>
              <th className="px-4 py-3 text-right">{txt.adjust}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noProducts}</td></tr>
            ) : products.map(p => {
              const isLow = p.stock <= p.low_stock_alert;
              return (
                <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    {p.sku && <p className="text-xs text-[var(--muted)]">SKU: {p.sku}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-lg font-bold ${isLow ? "text-red-400" : "text-emerald-400"}`}>
                      {p.stock}
                    </span>
                    <span className="ml-1 text-xs text-[var(--muted)]">{p.unit}</span>
                    {isLow && (
                      <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
                        {locale === "bn" ? "কম স্টক" : "Low"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell text-[var(--muted)]">
                    {p.low_stock_alert} {p.unit}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openAdjust(p)}
                      className="rounded-xl border border-[var(--accent)]/40 px-3 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10">
                      {txt.adjust}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Adjust Modal */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && closeAdjust()}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold">{txt.adjustTitle}</h3>
            <p className="mb-4 text-sm text-[var(--muted)]">{adjusting.name}</p>
            <div className="mb-3">
              <p className="text-center text-3xl font-bold">{adjusting.stock} <span className="text-sm text-[var(--muted)]">{adjusting.unit}</span></p>
              <p className="mt-1 text-center text-xs text-[var(--muted)]">{locale === "bn" ? "বর্তমান স্টক" : "Current Stock"}</p>
            </div>
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.adjustLabel}</span>
                <div className="flex gap-2">
                  <button onClick={() => setAmount(a => a - 1)}
                    className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-bold hover:bg-[var(--surface-soft)]">−</button>
                  <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-center text-sm outline-none focus:border-[var(--accent)]" />
                  <button onClick={() => setAmount(a => a + 1)}
                    className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-bold hover:bg-[var(--surface-soft)]">+</button>
                </div>
                {amount !== 0 && (
                  <p className={`mt-1 text-center text-xs ${amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    → {adjusting.stock + amount} {adjusting.unit}
                  </p>
                )}
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.reasonLabel}</span>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeAdjust} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">
                {txt.cancel}
              </button>
              <button onClick={handleAdjust} disabled={saving || amount === 0}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? txt.saving : txt.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
