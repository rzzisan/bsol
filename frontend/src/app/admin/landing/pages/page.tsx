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

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

type PageStatus = "draft" | "published";
type StatusFilter = "all" | PageStatus;
type LockFilter = "all" | "locked" | "unlocked";

interface SellerInfo {
  id: number;
  name: string;
  email: string | null;
  mobile: string | null;
}

interface AdminLandingPageRow {
  id: number;
  title: string;
  slug: string;
  status: PageStatus;
  admin_locked: boolean;
  admin_lock_reason: string | null;
  admin_locked_at: string | null;
  admin_locked_by: { id: number; name: string } | null;
  product_count: number;
  template: { id: number; name_bn: string; name_en: string } | null;
  seller: SellerInfo | null;
  published_at: string | null;
  created_at: string;
}

const text = {
  bn: {
    title: "ল্যান্ডিং পেজ (সব সেলার)",
    subtitle: "সকল সেলারের তৈরি করা ল্যান্ডিং পেজ দেখুন এবং প্রয়োজনে পাবলিশ লক করুন।",
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
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    filters: {
      searchPlaceholder: "টাইটেল বা স্লাগ দিয়ে খুঁজুন",
      sellerPlaceholder: "সেলারের নাম/ইমেইল/মোবাইল",
      status: "স্ট্যাটাস",
      statusAll: "সব",
      statusDraft: "ড্রাফট",
      statusPublished: "পাবলিশড",
      lock: "লক",
      lockAll: "সব",
      lockLocked: "লকড",
      lockUnlocked: "আনলকড",
    },
    table: {
      seller: "সেলার",
      page: "পেজ",
      status: "স্ট্যাটাস",
      products: "প্রোডাক্ট",
      lockStatus: "লক স্ট্যাটাস",
      createdAt: "তৈরির তারিখ",
      actions: "অ্যাকশন",
    },
    loading: "লোড হচ্ছে...",
    empty: "কোনো ল্যান্ডিং পেজ পাওয়া যায়নি।",
    statusDraft: "ড্রাফট",
    statusPublished: "পাবলিশড",
    lockedBadge: "লকড",
    unlockedBadge: "আনলকড",
    lockBtn: "পাবলিশ লক করুন",
    unlockBtn: "আনলক করুন",
    viewPublic: "পাবলিক পেজ দেখুন",
    lockedByLine: "লক করেছেন",
    lockedAtLine: "লক করার সময়",
    reasonLine: "কারণ",
    lockModalTitle: "ল্যান্ডিং পেজ পাবলিশ লক করুন",
    lockModalHint:
      "লক করলে পেজটি সাথে সাথে আনপাবলিশ হয়ে যাবে এবং সেলার নিজে থেকে আর পাবলিশ করতে পারবে না। সেলারকে দেখানোর জন্য একটি কারণ লিখুন।",
    reasonLabel: "লক করার কারণ",
    reasonPlaceholder: "যেমন: প্রোডাক্টের তথ্য নীতিমালা লঙ্ঘন করছে...",
    reasonRequired: "লক করার কারণ লিখা আবশ্যক।",
    confirm: "নিশ্চিত করুন",
    cancel: "বাতিল",
    submitting: "প্রসেস হচ্ছে...",
    unlockConfirmTitle: "লক খুলবেন?",
    unlockConfirmMsg: "সেলার আবার এই পেজটি পাবলিশ করতে পারবে। নিশ্চিত?",
    lockFailed: "লক করা যায়নি।",
    unlockFailed: "আনলক করা যায়নি।",
    lockSuccess: "পেজটি লক করা হয়েছে।",
    unlockSuccess: "পেজটি আনলক করা হয়েছে।",
    noSeller: "অজানা সেলার",
    prev: "আগের",
    next: "পরের",
  },
  en: {
    title: "Landing Pages (All Sellers)",
    subtitle: "View every seller's landing pages and lock publishing when needed.",
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
    languageLabel: "Language",
    themeLabel: "Theme",
    filters: {
      searchPlaceholder: "Search by title or slug",
      sellerPlaceholder: "Seller name/email/mobile",
      status: "Status",
      statusAll: "All",
      statusDraft: "Draft",
      statusPublished: "Published",
      lock: "Lock",
      lockAll: "All",
      lockLocked: "Locked",
      lockUnlocked: "Unlocked",
    },
    table: {
      seller: "Seller",
      page: "Page",
      status: "Status",
      products: "Products",
      lockStatus: "Lock Status",
      createdAt: "Created At",
      actions: "Actions",
    },
    loading: "Loading...",
    empty: "No landing pages found.",
    statusDraft: "Draft",
    statusPublished: "Published",
    lockedBadge: "Locked",
    unlockedBadge: "Unlocked",
    lockBtn: "Lock Publish",
    unlockBtn: "Unlock",
    viewPublic: "View Public Page",
    lockedByLine: "Locked by",
    lockedAtLine: "Locked at",
    reasonLine: "Reason",
    lockModalTitle: "Lock Landing Page Publishing",
    lockModalHint:
      "Locking will immediately unpublish this page and the seller won't be able to publish it again on their own. Enter a reason to show the seller.",
    reasonLabel: "Lock reason",
    reasonPlaceholder: "e.g. product info violates policy...",
    reasonRequired: "A lock reason is required.",
    confirm: "Confirm",
    cancel: "Cancel",
    submitting: "Processing...",
    unlockConfirmTitle: "Unlock this page?",
    unlockConfirmMsg: "The seller will be able to publish this page again. Are you sure?",
    lockFailed: "Failed to lock the page.",
    unlockFailed: "Failed to unlock the page.",
    lockSuccess: "Page has been locked.",
    unlockSuccess: "Page has been unlocked.",
    noSeller: "Unknown seller",
    prev: "Prev",
    next: "Next",
  },
};

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";

export default function AdminLandingPagesPage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<
    "loading" | "unauthenticated" | "forbidden" | "ready"
  >("loading");

  const [rows, setRows] = useState<AdminLandingPageRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [sellerSearch, setSellerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lockFilter, setLockFilter] = useState<LockFilter>("all");

  const [lockTarget, setLockTarget] = useState<AdminLandingPageRow | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [lockSubmitting, setLockSubmitting] = useState(false);
  const [lockError, setLockError] = useState("");

  const [unlockTarget, setUnlockTarget] = useState<AdminLandingPageRow | null>(null);
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);

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
      }),
    [t],
  );

  const loadRows = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoadingRows(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (sellerSearch.trim()) params.set("seller", sellerSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (lockFilter !== "all") params.set("locked", lockFilter === "locked" ? "1" : "0");

      const res = await fetch(`${API_BASE_URL}/admin/landing/pages?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as {
        data?: AdminLandingPageRow[];
        meta?: { last_page?: number };
      };
      if (res.ok) {
        setRows(data.data ?? []);
        setLastPage(data.meta?.last_page ?? 1);
      }
    } catch {
      // silent — table just stays empty
    } finally {
      setLoadingRows(false);
    }
  }, [page, search, sellerSearch, statusFilter, lockFilter]);

  useEffect(() => {
    if (state === "ready") void loadRows();
  }, [state, loadRows]);

  useEffect(() => {
    setPage(1);
  }, [search, sellerSearch, statusFilter, lockFilter]);

  function openLockModal(row: AdminLandingPageRow) {
    setLockReason("");
    setLockError("");
    setLockTarget(row);
  }

  async function handleLockConfirm() {
    if (!lockTarget) return;
    if (!lockReason.trim()) {
      setLockError(t.reasonRequired);
      return;
    }
    const token = getStoredToken();
    if (!token) return;
    setLockSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/landing/pages/${lockTarget.id}/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: lockReason.trim() }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setMessage({ type: "err", text: data.message ?? t.lockFailed });
        return;
      }
      setMessage({ type: "ok", text: data.message ?? t.lockSuccess });
      setLockTarget(null);
      void loadRows();
    } catch {
      setMessage({ type: "err", text: t.lockFailed });
    } finally {
      setLockSubmitting(false);
    }
  }

  async function handleUnlockConfirm() {
    if (!unlockTarget) return;
    const token = getStoredToken();
    if (!token) return;
    setUnlockSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/landing/pages/${unlockTarget.id}/unlock`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setMessage({ type: "err", text: data.message ?? t.unlockFailed });
        return;
      }
      setMessage({ type: "ok", text: data.message ?? t.unlockSuccess });
      setUnlockTarget(null);
      void loadRows();
    } catch {
      setMessage({ type: "err", text: t.unlockFailed });
    } finally {
      setUnlockSubmitting(false);
    }
  }

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
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
            {t.title}
          </h1>
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
      userName={t.menuLandingPages}
      userMeta={t.backToAdmin}
      menu={menu}
      activeKey="landing-pages-all"
      defaultExpandedKey="landing"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel mb-5 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className={labelCls}>{t.filters.searchPlaceholder}</label>
            <input
              type="text"
              className={inputCls}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.filters.searchPlaceholder}
            />
          </div>
          <div>
            <label className={labelCls}>{t.filters.sellerPlaceholder}</label>
            <input
              type="text"
              className={inputCls}
              value={sellerSearch}
              onChange={(e) => setSellerSearch(e.target.value)}
              placeholder={t.filters.sellerPlaceholder}
            />
          </div>
          <div>
            <label className={labelCls}>{t.filters.status}</label>
            <select
              className={inputCls}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">{t.filters.statusAll}</option>
              <option value="draft">{t.filters.statusDraft}</option>
              <option value="published">{t.filters.statusPublished}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t.filters.lock}</label>
            <select
              className={inputCls}
              value={lockFilter}
              onChange={(e) => setLockFilter(e.target.value as LockFilter)}
            >
              <option value="all">{t.filters.lockAll}</option>
              <option value="locked">{t.filters.lockLocked}</option>
              <option value="unlocked">{t.filters.lockUnlocked}</option>
            </select>
          </div>
        </div>

        {message && (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              message.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}
      </section>

      <section className="catv-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.seller}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.page}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.status}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.table.products}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.lockStatus}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.createdAt}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-center font-semibold">{t.table.actions}</th>
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
                rows.map((row) => (
                  <tr key={row.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff] align-top">
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <div className="font-medium text-[var(--foreground)]">
                        {row.seller?.name ?? t.noSeller}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {[row.seller?.mobile, row.seller?.email].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <div className="font-medium text-[var(--foreground)]">{row.title}</div>
                      <div className="text-xs text-[var(--muted)]">/{row.slug}</div>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          row.status === "published"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {row.status === "published" ? t.statusPublished : t.statusDraft}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right">{row.product_count}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          row.admin_locked
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.admin_locked ? t.lockedBadge : t.unlockedBadge}
                      </span>
                      {row.admin_locked && (
                        <div className="mt-1 max-w-xs text-xs text-[var(--muted)]">
                          {row.admin_locked_by && (
                            <div>
                              {t.lockedByLine}: {row.admin_locked_by.name}
                            </div>
                          )}
                          {row.admin_locked_at && (
                            <div>
                              {t.lockedAtLine}: {formatDate(row.admin_locked_at)}
                            </div>
                          )}
                          {row.admin_lock_reason && (
                            <div className="mt-0.5 whitespace-pre-wrap break-words">
                              {t.reasonLine}: {row.admin_lock_reason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">{formatDate(row.created_at)}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        {row.status === "published" && (
                          <a
                            href={`/lp/${row.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100"
                          >
                            {t.viewPublic}
                          </a>
                        )}
                        {row.admin_locked ? (
                          <button
                            onClick={() => setUnlockTarget(row)}
                            className="rounded px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          >
                            {t.unlockBtn}
                          </button>
                        ) : (
                          <button
                            onClick={() => openLockModal(row)}
                            className="rounded px-2 py-1 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            {t.lockBtn}
                          </button>
                        )}
                      </div>
                    </td>
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
            <span className="text-xs text-[var(--muted)]">{page}/{lastPage}</span>
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

      {/* ── Lock Modal ── */}
      {lockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-[var(--foreground)]">
              {t.lockModalTitle}: <span className="text-[var(--accent)]">{lockTarget.title}</span>
            </h3>
            <p className="mb-4 text-sm text-[var(--muted)]">{t.lockModalHint}</p>
            <div>
              <label className={labelCls}>{t.reasonLabel}</label>
              <textarea
                className={`${inputCls} min-h-[100px]`}
                value={lockReason}
                onChange={(e) => {
                  setLockReason(e.target.value);
                  if (lockError) setLockError("");
                }}
                placeholder={t.reasonPlaceholder}
              />
              {lockError && <p className="mt-1 text-xs text-red-600">{lockError}</p>}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                disabled={lockSubmitting}
                onClick={() => void handleLockConfirm()}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {lockSubmitting ? t.submitting : t.confirm}
              </button>
              <button
                onClick={() => setLockTarget(null)}
                className="rounded-lg border border-[var(--border)] px-5 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-soft)]"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unlock Confirm Modal ── */}
      {unlockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-[var(--foreground)]">{t.unlockConfirmTitle}</h3>
            <p className="mb-5 text-sm text-[var(--muted)]">
              <strong>{unlockTarget.title}</strong> — {t.unlockConfirmMsg}
            </p>
            <div className="flex gap-3">
              <button
                disabled={unlockSubmitting}
                onClick={() => void handleUnlockConfirm()}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {unlockSubmitting ? t.submitting : t.confirm}
              </button>
              <button
                onClick={() => setUnlockTarget(null)}
                className="rounded-lg border border-[var(--border)] px-5 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-soft)]"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </CatvShell>
  );
}
