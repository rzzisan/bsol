"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CatvShell from "@/components/catv-shell";
import { buildAdminMenu } from "@/lib/admin-menu";
import { COURIER_META, ratingDisplay } from "@/components/courier/courier-delivery-report";
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

interface CourierCell {
  id: number;
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
}

interface PhoneRow {
  phone_number: string;
  last_checked_at: string | null;
  couriers: Partial<Record<CourierName, CourierCell | null>>;
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
      courier: "কুরিয়ার (শুধু এই কুরিয়ারে ক্যাশ আছে এমন ফোন)",
      courierAll: "সব কুরিয়ার",
      status: "স্ট্যাটাস",
      statusAll: "সব",
      statusOk: "সফল",
      statusError: "ব্যর্থ",
    },
    table: {
      phone: "ফোন নম্বর",
      lastChecked: "সর্বশেষ আপডেট",
    },
    statOk: "সফল",
    statError: "ব্যর্থ",
    fresh: "ফ্রেশ",
    stale: "স্টেল (রিফ্রেশ যোগ্য)",
    total: "মোট",
    delivered: "ডেলিভারি",
    cancelled: "বাতিল",
    notCached: "ক্যাশ নেই",
    fetchedByLabel: "ফেচ করেছেন",
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
      courier: "Courier (only phones cached for this courier)",
      courierAll: "All Couriers",
      status: "Status",
      statusAll: "All",
      statusOk: "OK",
      statusError: "Error",
    },
    table: {
      phone: "Phone",
      lastChecked: "Last Updated",
    },
    statOk: "OK",
    statError: "Error",
    fresh: "Fresh",
    stale: "Stale (eligible for refresh)",
    total: "Total",
    delivered: "Delivered",
    cancelled: "Cancelled",
    notCached: "Not cached",
    fetchedByLabel: "Fetched by",
    systemFetch: "System",
    loading: "Loading...",
    empty: "No cached courier data found.",
    prev: "Prev",
    next: "Next",
  },
};

type Txt = (typeof text)["bn"];

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";

function CourierCellView({ cell, locale, t }: { cell: CourierCell | null | undefined; locale: Locale; t: Txt }) {
  if (!cell) {
    return <div className="py-2 text-center text-xs text-[var(--muted)]">{t.notCached}</div>;
  }

  const tooltip = [
    cell.last_checked_at ? new Date(cell.last_checked_at).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB") : null,
    cell.fetched_by ? `${t.fetchedByLabel}: ${cell.fetched_by.name}` : `${t.fetchedByLabel}: ${t.systemFetch}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const freshnessDot = (
    <span
      title={cell.is_fresh ? t.fresh : t.stale}
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${cell.is_fresh ? "bg-emerald-500" : "bg-amber-500"}`}
    />
  );

  if (cell.status === "error") {
    return (
      <div className="py-1 text-center" title={tooltip}>
        <div className="flex items-center justify-center gap-1 text-xs font-semibold text-red-500">
          {freshnessDot}
          {t.statError}
        </div>
        {cell.error_message && (
          <p className="mx-auto mt-0.5 max-w-[140px] truncate text-[9px] text-[var(--muted)]">{cell.error_message}</p>
        )}
      </div>
    );
  }

  if (cell.data_type === "rating" && cell.rating) {
    const r = ratingDisplay(cell.rating, locale);
    return (
      <div className="py-1 text-center" title={tooltip}>
        <div className="flex items-center justify-center gap-1">
          {freshnessDot}
          <span className={`text-xs font-bold ${r.color}`}>{r.label}</span>
        </div>
        {r.estimate && <p className="mt-0.5 text-[9px] text-[var(--muted)]">{r.estimate}</p>}
      </div>
    );
  }

  return (
    <div className="py-1 text-center" title={tooltip}>
      <div className="flex items-center justify-center gap-1">
        {freshnessDot}
        <span className="text-sm font-bold text-emerald-500">{cell.success_rate}%</span>
      </div>
      <p className="mt-0.5 text-[9px] text-[var(--muted)]">
        {t.total}:{cell.total_parcels} · {t.delivered}:{cell.total_delivered} · {t.cancelled}:{cell.total_cancelled}
      </p>
    </div>
  );
}

export default function AdminCourierCachePage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [rows, setRows] = useState<PhoneRow[]>([]);
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
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (phoneSearch.trim()) params.set("phone", phoneSearch.trim());
      if (courierFilter !== "all") params.set("courier", courierFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`${API_BASE_URL}/admin/courier-cache?${params.toString()}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        data?: PhoneRow[];
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
          const meta = COURIER_META[courier];
          return (
            <div key={courier} className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className={`px-3 py-2 text-sm font-bold text-white ${meta.header}`}>{meta.label}</div>
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
                  {COURIER_META[c].label}
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

      {/* Table: one row per phone, one column per courier */}
      <section className="catv-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-[#d7e1ee] bg-[#2f7ec1] px-3 py-2 text-left font-semibold text-white">{t.table.phone}</th>
                <th className="border border-[#d7e1ee] bg-[#2f7ec1] px-3 py-2 text-left font-semibold text-white">{t.table.lastChecked}</th>
                {COURIERS.map((c) => (
                  <th key={c} className={`border border-[#d7e1ee] px-3 py-2 text-center font-semibold text-white ${COURIER_META[c].header}`}>
                    {COURIER_META[c].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr>
                  <td colSpan={2 + COURIERS.length} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.loading}
                  </td>
                </tr>
              )}

              {!loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={2 + COURIERS.length} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.empty}
                  </td>
                </tr>
              )}

              {!loadingRows &&
                rows.map((row) => (
                  <tr key={row.phone_number} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff] align-middle">
                    <td className="border border-[#e5ebf5] px-3 py-2 font-mono">{row.phone_number}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2 whitespace-nowrap text-xs text-[var(--muted)]">
                      {formatDate(row.last_checked_at)}
                    </td>
                    {COURIERS.map((c) => (
                      <td key={c} className="border border-[#e5ebf5] px-2 py-1">
                        <CourierCellView cell={row.couriers[c]} locale={locale} t={t} />
                      </td>
                    ))}
                  </tr>
                ))}
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
