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

interface SellerUsage {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  package_name: string | null;
  daily_limit: number | null;
  accepted: number;
  dropped: number;
  overage: number;
  sent: number;
  failed: number;
  destinations_count: number;
}

const text = {
  bn: {
    title: "ট্র্যাকিং ব্যবহার",
    subtitle: "প্রতিটা সেলারের আজকের ট্র্যাকিং ইভেন্ট ব্যবহার একনজরে — tracking_capi_context.md §5.2।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    menuDashboard: "ড্যাশবোর্ড",
    menuCustomers: "গ্রাহক",
    menuActive: "অ্যাকটিভ গ্রাহক",
    menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস",
    menuSmsGateway: "এসএমএস গেটওয়ে",
    menuSmsSend: "এসএমএস সেন্ড",
    menuSmsHistory: "এসএমএস হিস্টোরি",
    menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ",
    menuBilling: "বিলিং",
    menuReports: "রিপোর্ট",
    menuSettings: "সেটিংস",
    menuEmailSettings: "ইমেইল সেটিংস",
    menuTracking: "ট্র্যাকিং ব্যবহার",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    loading: "লোড হচ্ছে...",
    noSellers: "কোনো সেলার নেই।",
    colSeller: "সেলার",
    colPackage: "প্যাকেজ",
    colUsage: "আজকের ব্যবহার",
    colDropped: "বাদ পড়েছে",
    colOverage: "লিমিটের বাইরে",
    colFailed: "ব্যর্থ",
    colDestinations: "ডেস্টিনেশন",
    unlimited: "আনলিমিটেড",
    noPackage: "প্যাকেজ নেই",
    asOf: (date: string) => `তারিখ: ${date} (এশিয়া/ঢাকা)`,
  },
  en: {
    title: "Tracking Usage",
    subtitle: "Every seller's tracking event usage for today, in one screen — tracking_capi_context.md §5.2.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    menuDashboard: "Dashboard",
    menuCustomers: "Customers",
    menuActive: "Active Customers",
    menuPending: "Pending Customers",
    menuSms: "SMS",
    menuSmsGateway: "SMS Gateway",
    menuSmsSend: "Send SMS",
    menuSmsHistory: "SMS History",
    menuSmsCredit: "SMS Credit",
    menuPackages: "Packages",
    menuBilling: "Billing",
    menuReports: "Reports",
    menuSettings: "Settings",
    menuEmailSettings: "Email Settings",
    menuTracking: "Tracking Usage",
    languageLabel: "Language",
    themeLabel: "Theme",
    loading: "Loading...",
    noSellers: "No sellers found.",
    colSeller: "Seller",
    colPackage: "Package",
    colUsage: "Used Today",
    colDropped: "Dropped",
    colOverage: "Overage",
    colFailed: "Failed",
    colDestinations: "Destinations",
    unlimited: "Unlimited",
    noPackage: "No package",
    asOf: (date: string) => `As of: ${date} (Asia/Dhaka)`,
  },
};

export default function AdminTrackingUsagePage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [authState, setAuthState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [sellers, setSellers] = useState<SellerUsage[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!token || !storedUser) { setAuthState("unauthenticated"); return; }
    if (normalizeRole(storedUser) !== "admin") { setAuthState("forbidden"); return; }
    setAuthState("ready");
  }, []);

  const loadUsage = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/tracking/usage`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { data?: SellerUsage[]; date?: string };
      if (res.ok) {
        setSellers(data.data ?? []);
        setDate(data.date ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authState === "ready") void loadUsage();
  }, [authState, loadUsage]);

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
        tracking: t.menuTracking,
      }),
    [t],
  );

  if (authState !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            {authState === "forbidden" ? t.accessDenied : t.loginRequired}
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
      subtitle={date ? `${t.subtitle} ${t.asOf(date)}` : t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle="Admin Panel"
      userName="Tracking Usage"
      userMeta={t.title}
      menu={menu}
      activeKey="tracking"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="catv-panel mb-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colSeller}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colPackage}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colUsage}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colDropped}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colOverage}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colFailed}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colDestinations}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.loading}
                  </td>
                </tr>
              )}
              {!loading && sellers.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.noSellers}
                  </td>
                </tr>
              )}
              {!loading &&
                sellers.map((s) => (
                  <tr key={s.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                    <td className="border border-[#e5ebf5] px-3 py-2 font-medium">
                      <span>{s.name}</span>
                      <span className="ml-2 text-xs text-[var(--muted)]">{s.email}</span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">{s.package_name ?? t.noPackage}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right">
                      <span
                        className={`rounded px-2 py-1 text-xs font-bold ${
                          s.accepted > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {s.accepted.toLocaleString()}
                        {s.daily_limit !== null ? ` / ${s.daily_limit.toLocaleString()}` : ` / ${t.unlimited}`}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right">
                      {s.dropped > 0 ? <span className="text-orange-600">{s.dropped.toLocaleString()}</span> : "—"}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right">
                      {s.overage > 0 ? <span className="text-red-600">{s.overage.toLocaleString()}</span> : "—"}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right">
                      {s.failed > 0 ? <span className="text-red-600">{s.failed.toLocaleString()}</span> : "—"}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right">{s.destinations_count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </CatvShell>
  );
}
