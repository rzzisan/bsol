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
  type AuthUser,
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

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const text = {
  bn: {
    title: "ইউজার ড্যাশবোর্ড",
    subtitle: "অ্যাসাইন করা গেটওয়ে ও নিজের SMS credit ব্যবহার করে SMS পাঠান।",
    loginRequired: "ড্যাশবোর্ড দেখতে হলে আগে লগইন করুন।",
    accessDenied: "এই পেজটি সাধারণ ইউজারদের জন্য।",
    goHome: "হোমে যান",
    quickActions: "Quick Actions",
    menuDashboard: "ড্যাশবোর্ড",
    menuOrders: "My Orders",
    menuCourier: "Courier Tracking",
    menuBilling: "Billing & Subscription",
    menuProfile: "Profile Settings",
    menuSms: "এসএমএস",
    menuSmsSend: "SMS পাঠান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    loadingGateways: "গেটওয়ে লোড হচ্ছে...",
    noGateways: "আপনার জন্য কোনো SMS গেটওয়ে অ্যাসাইন করা নেই।",
    form: {
      gateway: "অ্যাসাইন করা গেটওয়ে",
      phone: "ফোন নম্বর",
      message: "মেসেজ",
      send: "SMS পাঠান",
      sending: "পাঠানো হচ্ছে...",
      phoneHint: "বাংলাদেশি নম্বর দিন (যেমন: 017..., +88017..., 88017...)",
      messageHint: "English 160 / Bangla 70 char = 1 credit segment",
    },
    previewTitle: "Credit Preview",
    previewRequired: "প্রয়োজন",
    previewAvailable: "আপনার ব্যালেন্স",
    previewCanSend: "পাঠানো যাবে",
    previewCannotSend: "ক্রেডিট কম আছে",
    response: "API Response",
  },
  en: {
    title: "User Dashboard",
    subtitle: "Send SMS with assigned gateway and your own SMS credits.",
    loginRequired: "Please login first to access the dashboard.",
    accessDenied: "This page is available for regular users only.",
    goHome: "Go Home",
    quickActions: "Quick Actions",
    menuDashboard: "Dashboard",
    menuOrders: "My Orders",
    menuCourier: "Courier Tracking",
    menuBilling: "Billing & Subscription",
    menuProfile: "Profile Settings",
    menuSms: "SMS",
    menuSmsSend: "Send SMS",
    languageLabel: "Language",
    themeLabel: "Theme",
    loadingGateways: "Loading gateway...",
    noGateways: "No SMS gateway assigned to your account.",
    form: {
      gateway: "Assigned Gateway",
      phone: "Phone Number",
      message: "Message",
      send: "Send SMS",
      sending: "Sending...",
      phoneHint: "Use a valid Bangladesh number (017..., +88017..., 88017...)",
      messageHint: "English 160 / Bangla 70 chars = 1 credit segment",
    },
    previewTitle: "Credit Preview",
    previewRequired: "Required",
    previewAvailable: "Your Balance",
    previewCanSend: "Can send",
    previewCannotSend: "Insufficient credit",
    response: "API Response",
  },
};

export default function UserSmsSendPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [gateways, setGateways] = useState<SmsGatewayOption[]>([]);
  const [loadingGateways, setLoadingGateways] = useState(true);
  const [phone, setPhone] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  const [requiredCredits, setRequiredCredits] = useState(1);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [canSend, setCanSend] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);

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

    if (normalizeRole(storedUser) !== "user") {
      setState("forbidden");
      return;
    }

    setUser(storedUser);
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
        const res = await fetch(`${API_BASE_URL}/sms/gateways`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.message ?? "Failed to load gateway.");
          return;
        }

        setGateways((data?.gateways ?? []) as SmsGatewayOption[]);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoadingGateways(false);
      }
    }

    void loadGateways();
  }, [state]);

  useEffect(() => {
    if (state !== "ready") return;

    const token = getStoredToken();
    if (!token) return;

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sms/preview`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: messageBody || "a",
          }),
        });

        const data = await res.json();
        if (!res.ok) return;

        setRequiredCredits(data?.credits_required ?? 1);
        setAvailableCredits(data?.available_credits ?? 0);
        setCanSend(Boolean(data?.can_send));
      } catch {
        // ignore preview errors
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [messageBody, state]);

  const menu = useMemo<ShellMenuItem[]>(
    () => [
      { key: "dashboard", label: t.menuDashboard, href: "/dashboard", icon: "🏠" },
      { key: "orders", label: t.menuOrders, icon: "📦" },
      { key: "courier", label: t.menuCourier, icon: "🚚" },
      { key: "billing", label: t.menuBilling, icon: "💳" },
      {
        key: "sms",
        label: t.menuSms,
        icon: "✉️",
        children: [{ key: "sms-send", label: t.menuSmsSend, href: "/dashboard/sms/send" }],
      },
      { key: "profile", label: t.menuProfile, icon: "⚙️" },
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
      const res = await fetch(`${API_BASE_URL}/sms/send`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone_number: phone,
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

      setAvailableCredits((prev) => Math.max(0, prev - (data?.credits_used ?? 0)));
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
      sidebarTitle={t.title}
      userName={user?.name}
      userMeta={user?.email}
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
              value={gateways[0]?.id ?? ""}
              disabled
            >
              {loadingGateways ? <option value="">{t.loadingGateways}</option> : null}
              {!loadingGateways && gateways.length === 0 ? <option value="">{t.noGateways}</option> : null}
              {!loadingGateways && gateways.length > 0 ? (
                <option value={gateways[0].id}>
                  {gateways[0].name} ({gateways[0].provider})
                </option>
              ) : null}
            </select>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs font-semibold text-[var(--muted)]">{t.previewTitle}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm">
                <span className="text-[var(--muted)]">{t.previewRequired}: </span>
                <strong>{requiredCredits}</strong>
              </div>
              <div className="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm">
                <span className="text-[var(--muted)]">{t.previewAvailable}: </span>
                <strong>{availableCredits}</strong>
              </div>
              <div className="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm">
                <span className="text-[var(--muted)]">Status: </span>
                <strong className={canSend ? "text-emerald-600" : "text-red-600"}>
                  {canSend ? t.previewCanSend : t.previewCannotSend}
                </strong>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.form.phone}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              placeholder="017XXXXXXXX"
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
          </div>

          <button
            type="submit"
            disabled={sending || loadingGateways || gateways.length === 0 || !canSend}
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
