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

const text = {
  bn: {
    title: "অ্যাডমিন ড্যাশবোর্ড",
    subtitle: "সিস্টেম ম্যানেজমেন্ট, গ্রাহক এবং প্যাকেজ মনিটর করার কেন্দ্রীয় কন্ট্রোল প্যানেল।",
    loginRequired: "অ্যাডমিন ড্যাশবোর্ড দেখতে হলে আগে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন ইউজার এই পেজে প্রবেশ করতে পারবেন।",
    goHome: "হোমে যান",
    searchPlaceholder: "গ্রাহক সার্চ করুন",
    sidebarTitle: "অ্যাডমিন প্যানেল",
    welcome: "স্বাগতম",
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
    stats: [
      { label: "মোট গ্রাহক", value: "5584", hint: "বর্তমান সক্রিয় + নিষ্ক্রিয় গ্রাহক" },
      { label: "রানিং ক্লায়েন্ট", value: "4627", hint: "সার্ভিস সচল আছে" },
      { label: "ইনঅ্যাকটিভ ক্লায়েন্ট", value: "251", hint: "সার্ভিস বন্ধ রয়েছে" },
      { label: "নতুন গ্রাহক", value: "56", hint: "এই মাসে নতুন যোগ হয়েছে" },
    ],
    sectionA: "Zone Wise Problem Occurrence",
    sectionB: "Sub-Zone Wise Problem Occurrence",
    sectionC: "Monthly New Client",
    quickRows: [
      { label: "Pending Tickets", value: "9", tone: "bg-red-500/90" },
      { label: "Processing Tickets", value: "10", tone: "bg-amber-500/90" },
      { label: "Pending Task", value: "1", tone: "bg-red-600/90" },
      { label: "Processing Task", value: "0", tone: "bg-amber-600/90" },
    ],
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    collapse: "কলাপস",
    expand: "এক্সপ্যান্ড",
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
    stats: [
      { label: "Total Clients", value: "5584", hint: "Current active + inactive clients" },
      { label: "Running Clients", value: "4627", hint: "Currently in active service" },
      { label: "Inactive Clients", value: "251", hint: "Service currently stopped" },
      { label: "New Clients", value: "56", hint: "Added this month" },
    ],
    sectionA: "Zone Wise Problem Occurrence",
    sectionB: "Sub-Zone Wise Problem Occurrence",
    sectionC: "Monthly New Client",
    quickRows: [
      { label: "Pending Tickets", value: "9", tone: "bg-red-500/90" },
      { label: "Processing Tickets", value: "10", tone: "bg-amber-500/90" },
      { label: "Pending Task", value: "1", tone: "bg-red-600/90" },
      { label: "Processing Task", value: "0", tone: "bg-amber-600/90" },
    ],
    languageLabel: "Language",
    themeLabel: "Theme",
    collapse: "Collapse",
    expand: "Expand",
  },
};

export default function AdminDashboardPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

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

    setUser(storedUser);
    setState("ready");
  }, []);

  const t = useMemo(() => text[locale], [locale]);
  const menus = useMemo(
    () =>
      buildAdminMenu({
        dashboard: t.menu.dashboard,
        customers: t.menu.customers,
        activeCustomers: t.menu.activeCustomers,
        pendingCustomers: t.menu.pendingCustomers,
        sms: t.menu.sms,
        smsGateway: t.menu.smsGateway,
        smsSend: t.menu.smsSend,
        smsHistory: t.menu.smsHistory,
        smsCredit: t.menu.smsCredit,
        packages: t.menu.packages,
        billing: t.menu.billing,
        reports: t.menu.reports,
        settings: t.menu.settings,
        emailSettings: t.menu.emailSettings,
      }),
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

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {t.stats.map((stat, idx) => (
          <article
            key={stat.label}
            className={`rounded-xl p-4 text-white shadow-md ${
              idx % 4 === 0
                ? "bg-[#2f7ec1]"
                : idx % 4 === 1
                  ? "bg-[#0f7c7b]"
                  : idx % 4 === 2
                    ? "bg-[#4c8bd6]"
                    : "bg-[#ff7a59]"
            }`}
          >
            <p className="text-sm font-semibold">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold">{stat.value}</p>
            <p className="mt-2 text-xs text-white/85">{stat.hint}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-12">
        <article className="catv-panel p-4 lg:col-span-4">
          <h3 className="text-base font-semibold">{t.sectionA}</h3>
          <div className="mt-4 flex h-52 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] text-sm text-[var(--muted)]">
            Pie chart placeholder
          </div>
        </article>

        <article className="catv-panel p-4 lg:col-span-4">
          <h3 className="text-base font-semibold">{t.sectionB}</h3>
          <div className="mt-4 flex h-52 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] text-sm text-[var(--muted)]">
            Donut chart placeholder
          </div>
        </article>

        <article className="space-y-2 lg:col-span-4">
          {t.quickRows.map((row) => (
            <div key={row.label} className={`rounded-xl p-3 text-white shadow ${row.tone}`}>
              <p className="text-sm font-semibold">{row.label}</p>
              <p className="text-2xl font-bold">{row.value}</p>
            </div>
          ))}
        </article>
      </section>

      <section className="catv-panel mt-4 p-4">
        <h3 className="text-base font-semibold">{t.sectionC}</h3>
        <div className="mt-4 flex h-56 items-end gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4">
          {[53, 57, 59, 56].map((n, idx) => (
            <div key={n} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-t ${idx % 2 === 0 ? "bg-[#2f7ec1]" : "bg-[#ff7a59]"}`}
                style={{ height: `${n * 2}px` }}
              />
              <span className="text-xs text-[var(--muted)]">{n}</span>
            </div>
          ))}
        </div>
      </section>
    </CatvShell>
  );
}
