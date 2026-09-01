"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard } from "lucide-react";
import { getStoredToken, type Locale } from "@/lib/dashboard-client";
import { gatewayProviderMeta } from "@/lib/gateway-providers";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

// bKash classic Checkout API ("PGW") widget — the one channel that isn't a
// plain click-to-redirect gateway (§13.2, online_payment_context.md). Script
// is loaded dynamically from the channel's own script_url.
declare global {
  interface Window {
    bKash?: {
      init: (config: Record<string, unknown>) => void;
      create: () => { onSuccess: (data: unknown) => void; onError: () => void };
      execute: () => { onSuccess: (data: unknown) => void; onError: () => void };
    };
  }
}

type Purpose = "subscription" | "sms_credit" | "order_credit" | "storefront_addon";

type Channel = { provider: string; api_type?: string; script_url?: string };

const t = {
  bn: {
    heading: "অথবা, মার্চেন্ট গেটওয়ে দিয়ে সাথে সাথে পে করুন",
    paying: "রিডাইরেক্ট হচ্ছে...",
    error: "পেমেন্ট শুরু করা যায়নি। আবার চেষ্টা করুন।",
    paidSuccess: "পেমেন্ট সফল হয়েছে।",
    paidFailed: "পেমেন্ট সম্পন্ন হয়নি। আবার চেষ্টা করুন।",
    pgwLoading: "লোড হচ্ছে...",
  },
  en: {
    heading: "Or pay instantly with a merchant gateway",
    paying: "Redirecting...",
    error: "Could not start the payment. Please try again.",
    paidSuccess: "Payment successful.",
    paidFailed: "Payment did not complete. Please try again.",
    pgwLoading: "Loading...",
  },
};

/**
 * Seller→platform automated-gateway "pay now" picker — dropped into all 4
 * billing surfaces (subscription, SMS credit, order-credit add-on,
 * storefront add-on). Renders nothing if the admin hasn't enabled any
 * platform gateway yet, so every page it's added to stays exactly as it
 * was (manual-only) until an admin configures at least one provider. See
 * online_payment_context.md §12, PlatformGatewayPaymentController.
 *
 * bKash Merchant configured as PGW (§13.2) renders as bKash's own widget
 * button instead of a normal pill — its script is loaded and bKash.init()
 * wired to the generic bkash-pgw create/execute endpoints, generalizing
 * what used to be separate widget code duplicated across the subscription
 * and SMS-credit pages only (order-credit/storefront-addon never had it).
 * `amount` is only needed for that widget case (bKash's own popup shows it
 * before the create/execute round trip); every other channel has the
 * server compute the real amount invisibly, same as before.
 */
export default function PlatformGatewayPaymentPicker({
  purpose,
  payload,
  amount,
  locale,
  disabled,
  onPaid,
}: {
  purpose: Purpose;
  payload: Record<string, unknown>;
  amount?: number;
  locale: Locale;
  disabled?: boolean;
  onPaid?: () => void;
}) {
  const txt = t[locale];
  const [channels, setChannels] = useState<Channel[]>([]);
  const [payingProvider, setPayingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pgwScriptLoaded, setPgwScriptLoaded] = useState(false);
  const [pgwPaying, setPgwPaying] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      const res = await fetch(`${API}/platform-gateway-payments/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const d = await res.json();
      setChannels(d.data ?? []);
    })();
  }, []);

  const bkashPgw = channels.find((c) => c.provider === "bkash_merchant" && c.api_type === "pgw");
  const otherChannels = channels.filter((c) => !(c.provider === "bkash_merchant" && c.api_type === "pgw"));

  // Load bKash's classic Checkout widget script once a PGW channel is enabled.
  useEffect(() => {
    if (!bkashPgw?.script_url) return;

    const existing = document.getElementById("bkash-pgw-script") as HTMLScriptElement | null;
    if (existing) {
      if (window.bKash) setPgwScriptLoaded(true);
      else existing.addEventListener("load", () => setPgwScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "bkash-pgw-script";
    script.src = bkashPgw.script_url;
    script.async = true;
    script.onload = () => setPgwScriptLoaded(true);
    script.onerror = () => setError(txt.error);
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bkashPgw?.script_url]);

  // (Re-)initialize the widget into #bKash_button whenever the script is
  // ready or the amount/payload changes, so the popup always shows the
  // real amount the backend will compute.
  const payloadKey = JSON.stringify(payload);
  const paymentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pgwScriptLoaded || !bkashPgw || !window.bKash || !amount || amount <= 0 || disabled) return;

    const bkashConfig = {
      paymentMode: "checkout",
      paymentRequest: { amount: amount.toFixed(2), intent: "sale", currency: "BDT" },

      createRequest: () => {
        setPgwPaying(true);
        setError(null);
        setSuccess(null);
        const token = getStoredToken();
        fetch(`${API}/platform-gateway-payments/${purpose}/bkash-pgw/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.paymentID) {
              paymentIdRef.current = data.paymentID as string;
              window.bKash?.create().onSuccess(data);
            } else {
              window.bKash?.create().onError();
              setPgwPaying(false);
              setError((data?.message as string) ?? txt.error);
            }
          })
          .catch(() => {
            window.bKash?.create().onError();
            setPgwPaying(false);
            setError(txt.error);
          });
      },

      executeRequestOnAuthorization: () => {
        const token = getStoredToken();
        fetch(`${API}/platform-gateway-payments/${purpose}/bkash-pgw/execute/${paymentIdRef.current}`, {
          method: "POST",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            setPgwPaying(false);
            if (data && data.transactionStatus === "Completed") {
              setSuccess(txt.paidSuccess);
              setError(null);
              onPaid?.();
            } else {
              window.bKash?.execute().onError();
              setError((data?.message as string) ?? txt.paidFailed);
            }
          })
          .catch(() => {
            window.bKash?.execute().onError();
            setPgwPaying(false);
            setError(txt.paidFailed);
          });
      },

      onClose: () => {
        // Seller closed the bKash popup without paying — no-op, retryable.
        setPgwPaying(false);
      },
    };

    try {
      window.bKash.init(bkashConfig);
    } catch {
      setError(txt.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pgwScriptLoaded, bkashPgw, amount, payloadKey, disabled, purpose]);

  if (channels.length === 0) return null;

  const pay = async (provider: string) => {
    setPayingProvider(provider);
    setError(null);
    try {
      const token = getStoredToken();
      const res = await fetch(`${API}/platform-gateway-payments/${purpose}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, ...payload }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.redirect_url) {
        window.location.href = d.data.redirect_url;
        return;
      }
      const firstFieldError = d?.errors ? Object.values(d.errors as Record<string, string[]>)[0]?.[0] : undefined;
      setError(firstFieldError ?? d?.message ?? txt.error);
    } catch {
      setError(txt.error);
    } finally {
      setPayingProvider(null);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]/40 p-4">
      <p className="mb-3 text-xs font-semibold text-[var(--muted)]">{txt.heading}</p>
      <div className="flex flex-wrap gap-2">
        {otherChannels.map((channel) => {
          const meta = gatewayProviderMeta(channel.provider);
          const isPaying = payingProvider === channel.provider;
          return (
            <button
              key={channel.provider}
              type="button"
              disabled={disabled || payingProvider !== null}
              onClick={() => void pay(channel.provider)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${meta?.badgeBg ?? "border-[var(--border)] bg-[var(--surface-soft)]"} ${meta?.badgeColor ?? "text-[var(--foreground)]"}`}
            >
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <span>{isPaying ? txt.paying : (meta?.label ?? channel.provider)}</span>
            </button>
          );
        })}
        {bkashPgw && (
          <button
            type="button"
            id="bKash_button"
            disabled={!pgwScriptLoaded || !amount || amount <= 0 || disabled}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #E2136E, #b90f59)" }}
          >
            <CreditCard className="h-3.5 w-3.5 shrink-0" />
            <span>{!pgwScriptLoaded ? txt.pgwLoading : pgwPaying ? txt.paying : "bKash"}</span>
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-500">{success}</p>}
    </div>
  );
}
