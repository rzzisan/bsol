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
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

interface EmailConfig {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  encryption: "tls" | "ssl";
  from_email: string;
  from_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  host: string;
  port: number | "";
  username: string;
  password: string;
  encryption: "tls" | "ssl";
  from_email: string;
  from_name: string;
}

const initialFormData: FormData = {
  name: "",
  host: "",
  port: "",
  username: "",
  password: "",
  encryption: "tls",
  from_email: "",
  from_name: "",
};

const text = {
  bn: {
    title: "ইমেইল সেটিংস",
    subtitle: "SMTP কনফিগারেশন পরিচালনা করুন এবং একাধিক ইমেইল অ্যাকাউন্ট সেটআপ করুন",
    loginRequired: "ইমেইল সেটিংস দেখতে হলে আগে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন ইউজার এই পেজে প্রবেশ করতে পারবেন।",
    goHome: "হোমে যান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    sidebarTitle: "অ্যাডমিন প্যানেল",
    searchPlaceholder: "সার্চ করুন",
    welcome: "স্বাগতম",
    loading: "লোডিং...",
    error: "ত্রুটি",
    success: "সফল",
    addNew: "নতুন যোগ করুন",
    edit: "সম্পাদনা",
    delete: "মুছুন",
    save: "সংরক্ষণ করুন",
    cancel: "বাতিল",
    testConnection: "সংযোগ পরীক্ষা করুন",
    testing: "পরীক্ষা করছে...",
    connectionSuccess: "সংযোগ সফল!",
    connectionFailed: "সংযোগ ব্যর্থ",
    configName: "কনফিগারেশনের নাম",
    configNamePlaceholder: "যেমন: রেজিস্ট্রেশন, পাসওয়ার্ড রিসেট",
    host: "SMTP সার্ভার",
    hostPlaceholder: "যেমন: mail.example.com",
    port: "পোর্ট",
    username: "ইউজারনেম",
    password: "পাসওয়ার্ড",
    encryption: "এনক্রিপশন",
    fromEmail: "প্রেরকের ইমেইল",
    fromName: "প্রেরকের নাম",
    isActive: "সক্রিয়",
    configurations: "ইমেইল কনফিগারেশন",
    noConfigurations: "কোনো ইমেইল কনফিগারেশন নেই",
    createdAt: "তৈরি",
    confirmDelete: "মুছতে চান?",
    deleteSuccess: "কনফিগারেশন মুছা হয়েছে",
    updateSuccess: "কনফিগারেশন আপডেট হয়েছে",
    createSuccess: "কনফিগারেশন তৈরি হয়েছে",
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
    },
  },
  en: {
    title: "Email Settings",
    subtitle: "Manage SMTP configurations and set up multiple email accounts",
    loginRequired: "Please login as an admin to access email settings.",
    accessDenied: "Only admin users can access this page.",
    goHome: "Go Home",
    languageLabel: "Language",
    themeLabel: "Theme",
    sidebarTitle: "Admin Panel",
    searchPlaceholder: "Search",
    welcome: "Welcome",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    addNew: "Add New",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    testConnection: "Test Connection",
    testing: "Testing...",
    connectionSuccess: "Connection successful!",
    connectionFailed: "Connection failed",
    configName: "Configuration Name",
    configNamePlaceholder: "e.g., Registration, Password Reset",
    host: "SMTP Server",
    hostPlaceholder: "e.g., mail.example.com",
    port: "Port",
    username: "Username",
    password: "Password",
    encryption: "Encryption",
    fromEmail: "From Email",
    fromName: "From Name",
    isActive: "Active",
    configurations: "Email Configurations",
    noConfigurations: "No email configurations found",
    createdAt: "Created",
    confirmDelete: "Delete this configuration?",
    deleteSuccess: "Configuration deleted",
    updateSuccess: "Configuration updated",
    createSuccess: "Configuration created",
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
    },
  },
};

export default function EmailSettingsPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [configurations, setConfigurations] = useState<EmailConfig[]>([]);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    setLocale(getStoredLocale());
    setTheme(getStoredTheme());

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

    setUser(storedUser);
    setState("ready");
    loadConfigurations(token);
  }, []);

  const t = useMemo(() => text[locale], [locale]);
  const token = getStoredToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://bsol.zyrotechbd.com/api";

  const loadConfigurations = async (authToken: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/admin/email-configurations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (data.status === "success") {
        setConfigurations(data.data);
      }
    } catch (err) {
      console.error("Failed to load configurations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const fieldValue = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: fieldValue }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.host.trim()) newErrors.host = "Host is required";
    if (!formData.port) newErrors.port = "Port is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.password.trim()) newErrors.password = "Password is required";
    if (!formData.from_email.trim()) newErrors.from_email = "From email is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !token) return;

    try {
      setLoading(true);
      setApiError("");
      setApiSuccess("");

      const method = editingId ? "PUT" : "POST";
      const endpoint = editingId
        ? `${baseUrl}/admin/email-configurations/${editingId}`
        : `${baseUrl}/admin/email-configurations`;

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          port: Number(formData.port),
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setApiSuccess(editingId ? t.updateSuccess : t.createSuccess);
        setFormData(initialFormData);
        setEditingId(null);
        setShowForm(false);
        await loadConfigurations(token);
      } else {
        setApiError(data.message || t.error);
      }
    } catch (err) {
      setApiError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: EmailConfig) => {
    setFormData({
      name: config.name,
      host: config.host,
      port: config.port,
      username: config.username,
      password: "", // Don't load password for security
      encryption: config.encryption,
      from_email: config.from_email,
      from_name: config.from_name || "",
    });
    setEditingId(config.id);
    setShowForm(true);
    setErrors({});
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t.confirmDelete) || !token) return;

    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/admin/email-configurations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.status === "success") {
        setApiSuccess(t.deleteSuccess);
        await loadConfigurations(token);
      } else {
        setApiError(data.message || t.error);
      }
    } catch (err) {
      setApiError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!token) return;

    // Validation for test connection
    const testErrors: Record<string, string> = {};
    if (!formData.host.trim()) testErrors.host = "Host is required";
    if (!formData.port) testErrors.port = "Port is required";
    if (!formData.username.trim()) testErrors.username = "Username is required";
    if (!formData.password.trim()) testErrors.password = "Password is required";

    if (Object.keys(testErrors).length > 0) {
      setTestMessage(`✗ ${t.error}: সব ফিল্ড পূরণ করুন (Fill all fields)`);
      setErrors(testErrors);
      return;
    }

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutMs = 15000;

    try {
      setTesting(true);
      setTestMessage("");

      const timeoutPromise = new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("TEST_CONNECTION_TIMEOUT"));
        }, timeoutMs);
      });

      const response = (await Promise.race([
        fetch(`${baseUrl}/admin/email-configurations/test-connection`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            host: formData.host.trim(),
            port: Number(formData.port),
            username: formData.username.trim(),
            password: formData.password,
            encryption: formData.encryption,
          }),
        }),
        timeoutPromise,
      ])) as Response;
      let data: { status?: string; message?: string } | null = null;
      try {
        data = await response.json();
      } catch {
        setTestMessage(`✗ ${t.connectionFailed} (${response.status})`);
        return;
      }

      if (response.ok && data?.status === "success") {
        setTestMessage(`✓ ${t.connectionSuccess}`);
      } else {
        setTestMessage(`✗ ${data?.message || `${t.connectionFailed} (${response.status})`}`);
      }
    } catch (err) {
      console.error("Test connection error:", err);
      if (
        (err instanceof Error && err.message === "TEST_CONNECTION_TIMEOUT") ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        setTestMessage(`✗ ${t.connectionFailed}: Request timed out. Please check SMTP host/port.`);
      } else {
        setTestMessage(`✗ ${t.error}: নেটওয়ার্ক অনুরোধ ব্যর্থ (Network request failed)`);
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setTesting(false);
    }
  };

  const handleAddNew = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setShowForm(true);
    setErrors({});
    setTestMessage("");
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData(initialFormData);
    setEditingId(null);
    setErrors({});
    setTestMessage("");
  };

  const menus = useMemo(
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
      }),
    [t],
  );

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
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
      sidebarTitle={t.sidebarTitle}
      searchPlaceholder={t.searchPlaceholder}
      userName={user?.name}
      userMeta={user?.email}
      menu={menus}
      activeKey="settings-email"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">{t.configurations}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>
          </div>
          {!showForm && (
            <button
              onClick={handleAddNew}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:opacity-90"
            >
              {t.addNew}
            </button>
          )}
        </div>
      </section>

      {apiError && (
        <section className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-600 dark:bg-red-900/30 dark:text-red-200">
          {apiError}
        </section>
      )}

      {apiSuccess && (
        <section className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-600 dark:bg-green-900/30 dark:text-green-200">
          {apiSuccess}
        </section>
      )}

      {showForm && (
        <section className="catv-panel mt-4 p-4 sm:p-5">
          <h3 className="mb-4 text-lg font-semibold">{editingId ? t.edit : t.addNew}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)]">{t.configName}</label>
                <input
                  type="text"
                  name="name"
                  placeholder={t.configNamePlaceholder}
                  value={formData.name}
                  onChange={handleFormChange}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)]">{t.host}</label>
                <input
                  type="text"
                  name="host"
                  placeholder={t.hostPlaceholder}
                  value={formData.host}
                  onChange={handleFormChange}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                {errors.host && <p className="mt-1 text-xs text-red-600">{errors.host}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)]">{t.port}</label>
                <input
                  type="number"
                  name="port"
                  value={formData.port}
                  onChange={handleFormChange}
                  placeholder="587"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                {errors.port && <p className="mt-1 text-xs text-red-600">{errors.port}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)]">{t.encryption}</label>
                <select
                  name="encryption"
                  value={formData.encryption}
                  onChange={handleFormChange}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-[var(--foreground)]">{t.username}</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleFormChange}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-[var(--foreground)]">{t.password}</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  placeholder={editingId ? "Leave blank to keep current password" : ""}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)]">{t.fromEmail}</label>
                <input
                  type="email"
                  name="from_email"
                  value={formData.from_email}
                  onChange={handleFormChange}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                {errors.from_email && <p className="mt-1 text-xs text-red-600">{errors.from_email}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)]">{t.fromName}</label>
                <input
                  type="text"
                  name="from_name"
                  value={formData.from_name}
                  onChange={handleFormChange}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            {testMessage && (
              <div className={`rounded-lg p-3 text-sm ${testMessage.startsWith("✓") ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200" : "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200"}`}>
                {testMessage}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || loading}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]"
              >
                {testing ? t.testing : t.testConnection}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {loading ? t.loading : t.save}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]"
              >
                {t.cancel}
              </button>
            </div>
          </form>
        </section>
      )}

      {!showForm && (
        <section className="catv-panel mt-4 p-4 sm:p-5">
          {loading ? (
            <div className="text-center text-[var(--muted)]">{t.loading}</div>
          ) : configurations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--muted)]">
              {t.noConfigurations}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-2 text-left font-semibold">{t.configName}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t.host}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t.fromEmail}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t.isActive}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t.createdAt}</th>
                    <th className="px-3 py-2 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configurations.map((config) => (
                    <tr key={config.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                      <td className="px-3 py-2">{config.name}</td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{config.host}</td>
                      <td className="px-3 py-2 text-xs">{config.from_email}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                            config.is_active
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200"
                          }`}
                        >
                          {config.is_active ? "✓ Active" : "○ Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">
                        {new Date(config.created_at).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US")}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(config)}
                            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {t.edit}
                          </button>
                          <button
                            onClick={() => handleDelete(config.id)}
                            className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                          >
                            {t.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </CatvShell>
  );
}
