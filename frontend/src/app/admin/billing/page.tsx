"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CatvShell from "@/components/catv-shell";
import { buildAdminMenu } from "@/lib/admin-menu";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  LOCALE_STORAGE_KEY,
  normalizeRole,
  THEME_STORAGE_KEY,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

type PaymentStatus = "pending" | "approved" | "rejected";

interface SubscriptionPayment {
  id: number;
  amount: string;
  payment_method: string;
  sender_bkash_number: string | null;
  trx_id: string | null;
  screenshot_path: string | null;
  status: PaymentStatus;
  admin_note: string | null;
  created_at: string;
  user?: { id: number; name: string; mobile: string | null; email: string };
  package?: { id: number; name: string; slug: string; price: string };
  reviewer?: { id: number; name: string } | null;
}

const text = {
  bn: {
    title: "সাবস্ক্রিপশন বিলিং",
    subtitle: "মার্চেন্টদের bKash পেমেন্ট যাচাই ও অনুমোদন করুন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    menuDashboard: "ড্যাশবোর্ড", menuCustomers: "গ্রাহক", menuActive: "অ্যাকটিভ গ্রাহক", menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস", menuSmsGateway: "এসএমএস গেটওয়ে", menuSmsSend: "এসএমএস সেন্ড", menuSmsHistory: "এসএমএস হিস্টোরি", menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ", menuBilling: "বিলিং", menuReports: "রিপোর্ট", menuSettings: "সেটিংস", menuEmailSettings: "ইমেইল সেটিংস",
    languageLabel: "ভাষা", themeLabel: "থিম",
    gatewaysLinkText: "সাবস্ক্রিপশন/এসএমএস ক্রেডিট/অ্যাড-অন পেমেন্টের জন্য SSLCommerz, bKash সহ ৭টি মার্চেন্ট গেটওয়ে কনফিগার করতে চান? →",
    tabs: { pending: "পেন্ডিং", approved: "অনুমোদিত", rejected: "বাতিল", all: "সব" } as Record<string, string>,
    table: { user: "মার্চেন্ট", package: "প্যাকেজ", amount: "পরিমাণ", trxId: "TrxID", sender: "প্রেরকের নম্বর", date: "তারিখ", status: "স্ট্যাটাস", actions: "অ্যাকশন" },
    approve: "অনুমোদন করুন",
    reject: "বাতিল করুন",
    rejectPrompt: "বাতিলের কারণ (ঐচ্ছিক):",
    loading: "লোড হচ্ছে...",
    empty: "কোনো পেমেন্ট পাওয়া যায়নি।",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    statuses: { pending: "পেন্ডিং", approved: "অনুমোদিত", rejected: "বাতিল" } as Record<string, string>,
    screenshot: "স্ক্রিনশট",
  },
  en: {
    title: "Subscription Billing",
    subtitle: "Review and approve merchant bKash payments.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    menuDashboard: "Dashboard", menuCustomers: "Customers", menuActive: "Active Customers", menuPending: "Pending Customers",
    menuSms: "SMS", menuSmsGateway: "SMS Gateway", menuSmsSend: "Send SMS", menuSmsHistory: "SMS History", menuSmsCredit: "SMS Credit",
    menuPackages: "Packages", menuBilling: "Billing", menuReports: "Reports", menuSettings: "Settings", menuEmailSettings: "Email Settings",
    languageLabel: "Language", themeLabel: "Theme",
    gatewaysLinkText: "Want to configure SSLCommerz, bKash & 5 more merchant gateways for subscription/SMS credit/add-on payments? →",
    tabs: { pending: "Pending", approved: "Approved", rejected: "Rejected", all: "All" } as Record<string, string>,
    table: { user: "Merchant", package: "Package", amount: "Amount", trxId: "TrxID", sender: "Sender Number", date: "Date", status: "Status", actions: "Actions" },
    approve: "Approve",
    reject: "Reject",
    rejectPrompt: "Rejection reason (optional):",
    loading: "Loading...",
    empty: "No payments found.",
    error: "Request failed.",
    statuses: { pending: "Pending", approved: "Approved", rejected: "Rejected" } as Record<string, string>,
    screenshot: "Screenshot",
  },
};

export default function AdminBillingPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [tab, setTab] = useState<PaymentStatus | "all">("pending");
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  useEffect(() => {
    setLocale(getStoredLocale());
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      setState("unauthenticated");
      return;
    }
    if (normalizeRole(storedUser) !== "admin") {
      setState("forbidden");
      return;
    }
    setState("ready");
  }, []);

  const t = useMemo(() => text[locale], [locale]);

  const menu = useMemo(
    () =>
      buildAdminMenu(locale),
    [t],
  );

  const loadPayments = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const qs = tab === "all" ? "" : `?status=${tab}`;
      const res = await fetch(`${API_BASE_URL}/admin/subscription-payments${qs}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setPayments((data?.data ?? []) as SubscriptionPayment[]);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (state === "ready") {
      void loadPayments();
    }
  }, [state, loadPayments]);

  const approve = async (id: number) => {
    const token = getStoredToken();
    if (!token) return;
    setActingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subscription-payments/${id}/approve`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      await loadPayments();
    } catch {
      setError(t.error);
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: number) => {
    const token = getStoredToken();
    if (!token) return;
    const note = window.prompt(t.rejectPrompt) ?? "";
    setActingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subscription-payments/${id}/reject`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ admin_note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      await loadPayments();
    } catch {
      setError(t.error);
    } finally {
      setActingId(null);
    }
  };

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            {state === "forbidden" ? t.accessDenied : t.loginRequired}
          </p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
            {t.goHome}
          </a>
        </section>
      </main>
    );
  }

  return (
    <CatvShell
      title={t.title}
      subtitle={t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle="Admin Panel"
      userName={t.menuBilling}
      userMeta={t.menuBilling}
      menu={menu}
      activeKey="billing"
      defaultExpandedKey="customers"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel mb-5 p-4 sm:p-5">
        <a
          href="/admin/settings/platform-payment-gateways"
          className="inline-block text-xs font-semibold text-[var(--accent)] hover:underline"
        >
          {t.gatewaysLinkText}
        </a>
      </section>

      <section className="catv-panel mb-5 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                tab === s ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-soft)] text-[var(--muted)]"
              }`}
            >
              {t.tabs[s]}
            </button>
          ))}
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[var(--accent)] text-white">
              <tr>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.user}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.package}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.amount}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.trxId}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.sender}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.date}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.status}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-center font-semibold">{t.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="border border-[var(--border)] px-4 py-6 text-center text-[var(--muted)]">{t.loading}</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={8} className="border border-[var(--border)] px-4 py-6 text-center text-[var(--muted)]">{t.empty}</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="border border-[var(--border)] px-3 py-2">
                      <div className="font-semibold">{p.user?.name ?? "-"}</div>
                      <div className="text-xs text-[var(--muted)]">{p.user?.mobile ?? p.user?.email}</div>
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2">{p.package?.name ?? "-"}</td>
                    <td className="border border-[var(--border)] px-3 py-2">৳{Number(p.amount).toLocaleString()}</td>
                    <td className="border border-[var(--border)] px-3 py-2">{p.trx_id ?? "-"}</td>
                    <td className="border border-[var(--border)] px-3 py-2">{p.sender_bkash_number ?? "-"}</td>
                    <td className="border border-[var(--border)] px-3 py-2">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="border border-[var(--border)] px-3 py-2">{t.statuses[p.status] ?? p.status}</td>
                    <td className="border border-[var(--border)] px-3 py-2">
                      {p.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actingId === p.id}
                            onClick={() => void approve(p.id)}
                            className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-40"
                          >
                            {t.approve}
                          </button>
                          <button
                            type="button"
                            disabled={actingId === p.id}
                            onClick={() => void reject(p.id)}
                            className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-40"
                          >
                            {t.reject}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">{p.admin_note ?? "-"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </CatvShell>
  );
}
