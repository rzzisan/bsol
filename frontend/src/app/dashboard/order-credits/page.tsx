"use client";

import { useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import PlatformGatewayPaymentPicker from "@/components/platform-gateway-payment-picker";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

/**
 * Order-credit add-on purchase — subscription_billing_context.md §9.2-B /
 * §9.6 step 3. Pays via the platform's automated merchant gateways
 * (PlatformGatewayPaymentPicker) — the old manual "send bKash + submit
 * TrxID" flow was removed (online_payment_context.md §12), admin approve
 * still applies to any pre-existing pending manual purchase.
 */

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    title: "অর্ডার ক্রেডিট Add-on",
    subtitle: "মাসিক প্যাকেজ লিমিট শেষ হয়ে গেলে অতিরিক্ত অর্ডার প্রসেস করতে ক্রেডিট কিনুন।",
    balance: "ব্যবহারযোগ্য ক্রেডিট",
    expiresOn: "মেয়াদ শেষ",
    noExpiry: "কোনো সক্রিয় মেয়াদ নেই",
    packages: "প্যাকেজ কিনুন",
    orders: "টি অর্ডার",
    days: "দিন মেয়াদ",
    buy: "কিনুন",
    noPackages: "এই মুহূর্তে কোনো প্যাকেজ চালু নেই।",
    payTitle: "পেমেন্ট করুন",
    cancel: "বাতিল",
    historyTitle: "ক্রয়ের ইতিহাস",
    noHistory: "এখনো কোনো ক্রয় নেই।",
    statusPending: "পর্যালোচনাধীন",
    statusApproved: "অনুমোদিত",
    statusRejected: "প্রত্যাখ্যাত",
    genericError: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",
  },
  en: {
    title: "Order Credit Add-on",
    subtitle: "Buy credits to process orders past your plan's monthly limit.",
    balance: "Available credit",
    expiresOn: "Expires on",
    noExpiry: "No active validity",
    packages: "Buy a package",
    orders: "orders",
    days: "days validity",
    buy: "Buy",
    noPackages: "No packages available right now.",
    payTitle: "Make payment",
    cancel: "Cancel",
    historyTitle: "Purchase history",
    noHistory: "No purchases yet.",
    statusPending: "Pending review",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    genericError: "Something went wrong, please try again.",
  },
};

type AddonPackageRow = { id: number; name: string; price: string; quantity: number; duration_days: number };
type PurchaseRow = {
  id: number; amount: string; status: "pending" | "approved" | "rejected"; created_at: string;
  addon_package: { name: string } | null;
};
type Balance = {
  available_balance: number; expires_at: string | null;
  payment_instructions: { bkash_number: string | null; bkash_type: string | null };
};

export default function OrderCreditsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const txt = t[locale];
  const token = getStoredToken();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [balance, setBalance] = useState<Balance | null>(null);
  const [packages, setPackages] = useState<AddonPackageRow[]>([]);
  const [history, setHistory] = useState<PurchaseRow[]>([]);
  const [buying, setBuying] = useState<AddonPackageRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [balRes, pkgRes, histRes] = await Promise.all([
      fetch(`${API}/order-credits/balance`, { headers: authHeaders }),
      fetch(`${API}/order-credits/packages`, { headers: authHeaders }),
      fetch(`${API}/order-credits/purchases`, { headers: authHeaders }),
    ]);
    const [balJson, pkgJson, histJson] = await Promise.all([balRes.json(), pkgRes.json(), histRes.json()]);
    if (balRes.ok) setBalance(balJson.data);
    if (pkgRes.ok) setPackages(pkgJson.data ?? []);
    if (histRes.ok) setHistory(histJson.data ?? []);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = (s: PurchaseRow["status"]) =>
    s === "approved" ? txt.statusApproved : s === "rejected" ? txt.statusRejected : txt.statusPending;
  const statusColor = (s: PurchaseRow["status"]) =>
    s === "approved" ? "text-emerald-500 bg-emerald-500/10" : s === "rejected" ? "text-red-400 bg-red-500/10" : "text-amber-500 bg-amber-500/10";

  return (
    <UserShell locale={locale} onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      activeKey="order-credits"
      defaultExpandedKey="settings"
      pageTitle={{ bn: t.bn.title, en: t.en.title }}
      pageSubtitle={{ bn: t.bn.subtitle, en: t.en.subtitle }}
    >
      <section className="catv-panel p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{txt.balance}</p>
        <p className="mt-1 text-3xl font-bold text-[var(--accent)]">{balance?.available_balance ?? 0}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {balance?.expires_at
            ? `${txt.expiresOn}: ${new Date(balance.expires_at).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB")}`
            : txt.noExpiry}
        </p>
      </section>

      <section className="catv-panel mt-4 p-4 sm:p-5">
        <h3 className="text-base font-semibold">{txt.packages}</h3>
        {packages.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{txt.noPackages}</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <div key={p.id} className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {p.quantity} {txt.orders} · {p.duration_days} {txt.days}
                </p>
                <p className="mt-2 text-xl font-bold">৳{p.price}</p>
                <button
                  type="button"
                  onClick={() => {
                    setBuying(p);
                    setError(null);
                  }}
                  className="mt-3 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                >
                  {txt.buy}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {buying && (
        <section className="catv-panel mt-4 p-4 sm:p-5">
          <h3 className="text-base font-semibold">{txt.payTitle} — {buying.name} (৳{buying.price})</h3>

          <PlatformGatewayPaymentPicker
            purpose="order_credit"
            payload={{ addon_package_id: buying.id }}
            locale={locale}
          />

          {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setBuying(null)}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]"
            >
              {txt.cancel}
            </button>
          </div>
        </section>
      )}

      <section className="catv-panel mt-4 p-4 sm:p-5">
        <h3 className="text-base font-semibold">{txt.historyTitle}</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{txt.noHistory}</p>
        ) : (
          <div className="mt-3 divide-y divide-[var(--border)]">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold">{h.addon_package?.name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{new Date(h.created_at).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB")}</p>
                </div>
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
