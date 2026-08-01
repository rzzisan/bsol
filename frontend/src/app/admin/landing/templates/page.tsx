"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

interface TemplateRow {
  id: number;
  code: string;
  name_bn: string;
  name_en: string | null;
  description: string | null;
  preview_image: string | null;
  is_active: boolean;
  source_landing_page: { id: number; title: string; slug: string } | null;
  created_at: string;
}

const text = {
  bn: {
    title: "ল্যান্ডিং টেমপ্লেট",
    subtitle: "সেলারের ল্যান্ডিং পেজ থেকে কনভার্ট করে তৈরি করা পাবলিক টেমপ্লেট ম্যানেজ করুন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    menuDashboard: "ড্যাশবোর্ড", menuCustomers: "গ্রাহক", menuActive: "অ্যাকটিভ গ্রাহক", menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস", menuSmsGateway: "এসএমএস গেটওয়ে", menuSmsSend: "এসএমএস সেন্ড", menuSmsHistory: "এসএমএস হিস্টোরি", menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ", menuBilling: "বিলিং", menuLandingPages: "ল্যান্ডিং পেজ", menuLandingTemplates: "ল্যান্ডিং টেমপ্লেট", menuReports: "রিপোর্ট", menuSettings: "সেটিংস", menuEmailSettings: "ইমেইল সেটিংস",
    languageLabel: "ভাষা", themeLabel: "থিম",
    hint: "নতুন টেমপ্লেট তৈরি করতে \"ল্যান্ডিং পেজ (সব সেলার)\" লিস্ট থেকে কোনো পেজে \"টেমপ্লেটে কনভার্ট করুন\" ক্লিক করুন।",
    goToPages: "সব সেলারের ল্যান্ডিং পেজ দেখুন",
    table: { screenshot: "স্ক্রীনশট", name: "নাম", source: "উৎস", status: "স্ট্যাটাস", createdAt: "তৈরির তারিখ", actions: "অ্যাকশন" },
    loading: "লোড হচ্ছে...",
    empty: "কোনো টেমপ্লেট নেই।",
    active: "সক্রিয়",
    inactive: "নিষ্ক্রিয়",
    activate: "সক্রিয় করুন",
    deactivate: "নিষ্ক্রিয় করুন",
    edit: "এডিট",
    delete: "মুছুন",
    deleteConfirm: "এই টেমপ্লেটটি মুছে ফেলতে চান?",
    noSource: "সরাসরি তৈরি",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
  },
  en: {
    title: "Landing Templates",
    subtitle: "Manage public templates converted from seller landing pages.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    menuDashboard: "Dashboard", menuCustomers: "Customers", menuActive: "Active Customers", menuPending: "Pending Customers",
    menuSms: "SMS", menuSmsGateway: "SMS Gateway", menuSmsSend: "Send SMS", menuSmsHistory: "SMS History", menuSmsCredit: "SMS Credit",
    menuPackages: "Packages", menuBilling: "Billing", menuLandingPages: "Landing Pages", menuLandingTemplates: "Landing Templates", menuReports: "Reports", menuSettings: "Settings", menuEmailSettings: "Email Settings",
    languageLabel: "Language", themeLabel: "Theme",
    hint: "To create a new template, go to \"Landing Pages (All Sellers)\" and click \"Convert to Template\" on any page.",
    goToPages: "View all sellers' landing pages",
    table: { screenshot: "Screenshot", name: "Name", source: "Source", status: "Status", createdAt: "Created At", actions: "Actions" },
    loading: "Loading...",
    empty: "No templates found.",
    active: "Active",
    inactive: "Inactive",
    activate: "Activate",
    deactivate: "Deactivate",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this template?",
    noSource: "Created directly",
    error: "Request failed.",
  },
};

export default function AdminLandingTemplatesPage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);

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
        landingPages: t.menuLandingPages,
        landingTemplates: t.menuLandingTemplates,
        reports: t.menuReports,
        settings: t.menuSettings,
        emailSettings: t.menuEmailSettings,
      }),
    [t],
  );

  const loadTemplates = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/landing/templates`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates(
          (data?.data ?? []).map((row: TemplateRow & { sourceLandingPage?: TemplateRow["source_landing_page"] }) => ({
            ...row,
            source_landing_page: row.source_landing_page ?? row.sourceLandingPage ?? null,
          })),
        );
      }
    } catch {
      // silent
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (state === "ready") void loadTemplates();
  }, [state, loadTemplates]);

  const toggleActive = async (id: number) => {
    const token = getStoredToken();
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/landing/templates/${id}/toggle-active`, {
        method: "PATCH",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      await loadTemplates();
    } catch {
      setError(t.error);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const token = getStoredToken();
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/landing/templates/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setDeleteTarget(null);
      await loadTemplates();
    } catch {
      setError(t.error);
    }
  };

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
      userName={t.menuLandingTemplates}
      userMeta={t.menuLandingTemplates}
      menu={menu}
      activeKey="landing-templates"
      defaultExpandedKey="landing"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel mb-5 p-4 sm:p-5">
        <p className="text-sm text-[var(--muted)]">{t.hint}</p>
        <Link
          href="/admin/landing/pages"
          className="mt-3 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          {t.goToPages}
        </Link>
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      </section>

      <section className="catv-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.screenshot}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.name}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.source}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.status}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.createdAt}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-center font-semibold">{t.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loadingTemplates ? (
                <tr><td colSpan={6} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">{t.loading}</td></tr>
              ) : templates.length === 0 ? (
                <tr><td colSpan={6} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">{t.empty}</td></tr>
              ) : (
                templates.map((tpl) => (
                  <tr key={tpl.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff] align-top">
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {tpl.preview_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tpl.preview_image} alt="" className="h-14 w-20 rounded-lg border border-[var(--border)] object-cover" />
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <div className="font-medium text-[var(--foreground)]">
                        {locale === "bn" ? tpl.name_bn : tpl.name_en ?? tpl.name_bn}
                      </div>
                      <div className="text-xs text-[var(--muted)]">{tpl.code}</div>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {tpl.source_landing_page ? (
                        <span className="text-xs text-[var(--muted)]">{tpl.source_landing_page.title}</span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">{t.noSource}</span>
                      )}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${tpl.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {tpl.is_active ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">{new Date(tpl.created_at).toLocaleDateString()}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Link
                          href={`/admin/landing/templates/builder/${tpl.id}`}
                          className="rounded px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          {t.edit}
                        </Link>
                        <button
                          type="button"
                          onClick={() => void toggleActive(tpl.id)}
                          className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold"
                        >
                          {tpl.is_active ? t.deactivate : t.activate}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tpl)}
                          className="rounded px-2 py-1 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <p className="mb-5 text-sm text-[var(--foreground)]">
              <strong>{locale === "bn" ? deleteTarget.name_bn : deleteTarget.name_en ?? deleteTarget.name_bn}</strong> — {t.deleteConfirm}
            </p>
            <div className="flex gap-3">
              <button onClick={() => void confirmDelete()} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700">
                {t.delete}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-[var(--border)] px-5 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-soft)]">
                {locale === "bn" ? "বাতিল" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CatvShell>
  );
}
