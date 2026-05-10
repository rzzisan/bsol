"use client";

import { useEffect, useState } from "react";
import type { ProductOption, ProductVariant, GenerateVariantsPayload } from "@/types/variant";
import OptionEditor from "@/components/products/option-editor";
import VariantTable from "@/components/products/variant-table";

interface Props {
  productId: number;
  productName: string;
  productThumbnail?: string | null;
  defaultPrice?: number;
  token: string | null;
  apiBase: string;
}

export default function VariantsTab({ productId, productName, productThumbnail = null, defaultPrice = 0, token, apiBase }: Props) {
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genPayload, setGenPayload] = useState<GenerateVariantsPayload>({
    sku_prefix: "",
    default_price: defaultPrice,
    default_discount: 0,
    discount_type: "amount",
    default_cost: 0,
    default_stock: 0,
  });
  const [genResult, setGenResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [manualRow, setManualRow] = useState({ sku: "", regular_price: defaultPrice, discount: 0, discount_type: "amount", stock_qty: 0 });
  const [manualSaving, setManualSaving] = useState(false);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [optRes, varRes] = await Promise.all([
          fetch(`${apiBase}/products/${productId}/options`, { headers }),
          fetch(`${apiBase}/products/${productId}/variants`, { headers }),
        ]);
        const [optJson, varJson] = await Promise.all([optRes.json(), varRes.json()]);
        setOptions(optJson.data ?? []);
        setVariants(varJson.data ?? []);
      } catch {
        setError("Failed to load variant data.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const totalCombinations = options.reduce((acc, opt) => acc * Math.max(1, opt.values.length), 1);
  const hasOptions = options.length > 0 && options.some((o) => o.values.length > 0);

  async function generateVariants() {
    setGenerating(true);
    setGenResult(null);
    setError("");
    try {
      const res = await fetch(`${apiBase}/products/${productId}/variants/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify(genPayload),
      });
      const raw = await res.text();
      let json: { message?: string; data?: { created: number; skipped: number } } = {};
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        setError(json.message ?? `Generate failed (HTTP ${res.status})`);
        return;
      }

      setGenResult(json.data ?? null);
      // Refresh variants
      const varRes = await fetch(`${apiBase}/products/${productId}/variants`, { headers });
      const varRaw = await varRes.text();
      let varJson: { data?: ProductVariant[] } = {};
      try {
        varJson = varRaw ? (JSON.parse(varRaw) as typeof varJson) : {};
      } catch {
        varJson = {};
      }
      setVariants(varJson.data ?? []);
      setShowGenerate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error generating variants.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveManual() {
    setManualSaving(true);
    const res = await fetch(`${apiBase}/products/${productId}/variants`, {
      method: "POST",
      headers,
      body: JSON.stringify(manualRow),
    });
    const raw = await res.text();
    let json: { message?: string; data?: ProductVariant } = {};
    try {
      json = raw ? (JSON.parse(raw) as typeof json) : {};
    } catch {
      json = {};
    }
    setManualSaving(false);
    if (!res.ok) { alert(json.message ?? `Save failed (HTTP ${res.status})`); return; }
    const createdVariant = json.data;
    if (!createdVariant) { alert("Save failed: invalid response"); return; }
    setVariants((prev) => [...prev, createdVariant]);
    setAddingManual(false);
    setManualRow({ sku: "", regular_price: defaultPrice, discount: 0, discount_type: "amount", stock_qty: 0 });
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 mt-2">Loading variants…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>
      )}

      {/* ── Options editor ───────────────────────────────────────────── */}
      <OptionEditor
        productId={productId}
        options={options}
        token={token}
        apiBase={apiBase}
        onOptionsChange={setOptions}
      />

      {/* ── Generate combinations ─────────────────────────────────────── */}
      {hasOptions && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Generate Variants</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {totalCombinations} combination{totalCombinations !== 1 ? "s" : ""} possible from current options
                {totalCombinations > 100 && (
                  <span className="ml-1 text-red-500 font-medium">(exceeds 100 limit — remove some values)</span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowGenerate(!showGenerate)}
              disabled={totalCombinations > 100}
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-40"
            >
              ⚡ Generate All
            </button>
          </div>

          {showGenerate && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-200 pt-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">SKU Prefix <span className="text-gray-400">(optional)</span></label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={productName.toUpperCase().replace(/\s+/g, "-").slice(0, 20)}
                  value={genPayload.sku_prefix}
                  onChange={(e) => setGenPayload({ ...genPayload, sku_prefix: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Default Price *</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={genPayload.default_price}
                  onChange={(e) => setGenPayload({ ...genPayload, default_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Default Discount</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={genPayload.default_discount}
                    onChange={(e) => setGenPayload({ ...genPayload, default_discount: parseFloat(e.target.value) || 0 })}
                  />
                  <select
                    className="border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none"
                    value={genPayload.discount_type}
                    onChange={(e) => setGenPayload({ ...genPayload, discount_type: e.target.value as "amount" | "percent" })}
                  >
                    <option value="amount">৳</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Default Stock</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={genPayload.default_stock}
                  onChange={(e) => setGenPayload({ ...genPayload, default_stock: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2 flex gap-2">
                <button
                  onClick={generateVariants}
                  disabled={generating}
                  className="bg-indigo-600 text-white text-sm px-5 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {generating ? "Generating…" : `Generate ${totalCombinations} Variant${totalCombinations !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={() => setShowGenerate(false)}
                  className="text-sm text-gray-600 px-4 py-2 rounded border hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {genResult && (
            <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">
              ✓ {genResult.created} variants created{genResult.skipped > 0 ? `, ${genResult.skipped} skipped (duplicate SKU)` : ""}.
            </p>
          )}
        </div>
      )}

      {/* ── Variant table ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Variants
            {variants.length > 0 && (
              <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{variants.length}</span>
            )}
          </h3>
          <button
            onClick={() => setAddingManual(!addingManual)}
            className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50"
          >
            + Add Manually
          </button>
        </div>

        {/* Manual add form */}
        {addingManual && (
          <div className="border border-dashed border-gray-300 rounded-lg p-4 mb-4 bg-gray-50 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">SKU *</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. SHIRT-RED-M"
                value={manualRow.sku}
                onChange={(e) => setManualRow({ ...manualRow, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Regular Price *</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={manualRow.regular_price}
                onChange={(e) => setManualRow({ ...manualRow, regular_price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Discount</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={manualRow.discount}
                  onChange={(e) => setManualRow({ ...manualRow, discount: parseFloat(e.target.value) || 0 })}
                />
                <select
                  className="border border-gray-300 rounded px-2 py-2 text-sm"
                  value={manualRow.discount_type}
                  onChange={(e) => setManualRow({ ...manualRow, discount_type: e.target.value })}
                >
                  <option value="amount">৳</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Stock</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={manualRow.stock_qty}
                onChange={(e) => setManualRow({ ...manualRow, stock_qty: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                onClick={saveManual}
                disabled={manualSaving || !manualRow.sku.trim()}
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {manualSaving ? "Saving…" : "Add Variant"}
              </button>
              <button onClick={() => setAddingManual(false)} className="text-sm text-gray-600 px-4 py-2 rounded border hover:bg-gray-100">Cancel</button>
            </div>
          </div>
        )}

        <VariantTable
          variants={variants}
          token={token}
          apiBase={apiBase}
          productId={productId}
          productThumbnail={productThumbnail}
          onVariantsChange={setVariants}
        />
      </div>
    </div>
  );
}
