"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

type Channel = "sms" | "email";
type Language = "bn" | "en";

interface SmsGatewayOption {
  id: number;
  name: string;
  provider: string;
  is_enabled: boolean;
}

interface EmailConfigOption {
  id: number;
  name: string;
  host: string;
  from_email: string;
}

interface NotificationTemplate {
  id: number;
  name: string;
  channel: Channel;
  language: Language;
  sms_gateway_id: number | null;
  email_configuration_id: number | null;
  subject: string | null;
  body: string;
  variables: string[] | null;
  is_active: boolean;
  sms_gateway?: SmsGatewayOption | null;
  email_configuration?: EmailConfigOption | null;
}

interface TemplateForm {
  name: string;
  channel: Channel;
  language: Language;
  sms_gateway_id: string;
  email_configuration_id: string;
  subject: string;
  body: string;
  is_active: boolean;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const defaultForm: TemplateForm = {
  name: "",
  channel: "sms",
  language: "bn",
  sms_gateway_id: "",
  email_configuration_id: "",
  subject: "",
  body: "",
  is_active: true,
};

const SMS_PLACEHOLDERS = ["{{otp}}", "{{name}}", "{{phone}}", "{{app_name}}"];
const EMAIL_PLACEHOLDERS = [
  "{{otp}}",
  "{{name}}",
  "{{email}}",
  "{{verification_link}}",
  "{{reset_link}}",
  "{{app_name}}",
];

const text = {
  bn: {
    title: "নোটিফিকেশন টেমপ্লেট",
    subtitle: "SMS/Email টেমপ্লেট তৈরি, সম্পাদনা ও প্রিভিউ করুন",
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
    },
    addNew: "নতুন টেমপ্লেট",
    edit: "এডিট",
    delete: "ডিলিট",
    cancel: "বাতিল",
    save: "সেভ",
    update: "আপডেট",
    loading: "লোড হচ্ছে...",
    noData: "কোনো টেমপ্লেট পাওয়া যায়নি।",
    form: {
      name: "টেমপ্লেট নাম",
      channel: "চ্যানেল",
      language: "ভাষা",
      smsGateway: "SMS Gateway",
      smtp: "SMTP Configuration",
      subject: "সাবজেক্ট",
      body: "মেসেজ/বডি",
      active: "সক্রিয়",
      placeholders: "Placeholders",
      placeholderHint: "Placeholder এ ক্লিক করলে Message/Body তে যুক্ত হবে",
      preview: "প্রিভিউ",
      previewResult: "প্রিভিউ রেজাল্ট",
    },
    actions: "অ্যাকশন",
    status: "স্ট্যাটাস",
    active: "সক্রিয়",
    inactive: "নিষ্ক্রিয়",
    deleteConfirm: "এই টেমপ্লেট মুছতে চান?",
  },
  en: {
    title: "Notification Templates",
    subtitle: "Create, edit, and preview SMS/Email templates",
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
    },
    addNew: "Add Template",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    update: "Update",
    loading: "Loading...",
    noData: "No templates found.",
    form: {
      name: "Template Name",
      channel: "Channel",
      language: "Language",
      smsGateway: "SMS Gateway",
      smtp: "SMTP Configuration",
      subject: "Subject",
      body: "Message/Body",
      active: "Active",
      placeholders: "Placeholders",
      placeholderHint: "Click a placeholder to insert into Message/Body",
      preview: "Preview",
      previewResult: "Preview Result",
    },
    actions: "Actions",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    deleteConfirm: "Delete this template?",
  },
};

export default function NotificationTemplatesPage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [gateways, setGateways] = useState<SmsGatewayOption[]>([]);
  const [emailConfigs, setEmailConfigs] = useState<EmailConfigOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateForm>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject?: string | null; body?: string; missing_placeholders?: string[] } | null>(null);
  const [previewVariables, setPreviewVariables] = useState('{"otp":"123456","verification_link":"https://example.com/verify"}');
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
        notificationTemplates: t.menu.notificationTemplates,
        notificationUseCases: t.menu.notificationUseCases,
      }),
    [t],
  );

  const suggestedPlaceholders = useMemo(
    () => (form.channel === "sms" ? SMS_PLACEHOLDERS : EMAIL_PLACEHOLDERS),
    [form.channel],
  );

  function handleInsertPlaceholder(placeholder: string) {
    const textarea = bodyTextareaRef.current;

    if (!textarea) {
      setForm((prev) => ({
        ...prev,
        body: prev.body ? `${prev.body} ${placeholder}` : placeholder,
      }));
      return;
    }

    const start = textarea.selectionStart ?? form.body.length;
    const end = textarea.selectionEnd ?? start;
    const before = form.body.slice(0, start);
    const after = form.body.slice(end);
    const nextBody = `${before}${placeholder}${after}`;
    const nextCursor = start + placeholder.length;

    setForm((prev) => ({ ...prev, body: nextBody }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  }

  async function loadData() {
    const token = getStoredToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [tplRes, smsRes, emailRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/notification-templates`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/admin/sms/gateways`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/admin/email-configurations`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        }),
      ]);

      const tplData = await tplRes.json();
      const smsData = await smsRes.json();
      const emailData = await emailRes.json();

      if (!tplRes.ok) {
        setError(tplData?.message ?? "Failed to load templates.");
      } else {
        setTemplates((tplData?.data ?? []) as NotificationTemplate[]);
      }

      if (smsRes.ok) {
        setGateways(((smsData?.gateways ?? []) as SmsGatewayOption[]).filter((g) => g.is_enabled));
      }

      if (emailRes.ok) {
        setEmailConfigs((emailData?.data ?? []) as EmailConfigOption[]);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (state !== "ready") return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
    setPreview(null);
  }

  function beginEdit(row: NotificationTemplate) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      channel: row.channel,
      language: row.language,
      sms_gateway_id: row.sms_gateway_id ? String(row.sms_gateway_id) : "",
      email_configuration_id: row.email_configuration_id ? String(row.email_configuration_id) : "",
      subject: row.subject ?? "",
      body: row.body,
      is_active: row.is_active,
    });
    setPreview(null);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getStoredToken();
    if (!token) return;

    setError(null);
    setMessage(null);

    const payload = {
      name: form.name,
      channel: form.channel,
      language: form.language,
      sms_gateway_id: form.channel === "sms" && form.sms_gateway_id ? Number(form.sms_gateway_id) : null,
      email_configuration_id: form.channel === "email" && form.email_configuration_id ? Number(form.email_configuration_id) : null,
      subject: form.channel === "email" ? form.subject : null,
      body: form.body,
      is_active: form.is_active,
    };

    try {
      const endpoint = editingId
        ? `${API_BASE_URL}/admin/notification-templates/${editingId}`
        : `${API_BASE_URL}/admin/notification-templates`;

      const res = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Failed to save template.");
        return;
      }

      setMessage(data?.message ?? "Saved successfully.");
      resetForm();
      await loadData();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(t.deleteConfirm)) return;
    const token = getStoredToken();
    if (!token) return;

    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/notification-templates/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Failed to delete template.");
        return;
      }

      setMessage(data?.message ?? "Deleted successfully.");
      if (editingId === id) resetForm();
      await loadData();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function handlePreview() {
    const token = getStoredToken();
    if (!token || !editingId) return;

    let parsedVars: Record<string, unknown> = {};
    try {
      parsedVars = previewVariables.trim() ? (JSON.parse(previewVariables) as Record<string, unknown>) : {};
    } catch {
      setError(locale === "bn" ? "Preview variables valid JSON হতে হবে।" : "Preview variables must be valid JSON.");
      return;
    }

    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/notification-templates/preview`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ template_id: editingId, variables: parsedVars }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Failed to preview template.");
        return;
      }

      setPreview(data?.data ?? null);
    } catch {
      setError("Network error. Please try again.");
    }
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
      sidebarTitle={t.sidebarTitle}
      searchPlaceholder={t.searchPlaceholder}
      menu={menu}
      activeKey="settings-notification-templates"
      defaultExpandedKey="settings"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="grid gap-4 xl:grid-cols-12">
        <article className="catv-panel p-4 xl:col-span-5">
          <h2 className="mb-3 text-base font-semibold">{editingId ? t.update : t.addNew}</h2>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.name}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.channel}</label>
                <select
                  value={form.channel}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      channel: e.target.value as Channel,
                      sms_gateway_id: "",
                      email_configuration_id: "",
                      subject: "",
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.language}</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value as Language }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
                >
                  <option value="bn">বাংলা</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            {form.channel === "sms" ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.smsGateway}</label>
                <select
                  required
                  value={form.sms_gateway_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, sms_gateway_id: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
                >
                  <option value="">Select gateway</option>
                  {gateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {gateway.name} ({gateway.provider})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.smtp}</label>
                  <select
                    required
                    value={form.email_configuration_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, email_configuration_id: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Select SMTP</option>
                    {emailConfigs.map((cfg) => (
                      <option key={cfg.id} value={cfg.id}>
                        {cfg.name} ({cfg.from_email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.subject}</label>
                  <input
                    required
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.body}</label>
              <textarea
                ref={bodyTextareaRef}
                required
                rows={6}
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="e.g. Your OTP is {{otp}}"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {t.form.placeholderHint}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedPlaceholders.map((placeholder) => (
                    <button
                      key={placeholder}
                      type="button"
                      onClick={() => handleInsertPlaceholder(placeholder)}
                      className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-semibold hover:bg-[var(--surface)]"
                    >
                      {placeholder}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              {t.form.active}
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                {editingId ? t.update : t.save}
              </button>
              <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                {t.cancel}
              </button>
              {editingId ? (
                <button type="button" onClick={handlePreview} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                  {t.form.preview}
                </button>
              ) : null}
            </div>

            {editingId ? (
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <label className="block text-xs font-semibold text-[var(--muted)]">JSON Variables</label>
                <textarea
                  rows={4}
                  value={previewVariables}
                  onChange={(e) => setPreviewVariables(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs outline-none"
                />
              </div>
            ) : null}

            {preview ? (
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <h3 className="text-sm font-semibold">{t.form.previewResult}</h3>
                {preview.subject ? <p className="text-xs"><strong>Subject:</strong> {preview.subject}</p> : null}
                <p className="whitespace-pre-wrap text-xs"><strong>Body:</strong> {preview.body}</p>
                {preview.missing_placeholders && preview.missing_placeholders.length > 0 ? (
                  <p className="text-xs text-amber-500">
                    Missing: {preview.missing_placeholders.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
          </form>
        </article>

        <article className="catv-panel overflow-hidden xl:col-span-7">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[#2f7ec1] text-white">
                <tr>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">Name</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">Channel</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.form.placeholders}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.status}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                      {t.loading}
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                      {t.noData}
                    </td>
                  </tr>
                ) : (
                  templates.map((row) => (
                    <tr key={row.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                      <td className="border border-[#e5ebf5] px-3 py-2 font-medium">{row.name}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2 uppercase">{row.channel}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2 text-xs">{(row.variables ?? []).join(", ") || "-"}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {row.is_active ? t.active : t.inactive}
                        </span>
                      </td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => beginEdit(row)} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                            {t.edit}
                          </button>
                          <button type="button" onClick={() => void handleDelete(row.id)} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white">
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
        </article>
      </section>
    </CatvShell>
  );
}
