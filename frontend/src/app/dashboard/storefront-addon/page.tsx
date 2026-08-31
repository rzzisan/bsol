"use client";

import { useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import PlatformGatewayPaymentPicker from "@/components/platform-gateway-payment-picker";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

/**
 * Storefront add-on purchase — subscription_billing_context.md §9.2-D /
 * §9.6 step 4. Binary unlock (no wallet/balance concept, unlike
 * order-credits) — manual bKash only, same reasoning as
 * StorefrontAddonPurchaseController's docblock.
 */

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    title: "স্টোরফ্রন্ট Add-on",
    subtitle: "আপনার প্যাকেজে স্টোরফ্রন্ট না থাকলে আলাদাভাবে আনলক করুন।",
    includedInPlan: "আপনার প্যাকেজেই স্টোরফ্রন্ট অন্তর্ভুক্ত আছে — কিছু কেনার দরকার নেই।",
    addonActive: "Add-on দিয়ে সক্রিয়",
    addonUntil: "মেয়াদ শেষ",
    notActive: "স্টোরফ্রন্ট এই মুহূর্তে সক্রিয় নয়",
    unlockNow: "আনলক করুন",
    payTitle: "পেমেন্ট করুন",
    payInstructions: "bKash সেন্ড মানি করুন",
    senderNumber: "আপনার bKash নম্বর",
    trxId: "ট্রানজেকশন আইডি (TrxID)",
    screenshot: "স্ক্রিনশট (ঐচ্ছিক)",
    submit: "সাবমিট করুন",
    submitting: "সাবমিট হচ্ছে...",
    cancel: "বাতিল",
    submitted: "সাবমিট হয়েছে, শীঘ্রই রিভিউ করা হবে।",
    historyTitle: "ক্রয়ের ইতিহাস",
    noHistory: "এখনো কোনো ক্রয় নেই।",
    statusPending: "পর্যালোচনাধীন",
    statusApproved: "অনুমোদিত",
    statusRejected: "প্রত্যাখ্যাত",
    genericError: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",
    coTerminousNote: "এই Add-on আপনার মূল সাবস্ক্রিপশনের মেয়াদ অনুযায়ী চলবে — রিনিউ করলে এটাও নবায়ন হবে (যতক্ষণ সক্রিয় থাকে)।",
  },
  en: {
    title: "Storefront Add-on",
    subtitle: "Unlock the storefront separately if your plan doesn't include it.",
    includedInPlan: "Storefront is already included in your plan — nothing to buy.",
    addonActive: "Active via add-on",
    addonUntil: "Valid until",
    notActive: "Storefront is not active right now",
    unlockNow: "Unlock now",
    payTitle: "Make payment",
    payInstructions: "Send money via bKash",
    senderNumber: "Your bKash number",
    trxId: "Transaction ID (TrxID)",
    screenshot: "Screenshot (optional)",
    submit: "Submit",
    submitting: "Submitting...",
    cancel: "Cancel",
    submitted: "Submitted — it will be reviewed shortly.",
    historyTitle: "Purchase history",
    noHistory: "No purchases yet.",
    statusPending: "Pending review",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    genericError: "Something went wrong, please try again.",
    coTerminousNote: "This add-on runs alongside your main subscription — it renews automatically while active whenever your plan renews.",
  },
};

type Status = {
  included_in_plan: boolean;
  addon_active: boolean;
  addon_until: string | null;
  package: { id: number; name: string; price: string } | null;
  payment_instructions: { bkash_number: string | null; bkash_type: string | null };
};
type PurchaseRow = { id: number; amount: string; status: "pending" | "approved" | "rejected"; created_at: string };

export default function StorefrontAddonPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const txt = t[locale];
  const token = getStoredToken();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<PurchaseRow[]>([]);
  const [buying, setBuying] = useState(false);
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const [statusRes, histRes] = await Promise.all([
      fetch(`${API}/storefront-addon/status`, { headers: authHeaders }),
      fetch(`${API}/storefront-addon/purchases`, { headers: authHeaders }),
    ]);
    const [statusJson, histJson] = await Promise.all([statusRes.json(), histRes.json()]);
    if (statusRes.ok) setStatus(statusJson.data);
    if (histRes.ok) setHistory(histJson.data ?? []);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!status?.package || !senderNumber.trim() || !trxId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("addon_package_id", String(status.package.id));
      body.append("sender_bkash_number", senderNumber.trim());
      body.append("trx_id", trxId.trim());
      if (screenshot) body.append("screenshot", screenshot);

      const res = await fetch(`${API}/storefront-addon/purchases`, { method: "POST", headers: authHeaders, body });
      const data = await res.json();
      if (res.ok) {
        setNotice(txt.submitted);
        setBuying(false);
        setSenderNumber("");
        setTrxId("");
        setScreenshot(null);
        void load();
      } else {
        setError(data?.message ?? Object.values(data?.errors ?? {}).flat().join(" ") ?? txt.genericError);
      }
    } catch {
      setError(txt.genericError);
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (s: PurchaseRow["status"]) =>
    s === "approved" ? txt.statusApproved : s === "rejected" ? txt.statusRejected : txt.statusPending;
  const statusColor = (s: PurchaseRow["status"]) =>
    s === "approved" ? "text-emerald-500 bg-emerald-500/10" : s === "rejected" ? "text-red-400 bg-red-500/10" : "text-amber-500 bg-amber-500/10";

  const isUnlocked = status?.included_in_plan || status?.addon_active;

  return (
    <UserShell locale={locale} onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      activeKey="storefront-addon"
      defaultExpandedKey="settings"
      pageTitle={{ bn: t.bn.title, en: t.en.title }}
      pageSubtitle={{ bn: t.bn.subtitle, en: t.en.subtitle }}
    >
      <section className="catv-panel p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 shrink-0 rounded-full ${isUnlocked ? "bg-emerald-500" : "bg-red-400"}`} />
          <p className="text-sm font-semibold">
            {status?.included_in_plan ? txt.includedInPlan : status?.addon_active ? txt.addonActive : txt.notActive}
          </p>
        </div>
        {status?.addon_active && status.addon_until && !status.included_in_plan && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {txt.addonUntil}: {new Date(status.addon_until).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB")}
          </p>
        )}

        {!status?.included_in_plan && status?.package && (
          <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold">{status.package.name}</p>
            <p className="mt-1 text-xl font-bold">৳{status.package.price}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{txt.coTerminousNote}</p>
            <button
              type="button"
              onClick={() => {
                setBuying(true);
                setError(null);
              }}
              className="mt-3 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              {txt.unlockNow}
            </button>
          </div>
        )}
      </section>

      {buying && status?.package && (
        <section className="catv-panel mt-4 p-4 sm:p-5">
          <h3 className="text-base font-semibold">{txt.payTitle} — {status.package.name} (৳{status.package.price})</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {txt.payInstructions}: <span className="font-semibold text-[var(--foreground)]">{status.payment_instructions.bkash_number ?? "—"}</span>
            {status.payment_instructions.bkash_type ? ` (${status.payment_instructions.bkash_type})` : ""}
          </p>

          <PlatformGatewayPaymentPicker
            purpose="storefront_addon"
            payload={{ addon_package_id: status.package.id }}
            locale={locale}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{txt.senderNumber}</label>
              <input
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{txt.trxId}</label>
              <input
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{txt.screenshot}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
            </div>
          </div>

          {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy || !senderNumber.trim() || !trxId.trim()}
              onClick={() => void submit()}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? txt.submitting : txt.submit}
            </button>
            <button
              type="button"
              onClick={() => setBuying(false)}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]"
            >
              {txt.cancel}
            </button>
          </div>
        </section>
      )}

      {notice && <p className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">{notice}</p>}

      <section className="catv-panel mt-4 p-4 sm:p-5">
        <h3 className="text-base font-semibold">{txt.historyTitle}</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{txt.noHistory}</p>
        ) : (
          <div className="mt-3 divide-y divide-[var(--border)]">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-3">
                <p className="text-xs text-[var(--muted)]">{new Date(h.created_at).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB")}</p>
                <div className="text-right">
                  <p className="text-sm font-bold">৳{h.amount}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(h.status)}`}>
                    {statusLabel(h.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </UserShell>
  );
}
