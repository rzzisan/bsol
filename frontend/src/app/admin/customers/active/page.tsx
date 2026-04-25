"use client";

import { useEffect, useMemo, useState } from "react";
import CatvShell, { type ShellMenuItem } from "@/components/catv-shell";
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

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  role: "admin" | "user";
  created_at: string;
}

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const text = {
  bn: {
    title: "অ্যাকটিভ গ্রাহক",
    subtitle: "সকল রেজিস্টার্ড ইউজার টেবিল আকারে দেখানো হচ্ছে।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    backToAdmin: "অ্যাডমিন ড্যাশবোর্ড",
    menuDashboard: "ড্যাশবোর্ড",
    menuCustomers: "গ্রাহক",
    menuActive: "অ্যাকটিভ গ্রাহক",
    menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস",
    menuSmsGateway: "এসএমএস গেটওয়ে",
    menuSmsSend: "এসএমএস সেন্ড",
    menuSmsHistory: "এসএমএস হিস্টোরি",
    menuPackages: "প্যাকেজ",
    loading: "ডাটা লোড হচ্ছে...",
    empty: "কোনো ইউজার পাওয়া যায়নি।",
    table: {
      id: "ID",
      name: "নাম",
      email: "ইমেইল",
      mobile: "মোবাইল",
      role: "রোল",
      date: "রেজিস্টার্ড তারিখ",
      status: "স্ট্যাটাস",
    },
    languageLabel: "ভাষা",
    themeLabel: "থিম",
  },
  en: {
    title: "Active Customers",
    subtitle: "All registered users are listed in table format.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    backToAdmin: "Admin Dashboard",
    menuDashboard: "Dashboard",
    menuCustomers: "Customers",
    menuActive: "Active Customers",
    menuPending: "Pending Customers",
    menuSms: "SMS",
    menuSmsGateway: "SMS Gateway",
    menuSmsSend: "Send SMS",
    menuSmsHistory: "SMS History",
    menuPackages: "Packages",
    loading: "Loading data...",
    empty: "No users found.",
    table: {
      id: "ID",
      name: "Name",
      email: "Email",
      mobile: "Mobile",
      role: "Role",
      date: "Registered Date",
      status: "Status",
    },
    languageLabel: "Language",
    themeLabel: "Theme",
  },
};

export default function ActiveCustomersPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (state !== "ready") return;

    const token = getStoredToken();
    if (!token) return;

    async function loadUsers() {
      setLoadingRows(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/users`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.message ?? "Failed to load users.");
          return;
        }

        setRows((data?.users ?? []) as AdminUserRow[]);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoadingRows(false);
      }
    }

    void loadUsers();
  }, [state]);

  const t = useMemo(() => text[locale], [locale]);

  const menu = useMemo<ShellMenuItem[]>(
    () => [
      { key: "dashboard", label: t.menuDashboard, href: "/admin", icon: "🏠" },
      {
        key: "customers",
        label: t.menuCustomers,
        icon: "👥",
        children: [
          { key: "customers-active", label: t.menuActive, href: "/admin/customers/active" },
          { key: "customers-pending", label: t.menuPending },
        ],
      },
      {
        key: "sms",
        label: t.menuSms,
        icon: "✉️",
        children: [
          { key: "sms-gateway", label: t.menuSmsGateway, href: "/admin/sms/gateways" },
          { key: "sms-send", label: t.menuSmsSend, href: "/admin/sms/send" },
          { key: "sms-history", label: t.menuSmsHistory, href: "/admin/sms/history" },
        ],
      },
      { key: "packages", label: t.menuPackages, icon: "📦" },
    ],
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
      sidebarTitle="Admin Panel"
      userName={t.menuCustomers}
      userMeta={t.backToAdmin}
      menu={menu}
      activeKey="customers-active"
      defaultExpandedKey="customers"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="catv-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.id}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.name}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.email}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.mobile}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.role}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.date}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.status}</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr>
                  <td colSpan={7} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.loading}
                  </td>
                </tr>
              )}

              {!loadingRows && error && (
                <tr>
                  <td colSpan={7} className="border border-[#e5ebf5] px-4 py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}

              {!loadingRows && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.empty}
                  </td>
                </tr>
              )}

              {!loadingRows &&
                !error &&
                rows.map((row) => (
                  <tr key={row.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                    <td className="border border-[#e5ebf5] px-3 py-2">{row.id}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2 font-medium">{row.name}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2">{row.email}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2">{row.mobile ?? "-"}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          row.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {row.role}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </CatvShell>
  );
}
