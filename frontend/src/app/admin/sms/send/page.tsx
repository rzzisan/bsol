"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import CatvShell, { type ShellMenuItem } from "@/components/catv-shell";
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

interface SmsGatewayOption {
  id: number;
  name: string;
  provider: string;
  is_active: boolean;
  is_enabled: boolean;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const text = {
  bn: {
    title: "এসএমএস সেন্ড",
    subtitle: "সিলেক্টেড গেটওয়ে ব্যবহার করে টেস্ট বা রিয়েল SMS পাঠান।",
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
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    loadingGateways: "গেটওয়ে লোড হচ্ছে...",
    noGateways: "কোনো গেটওয়ে নেই। আগে SMS Gateway পেজে credential যোগ করুন।",
    form: {
      gateway: "গেটওয়ে",
      phone: "ফোন নম্বরসমূহ",
      message: "মেসেজ",
      liveCounter: "লাইভ কাউন্টার",
      chars: "ক্যারেক্টার",
      smsCount: "SMS কাউন্ট",
      mode: "মোড",
      unicode: "বাংলা/Unicode",
      gsm: "English/GSM",
      send: "SMS পাঠান",
      sending: "পাঠানো হচ্ছে...",
      phoneHint: "একাধিক নম্বর দিতে comma, semicolon, pipe, বা নতুন লাইন ব্যবহার করুন।",
      messageHint: "Unicode/GSM অনুযায়ী segment count backend-এ গণনা করা হবে।",
    },
    response: "Gateway Response",
  },
  en: {
    title: "Send SMS",
    subtitle: "Send test or real SMS using a selected gateway.",
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
    languageLabel: "Language",
    themeLabel: "Theme",
    loadingGateways: "Loading gateways...",
    noGateways: "No gateways available. Add credentials from SMS Gateway page first.",
    form: {
      gateway: "Gateway",
      phone: "Phone Number(s)",
      message: "Message",
      liveCounter: "Live Counter",
      chars: "Characters",
      smsCount: "SMS Count",
      mode: "Mode",
      unicode: "Bangla/Unicode",
      gsm: "English/GSM",
      send: "Send SMS",
      sending: "Sending...",
      phoneHint: "Use comma, semicolon, pipe, or new line to send to multiple numbers.",
      messageHint: "Backend will process Unicode/GSM segment behavior.",
    },
    response: "Gateway Response",
  },
};

export default function AdminSmsSendPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [gateways, setGateways] = useState<SmsGatewayOption[]>([]);
  const [loadingGateways, setLoadingGateways] = useState(true);
  const [gatewayId, setGatewayId] = useState<string>("");
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);

  const charCount = useMemo(() => Array.from(messageBody).length, [messageBody]);
  const isUnicode = useMemo(() => /[^\u0000-\u007f]/.test(messageBody), [messageBody]);
  const segmentLimit = isUnicode ? 70 : 160;
  const smsCount = Math.max(1, Math.ceil(Math.max(charCount, 1) / segmentLimit));

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

  useEffect(() => {
    if (state !== "ready") return;

    async function loadGateways() {
      const token = getStoredToken();
      if (!token) return;

      setLoadingGateways(true);
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
          setError(data?.message ?? "Failed to load gateways.");
          return;
        }

        const list = ((data?.gateways ?? []) as SmsGatewayOption[]).filter((gateway) => gateway.is_enabled);
        setGateways(list);

        if (list.length > 0) {
          const active = list.find((gateway) => gateway.is_active) ?? list[0];
          setGatewayId(String(active.id));
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoadingGateways(false);
      }
    }

    void loadGateways();
  }, [state]);

  const menu = useMemo<ShellMenuItem[]>(
    () => [
      { key: "dashboard", label: t.menuDashboard, href: "/admin", icon: "🏠" },
      {
        key: "customers",
        label: t.menuCustomers,
        icon: "👥",
        children: [
          { key: "customers-active", label: t.menuActive, href: "/admin/customers/active" },
          { key: "customers-pending", label: t.menuPending },
        ],
      },
      {
        key: "sms",
        label: t.menuSms,
        icon: "✉️",
        children: [
          { key: "sms-gateway", label: t.menuSmsGateway, href: "/admin/sms/gateways" },
          { key: "sms-send", label: t.menuSmsSend, href: "/admin/sms/send" },
          { key: "sms-history", label: t.menuSmsHistory, href: "/admin/sms/history" },
          { key: "sms-credit", label: t.menuSmsCredit, href: "/admin/sms/credit" },
        ],
      },
      { key: "packages", label: t.menuPackages, icon: "📦" },
    ],
    [t],
  );

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getStoredToken();
    if (!token) return;

    setSending(true);
    setError(null);
    setSuccess(null);
    setResponseBody(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/sms/send`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gateway_id: gatewayId ? Number(gatewayId) : null,
          phone_number: phoneNumbers,
          message: messageBody,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Failed to send SMS.");
        setResponseBody(JSON.stringify(data, null, 2));
        return;
      }

      setSuccess(data?.message ?? "SMS sent successfully.");
      setResponseBody(JSON.stringify(data, null, 2));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
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
      userMeta={t.menuSmsSend}
      menu={menu}
      activeKey="sms-send"
      defaultExpandedKey="sms"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel max-w-3xl p-4 sm:p-5">
        <form className="space-y-4" onSubmit={handleSend}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.gateway}</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              value={gatewayId}
              onChange={(e) => setGatewayId(e.target.value)}
              disabled={loadingGateways || gateways.length === 0}
            >
              {loadingGateways ? <option value="">{t.loadingGateways}</option> : null}
              {!loadingGateways && gateways.length === 0 ? <option value="">{t.noGateways}</option> : null}
              {!loadingGateways &&
                gateways.map((gateway) => (
                  <option key={gateway.id} value={gateway.id}>
                    {gateway.name} ({gateway.provider}){gateway.is_active ? " • Active" : ""}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.phone}</label>
            <textarea
              value={phoneNumbers}
              onChange={(e) => setPhoneNumbers(e.target.value)}
              required
              rows={3}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              placeholder={locale === "bn" ? "017XXXXXXXX, 018XXXXXXXX" : "017XXXXXXXX, 018XXXXXXXX"}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.form.phoneHint}</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.message}</label>
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              required
              rows={5}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.form.messageHint}</p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{t.form.liveCounter}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
                <span className="text-[var(--muted)]">{t.form.chars}: </span>
                <strong>{charCount}</strong>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
                <span className="text-[var(--muted)]">{t.form.smsCount}: </span>
                <strong>{smsCount}</strong>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
                <span className="text-[var(--muted)]">{t.form.mode}: </span>
                <strong>{isUnicode ? t.form.unicode : t.form.gsm}</strong>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || loadingGateways || gateways.length === 0}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {sending ? t.form.sending : t.form.send}
          </button>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          {success ? <p className="text-sm font-medium text-emerald-600">{success}</p> : null}

          {responseBody ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t.response}</h3>
              <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs">
                {responseBody}
              </pre>
            </div>
          ) : null}
        </form>
      </section>
    </CatvShell>
  );
}
