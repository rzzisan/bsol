"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Wallet,
} from "lucide-react";
import UserShell from "@/components/user-shell";
import PlatformGatewayPaymentPicker from "@/components/platform-gateway-payment-picker";
import { GlowBackdrop, HistoryRow, ReceiptCard, ReceiptRow, SectionHeader } from "@/components/billing-ui";
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

// See auto_top_up_context.md / SmsCreditAutoRechargeController::status().
interface AutoRechargeInfo {
  enabled: boolean;
  threshold: number;
  credits: number;
  failure_count: number;
  last_attempted_at: string | null;
  connected: boolean;
  status: string | null;
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
    bkashSuccess: "পেমেন্ট সফল হয়েছে — ক্রেডিট যোগ হয়ে গেছে।",
    bkashFailed: "পেমেন্ট সম্পন্ন হয়নি। আবার চেষ্টা করুন।",
    bkashCancelled: "পেমেন্ট বাতিল করা হয়েছে।",
    bkashError: "কিছু একটা সমস্যা হয়েছে।",
    enterAmountFirst: "আগে ক্রেডিট পরিমাণ লিখুন।",
    history: "ইনভয়েস ও কেনাকাটার ইতিহাস",
    noHistory: "কোনো ক্রয় পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    downloadInvoice: "ইনভয়েস ডাউনলোড",
    downloadFailed: "ইনভয়েস ডাউনলোড ব্যর্থ হয়েছে।",
    paymentStatus: { pending: "পেন্ডিং", approved: "পরিশোধিত", rejected: "বাতিল" } as Record<string, string>,
    autoTitle: "অটো-রিচার্জ",
    autoDesc: "ব্যালেন্স একটা নির্দিষ্ট পরিমাণের নিচে নামলে সেভ করা bKash দিয়ে নিজে থেকেই রিচার্জ হয়ে যাবে।",
    autoNotConnected: "কোনো bKash সেভ করা নেই।",
    autoConnect: "bKash কানেক্ট করুন",
    autoConnecting: "কানেক্ট হচ্ছে...",
    autoConnected: "bKash কানেক্টেড",
    autoDisconnect: "ডিসকানেক্ট",
    autoEnable: "অটো-রিচার্জ চালু করুন",
    autoThreshold: "থ্রেশহোল্ড (এর নিচে নামলে রিচার্জ হবে)",
    autoTopupCredits: "কত ক্রেডিট কেনা হবে প্রতিবার",
    autoSave: "সেভ করুন",
    autoSaving: "সেভ হচ্ছে...",
    autoSaved: "অটো-রিচার্জ সেটিংস সেভ হয়েছে।",
    autoFailures: (n: number) => `শেষ ${n} বার ব্যর্থ হয়েছে।`,
    autoDisabledWarning: "বারবার ব্যর্থ হওয়ায় অটো-রিচার্জ বন্ধ হয়ে গেছে — bKash অ্যাকাউন্ট চেক করে আবার চালু করুন।",
    autoAgreementSuccess: "bKash কানেক্ট হয়েছে — এখন অটো-রিচার্জ চালু করতে পারো।",
    autoAgreementFailed: "bKash কানেক্ট করা যায়নি। আবার চেষ্টা করো।",
    autoAgreementCancelled: "bKash কানেক্ট বাতিল করা হয়েছে।",
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
    bkashSuccess: "Payment successful — credits have been added.",
    bkashFailed: "Payment did not complete. Please try again.",
    bkashCancelled: "Payment was cancelled.",
    bkashError: "Something went wrong.",
    enterAmountFirst: "Enter a credit amount first.",
    history: "Invoices & Purchase History",
    noHistory: "No purchases found.",
    loading: "Loading...",
    error: "Request failed.",
    downloadInvoice: "Download invoice",
    downloadFailed: "Could not download the invoice.",
    paymentStatus: { pending: "Pending", approved: "Paid", rejected: "Rejected" } as Record<string, string>,
    autoTitle: "Auto-recharge",
    autoDesc: "Automatically top up using a saved bKash payment method once your balance drops below a threshold.",
    autoNotConnected: "No saved bKash payment method.",
    autoConnect: "Connect bKash",
    autoConnecting: "Connecting...",
    autoConnected: "bKash connected",
    autoDisconnect: "Disconnect",
    autoEnable: "Enable auto-recharge",
    autoThreshold: "Threshold (recharge once balance drops to/under this)",
    autoTopupCredits: "Credits to buy each time",
    autoSave: "Save",
    autoSaving: "Saving...",
    autoSaved: "Auto-recharge settings saved.",
    autoFailures: (n: number) => `Failed the last ${n} time(s).`,
    autoDisabledWarning: "Auto-recharge was turned off after repeated failures — check your bKash account and re-enable.",
    autoAgreementSuccess: "bKash connected — you can now enable auto-recharge.",
    autoAgreementFailed: "Could not connect bKash. Please try again.",
    autoAgreementCancelled: "bKash connection was cancelled.",
  },
};

export default function Page() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [rateInfo, setRateInfo] = useState<RateInfo | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creditsInput, setCreditsInput] = useState("");
  const [bkashPaying, setBkashPaying] = useState(false);
  const [pgwScriptLoaded, setPgwScriptLoaded] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [autoRecharge, setAutoRecharge] = useState<AutoRechargeInfo | null>(null);
  const [autoThreshold, setAutoThreshold] = useState("");
  const [autoTopupCredits, setAutoTopupCredits] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);

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
      const [rateRes, purchasesRes, autoRes] = await Promise.all([
        fetch(`${API}/sms/credit/rate`, { headers }),
        fetch(`${API}/sms/credit/purchases`, { headers }),
        fetch(`${API}/sms/credit/auto-recharge/settings`, { headers }),
      ]);
      const rateData = await rateRes.json();
      const purchasesData = await purchasesRes.json();
      const autoData = await autoRes.json();

      if (!rateRes.ok || !purchasesRes.ok) {
        setError(rateData?.message ?? purchasesData?.message ?? t.error);
        return;
      }

      setRateInfo(rateData?.data as RateInfo);
      setPurchases((purchasesData?.data ?? []) as Purchase[]);

      if (autoRes.ok) {
        const info = autoData?.data as AutoRechargeInfo;
        setAutoRecharge(info);
        setAutoThreshold(String(info.threshold || ""));
        setAutoTopupCredits(String(info.credits || ""));
        setAutoEnabled(info.enabled);
      }
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

  // Returning from the bKash Agreement (auto-recharge connect) redirect —
  // see SmsCreditAutoRechargeController::callback().
  useEffect(() => {
    const agreementStatus = new URLSearchParams(window.location.search).get("bkash_agreement");
    if (!agreementStatus) return;

    if (agreementStatus === "success") setSuccess(t.autoAgreementSuccess);
    else if (agreementStatus === "cancelled") setError(t.autoAgreementCancelled);
    else setError(t.autoAgreementFailed);

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

  const downloadInvoice = async (purchaseId: number) => {
    setDownloadingId(purchaseId);
    setError(null);
    const result = await openAuthenticatedPdf(`${API}/sms/credit/purchases/${purchaseId}/invoice`);
    if (!result.success) setError(result.message ?? t.downloadFailed);
    setDownloadingId(null);
  };

  const connectAutoRechargeBkash = async () => {
    const token = getStoredToken();
    if (!token) return;

    setAutoConnecting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/sms/credit/auto-recharge/agreement/create`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data?.data?.bkash_url) {
        setError(data?.message ?? t.bkashError);
        setAutoConnecting(false);
        return;
      }
      window.location.href = data.data.bkash_url;
    } catch {
      setError(t.bkashError);
      setAutoConnecting(false);
    }
  };

  const disconnectAutoRechargeBkash = async () => {
    const token = getStoredToken();
    if (!token) return;

    setAutoSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/sms/credit/auto-recharge/agreement`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? t.error);
        return;
      }
      await load();
    } catch {
      setError(t.error);
    } finally {
      setAutoSaving(false);
    }
  };

  const saveAutoRechargeSettings = async () => {
    const token = getStoredToken();
    if (!token) return;

    setAutoSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/sms/credit/auto-recharge/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          enabled: autoEnabled,
          threshold: Math.max(0, parseInt(autoThreshold || "0", 10) || 0),
          credits: Math.max(0, parseInt(autoTopupCredits || "0", 10) || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setSuccess(t.autoSaved);
      await load();
    } catch {
      setError(t.error);
    } finally {
      setAutoSaving(false);
    }
  };


  return (
    <UserShell locale={locale} onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
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
          <section className="catv-panel relative mx-4 mb-4 overflow-hidden">
            <div
              className="relative p-5 sm:p-6"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, var(--surface) 70%)",
              }}
            >
              <GlowBackdrop />
              <div className="relative flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
                  style={{ background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #27c0ae))" }}
                >
                  <Wallet size={24} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t.balance}</div>
                  <div className="text-3xl font-extrabold text-[var(--foreground)]">
                    {(rateInfo?.balance ?? 0).toLocaleString()}
                    <span className="ml-1.5 text-sm font-medium text-[var(--muted)]">{t.credits}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Amount picker */}
          <section className="catv-panel mx-4 mb-4 p-4 sm:p-5">
            <SectionHeader icon={MessageSquare}>{t.quickPick}</SectionHeader>
            <div className="mb-4 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amt) => {
                const selected = creditsInput === String(amt);
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCreditsInput(String(amt))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      selected
                        ? "border-transparent text-white"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                    }`}
                    style={selected ? { background: "var(--accent)" } : undefined}
                  >
                    {selected ? <CheckCircle2 size={14} /> : null}
                    {amt.toLocaleString()}
                  </button>
                );
              })}
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
              <div className="mt-4">
                <ReceiptCard>
                  <ReceiptRow label={t.rate} value={`৳${rateInfo.rate_per_credit}`} tone="muted" />
                  <div className="my-2 border-t border-dashed" style={{ borderColor: "var(--border)" }} />
                  <ReceiptRow label={t.totalPrice} value={`৳${totalPrice.toLocaleString()}`} bold />
                </ReceiptCard>
              </div>
            ) : null}
          </section>

          {/* Bill payment */}
          <section className="catv-panel mx-4 mb-4 p-4 sm:p-5">
            <SectionHeader icon={CreditCard}>{t.payTitle}</SectionHeader>

            {isValidAmount && (
              <PlatformGatewayPaymentPicker
                purpose="sms_credit"
                payload={{ credits }}
                locale={locale}
              />
            )}

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
                  className="w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #E2136E, #b90f59)" }}
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
                className="mb-3 w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #E2136E, #b90f59)" }}
              >
                {bkashPaying ? t.payingWithBkash : t.payWithBkash}
              </button>
            )}

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}
          </section>

          {/* Auto-recharge — only offered when the platform's bKash gateway
              is configured at all (same flag the Bill Payment section
              above already gates on) and the setting loaded successfully
              (staff accounts get a 403 from this owner-only endpoint and
              autoRecharge stays null, so the panel is simply omitted). */}
          {rateInfo?.bkash_gateway_enabled && autoRecharge ? (
            <section className="catv-panel mx-4 mb-4 p-4 sm:p-5">
              <SectionHeader icon={RefreshCw}>{t.autoTitle}</SectionHeader>
              <p className="mb-3 text-xs text-[var(--muted)]">{t.autoDesc}</p>

              {!autoRecharge.connected ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border)] px-3 py-3">
                  <span className="text-sm text-[var(--muted)]">{t.autoNotConnected}</span>
                  <button
                    type="button"
                    onClick={() => void connectAutoRechargeBkash()}
                    disabled={autoConnecting}
                    className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #E2136E, #b90f59)" }}
                  >
                    {autoConnecting ? t.autoConnecting : t.autoConnect}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--surface-soft)" }}>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                      <CheckCircle2 size={14} /> {t.autoConnected}
                    </span>
                    <button
                      type="button"
                      onClick={() => void disconnectAutoRechargeBkash()}
                      disabled={autoSaving}
                      className="text-xs font-semibold text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-60"
                    >
                      {t.autoDisconnect}
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={autoEnabled}
                      onChange={(e) => setAutoEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    {t.autoEnable}
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--muted)]">{t.autoThreshold}</label>
                      <input
                        type="number"
                        min={0}
                        value={autoThreshold}
                        onChange={(e) => setAutoThreshold(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--muted)]">{t.autoTopupCredits}</label>
                      <input
                        type="number"
                        min={0}
                        value={autoTopupCredits}
                        onChange={(e) => setAutoTopupCredits(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {autoRecharge.failure_count > 0 ? (
                    <p className="text-xs text-amber-600">{t.autoFailures(autoRecharge.failure_count)}</p>
                  ) : null}
                  {!autoRecharge.enabled && autoRecharge.failure_count >= 3 ? (
                    <p className="text-xs text-rose-600">{t.autoDisabledWarning}</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void saveAutoRechargeSettings()}
                    disabled={autoSaving}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70"
                  >
                    {autoSaving ? t.autoSaving : t.autoSave}
                  </button>
                </div>
              )}
            </section>
          ) : null}

          {/* History */}
          <section className="catv-panel mx-4 mb-6 overflow-hidden">
            <div className="p-4 pb-1 sm:px-5">
              <SectionHeader icon={FileText}>{t.history}</SectionHeader>
            </div>
            {purchases.length === 0 ? (
              <p className="px-4 pb-6 text-center text-sm text-[var(--muted)] sm:px-5">{t.noHistory}</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {purchases.map((p) => (
                  <HistoryRow
                    key={p.id}
                    icon={MessageSquare}
                    title={`${p.credits.toLocaleString()} ${t.credits}`}
                    subtitle={`${new Date(p.created_at).toLocaleDateString()}${p.trx_id ? ` · ${p.trx_id}` : ""}`}
                    amount={`৳${Number(p.amount).toLocaleString()}`}
                    status={p.status}
                    statusLabel={t.paymentStatus[p.status] ?? p.status}
                    onDownload={() => void downloadInvoice(p.id)}
                    downloading={downloadingId === p.id}
                    downloadTitle={t.downloadInvoice}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </UserShell>
  );
}
