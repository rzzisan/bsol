"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredToken, type Locale } from "@/lib/dashboard-client";
import {
  LANDING_API_BASE,
  type LandingPageProductInput,
  type LandingPageRecord,
  type ProductItem,
} from "@/lib/landing-pages";

type ProductDraft = {
  product_id: number;
  title_override: string;
  subtitle: string;
  badge_text: string;
  price_override: string;
  default_qty: number;
  selected_by_default: boolean;
  sort_order: number;
};

type LandingPageProductPanelProps = {
  pageId: number;
  locale: Locale;
};

const text = {
  bn: {
    title: "প্রোডাক্ট ও চেকআউট",
    hint: "এই পেজে কোন প্রোডাক্ট বিক্রি হবে তা এখানে যোগ/সাজান — চেকআউট ফর্ম স্বয়ংক্রিয়ভাবে এই প্রোডাক্টগুলো দেখাবে।",
    dragHint: "টেনে সাজান",
    selectedProducts: "সংযুক্ত পণ্য",
    emptyProducts: "কোনো পণ্য সংযুক্ত করা হয়নি।",
    remove: "সরান",
    overrideTitle: "শিরোনাম (ঐচ্ছিক)",
    overrideSubtitle: "সাবটাইটেল (ঐচ্ছিক)",
    badge: "ব্যাজ টেক্সট (ঐচ্ছিক)",
    overridePrice: "মূল্য override (ঐচ্ছিক)",
    defaultQty: "ডিফল্ট পরিমাণ",
    selectedByDefault: "ডিফল্টভাবে নির্বাচিত",
    products: "সব প্রোডাক্ট",
    searchProducts: "প্রোডাক্ট খুঁজুন",
    noProducts: "কোনো প্রোডাক্ট পাওয়া যায়নি।",
    attach: "যুক্ত করুন",
    save: "প্রোডাক্ট সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    saved: "সংরক্ষিত হয়েছে।",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    loading: "লোড হচ্ছে...",
  },
  en: {
    title: "Products & Checkout",
    hint: "Attach and order the products this page sells — the checkout form will show exactly these.",
    dragHint: "Drag to reorder",
    selectedProducts: "Attached products",
    emptyProducts: "No products attached yet.",
    remove: "Remove",
    overrideTitle: "Title override (optional)",
    overrideSubtitle: "Subtitle (optional)",
    badge: "Badge text (optional)",
    overridePrice: "Price override (optional)",
    defaultQty: "Default qty",
    selectedByDefault: "Selected by default",
    products: "All products",
    searchProducts: "Search products",
    noProducts: "No products found.",
    attach: "Attach",
    save: "Save Products",
    saving: "Saving...",
    saved: "Saved.",
    error: "Request failed.",
    loading: "Loading...",
  },
};

function normalizeDraft(input: LandingPageProductInput & { product?: ProductItem | null }, index: number): ProductDraft {
  return {
    product_id: input.product_id,
    title_override: input.title_override ?? "",
    subtitle: input.subtitle ?? "",
    badge_text: input.badge_text ?? "",
    price_override: input.price_override == null ? "" : String(input.price_override),
    default_qty: input.default_qty ?? 1,
    selected_by_default: input.selected_by_default ?? true,
    sort_order: input.sort_order ?? index + 1,
  };
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

export default function LandingPageProductPanel({ pageId, locale }: LandingPageProductPanelProps) {
  const t = text[locale] ?? text.en;
  const token = getStoredToken();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [pageTitle, setPageTitle] = useState("");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductDraft[]>([]);
  const [query, setQuery] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setError(t.error);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const [pageRes, productsRes] = await Promise.all([
          fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/products?per_page=100`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!pageRes.ok || !productsRes.ok) {
          throw new Error(t.error);
        }

        const pageJson = await pageRes.json();
        const productsJson = await productsRes.json();
        const loadedPage = pageJson.data as LandingPageRecord;

        setPageTitle(loadedPage.title ?? "");
        setProducts((productsJson.data ?? []).filter((item: ProductItem) => item.status !== "archived"));
        setSelectedProducts((loadedPage.products ?? []).map((item, index) => normalizeDraft(item, index)));
      } catch (err) {
        setError(err instanceof Error ? err.message : t.error);
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const filteredProducts = useMemo(() => {
    const attached = new Set(selectedProducts.map((item) => item.product_id));
    const needle = query.trim().toLowerCase();
    return products.filter((item) => {
      if (attached.has(item.id)) return false;
      if (!needle) return true;
      return [item.name, item.sku ?? ""].join(" ").toLowerCase().includes(needle);
    });
  }, [products, query, selectedProducts]);

  const selectedProductDetails = useMemo(() => {
    const map = new Map(products.map((item) => [item.id, item]));
    return selectedProducts.map((item, index) => ({
      ...item,
      sort_order: index + 1,
      product: map.get(item.product_id) ?? null,
    }));
  }, [products, selectedProducts]);

  function addProduct(product: ProductItem) {
    setSelectedProducts((prev) => [
      ...prev,
      {
        product_id: product.id,
        title_override: "",
        subtitle: "",
        badge_text: "",
        price_override: "",
        default_qty: 1,
        selected_by_default: true,
        sort_order: prev.length + 1,
      },
    ]);
  }

  function removeProduct(productId: number) {
    setSelectedProducts((prev) => prev.filter((item) => item.product_id !== productId).map((item, index) => ({ ...item, sort_order: index + 1 })));
  }

  function patchProduct(productId: number, changes: Partial<ProductDraft>) {
    setSelectedProducts((prev) => prev.map((item) => (item.product_id === productId ? { ...item, ...changes } : item)));
  }

  function reorderByIds(sourceId: number, targetId: number) {
    if (sourceId === targetId) return;
    setSelectedProducts((prev) => {
      const from = prev.findIndex((item) => item.product_id === sourceId);
      const to = prev.findIndex((item) => item.product_id === targetId);
      if (from < 0 || to < 0) return prev;
      return moveItem(prev, from, to).map((item, index) => ({ ...item, sort_order: index + 1 }));
    });
  }

  async function saveProducts() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: pageTitle,
          products: selectedProducts.map((item, index) => ({
            product_id: item.product_id,
            title_override: item.title_override || null,
            subtitle: item.subtitle || null,
            badge_text: item.badge_text || null,
            price_override: item.price_override === "" ? null : Number(item.price_override),
            default_qty: item.default_qty,
            selected_by_default: item.selected_by_default,
            sort_order: index + 1,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setSuccess(t.saved);
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-4 text-sm text-[var(--muted)]">{t.loading}</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">{t.hint}</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--foreground)]">{t.selectedProducts}</span>
          <span className="text-[10px] text-[var(--muted)]">{t.dragHint}</span>
        </div>
        {selectedProductDetails.length === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">{t.emptyProducts}</div>
        ) : (
          <div className="mt-2 space-y-2">
            {selectedProductDetails.map((item) => (
              <div
                key={item.product_id}
                draggable
                onDragStart={() => setDraggingId(item.product_id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggingId != null) reorderByIds(draggingId, item.product_id);
                  setDraggingId(null);
                }}
                onDragEnd={() => setDraggingId(null)}
                className={`rounded-lg border bg-[var(--surface)] p-2 text-xs ${draggingId === item.product_id ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="cursor-grab font-semibold text-[var(--foreground)]">
                    ⋮⋮ {item.product?.name ?? `#${item.product_id}`}
                  </span>
                  <button type="button" onClick={() => removeProduct(item.product_id)} className="text-red-500">
                    {t.remove}
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <input value={item.title_override} onChange={(e) => patchProduct(item.product_id, { title_override: e.target.value })} placeholder={t.overrideTitle} className="rounded border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1" />
                  <input value={item.subtitle} onChange={(e) => patchProduct(item.product_id, { subtitle: e.target.value })} placeholder={t.overrideSubtitle} className="rounded border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1" />
                  <input value={item.badge_text} onChange={(e) => patchProduct(item.product_id, { badge_text: e.target.value })} placeholder={t.badge} className="rounded border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1" />
                  <input value={item.price_override} onChange={(e) => patchProduct(item.product_id, { price_override: e.target.value })} placeholder={t.overridePrice} className="rounded border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1" />
                  <label className="col-span-2 flex items-center gap-1.5">
                    <span>{t.defaultQty}</span>
                    <input type="number" min={1} max={100} value={item.default_qty} onChange={(e) => patchProduct(item.product_id, { default_qty: Math.max(1, Number(e.target.value) || 1) })} className="w-16 rounded border border-[var(--border)] bg-[var(--surface-soft)] px-1.5 py-1" />
                  </label>
                  <label className="col-span-2 flex items-center gap-1.5">
                    <input type="checkbox" checked={item.selected_by_default} onChange={(e) => patchProduct(item.product_id, { selected_by_default: e.target.checked })} />
                    <span>{t.selectedByDefault}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <span className="text-xs font-semibold text-[var(--foreground)]">{t.products}</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchProducts} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs" />
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">{t.noProducts}</div>
          ) : (
            filteredProducts.slice(0, 30).map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-xs">
                <span className="truncate font-semibold text-[var(--foreground)]">{product.name}</span>
                <button type="button" onClick={() => addProduct(product)} className="shrink-0 rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-1 font-semibold text-[var(--accent)]">
                  {t.attach}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void saveProducts()}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
      >
        {saving ? t.saving : t.save}
      </button>
    </div>
  );
}
