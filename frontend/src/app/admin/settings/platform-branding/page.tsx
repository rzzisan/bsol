"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import CatvShell from "@/components/catv-shell";
import { buildAdminMenu } from "@/lib/admin-menu";
import { RichTextEditorField } from "@/components/landing-builder/block-fields";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  LOCALE_STORAGE_KEY,
  normalizeRole,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

type Settings = {
  credit_text_bn: string;
  credit_text_en: string;
  terms_link_label_bn: string;
  terms_link_label_en: string;
  terms_title_bn: string;
  terms_title_en: string;
  terms_content_bn: JSONContent | undefined;
  terms_content_en: JSONContent | undefined;
  privacy_link_label_bn: string;
  privacy_link_label_en: string;
  privacy_title_bn: string;
  privacy_title_en: string;
  privacy_content_bn: JSONContent | undefined;
  privacy_content_en: JSONContent | undefined;
};

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const labels = {
  bn: {
    title: "প্ল্যাটফর্ম ব্র্যান্ডিং",
    subtitle: "মার্চেন্টদের ল্যান্ডিং পেজের নিচে দেখানো ক্রেডিট টেক্সট, শর্তাবলির লিংক এবং শর্তাবলি পেজের কনটেন্ট নিয়ন্ত্রণ করুন",
    loginRequired: "অ্যাডমিন হিসেবে লগইন করুন",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজে প্রবেশ করতে পারবেন",
    save: "সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    loaded: "সেটিংস লোড হয়েছে",
    updated: "সেটিংস আপডেট হয়েছে",
    goHome: "হোমে যান",
    creditSection: "ক্রেডিট টেক্সট (ল্যান্ডিং পেজের ফুটার)",
    creditBn: "ক্রেডিট টেক্সট (বাংলা)",
    creditEn: "ক্রেডিট টেক্সট (ইংরেজি)",
    linkLabelBn: "শর্তাবলির লিংক টেক্সট (বাংলা)",
    linkLabelEn: "শর্তাবলির লিংক টেক্সট (ইংরেজি)",
    termsSection: "পাবলিক শর্তাবলি পেজ (/terms)",
    termsTitleBn: "পেজ শিরোনাম (বাংলা)",
    termsTitleEn: "পেজ শিরোনাম (ইংরেজি)",
    termsContentBn: "কনটেন্ট (বাংলা)",
    termsContentEn: "কনটেন্ট (ইংরেজি)",
    preview: "পাবলিক পেজ দেখুন",
    privacySection: "পাবলিক গোপনীয়তা নীতি পেজ (/privacy)",
    privacyLinkLabelBn: "গোপনীয়তা নীতির লিংক টেক্সট (বাংলা)",
    privacyLinkLabelEn: "গোপনীয়তা নীতির লিংক টেক্সট (ইংরেজি)",
    privacyTitleBn: "পেজ শিরোনাম (বাংলা)",
    privacyTitleEn: "পেজ শিরোনাম (ইংরেজি)",
    privacyContentBn: "কনটেন্ট (বাংলা)",
    privacyContentEn: "কনটেন্ট (ইংরেজি)",
    privacyPreview: "পাবলিক পেজ দেখুন",
    menu: {
      dashboard: "ড্যাশবোর্ড",
      customers: "গ্রাহক",
      activeCustomers: "অ্যাকটিভ গ্রাহক",
      pendingCustomers: "পেন্ডিং গ্রাহক",
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
      notificationTemplates: "নোটিফিকেশন টেমপ্লেট",
      notificationUseCases: "ইউজকেস ম্যাপিং",
      productMediaSettings: "Product Media",
      platformBranding: "প্ল্যাটফর্ম ব্র্যান্ডিং",
    },
  },
  en: {
    title: "Platform Branding",
    subtitle: "Control the credit text, terms link, and terms page content shown on every merchant's landing page",
    loginRequired: "Please login as admin",
    accessDenied: "Only admins can access this page",
    save: "Save",
    saving: "Saving...",
    loaded: "Settings loaded",
    updated: "Settings updated",
    goHome: "Go Home",
    creditSection: "Credit Text (landing page footer)",
    creditBn: "Credit text (Bangla)",
    creditEn: "Credit text (English)",
    linkLabelBn: "Terms link text (Bangla)",
    linkLabelEn: "Terms link text (English)",
    termsSection: "Public Terms page (/terms)",
    termsTitleBn: "Page title (Bangla)",
    termsTitleEn: "Page title (English)",
    termsContentBn: "Content (Bangla)",
    termsContentEn: "Content (English)",
    preview: "View public page",
    privacySection: "Public Privacy Policy page (/privacy)",
    privacyLinkLabelBn: "Privacy link text (Bangla)",
    privacyLinkLabelEn: "Privacy link text (English)",
    privacyTitleBn: "Page title (Bangla)",
    privacyTitleEn: "Page title (English)",
    privacyContentBn: "Content (Bangla)",
    privacyContentEn: "Content (English)",
    privacyPreview: "View public page",
    menu: {
      dashboard: "Dashboard",
      customers: "Customers",
      activeCustomers: "Active Customers",
      pendingCustomers: "Pending Customers",
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
      notificationTemplates: "Notification Templates",
      notificationUseCases: "Use-case Mapping",
      productMediaSettings: "Product Media",
      platformBranding: "Platform Branding",
    },
  },
};

export default function PlatformBrandingSettingsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [form, setForm] = useState<Settings>({
    credit_text_bn: "",
    credit_text_en: "",
    terms_link_label_bn: "",
    terms_link_label_en: "",
    terms_title_bn: "",
    terms_title_en: "",
    terms_content_bn: EMPTY_DOC,
    terms_content_en: EMPTY_DOC,
    privacy_link_label_bn: "",
    privacy_link_label_en: "",
    privacy_title_bn: "",
    privacy_title_en: "",
    privacy_content_bn: EMPTY_DOC,
    privacy_content_en: EMPTY_DOC,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const t = useMemo(() => labels[locale], [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const token = getStoredToken();

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      setState("unauthenticated");
      return;
    }
    if (normalizeRole(storedUser) !== "admin") {
      setState("forbidden");
      return;
    }

    setUser(storedUser);
    setState("ready");

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/admin/settings/platform-branding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data?.data) {
          const d = data.data;
          setForm({
            credit_text_bn: d.credit_text_bn ?? "",
            credit_text_en: d.credit_text_en ?? "",
            terms_link_label_bn: d.terms_link_label_bn ?? "",
            terms_link_label_en: d.terms_link_label_en ?? "",
            terms_title_bn: d.terms_title_bn ?? "",
            terms_title_en: d.terms_title_en ?? "",
            terms_content_bn: d.terms_content_bn ?? EMPTY_DOC,
            terms_content_en: d.terms_content_en ?? EMPTY_DOC,
            privacy_link_label_bn: d.privacy_link_label_bn ?? "",
            privacy_link_label_en: d.privacy_link_label_en ?? "",
            privacy_title_bn: d.privacy_title_bn ?? "",
            privacy_title_en: d.privacy_title_en ?? "",
            privacy_content_bn: d.privacy_content_bn ?? EMPTY_DOC,
            privacy_content_en: d.privacy_content_en ?? EMPTY_DOC,
          });
          setMessage(t.loaded);
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const menus = useMemo(() => buildAdminMenu({ ...t.menu }), [t]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/settings/platform-branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message ?? "Update failed");
        return;
      }
      setMessage(t.updated);
    } finally {
      setLoading(false);
    }
  };

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{state === "forbidden" ? t.accessDenied : t.loginRequired}</p>
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
      localeLabel={locale === "bn" ? "ভাষা" : "Language"}
      themeLabel={locale === "bn" ? "থিম" : "Theme"}
      sidebarTitle={locale === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}
      searchPlaceholder={locale === "bn" ? "সার্চ করুন" : "Search"}
      userName={user?.name}
      userMeta={user?.email}
      menu={menus}
      activeKey="settings-platform-branding"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="space-y-5">
        <section className="catv-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{t.title}</h2>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent)] hover:underline">
              {t.preview}
            </a>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>

          <h3 className="mt-5 text-sm font-semibold text-[var(--foreground)]">{t.creditSection}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.creditBn}</span>
              <textarea rows={2} value={form.credit_text_bn} onChange={(e) => update("credit_text_bn", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.creditEn}</span>
              <textarea rows={2} value={form.credit_text_en} onChange={(e) => update("credit_text_en", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.linkLabelBn}</span>
              <input value={form.terms_link_label_bn} onChange={(e) => update("terms_link_label_bn", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.linkLabelEn}</span>
              <input value={form.terms_link_label_en} onChange={(e) => update("terms_link_label_en", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
          </div>
        </section>

        <section className="catv-panel p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.termsSection}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.termsTitleBn}</span>
              <input value={form.terms_title_bn} onChange={(e) => update("terms_title_bn", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.termsTitleEn}</span>
              <input value={form.terms_title_en} onChange={(e) => update("terms_title_en", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.termsContentBn}</span>
              <RichTextEditorField value={form.terms_content_bn} onChange={(json) => update("terms_content_bn", json)} />
            </div>
            <div>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.termsContentEn}</span>
              <RichTextEditorField value={form.terms_content_en} onChange={(json) => update("terms_content_en", json)} />
            </div>
          </div>
        </section>

        <section className="catv-panel p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.privacySection}</h3>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent)] hover:underline">
              {t.privacyPreview}
            </a>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.privacyLinkLabelBn}</span>
              <input value={form.privacy_link_label_bn} onChange={(e) => update("privacy_link_label_bn", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.privacyLinkLabelEn}</span>
              <input value={form.privacy_link_label_en} onChange={(e) => update("privacy_link_label_en", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.privacyTitleBn}</span>
              <input value={form.privacy_title_bn} onChange={(e) => update("privacy_title_bn", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.privacyTitleEn}</span>
              <input value={form.privacy_title_en} onChange={(e) => update("privacy_title_en", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.privacyContentBn}</span>
              <RichTextEditorField value={form.privacy_content_bn} onChange={(json) => update("privacy_content_bn", json)} />
            </div>
            <div>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.privacyContentEn}</span>
              <RichTextEditorField value={form.privacy_content_en} onChange={(json) => update("privacy_content_en", json)} />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={loading}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? t.saving : t.save}
          </button>
          {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
        </div>
      </div>
    </CatvShell>
  );
}
