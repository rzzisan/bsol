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
import { buildApiHeaders, getTemplateDescription, getTemplateLabel, LANDING_API_BASE, readApiResponse, type LandingTemplate } from "@/lib/landing";

const text = {
  bn: {
    title: "ল্যান্ডিং টেমপ্লেট",
    subtitle: "অ্যাডমিন থেকে টেমপ্লেট enable/disable ও sort order নিয়ন্ত্রণ করুন",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    searchPlaceholder: "সার্চ",
    sidebarTitle: "অ্যাডমিন প্যানেল",
    menu: {
      dashboard: "ড্যাশবোর্ড",
      customers: "গ্রাহক",
      activeCustomers: "অ্যাকটিভ গ্রাহক",
      pendingCustomers: "পেন্ডিং গ্রাহক",
      landing: "ল্যান্ডিং",
      landingTemplates: "টেমপ্লেট",
      landingAccess: "অ্যাক্সেস রুলস",
      sms: "এসএমএস",
      smsGateway: "এসএমএস গেটওয়ে",
      smsSend: "এসএমএস সেন্ড",
      smsHistory: "এসএমএস হিস্টোরি",
      smsCredit: "এসএমএস ক্রেডিট",
      packages: "প্যাকেজ",
      billing: "বিলিং",
      reports: "রিপোর্ট",
      settings: "সেটিংস",
      emailSettings: "ইমেইল সেটিংস",
    },
    loading: "লোড হচ্ছে...",
    empty: "কোনো টেমপ্লেট পাওয়া যায়নি।",
    active: "সক্রিয়",
    inactive: "নিষ্ক্রিয়",
    sortOrder: "সিরিয়াল",
    saveOrder: "অর্ডার সেভ",
    saving: "সেভ হচ্ছে...",
    updated: "টেমপ্লেট আপডেট হয়েছে।",
  },
  en: {
    title: "Landing Templates",
    subtitle: "Enable/disable templates and manage sort order from admin",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can access this page.",
    goHome: "Go Home",
    languageLabel: "Language",
    themeLabel: "Theme",
    searchPlaceholder: "Search",
    sidebarTitle: "Admin Panel",
    menu: {
      dashboard: "Dashboard",
      customers: "Customers",
      activeCustomers: "Active Customers",
      pendingCustomers: "Pending Customers",
      landing: "Landing",
      landingTemplates: "Templates",
      landingAccess: "Access Rules",
      sms: "SMS",
      smsGateway: "SMS Gateway",
      smsSend: "Send SMS",
      smsHistory: "SMS History",
      smsCredit: "SMS Credit",
      packages: "Packages",
      billing: "Billing",
      reports: "Reports",
      settings: "Settings",
      emailSettings: "Email Settings",
    },
    loading: "Loading...",
    empty: "No templates found.",
    active: "Active",
    inactive: "Inactive",
    sortOrder: "Sort",
    saveOrder: "Save Order",
    saving: "Saving...",
    updated: "Templates updated successfully.",
  },
};

export default function AdminLandingTemplatesPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<LandingTemplate[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    const user = getStoredUser();
    if (!token || !user) {
      setState("unauthenticated");
      return;
    }
    if (normalizeRole(user) !== "admin") {
      setState("forbidden");
      return;
    }
    setState("ready");
  }, []);

  const t = useMemo(() => text[locale], [locale]);
  const menu = useMemo(
    () =>
      buildAdminMenu({
        dashboard: t.menu.dashboard,
        customers: t.menu.customers,
        activeCustomers: t.menu.activeCustomers,
        pendingCustomers: t.menu.pendingCustomers,
        landing: t.menu.landing,
        landingTemplates: t.menu.landingTemplates,
        landingAccess: t.menu.landingAccess,
        sms: t.menu.sms,
        smsGateway: t.menu.smsGateway,
        smsSend: t.menu.smsSend,
        smsHistory: t.menu.smsHistory,
        smsCredit: t.menu.smsCredit,
        packages: t.menu.packages,
        billing: t.menu.billing,
        reports: t.menu.reports,
        settings: t.menu.settings,
        emailSettings: t.menu.emailSettings,
      }),
    [t],
  );

  useEffect(() => {
    const load = async () => {
      if (state !== "ready") return;
      const token = getStoredToken();
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`${LANDING_API_BASE}/admin/landing/templates`, {
          headers: buildApiHeaders(token),
        });
        const result = await readApiResponse<LandingTemplate[]>(res);
        if (result.ok) {
          setTemplates((result.data ?? []) as LandingTemplate[]);
        } else {
          setError(result.status === 401 ? t.loginRequired : result.message || "Failed to load templates.");
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [state]);

  const handleToggle = async (template: LandingTemplate) => {
    const token = getStoredToken();
    if (!token) return;
    setError("");
    setMessage("");
    const res = await fetch(`${LANDING_API_BASE}/admin/landing/templates/${template.id}/toggle`, {
      method: "PUT",
      headers: buildApiHeaders(token, true),
      body: JSON.stringify({ is_active: !template.is_active }),
    });
    const result = await readApiResponse(res);
    if (!res.ok) {
      setError(result.status === 401 ? t.loginRequired : result.message || "Update failed.");
      return;
    }
    setTemplates((prev) => prev.map((item) => (item.id === template.id ? { ...item, is_active: !item.is_active } : item)));
    setMessage(t.updated);
  };

  const saveOrder = async () => {
    const token = getStoredToken();
    if (!token) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${LANDING_API_BASE}/admin/landing/templates/reorder`, {
        method: "PUT",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify({
          items: templates.map((template) => ({ id: template.id, sort_order: template.sort_order })),
        }),
      });
      const result = await readApiResponse(res);
      if (!res.ok) {
        setError(result.status === 401 ? t.loginRequired : result.message || "Save failed.");
        return;
      }
      setMessage(t.updated);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">{state === "forbidden" ? t.accessDenied : t.loginRequired}</p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">{t.goHome}</a>
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
      sidebarTitle={t.sidebarTitle}
      searchPlaceholder={t.searchPlaceholder}
      menu={menu}
      activeKey="landing-templates"
      defaultExpandedKey="landing"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="space-y-4">
        {error ? <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div> : null}
        {message ? <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{message}</div> : null}

        <div className="flex justify-end">
          <button onClick={() => void saveOrder()} disabled={saving} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? t.saving : t.saveOrder}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {loading ? (
            <div className="catv-panel p-6 text-sm text-[var(--muted)]">{t.loading}</div>
          ) : templates.length === 0 ? (
            <div className="catv-panel p-6 text-sm text-[var(--muted)]">{t.empty}</div>
          ) : (
            templates.map((template, index) => (
              <article key={template.id} className="catv-panel overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-teal-500 via-cyan-500 to-slate-800" />
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{getTemplateLabel(template, locale)}</h2>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{template.code}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${template.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                      {template.is_active ? t.active : t.inactive}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{getTemplateDescription(template, locale)}</p>
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.sortOrder}</span>
                    <input
                      type="number"
                      min="0"
                      value={template.sort_order}
                      onChange={(e) => setTemplates((prev) => prev.map((item, itemIndex) => (item.id === template.id ? { ...item, sort_order: Number(e.target.value) } : itemIndex === index ? { ...item, sort_order: item.sort_order } : item)))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    />
                  </label>
                  <button onClick={() => void handleToggle(template)} className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]">
                    {template.is_active ? t.inactive : t.active}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </CatvShell>
  );
}
