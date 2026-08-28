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
  is_enabled: boolean;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  max_ai_replies_per_day: number | null;
  daily_reply_count: number;
  system_prompt_extra: string | null;
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const labels = {
  bn: {
    title: "AI সাপোর্ট এজেন্ট",
    subtitle: "লাইভ চ্যাট ও টিকেটে সেলারদের তাৎক্ষণিক স্বয়ংক্রিয় উত্তর দেওয়ার সেটিংস",
    loginRequired: "অ্যাডমিন হিসেবে লগইন করুন",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজে প্রবেশ করতে পারবেন",
    save: "সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    loaded: "সেটিংস লোড হয়েছে",
    updated: "সেটিংস আপডেট হয়েছে",
    goHome: "হোমে যান",
    enabled: "AI এজেন্ট চালু রাখুন",
    enabledHint: "বন্ধ থাকলে সেলাররা শুধু অ্যাডমিনের উত্তরের অপেক্ষায় থাকবে, AI কিছু পাঠাবে না।",
    model: "মডেল",
    effort: "Effort (গুণমান বনাম খরচ)",
    maxPerDay: "প্রতিদিন সর্বোচ্চ AI রিপ্লাই (ফাঁকা রাখলে সীমাহীন)",
    todayCount: "আজ পাঠানো হয়েছে",
    extraPrompt: "অতিরিক্ত নির্দেশনা (ঐচ্ছিক)",
    extraPromptHint: "ডিপ্লয় ছাড়াই AI-কে অতিরিক্ত নিয়ম/তথ্য দিতে এখানে লিখুন — মূল system prompt-এর সাথে যুক্ত হবে।",
    keyMissingWarning: "backend/.env-এ ANTHROPIC_API_KEY সেট করা না থাকলে চালু করলেও AI কোনো উত্তর পাঠাতে পারবে না।",
  },
  en: {
    title: "AI Support Agent",
    subtitle: "Instant automated first-response settings for live chat and tickets",
    loginRequired: "Please login as admin",
    accessDenied: "Only admins can access this page",
    save: "Save",
    saving: "Saving...",
    loaded: "Settings loaded",
    updated: "Settings updated",
    goHome: "Go Home",
    enabled: "Keep the AI agent enabled",
    enabledHint: "When off, sellers just wait for an admin reply — the AI sends nothing.",
    model: "Model",
    effort: "Effort (quality vs. cost)",
    maxPerDay: "Max AI replies per day (leave blank for unlimited)",
    todayCount: "Sent today",
    extraPrompt: "Extra instructions (optional)",
    extraPromptHint: "Add rules/context for the AI without a deploy — appended to the base system prompt.",
    keyMissingWarning: "If ANTHROPIC_API_KEY isn't set in backend/.env, the AI can't send replies even when enabled.",
  },
};

export default function AiSupportSettingsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [form, setForm] = useState<Settings>({
    is_enabled: false,
    model: "claude-opus-5",
    effort: "medium",
    max_ai_replies_per_day: null,
    daily_reply_count: 0,
    system_prompt_extra: "",
  });
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
        const res = await fetch(`${API}/admin/settings/ai-support`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data?.data) {
          setForm((prev) => ({ ...prev, ...data.data }));
          setMessage(t.loaded);
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token, t.loaded]);

  const menus = useMemo(() => buildAdminMenu(locale), [t]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/settings/ai-support`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          is_enabled: form.is_enabled,
          model: form.model,
          effort: form.effort,
          max_ai_replies_per_day: form.max_ai_replies_per_day,
          system_prompt_extra: form.system_prompt_extra || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message ?? "Update failed");
        return;
      }
      setMessage(t.updated);
      if (data?.data) setForm((prev) => ({ ...prev, ...data.data }));
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
      activeKey="settings-ai-support"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel p-5">
        <h2 className="text-xl font-bold">{t.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>
        <p className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
          {t.keyMissingWarning}
        </p>

        <label className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(e) => update("is_enabled", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium">{t.enabled}</span>
        </label>
        <p className="mt-1 text-xs text-[var(--muted)]">{t.enabledHint}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">{t.model}</span>
            <input
              type="text"
              value={form.model}
              onChange={(e) => update("model", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">{t.effort}</span>
            <select
              value={form.effort}
              onChange={(e) => update("effort", e.target.value as Settings["effort"])}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="xhigh">xhigh</option>
              <option value="max">max</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">{t.maxPerDay}</span>
            <input
              type="number"
              min={1}
              value={form.max_ai_replies_per_day ?? ""}
              onChange={(e) => update("max_ai_replies_per_day", e.target.value === "" ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">{t.todayCount}</span>
            <input
              type="text"
              disabled
              value={form.daily_reply_count}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm opacity-70"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs text-[var(--muted)]">{t.extraPrompt}</span>
            <textarea
              rows={4}
              value={form.system_prompt_extra ?? ""}
              onChange={(e) => update("system_prompt_extra", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">{t.extraPromptHint}</span>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? t.saving : t.save}
          </button>
          {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
        </div>
      </section>
    </CatvShell>
  );
}
