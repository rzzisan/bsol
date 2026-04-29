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

type GatewayProvider = "khudebarta";

interface SmsGatewayRow {
  id: number;
  name: string;
  provider: GatewayProvider;
  endpoint_url: string | null;
  sender_id: string | null;
  is_active: boolean;
  is_enabled: boolean;
  has_api_key: boolean;
  has_secret_key: boolean;
  api_key_masked: string | null;
  secret_key_masked: string | null;
  updated_at: string | null;
}

interface GatewayFormState {
  name: string;
  provider: GatewayProvider;
  endpoint_url: string;
  api_key: string;
  secret_key: string;
  sender_id: string;
  is_active: boolean;
  is_enabled: boolean;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const text = {
  bn: {
    title: "এসএমএস গেটওয়ে",
    subtitle: "একাধিক SMS Gateway credential সংরক্ষণ ও পরিচালনা করুন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    menuDashboard: "ড্যাশবোর্ড",
    menuCustomers: "গ্রাহক",
    menuActive: "অ্যাকটিভ গ্রাহক",
    menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস",
    menuSmsGateway: "এসএমএস গেটওয়ে",
    menuSmsSend: "এসএমএস সেন্ড",
    menuSmsHistory: "এসএমএস হিস্টোরি",
      menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ",
    menuBilling: "বিলিং",
    menuReports: "রিপোর্ট",
    menuSettings: "সেটিংস",
    menuEmailSettings: "ইমেইল সেটিংস",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    addNew: "নতুন গেটওয়ে",
    edit: "এডিট",
    delete: "ডিলিট",
    deleting: "ডিলিট হচ্ছে...",
    updateGateway: "গেটওয়ে আপডেট",
    createGateway: "গেটওয়ে তৈরি করুন",
    save: "সেভ করুন",
    update: "আপডেট করুন",
    cancelEdit: "এডিট বাতিল",
    loading: "গেটওয়ে ডাটা লোড হচ্ছে...",
    empty: "কোনো গেটওয়ে পাওয়া যায়নি।",
    active: "Active",
    enabled: "Enabled",
    disabled: "Disabled",
    yes: "হ্যাঁ",
    no: "না",
    form: {
      name: "গেটওয়ের নাম",
      provider: "Provider",
      endpoint: "Endpoint URL",
      senderId: "Sender ID",
      apiKey: "API Key",
      secretKey: "Secret Key",
      activeGateway: "এই গেটওয়েকে Active করুন",
      enabledGateway: "এই গেটওয়ে Enabled রাখুন",
      optionalHint: "এডিটে API/Secret ফাঁকা রাখলে পুরনো credential অপরিবর্তিত থাকবে।",
    },
    table: {
      name: "নাম",
      provider: "Provider",
      endpoint: "Endpoint",
      sender: "Sender",
      api: "API Key",
      secret: "Secret",
      status: "স্ট্যাটাস",
      active: "Active",
      updated: "Updated",
      action: "Action",
    },
    deleteConfirm: "এই গেটওয়ে মুছে ফেলতে চান?",
  },
  en: {
    title: "SMS Gateway",
    subtitle: "Manage credentials for one or more SMS gateways.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    menuDashboard: "Dashboard",
    menuCustomers: "Customers",
    menuActive: "Active Customers",
    menuPending: "Pending Customers",
    menuSms: "SMS",
    menuSmsGateway: "SMS Gateway",
    menuSmsSend: "Send SMS",
    menuSmsHistory: "SMS History",
      menuSmsCredit: "SMS Credit",
    menuPackages: "Packages",
    menuBilling: "Billing",
    menuReports: "Reports",
    menuSettings: "Settings",
    menuEmailSettings: "Email Settings",
    languageLabel: "Language",
    themeLabel: "Theme",
    addNew: "Add New Gateway",
    edit: "Edit",
    delete: "Delete",
    deleting: "Deleting...",
    updateGateway: "Update Gateway",
    createGateway: "Create Gateway",
    save: "Save",
    update: "Update",
    cancelEdit: "Cancel Edit",
    loading: "Loading gateway data...",
    empty: "No gateway found.",
    active: "Active",
    enabled: "Enabled",
    disabled: "Disabled",
    yes: "Yes",
    no: "No",
    form: {
      name: "Gateway Name",
      provider: "Provider",
      endpoint: "Endpoint URL",
      senderId: "Sender ID",
      apiKey: "API Key",
      secretKey: "Secret Key",
      activeGateway: "Mark as active gateway",
      enabledGateway: "Keep this gateway enabled",
      optionalHint: "For edit, leave API/Secret blank to keep existing credentials.",
    },
    table: {
      name: "Name",
      provider: "Provider",
      endpoint: "Endpoint",
      sender: "Sender",
      api: "API Key",
      secret: "Secret",
      status: "Status",
      active: "Active",
      updated: "Updated",
      action: "Action",
    },
    deleteConfirm: "Are you sure you want to delete this gateway?",
  },
};

const DEFAULT_FORM: GatewayFormState = {
  name: "Khudebarta",
  provider: "khudebarta",
  endpoint_url: "",
  api_key: "",
  secret_key: "",
  sender_id: "",
  is_active: true,
  is_enabled: true,
};

export default function AdminSmsGatewaysPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [rows, setRows] = useState<SmsGatewayRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<GatewayFormState>(DEFAULT_FORM);

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

  async function loadGateways() {
    const token = getStoredToken();
    if (!token) return;

    setLoadingRows(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/sms/gateways`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Failed to load SMS gateways.");
        return;
      }

      const gateways = (data?.gateways ?? []) as SmsGatewayRow[];
      setRows(gateways);

      if (gateways.length > 0 && selectedId === null) {
        const first = gateways[0];
        setSelectedId(first.id);
        setForm({
          name: first.name,
          provider: first.provider,
          endpoint_url: first.endpoint_url ?? "",
          api_key: "",
          secret_key: "",
          sender_id: first.sender_id ?? "",
          is_active: first.is_active,
          is_enabled: first.is_enabled,
        });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    if (state !== "ready") return;
    void loadGateways();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
        reports: t.menuReports,
        settings: t.menuSettings,
        emailSettings: t.menuEmailSettings,
      }),
    [t],
  );

  function beginCreate() {
    setSelectedId(null);
    setForm(DEFAULT_FORM);
    setError(null);
    setMessage(null);
  }

  function beginEdit(row: SmsGatewayRow) {
    setSelectedId(row.id);
    setForm({
      name: row.name,
      provider: row.provider,
      endpoint_url: row.endpoint_url ?? "",
      api_key: "",
      secret_key: "",
      sender_id: row.sender_id ?? "",
      is_active: row.is_active,
      is_enabled: row.is_enabled,
    });
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getStoredToken();
    if (!token) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      provider: form.provider,
      endpoint_url: form.endpoint_url || null,
      sender_id: form.sender_id || null,
      is_active: form.is_active,
      is_enabled: form.is_enabled,
    };

    if (form.api_key.trim()) payload.api_key = form.api_key.trim();
    if (form.secret_key.trim()) payload.secret_key = form.secret_key.trim();

    try {
      const editing = selectedId !== null;
      const url = editing
        ? `${API_BASE_URL}/admin/sms/gateways/${selectedId}`
        : `${API_BASE_URL}/admin/sms/gateways`;

      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Failed to save gateway.");
        return;
      }

      setMessage(data?.message ?? "Saved successfully.");
      await loadGateways();

      if (data?.gateway) {
        beginEdit(data.gateway as SmsGatewayRow);
      } else if (!editing) {
        beginCreate();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    const token = getStoredToken();
    if (!token) return;

    setDeletingId(id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/sms/gateways/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Failed to delete gateway.");
        return;
      }

      setMessage(data?.message ?? "Deleted successfully.");
      await loadGateways();
      if (selectedId === id) beginCreate();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
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
      sidebarTitle="Admin Panel"
      userName={t.menuSms}
      userMeta={t.menuSmsGateway}
      menu={menu}
      activeKey="sms-gateway"
      defaultExpandedKey="sms"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="grid gap-4 xl:grid-cols-12">
        <article className="catv-panel p-4 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{selectedId ? t.updateGateway : t.createGateway}</h2>
            <button
              type="button"
              onClick={beginCreate}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold"
            >
              {t.addNew}
            </button>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.name}</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.provider}</label>
              <select
                value={form.provider}
                onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value as GatewayProvider }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              >
                <option value="khudebarta">Khudebarta</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.endpoint}</label>
              <input
                value={form.endpoint_url}
                onChange={(e) => setForm((prev) => ({ ...prev, endpoint_url: e.target.value }))}
                type="url"
                placeholder="https://..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.senderId}</label>
              <input
                value={form.sender_id}
                onChange={(e) => setForm((prev) => ({ ...prev, sender_id: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.apiKey}</label>
              <input
                value={form.api_key}
                onChange={(e) => setForm((prev) => ({ ...prev, api_key: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.secretKey}</label>
              <input
                value={form.secret_key}
                onChange={(e) => setForm((prev) => ({ ...prev, secret_key: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
            </div>

            <p className="text-xs text-[var(--muted)]">{t.form.optionalHint}</p>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              {t.form.activeGateway}
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, is_enabled: e.target.checked }))}
              />
              {t.form.enabledGateway}
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {submitting ? (selectedId ? t.update : t.save) + "..." : selectedId ? t.update : t.save}
              </button>

              {selectedId ? (
                <button
                  type="button"
                  onClick={beginCreate}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                >
                  {t.cancelEdit}
                </button>
              ) : null}
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
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.name}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.provider}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.endpoint}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.sender}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.api}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.secret}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.status}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.active}</th>
                  <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.action}</th>
                </tr>
              </thead>
              <tbody>
                {loadingRows ? (
                  <tr>
                    <td colSpan={9} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                      {t.loading}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                      <td className="border border-[#e5ebf5] px-3 py-2 font-medium">{row.name}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2">{row.provider}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        <span className="line-clamp-1 max-w-[220px]">{row.endpoint_url ?? "-"}</span>
                      </td>
                      <td className="border border-[#e5ebf5] px-3 py-2">{row.sender_id ?? "-"}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2">{row.api_key_masked ?? "-"}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2">{row.secret_key_masked ?? "-"}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            row.is_enabled ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {row.is_enabled ? t.enabled : t.disabled}
                        </span>
                      </td>
                      <td className="border border-[#e5ebf5] px-3 py-2">{row.is_active ? t.yes : t.no}</td>
                      <td className="border border-[#e5ebf5] px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => beginEdit(row)}
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                          >
                            {t.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(row.id)}
                            disabled={deletingId === row.id}
                            className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {deletingId === row.id ? t.deleting : t.delete}
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
