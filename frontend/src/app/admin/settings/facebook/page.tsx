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

type Settings = {
  app_id: string;
  login_config_id: string;
  app_secret_set: boolean;
  webhook_verify_token_set: boolean;
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const labels = {
  bn: {
    title: "ফেসবুক অ্যাপ সেটিংস",
    subtitle: "একটাই Meta App — সব seller এই একটা App-এর মাধ্যমে নিজের Page কানেক্ট করবে (Settings → Facebook Page থেকে)।",
    loginRequired: "অ্যাডমিন হিসেবে লগইন করুন",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজে প্রবেশ করতে পারবেন",
    save: "সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    loaded: "সেটিংস লোড হয়েছে",
    updated: "সেটিংস আপডেট হয়েছে",
    goHome: "হোমে যান",
    appId: "App ID",
    loginConfigId: "Login Configuration ID",
    appSecret: "App Secret",
    webhookToken: "Webhook Verify Token",
    setPlaceholder: "সেট করা আছে — বদলাতে নতুন মান লিখুন",
    notSetPlaceholder: "সেট করা নেই",
    webhookUrlLabel: "Webhook Callback URL (Meta App-এ এটা বসান)",
    setupTitle: "সেটআপ ধাপ",
    setupSteps: [
      "developers.facebook.com-এ একটা Business App তৈরি করুন",
      "\"Facebook Login for Business\" এবং \"Webhooks\" product যোগ করুন",
      "Facebook Login for Business → Configurations → Create configuration ('User access token' বেছে নিন) — এই App classic scope-ভিত্তিক OAuth accept করে না, config_id ছাড়া \"Feature Unavailable\" error দেখায়",
      "Webhooks-এ \"page\" object subscribe করুন, fields: feed, messages",
      "উপরের Webhook Callback URL এবং একটা নিজের বানানো Verify Token বসান",
      "নিচের ফর্মে App ID, Login Configuration ID, App Secret, একই Verify Token বসিয়ে সংরক্ষণ করুন",
      "pages_messaging + pages_manage_engagement permission-এর জন্য App Review জমা দিন",
    ],
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
      facebookSettings: "ফেসবুক অ্যাপ",
    },
  },
  en: {
    title: "Facebook App Settings",
    subtitle: "One shared Meta App — every seller connects their own Page through it (from Settings → Facebook Page).",
    loginRequired: "Please login as admin",
    accessDenied: "Only admins can access this page",
    save: "Save",
    saving: "Saving...",
    loaded: "Settings loaded",
    updated: "Settings updated",
    goHome: "Go Home",
    appId: "App ID",
    loginConfigId: "Login Configuration ID",
    appSecret: "App Secret",
    webhookToken: "Webhook Verify Token",
    setPlaceholder: "Currently set — type a new value to change",
    notSetPlaceholder: "Not set",
    webhookUrlLabel: "Webhook Callback URL (put this in the Meta App)",
    setupTitle: "Setup steps",
    setupSteps: [
      "Create a Business App at developers.facebook.com",
      "Add the \"Facebook Login for Business\" and \"Webhooks\" products",
      "Facebook Login for Business → Configurations → Create configuration (choose \"User access token\") — this app rejects the classic scope-based OAuth dialog with a \"Feature Unavailable\" error without a config_id",
      "In Webhooks, subscribe to the \"page\" object, fields: feed, messages",
      "Enter the Webhook Callback URL above and a Verify Token you make up",
      "Enter App ID, Login Configuration ID, App Secret, and the same Verify Token below and save",
      "Submit App Review for the pages_messaging + pages_manage_engagement permissions",
    ],
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
      facebookSettings: "Facebook App",
    },
  },
};

export default function AdminFacebookSettingsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [current, setCurrent] = useState<Settings | null>(null);
  const [appId, setAppId] = useState("");
  const [loginConfigId, setLoginConfigId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
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
        const res = await fetch(`${API}/admin/settings/facebook`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data?.data) {
          setCurrent(data.data);
          setAppId(data.data.app_id ?? "");
          setLoginConfigId(data.data.login_config_id ?? "");
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
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/facebook/webhook` : "";

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/settings/facebook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          app_id: appId,
          login_config_id: loginConfigId,
          app_secret: appSecret,
          webhook_verify_token: webhookToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message ?? "Update failed");
        return;
      }
      setCurrent(data.data);
      setAppSecret("");
      setWebhookToken("");
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
      activeKey="settings-facebook"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="space-y-5">
        <section className="catv-panel p-5">
          <h2 className="text-xl font-bold">{t.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>

          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="mb-1 text-xs text-[var(--muted)]">{t.webhookUrlLabel}</p>
            <code className="break-all text-sm text-[var(--foreground)]">{webhookUrl}</code>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.appId}</span>
              <input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.loginConfigId}</span>
              <input
                value={loginConfigId}
                onChange={(e) => setLoginConfigId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.appSecret}</span>
              <input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={current?.app_secret_set ? t.setPlaceholder : t.notSetPlaceholder}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.webhookToken}</span>
              <input
                type="password"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder={current?.webhook_verify_token_set ? t.setPlaceholder : t.notSetPlaceholder}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="catv-panel p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.setupTitle}</h3>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[var(--foreground)]">
            {t.setupSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? t.saving : t.save}
          </button>
          {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
        </div>
      </div>
    </CatvShell>
  );
}
