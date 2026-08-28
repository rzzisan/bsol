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
    title: "অডিট লগ",
    subtitle: "সব অ্যাডমিনের গুরুত্বপূর্ণ কার্যক্রমের রেকর্ড — security_hardening_context.md §৩।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    loading: "লোড হচ্ছে...",
    noLogs: "কোনো লগ পাওয়া যায়নি।",
    colTime: "সময়",
    colAdmin: "অ্যাডমিন",
    colAction: "অ্যাকশন",
    colTarget: "টার্গেট",
    colIp: "IP",
    filterAction: "অ্যাকশন খুঁজুন",
    prevPage: "পূর্ববর্তী",
    nextPage: "পরবর্তী",
  },
  en: {
    title: "Audit Log",
    subtitle: "Record of every admin's sensitive actions — security_hardening_context.md §3.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    languageLabel: "Language",
    themeLabel: "Theme",
    loading: "Loading...",
    noLogs: "No log entries found.",
    colTime: "Time",
    colAdmin: "Admin",
    colAction: "Action",
    colTarget: "Target",
    colIp: "IP",
    filterAction: "Filter by action",
    prevPage: "Previous",
    nextPage: "Next",
  },
};

interface AuditLogRow {
  id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  admin: { id: number; name: string; email: string } | null;
}

interface PaginatedResponse {
  data: AuditLogRow[];
  current_page: number;
  last_page: number;
}

export default function AdminAuditLogsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [authState, setAuthState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
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

  const loadLogs = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`${API_BASE_URL}/admin/audit-logs?${params}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as PaginatedResponse;
      if (res.ok) {
        setRows(data.data ?? []);
        setLastPage(data.last_page ?? 1);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, actionFilter]);

  useEffect(() => {
    if (authState === "ready") void loadLogs();
  }, [authState, loadLogs]);

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
      userName="Audit Log"
      userMeta={t.title}
      menu={menu}
      activeKey="audit-logs"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="catv-panel mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => { setPage(1); setActionFilter(e.target.value); }}
            placeholder={t.filterAction}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[var(--accent)] text-white">
              <tr>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colTime}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colAdmin}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colAction}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colTarget}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.colIp}</th>
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
                    {t.noLogs}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="bg-[var(--surface)] even:bg-[var(--surface-soft)] hover:bg-[var(--accent)]/10">
                    <td className="border border-[var(--border)] px-3 py-2 whitespace-nowrap text-xs text-[var(--muted)]">
                      {new Date(row.created_at).toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2">
                      {row.admin ? (
                        <>
                          <span>{row.admin.name}</span>
                          <span className="ml-2 text-xs text-[var(--muted)]">{row.admin.email}</span>
                        </>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2">
                      <code className="rounded bg-[var(--muted)]/15 px-2 py-0.5 text-xs">{row.action}</code>
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
                      {row.target_type ? `${row.target_type} #${row.target_id}` : "—"}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
                      {row.ip_address ?? "—"}
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
