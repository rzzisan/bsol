"use client";

import { useEffect, useState } from "react";
import type { ProductOption, ProductVariant } from "@/types/variant";
import type { Locale } from "@/lib/dashboard-client";

interface Props {
  productId: number;
  productName: string;
  token: string | null;
  apiBase: string;
  onSelect: (variant: ProductVariant) => void;
  onClose: () => void;
  /** Landing-page builder only: let the merchant attach the whole product
   *  instead of pinning one variant (customer picks a variant themselves
   *  on the public checkout page). */
  allowWholeProduct?: boolean;
  onSelectWhole?: () => void;
  locale?: Locale;
}

const text = {
  bn: {
    selectVariant: (name: string) => `ভেরিয়েন্ট বাছাই করুন — ${name}`,
    findingVariant: "মিলে যাওয়া ভেরিয়েন্ট খোঁজা হচ্ছে…",
    noVariantFound: "এই কম্বিনেশনের জন্য কোনো ভেরিয়েন্ট পাওয়া যায়নি।",
    networkError: "ভেরিয়েন্ট খুঁজতে নেটওয়ার্ক সমস্যা হয়েছে।",
    variantFound: "ভেরিয়েন্ট পাওয়া গেছে ✓",
    inStock: (n: number) => `${n} স্টকে আছে`,
    outOfStock: "স্টক নেই",
    sku: "SKU:",
    price: "দাম:",
    attachWhole: "সম্পূর্ণ পণ্য যুক্ত করুন — কাস্টমার নিজে ভেরিয়েন্ট বাছাই করবে",
    outOfStockBtn: "স্টক নেই",
    attachThis: "এই ভেরিয়েন্ট যুক্ত করুন",
    addToOrder: "অর্ডারে যোগ করুন",
    cancel: "বাতিল",
  },
  en: {
    selectVariant: (name: string) => `Select variant — ${name}`,
    findingVariant: "Finding matching variant…",
    noVariantFound: "No matching variant found for this combination.",
    networkError: "Network error resolving variant.",
    variantFound: "Variant Found ✓",
    inStock: (n: number) => `${n} in stock`,
    outOfStock: "Out of stock",
    sku: "SKU:",
    price: "Price:",
    attachWhole: "Attach whole product — customer picks the variant",
    outOfStockBtn: "Out of Stock",
    attachThis: "Attach This Variant",
    addToOrder: "Add to Order",
    cancel: "Cancel",
  },
};

export default function VariantPickerModal({ productId, productName, token, apiBase, onSelect, onClose, allowWholeProduct, onSelectWhole, locale = "en" }: Props) {
  const t = text[locale];
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<Record<number, number>>({}); // optionId → valueId
  const [resolvedVariant, setResolvedVariant] = useState<ProductVariant | null>(null);
  const [resolveError, setResolveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiBase}/products/${productId}/options`, { headers });
      const json = await res.json();
      setOptions(json.data ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Auto-resolve whenever all options are selected
  useEffect(() => {
    const allSelected = options.length > 0 && options.every((o) => selected[o.id] != null);
    if (!allSelected) { setResolvedVariant(null); return; }

    const valueIds = Object.values(selected);
    setResolving(true);
    setResolveError("");

    fetch(`${apiBase}/products/${productId}/variants/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ option_value_ids: valueIds }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (res.ok) {
          setResolvedVariant(json.data);
          setResolveError("");
        } else {
          setResolvedVariant(null);
          setResolveError(json.message ?? t.noVariantFound);
        }
      })
      .catch(() => setResolveError(t.networkError))
      .finally(() => setResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, options]);

  function selectValue(optionId: number, valueId: number) {
    setSelected((prev) => ({ ...prev, [optionId]: valueId }));
  }

  const allOptionsSelected = options.length > 0 && options.every((o) => selected[o.id] != null);

  if (loading) {
    return (
      <ModalShell title={productName} onClose={onClose}>
        <div className="py-10 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title={t.selectVariant(productName)} onClose={onClose}>
      <div className="space-y-5 p-1">
        {options.map((option) => (
          <div key={option.id}>
            <p className="text-sm font-semibold text-[var(--foreground)] mb-2">
              {option.display_name || option.name}
              {option.is_required && <span className="text-red-500 ml-1">*</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {option.values.map((val) => {
                const isChosen = selected[option.id] === val.id;
                if (option.type === "color_swatch") {
                  return (
                    <button
                      key={val.id}
                      onClick={() => selectValue(option.id, val.id)}
                      title={val.label || val.value}
                      className={`w-9 h-9 rounded-full border-2 transition-all ${isChosen ? "border-[var(--accent)] scale-110 shadow-md" : "border-[var(--border)] hover:border-[var(--muted)]"}`}
                      style={{ backgroundColor: val.color_hex ?? "#ccc" }}
                    />
                  );
                }
                return (
                  <button
                    key={val.id}
                    onClick={() => selectValue(option.id, val.id)}
                    className={`px-4 py-2 text-sm rounded-lg border-2 transition-all font-medium ${isChosen ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--muted)] text-[var(--foreground)]"}`}
                  >
                    {val.label || val.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Resolved variant info */}
        {resolving && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            {t.findingVariant}
          </div>
        )}

        {resolveError && (
          <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded p-3">
            {resolveError}
          </div>
        )}

        {resolvedVariant && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-green-800">{t.variantFound}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${resolvedVariant.stock_qty > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                {resolvedVariant.stock_qty > 0 ? t.inStock(resolvedVariant.stock_qty) : t.outOfStock}
              </span>
            </div>
            <div className="text-xs text-[var(--muted)] space-y-1">
              <p><span className="font-medium">{t.sku}</span> <span className="font-mono">{resolvedVariant.sku}</span></p>
              <p>
                <span className="font-medium">{t.price}</span>{" "}
                {parseFloat(resolvedVariant.discount) > 0 && (
                  <span className="line-through text-[var(--muted)] mr-1">৳{parseFloat(resolvedVariant.regular_price).toLocaleString()}</span>
                )}
                <span className="text-green-700 font-semibold text-sm">৳{parseFloat(resolvedVariant.selling_price).toLocaleString()}</span>
              </p>
            </div>
          </div>
        )}

        {allowWholeProduct && (
          <button
            onClick={onSelectWhole}
            className="w-full rounded-lg border-2 border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/10 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
          >
            {t.attachWhole}
          </button>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => resolvedVariant && onSelect(resolvedVariant)}
            disabled={!allOptionsSelected || !resolvedVariant || resolving || resolvedVariant.stock_qty === 0}
            className="flex-1 bg-[var(--accent)] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resolvedVariant?.stock_qty === 0 ? t.outOfStockBtn : allowWholeProduct ? t.attachThis : t.addToOrder}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-soft)]">
            {t.cancel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-bold text-[var(--foreground)] truncate pr-4">{title}</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
