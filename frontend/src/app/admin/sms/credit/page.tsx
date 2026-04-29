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

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

interface CreditSettings {
  id: number;
  rate_per_credit: number;
  chars_per_credit_english: number;
  chars_per_credit_unicode: number;
  currency: string;
}

interface UserCredit {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  role: "admin" | "user";
  sms_balance: number;
}

interface CreditHistory {
  id: number;
  user_id: number;
  user_name: string | null;
  user_mobile: string | null;
  type: "recharge" | "deduct";
  credits: number;
  balance_before: number;
  balance_after: number;
  note: string | null;
  recharged_by_name: string | null;
  created_at: string;
}

interface Pagination {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

const text = {
  bn: {
    title: "এসএমএস ক্রেডিট",
    subtitle: "ক্রেডিট রেট নির্ধারণ করুন এবং গ্রাহকদের ক্রেডিট রিচার্জ করুন।",
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
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    // settings card
    settingsTitle: "ক্রেডিট রেট সেটিং",
    rateLabel: "প্রতি ক্রেডিটের মূল্য (BDT)",
    rateHint: "১ ক্রেডিট = ১ টি SMS (English ১৬০ / বাংলা ৭০ অক্ষর)",
    engCharsLabel: "ইংরেজি SMS সেগমেন্ট সাইজ (অক্ষর)",
    bnCharsLabel: "বাংলা SMS সেগমেন্ট সাইজ (অক্ষর)",
    saveSettings: "রেট আপডেট করুন",
    savingSettings: "আপডেট হচ্ছে...",
    // users table
    usersTitle: "গ্রাহকদের ক্রেডিট ব্যালেন্স",
    colName: "নাম",
    colMobile: "মোবাইল",
    colRole: "রোল",
    colBalance: "ক্রেডিট ব্যালেন্স",
    colActions: "রিচার্জ",
    rechargeBtn: "রিচার্জ",
    noUsers: "কোনো গ্রাহক নেই।",
    loading: "লোড হচ্ছে...",
    // recharge modal
    rechargeTitle: "ক্রেডিট রিচার্জ",
    rechargeFor: "গ্রাহক:",
    creditsLabel: "ক্রেডিট পরিমাণ",
    noteLabel: "নোট (ঐচ্ছিক)",
    doRecharge: "রিচার্জ করুন",
    recharging: "রিচার্জ হচ্ছে...",
    cancel: "বাতিল",
    costPreview: (credits: number, rate: number, currency: string) =>
      `${credits} ক্রেডিট = ${(credits * rate).toFixed(2)} ${currency}`,
    // history
    historyTitle: "ক্রেডিট লেনদেন ইতিহাস",
    colUser: "গ্রাহক",
    colType: "ধরন",
    colCredits: "ক্রেডিট",
    colBefore: "পূর্বের ব্যালেন্স",
    colAfter: "নতুন ব্যালেন্স",
    colNote: "নোট",
    colBy: "সম্পাদক",
    colDate: "তারিখ",
    typeRecharge: "রিচার্জ",
    typeDeduct: "কাটা হয়েছে",
    noHistory: "কোনো লেনদেন নেই।",
    prevPage: "পূর্ববর্তী",
    nextPage: "পরবর্তী",
  },
  en: {
    title: "SMS Credit",
    subtitle: "Set credit rates and recharge customer SMS credits.",
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
    languageLabel: "Language",
    themeLabel: "Theme",
    settingsTitle: "Credit Rate Settings",
    rateLabel: "Rate per Credit (BDT)",
    rateHint: "1 credit = 1 SMS (English 160 / Bangla 70 chars)",
    engCharsLabel: "English SMS Segment Size (chars)",
    bnCharsLabel: "Bangla SMS Segment Size (chars)",
    saveSettings: "Update Rate",
    savingSettings: "Saving...",
    usersTitle: "Customer Credit Balances",
    colName: "Name",
    colMobile: "Mobile",
    colRole: "Role",
    colBalance: "Credit Balance",
    colActions: "Recharge",
    rechargeBtn: "Recharge",
    noUsers: "No users found.",
    loading: "Loading...",
    rechargeTitle: "Recharge Credits",
    rechargeFor: "Customer:",
    creditsLabel: "Credits Amount",
    noteLabel: "Note (optional)",
    doRecharge: "Recharge",
    recharging: "Recharging...",
    cancel: "Cancel",
    costPreview: (credits: number, rate: number, currency: string) =>
      `${credits} credits = ${(credits * rate).toFixed(2)} ${currency}`,
    historyTitle: "Credit Transaction History",
    colUser: "Customer",
    colType: "Type",
    colCredits: "Credits",
    colBefore: "Balance Before",
    colAfter: "Balance After",
    colNote: "Note",
    colBy: "By",
    colDate: "Date",
    typeRecharge: "Recharge",
    typeDeduct: "Deducted",
    noHistory: "No transactions found.",
    prevPage: "Previous",
    nextPage: "Next",
  },
};

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";
const sectionCls =
  "catv-panel mb-5 overflow-hidden";

export default function SmsCreditPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [authState, setAuthState] = useState<
    "loading" | "unauthenticated" | "forbidden" | "ready"
  >("loading");

  // settings
  const [settings, setSettings] = useState<CreditSettings | null>(null);
  const [rateForm, setRateForm] = useState({
    rate_per_credit: "",
    chars_per_credit_english: "",
    chars_per_credit_unicode: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // users
  const [users, setUsers] = useState<UserCredit[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // recharge modal
  const [rechargeUser, setRechargeUser] = useState<UserCredit | null>(null);
  const [rechargeCredits, setRechargeCredits] = useState("");
  const [rechargeNote, setRechargeNote] = useState("");
  const [recharging, setRecharging] = useState(false);
  const [rechargeError, setRechargeError] = useState<string | null>(null);

  // history
  const [history, setHistory] = useState<CreditHistory[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);

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
    if (!token || !storedUser) { setAuthState("unauthenticated"); return; }
    if (normalizeRole(storedUser) !== "admin") { setAuthState("forbidden"); return; }
    setAuthState("ready");
  }, []);

  const loadSettings = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/sms/credit/settings`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { settings?: CreditSettings };
      if (res.ok && data.settings) {
        setSettings(data.settings);
        setRateForm({
          rate_per_credit: String(data.settings.rate_per_credit),
          chars_per_credit_english: String(data.settings.chars_per_credit_english),
          chars_per_credit_unicode: String(data.settings.chars_per_credit_unicode),
        });
      }
    } catch { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/sms/credit/users`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { users?: UserCredit[] };
      if (res.ok) setUsers(data.users ?? []);
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    const token = getStoredToken();
    if (!token) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/sms/credit/history?per_page=20&page=${page}`,
        {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        },
      );
      const data = (await res.json()) as {
        histories?: CreditHistory[];
        pagination?: Pagination;
      };
      if (res.ok) {
        setHistory(data.histories ?? []);
        setPagination(data.pagination ?? null);
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    if (authState === "ready") {
      void loadSettings();
      void loadUsers();
      void loadHistory(1);
    }
  }, [authState, loadSettings, loadUsers, loadHistory]);

  useEffect(() => {
    if (authState === "ready") void loadHistory(historyPage);
  }, [historyPage, authState, loadHistory]);

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

  // ---- save settings ----
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return;
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/sms/credit/settings`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rate_per_credit: parseFloat(rateForm.rate_per_credit),
          chars_per_credit_english: parseInt(rateForm.chars_per_credit_english),
          chars_per_credit_unicode: parseInt(rateForm.chars_per_credit_unicode),
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        settings?: CreditSettings;
        errors?: Record<string, string[]>;
      };
      if (!res.ok) {
        const msg = data.errors
          ? Object.values(data.errors).flat().join(" ")
          : (data.message ?? "Failed to update.");
        setSettingsMsg({ type: "err", text: msg });
        return;
      }
      if (data.settings) setSettings(data.settings);
      setSettingsMsg({ type: "ok", text: data.message ?? "Updated." });
    } catch {
      setSettingsMsg({ type: "err", text: "Network error." });
    } finally {
      setSettingsSaving(false);
    }
  }

  // ---- recharge ----
  function openRecharge(user: UserCredit) {
    setRechargeUser(user);
    setRechargeCredits("");
    setRechargeNote("");
    setRechargeError(null);
  }

  function closeRecharge() {
    setRechargeUser(null);
    setRechargeCredits("");
    setRechargeNote("");
    setRechargeError(null);
  }

  async function handleRecharge() {
    const token = getStoredToken();
    if (!token || !rechargeUser) return;
    const credits = parseInt(rechargeCredits);
    if (!credits || credits < 1) {
      setRechargeError(locale === "bn" ? "বৈধ ক্রেডিট পরিমাণ দিন।" : "Enter a valid credit amount.");
      return;
    }
    setRecharging(true);
    setRechargeError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/sms/credit/recharge`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: rechargeUser.id,
          credits,
          note: rechargeNote.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        new_balance?: number;
        errors?: Record<string, string[]>;
      };
      if (!res.ok) {
        const msg = data.errors
          ? Object.values(data.errors).flat().join(" ")
          : (data.message ?? "Recharge failed.");
        setRechargeError(msg);
        return;
      }
      closeRecharge();
      void loadUsers();
      void loadHistory(1);
      setHistoryPage(1);
    } catch {
      setRechargeError("Network error.");
    } finally {
      setRecharging(false);
    }
  }

  if (authState !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
            {t.title}
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            {authState === "forbidden" ? t.accessDenied : t.loginRequired}
          </p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
            {t.goHome}
          </a>
        </section>
      </main>
    );
  }

  const rate = settings ? parseFloat(String(settings.rate_per_credit)) : 0.35;
  const currency = settings?.currency ?? "BDT";
  const rechargeCreditsNum = parseInt(rechargeCredits) || 0;

  return (
    <CatvShell
      title={t.title}
      subtitle={t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle="Admin Panel"
      userName="SMS Credit"
      userMeta={t.backToAdmin}
      menu={menu}
      activeKey="sms-credit"
      defaultExpandedKey="sms"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {/* Recharge Modal */}
      {rechargeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-[var(--foreground)]">{t.rechargeTitle}</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">
              {t.rechargeFor}{" "}
              <span className="font-semibold text-[var(--foreground)]">{rechargeUser.name}</span>
              {" "}
              <span className="text-xs text-[var(--muted)]">
                ({locale === "bn" ? "বর্তমান ব্যালেন্স" : "Current balance"}:{" "}
                <strong>{rechargeUser.sms_balance}</strong>)
              </span>
            </p>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>{t.creditsLabel}</label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={rechargeCredits}
                  onChange={(e) => setRechargeCredits(e.target.value)}
                  placeholder="e.g. 100"
                />
                {rechargeCreditsNum > 0 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {t.costPreview(rechargeCreditsNum, rate, currency)}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>{t.noteLabel}</label>
                <input
                  type="text"
                  className={inputCls}
                  value={rechargeNote}
                  onChange={(e) => setRechargeNote(e.target.value)}
                  placeholder={locale === "bn" ? "ঐচ্ছিক নোট..." : "Optional note..."}
                />
              </div>
            </div>

            {rechargeError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{rechargeError}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRecharge}
                disabled={recharging}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleRecharge()}
                disabled={recharging}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {recharging ? t.recharging : t.doRecharge}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Card */}
      <div className={sectionCls}>
        <h2 className="mb-4 text-base font-bold text-[var(--foreground)]">{t.settingsTitle}</h2>
        <form onSubmit={(e) => void handleSaveSettings(e)} className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>{t.rateLabel}</label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              className={inputCls}
              value={rateForm.rate_per_credit}
              onChange={(e) =>
                setRateForm((p) => ({ ...p, rate_per_credit: e.target.value }))
              }
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.rateHint}</p>
          </div>
          <div>
            <label className={labelCls}>{t.engCharsLabel}</label>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={rateForm.chars_per_credit_english}
              onChange={(e) =>
                setRateForm((p) => ({ ...p, chars_per_credit_english: e.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelCls}>{t.bnCharsLabel}</label>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={rateForm.chars_per_credit_unicode}
              onChange={(e) =>
                setRateForm((p) => ({ ...p, chars_per_credit_unicode: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-3 flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={settingsSaving}
              className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {settingsSaving ? t.savingSettings : t.saveSettings}
            </button>
            {settingsMsg && (
              <span
                className={`text-sm font-medium ${
                  settingsMsg.type === "ok" ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {settingsMsg.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Users Credit Balance Table */}
      <div className={sectionCls}>
        <h2 className="mb-4 text-base font-bold text-[var(--foreground)]">{t.usersTitle}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colName}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colMobile}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colRole}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colBalance}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-center font-semibold">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading && (
                <tr>
                  <td colSpan={5} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.loading}
                  </td>
                </tr>
              )}
              {!usersLoading && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.noUsers}
                  </td>
                </tr>
              )}
              {!usersLoading &&
                users.map((u) => (
                  <tr key={u.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                    <td className="border border-[#e5ebf5] px-3 py-2 font-medium">
                      <span>{u.name}</span>
                      <span className="ml-2 text-xs text-[var(--muted)]">{u.email}</span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">{u.mobile ?? "-"}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right">
                      <span
                        className={`rounded px-2 py-1 text-xs font-bold ${
                          u.sms_balance > 0
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.sms_balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => openRecharge(u)}
                        className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-80"
                      >
                        {t.rechargeBtn}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit History */}
      <div className={sectionCls}>
        <h2 className="mb-4 text-base font-bold text-[var(--foreground)]">{t.historyTitle}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colUser}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colType}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colCredits}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colBefore}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-right font-semibold">{t.colAfter}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colNote}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colBy}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.colDate}</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading && (
                <tr>
                  <td colSpan={8} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.loading}
                  </td>
                </tr>
              )}
              {!historyLoading && history.length === 0 && (
                <tr>
                  <td colSpan={8} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.noHistory}
                  </td>
                </tr>
              )}
              {!historyLoading &&
                history.map((h) => (
                  <tr key={h.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span className="font-medium">{h.user_name ?? "-"}</span>
                      {h.user_mobile && (
                        <span className="ml-1 text-xs text-[var(--muted)]">{h.user_mobile}</span>
                      )}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          h.type === "recharge"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {h.type === "recharge" ? t.typeRecharge : t.typeDeduct}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right font-semibold">
                      <span className={h.type === "recharge" ? "text-emerald-600" : "text-red-500"}>
                        {h.type === "recharge" ? "+" : "-"}{h.credits.toLocaleString()}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right text-[var(--muted)]">
                      {h.balance_before.toLocaleString()}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-right font-medium">
                      {h.balance_after.toLocaleString()}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-xs text-[var(--muted)]">
                      {h.note ?? "-"}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-xs">
                      {h.recharged_by_name ?? "-"}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2 text-xs text-[var(--muted)]">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.last_page > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">
              {pagination.current_page} / {pagination.last_page}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.current_page <= 1 || historyLoading}
                onClick={() => setHistoryPage((p) => p - 1)}
                className="rounded border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40"
              >
                {t.prevPage}
              </button>
              <button
                type="button"
                disabled={pagination.current_page >= pagination.last_page || historyLoading}
                onClick={() => setHistoryPage((p) => p + 1)}
                className="rounded border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40"
              >
                {t.nextPage}
              </button>
            </div>
          </div>
        )}
      </div>
    </CatvShell>
  );
}
