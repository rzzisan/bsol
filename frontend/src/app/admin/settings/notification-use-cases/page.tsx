"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type UseCaseKey = "phone_verification" | "email_verification" | "bill_notification" | "forgot_password";
type PriorityChannel = "sms" | "email" | "both";

interface NotificationTemplateOption {
  id: number;
  name: string;
  channel: "sms" | "email";
  language: "bn" | "en";
}

interface UseCaseBinding {
  id: number;
  use_case_key: UseCaseKey;
  sms_template_id: number | null;
  email_template_id: number | null;
  priority_channel: PriorityChannel;
  is_active: boolean;
  sms_template?: NotificationTemplateOption | null;
  email_template?: NotificationTemplateOption | null;
}

interface DispatchLog {
  id: number;
  use_case_key: string | null;
  channel: "sms" | "email";
  status: "queued" | "sent" | "failed";
  recipient: string;
  error_message: string | null;
  created_at: string;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const useCaseOptions: Array<{ key: UseCaseKey; bn: string; en: string }> = [
  { key: "phone_verification", bn: "ফোন ভেরিফাই", en: "Phone Verification" },
  { key: "email_verification", bn: "ইমেইল ভেরিফাই", en: "Email Verification" },
  { key: "bill_notification", bn: "বিল নোটিফিকেশন", en: "Bill Notification" },
  { key: "forgot_password", bn: "ফরগেট পাসওয়ার্ড", en: "Forgot Password" },
];

const text = {
  bn: {
    title: "ইউজকেস টেমপ্লেট ম্যাপিং",
    subtitle: "কোন কাজের জন্য কোন SMS/Email template ব্যবহার হবে সেটি নির্ধারণ করুন",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
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
    loading: "লোড হচ্ছে...",
    save: "সেভ",
    update: "আপডেট",
    testDispatch: "টেস্ট ডিসপ্যাচ",
    useCase: "ইউজকেস",
    smsTemplate: "SMS Template",
    emailTemplate: "Email Template",
    priority: "Priority",
    active: "সক্রিয়",
    inactive: "নিষ্ক্রিয়",
    actions: "অ্যাকশন",
    logs: "ডেলিভারি লগ",
    recipientPhone: "টেস্ট ফোন",
    recipientEmail: "টেস্ট ইমেইল",
    variables: "টেস্ট ভ্যারিয়েবল (JSON)",
  },
  en: {
    title: "Use-case Template Mapping",
    subtitle: "Assign SMS/Email templates for each use-case",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can access this page.",
    goHome: "Go Home",
    languageLabel: "Language",
    themeLabel: "Theme",
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
    loading: "Loading...",
    save: "Save",
    update: "Update",
    testDispatch: "Test Dispatch",
    useCase: "Use-case",
    smsTemplate: "SMS Template",
    emailTemplate: "Email Template",
    priority: "Priority",
    active: "Active",
    inactive: "Inactive",
    actions: "Actions",
    logs: "Delivery Logs",
    recipientPhone: "Test Phone",
    recipientEmail: "Test Email",
    variables: "Test Variables (JSON)",
  },
};

export default function NotificationUseCasesPage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [smsTemplates, setSmsTemplates] = useState<NotificationTemplateOption[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<NotificationTemplateOption[]>([]);
  const [bindings, setBindings] = useState<UseCaseBinding[]>([]);
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    use_case_key: "phone_verification" as UseCaseKey,
    sms_template_id: "",
    email_template_id: "",
    priority_channel: "both" as PriorityChannel,
    is_active: true,
  });

  const [testData, setTestData] = useState({
    recipient_phone: "",
    recipient_email: "",
    variables: '{"otp":"654321","verification_link":"https://example.com/verify"}',
  });

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

  async function loadData() {
    const token = getStoredToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [tplRes, bindingRes, logRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/notification-templates`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/admin/notification-use-case-bindings`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/admin/notification-dispatch/logs?per_page=8`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        }),
      ]);

      const tplData = await tplRes.json();
      const bindingData = await bindingRes.json();
      const logData = await logRes.json();

      if (tplRes.ok) {
        const all = (tplData?.data ?? []) as NotificationTemplateOption[];
        setSmsTemplates(all.filter((row) => row.channel === "sms"));
        setEmailTemplates(all.filter((row) => row.channel === "email"));
      }

      if (bindingRes.ok) {
        setBindings((bindingData?.data ?? []) as UseCaseBinding[]);
      }

      if (logRes.ok) {
        setLogs((logData?.data ?? []) as DispatchLog[]);
      }

      if (!tplRes.ok || !bindingRes.ok) {
        setError(tplData?.message ?? bindingData?.message ?? "Failed to load data.");
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

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getStoredToken();
    if (!token) return;

    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/notification-use-case-bindings`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          use_case_key: form.use_case_key,
          sms_template_id: form.sms_template_id ? Number(form.sms_template_id) : null,
          email_template_id: form.email_template_id ? Number(form.email_template_id) : null,
          priority_channel: form.priority_channel,
          is_active: form.is_active,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Failed to save binding.");
        return;
      }

      setMessage(data?.message ?? "Saved successfully.");
      await loadData();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function handleDispatchTest() {
    const token = getStoredToken();
    if (!token) return;

    let parsedVariables: Record<string, unknown> = {};
    try {
      parsedVariables = testData.variables.trim() ? (JSON.parse(testData.variables) as Record<string, unknown>) : {};
    } catch {
      setError(locale === "bn" ? "Variables JSON সঠিক নয়।" : "Variables JSON is invalid.");
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/notification-dispatch`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          use_case_key: form.use_case_key,
          recipient_phone: testData.recipient_phone || null,
          recipient_email: testData.recipient_email || null,
          variables: parsedVariables,
          queue: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Dispatch failed.");
        return;
      }

      setMessage(data?.message ?? "Queued successfully.");
      await loadData();
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
      menu={menu}
      activeKey="settings-notification-use-cases"
      defaultExpandedKey="settings"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="grid gap-4 xl:grid-cols-12">
        <article className="catv-panel p-4 xl:col-span-5">
          <h2 className="mb-3 text-base font-semibold">{t.title}</h2>
          <form className="space-y-3" onSubmit={handleSave}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.useCase}</label>
              <select
                value={form.use_case_key}
                onChange={(e) => setForm((prev) => ({ ...prev, use_case_key: e.target.value as UseCaseKey }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              >
                {useCaseOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {locale === "bn" ? opt.bn : opt.en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.smsTemplate}</label>
              <select
                value={form.sms_template_id}
                onChange={(e) => setForm((prev) => ({ ...prev, sms_template_id: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              >
                <option value="">None</option>
                {smsTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.language})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.emailTemplate}</label>
              <select
                value={form.email_template_id}
                onChange={(e) => setForm((prev) => ({ ...prev, email_template_id: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              >
                <option value="">None</option>
                {emailTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.language})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.priority}</label>
              <select
                value={form.priority_channel}
                onChange={(e) => setForm((prev) => ({ ...prev, priority_channel: e.target.value as PriorityChannel }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              >
                <option value="both">Both</option>
                <option value="sms">SMS First</option>
                <option value="email">Email First</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              {form.is_active ? t.active : t.inactive}
            </label>

            <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              {t.save}
            </button>

            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <label className="block text-xs font-semibold text-[var(--muted)]">{t.recipientPhone}</label>
              <input
                value={testData.recipient_phone}
                onChange={(e) => setTestData((prev) => ({ ...prev, recipient_phone: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
                placeholder="017XXXXXXXX"
              />

              <label className="block text-xs font-semibold text-[var(--muted)]">{t.recipientEmail}</label>
              <input
                value={testData.recipient_email}
                onChange={(e) => setTestData((prev) => ({ ...prev, recipient_email: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
                placeholder="user@example.com"
              />

              <label className="block text-xs font-semibold text-[var(--muted)]">{t.variables}</label>
              <textarea
                rows={4}
                value={testData.variables}
                onChange={(e) => setTestData((prev) => ({ ...prev, variables: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs outline-none"
              />

              <button
                type="button"
                onClick={handleDispatchTest}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              >
                {t.testDispatch}
              </button>
            </div>

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
          </form>
        </article>

        <article className="catv-panel overflow-hidden xl:col-span-7">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[#2f7ec1] text-white">
                <tr>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.useCase}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">SMS</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">Email</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.priority}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                      {t.loading}
                    </td>
                  </tr>
                ) : bindings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                      No binding found.
                    </td>
                  </tr>
                ) : (
                  bindings.map((row) => (
                    <tr key={row.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                      <td className="border border-[#e5ebf5] px-3 py-2">{row.use_case_key}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2 text-xs">{row.sms_template?.name ?? "-"}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2 text-xs">{row.email_template?.name ?? "-"}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2 uppercase">{row.priority_channel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[var(--border)] p-4">
            <h3 className="mb-2 text-sm font-semibold">{t.logs}</h3>
            <div className="space-y-2">
              {logs.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No delivery logs yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
                    <p>
                      <strong>#{log.id}</strong> {log.use_case_key} → {log.channel.toUpperCase()} / {log.status.toUpperCase()} / {log.recipient}
                    </p>
                    {log.error_message ? <p className="text-rose-500">{log.error_message}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </article>
      </section>
    </CatvShell>
  );
}
