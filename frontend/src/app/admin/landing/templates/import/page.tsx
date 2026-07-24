"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface ParsedPreview {
  title: string;
  hero: { headline: string; subheadline: string; cta_text: string };
  html: string;
  warnings: string[];
}

interface TemplateRow {
  id: number;
  code: string;
  name_bn: string;
  name_en: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const text = {
  bn: {
    title: "ল্যান্ডিং টেমপ্লেট ইম্পোর্ট",
    subtitle: "WordPress/CartFlows JSON export থেকে পাবলিক starter টেমপ্লেট তৈরি করুন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    menuDashboard: "ড্যাশবোর্ড", menuCustomers: "গ্রাহক", menuActive: "অ্যাকটিভ গ্রাহক", menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস", menuSmsGateway: "এসএমএস গেটওয়ে", menuSmsSend: "এসএমএস সেন্ড", menuSmsHistory: "এসএমএস হিস্টোরি", menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ", menuBilling: "বিলিং", menuLandingTemplates: "ল্যান্ডিং টেমপ্লেট", menuReports: "রিপোর্ট", menuSettings: "সেটিংস", menuEmailSettings: "ইমেইল সেটিংস",
    languageLabel: "ভাষা", themeLabel: "থিম",
    uploadTitle: "JSON ফাইল আপলোড করুন",
    uploadHint: "CartFlows/Elementor থেকে এক্সপোর্ট করা .json ফাইল বেছে নিন।",
    preview: "প্রিভিউ দেখুন",
    previewing: "প্রিভিউ তৈরি হচ্ছে...",
    warningsTitle: "সতর্কতা",
    previewTitleLabel: "টেমপ্লেট নাম",
    codeLabel: "কোড (ঐচ্ছিক)",
    activeLabel: "সক্রিয় (মার্চেন্টরা এখনই দেখতে পাবে)",
    confirm: "টেমপ্লেট তৈরি করুন",
    confirming: "তৈরি হচ্ছে...",
    created: "টেমপ্লেট সফলভাবে তৈরি হয়েছে।",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    listTitle: "বিদ্যমান টেমপ্লেট",
    loading: "লোড হচ্ছে...",
    empty: "কোনো টেমপ্লেট নেই।",
    table: { code: "কোড", name: "নাম", status: "স্ট্যাটাস", createdAt: "তৈরির তারিখ", actions: "অ্যাকশন" },
    activate: "সক্রিয় করুন",
    deactivate: "নিষ্ক্রিয় করুন",
  },
  en: {
    title: "Landing Template Import",
    subtitle: "Turn WordPress/CartFlows JSON exports into public starter templates.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    menuDashboard: "Dashboard", menuCustomers: "Customers", menuActive: "Active Customers", menuPending: "Pending Customers",
    menuSms: "SMS", menuSmsGateway: "SMS Gateway", menuSmsSend: "Send SMS", menuSmsHistory: "SMS History", menuSmsCredit: "SMS Credit",
    menuPackages: "Packages", menuBilling: "Billing", menuLandingTemplates: "Landing Templates", menuReports: "Reports", menuSettings: "Settings", menuEmailSettings: "Email Settings",
    languageLabel: "Language", themeLabel: "Theme",
    uploadTitle: "Upload a JSON file",
    uploadHint: "Choose a .json file exported from CartFlows/Elementor.",
    preview: "Preview",
    previewing: "Building preview...",
    warningsTitle: "Warnings",
    previewTitleLabel: "Template name",
    codeLabel: "Code (optional)",
    activeLabel: "Active (merchants can see it immediately)",
    confirm: "Create Template",
    confirming: "Creating...",
    created: "Template created successfully.",
    error: "Request failed.",
    listTitle: "Existing Templates",
    loading: "Loading...",
    empty: "No templates found.",
    table: { code: "Code", name: "Name", status: "Status", createdAt: "Created At", actions: "Actions" },
    activate: "Activate",
    deactivate: "Deactivate",
  },
};

export default function AdminLandingTemplateImportPage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [titleOverride, setTitleOverride] = useState("");
  const [codeOverride, setCodeOverride] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

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
      if (res.ok) setTemplates((data?.data ?? []) as TemplateRow[]);
    } catch {
      // silent
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (state === "ready") void loadTemplates();
  }, [state, loadTemplates]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
    setPreview(null);
    setError(null);
    setSuccess(null);
  };

  const runPreview = async () => {
    const token = getStoredToken();
    if (!token || !selectedFile) return;
    setPreviewing(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append("file", selectedFile);
      const res = await fetch(`${API_BASE_URL}/admin/landing/templates/import/preview`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      const parsed = data.data as ParsedPreview;
      setPreview(parsed);
      setTitleOverride(parsed.title);
    } catch {
      setError(t.error);
    } finally {
      setPreviewing(false);
    }
  };

  const confirmCreate = async () => {
    const token = getStoredToken();
    if (!token || !selectedFile) return;
    setConfirming(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append("file", selectedFile);
      body.append("title", titleOverride);
      if (codeOverride) body.append("code", codeOverride);
      body.append("is_active", isActive ? "1" : "0");

      const res = await fetch(`${API_BASE_URL}/admin/landing/templates/import`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setSuccess(t.created);
      setPreview(null);
      setSelectedFile(null);
      setTitleOverride("");
      setCodeOverride("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadTemplates();
    } catch {
      setError(t.error);
    } finally {
      setConfirming(false);
    }
  };

  const toggleActive = async (id: number) => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/landing/templates/${id}`, {
        method: "PUT",
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
      defaultExpandedKey="customers"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel mb-5 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">{t.uploadTitle}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.uploadHint}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,text/plain"
            onChange={handleFileChange}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!selectedFile || previewing}
            onClick={() => void runPreview()}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {previewing ? t.previewing : t.preview}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}

        {preview ? (
          <div className="mt-5 space-y-4">
            {preview.warnings.length > 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <strong className="block">{t.warningsTitle}</strong>
                <ul className="mt-1 list-disc pl-5">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {t.previewTitleLabel}
                </label>
                <input
                  value={titleOverride}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {t.codeLabel}
                </label>
                <input
                  value={codeOverride}
                  onChange={(e) => setCodeOverride(e.target.value)}
                  placeholder="auto-generated-from-filename"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              {t.activeLabel}
            </label>

            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <iframe title="template-preview" srcDoc={preview.html} className="h-96 w-full bg-white" sandbox="" />
            </div>

            <button
              type="button"
              disabled={confirming}
              onClick={() => void confirmCreate()}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {confirming ? t.confirming : t.confirm}
            </button>
          </div>
        ) : null}
      </section>

      <section className="catv-panel mb-5 p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">{t.listTitle}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">{t.table.code}</th>
                <th className="px-3 py-2">{t.table.name}</th>
                <th className="px-3 py-2">{t.table.status}</th>
                <th className="px-3 py-2">{t.table.createdAt}</th>
                <th className="px-3 py-2">{t.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loadingTemplates ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">{t.loading}</td></tr>
              ) : templates.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">{t.empty}</td></tr>
              ) : (
                templates.map((tpl) => (
                  <tr key={tpl.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-mono text-xs">{tpl.code}</td>
                    <td className="px-3 py-2">{locale === "bn" ? tpl.name_bn : tpl.name_en ?? tpl.name_bn}</td>
                    <td className="px-3 py-2">
                      <span className={tpl.is_active ? "text-emerald-600" : "text-[var(--muted)]"}>
                        {tpl.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{new Date(tpl.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void toggleActive(tpl.id)}
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold"
                      >
                        {tpl.is_active ? t.deactivate : t.activate}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </CatvShell>
  );
}
