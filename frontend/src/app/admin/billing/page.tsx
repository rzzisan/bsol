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
type BkashType = "Personal" | "Merchant" | "Agent";

interface BillingSettings {
  bkash_number: string | null;
  bkash_type: BkashType;
}

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
    settingsTitle: "পেমেন্ট রিসিভিং নম্বর",
    settingsDesc: "মার্চেন্টরা প্ল্যান কেনার সময় এই bKash নম্বরে টাকা পাঠাবে। এখানে পরিবর্তন করলে সাথে সাথে সব মার্চেন্টের পেমেন্ট পেজে আপডেট হয়ে যাবে।",
    bkashNumber: "bKash নম্বর",
    bkashType: "অ্যাকাউন্ট টাইপ",
    saveSettings: "সংরক্ষণ করুন",
    savingSettings: "সংরক্ষণ হচ্ছে...",
    settingsSaved: "বিলিং সেটিংস সংরক্ষণ হয়েছে।",
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
    settingsTitle: "Payment Receiving Number",
    settingsDesc: "Merchants will send money to this bKash number when buying a plan. Changing it here updates every merchant's payment page immediately.",
    bkashNumber: "bKash Number",
    bkashType: "Account Type",
    saveSettings: "Save Settings",
    savingSettings: "Saving...",
    settingsSaved: "Billing settings saved.",
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
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [tab, setTab] = useState<PaymentStatus | "all">("pending");
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const [settings, setSettings] = useState<BillingSettings>({ bkash_number: "", bkash_type: "Personal" });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

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
      buildAdminMenu({
        dashboard: t.menuDashboard,
        customers: t.menuCustomers,
        activeCustomers: t.menuActive,
        pendingCustomers: t.menuPending,
        sms: t.menuSms,
        smsGateway: t.menuSmsGateway,
        smsSend: t.menuSmsSend,
        smsHistory: t.menuSmsHistory,
        smsCredit: t.menuSmsCredit,
        packages: t.menuPackages,
        billing: t.menuBilling,
        reports: t.menuReports,
        settings: t.menuSettings,
        emailSettings: t.menuEmailSettings,
      }),
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

  const loadSettings = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/billing-settings`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.data) {
        setSettings({
          bkash_number: data.data.bkash_number ?? "",
          bkash_type: data.data.bkash_type ?? "Personal",
        });
      }
    } catch {
      // silent — form just stays empty
    }
  }, []);

  useEffect(() => {
    if (state === "ready") {
      void loadPayments();
      void loadSettings();
    }
  }, [state, loadPayments, loadSettings]);

  const saveSettings = async () => {
    const token = getStoredToken();
    if (!token) return;
    setSettingsSaving(true);
    setSettingsMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/billing-settings`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bkash_number: settings.bkash_number || null,
          bkash_type: settings.bkash_type,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setSettingsMessage(t.settingsSaved);
      await loadSettings();
    } catch {
      setError(t.error);
    } finally {
      setSettingsSaving(false);
    }
  };

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
        <h2 className="text-base font-semibold text-[var(--foreground)]">{t.settingsTitle}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.settingsDesc}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            placeholder={t.bkashNumber}
            value={settings.bkash_number ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, bkash_number: e.target.value }))}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          />
          <select
            value={settings.bkash_type}
            onChange={(e) => setSettings((s) => ({ ...s, bkash_type: e.target.value as BkashType }))}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          >
            {(["Personal", "Merchant", "Agent"] as const).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={settingsSaving}
            onClick={() => void saveSettings()}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {settingsSaving ? t.savingSettings : t.saveSettings}
          </button>
        </div>
        {settingsMessage ? <p className="mt-2 text-sm text-emerald-600">{settingsMessage}</p> : null}
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
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">{t.table.user}</th>
                <th className="px-3 py-2">{t.table.package}</th>
                <th className="px-3 py-2">{t.table.amount}</th>
                <th className="px-3 py-2">{t.table.trxId}</th>
                <th className="px-3 py-2">{t.table.sender}</th>
                <th className="px-3 py-2">{t.table.date}</th>
                <th className="px-3 py-2">{t.table.status}</th>
                <th className="px-3 py-2">{t.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-[var(--muted)]">{t.loading}</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-[var(--muted)]">{t.empty}</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)] align-top">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{p.user?.name ?? "-"}</div>
                      <div className="text-xs text-[var(--muted)]">{p.user?.mobile ?? p.user?.email}</div>
                    </td>
                    <td className="px-3 py-2">{p.package?.name ?? "-"}</td>
                    <td className="px-3 py-2">৳{Number(p.amount).toLocaleString()}</td>
                    <td className="px-3 py-2">{p.trx_id ?? "-"}</td>
                    <td className="px-3 py-2">{p.sender_bkash_number ?? "-"}</td>
                    <td className="px-3 py-2">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{t.statuses[p.status] ?? p.status}</td>
                    <td className="px-3 py-2">
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
