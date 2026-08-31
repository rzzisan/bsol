"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { getStoredToken, type Locale } from "@/lib/dashboard-client";
import { gatewayProviderMeta } from "@/lib/gateway-providers";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

type Purpose = "subscription" | "sms_credit" | "order_credit" | "storefront_addon";

const t = {
  bn: {
    heading: "অথবা, মার্চেন্ট গেটওয়ে দিয়ে সাথে সাথে পে করুন",
    paying: "রিডাইরেক্ট হচ্ছে...",
    error: "পেমেন্ট শুরু করা যায়নি। আবার চেষ্টা করুন।",
  },
  en: {
    heading: "Or pay instantly with a merchant gateway",
    paying: "Redirecting...",
    error: "Could not start the payment. Please try again.",
  },
};

/**
 * Seller→platform automated-gateway "pay now" picker — dropped into all 4
 * billing surfaces (subscription, SMS credit, order-credit add-on,
 * storefront add-on). Renders nothing if the admin hasn't enabled any
 * platform gateway yet, so every page it's added to stays exactly as it
 * was (manual-only) until an admin configures at least one provider. See
 * online_payment_context.md §12, PlatformGatewayPaymentController.
 */
export default function PlatformGatewayPaymentPicker({
  purpose,
  payload,
  locale,
  disabled,
}: {
  purpose: Purpose;
  payload: Record<string, unknown>;
  locale: Locale;
  disabled?: boolean;
}) {
  const txt = t[locale];
  const [providers, setProviders] = useState<string[]>([]);
  const [payingProvider, setPayingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      const res = await fetch(`${API}/platform-gateway-payments/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const d = await res.json();
      const rows: Array<{ provider: string }> = d.data ?? [];
      setProviders(rows.map((r) => r.provider));
    })();
  }, []);

  if (providers.length === 0) return null;

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
        {providers.map((provider) => {
          const meta = gatewayProviderMeta(provider);
          const isPaying = payingProvider === provider;
          return (
            <button
              key={provider}
              type="button"
              disabled={disabled || payingProvider !== null}
              onClick={() => void pay(provider)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${meta?.badgeBg ?? "border-[var(--border)] bg-[var(--surface-soft)]"} ${meta?.badgeColor ?? "text-[var(--foreground)]"}`}
            >
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <span>{isPaying ? txt.paying : (meta?.label ?? provider)}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
