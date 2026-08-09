"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

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
    quickPick: "দ্রুত নির্বাচন",
    customAmount: "অথবা পরিমাণ লিখুন",
    minCredits: (n: number) => `সর্বনিম্ন ${n} ক্রেডিট`,
    rate: "রেট",
    perCredit: "/ক্রেডিট",
    totalPrice: "মোট মূল্য",
    payWithBkash: "bKash দিয়ে সাথে সাথে পে করুন",
    payingWithBkash: "bKash-এ পাঠানো হচ্ছে...",
    pgwLoading: "bKash পেমেন্ট লোড হচ্ছে...",
    pgwSelectAmount: "উপরে ক্রেডিট পরিমাণ দিলে bKash বাটন সক্রিয় হবে।",
    orManual: "অথবা ম্যানুয়ালি পাঠান",
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
    history: "কেনাকাটার ইতিহাস",
    noHistory: "কোনো ক্রয় পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    paymentStatus: { pending: "পেন্ডিং", approved: "গ্রহণযোগ্য", rejected: "বাতিল" } as Record<string, string>,
  },
  en: {
    title: "Buy SMS Credit",
    subtitle: "Buy credit to send SMS — pay instantly with bKash or send manually.",
    balance: "Current Balance",
    credits: "credits",
    quickPick: "Quick Pick",
    customAmount: "Or enter an amount",
    minCredits: (n: number) => `Minimum ${n} credits`,
    rate: "Rate",
    perCredit: "/credit",
    totalPrice: "Total Price",
    payWithBkash: "Pay Instantly with bKash",
    payingWithBkash: "Redirecting to bKash...",
    pgwLoading: "Loading bKash payment...",
    pgwSelectAmount: "Enter a credit amount above to activate the bKash button.",
    orManual: "Or send manually",
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
    history: "Purchase History",
    noHistory: "No purchases found.",
    loading: "Loading...",
    error: "Request failed.",
    paymentStatus: { pending: "Pending", approved: "Approved", rejected: "Rejected" } as Record<string, string>,
  },
};

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

  const bkashNumber = rateInfo?.payment_instructions?.bkash_number ?? "";
  const bkashType = rateInfo?.payment_instructions?.bkash_type ?? "Personal";

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
          <section className="catv-panel mx-4 mb-4 p-4">
            <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">{t.balance}</h3>
            <div className="text-2xl font-bold text-[var(--foreground)]">
              {rateInfo?.balance ?? 0} <span className="text-sm font-normal text-[var(--muted)]">{t.credits}</span>
            </div>
          </section>

          <section className="catv-panel mx-4 mb-4 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">{t.quickPick}</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCreditsInput(String(amt))}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    creditsInput === String(amt)
                      ? "border-[var(--accent)] bg-[var(--surface-soft)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted)]"
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

            {rateInfo ? (
              <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-sm">
                <div className="flex justify-between text-[var(--muted)]">
                  <span>{t.rate}</span>
                  <span>
                    ৳{rateInfo.rate_per_credit} {t.perCredit}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>{t.totalPrice}</span>
                  <span>৳{totalPrice.toLocaleString()}</span>
                </div>
              </div>
            ) : null}
          </section>

          {rateInfo?.bkash_gateway_enabled && rateInfo.bkash_api_type === "pgw" && (
            <section className="catv-panel mx-4 mb-4 p-4">
              <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{t.payWithBkash}</p>
              {!isValidAmount ? (
                <p className="text-xs text-[var(--muted)]">{t.pgwSelectAmount}</p>
              ) : !pgwScriptLoaded ? (
                <p className="text-xs text-[var(--muted)]">{t.pgwLoading}</p>
              ) : null}
              {/* bKash's classic Checkout ("PGW") SDK looks for this exact id
                  (underscore, <button> tag) — see subscription page / §18. */}
              <button
                type="button"
                id="bKash_button"
                disabled={!isValidAmount || !pgwScriptLoaded}
                className="w-full rounded-xl bg-[#E2136E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t.payWithBkash}
              </button>
            </section>
          )}

          {rateInfo?.bkash_gateway_enabled && rateInfo.bkash_api_type === "tokenized" && (
            <section className="catv-panel mx-4 mb-4 p-4">
              <button
                type="button"
                onClick={() => void payWithBkash()}
                disabled={bkashPaying || !isValidAmount}
                className="w-full rounded-xl bg-[#E2136E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {bkashPaying ? t.payingWithBkash : t.payWithBkash}
              </button>
            </section>
          )}

          <section className="catv-panel mx-4 mb-4 p-4">
            <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">
              {rateInfo?.bkash_gateway_enabled ? t.orManual : t.payInstructionsTitle}
            </h3>
            {bkashNumber ? (
              <p className="mb-3 text-sm">{t.payInstructions(bkashNumber, bkashType)}</p>
            ) : (
              <p className="mb-3 text-sm text-amber-600">{t.noBkashConfigured}</p>
            )}

            <form onSubmit={submitPayment} className="grid gap-3 md:grid-cols-3">
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
                className="md:col-span-3 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {saving ? t.submitting : t.submit}
              </button>
            </form>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            {success ? <p className="mt-2 text-sm text-emerald-600">{success}</p> : null}
          </section>

          <section className="catv-panel mx-4 mb-6 overflow-hidden">
            <h3 className="p-4 pb-0 text-sm font-semibold text-[var(--muted)]">{t.history}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">TrxID</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                        {t.noHistory}
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{p.credits.toLocaleString()}</td>
                        <td className="px-3 py-2">৳{Number(p.amount).toLocaleString()}</td>
                        <td className="px-3 py-2">{p.trx_id ?? "-"}</td>
                        <td className="px-3 py-2">{t.paymentStatus[p.status] ?? p.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </UserShell>
  );
}
