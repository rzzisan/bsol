"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

// bKash classic Checkout API ("PGW") widget — loaded dynamically from
// subscription.bkash_pgw_script_url, see SAAS_MODULE_CONTEXT.md §18.
declare global {
  interface Window {
    bKash?: {
      init: (config: Record<string, unknown>) => void;
      create: () => { onSuccess: (data: unknown) => void; onError: () => void };
      execute: () => { onSuccess: (data: unknown) => void; onError: () => void };
    };
  }
}

interface Package {
  id: number;
  name: string;
  slug: string;
  price: string;
  duration_days: number;
  max_orders: number | null;
  features: string[] | null;
  is_current: boolean;
  is_upgrade: boolean;
  is_downgrade_blocked: boolean;
  payable_amount: number;
}

interface Payment {
  id: number;
  amount: string;
  status: "pending" | "approved" | "rejected";
  trx_id: string | null;
  admin_note: string | null;
  created_at: string;
  package?: { name: string };
}

interface RemainingTime {
  days: number;
  hours: number;
  minutes: number;
  total_seconds: number;
}

interface InvoicePreview {
  target_package: { id: number; name: string; price: number; duration_days: number };
  previous_package: { id: number; name: string; price: number } | null;
  is_current: boolean;
  is_upgrade: boolean;
  is_downgrade_blocked: boolean;
  base_amount: number;
  proration_credit: number;
  payable_amount: number;
  current_remaining: RemainingTime | null;
  new_ends_at_preview: string;
}

interface MySubscription {
  package: Package | null;
  status: string;
  ends_at: string | null;
  days_left: number | null;
  remaining: RemainingTime | null;
  is_expired: boolean;
  payment_instructions: { bkash_number: string | null; bkash_type: string | null };
  bkash_gateway_enabled: boolean;
  bkash_api_type: "tokenized" | "pgw";
  bkash_pgw_script_url: string;
  recent_payments: Payment[];
}

const text = {
  bn: {
    title: "সাবস্ক্রিপশন",
    subtitle: "আপনার বর্তমান প্ল্যান দেখুন এবং bKash-এ পেমেন্ট করে আপগ্রেড/রিনিউ করুন।",
    currentPlan: "বর্তমান প্ল্যান",
    noPlan: "কোনো প্ল্যান সক্রিয় নেই",
    daysLeft: "দিন বাকি",
    expired: "মেয়াদ শেষ",
    status: { trial: "ট্রায়াল", active: "সক্রিয়", expired: "মেয়াদোত্তীর্ণ", none: "নেই" } as Record<string, string>,
    plans: "প্ল্যান নির্বাচন করুন",
    perMonth: "/মাস",
    orders: "অর্ডার/মাস",
    unlimited: "সীমাহীন",
    remainingTitle: "মেয়াদ বাকি",
    remainingDays: "দিন",
    remainingHours: "ঘণ্টা",
    remainingMinutes: "মিনিট",
    features: "সুবিধাসমূহ",
    currentBadge: "বর্তমান প্ল্যান",
    upgradeBadge: "আপগ্রেড",
    downgradeLocked: "মেয়াদ শেষ না হওয়া পর্যন্ত এই প্যাকেজে যাওয়া যাবে না",
    invoiceTitle: "ইনভয়েস",
    invoiceLoading: "হিসাব করা হচ্ছে...",
    invoiceBase: "প্যাকেজ মূল্য",
    invoiceProration: "বাকি মেয়াদের ছাড়",
    invoicePayable: "পরিশোধযোগ্য মূল্য",
    invoiceNewExpiry: "নতুন মেয়াদ শেষ হবে",
    invoiceUpgradeNote: "আপগ্রেড — বর্তমান প্যাকেজের বাকি মেয়াদের মূল্য এই ইনভয়েস থেকে বাদ দেওয়া হয়েছে।",
    invoiceRenewalNote: "একই প্যাকেজ রিনিউ — বর্তমান মেয়াদের সাথে নতুন মেয়াদ যোগ হবে।",
    payWithBkash: "bKash দিয়ে সাথে সাথে পে করুন",
    payingWithBkash: "bKash-এ পাঠানো হচ্ছে...",
    pgwLoading: "bKash পেমেন্ট লোড হচ্ছে...",
    pgwSelectPlan: "উপর থেকে একটা প্ল্যান বেছে নিলে bKash বাটন সক্রিয় হবে।",
    orManual: "অথবা ম্যানুয়ালি পাঠান",
    bkashSuccess: "পেমেন্ট সফল হয়েছে — আপনার প্ল্যান সক্রিয় হয়ে গেছে।",
    bkashFailed: "পেমেন্ট সম্পন্ন হয়নি। আবার চেষ্টা করুন অথবা নিচের ম্যানুয়াল অপশন ব্যবহার করুন।",
    bkashCancelled: "পেমেন্ট বাতিল করা হয়েছে।",
    bkashError: "কিছু একটা সমস্যা হয়েছে।",
    selectPlanFirst: "আগে একটা প্ল্যান নির্বাচন করুন।",
    payInstructionsTitle: "bKash-এ পেমেন্ট পাঠান",
    payInstructions: (num: string, type: string) =>
      `নিচের bKash নম্বরে (${type}) টাকা Send Money করুন: ${num}। তারপর TrxID ও bKash নম্বর দিয়ে ফর্মটি জমা দিন — আমরা যাচাই করে আপনার প্ল্যান সক্রিয় করে দেব।`,
    noBkashConfigured: "পেমেন্ট নম্বর এখনো সেট করা হয়নি। সাপোর্টের সাথে যোগাযোগ করুন।",
    selectPlan: "প্ল্যান",
    senderNumber: "আপনার bKash নম্বর",
    trxId: "TrxID",
    screenshot: "স্ক্রিনশট (ঐচ্ছিক)",
    submit: "পেমেন্ট সাবমিট করুন",
    submitting: "সাবমিট হচ্ছে...",
    submitted: "পেমেন্ট সাবমিট হয়েছে। যাচাই হলে প্ল্যান সক্রিয় হবে।",
    history: "পেমেন্ট হিস্ট্রি",
    noHistory: "কোনো পেমেন্ট পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    paymentStatus: { pending: "পেন্ডিং", approved: "গ্রহণযোগ্য", rejected: "বাতিল" } as Record<string, string>,
  },
  en: {
    title: "Subscription",
    subtitle: "View your current plan and upgrade/renew by paying via bKash.",
    currentPlan: "Current Plan",
    noPlan: "No active plan",
    daysLeft: "days left",
    expired: "Expired",
    status: { trial: "Trial", active: "Active", expired: "Expired", none: "None" } as Record<string, string>,
    plans: "Select a Plan",
    perMonth: "/mo",
    orders: "orders/mo",
    unlimited: "Unlimited",
    remainingTitle: "Time Remaining",
    remainingDays: "d",
    remainingHours: "h",
    remainingMinutes: "m",
    features: "Features",
    currentBadge: "Current Plan",
    upgradeBadge: "Upgrade",
    downgradeLocked: "You can't switch to this plan until your current plan expires",
    invoiceTitle: "Invoice",
    invoiceLoading: "Calculating...",
    invoiceBase: "Package price",
    invoiceProration: "Remaining-time credit",
    invoicePayable: "Payable amount",
    invoiceNewExpiry: "New plan expires",
    invoiceUpgradeNote: "Upgrade — the unused value of your current plan has been deducted from this invoice.",
    invoiceRenewalNote: "Same-plan renewal — the new period will be added to your current plan.",
    payWithBkash: "Pay Instantly with bKash",
    payingWithBkash: "Redirecting to bKash...",
    pgwLoading: "Loading bKash payment...",
    pgwSelectPlan: "Select a plan above to activate the bKash button.",
    orManual: "Or send manually",
    bkashSuccess: "Payment successful — your plan is now active.",
    bkashFailed: "Payment did not complete. Please try again or use the manual option below.",
    bkashCancelled: "Payment was cancelled.",
    bkashError: "Something went wrong.",
    selectPlanFirst: "Select a plan first.",
    payInstructionsTitle: "Send Payment via bKash",
    payInstructions: (num: string, type: string) =>
      `Send Money to this bKash number (${type}): ${num}. Then submit the form below with your TrxID and bKash number — we'll verify and activate your plan.`,
    noBkashConfigured: "Payment number not configured yet. Please contact support.",
    selectPlan: "Plan",
    senderNumber: "Your bKash Number",
    trxId: "TrxID",
    screenshot: "Screenshot (optional)",
    submit: "Submit Payment",
    submitting: "Submitting...",
    submitted: "Payment submitted. Your plan will activate once verified.",
    history: "Payment History",
    noHistory: "No payments found.",
    loading: "Loading...",
    error: "Request failed.",
    paymentStatus: { pending: "Pending", approved: "Approved", rejected: "Rejected" } as Record<string, string>,
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [plans, setPlans] = useState<Package[]>([]);
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ package_id: "", sender_bkash_number: "", trx_id: "" });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [bkashPaying, setBkashPaying] = useState(false);
  const [pgwScriptLoaded, setPgwScriptLoaded] = useState(false);
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [liveRemainingSeconds, setLiveRemainingSeconds] = useState<number | null>(null);

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
      const [plansRes, subRes] = await Promise.all([
        fetch(`${API}/subscription/plans`, { headers }),
        fetch(`${API}/subscription/me`, { headers }),
      ]);
      const plansData = await plansRes.json();
      const subData = await subRes.json();

      if (!plansRes.ok || !subRes.ok) {
        setError(plansData?.message ?? subData?.message ?? t.error);
        return;
      }

      setPlans((plansData?.data ?? []) as Package[]);
      setSubscription(subData?.data as MySubscription);

      // Pre-select the currently active plan — but only if the seller
      // hasn't already picked something in this session (e.g. right before
      // being redirected to bKash and back, which remounts this page and
      // would otherwise wipe the selection).
      const activePackageId = subData?.data?.package?.id;
      if (activePackageId) {
        setForm((f) => (f.package_id ? f : { ...f, package_id: String(activePackageId) }));
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

  // Returning from the bKash gateway redirect — see BkashPaymentController::callback().
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

  // Reset the live countdown whenever a fresh `remaining` snapshot arrives
  // from the API (initial load, or after a payment refreshes subscription).
  useEffect(() => {
    setLiveRemainingSeconds(subscription?.remaining?.total_seconds ?? null);
  }, [subscription?.remaining?.total_seconds]);

  // Tick the countdown down every second — a single interval mounted once;
  // functional updates avoid needing `liveRemainingSeconds` as a dependency.
  useEffect(() => {
    const id = setInterval(() => {
      setLiveRemainingSeconds((s) => (s !== null && s > 0 ? s - 1 : s));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch a server-computed invoice preview (base price, proration credit,
  // payable amount, new expiry) whenever the seller selects a package — the
  // actual charge is always recomputed server-side at payment time too, this
  // is just what's shown before they commit. See SubscriptionInvoiceService.
  useEffect(() => {
    if (!form.package_id) {
      setInvoice(null);
      return;
    }
    const token = getStoredToken();
    if (!token) return;

    let cancelled = false;
    setInvoiceLoading(true);
    fetch(`${API}/subscription/invoice/preview?package_id=${form.package_id}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setInvoice((data?.data ?? null) as InvoicePreview | null);
      })
      .catch(() => {
        if (!cancelled) setInvoice(null);
      })
      .finally(() => {
        if (!cancelled) setInvoiceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.package_id]);

  // Load bKash's classic Checkout widget script when the platform is set
  // to the PGW api type — see SAAS_MODULE_CONTEXT.md §18.
  useEffect(() => {
    if (subscription?.bkash_api_type !== "pgw" || !subscription.bkash_pgw_script_url) return;

    const existing = document.getElementById("bkash-pgw-script") as HTMLScriptElement | null;
    if (existing) {
      if (window.bKash) setPgwScriptLoaded(true);
      else existing.addEventListener("load", () => setPgwScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "bkash-pgw-script";
    script.src = subscription.bkash_pgw_script_url;
    script.async = true;
    script.onload = () => setPgwScriptLoaded(true);
    script.onerror = () => setError(t.bkashError);
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.bkash_api_type, subscription?.bkash_pgw_script_url]);

  // (Re-)initialize the bKash widget into #bKash-button whenever the script
  // is ready or the selected package/invoice changes. Waits for the invoice
  // preview so the amount shown in bKash's own popup always matches what the
  // backend will actually charge (server-computed, proration-aware).
  useEffect(() => {
    if (
      !pgwScriptLoaded ||
      subscription?.bkash_api_type !== "pgw" ||
      !form.package_id ||
      !window.bKash ||
      !invoice ||
      invoice.is_downgrade_blocked
    )
      return;

    const amount = invoice.payable_amount.toFixed(2);
    const packageId = form.package_id;
    let currentPaymentId: string | null = null;

    const bkashConfig = {
      paymentMode: "checkout",
      paymentRequest: { amount, intent: "sale", currency: "BDT" },

      createRequest: () => {
        const token = getStoredToken();
        fetch(`${API}/subscription/pay/bkash-pgw/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ package_id: packageId }),
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
        fetch(`${API}/subscription/pay/bkash-pgw/execute/${currentPaymentId}`, {
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
  }, [pgwScriptLoaded, subscription?.bkash_api_type, form.package_id, invoice]);

  const payWithBkash = async () => {
    const token = getStoredToken();
    if (!token) return;
    if (!form.package_id) {
      setError(t.selectPlanFirst);
      return;
    }

    setBkashPaying(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/subscription/pay/bkash/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ package_id: form.package_id }),
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
    if (!token || !form.package_id) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append("package_id", form.package_id);
      body.append("sender_bkash_number", form.sender_bkash_number);
      body.append("trx_id", form.trx_id);
      if (screenshot) body.append("screenshot", screenshot);

      const res = await fetch(`${API}/subscription/payments`, {
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
      setForm({ package_id: "", sender_bkash_number: "", trx_id: "" });
      setScreenshot(null);
      await load();
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = subscription?.status ? (t.status[subscription.status] ?? subscription.status) : t.status.none;
  const bkashNumber = subscription?.payment_instructions?.bkash_number ?? "";
  const bkashType = subscription?.payment_instructions?.bkash_type ?? "Personal";
  const liveRemaining =
    liveRemainingSeconds !== null
      ? {
          days: Math.floor(liveRemainingSeconds / 86400),
          hours: Math.floor((liveRemainingSeconds % 86400) / 3600),
          minutes: Math.floor((liveRemainingSeconds % 3600) / 60),
        }
      : null;

  return (
    <UserShell
      activeKey="subscription"
      defaultExpandedKey="settings"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      {loading ? (
        <p className="mx-4 text-sm text-[var(--muted)]">{t.loading}</p>
      ) : (
        <>
          <section className="catv-panel mx-4 mb-4 p-4">
            <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">{t.currentPlan}</h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-bold">{subscription?.package?.name ?? t.noPlan}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  subscription?.is_expired
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {statusLabel}
              </span>
              {liveRemaining && !subscription?.is_expired ? (
                <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-sm text-[var(--foreground)]">
                  {t.remainingTitle}: <b>{liveRemaining.days}</b>{t.remainingDays} <b>{liveRemaining.hours}</b>{t.remainingHours}{" "}
                  <b>{liveRemaining.minutes}</b>{t.remainingMinutes}
                </span>
              ) : null}
              {subscription?.is_expired ? (
                <span className="text-sm font-semibold text-rose-600">{t.expired}</span>
              ) : null}
            </div>
          </section>

          <section className="catv-panel mx-4 mb-4 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">{t.plans}</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((p) => {
                const selected = String(p.id) === form.package_id;
                const locked = p.is_downgrade_blocked;
                return (
                  <label
                    key={p.id}
                    title={locked ? t.downgradeLocked : undefined}
                    className={`relative flex flex-col rounded-xl border p-3 text-sm transition ${
                      locked
                        ? "cursor-not-allowed border-[var(--border)] opacity-50"
                        : selected
                        ? "cursor-pointer border-[var(--accent)] bg-[var(--surface-soft)] ring-1 ring-[var(--accent)]"
                        : p.is_current
                        ? "cursor-pointer border-[var(--accent)]"
                        : "cursor-pointer border-[var(--border)]"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <input
                        type="radio"
                        name="package_id"
                        disabled={locked}
                        checked={selected}
                        onChange={() => setForm((f) => ({ ...f, package_id: String(p.id) }))}
                      />
                      {p.is_current ? (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                          {t.currentBadge}
                        </span>
                      ) : p.is_upgrade ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {t.upgradeBadge}
                        </span>
                      ) : null}
                    </div>
                    <span className="font-semibold">{p.name}</span>
                    <div className="mt-1 text-lg font-bold">
                      ৳{Number(p.price).toLocaleString()}
                      <span className="text-xs font-normal text-[var(--muted)]">{t.perMonth}</span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {p.max_orders ? `${p.max_orders} ${t.orders}` : `${t.unlimited} ${t.orders}`}
                    </div>
                    {p.features && p.features.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex gap-1">
                            <span className="text-[var(--accent)]">✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {locked ? (
                      <p className="mt-2 text-[11px] font-medium text-rose-600">{t.downgradeLocked}</p>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </section>

          {form.package_id && (
            <section className="catv-panel mx-4 mb-4 p-4">
              <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">{t.invoiceTitle}</h3>
              {invoiceLoading || !invoice ? (
                <p className="text-xs text-[var(--muted)]">{t.invoiceLoading}</p>
              ) : invoice.is_downgrade_blocked ? (
                <p className="text-sm font-medium text-rose-600">{t.downgradeLocked}</p>
              ) : (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">{t.invoiceBase}</span>
                    <span>৳{invoice.base_amount.toLocaleString()}</span>
                  </div>
                  {invoice.is_upgrade && invoice.proration_credit > 0 ? (
                    <div className="flex justify-between text-emerald-600">
                      <span>{t.invoiceProration}</span>
                      <span>−৳{invoice.proration_credit.toLocaleString()}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold">
                    <span>{t.invoicePayable}</span>
                    <span>৳{invoice.payable_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--muted)]">
                    <span>{t.invoiceNewExpiry}</span>
                    <span>{new Date(invoice.new_ends_at_preview).toLocaleString()}</span>
                  </div>
                  <p className="pt-1 text-xs text-[var(--muted)]">
                    {invoice.is_upgrade ? t.invoiceUpgradeNote : t.invoiceRenewalNote}
                  </p>
                </div>
              )}
            </section>
          )}

          {subscription?.bkash_gateway_enabled && subscription.bkash_api_type === "pgw" && (
            <section className="catv-panel mx-4 mb-4 p-4">
              <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{t.payWithBkash}</p>
              {!form.package_id ? (
                <p className="text-xs text-[var(--muted)]">{t.pgwSelectPlan}</p>
              ) : !pgwScriptLoaded ? (
                <p className="text-xs text-[var(--muted)]">{t.pgwLoading}</p>
              ) : null}
              {/* bKash's classic Checkout ("PGW") SDK looks for this exact
                  id (underscore, <button> tag) in the DOM and binds its own
                  click handling to it once bKash.init() has run — it does
                  NOT inject markup into a container div. See §18. */}
              <button
                type="button"
                id="bKash_button"
                disabled={!form.package_id || !pgwScriptLoaded || !invoice || invoice.is_downgrade_blocked}
                className="w-full rounded-xl bg-[#E2136E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t.payWithBkash}
              </button>
            </section>
          )}

          {subscription?.bkash_gateway_enabled && subscription.bkash_api_type === "tokenized" && (
            <section className="catv-panel mx-4 mb-4 p-4">
              <button
                type="button"
                onClick={() => void payWithBkash()}
                disabled={bkashPaying || !form.package_id || !invoice || invoice.is_downgrade_blocked}
                className="w-full rounded-xl bg-[#E2136E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {bkashPaying ? t.payingWithBkash : t.payWithBkash}
              </button>
            </section>
          )}

          <section className="catv-panel mx-4 mb-4 p-4">
            <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">
              {subscription?.bkash_gateway_enabled ? t.orManual : t.payInstructionsTitle}
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
                disabled={saving || !form.package_id || !bkashNumber || !invoice || invoice.is_downgrade_blocked}
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
                    <th className="px-3 py-2">Package</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">TrxID</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(subscription?.recent_payments ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                        {t.noHistory}
                      </td>
                    </tr>
                  ) : (
                    subscription?.recent_payments.map((p) => (
                      <tr key={p.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{p.package?.name ?? "-"}</td>
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
