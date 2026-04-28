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

interface SmsGateway {
  id: number;
  name: string;
  provider: string;
}

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  role: "admin" | "user";
  subscription_package_id: number | null;
  sms_gateway_id: number | null;
  sms_balance?: number;
  assigned_gateway?: { id: number; name: string; provider: string } | null;
  created_at: string;
}

interface UserForm {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: "admin" | "user";
  sms_gateway_id: string;
}

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  role: "user",
  sms_gateway_id: "",
};

const text = {
  bn: {
    title: "অ্যাকটিভ গ্রাহক",
    subtitle: "সকল রেজিস্টার্ড ইউজার পরিচালনা করুন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    backToAdmin: "অ্যাডমিন ড্যাশবোর্ড",
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
    loading: "ডাটা লোড হচ্ছে...",
    empty: "কোনো ইউজার পাওয়া যায়নি।",
    addCustomer: "নতুন গ্রাহক যোগ করুন",
    table: {
      id: "ID",
      name: "নাম",
      email: "ইমেইল",
      mobile: "মোবাইল",
      role: "রোল",
      gateway: "এসএমএস গেটওয়ে",
      credit: "SMS ক্রেডিট",
      date: "রেজিস্টার্ড তারিখ",
      actions: "অ্যাকশন",
    },
    form: {
      name: "নাম",
      email: "ইমেইল",
      mobile: "মোবাইল",
      password: "পাসওয়ার্ড",
      passwordHint: "(এডিটের সময় খালি রাখলে পরিবর্তন হবে না)",
      role: "রোল",
      gateway: "এসএমএস গেটওয়ে",
      gatewayNone: "-- গেটওয়ে নেই --",
      roleAdmin: "অ্যাডমিন",
      roleUser: "ইউজার",
      save: "সংরক্ষণ করুন",
      cancel: "বাতিল করুন",
      saving: "সংরক্ষণ করা হচ্ছে...",
    },
    editTitle: "গ্রাহক সম্পাদনা",
    addTitle: "নতুন গ্রাহক",
    deleteTitle: "গ্রাহক মুছুন",
    deleteConfirmPrefix: "কে মুছতে চান?",
    deleteBtn: "মুছুন",
    deleting: "মুছে ফেলা হচ্ছে...",
    edit: "এডিট",
    delete: "মুছুন",
    noGateway: "নেই",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
  },
  en: {
    title: "Active Customers",
    subtitle: "Manage all registered users.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    backToAdmin: "Admin Dashboard",
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
    loading: "Loading data...",
    empty: "No users found.",
    addCustomer: "Add New Customer",
    table: {
      id: "ID",
      name: "Name",
      email: "Email",
      mobile: "Mobile",
      role: "Role",
      gateway: "SMS Gateway",
      credit: "SMS Credit",
      date: "Registered Date",
      actions: "Actions",
    },
    form: {
      name: "Name",
      email: "Email",
      mobile: "Mobile",
      password: "Password",
      passwordHint: "(Leave blank to keep current password)",
      role: "Role",
      gateway: "SMS Gateway",
      gatewayNone: "-- No Gateway --",
      roleAdmin: "Admin",
      roleUser: "User",
      save: "Save",
      cancel: "Cancel",
      saving: "Saving...",
    },
    editTitle: "Edit Customer",
    addTitle: "Add Customer",
    deleteTitle: "Delete Customer",
    deleteConfirmPrefix: "Delete",
    deleteBtn: "Delete",
    deleting: "Deleting...",
    edit: "Edit",
    delete: "Delete",
    noGateway: "None",
    languageLabel: "Language",
    themeLabel: "Theme",
  },
};

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

const labelCls =
  "mb-1 block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide";

export default function ActiveCustomersPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [state, setState] = useState<
    "loading" | "unauthenticated" | "forbidden" | "ready"
  >("loading");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [gateways, setGateways] = useState<SmsGateway[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | "delete" | null>(
    null,
  );
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const loadData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoadingRows(true);
    setError(null);
    try {
      const [usersRes, gatewaysRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/users`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${API_BASE_URL}/admin/sms/gateways`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);
      const usersData = (await usersRes.json()) as {
        users?: AdminUserRow[];
        message?: string;
      };
      const gatewaysData = (await gatewaysRes.json()) as {
        gateways?: SmsGateway[];
      };
      if (!usersRes.ok) {
        setError(usersData?.message ?? "Failed to load users.");
        return;
      }
      setRows(usersData?.users ?? []);
      setGateways(gatewaysData?.gateways ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    if (state === "ready") void loadData();
  }, [state, loadData]);

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
        reports: t.menuReports,
        settings: t.menuSettings,
        emailSettings: t.menuEmailSettings,
      }),
    [t],
  );

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setSelectedUser(null);
    setModalMode("add");
  }

  function openEdit(user: AdminUserRow) {
    setForm({
      name: user.name,
      email: user.email,
      mobile: user.mobile ?? "",
      password: "",
      role: user.role,
      sms_gateway_id: user.sms_gateway_id ? String(user.sms_gateway_id) : "",
    });
    setFormError(null);
    setSelectedUser(user);
    setModalMode("edit");
  }

  function openDelete(user: AdminUserRow) {
    setSelectedUser(user);
    setFormError(null);
    setModalMode("delete");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function setField<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const token = getStoredToken();
    if (!token) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim() || null,
        role: form.role,
        sms_gateway_id: form.sms_gateway_id
          ? Number(form.sms_gateway_id)
          : null,
      };
      if (form.password) payload.password = form.password;

      const url =
        modalMode === "add"
          ? `${API_BASE_URL}/admin/users`
          : `${API_BASE_URL}/admin/users/${selectedUser!.id}`;
      const method = modalMode === "add" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        message?: string;
        errors?: Record<string, string[]>;
      };
      if (!res.ok) {
        const msgs = data?.errors
          ? Object.values(data.errors).flat().join(" ")
          : (data?.message ?? "Something went wrong.");
        setFormError(msgs);
        return;
      }
      closeModal();
      void loadData();
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    const token = getStoredToken();
    if (!token || !selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/users/${selectedUser.id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setFormError(data?.message ?? "Delete failed.");
        return;
      }
      closeModal();
      void loadData();
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  function gatewayLabel(user: AdminUserRow): string {
    if (user.assigned_gateway) return user.assigned_gateway.name;
    if (user.sms_gateway_id) {
      const gw = gateways.find((g) => g.id === user.sms_gateway_id);
      return gw ? gw.name : `#${user.sms_gateway_id}`;
    }
    return t.noGateway;
  }

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
            {t.title}
          </h1>
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
      sidebarTitle="Admin Panel"
      userName={t.menuCustomers}
      userMeta={t.backToAdmin}
      menu={menu}
      activeKey="customers-active"
      defaultExpandedKey="customers"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {/* Add / Edit Modal */}
      {(modalMode === "add" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
              {modalMode === "add" ? t.addTitle : t.editTitle}
            </h2>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>{t.form.name}</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.email}</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.mobile}</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.mobile}
                  onChange={(e) => setField("mobile", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t.form.password}
                  {modalMode === "edit" && (
                    <span className="ml-1 font-normal normal-case text-[var(--muted)]">
                      {t.form.passwordHint}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className={inputCls}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder={modalMode === "edit" ? "••••••••" : ""}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.role}</label>
                <select
                  className={inputCls}
                  value={form.role}
                  onChange={(e) =>
                    setField("role", e.target.value as "admin" | "user")
                  }
                >
                  <option value="user">{t.form.roleUser}</option>
                  <option value="admin">{t.form.roleAdmin}</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{t.form.gateway}</label>
                <select
                  className={inputCls}
                  value={form.sms_gateway_id}
                  onChange={(e) => setField("sms_gateway_id", e.target.value)}
                >
                  <option value="">{t.form.gatewayNone}</option>
                  {gateways.map((gw) => (
                    <option key={gw.id} value={String(gw.id)}>
                      {gw.name} ({gw.provider})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                {t.form.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={submitting}
                className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? t.form.saving : t.form.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modalMode === "delete" && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <h2 className="mb-3 text-lg font-bold text-[var(--foreground)]">
              {t.deleteTitle}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {t.deleteConfirmPrefix}{" "}
              <span className="font-semibold text-[var(--foreground)]">
                &ldquo;{selectedUser.name}&rdquo;
              </span>
              ?
            </p>

            {formError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                {t.form.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? t.deleting : t.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="catv-panel overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">
            {!loadingRows && !error ? `${rows.length} records` : ""}
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <span>＋</span>
            <span>{t.addCustomer}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">
                  {t.table.id}
                </th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">
                  {t.table.name}
                </th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">
                  {t.table.email}
                </th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">
                  {t.table.mobile}
                </th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">
                  {t.table.role}
                </th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">
                  {t.table.gateway}
                </th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">
                  {t.table.credit}
                </th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">
                  {t.table.date}
                </th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">
                  {t.table.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr>
                  <td
                    colSpan={9}
                    className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]"
                  >
                    {t.loading}
                  </td>
                </tr>
              )}
              {!loadingRows && error && (
                <tr>
                  <td
                    colSpan={9}
                    className="border border-[#e5ebf5] px-4 py-6 text-center text-red-600"
                  >
                    {error}
                  </td>
                </tr>
              )}
              {!loadingRows && !error && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]"
                  >
                    {t.empty}
                  </td>
                </tr>
              )}
              {!loadingRows &&
                !error &&
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]"
                  >
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {row.id}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 font-medium">
                      {row.name}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {row.email}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {row.mobile ?? "-"}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          row.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {row.role}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {row.sms_gateway_id ? (
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                          {gatewayLabel(row)}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">
                          {t.noGateway}
                        </span>
                      )}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right">
                      <span className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                        {(row.sms_balance ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-semibold text-white hover:opacity-80"
                        >
                          {t.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(row)}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:opacity-80"
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
      </div>
    </CatvShell>
  );
}
