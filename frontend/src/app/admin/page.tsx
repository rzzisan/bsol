"use client";

import { useEffect, useMemo, useState } from "react";
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
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const text = {
  bn: {
    title: "অ্যাডমিন ড্যাশবোর্ড",
    subtitle: "সিস্টেম ম্যানেজমেন্ট, গ্রাহক এবং প্যাকেজ মনিটর করার কেন্দ্রীয় কন্ট্রোল প্যানেল।",
    loginRequired: "অ্যাডমিন ড্যাশবোর্ড দেখতে হলে আগে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন ইউজার এই পেজে প্রবেশ করতে পারবেন।",
    goHome: "হোমে যান",
    searchPlaceholder: "গ্রাহক সার্চ করুন",
    sidebarTitle: "অ্যাডমিন প্যানেল",
    welcome: "স্বাগতম",
    loading: "লোড হচ্ছে...",
    noDefaultPackageWarning: "⚠️ কোনো ডিফল্ট রেজিস্ট্রেশন প্যাকেজ সেট নেই — নতুন সেলাররা কোনো লিমিট ছাড়াই রেজিস্টার করছে।",
    noDefaultPackageFix: "প্যাকেজ পেজে গিয়ে ঠিক করুন",
    menu: {
      dashboard: "ড্যাশবোর্ড",
      customers: "গ্রাহক",
      activeCustomers: "অ্যাকটিভ গ্রাহক",
      pendingCustomers: "পেন্ডিং গ্রাহক",
      sms: "এসএমএস",
      smsGateway: "এসএমএস গেটওয়ে",
      smsSend: "এসএমএস সেন্ড",
      smsHistory: "এসএমএস হিস্টোরি",
      smsCredit: "এসএমএস ক্রেডিট",
      packages: "প্যাকেজ",
      billing: "বিলিং",
      reports: "রিপোর্ট",
      settings: "সেটিংস",
      emailSettings: "ইমেইল সেটিংস",
    },
    statLabels: {
      activeSellers: "অ্যাকটিভ সেলার",
      inactiveSellers: "ইনঅ্যাকটিভ সেলার",
      newThisMonth: "এই মাসে নতুন",
      activePackages: "অ্যাকটিভ প্যাকেজ",
    },
    pendingTitle: "যা এখনই দেখা দরকার",
    pendingLabels: {
      subscription_payments: "পেন্ডিং সাবস্ক্রিপশন পেমেন্ট",
      sms_credit_purchases: "পেন্ডিং SMS ক্রেডিট পারচেজ",
      addon_purchases: "পেন্ডিং অ্যাডঅন পারচেজ",
      unread_support: "আনরিড সাপোর্ট মেসেজ",
    },
    packageDistTitle: "প্যাকেজ অনুযায়ী সেলার বণ্টন",
    noPackages: "কোনো অ্যাকটিভ প্যাকেজ নেই।",
    recentTitle: "সাম্প্রতিক রেজিস্ট্রেশন",
    noRecent: "এখনো কোনো সেলার নেই।",
    colName: "নাম",
    colStatus: "স্ট্যাটাস",
    colDate: "তারিখ",
    monthlyTitle: "মাসিক নতুন রেজিস্ট্রেশন (গত ৬ মাস)",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
  },
  en: {
    title: "Admin Dashboard",
    subtitle: "Central control panel for customer, package, and operations management.",
    loginRequired: "Please login as an admin to access the admin dashboard.",
    accessDenied: "Only admin users can access this page.",
    goHome: "Go Home",
    searchPlaceholder: "Search customer",
    sidebarTitle: "Admin Panel",
    welcome: "Welcome",
    loading: "Loading...",
    noDefaultPackageWarning: "⚠️ No default registration package is set — new sellers are registering with no limits at all.",
    noDefaultPackageFix: "Fix it on the Packages page",
    menu: {
      dashboard: "Dashboard",
      customers: "Customers",
      activeCustomers: "Active Customers",
      pendingCustomers: "Pending Customers",
      sms: "SMS",
      smsGateway: "SMS Gateway",
      smsSend: "Send SMS",
      smsHistory: "SMS History",
      smsCredit: "SMS Credit",
      packages: "Packages",
      billing: "Billing",
      reports: "Reports",
      settings: "Settings",
      emailSettings: "Email Settings",
    },
    statLabels: {
      activeSellers: "Active sellers",
      inactiveSellers: "Inactive sellers",
      newThisMonth: "New this month",
      activePackages: "Active packages",
    },
    pendingTitle: "Needs your attention now",
    pendingLabels: {
      subscription_payments: "Pending subscription payments",
      sms_credit_purchases: "Pending SMS credit purchases",
      addon_purchases: "Pending addon purchases",
      unread_support: "Unread support messages",
    },
    packageDistTitle: "Sellers by package",
    noPackages: "No active packages.",
    recentTitle: "Recent registrations",
    noRecent: "No sellers yet.",
    colName: "Name",
    colStatus: "Status",
    colDate: "Date",
    monthlyTitle: "New registrations (last 6 months)",
    languageLabel: "Language",
    themeLabel: "Theme",
  },
};

type Summary = {
  totals: {
    sellers: number;
    active_sellers: number;
    inactive_sellers: number;
    new_sellers_this_month: number;
    admins: number;
    active_packages: number;
  };
  pending_actions: {
    subscription_payments: number;
    sms_credit_purchases: number;
    addon_purchases: number;
  };
  package_distribution: { name: string; sellers: number }[];
  monthly_registrations: { month: string; label: string; total: number }[];
  recent_users: { id: number; name: string; email: string; mobile: string | null; user_status: string; created_at: string }[];
  config_warnings?: { no_default_package: boolean };
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-500",
  pending: "bg-yellow-500/15 text-yellow-500",
  inactive: "bg-zinc-500/15 text-zinc-400",
  expired: "bg-red-500/15 text-red-400",
  left: "bg-red-500/15 text-red-400",
};

export default function AdminDashboardPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [unreadSupport, setUnreadSupport] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(true);

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

    setUser(storedUser);
    setState("ready");

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/admin/summary`, { headers }).then((res) => (res.ok ? res.json() : null)),
      fetch(`${API}/admin/support/unread-count`, { headers }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([summaryJson, unreadJson]) => {
        if (summaryJson) setSummary(summaryJson);
        if (unreadJson?.count !== undefined) setUnreadSupport(unreadJson.count);
      })
      .finally(() => setLoadingSummary(false));
  }, []);

  const t = useMemo(() => text[locale], [locale]);
  const menus = useMemo(
    () =>
      buildAdminMenu(locale),
    [t],
  );

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            {state === "forbidden" ? t.accessDenied : t.loginRequired}
          </p>
          <a
            href="/"
            className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            {t.goHome}
          </a>
        </section>
      </main>
    );
  }

  const stats = summary
    ? [
        { label: t.statLabels.activeSellers, value: summary.totals.active_sellers, tone: "bg-[var(--accent)]" },
        { label: t.statLabels.inactiveSellers, value: summary.totals.inactive_sellers, tone: "bg-[#4c8bd6]" },
        { label: t.statLabels.newThisMonth, value: summary.totals.new_sellers_this_month, tone: "bg-[#ff7a59]" },
        { label: t.statLabels.activePackages, value: summary.totals.active_packages, tone: "bg-[#2f7ec1]" },
      ]
    : [];

  const pendingRows = summary
    ? [
        { key: "subscription_payments", value: summary.pending_actions.subscription_payments, href: "/admin/billing" },
        { key: "sms_credit_purchases", value: summary.pending_actions.sms_credit_purchases, href: "/admin/sms/credit" },
        { key: "addon_purchases", value: summary.pending_actions.addon_purchases, href: "/admin/addon-packages" },
        { key: "unread_support", value: unreadSupport, href: "/admin/support" },
      ]
    : [];

  const maxPackageSellers = Math.max(1, ...(summary?.package_distribution.map((p) => p.sellers) ?? [1]));
  const maxMonthlyTotal = Math.max(1, ...(summary?.monthly_registrations.map((m) => m.total) ?? [1]));

  return (
    <CatvShell
      title={t.title}
      subtitle={t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle={t.sidebarTitle}
      searchPlaceholder={t.searchPlaceholder}
      userName={user?.name}
      userMeta={user?.email}
      menu={menus}
      activeKey="dashboard"
      defaultExpandedKey="customers"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel p-4 sm:p-5">
        <h2 className="text-xl font-bold sm:text-2xl">
          {t.welcome}, {user?.name}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>
      </section>

      {summary?.config_warnings?.no_default_package && (
        <section className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          <span>{t.noDefaultPackageWarning}</span>
          <a href="/admin/packages" className="font-semibold underline">{t.noDefaultPackageFix}</a>
        </section>
      )}

      {loadingSummary ? (
        <p className="mt-4 text-sm text-[var(--muted)]">{t.loading}</p>
      ) : (
        <>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article key={stat.label} className={`rounded-xl p-4 text-white shadow-md ${stat.tone}`}>
                <p className="text-sm font-semibold">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold">{stat.value.toLocaleString()}</p>
              </article>
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-12">
            <article className="catv-panel p-4 lg:col-span-4">
              <h3 className="text-base font-semibold">{t.packageDistTitle}</h3>
              {summary && summary.package_distribution.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {summary.package_distribution.map((p) => (
                    <div key={p.name}>
                      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                        <span>{p.name}</span>
                        <span>{p.sellers}</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${(p.sellers / maxPackageSellers) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">{t.noPackages}</p>
              )}
            </article>

            <article className="catv-panel p-4 lg:col-span-8">
              <h3 className="text-base font-semibold">{t.recentTitle}</h3>
              {summary && summary.recent_users.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                        <th className="px-2 py-2 font-medium">{t.colName}</th>
                        <th className="px-2 py-2 font-medium">{t.colStatus}</th>
                        <th className="px-2 py-2 font-medium">{t.colDate}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recent_users.map((u) => (
                        <tr key={u.id} className="border-b border-[var(--border)]/50">
                          <td className="px-2 py-2">
                            <p className="font-medium text-[var(--foreground)]">{u.name}</p>
                            <p className="text-[var(--muted)]">{u.email}</p>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[u.user_status] ?? ""}`}>
                              {u.user_status}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-[var(--muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">{t.noRecent}</p>
              )}
            </article>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-12">
            <article className="catv-panel p-4 lg:col-span-4">
              <h3 className="text-base font-semibold">{t.pendingTitle}</h3>
              <div className="mt-3 space-y-2">
                {pendingRows.map((row) => (
                  <a
                    key={row.key}
                    href={row.href}
                    className={`flex items-center justify-between rounded-xl p-3 text-white shadow transition hover:opacity-90 ${
                      row.value > 0 ? "bg-red-500/90" : "bg-zinc-500/60"
                    }`}
                  >
                    <span className="text-sm font-semibold">{t.pendingLabels[row.key as keyof typeof t.pendingLabels]}</span>
                    <span className="text-xl font-bold">{row.value}</span>
                  </a>
                ))}
              </div>
            </article>

            <article className="catv-panel p-4 lg:col-span-8">
              <h3 className="text-base font-semibold">{t.monthlyTitle}</h3>
              <div className="mt-4 flex h-56 items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                {summary?.monthly_registrations.map((m, idx) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--foreground)]">{m.total}</span>
                    <div
                      className={`w-full rounded-t ${idx % 2 === 0 ? "bg-[#2f7ec1]" : "bg-[#ff7a59]"}`}
                      style={{ height: `${Math.max(4, (m.total / maxMonthlyTotal) * 160)}px` }}
                    />
                    <span className="text-xs text-[var(--muted)]">{m.label}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </CatvShell>
  );
}
