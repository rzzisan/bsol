"use client";

import { useState } from "react";
import type { ProductVariant } from "@/types/variant";
import { computeSellingPrice } from "@/lib/pricing";

interface Props {
  variants: ProductVariant[];
  token: string | null;
  apiBase: string;
  productId: number;
  productThumbnail?: string | null;
  onVariantsChange: (variants: ProductVariant[]) => void;
}

export default function VariantTable({ variants, token, apiBase, productId, productThumbnail = null, onVariantsChange }: Props) {
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
    if (!res.ok) { alert(json.message ?? "Save failed"); return; }

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
    if (!confirm("Delete this variant?")) return;
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
      <p className="text-sm text-gray-500 text-center py-8">
        No variants yet. Generate combinations from the options above or add manually.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Bulk actions */}
      {bulkIds.size > 0 && (
        <div className="flex gap-2 items-center bg-blue-50 border border-blue-200 rounded px-3 py-2">
          <span className="text-xs text-blue-700 font-medium">{bulkIds.size} selected</span>
          <button onClick={() => bulkToggleActive(true)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Activate</button>
          <button onClick={() => bulkToggleActive(false)} className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600">Deactivate</button>
          <button onClick={() => setBulkIds(new Set())} className="ml-auto text-xs text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={bulkIds.size === variants.length && variants.length > 0}
                  onChange={(e) => setBulkIds(e.target.checked ? new Set(variants.map((v) => v.id)) : new Set())}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 text-left">Attributes</th>
              <th className="px-3 py-3 text-left">SKU</th>
              <th className="px-3 py-3 text-center">Image</th>
              <th className="px-3 py-3 text-right">Price</th>
              <th className="px-3 py-3 text-right">Discount</th>
              <th className="px-3 py-3 text-right">Selling</th>
              <th className="px-3 py-3 text-right">Stock</th>
              <th className="px-3 py-3 text-center">Active</th>
              <th className="px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {variants.map((variant) => {
              const isEditing = editingId === variant.id;
              const optionDrivenImage = variant.options.find((opt) => !!opt.image_url)?.image_url ?? null;
              const effectiveImage = variant.image_url || optionDrivenImage || productThumbnail;

              return (
                <tr key={variant.id} className={`hover:bg-gray-50 ${!variant.is_active ? "opacity-60" : ""}`}>
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
                          className="inline-flex items-center gap-1 text-gray-700 text-xs px-2 py-0.5 rounded-full border"
                          style={opt.option_type === "color_swatch" && opt.color_hex
                            ? { borderColor: opt.color_hex, backgroundColor: `${opt.color_hex}22` }
                            : undefined}
                          title={`${opt.option_name}: ${opt.label || opt.value}`}
                        >
                          {opt.option_type === "color_swatch" && opt.color_hex && (
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block border border-gray-300"
                              style={{ backgroundColor: opt.color_hex }}
                              aria-label={`${opt.label || opt.value} swatch`}
                            />
                          )}
                          <span className="text-gray-400 mr-0.5">{opt.option_name}:</span>
                          {opt.label || opt.value}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editRow.sku ?? ""}
                        onChange={(e) => setEditRow({ ...editRow, sku: e.target.value })}
                      />
                    ) : (
                      <span className="font-mono text-xs text-gray-600">{variant.sku}</span>
                    )}
                  </td>

                  {/* Variant image with fallback chain */}
                  <td className="px-3 py-3 text-center">
                    {effectiveImage ? (
                      <img
                        src={effectiveImage}
                        alt={variant.sku}
                        className="inline-block h-9 w-9 rounded object-cover border border-gray-200"
                        title="Variant image (fallback: variant → option value → product thumbnail)"
                      />
                    ) : (
                      <span className="inline-block h-9 w-9 rounded bg-gray-100 border border-gray-200" title="No image" />
                    )}
                  </td>

                  {/* Price */}
                  <td className="px-3 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        className="border rounded px-2 py-1 text-xs w-24 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          className="border rounded px-2 py-1 text-xs w-16 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={editRow.discount ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, discount: e.target.value as unknown as string })}
                        />
                        <select
                          className="border rounded px-1 py-1 text-xs focus:outline-none"
                          value={editRow.discount_type ?? "amount"}
                          onChange={(e) => setEditRow({ ...editRow, discount_type: e.target.value as "amount" | "percent" })}
                        >
                          <option value="amount">৳</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    ) : (
                      <span className="text-gray-500">
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
                        className="border rounded px-2 py-1 text-xs w-16 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${variant.is_active ? "bg-green-500" : "bg-gray-300"}`}
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
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-500 px-2 py-1 rounded border hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => startEdit(variant)} className="text-xs text-blue-600 hover:text-blue-800 px-1">Edit</button>
                        <button onClick={() => deleteVariant(variant.id)} className="text-xs text-red-500 hover:text-red-700 px-1">Del</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-right">{variants.length} variant{variants.length !== 1 ? "s" : ""}</p>
    </div>
  );
}
