"use client";

import { useEffect, useState } from "react";
import type { ProductOption, ProductVariant } from "@/types/variant";

interface Props {
  productId: number;
  productName: string;
  token: string | null;
  apiBase: string;
  onSelect: (variant: ProductVariant) => void;
  onClose: () => void;
}

export default function VariantPickerModal({ productId, productName, token, apiBase, onSelect, onClose }: Props) {
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
          setResolveError(json.message ?? "No matching variant found for this combination.");
        }
      })
      .catch(() => setResolveError("Network error resolving variant."))
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
          <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title={`Select variant — ${productName}`} onClose={onClose}>
      <div className="space-y-5 p-1">
        {options.map((option) => (
          <div key={option.id}>
            <p className="text-sm font-semibold text-gray-700 mb-2">
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
                      className={`w-9 h-9 rounded-full border-2 transition-all ${isChosen ? "border-blue-600 scale-110 shadow-md" : "border-gray-300 hover:border-gray-500"}`}
                      style={{ backgroundColor: val.color_hex ?? "#ccc" }}
                    />
                  );
                }
                return (
                  <button
                    key={val.id}
                    onClick={() => selectValue(option.id, val.id)}
                    className={`px-4 py-2 text-sm rounded-lg border-2 transition-all font-medium ${isChosen ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-400 text-gray-700"}`}
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
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Finding matching variant…
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
              <span className="text-sm font-semibold text-green-800">Variant Found ✓</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${resolvedVariant.stock_qty > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                {resolvedVariant.stock_qty > 0 ? `${resolvedVariant.stock_qty} in stock` : "Out of stock"}
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p><span className="font-medium">SKU:</span> <span className="font-mono">{resolvedVariant.sku}</span></p>
              <p>
                <span className="font-medium">Price:</span>{" "}
                {parseFloat(resolvedVariant.discount) > 0 && (
                  <span className="line-through text-gray-400 mr-1">৳{parseFloat(resolvedVariant.regular_price).toLocaleString()}</span>
                )}
                <span className="text-green-700 font-semibold text-sm">৳{parseFloat(resolvedVariant.selling_price).toLocaleString()}</span>
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => resolvedVariant && onSelect(resolvedVariant)}
            disabled={!allOptionsSelected || !resolvedVariant || resolving || resolvedVariant.stock_qty === 0}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resolvedVariant?.stock_qty === 0 ? "Out of Stock" : "Add to Order"}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800 truncate pr-4">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
