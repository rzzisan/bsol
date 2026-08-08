"use client";

import { useEffect, useState } from "react";
import type { ProductOption, ProductVariant, GenerateVariantsPayload } from "@/types/variant";
import OptionEditor from "@/components/products/option-editor";
import VariantTable from "@/components/products/variant-table";
import type { Locale } from "@/lib/dashboard-client";

interface Props {
  productId: number;
  productName: string;
  productThumbnail?: string | null;
  defaultPrice?: number;
  token: string | null;
  apiBase: string;
  locale: Locale;
}

const text = {
  bn: {
    loading: "ভেরিয়েন্ট লোড হচ্ছে…",
    loadFailed: "ভেরিয়েন্ট ডেটা লোড করা যায়নি।",
    generateHeading: "ভেরিয়েন্ট জেনারেট করুন",
    combinations: (n: number) => `বর্তমান অপশন থেকে ${n}টি কম্বিনেশন সম্ভব`,
    exceedsLimit: "(১০০ লিমিট ছাড়িয়ে গেছে — কিছু ভ্যালু সরান)",
    generateAll: "⚡ সব জেনারেট করুন",
    skuPrefix: "SKU প্রিফিক্স",
    optional: "(ঐচ্ছিক)",
    defaultPrice: "ডিফল্ট দাম *",
    defaultDiscount: "ডিফল্ট ছাড়",
    defaultStock: "ডিফল্ট স্টক",
    generating: "জেনারেট হচ্ছে…",
    generateN: (n: number) => `${n}টি ভেরিয়েন্ট জেনারেট করুন`,
    cancel: "বাতিল",
    genResult: (created: number, skipped: number) =>
      `✓ ${created}টি ভেরিয়েন্ট তৈরি হয়েছে${skipped > 0 ? `, ${skipped}টি বাদ পড়েছে (ডুপ্লিকেট SKU)` : ""}।`,
    generateFailed: (status: number) => `জেনারেট ব্যর্থ (HTTP ${status})`,
    networkErrorGenerate: "ভেরিয়েন্ট জেনারেট করতে নেটওয়ার্ক সমস্যা হয়েছে।",
    variantsHeading: "ভেরিয়েন্ট",
    addManually: "+ ম্যানুয়ালি যোগ করুন",
    skuLabel: "SKU *",
    skuPlaceholder: "যেমন: SHIRT-RED-M",
    regularPrice: "নিয়মিত দাম *",
    discount: "ছাড়",
    stock: "স্টক",
    saving: "সেভ হচ্ছে…",
    addVariant: "ভেরিয়েন্ট যোগ করুন",
    saveFailed: (status: number) => `সেভ ব্যর্থ (HTTP ${status})`,
    saveFailedInvalid: "সেভ ব্যর্থ: রেসপন্স সঠিক নয়",
  },
  en: {
    loading: "Loading variants…",
    loadFailed: "Failed to load variant data.",
    generateHeading: "Generate Variants",
    combinations: (n: number) => `${n} combination${n !== 1 ? "s" : ""} possible from current options`,
    exceedsLimit: "(exceeds 100 limit — remove some values)",
    generateAll: "⚡ Generate All",
    skuPrefix: "SKU Prefix",
    optional: "(optional)",
    defaultPrice: "Default Price *",
    defaultDiscount: "Default Discount",
    defaultStock: "Default Stock",
    generating: "Generating…",
    generateN: (n: number) => `Generate ${n} Variant${n !== 1 ? "s" : ""}`,
    cancel: "Cancel",
    genResult: (created: number, skipped: number) =>
      `✓ ${created} variants created${skipped > 0 ? `, ${skipped} skipped (duplicate SKU)` : ""}.`,
    generateFailed: (status: number) => `Generate failed (HTTP ${status})`,
    networkErrorGenerate: "Network error generating variants.",
    variantsHeading: "Variants",
    addManually: "+ Add Manually",
    skuLabel: "SKU *",
    skuPlaceholder: "e.g. SHIRT-RED-M",
    regularPrice: "Regular Price *",
    discount: "Discount",
    stock: "Stock",
    saving: "Saving…",
    addVariant: "Add Variant",
    saveFailed: (status: number) => `Save failed (HTTP ${status})`,
    saveFailedInvalid: "Save failed: invalid response",
  },
};

export default function VariantsTab({ productId, productName, productThumbnail = null, defaultPrice = 0, token, apiBase, locale }: Props) {
  const t = text[locale];
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
        setError(t.loadFailed);
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
        setError(json.message ?? t.generateFailed(res.status));
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
      setError(err instanceof Error ? err.message : t.networkErrorGenerate);
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
    if (!res.ok) { alert(json.message ?? t.saveFailed(res.status)); return; }
    const createdVariant = json.data;
    if (!createdVariant) { alert(t.saveFailedInvalid); return; }
    setVariants((prev) => [...prev, createdVariant]);
    setAddingManual(false);
    setManualRow({ sku: "", regular_price: defaultPrice, discount: 0, discount_type: "amount", stock_qty: 0 });
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--muted)] mt-2">{t.loading}</p>
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
        locale={locale}
      />

      {/* ── Generate combinations ─────────────────────────────────────── */}
      {hasOptions && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{t.generateHeading}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {t.combinations(totalCombinations)}
                {totalCombinations > 100 && (
                  <span className="ml-1 text-red-500 font-medium">{t.exceedsLimit}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowGenerate(!showGenerate)}
              disabled={totalCombinations > 100}
              className="text-sm bg-[var(--accent)] text-white px-4 py-2 rounded hover:opacity-90 disabled:opacity-40"
            >
              {t.generateAll}
            </button>
          </div>

          {showGenerate && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">{t.skuPrefix} <span className="text-[var(--muted)]">{t.optional}</span></label>
                <input
                  className="w-full border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                  placeholder={productName.toUpperCase().replace(/\s+/g, "-").slice(0, 20)}
                  value={genPayload.sku_prefix}
                  onChange={(e) => setGenPayload({ ...genPayload, sku_prefix: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">{t.defaultPrice}</label>
                <input
                  type="number"
                  className="w-full border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                  value={genPayload.default_price}
                  onChange={(e) => setGenPayload({ ...genPayload, default_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">{t.defaultDiscount}</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    className="flex-1 border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                    value={genPayload.default_discount}
                    onChange={(e) => setGenPayload({ ...genPayload, default_discount: parseFloat(e.target.value) || 0 })}
                  />
                  <select
                    className="border border-[var(--border)] bg-[var(--background)] rounded px-2 py-2 text-sm focus:outline-none"
                    value={genPayload.discount_type}
                    onChange={(e) => setGenPayload({ ...genPayload, discount_type: e.target.value as "amount" | "percent" })}
                  >
                    <option value="amount">৳</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">{t.defaultStock}</label>
                <input
                  type="number"
                  className="w-full border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                  value={genPayload.default_stock}
                  onChange={(e) => setGenPayload({ ...genPayload, default_stock: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2 flex gap-2">
                <button
                  onClick={generateVariants}
                  disabled={generating}
                  className="bg-[var(--accent)] text-white text-sm px-5 py-2 rounded hover:opacity-90 disabled:opacity-50"
                >
                  {generating ? t.generating : t.generateN(totalCombinations)}
                </button>
                <button
                  onClick={() => setShowGenerate(false)}
                  className="text-sm text-[var(--muted)] px-4 py-2 rounded border border-[var(--border)] hover:bg-[var(--surface)]"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}

          {genResult && (
            <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">
              {t.genResult(genResult.created, genResult.skipped)}
            </p>
          )}
        </div>
      )}

      {/* ── Variant table ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {t.variantsHeading}
            {variants.length > 0 && (
              <span className="ml-2 text-xs bg-[var(--surface-soft)] text-[var(--muted)] px-2 py-0.5 rounded-full">{variants.length}</span>
            )}
          </h3>
          <button
            onClick={() => setAddingManual(!addingManual)}
            className="text-xs border border-[var(--border)] text-[var(--foreground)] px-3 py-1.5 rounded hover:bg-[var(--surface-soft)]"
          >
            {t.addManually}
          </button>
        </div>

        {/* Manual add form */}
        {addingManual && (
          <div className="border border-dashed border-[var(--border)] rounded-lg p-4 mb-4 bg-[var(--surface-soft)] grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">{t.skuLabel}</label>
              <input
                className="w-full border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                placeholder={t.skuPlaceholder}
                value={manualRow.sku}
                onChange={(e) => setManualRow({ ...manualRow, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">{t.regularPrice}</label>
              <input
                type="number"
                className="w-full border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                value={manualRow.regular_price}
                onChange={(e) => setManualRow({ ...manualRow, regular_price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">{t.discount}</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  className="flex-1 border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                  value={manualRow.discount}
                  onChange={(e) => setManualRow({ ...manualRow, discount: parseFloat(e.target.value) || 0 })}
                />
                <select
                  className="border border-[var(--border)] bg-[var(--background)] rounded px-2 py-2 text-sm"
                  value={manualRow.discount_type}
                  onChange={(e) => setManualRow({ ...manualRow, discount_type: e.target.value })}
                >
                  <option value="amount">৳</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">{t.stock}</label>
              <input
                type="number"
                className="w-full border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                value={manualRow.stock_qty}
                onChange={(e) => setManualRow({ ...manualRow, stock_qty: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                onClick={saveManual}
                disabled={manualSaving || !manualRow.sku.trim()}
                className="bg-[var(--accent)] text-white text-sm px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
              >
                {manualSaving ? t.saving : t.addVariant}
              </button>
              <button onClick={() => setAddingManual(false)} className="text-sm text-[var(--muted)] px-4 py-2 rounded border border-[var(--border)] hover:bg-[var(--surface)]">{t.cancel}</button>
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
          locale={locale}
        />
      </div>
    </div>
  );
}
