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

const text = {
  bn: {
    title: "গ্লোবাল ব্লকলিস্ট",
    subtitle: "সব সেলারের ব্লকলিস্ট এন্ট্রি একসাথে — security_hardening_context.md, pre_launch_polish_context.md §খ। যেকোনো একটা এন্ট্রিই বাকি সব সেলারের কাছে সেই ফোনের রিস্ক-স্কোর +৪০ করে দেয় — abuse সন্দেহ হলে এখান থেকে যাচাই করুন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    loading: "লোড হচ্ছে...",
    noEntries: "কোনো এন্ট্রি পাওয়া যায়নি।",
    colPhone: "ফোন",
    colSeller: "ব্লক করেছেন",
    colReason: "কারণ",
    colCorroboration: "কতজন সেলার ব্লক করেছেন",
    colDate: "তারিখ",
    filterPhone: "ফোন নম্বর খুঁজুন",
    prevPage: "পূর্ববর্তী",
    nextPage: "পরবর্তী",
    singleFlag: "শুধু ১ জন — একক অভিযোগ",
    corroborated: (n: number) => `${n} জন সেলার — সম্ভবত প্রকৃত সমস্যা`,
  },
  en: {
    title: "Global Blacklist",
    subtitle: "Every seller's blacklist entries in one place — security_hardening_context.md, pre_launch_polish_context.md §খ. Any single entry gives every other seller checking that phone a +40 risk-score bump — use this to investigate suspected abuse.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    languageLabel: "Language",
    themeLabel: "Theme",
    loading: "Loading...",
    noEntries: "No entries found.",
    colPhone: "Phone",
    colSeller: "Blocked by",
    colReason: "Reason",
    colCorroboration: "Sellers blocking this",
    colDate: "Date",
    filterPhone: "Filter by phone",
    prevPage: "Previous",
    nextPage: "Next",
    singleFlag: "Only 1 — single complaint",
    corroborated: (n: number) => `${n} sellers — likely a real issue`,
  },
};

interface BlacklistRow {
  id: number;
  phone: string;
  reason: string | null;
  blocked_at: string;
  created_at: string;
  seller_id: number;
  seller_name: string;
  seller_email: string;
  seller_count: number;
}

export default function AdminGlobalBlacklistPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [authState, setAuthState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [rows, setRows] = useState<BlacklistRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [phoneFilter, setPhoneFilter] = useState("");
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

  const loadEntries = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (phoneFilter) params.set("phone", phoneFilter);
      const res = await fetch(`${API_BASE_URL}/admin/global-blacklist?${params}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRows(data.data ?? []);
        setLastPage(data.last_page ?? 1);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, phoneFilter]);

  useEffect(() => {
    if (authState === "ready") void loadEntries();
  }, [authState, loadEntries]);

  const t = useMemo(() => text[locale], [locale]);
  const menu = useMemo(() => buildAdminMenu(locale), [locale]);

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
      subtitle={t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle="Admin Panel"
      userName="Global Blacklist"
      userMeta={t.title}
      menu={menu}
      activeKey="global-blacklist"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="catv-panel mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <input
            type="text"
            value={phoneFilter}
            onChange={(e) => { setPage(1); setPhoneFilter(e.target.value); }}
            placeholder={t.filterPhone}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[var(--accent)] text-white">
              <tr>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colPhone}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colSeller}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colReason}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colCorroboration}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colDate}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="border border-[var(--border)] px-4 py-6 text-center text-[var(--muted)]">
                    {t.loading}
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-[var(--border)] px-4 py-6 text-center text-[var(--muted)]">
                    {t.noEntries}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="bg-[var(--surface)] even:bg-[var(--surface-soft)] hover:bg-[var(--accent)]/10">
                    <td className="border border-[var(--border)] px-3 py-2 font-mono">{row.phone}</td>
                    <td className="border border-[var(--border)] px-3 py-2">
                      <span>{row.seller_name}</span>
                      <span className="ml-2 text-xs text-[var(--muted)]">{row.seller_email}</span>
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 text-[var(--muted)]">{row.reason ?? "—"}</td>
                    <td className="border border-[var(--border)] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          row.seller_count > 1 ? "bg-red-500/15 text-red-500" : "bg-[var(--muted)]/15 text-[var(--muted)]"
                        }`}
                      >
                        {row.seller_count > 1 ? t.corroborated(row.seller_count) : t.singleFlag}
                      </span>
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 whitespace-nowrap text-xs text-[var(--muted)]">
                      {new Date(row.blocked_at).toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {lastPage > 1 && (
          <div className="flex items-center justify-between p-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40"
            >
              {t.prevPage}
            </button>
            <span className="text-sm text-[var(--muted)]">{page} / {lastPage}</span>
            <button
              type="button"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40"
            >
              {t.nextPage}
            </button>
          </div>
        )}
      </div>
    </CatvShell>
  );
}
