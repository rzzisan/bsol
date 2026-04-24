"use client";

import { useEffect, useMemo, useState } from "react";
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
      packages: "প্যাকেজ",
      billing: "বিলিং",
      reports: "রিপোর্ট",
      settings: "সেটিংস",
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
      packages: "Packages",
      billing: "Billing",
      reports: "Reports",
      settings: "Settings",
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

type MenuItem = {
  key: string;
  label: string;
  icon: string;
  children?: Array<{ key: string; label: string }>;
};

export default function AdminDashboardPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>("customers");
  const [activeItem, setActiveItem] = useState("dashboard");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

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
  const menus = useMemo<MenuItem[]>(
    () => [
      { key: "dashboard", label: t.menu.dashboard, icon: "🏠" },
      {
        key: "customers",
        label: t.menu.customers,
        icon: "👥",
        children: [
          { key: "customers-active", label: t.menu.activeCustomers },
          { key: "customers-pending", label: t.menu.pendingCustomers },
        ],
      },
      { key: "packages", label: t.menu.packages, icon: "📦" },
      { key: "billing", label: t.menu.billing, icon: "💳" },
      { key: "reports", label: t.menu.reports, icon: "📊" },
      { key: "settings", label: t.menu.settings, icon: "⚙️" },
    ],
    [t],
  );

  function onMenuClick(menu: MenuItem) {
    if (menu.children?.length) {
      setExpandedMenu((prev) => (prev === menu.key ? null : menu.key));
      return;
    }
    setActiveItem(menu.key);
  }

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
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex min-h-screen">
        <aside
          className={`border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-300 ${
            isSidebarCollapsed ? "w-20" : "w-72"
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4">
            {!isSidebarCollapsed && (
              <h2 className="truncate text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
                {t.sidebarTitle}
              </h2>
            )}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs font-semibold"
            >
              {isSidebarCollapsed ? t.expand : t.collapse}
            </button>
          </div>

          <nav className="space-y-1 p-3">
            {menus.map((menu) => {
              const isExpanded = expandedMenu === menu.key;
              const hasChildren = Boolean(menu.children?.length);

              return (
                <div key={menu.key}>
                  <button
                    type="button"
                    onClick={() => onMenuClick(menu)}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium transition ${
                      activeItem === menu.key || isExpanded
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <span className="mr-3 text-base">{menu.icon}</span>
                    {!isSidebarCollapsed && <span className="flex-1 text-left">{menu.label}</span>}
                    {!isSidebarCollapsed && hasChildren && <span className="text-xs">{isExpanded ? "▾" : "▸"}</span>}
                  </button>

                  {!isSidebarCollapsed && hasChildren && isExpanded && (
                    <div className="mt-1 space-y-1 pl-10">
                      {menu.children?.map((child) => (
                        <button
                          key={child.key}
                          type="button"
                          onClick={() => setActiveItem(child.key)}
                          className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                            activeItem === child.key
                              ? "bg-[var(--accent)]/20 text-[var(--foreground)]"
                              : "text-[var(--muted)] hover:bg-[var(--surface-soft)]"
                          }`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <section className="flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[#1f4565] px-4 py-3 text-white sm:px-6">
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <span className="text-sm font-semibold">{t.title}</span>
              <input
                placeholder={t.searchPlaceholder}
                className="h-9 w-full rounded-full border border-white/30 bg-white/10 px-4 text-sm text-white placeholder-white/70 outline-none sm:w-72"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold"
              >
                {t.languageLabel}: {locale === "bn" ? "বাংলা" : "English"}
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold"
              >
                {t.themeLabel}: {theme === "dark" ? "Dark" : "Light"}
              </button>
            </div>
          </header>

          <div className="p-4 sm:p-6">
            <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h1 className="text-xl font-bold sm:text-2xl">{t.welcome}, {user?.name}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>
            </div>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {t.stats.map((stat, idx) => (
                <article
                  key={stat.label}
                  className={`rounded-xl p-4 text-white ${
                    idx % 4 === 0
                      ? "bg-sky-600"
                      : idx % 4 === 1
                        ? "bg-cyan-600"
                        : idx % 4 === 2
                          ? "bg-indigo-500"
                          : "bg-slate-600"
                  }`}
                >
                  <p className="text-sm font-semibold">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold">{stat.value}</p>
                  <p className="mt-2 text-xs text-white/85">{stat.hint}</p>
                </article>
              ))}
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-12">
              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:col-span-4">
                <h3 className="text-base font-semibold">{t.sectionA}</h3>
                <div className="mt-4 flex h-52 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] text-sm text-[var(--muted)]">
                  Pie chart placeholder
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:col-span-4">
                <h3 className="text-base font-semibold">{t.sectionB}</h3>
                <div className="mt-4 flex h-52 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] text-sm text-[var(--muted)]">
                  Donut chart placeholder
                </div>
              </article>

              <article className="space-y-2 lg:col-span-4">
                {t.quickRows.map((row) => (
                  <div key={row.label} className={`rounded-xl p-3 text-white ${row.tone}`}>
                    <p className="text-sm font-semibold">{row.label}</p>
                    <p className="text-2xl font-bold">{row.value}</p>
                  </div>
                ))}
              </article>
            </section>

            <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-base font-semibold">{t.sectionC}</h3>
              <div className="mt-4 flex h-56 items-end gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4">
                {[53, 57, 59, 56].map((n, idx) => (
                  <div key={n} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className={`w-full rounded-t ${idx % 2 === 0 ? "bg-sky-500" : "bg-orange-500"}`}
                      style={{ height: `${n * 2}px` }}
                    />
                    <span className="text-xs text-[var(--muted)]">{n}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
