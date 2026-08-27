"use client";

import Link from "next/link";
import { useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

/**
 * Bulk/CSV order import — feature_roadmap_context.md "Bulk/CSV order
 * import" (§16.8). Preview-then-commit: the same file is uploaded twice
 * (stateless on the backend, OrderBulkImportService's docblock) — nothing
 * is created until the seller explicitly confirms the preview.
 */

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    title: "বাল্ক অর্ডার ইমপোর্ট (CSV)",
    subtitle: "একটা CSV ফাইল থেকে একসাথে অনেক অর্ডার তৈরি করুন।",
    template: "টেমপ্লেট ডাউনলোড করুন",
    templateHint: "প্রতিটা সারি = একটা অর্ডার = একটা পণ্য। কলাম হেডার অবশ্যই টেমপ্লেটের মতো হতে হবে।",
    choose: "CSV ফাইল বাছাই করুন",
    preview: "প্রিভিউ দেখুন",
    previewing: "যাচাই করা হচ্ছে...",
    previewTitle: "প্রিভিউ ফলাফল",
    totalRows: "মোট সারি",
    validRows: "সঠিক",
    invalidRows: "ভুল",
    rowNumber: "সারি",
    errors: "সমস্যা",
    confirm: "নিশ্চিত করুন — অর্ডার তৈরি করুন",
    committing: "অর্ডার তৈরি হচ্ছে...",
    startOver: "আবার শুরু করুন",
    resultTitle: "ইমপোর্ট সম্পন্ন",
    created: "টা অর্ডার তৈরি হয়েছে",
    skippedInvalid: "টা ভুল থাকায় তৈরি হয়নি",
    viewOrders: "অর্ডার লিস্টে যান",
    noValidRows: "কোনো সঠিক সারি নেই, তৈরি করার কিছু নেই।",
    genericError: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",
  },
  en: {
    title: "Bulk Order Import (CSV)",
    subtitle: "Create many orders at once from a CSV file.",
    template: "Download template",
    templateHint: "Each row = one order = one product. Column headers must match the template.",
    choose: "Choose CSV file",
    preview: "Preview",
    previewing: "Checking...",
    previewTitle: "Preview results",
    totalRows: "Total rows",
    validRows: "Valid",
    invalidRows: "Invalid",
    rowNumber: "Row",
    errors: "Errors",
    confirm: "Confirm — create orders",
    committing: "Creating orders...",
    startOver: "Start over",
    resultTitle: "Import complete",
    created: "order(s) created",
    skippedInvalid: "skipped due to errors",
    viewOrders: "Go to Orders list",
    noValidRows: "No valid rows — nothing to create.",
    genericError: "Something went wrong, please try again.",
  },
};

type PreviewRow = { row_number: number; data: Record<string, string | null>; errors: string[] };
type PreviewResult = { total_rows: number; valid_count: number; invalid_count: number; rows: PreviewRow[] };
type CommitResult = { created_count: number; skipped: { row_number: number; errors: string[] }[] };

export default function BulkImportOrdersPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const txt = t[locale];
  const token = getStoredToken();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);

  const downloadTemplate = async () => {
    // A plain <a href> would navigate without the Authorization header
    // (browsers don't attach it to normal navigation) and this endpoint
    // sits behind auth:sanctum + staff_permission:orders — same
    // fetch+blob pattern as abandoned-checkouts' CSV export.
    const res = await fetch(`${API}/orders/bulk-import/template`, { headers: authHeaders });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bsol-order-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runPreview = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API}/orders/bulk-import/preview`, { method: "POST", headers: authHeaders, body });
      const data = await res.json();
      if (res.ok) {
        setPreview(data.data);
      } else {
        setError(data?.message ?? txt.genericError);
      }
    } catch {
      setError(txt.genericError);
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API}/orders/bulk-import/commit`, { method: "POST", headers: authHeaders, body });
      const data = await res.json();
      if (res.ok) {
        setResult(data.data);
      } else {
        setError(data?.message ?? txt.genericError);
      }
    } catch {
      setError(txt.genericError);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <UserShell locale={locale} onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      activeKey="bulk-import-orders"
      defaultExpandedKey="orders"
      pageTitle={{ bn: t.bn.title, en: t.en.title }}
      pageSubtitle={{ bn: t.bn.subtitle, en: t.en.subtitle }}
    >
      <section className="catv-panel p-4 sm:p-5">
        <button
          type="button"
          onClick={() => void downloadTemplate()}
          className="inline-block rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]"
        >
          ⬇ {txt.template}
        </button>
        <p className="mt-2 text-xs text-[var(--muted)]">{txt.templateHint}</p>

        {!result && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              {file ? file.name : txt.choose}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setError(null);
                }}
              />
            </label>
            {!preview && (
              <button
                type="button"
                disabled={!file || busy}
                onClick={() => void runPreview()}
                className="rounded-xl border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
              >
                {busy ? txt.previewing : txt.preview}
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      </section>

      {preview && !result && (
        <section className="catv-panel mt-4 p-4 sm:p-5">
          <h3 className="text-base font-semibold">{txt.previewTitle}</h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[var(--surface-soft)] p-3">
              <p className="text-xl font-bold">{preview.total_rows}</p>
              <p className="text-xs text-[var(--muted)]">{txt.totalRows}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <p className="text-xl font-bold text-emerald-500">{preview.valid_count}</p>
              <p className="text-xs text-[var(--muted)]">{txt.validRows}</p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-3">
              <p className="text-xl font-bold text-red-400">{preview.invalid_count}</p>
              <p className="text-xs text-[var(--muted)]">{txt.invalidRows}</p>
            </div>
          </div>

          {preview.invalid_count > 0 && (
            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--surface-soft)]">
                  <tr className="text-left">
                    <th className="px-3 py-2">{txt.rowNumber}</th>
                    <th className="px-3 py-2">{txt.errors}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.filter((r) => r.errors.length > 0).map((r) => (
                    <tr key={r.row_number} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 font-mono">{r.row_number}</td>
                      <td className="px-3 py-2 text-red-400">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={reset} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]">
              {txt.startOver}
            </button>
            {preview.valid_count > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runCommit()}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? txt.committing : `${txt.confirm} (${preview.valid_count})`}
              </button>
            ) : (
              <p className="self-center text-sm text-[var(--muted)]">{txt.noValidRows}</p>
            )}
          </div>
        </section>
      )}

      {result && (
        <section className="catv-panel mt-4 p-4 sm:p-5">
          <h3 className="text-base font-semibold">🎉 {txt.resultTitle}</h3>
          <p className="mt-2 text-sm">
            <span className="font-bold text-emerald-500">{result.created_count}</span> {txt.created}
          </p>
          {result.skipped.length > 0 && (
            <p className="mt-1 text-sm text-red-400">{result.skipped.length} {txt.skippedInvalid}</p>
          )}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={reset} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]">
              {txt.startOver}
            </button>
            <Link href="/dashboard/orders" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              {txt.viewOrders}
            </Link>
          </div>
        </section>
      )}
    </UserShell>
  );
}
