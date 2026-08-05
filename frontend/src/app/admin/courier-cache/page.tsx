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

const COURIERS = ["pathao", "steadfast", "redx", "carrybee", "paperfly"] as const;
type CourierName = (typeof COURIERS)[number];
type CourierFilter = "all" | CourierName;
type StatusFilter = "all" | "ok" | "error";

const COURIER_BADGE: Record<CourierName, string> = {
  pathao: "bg-red-100 text-red-700",
  steadfast: "bg-teal-100 text-teal-700",
  redx: "bg-rose-100 text-rose-700",
  carrybee: "bg-amber-100 text-amber-800",
  paperfly: "bg-blue-100 text-blue-700",
};

const COURIER_LABEL: Record<CourierName, string> = {
  pathao: "Pathao",
  steadfast: "Steadfast",
  redx: "RedX",
  carrybee: "CarryBee",
  paperfly: "Paperfly",
};

interface CacheRow {
  id: number;
  phone_number: string;
  courier_name: string;
  data_type: "delivery" | "rating";
  total_parcels: number;
  total_delivered: number;
  total_cancelled: number;
  success_rate: number;
  rating: string | null;
  status: "ok" | "error";
  error_message: string | null;
  fetched_by: { id: number; name: string; email: string } | null;
  last_checked_at: string | null;
  is_fresh: boolean;
  created_at: string | null;
}

interface CourierSummary {
  total: number;
  ok: number;
  error: number;
}

interface Summary {
  total_cached: number;
  by_courier: Record<string, CourierSummary>;
}

const text = {
  bn: {
    title: "কুরিয়ার ডেলিভারি ক্যাশ",
    subtitle: "সব সেলারের জন্য শেয়ার্ড কুরিয়ার ডেলিভারি-হিস্টোরি ক্যাশ (courier_fraud_stats) দেখুন — কোনো কুরিয়ার API আবার কল হয় না।",
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
    menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ",
    menuBilling: "বিলিং",
    menuReports: "রিপোর্ট",
    menuSettings: "সেটিংস",
    menuEmailSettings: "ইমেইল সেটিংস",
    menuLandingPages: "ল্যান্ডিং পেজ",
    menuLandingTemplates: "ল্যান্ডিং টেমপ্লেট",
    menuCourierCache: "কুরিয়ার ক্যাশ",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    totalCached: "মোট ক্যাশড এন্ট্রি",
    filters: {
      phone: "ফোন নম্বর দিয়ে খুঁজুন",
      courier: "কুরিয়ার",
      courierAll: "সব কুরিয়ার",
      status: "স্ট্যাটাস",
      statusAll: "সব",
      statusOk: "সফল",
      statusError: "ব্যর্থ",
    },
    table: {
      phone: "ফোন নম্বর",
      courier: "কুরিয়ার",
      stats: "ডেলিভারি ডেটা",
      status: "স্ট্যাটাস",
      freshness: "ক্যাশ অবস্থা",
      fetchedBy: "যিনি ফেচ করেছেন",
      lastChecked: "শেষ চেক করা হয়েছে",
    },
    statOk: "সফল",
    statError: "ব্যর্থ",
    fresh: "ফ্রেশ",
    stale: "স্টেল (রিফ্রেশ যোগ্য)",
    total: "মোট",
    delivered: "ডেলিভারি",
    cancelled: "বাতিল",
    rate: "সাফল্যের হার",
    ratingLabel: "রেটিং",
    systemFetch: "সিস্টেম",
    loading: "লোড হচ্ছে...",
    empty: "কোনো ক্যাশড কুরিয়ার ডেটা পাওয়া যায়নি।",
    prev: "আগের",
    next: "পরের",
  },
  en: {
    title: "Courier Delivery Cache",
    subtitle: "Shared courier delivery-history cache (courier_fraud_stats) across all sellers — no courier API is re-queried here.",
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
    menuSmsCredit: "SMS Credit",
    menuPackages: "Packages",
    menuBilling: "Billing",
    menuReports: "Reports",
    menuSettings: "Settings",
    menuEmailSettings: "Email Settings",
    menuLandingPages: "Landing Pages",
    menuLandingTemplates: "Landing Templates",
    menuCourierCache: "Courier Cache",
    languageLabel: "Language",
    themeLabel: "Theme",
    totalCached: "Total Cached Entries",
    filters: {
      phone: "Search by phone number",
      courier: "Courier",
      courierAll: "All Couriers",
      status: "Status",
      statusAll: "All",
      statusOk: "OK",
      statusError: "Error",
    },
    table: {
      phone: "Phone",
      courier: "Courier",
      stats: "Delivery Data",
      status: "Status",
      freshness: "Cache State",
      fetchedBy: "Fetched By",
      lastChecked: "Last Checked",
    },
    statOk: "OK",
    statError: "Error",
    fresh: "Fresh",
    stale: "Stale (eligible for refresh)",
    total: "Total",
    delivered: "Delivered",
    cancelled: "Cancelled",
    rate: "Success Rate",
    ratingLabel: "Rating",
    systemFetch: "System",
    loading: "Loading...",
    empty: "No cached courier data found.",
    prev: "Prev",
    next: "Next",
  },
};

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";

export default function AdminCourierCachePage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [rows, setRows] = useState<CacheRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [phoneSearch, setPhoneSearch] = useState("");
  const [courierFilter, setCourierFilter] = useState<CourierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
        landingPages: t.menuLandingPages,
        landingTemplates: t.menuLandingTemplates,
        courierCache: t.menuCourierCache,
      }),
    [t],
  );

  const loadRows = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoadingRows(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "25" });
      if (phoneSearch.trim()) params.set("phone", phoneSearch.trim());
      if (courierFilter !== "all") params.set("courier", courierFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`${API_BASE_URL}/admin/courier-cache?${params.toString()}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        data?: CacheRow[];
        meta?: { last_page?: number };
        summary?: Summary;
      };
      if (res.ok) {
        setRows(data.data ?? []);
        setLastPage(data.meta?.last_page ?? 1);
        if (data.summary) setSummary(data.summary);
      }
    } catch {
      // silent — table just stays empty
    } finally {
      setLoadingRows(false);
    }
  }, [page, phoneSearch, courierFilter, statusFilter]);

  useEffect(() => {
    if (state === "ready") void loadRows();
  }, [state, loadRows]);

  useEffect(() => {
    setPage(1);
  }, [phoneSearch, courierFilter, statusFilter]);

  function formatDate(value: string | null): string {
    if (!value) return "-";
    return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
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
      userName={t.menuCourierCache}
      userMeta={t.backToAdmin}
      menu={menu}
      activeKey="courier-cache"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {/* Summary cards */}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
          <div className="bg-violet-600 px-3 py-2 text-sm font-bold text-white">{t.totalCached}</div>
          <div className="bg-[var(--surface)] px-3 py-3 text-center">
            <p className="text-2xl font-black text-[var(--foreground)]">{summary?.total_cached ?? 0}</p>
          </div>
        </div>
        {COURIERS.map((courier) => {
          const s = summary?.by_courier?.[courier] ?? { total: 0, ok: 0, error: 0 };
          return (
            <div key={courier} className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className={`px-3 py-2 text-sm font-bold ${COURIER_BADGE[courier]}`}>{COURIER_LABEL[courier]}</div>
              <div className="space-y-1 bg-[var(--surface)] px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">{t.total}</span>
                  <span className="font-bold text-[var(--foreground)]">{s.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">{t.statOk}</span>
                  <span className="font-semibold text-emerald-500">{s.ok}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">{t.statError}</span>
                  <span className="font-semibold text-red-500">{s.error}</span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Filters */}
      <section className="catv-panel mb-5 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls}>{t.filters.phone}</label>
            <input
              type="text"
              className={inputCls}
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              placeholder={t.filters.phone}
            />
          </div>
          <div>
            <label className={labelCls}>{t.filters.courier}</label>
            <select className={inputCls} value={courierFilter} onChange={(e) => setCourierFilter(e.target.value as CourierFilter)}>
              <option value="all">{t.filters.courierAll}</option>
              {COURIERS.map((c) => (
                <option key={c} value={c}>
                  {COURIER_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t.filters.status}</label>
            <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">{t.filters.statusAll}</option>
              <option value="ok">{t.filters.statusOk}</option>
              <option value="error">{t.filters.statusError}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="catv-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.phone}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.courier}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.stats}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.status}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.freshness}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.fetchedBy}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.lastChecked}</th>
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

              {!loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.empty}
                  </td>
                </tr>
              )}

              {!loadingRows &&
                rows.map((row) => {
                  const meta = row.courier_name in COURIER_BADGE ? (row.courier_name as CourierName) : null;
                  return (
                    <tr key={row.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff] align-top">
                      <td className="border border-[#e5ebf5] px-3 py-2 font-mono">{row.phone_number}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${meta ? COURIER_BADGE[meta] : "bg-slate-100 text-slate-700"}`}>
                          {meta ? COURIER_LABEL[meta] : row.courier_name}
                        </span>
                      </td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        {row.data_type === "rating" && row.rating ? (
                          <span className="text-xs text-[var(--muted)]">
                            {t.ratingLabel}: <span className="font-semibold text-[var(--foreground)]">{row.rating.replace(/_/g, " ")}</span>
                          </span>
                        ) : (
                          <div className="text-xs text-[var(--muted)]">
                            <div>
                              {t.total}: <span className="font-semibold text-[var(--foreground)]">{row.total_parcels}</span>
                              {" · "}
                              {t.delivered}: <span className="font-semibold text-emerald-500">{row.total_delivered}</span>
                              {" · "}
                              {t.cancelled}: <span className="font-semibold text-red-500">{row.total_cancelled}</span>
                            </div>
                            <div className="mt-0.5">
                              {t.rate}: <span className="font-semibold text-[var(--foreground)]">{row.success_rate}%</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            row.status === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {row.status === "ok" ? t.statOk : t.statError}
                        </span>
                        {row.status === "error" && row.error_message && (
                          <div className="mt-1 max-w-[220px] whitespace-pre-wrap break-words text-[10px] text-red-500">{row.error_message}</div>
                        )}
                      </td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            row.is_fresh ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {row.is_fresh ? t.fresh : t.stale}
                        </span>
                      </td>
                      <td className="border border-[#e5ebf5] px-3 py-2 text-xs">
                        {row.fetched_by ? (
                          <>
                            <div className="font-medium text-[var(--foreground)]">{row.fetched_by.name}</div>
                            <div className="text-[var(--muted)]">{row.fetched_by.email}</div>
                          </>
                        ) : (
                          <span className="text-[var(--muted)]">{t.systemFetch}</span>
                        )}
                      </td>
                      <td className="border border-[#e5ebf5] px-3 py-2 whitespace-nowrap">{formatDate(row.last_checked_at)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-[var(--border)] px-4 py-3 text-sm">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
            >
              {t.prev}
            </button>
            <span className="text-xs text-[var(--muted)]">
              {page}/{lastPage}
            </span>
            <button
              disabled={page === lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
            >
              {t.next}
            </button>
          </div>
        )}
      </section>
    </CatvShell>
  );
}
