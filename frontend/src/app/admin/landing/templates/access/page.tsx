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
import { buildApiHeaders, getTemplateLabel, LANDING_API_BASE, readApiResponse, type LandingTemplate, type LandingTemplateAccessRule } from "@/lib/landing";

const text = {
  bn: {
    title: "টেমপ্লেট অ্যাক্সেস",
    subtitle: "প্যাকেজ অনুযায়ী কোন seller কোন template ব্যবহার করতে পারবে তা নিয়ন্ত্রণ করুন",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    searchPlaceholder: "সার্চ",
    sidebarTitle: "অ্যাডমিন প্যানেল",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    package: "প্যাকেজ",
    updated: "অ্যাক্সেস রুল আপডেট হয়েছে।",
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
  },
  en: {
    title: "Template Access",
    subtitle: "Control which seller package can use which landing template",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can access this page.",
    goHome: "Go Home",
    languageLabel: "Language",
    themeLabel: "Theme",
    searchPlaceholder: "Search",
    sidebarTitle: "Admin Panel",
    save: "Save",
    saving: "Saving...",
    package: "Package",
    updated: "Access rules updated successfully.",
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
  },
};

type AccessResponse = {
  templates?: LandingTemplate[];
  rules: LandingTemplateAccessRule[];
  packages: Array<{ id: number; name: string; slug: string; is_active: boolean }>;
};

export default function AdminLandingAccessPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [data, setData] = useState<AccessResponse>({ templates: [], rules: [], packages: [] });
  const [saving, setSaving] = useState(false);
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
      try {
        const res = await fetch(`${LANDING_API_BASE}/admin/landing/templates/access-rules`, {
          headers: buildApiHeaders(token),
        });
        const result = await readApiResponse<AccessResponse>(res);
        if (result.ok) {
          setData((result.data ?? { templates: [], rules: [], packages: [] }) as AccessResponse);
        } else {
          setError(result.status === 401 ? t.loginRequired : result.message || "Failed to load access rules.");
        }
      } catch {
        setError("Network error. Please try again.");
      }
    };

    void load();
  }, [state]);

  const templates = useMemo(() => {
    const map = new Map<number, NonNullable<LandingTemplateAccessRule["template"]>>();
    (data.templates ?? []).forEach((template) => {
      map.set(template.id, template);
    });
    data.rules.forEach((rule) => {
      if (rule.template) map.set(rule.template.id, rule.template);
    });
    return Array.from(map.values()).sort((a, b) => {
      const sortOrderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      return sortOrderDiff !== 0 ? sortOrderDiff : a.id - b.id;
    });
  }, [data.rules, data.templates]);

  const checkedFor = (templateId: number, packageId: number) => {
    const rule = data.rules.find((item) => item.template_id === templateId && item.package_id === packageId);
    return rule ? rule.is_enabled : false;
  };

  const toggleRule = (templateId: number, packageId: number, enabled: boolean) => {
    setData((prev) => {
      const nextRules = [...prev.rules];
      const index = nextRules.findIndex((item) => item.template_id === templateId && item.package_id === packageId);
      if (index >= 0) {
        nextRules[index] = { ...nextRules[index], is_enabled: enabled };
      } else {
        nextRules.push({ id: 0, template_id: templateId, package_id: packageId, is_enabled: enabled });
      }
      return { ...prev, rules: nextRules };
    });
  };

  const save = async () => {
    const token = getStoredToken();
    if (!token) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${LANDING_API_BASE}/admin/landing/templates/access-rules`, {
        method: "PUT",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify({
          rules: data.rules.map((rule) => ({
            template_id: rule.template_id,
            package_id: rule.package_id,
            is_enabled: !!rule.is_enabled,
          })),
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
      activeKey="landing-access"
      defaultExpandedKey="landing"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="space-y-4">
        {error ? <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div> : null}
        {message ? <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{message}</div> : null}

        <div className="flex justify-end">
          <button onClick={() => void save()} disabled={saving} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? t.saving : t.save}
          </button>
        </div>

        <div className="catv-panel overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-soft)] text-left">
                <th className="px-4 py-3">Template</th>
                {data.packages.map((pkg) => (
                  <th key={pkg.id} className="px-4 py-3">{pkg.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-[var(--border)]">
                  <td className="px-4 py-3 font-semibold">{getTemplateLabel(template, locale)}</td>
                  {data.packages.map((pkg) => (
                    <td key={`${template.id}-${pkg.id}`} className="px-4 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checkedFor(template.id, pkg.id)}
                          onChange={(e) => toggleRule(template.id, pkg.id, e.target.checked)}
                        />
                        <span className="text-xs text-[var(--muted)]">{t.package}: {pkg.slug}</span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </CatvShell>
  );
}
