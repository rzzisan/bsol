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

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const text = {
  bn: {
    title: "নিরাপত্তা (2FA)",
    subtitle: "অ্যাডমিন একাউন্টের জন্য দুই-ধাপ ভেরিফিকেশন — security_hardening_context.md §২।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    loading: "লোড হচ্ছে...",
    statusEnabled: "দুই-ধাপ ভেরিফিকেশন সক্রিয় আছে।",
    statusDisabled: "দুই-ধাপ ভেরিফিকেশন এখনো সক্রিয় করা হয়নি।",
    enableBtn: "সক্রিয় করুন",
    disableBtn: "নিষ্ক্রিয় করুন",
    startSetup: "সেটআপ শুরু করুন",
    setupInstructions:
      "Google Authenticator, Authy, বা যেকোনো TOTP অ্যাপে নিচের কোডটি ম্যানুয়ালি যোগ করুন (\"Enter setup key\"), তারপর অ্যাপে দেখানো ৬-সংখ্যার কোড এখানে লিখে নিশ্চিত করুন।",
    secretLabel: "সিক্রেট কী",
    codeLabel: "৬-সংখ্যার কোড",
    confirmBtn: "নিশ্চিত করুন",
    confirming: "নিশ্চিত হচ্ছে...",
    cancelSetup: "বাতিল",
    recoveryTitle: "রিকভারি কোড সংরক্ষণ করুন",
    recoveryNote:
      "এই ৮টা কোড শুধু একবারই দেখানো হবে। প্রতিটা কোড একবার ব্যবহার করা যাবে — অথেন্টিকেটর ডিভাইস হারিয়ে গেলে এগুলো দিয়ে লগইন করা যাবে। নিরাপদ জায়গায় সংরক্ষণ করুন।",
    recoverySaved: "আমি কোডগুলো সংরক্ষণ করেছি",
    passwordLabel: "পাসওয়ার্ড",
    passwordConfirmNote: "নিরাপত্তার জন্য পাসওয়ার্ড দিয়ে নিশ্চিত করুন।",
    regenerateBtn: "নতুন রিকভারি কোড তৈরি করুন",
    error: "একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
  },
  en: {
    title: "Security (2FA)",
    subtitle: "Two-factor verification for admin accounts — security_hardening_context.md §2.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    languageLabel: "Language",
    themeLabel: "Theme",
    loading: "Loading...",
    statusEnabled: "Two-factor authentication is enabled.",
    statusDisabled: "Two-factor authentication is not yet enabled.",
    enableBtn: "Enable",
    disableBtn: "Disable",
    startSetup: "Start setup",
    setupInstructions:
      "Add the code below manually in Google Authenticator, Authy, or any TOTP app (\"Enter setup key\"), then confirm with the 6-digit code it shows.",
    secretLabel: "Secret key",
    codeLabel: "6-digit code",
    confirmBtn: "Confirm",
    confirming: "Confirming...",
    cancelSetup: "Cancel",
    recoveryTitle: "Save your recovery codes",
    recoveryNote:
      "These 8 codes are shown only once. Each works one time — use them to sign in if you lose your authenticator device. Store them somewhere safe.",
    recoverySaved: "I've saved these codes",
    passwordLabel: "Password",
    passwordConfirmNote: "Confirm with your password for security.",
    regenerateBtn: "Generate new recovery codes",
    error: "Something went wrong. Please try again.",
  },
};

type Status = { enabled: boolean; pending_setup: boolean };
type SetupData = { secret: string; otpauth_url: string };

export default function AdminSecurityPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [authState, setAuthState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [status, setStatus] = useState<Status | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const authHeaders = useCallback(() => {
    const token = getStoredToken();
    return { Accept: "application/json", Authorization: `Bearer ${token}` };
  }, []);

  const loadStatus = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/admin/2fa/status`, { headers: authHeaders() });
    if (res.ok) setStatus(await res.json());
  }, [authHeaders]);

  useEffect(() => {
    if (authState === "ready") void loadStatus();
  }, [authState, loadStatus]);

  const t = useMemo(() => text[locale], [locale]);
  const menu = useMemo(() => buildAdminMenu(locale), [locale]);

  async function startSetup() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/2fa/setup`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { setError(data?.message ?? t.error); return; }
      setSetupData(data);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/2fa/enable`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.errors?.code?.[0] ?? data?.message ?? t.error); return; }
      setRecoveryCodes(data.recovery_codes);
      setSetupData(null);
      setCode("");
      void loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/2fa/disable`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.errors?.password?.[0] ?? data?.message ?? t.error); return; }
      setPassword("");
      void loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function regenerateRecoveryCodes(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/2fa/recovery-codes/regenerate`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.errors?.password?.[0] ?? data?.message ?? t.error); return; }
      setRecoveryCodes(data.recovery_codes);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  if (authState !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
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

  return (
    <CatvShell
      title={t.title}
      subtitle={t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle="Admin Panel"
      userName="Security"
      userMeta={t.title}
      menu={menu}
      activeKey="settings-security"
      defaultExpandedKey="settings"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="catv-panel mb-5 p-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {recoveryCodes && (
          <div className="mb-5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.recoveryTitle}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{t.recoveryNote}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {recoveryCodes.map((rc) => (
                <code key={rc} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-center text-sm">
                  {rc}
                </code>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRecoveryCodes(null)}
              className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              {t.recoverySaved}
            </button>
          </div>
        )}

        {!status && <p className="text-sm text-[var(--muted)]">{t.loading}</p>}

        {status && !status.enabled && !setupData && !recoveryCodes && (
          <div>
            <p className="text-sm text-[var(--muted)]">{t.statusDisabled}</p>
            <button
              type="button"
              disabled={busy}
              onClick={startSetup}
              className="mt-3 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t.startSetup}
            </button>
          </div>
        )}

        {setupData && (
          <form onSubmit={confirmEnable} className="flex flex-col gap-3">
            <p className="text-sm text-[var(--muted)]">{t.setupInstructions}</p>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t.secretLabel}
              </label>
              <code className="block break-all rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm">
                {setupData.secret}
              </code>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t.codeLabel}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="000000"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !code}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? t.confirming : t.confirmBtn}
              </button>
              <button
                type="button"
                onClick={() => { setSetupData(null); setCode(""); }}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              >
                {t.cancelSetup}
              </button>
            </div>
          </form>
        )}

        {status?.enabled && !recoveryCodes && (
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">{t.statusEnabled}</p>

            <form onSubmit={regenerateRecoveryCodes} className="mt-4 flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {t.passwordLabel}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !password}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {t.regenerateBtn}
              </button>
              <button
                type="button"
                disabled={busy || !password}
                onClick={() => void disable()}
                className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500 disabled:opacity-60"
              >
                {t.disableBtn}
              </button>
            </form>
            <p className="mt-1 text-xs text-[var(--muted)]">{t.passwordConfirmNote}</p>
          </div>
        )}
      </div>
    </CatvShell>
  );
}
