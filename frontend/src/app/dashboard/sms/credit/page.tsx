"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Wallet,
  XCircle,
} from "lucide-react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, openAuthenticatedPdf, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

// bKash classic Checkout API ("PGW") widget — same contract as the
// subscription page's widget integration, see SAAS_MODULE_CONTEXT.md §18.
declare global {
  interface Window {
    bKash?: {
      init: (config: Record<string, unknown>) => void;
      create: () => { onSuccess: (data: unknown) => void; onError: () => void };
      execute: () => { onSuccess: (data: unknown) => void; onError: () => void };
    };
  }
}

interface RateInfo {
  rate_per_credit: number;
  currency: string;
  balance: number;
  bkash_gateway_enabled: boolean;
  bkash_api_type: "tokenized" | "pgw";
  bkash_pgw_script_url: string;
  payment_instructions: { bkash_number: string | null; bkash_type: string | null };
}

interface Purchase {
  id: number;
  credits: number;
  rate_used: string;
  amount: string;
  status: "pending" | "approved" | "rejected";
  trx_id: string | null;
  created_at: string;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];
const MIN_CREDITS = 100;

const text = {
  bn: {
    title: "SMS ক্রেডিট কিনুন",
    subtitle: "SMS পাঠানোর জন্য ক্রেডিট কিনুন — bKash দিয়ে সাথে সাথে অথবা ম্যানুয়ালি।",
    balance: "বর্তমান ব্যালেন্স",
    credits: "ক্রেডিট",
    quickPick: "ক্রেডিট পরিমাণ বাছাই করুন",
    customAmount: "অথবা পরিমাণ লিখুন",
    minCredits: (n: number) => `সর্বনিম্ন ${n} ক্রেডিট`,
    rate: "প্রতি ক্রেডিট",
    totalPrice: "মোট মূল্য",
    payTitle: "বিল পেমেন্ট",
    payWithBkash: "bKash দিয়ে সাথে সাথে পে করুন",
    payingWithBkash: "bKash-এ পাঠানো হচ্ছে...",
    pgwLoading: "bKash পেমেন্ট লোড হচ্ছে...",
    pgwSelectAmount: "উপরে ক্রেডিট পরিমাণ দিলে bKash বাটন সক্রিয় হবে।",
    showManual: "ম্যানুয়ালি পেমেন্ট করুন",
    hideManual: "ম্যানুয়াল অপশন লুকান",
    bkashSuccess: "পেমেন্ট সফল হয়েছে — ক্রেডিট যোগ হয়ে গেছে।",
    bkashFailed: "পেমেন্ট সম্পন্ন হয়নি। আবার চেষ্টা করুন অথবা নিচের ম্যানুয়াল অপশন ব্যবহার করুন।",
    bkashCancelled: "পেমেন্ট বাতিল করা হয়েছে।",
    bkashError: "কিছু একটা সমস্যা হয়েছে।",
    enterAmountFirst: "আগে ক্রেডিট পরিমাণ লিখুন।",
    payInstructionsTitle: "bKash-এ পেমেন্ট পাঠান",
    payInstructions: (num: string, type: string) =>
      `নিচের bKash নম্বরে (${type}) টাকা Send Money করুন: ${num}। তারপর TrxID ও bKash নম্বর দিয়ে ফর্মটি জমা দিন — আমরা যাচাই করে ক্রেডিট যোগ করে দেব।`,
    noBkashConfigured: "পেমেন্ট নম্বর এখনো সেট করা হয়নি। সাপোর্টের সাথে যোগাযোগ করুন।",
    senderNumber: "আপনার bKash নম্বর",
    trxId: "TrxID",
    screenshot: "স্ক্রিনশট (ঐচ্ছিক)",
    submit: "পেমেন্ট সাবমিট করুন",
    submitting: "সাবমিট হচ্ছে...",
    submitted: "পেমেন্ট সাবমিট হয়েছে। যাচাই হলে ক্রেডিট যোগ হবে।",
    history: "ইনভয়েস ও কেনাকাটার ইতিহাস",
    noHistory: "কোনো ক্রয় পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    downloadInvoice: "ইনভয়েস ডাউনলোড",
    downloadFailed: "ইনভয়েস ডাউনলোড ব্যর্থ হয়েছে।",
    paymentStatus: { pending: "পেন্ডিং", approved: "পরিশোধিত", rejected: "বাতিল" } as Record<string, string>,
  },
  en: {
    title: "Buy SMS Credit",
    subtitle: "Buy credit to send SMS — pay instantly with bKash or send manually.",
    balance: "Current Balance",
    credits: "credits",
    quickPick: "Choose a Credit Amount",
    customAmount: "Or enter an amount",
    minCredits: (n: number) => `Minimum ${n} credits`,
    rate: "Rate per credit",
    totalPrice: "Total Price",
    payTitle: "Bill Payment",
    payWithBkash: "Pay Instantly with bKash",
    payingWithBkash: "Redirecting to bKash...",
    pgwLoading: "Loading bKash payment...",
    pgwSelectAmount: "Enter a credit amount above to activate the bKash button.",
    showManual: "Pay manually instead",
    hideManual: "Hide manual option",
    bkashSuccess: "Payment successful — credits have been added.",
    bkashFailed: "Payment did not complete. Please try again or use the manual option below.",
    bkashCancelled: "Payment was cancelled.",
    bkashError: "Something went wrong.",
    enterAmountFirst: "Enter a credit amount first.",
    payInstructionsTitle: "Send Payment via bKash",
    payInstructions: (num: string, type: string) =>
      `Send Money to this bKash number (${type}): ${num}. Then submit the form below with your TrxID and bKash number — we'll verify and add your credits.`,
    noBkashConfigured: "Payment number not configured yet. Please contact support.",
    senderNumber: "Your bKash Number",
    trxId: "TrxID",
    screenshot: "Screenshot (optional)",
    submit: "Submit Payment",
    submitting: "Submitting...",
    submitted: "Payment submitted. Credits will be added once verified.",
    history: "Invoices & Purchase History",
    noHistory: "No purchases found.",
    loading: "Loading...",
    error: "Request failed.",
    downloadInvoice: "Download invoice",
    downloadFailed: "Could not download the invoice.",
    paymentStatus: { pending: "Pending", approved: "Paid", rejected: "Rejected" } as Record<string, string>,
  },
};

function StatusPill({ status, label }: { status: "pending" | "approved" | "rejected"; label: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "rejected"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <Icon size={12} /> {label}
    </span>
  );
}

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [rateInfo, setRateInfo] = useState<RateInfo | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creditsInput, setCreditsInput] = useState("");
  const [form, setForm] = useState({ sender_bkash_number: "", trx_id: "" });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [bkashPaying, setBkashPaying] = useState(false);
  const [pgwScriptLoaded, setPgwScriptLoaded] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const credits = Math.max(0, parseInt(creditsInput || "0", 10) || 0);
  const isValidAmount = credits >= MIN_CREDITS;
  const totalPrice = rateInfo ? Math.round(credits * rateInfo.rate_per_credit * 100) / 100 : 0;

  const load = async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
      const [rateRes, purchasesRes] = await Promise.all([
        fetch(`${API}/sms/credit/rate`, { headers }),
        fetch(`${API}/sms/credit/purchases`, { headers }),
      ]);
      const rateData = await rateRes.json();
      const purchasesData = await purchasesRes.json();

      if (!rateRes.ok || !purchasesRes.ok) {
        setError(rateData?.message ?? purchasesData?.message ?? t.error);
        return;
      }

      setRateInfo(rateData?.data as RateInfo);
      setPurchases((purchasesData?.data ?? []) as Purchase[]);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Returning from the bKash gateway redirect — see SmsCreditBkashPaymentController::callback().
  useEffect(() => {
    const bkashStatus = new URLSearchParams(window.location.search).get("bkash_status");
    if (!bkashStatus) return;

    if (bkashStatus === "success") setSuccess(t.bkashSuccess);
    else if (bkashStatus === "cancelled") setError(t.bkashCancelled);
    else setError(t.bkashFailed);

    window.history.replaceState(null, "", window.location.pathname);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load bKash's classic Checkout widget script when the platform is set to
  // the PGW api type — mirrors the subscription page, see SAAS_MODULE_CONTEXT.md §18.
  useEffect(() => {
    if (rateInfo?.bkash_api_type !== "pgw" || !rateInfo.bkash_pgw_script_url) return;

    const existing = document.getElementById("bkash-pgw-script") as HTMLScriptElement | null;
    if (existing) {
      if (window.bKash) setPgwScriptLoaded(true);
      else existing.addEventListener("load", () => setPgwScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "bkash-pgw-script";
    script.src = rateInfo.bkash_pgw_script_url;
    script.async = true;
    script.onload = () => setPgwScriptLoaded(true);
    script.onerror = () => setError(t.bkashError);
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateInfo?.bkash_api_type, rateInfo?.bkash_pgw_script_url]);

  // (Re-)initialize the bKash widget into #bKash_button whenever the script
  // is ready or the credit amount changes.
  useEffect(() => {
    if (!pgwScriptLoaded || rateInfo?.bkash_api_type !== "pgw" || !isValidAmount || !window.bKash) return;

    const amount = totalPrice.toFixed(2);
    const creditsToBuy = credits;
    let currentPaymentId: string | null = null;

    const bkashConfig = {
      paymentMode: "checkout",
      paymentRequest: { amount, intent: "sale", currency: "BDT" },

      createRequest: () => {
        const token = getStoredToken();
        fetch(`${API}/sms/credit/pay/bkash-pgw/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ credits: creditsToBuy }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.paymentID) {
              currentPaymentId = data.paymentID as string;
              window.bKash?.create().onSuccess(data);
            } else {
              window.bKash?.create().onError();
              setError((data?.message as string) ?? t.bkashError);
            }
          })
          .catch(() => {
            window.bKash?.create().onError();
            setError(t.bkashError);
          });
      },

      executeRequestOnAuthorization: () => {
        const token = getStoredToken();
        fetch(`${API}/sms/credit/pay/bkash-pgw/execute/${currentPaymentId}`, {
          method: "POST",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.paymentID) {
              setSuccess(t.bkashSuccess);
              setError(null);
              void load();
            } else {
              window.bKash?.execute().onError();
              setError((data?.message as string) ?? t.bkashFailed);
            }
          })
          .catch(() => {
            window.bKash?.execute().onError();
            setError(t.bkashFailed);
          });
      },

      onClose: () => {
        // Seller closed the bKash popup without paying — no-op, they can retry.
      },
    };

    try {
      window.bKash.init(bkashConfig);
    } catch (e) {
      console.error("bKash PGW widget: init() threw", e);
      setError(`bKash widget init failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pgwScriptLoaded, rateInfo?.bkash_api_type, credits, isValidAmount]);

  const payWithBkash = async () => {
    const token = getStoredToken();
    if (!token) return;
    if (!isValidAmount) {
      setError(t.enterAmountFirst);
      return;
    }

    setBkashPaying(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/sms/credit/pay/bkash/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ credits }),
      });
      const data = await res.json();
      if (!res.ok || !data?.data?.bkash_url) {
        setError(data?.message ?? t.bkashError);
        setBkashPaying(false);
        return;
      }
      window.location.href = data.data.bkash_url;
    } catch {
      setError(t.bkashError);
      setBkashPaying(false);
    }
  };

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !isValidAmount) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append("credits", String(credits));
      body.append("sender_bkash_number", form.sender_bkash_number);
      body.append("trx_id", form.trx_id);
      if (screenshot) body.append("screenshot", screenshot);

      const res = await fetch(`${API}/sms/credit/purchases`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setSuccess(t.submitted);
      setForm({ sender_bkash_number: "", trx_id: "" });
      setScreenshot(null);
      await load();
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  };

  const downloadInvoice = async (purchaseId: number) => {
    setDownloadingId(purchaseId);
    setError(null);
    const result = await openAuthenticatedPdf(`${API}/sms/credit/purchases/${purchaseId}/invoice`);
    if (!result.success) setError(result.message ?? t.downloadFailed);
    setDownloadingId(null);
  };

  const bkashNumber = rateInfo?.payment_instructions?.bkash_number ?? "";
  const bkashType = rateInfo?.payment_instructions?.bkash_type ?? "Personal";
  const manualVisible = showManualForm || !rateInfo?.bkash_gateway_enabled;

  return (
    <UserShell
      activeKey="sms-credit"
      defaultExpandedKey="sms"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      {loading ? (
        <p className="mx-4 text-sm text-[var(--muted)]">{t.loading}</p>
      ) : (
        <>
          {/* Balance hero */}
          <section className="catv-panel mx-4 mb-4 overflow-hidden">
            <div
              className="p-5 sm:p-6"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--surface)) 0%, var(--surface) 65%)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                  <Wallet size={20} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t.balance}</div>
                  <div className="text-2xl font-bold text-[var(--foreground)]">
                    {(rateInfo?.balance ?? 0).toLocaleString()}
                    <span className="ml-1 text-sm font-normal text-[var(--muted)]">{t.credits}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Amount picker */}
          <section className="catv-panel mx-4 mb-4 p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)]">
              <MessageSquare size={15} /> {t.quickPick}
            </h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCreditsInput(String(amt))}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    creditsInput === String(amt)
                      ? "border-[var(--accent)] bg-[var(--surface-soft)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{t.customAmount}</label>
            <input
              type="number"
              min={MIN_CREDITS}
              step={1}
              value={creditsInput}
              onChange={(e) => setCreditsInput(e.target.value)}
              placeholder={t.minCredits(MIN_CREDITS)}
              className="w-full max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            {creditsInput && !isValidAmount ? (
              <p className="mt-1 text-xs text-rose-600">{t.minCredits(MIN_CREDITS)}</p>
            ) : null}

            {rateInfo && isValidAmount ? (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-[var(--muted)]">{t.rate}</span>
                  <span className="font-medium">৳{rateInfo.rate_per_credit}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-[var(--border)] pt-2 text-base font-bold text-[var(--foreground)]">
                  <span>{t.totalPrice}</span>
                  <span>৳{totalPrice.toLocaleString()}</span>
                </div>
              </div>
            ) : null}
          </section>

          {/* Bill payment */}
          <section className="catv-panel mx-4 mb-4 p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)]">
              <CreditCard size={15} /> {t.payTitle}
            </h3>

            {rateInfo?.bkash_gateway_enabled && rateInfo.bkash_api_type === "pgw" && (
              <div className="mb-3">
                {!isValidAmount ? (
                  <p className="mb-2 text-xs text-[var(--muted)]">{t.pgwSelectAmount}</p>
                ) : !pgwScriptLoaded ? (
                  <p className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <Loader2 size={13} className="animate-spin" /> {t.pgwLoading}
                  </p>
                ) : null}
                {/* bKash's classic Checkout ("PGW") SDK looks for this exact id
                    (underscore, <button> tag) — see subscription page / §18. */}
                <button
                  type="button"
                  id="bKash_button"
                  disabled={!isValidAmount || !pgwScriptLoaded}
                  className="w-full rounded-xl bg-[#E2136E] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                >
                  {t.payWithBkash}
                </button>
              </div>
            )}

            {rateInfo?.bkash_gateway_enabled && rateInfo.bkash_api_type === "tokenized" && (
              <button
                type="button"
                onClick={() => void payWithBkash()}
                disabled={bkashPaying || !isValidAmount}
                className="mb-3 w-full rounded-xl bg-[#E2136E] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
              >
                {bkashPaying ? t.payingWithBkash : t.payWithBkash}
              </button>
            )}

            {rateInfo?.bkash_gateway_enabled ? (
              <button
                type="button"
                onClick={() => setShowManualForm((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-2.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                {manualVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {manualVisible ? t.hideManual : t.showManual}
              </button>
            ) : null}

            {manualVisible && (
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                {bkashNumber ? (
                  <p className="mb-3 text-sm">{t.payInstructions(bkashNumber, bkashType)}</p>
                ) : (
                  <p className="mb-3 text-sm text-amber-600">{t.noBkashConfigured}</p>
                )}

                <form onSubmit={submitPayment} className="grid gap-3 sm:grid-cols-3">
                  <input
                    required
                    placeholder={t.senderNumber}
                    value={form.sender_bkash_number}
                    onChange={(e) => setForm((p) => ({ ...p, sender_bkash_number: e.target.value }))}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder={t.trxId}
                    value={form.trx_id}
                    onChange={(e) => setForm((p) => ({ ...p, trx_id: e.target.value }))}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={saving || !isValidAmount || !bkashNumber}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70 sm:col-span-3"
                  >
                    {saving ? t.submitting : t.submit}
                  </button>
                </form>
              </div>
            )}

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}
          </section>

          {/* History */}
          <section className="catv-panel mx-4 mb-6 overflow-hidden">
            <h3 className="flex items-center gap-1.5 p-4 pb-3 text-sm font-semibold text-[var(--muted)] sm:px-5">
              <FileText size={15} /> {t.history}
            </h3>
            {purchases.length === 0 ? (
              <p className="px-4 pb-6 text-center text-sm text-[var(--muted)] sm:px-5">{t.noHistory}</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {purchases.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        {p.credits.toLocaleString()} {t.credits}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {new Date(p.created_at).toLocaleDateString()}
                        {p.trx_id ? ` · ${p.trx_id}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-[var(--foreground)]">
                          ৳{Number(p.amount).toLocaleString()}
                        </div>
                        <StatusPill status={p.status} label={t.paymentStatus[p.status] ?? p.status} />
                      </div>
                      <button
                        type="button"
                        title={t.downloadInvoice}
                        onClick={() => void downloadInvoice(p.id)}
                        disabled={downloadingId === p.id}
                        className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
                      >
                        {downloadingId === p.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </UserShell>
  );
}
