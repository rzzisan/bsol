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
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

interface SmsHistoryRow {
  id: string;
  gateway_id: number | null;
  gateway_name: string | null;
  provider: string | null;
  phone_number: string;
  message: string;
  status: "sent" | "failed";
  http_status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string | null;
  source?: string;
  event_type?: string;
}

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const text = {
  bn: {
    title: "এসএমএস হিস্টোরি",
    subtitle: "Zyro-style সব SMS log এক জায়গায় দেখুন ও ট্র্যাক করুন।",
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
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    filters: {
      search: "সার্চ (ফোন/মেসেজ/গেটওয়ে)",
      status: "স্ট্যাটাস",
      all: "সব",
      sent: "Sent",
      failed: "Failed",
      apply: "ফিল্টার",
      reset: "রিসেট",
    },
    loading: "SMS history লোড হচ্ছে...",
    empty: "কোনো SMS history পাওয়া যায়নি।",
    pagination: {
      showing: "দেখানো হচ্ছে",
      of: "মোট",
      prev: "পূর্ববর্তী",
      next: "পরবর্তী",
    },
    table: {
      id: "ID",
      type: "Type",
      date: "তারিখ",
      gateway: "গেটওয়ে",
      phone: "ফোন",
      message: "মেসেজ",
      status: "স্ট্যাটাস",
      code: "HTTP",
      response: "Response / Error",
    },
  },
  en: {
    title: "SMS History",
    subtitle: "View and track all SMS logs in a Zyro-style history table.",
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
    languageLabel: "Language",
    themeLabel: "Theme",
    filters: {
      search: "Search (phone/message/gateway)",
      status: "Status",
      all: "All",
      sent: "Sent",
      failed: "Failed",
      apply: "Apply",
      reset: "Reset",
    },
    loading: "Loading SMS history...",
    empty: "No SMS history found.",
    pagination: {
      showing: "Showing",
      of: "of",
      prev: "Previous",
      next: "Next",
    },
    table: {
      id: "ID",
      type: "Type",
      date: "Date",
      gateway: "Gateway",
      phone: "Phone",
      message: "Message",
      status: "Status",
      code: "HTTP",
      response: "Response / Error",
    },
  },
};

export default function AdminSmsHistoryPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [rows, setRows] = useState<SmsHistoryRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ current_page: 1, last_page: 1, per_page: 50, total: 0 });
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed">("all");
  const [page, setPage] = useState(1);

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

  async function loadHistory(currentPage: number) {
    const token = getStoredToken();
    if (!token) return;

    setLoadingRows(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("per_page", "50");
      if (searchInput.trim()) params.set("search", searchInput.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`${API_BASE_URL}/admin/sms/history?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Failed to load SMS history.");
        return;
      }

      setRows((data?.histories ?? []) as SmsHistoryRow[]);
      setMeta((data?.meta ?? { current_page: 1, last_page: 1, per_page: 50, total: 0 }) as PaginationMeta);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    if (state !== "ready") return;
    void loadHistory(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, page]);

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

  function applyFilters() {
    setPage(1);
    void loadHistory(1);
  }

  function resetFilters() {
    setSearchInput("");
    setStatusFilter("all");
    setPage(1);
    setTimeout(() => {
      void loadHistory(1);
    }, 0);
  }

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
      userName={t.menuSms}
      userMeta={t.menuSmsHistory}
      menu={menu}
      activeKey="sms-history"
      defaultExpandedKey="sms"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto]">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.filters.search}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "sent" | "failed")}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
          >
            <option value="all">{t.filters.status}: {t.filters.all}</option>
            <option value="sent">{t.filters.status}: {t.filters.sent}</option>
            <option value="failed">{t.filters.status}: {t.filters.failed}</option>
          </select>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            {t.filters.apply}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
          >
            {t.filters.reset}
          </button>
        </div>
      </section>

      <section className="catv-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.id}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.type}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.date}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.gateway}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.phone}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.message}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.status}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.code}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.response}</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr>
                  <td colSpan={9} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.loading}
                  </td>
                </tr>
              )}

              {!loadingRows && error && (
                <tr>
                  <td colSpan={9} className="border border-[#e5ebf5] px-4 py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}

              {!loadingRows && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.empty}
                  </td>
                </tr>
              )}

              {!loadingRows && !error && rows.map((row) => (
                <tr key={row.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                  <td className="border border-[#e5ebf5] px-3 py-2">{row.id}</td>
                  <td className="border border-[#e5ebf5] px-3 py-2">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {row.event_type ?? "sms_send"}
                    </span>
                  </td>
                  <td className="border border-[#e5ebf5] px-3 py-2 whitespace-nowrap">
                    {new Date(row.created_at ?? row.sent_at ?? Date.now()).toLocaleString()}
                  </td>
                  <td className="border border-[#e5ebf5] px-3 py-2">
                    {row.gateway_name ?? "-"}
                    {row.provider ? <span className="ml-1 text-xs text-[var(--muted)]">({row.provider})</span> : null}
                  </td>
                  <td className="border border-[#e5ebf5] px-3 py-2">{row.phone_number}</td>
                  <td className="border border-[#e5ebf5] px-3 py-2">
                    <div className="max-w-[260px] whitespace-pre-wrap break-words">{row.message}</div>
                  </td>
                  <td className="border border-[#e5ebf5] px-3 py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        row.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="border border-[#e5ebf5] px-3 py-2">{row.http_status_code ?? "-"}</td>
                  <td className="border border-[#e5ebf5] px-3 py-2">
                    <div className="max-w-[300px] whitespace-pre-wrap break-words text-xs">
                      {row.error_message || row.response_body || "-"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <p>
          {t.pagination.showing} {rows.length} {t.pagination.of} {meta.total}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={meta.current_page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-50"
          >
            {t.pagination.prev}
          </button>
          <button
            type="button"
            disabled={meta.current_page >= meta.last_page}
            onClick={() => setPage((prev) => Math.min(meta.last_page, prev + 1))}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-50"
          >
            {t.pagination.next}
          </button>
        </div>
      </section>
    </CatvShell>
  );
}
