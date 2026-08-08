"use client";

import { useState } from "react";
import type { ProductVariant } from "@/types/variant";
import { computeSellingPrice } from "@/lib/pricing";
import type { Locale } from "@/lib/dashboard-client";

interface Props {
  variants: ProductVariant[];
  token: string | null;
  apiBase: string;
  productId: number;
  productThumbnail?: string | null;
  onVariantsChange: (variants: ProductVariant[]) => void;
  locale: Locale;
}

const text = {
  bn: {
    empty: "এখনও কোনো ভেরিয়েন্ট নেই। উপরের অপশন থেকে কম্বিনেশন জেনারেট করুন অথবা ম্যানুয়ালি যোগ করুন।",
    selected: (n: number) => `${n}টি নির্বাচিত`,
    activate: "সক্রিয় করুন",
    deactivate: "নিষ্ক্রিয় করুন",
    clear: "মুছুন",
    colAttributes: "বৈশিষ্ট্য",
    colSku: "SKU",
    colImage: "ছবি",
    colPrice: "দাম",
    colDiscount: "ছাড়",
    colSelling: "বিক্রয় মূল্য",
    colStock: "স্টক",
    colActive: "সক্রিয়",
    colActions: "অ্যাকশন",
    noImage: "কোনো ছবি নেই",
    save: "সেভ",
    savingShort: "…",
    cancel: "বাতিল",
    edit: "এডিট",
    del: "মুছুন",
    saveFailed: "সেভ করা যায়নি",
    confirmDelete: "এই ভেরিয়েন্টটি মুছবেন?",
    variantCount: (n: number) => `${n}টি ভেরিয়েন্ট`,
  },
  en: {
    empty: "No variants yet. Generate combinations from the options above or add manually.",
    selected: (n: number) => `${n} selected`,
    activate: "Activate",
    deactivate: "Deactivate",
    clear: "Clear",
    colAttributes: "Attributes",
    colSku: "SKU",
    colImage: "Image",
    colPrice: "Price",
    colDiscount: "Discount",
    colSelling: "Selling",
    colStock: "Stock",
    colActive: "Active",
    colActions: "Actions",
    noImage: "No image",
    save: "Save",
    savingShort: "…",
    cancel: "Cancel",
    edit: "Edit",
    del: "Del",
    saveFailed: "Save failed",
    confirmDelete: "Delete this variant?",
    variantCount: (n: number) => `${n} variant${n !== 1 ? "s" : ""}`,
  },
};

export default function VariantTable({ variants, token, apiBase, productId, productThumbnail = null, onVariantsChange, locale }: Props) {
  const t = text[locale];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<ProductVariant>>({});
  const [saving, setSaving] = useState(false);
  const [bulkIds, setBulkIds] = useState<Set<number>>(new Set());

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  function startEdit(variant: ProductVariant) {
    setEditingId(variant.id);
    setEditRow({ ...variant });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    const body = {
      sku: editRow.sku,
      regular_price: editRow.regular_price,
      discount: editRow.discount ?? 0,
      discount_type: editRow.discount_type ?? "amount",
      cost_price: editRow.cost_price ?? 0,
      stock_qty: editRow.stock_qty ?? 0,
      low_stock_threshold: editRow.low_stock_threshold ?? 5,
      is_active: editRow.is_active ?? true,
    };

    const res = await fetch(`${apiBase}/products/${productId}/variants/${editingId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { alert(json.message ?? t.saveFailed); return; }

    onVariantsChange(variants.map((v) => (v.id === editingId ? json.data : v)));
    setEditingId(null);
  }

  async function toggleActive(variant: ProductVariant) {
    const res = await fetch(`${apiBase}/products/${productId}/variants/${variant.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        sku: variant.sku,
        regular_price: variant.regular_price,
        is_active: !variant.is_active,
      }),
    });
    const json = await res.json();
    if (res.ok) onVariantsChange(variants.map((v) => (v.id === variant.id ? json.data : v)));
  }

  async function deleteVariant(id: number) {
    if (!confirm(t.confirmDelete)) return;
    const res = await fetch(`${apiBase}/products/${productId}/variants/${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) onVariantsChange(variants.filter((v) => v.id !== id));
  }

  async function bulkToggleActive(active: boolean) {
    if (bulkIds.size === 0) return;
    const body = {
      variants: [...bulkIds].map((id) => ({ id, is_active: active })),
    };
    const res = await fetch(`${apiBase}/products/${productId}/variants/bulk`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onVariantsChange(variants.map((v) => bulkIds.has(v.id) ? { ...v, is_active: active } : v));
      setBulkIds(new Set());
    }
  }

  const liveSellingPrice = editRow.regular_price != null
    ? computeSellingPrice(
        parseFloat(editRow.regular_price as unknown as string) || 0,
        parseFloat(editRow.discount as unknown as string) || 0,
        editRow.discount_type ?? "amount"
      )
    : null;

  if (variants.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] text-center py-8">
        {t.empty}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Bulk actions */}
      {bulkIds.size > 0 && (
        <div className="flex gap-2 items-center bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded px-3 py-2">
          <span className="text-xs text-[var(--accent)] font-medium">{t.selected(bulkIds.size)}</span>
          <button onClick={() => bulkToggleActive(true)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">{t.activate}</button>
          <button onClick={() => bulkToggleActive(false)} className="text-xs bg-[var(--muted)] text-white px-2 py-1 rounded hover:opacity-90">{t.deactivate}</button>
          <button onClick={() => setBulkIds(new Set())} className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--foreground)]">{t.clear}</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-xs text-[var(--muted)] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={bulkIds.size === variants.length && variants.length > 0}
                  onChange={(e) => setBulkIds(e.target.checked ? new Set(variants.map((v) => v.id)) : new Set())}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 text-left">{t.colAttributes}</th>
              <th className="px-3 py-3 text-left">{t.colSku}</th>
              <th className="px-3 py-3 text-center">{t.colImage}</th>
              <th className="px-3 py-3 text-right">{t.colPrice}</th>
              <th className="px-3 py-3 text-right">{t.colDiscount}</th>
              <th className="px-3 py-3 text-right">{t.colSelling}</th>
              <th className="px-3 py-3 text-right">{t.colStock}</th>
              <th className="px-3 py-3 text-center">{t.colActive}</th>
              <th className="px-3 py-3 text-center">{t.colActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {variants.map((variant) => {
              const isEditing = editingId === variant.id;
              const optionDrivenImage = variant.options.find((opt) => !!opt.image_url)?.image_url ?? null;
              const effectiveImage = variant.image_url || optionDrivenImage || productThumbnail;

              return (
                <tr key={variant.id} className={`hover:bg-[var(--surface-soft)] ${!variant.is_active ? "opacity-60" : ""}`}>
                  {/* Checkbox */}
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={bulkIds.has(variant.id)}
                      onChange={(e) => {
                        const next = new Set(bulkIds);
                        e.target.checked ? next.add(variant.id) : next.delete(variant.id);
                        setBulkIds(next);
                      }}
                      className="rounded"
                    />
                  </td>

                  {/* Attributes */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {variant.options.map((opt) => (
                        <span
                          key={opt.option_value_id}
                          className="inline-flex items-center gap-1 text-[var(--foreground)] text-xs px-2 py-0.5 rounded-full border border-[var(--border)]"
                          style={opt.option_type === "color_swatch" && opt.color_hex
                            ? { borderColor: opt.color_hex, backgroundColor: `${opt.color_hex}22` }
                            : undefined}
                          title={`${opt.option_name}: ${opt.label || opt.value}`}
                        >
                          {opt.option_type === "color_swatch" && opt.color_hex && (
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block border border-[var(--border)]"
                              style={{ backgroundColor: opt.color_hex }}
                              aria-label={`${opt.label || opt.value} swatch`}
                            />
                          )}
                          <span className="text-[var(--muted)] mr-0.5">{opt.option_name}:</span>
                          {opt.label || opt.value}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <input
                        className="border border-[var(--border)] bg-[var(--background)] rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                        value={editRow.sku ?? ""}
                        onChange={(e) => setEditRow({ ...editRow, sku: e.target.value })}
                      />
                    ) : (
                      <span className="font-mono text-xs text-[var(--muted)]">{variant.sku}</span>
                    )}
                  </td>

                  {/* Variant image with fallback chain */}
                  <td className="px-3 py-3 text-center">
                    {effectiveImage ? (
                      <img
                        src={effectiveImage}
                        alt={variant.sku}
                        className="inline-block h-9 w-9 rounded object-cover border border-[var(--border)]"
                        title="Variant image (fallback: variant → option value → product thumbnail)"
                      />
                    ) : (
                      <span className="inline-block h-9 w-9 rounded bg-[var(--surface-soft)] border border-[var(--border)]" title={t.noImage} />
                    )}
                  </td>

                  {/* Price */}
                  <td className="px-3 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        className="border border-[var(--border)] bg-[var(--background)] rounded px-2 py-1 text-xs w-24 text-right focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                        value={editRow.regular_price ?? ""}
                        onChange={(e) => setEditRow({ ...editRow, regular_price: e.target.value as unknown as string })}
                      />
                    ) : (
                      <span>৳{parseFloat(variant.regular_price).toLocaleString()}</span>
                    )}
                  </td>

                  {/* Discount */}
                  <td className="px-3 py-3 text-right">
                    {isEditing ? (
                      <div className="flex gap-1 justify-end">
                        <input
                          type="number"
                          className="border border-[var(--border)] bg-[var(--background)] rounded px-2 py-1 text-xs w-16 text-right focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                          value={editRow.discount ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, discount: e.target.value as unknown as string })}
                        />
                        <select
                          className="border border-[var(--border)] bg-[var(--background)] rounded px-1 py-1 text-xs focus:outline-none"
                          value={editRow.discount_type ?? "amount"}
                          onChange={(e) => setEditRow({ ...editRow, discount_type: e.target.value as "amount" | "percent" })}
                        >
                          <option value="amount">৳</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    ) : (
                      <span className="text-[var(--muted)]">
                        {parseFloat(variant.discount) > 0
                          ? `${parseFloat(variant.discount)}${variant.discount_type === "percent" ? "%" : "৳"}`
                          : "—"}
                      </span>
                    )}
                  </td>

                  {/* Selling price */}
                  <td className="px-3 py-3 text-right font-semibold text-green-700">
                    {isEditing && liveSellingPrice != null
                      ? `৳${liveSellingPrice.toLocaleString()}`
                      : `৳${parseFloat(variant.selling_price).toLocaleString()}`}
                  </td>

                  {/* Stock */}
                  <td className="px-3 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        className="border border-[var(--border)] bg-[var(--background)] rounded px-2 py-1 text-xs w-16 text-right focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                        value={editRow.stock_qty ?? ""}
                        onChange={(e) => setEditRow({ ...editRow, stock_qty: parseInt(e.target.value) || 0 })}
                      />
                    ) : (
                      <span className={variant.is_low_stock ? "text-orange-500 font-medium" : ""}>
                        {variant.stock_qty}
                        {variant.is_low_stock && <span className="ml-1 text-xs">⚠</span>}
                      </span>
                    )}
                  </td>

                  {/* Active toggle */}
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => toggleActive(variant)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${variant.is_active ? "bg-green-500" : "bg-[var(--border)]"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${variant.is_active ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3 text-center">
                    {isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="text-xs bg-[var(--accent)] text-white px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                        >
                          {saving ? t.savingShort : t.save}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-[var(--muted)] px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-soft)]"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => startEdit(variant)} className="text-xs text-[var(--accent)] hover:opacity-80 px-1">{t.edit}</button>
                        <button onClick={() => deleteVariant(variant.id)} className="text-xs text-red-500 hover:text-red-700 px-1">{t.del}</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)] text-right">{t.variantCount(variants.length)}</p>
    </div>
  );
}
