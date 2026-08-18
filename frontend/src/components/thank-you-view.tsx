"use client";

import { useEffect, useRef, useState } from "react";
import { landingPathForSlug } from "@/lib/landing-pages";
import { mergeLandingContent, getDefaultThankYou, getDefaultSettings } from "@/lib/landing-pages";
import { resolveFontCssVar } from "@/lib/theme-presets";
import { useBsolTracking } from "@/lib/tracking";
import type { PublicLandingPage } from "@/components/public-landing-page-view";

export type ThankYouOrder = {
  order_number: string;
  created_at?: string | null;
  status?: string | null;
  otp_required?: boolean | null;
  otp_verified?: boolean | null;
  payment_method?: string | null;
  payment_status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_district?: string | null;
  customer_thana?: string | null;
  customer_area?: string | null;
  subtotal?: string | number | null;
  shipping_charge?: string | number | null;
  discount?: string | number | null;
  total?: string | number | null;
  custom_fields?: Array<{ key: string; label: string; value: string }> | null;
  items?: Array<{
    product_name: string;
    quantity: number;
    unit_price?: string | number | null;
    total?: string | number | null;
  }>;
};

const THANK_YOU_UI_TEXT = {
  bn: {
    otpWrongCode: "ভুল OTP। আবার চেষ্টা করুন।",
    contactFailed: "যোগাযোগ করা যায়নি। আবার চেষ্টা করুন।",
    otpSendFailed: "OTP পাঠানো যায়নি।",
    verifying: "যাচাই হচ্ছে...",
    orderNumberLabel: "অর্ডার নম্বর",
    orderInfoMissing: "অর্ডারের তথ্য পাওয়া যায়নি।",
    backToLandingPage: "ল্যান্ডিং পেজে ফিরে যান",
    orderSummary: "অর্ডার সামারী",
    subtotal: "সাবটোটাল",
    discount: "ডিসকাউন্ট",
    deliveryCharge: "ডেলিভারি চার্জ",
    grandTotal: "সর্বমোট",
    paymentLabel: "পেমেন্ট",
    cashOnDelivery: "ক্যাশ অন ডেলিভারি",
    shippingAddress: "শিপিং ঠিকানা",
    callForHelp: "যেকোনো প্রয়োজনে কল করুন",
    orderAgain: "← আবার অর্ডার করুন",
    paymentSuccess: "পেমেন্ট সফল হয়েছে! আপনার অর্ডার কনফার্ম করা হয়েছে।",
    paymentFailed: "পেমেন্ট সম্পূর্ণ হয়নি। আবার চেষ্টা করুন অথবা অন্য পদ্ধতিতে পে করুন।",
  },
  en: {
    otpWrongCode: "Incorrect OTP. Please try again.",
    contactFailed: "Could not reach the server. Please try again.",
    otpSendFailed: "OTP could not be sent.",
    verifying: "Verifying...",
    orderNumberLabel: "Order number",
    orderInfoMissing: "Order information not found.",
    backToLandingPage: "Back to landing page",
    orderSummary: "Order Summary",
    subtotal: "Subtotal",
    discount: "Discount",
    deliveryCharge: "Delivery charge",
    grandTotal: "Grand total",
    paymentLabel: "Payment",
    cashOnDelivery: "Cash on delivery",
    shippingAddress: "Shipping Address",
    callForHelp: "Call us for any assistance",
    orderAgain: "← Order again",
    paymentSuccess: "Payment successful! Your order has been confirmed.",
    paymentFailed: "Payment could not be completed. Please try again or use a different method.",
  },
} as const;

function OtpVerificationCard({
  slug,
  orderId,
  token,
  createdAt,
  onVerified,
  title,
  description,
  buttonText,
  resendText,
  language,
}: {
  slug: string;
  orderId: string;
  token: string;
  createdAt?: string | null;
  onVerified: () => void;
  title: string;
  description: string;
  buttonText: string;
  resendText: string;
  language: "bn" | "en";
}) {
  const t = THANK_YOU_UI_TEXT[language] ?? THANK_YOU_UI_TEXT.bn;
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const sentAt = createdAt ? new Date(createdAt).getTime() : Date.now();
    const elapsed = Math.floor((Date.now() - sentAt) / 1000);
    setResendCooldown(Math.max(0, 60 - elapsed));
  }, [createdAt]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/landing-pages/${slug}/orders/${orderId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp_code: code.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.message || t.otpWrongCode);
        return;
      }
      onVerified();
    } catch {
      setError(t.contactFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      const res = await fetch(`/api/public/landing-pages/${slug}/orders/${orderId}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.message || t.otpSendFailed);
        setResendCooldown(Number(json?.retry_after_seconds) || 60);
        return;
      }
      setResendCooldown(60);
    } catch {
      setError(t.contactFailed);
    }
  }

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <form onSubmit={verify} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="OTP"
          className="w-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-lg tracking-[0.4em] text-slate-900"
        />
        <button
          type="submit"
          disabled={submitting || code.trim().length !== 4}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? t.verifying : buttonText}
        </button>
      </form>
      {error ? <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
      <button
        type="button"
        onClick={resend}
        disabled={resendCooldown > 0}
        className="mt-3 text-sm font-medium text-slate-500 underline disabled:opacity-50"
      >
        {resendCooldown > 0 ? `${resendText} (${resendCooldown}s)` : resendText}
      </button>
    </div>
  );
}

const WALLET_CLAIM_TEXT = {
  bn: {
    title: (provider: string) => `${provider}-এ পেমেন্ট`,
    description: (provider: string, number: string) =>
      `আপনার নিজের ${provider} অ্যাপ থেকে ${number} নম্বরে টাকা পাঠান, তারপর নিচে Transaction ID দিন।`,
    senderNumber: "যে নম্বর থেকে পাঠিয়েছেন",
    trxId: "Transaction ID",
    screenshot: "স্ক্রিনশট (ঐচ্ছিক)",
    submit: "জমা দিন",
    submitting: "জমা হচ্ছে...",
    submitted: "পেমেন্টের তথ্য জমা হয়েছে। সেলার যাচাই করার পর কনফার্ম হবে।",
    genericError: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",
  },
  en: {
    title: (provider: string) => `Pay with ${provider}`,
    description: (provider: string, number: string) =>
      `Send money to ${number} from your own ${provider} app, then enter the Transaction ID below.`,
    senderNumber: "Number you sent from",
    trxId: "Transaction ID",
    screenshot: "Screenshot (optional)",
    submit: "Submit",
    submitting: "Submitting...",
    submitted: "Payment info submitted. It will be confirmed once the seller verifies it.",
    genericError: "Something went wrong, please try again.",
  },
} as const;

function WalletClaimCard({
  slug,
  orderId,
  token,
  provider,
  number,
  language,
}: {
  slug: string;
  orderId: string;
  token: string;
  provider: string;
  number: string;
  language: "bn" | "en";
}) {
  const t = WALLET_CLAIM_TEXT[language] ?? WALLET_CLAIM_TEXT.bn;
  const providerName = provider === "bkash" ? "bKash" : provider === "nagad" ? "Nagad" : "Rocket";
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("provider", provider);
      form.set("sender_number", senderNumber.trim());
      form.set("customer_trx_id", trxId.trim());
      if (screenshot) form.set("screenshot", screenshot);

      const res = await fetch(`/api/public/landing-pages/${slug}/orders/${orderId}/online-payment/wallet-claim`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.message || Object.values(json?.errors ?? {}).flat()[0] as string || t.genericError);
        return;
      }
      setSubmitted(true);
    } catch {
      setError(t.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="lp-card rounded-3xl p-6 sm:p-8">
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{t.submitted}</div>
      </div>
    );
  }

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl font-bold text-slate-900">{t.title(providerName)}</h2>
      <p className="mt-2 text-sm text-slate-500">{t.description(providerName, number)}</p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-1">
          <span className="mb-1 block text-xs text-slate-500">{t.senderNumber}</span>
          <input
            value={senderNumber}
            onChange={(e) => setSenderNumber(e.target.value)}
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
          />
        </label>
        <label className="sm:col-span-1">
          <span className="mb-1 block text-xs text-slate-500">{t.trxId}</span>
          <input
            value={trxId}
            onChange={(e) => setTrxId(e.target.value)}
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-500">{t.screenshot}</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting || !senderNumber.trim() || !trxId.trim()}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </div>
      </form>
      {error ? <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `৳${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "৳0.00";
}

export default function ThankYouView({
  page,
  order,
  orderId,
  token,
}: {
  page: PublicLandingPage;
  order: ThankYouOrder | null;
  orderId?: string;
  token?: string;
}) {
  const [otpVerified, setOtpVerified] = useState(Boolean(order?.otp_verified));

  // Purchase's authoritative send is server-side (SendFacebookCapiPurchaseEventJob,
  // fired at order creation, before the customer ever reaches this page) —
  // this is the browser-side copy for Event Match Quality, same order_{id}
  // event id, so Meta dedupes the pair (tracking_capi_context.md §3.2).
  const { trackPurchase } = useBsolTracking(page);
  const purchaseFiredRef = useRef(false);
  useEffect(() => {
    if (!order || !orderId || purchaseFiredRef.current) return;
    purchaseFiredRef.current = true;
    trackPurchase(Number(orderId), {
      currency: "BDT",
      value: Number(order.total ?? 0),
      num_items: (order.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0),
    });
  }, [order, orderId, trackPurchase]);

  const theme = {
    primary: page?.theme_settings?.primary_color ?? "#0f766e",
    accent: page?.theme_settings?.accent_color ?? "#f97316",
    background: page?.theme_settings?.background_color ?? "#f8fafc",
    text: page?.theme_settings?.text_color ?? "#0f172a",
    buttonText: page?.theme_settings?.button_text_color ?? "#ffffff",
    fontFamily: page?.theme_settings?.font_family ?? "Hind Siliguri",
  };

  const content = mergeLandingContent(page.content, page.template);
  const language = content.settings?.language ?? "bn";
  const t = THANK_YOU_UI_TEXT[language] ?? THANK_YOU_UI_TEXT.bn;
  const defaultThankYou = getDefaultThankYou(language);
  const defaultSettings = getDefaultSettings(language);
  const thankYou = content.thank_you ?? defaultThankYou;
  const showSummary = thankYou.show_order_summary ?? true;
  const showAddress = thankYou.show_shipping_address ?? true;
  const contactPhone = content.contact?.phone ?? null;
  const otpVerifiedMessage = content.settings?.otp_verified_message || defaultSettings.otp_verified_message;
  const showOtpGate = Boolean(order?.otp_required) && !otpVerified && Boolean(orderId) && Boolean(token);

  // Personal-wallet "send & verify" — the seller's receiving number for the
  // channel this customer picked at checkout. Only shown while the order is
  // still due (a verified/paid order has nothing left to submit). See
  // online_payment_context.md.
  const walletProvider = order?.payment_method && ["bkash", "nagad", "rocket"].includes(order.payment_method)
    ? order.payment_method
    : null;
  const showWalletClaim = Boolean(walletProvider) && order?.payment_status !== "paid" && Boolean(orderId) && Boolean(token);
  const [walletNumber, setWalletNumber] = useState<string | null>(null);
  useEffect(() => {
    if (!walletProvider) return;
    fetch(`/api/public/landing-pages/${page.slug}/payment-channels`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const channels: Array<{ provider: string; number: string }> = json?.data?.wallet_channels ?? [];
        setWalletNumber(channels.find((c) => c.provider === walletProvider)?.number ?? null);
      })
      .catch(() => {});
    // Only needs to run once per landing on this page — walletProvider is
    // derived from the (unchanging) order, not user interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletProvider, page.slug]);

  // Gateway_auto redirect result — the provider's callback route appends
  // ?payment_result=success|failed before sending the browser here, same
  // pattern as the seller-facing subscription page's ?bkash_status=. See
  // online_payment_context.md.
  const [paymentResult, setPaymentResult] = useState<string | null>(null);
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("payment_result");
    if (!result) return;
    setPaymentResult(result);
    const url = new URL(window.location.href);
    url.searchParams.delete("payment_result");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const areaLine = order
    ? [order.customer_area, order.customer_thana, order.customer_district].filter((part) => (part ?? "").trim()).join(", ")
    : "";
  const discount = Number(order?.discount ?? 0);

  return (
    <main className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text }}>
      <style>{`
        .lp-shell { font-family: var(${resolveFontCssVar(theme.fontFamily)}), system-ui, -apple-system, sans-serif; }
        .lp-card { background: rgba(255,255,255,0.92); border: 1px solid rgba(148,163,184,0.18); box-shadow: 0 20px 50px rgba(15,23,42,0.08); }
        ${page.custom_css ?? ""}
      `}</style>

      <section
        className="lp-shell px-4 py-14 text-white"
        style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, #0b3b36 100%)` }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="mt-5 text-3xl font-extrabold sm:text-4xl">{thankYou.title || defaultThankYou.title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/90 sm:text-lg">{thankYou.message || defaultThankYou.message}</p>
          {order ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold">
              {t.orderNumberLabel}: <span className="tracking-wide">{order.order_number}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="lp-shell mx-auto max-w-3xl px-4 py-10">
        <div className="space-y-6">
          {!order ? (
            <div className="lp-card rounded-3xl p-6 text-center sm:p-8">
              <p className="text-sm text-slate-600">{t.orderInfoMissing}</p>
              <a
                href={landingPathForSlug(page.slug)}
                className="mt-4 inline-flex rounded-2xl px-5 py-2.5 text-sm font-semibold"
                style={{ backgroundColor: theme.accent, color: theme.buttonText }}
              >
                {t.backToLandingPage}
              </a>
            </div>
          ) : (
            <>
              {paymentResult ? (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    paymentResult === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {paymentResult === "success" ? t.paymentSuccess : t.paymentFailed}
                </div>
              ) : null}

              {showOtpGate ? (
                <OtpVerificationCard
                  slug={page.slug}
                  orderId={orderId!}
                  token={token!}
                  createdAt={order.created_at}
                  onVerified={() => setOtpVerified(true)}
                  title={content.settings?.otp_form_title || defaultSettings.otp_form_title}
                  description={content.settings?.otp_form_description || defaultSettings.otp_form_description}
                  buttonText={content.settings?.otp_form_button_text || defaultSettings.otp_form_button_text}
                  resendText={content.settings?.otp_form_resend_text || defaultSettings.otp_form_resend_text}
                  language={language}
                />
              ) : null}

              {otpVerified && order.otp_required ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {otpVerifiedMessage}
                </div>
              ) : null}

              {showWalletClaim && walletNumber ? (
                <WalletClaimCard
                  slug={page.slug}
                  orderId={orderId!}
                  token={token!}
                  provider={walletProvider!}
                  number={walletNumber}
                  language={language}
                />
              ) : null}

              {showSummary ? (
                <div className="lp-card rounded-3xl p-6 sm:p-8">
                  <h2 className="text-xl font-bold" style={{ color: theme.primary }}>{t.orderSummary}</h2>
                  <div className="mt-4 space-y-3">
                    {(order.items ?? []).map((item, index) => (
                      <div key={`${item.product_name}-${index}`} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
                        <div>
                          <div className="font-semibold text-slate-800">{item.product_name}</div>
                          <div className="mt-0.5 text-slate-500">{item.quantity} × {money(item.unit_price)}</div>
                        </div>
                        <div className="font-semibold text-slate-800">{money(item.total)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{t.subtotal}</span>
                      <span>{money(order.subtotal)}</span>
                    </div>
                    {discount > 0 ? (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>{t.discount}</span>
                        <span>-{money(discount)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{t.deliveryCharge}</span>
                      <span>{money(order.shipping_charge)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold" style={{ color: theme.primary }}>
                      <span>{t.grandTotal}</span>
                      <span>{money(order.total)}</span>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-slate-500">
                    {t.paymentLabel}: {order.payment_method === "cod"
                      ? t.cashOnDelivery
                      : order.payment_method === "bkash"
                        ? "bKash"
                        : order.payment_method === "nagad"
                          ? "Nagad"
                          : order.payment_method === "rocket"
                            ? "Rocket"
                            : order.payment_method ?? "—"}
                  </div>
                </div>
              ) : null}

              {showAddress ? (
                <div className="lp-card rounded-3xl p-6 sm:p-8">
                  <h2 className="text-xl font-bold" style={{ color: theme.primary }}>{t.shippingAddress}</h2>
                  <div className="mt-4 space-y-1.5 text-sm text-slate-700">
                    {order.customer_name ? <div className="font-semibold text-slate-800">{order.customer_name}</div> : null}
                    {order.customer_phone ? <div>{order.customer_phone}</div> : null}
                    {order.customer_address ? <div>{order.customer_address}</div> : null}
                    {areaLine ? <div>{areaLine}</div> : null}
                  </div>
                  {order.custom_fields?.length ? (
                    <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm text-slate-700">
                      {order.custom_fields.map((field) => (
                        <div key={field.key}>
                          <span className="font-medium text-slate-500">{field.label}:</span> {field.value}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <div className="text-center text-sm text-slate-500">
            {contactPhone ? <p>{t.callForHelp}: <a href={`tel:${contactPhone}`} className="font-semibold" style={{ color: theme.primary }}>{contactPhone}</a></p> : null}
            <a href={landingPathForSlug(page.slug)} className="mt-2 inline-block font-medium hover:underline" style={{ color: theme.primary }}>
              {t.orderAgain}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
