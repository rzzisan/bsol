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
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

type Provider = "anthropic" | "gemini" | "groq" | "openai" | "openrouter";

type Settings = {
  is_enabled: boolean;
  provider: Provider;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  max_ai_replies_per_day: number | null;
  daily_reply_count: number;
  system_prompt_extra: string | null;
};

type ProviderRow = {
  provider: Provider;
  has_key: boolean;
  masked_key: string | null;
  default_model: string | null;
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const PROVIDERS: Provider[] = ["anthropic", "gemini", "groq", "openai", "openrouter"];

const PROVIDER_META: Record<Provider, { label: string; free: boolean; keyUrl: string; suggestedModel: string }> = {
  anthropic: { label: "Anthropic (Claude)", free: false, keyUrl: "console.anthropic.com", suggestedModel: "claude-opus-5" },
  gemini: { label: "Google Gemini", free: true, keyUrl: "ai.google.dev", suggestedModel: "gemini-2.5-flash" },
  groq: { label: "Groq", free: true, keyUrl: "console.groq.com", suggestedModel: "openai/gpt-oss-120b" },
  openai: { label: "OpenAI (GPT)", free: false, keyUrl: "platform.openai.com", suggestedModel: "gpt-4o-mini" },
  // OpenRouter's free (":free"-suffixed) models rotate/rate-limit dynamically
  // by demand — this suggestion can go stale; verify at openrouter.ai/models
  // if it starts failing with 404/429.
  openrouter: { label: "OpenRouter", free: true, keyUrl: "openrouter.ai/models", suggestedModel: "minimax/minimax-m3:free" },
};

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
    providersTitle: "AI প্রোভাইডার ও API Key",
    providersIntro: "যতগুলো প্রোভাইডারের key দিতে চাও দাও — নিচে থেকে যেকোনো একটাকে active হিসেবে বেছে নেওয়া যাবে। Gemini, Groq ও OpenRouter-এর ফ্রি টিয়ার আছে। এর মধ্যে Groq সবচেয়ে স্থিতিশীল ফ্রি অপশন — Gemini-তে দ্রুত quota শেষ হতে পারে, আর OpenRouter-এর ফ্রি মডেল demand অনুযায়ী মাঝেমধ্যে সাময়িকভাবে rate-limit হয় (তখন AI নিরাপদে একজন অ্যাডমিনের কাছে পাঠিয়ে দেয়, silently আটকে থাকে না)।",
    free: "ফ্রি টিয়ার",
    apiKeyLabel: "API Key",
    apiKeyPlaceholderSaved: "সংরক্ষিত আছে — বদলাতে নতুন key লিখুন",
    apiKeyPlaceholderEmpty: "API key পেস্ট করুন",
    defaultModelLabel: "ডিফল্ট মডেল (সাজেশন, চাইলে বদলাও)",
    getKeyFrom: "key নাও",
    savedTick: "✓ সংরক্ষিত",
    notSaved: "key নেই",
    saveProvider: "এই প্রোভাইডার সংরক্ষণ করুন",
    activeSectionTitle: "কোন AI এজেন্ট চালু থাকবে",
    enabled: "AI এজেন্ট চালু রাখুন",
    enabledHint: "বন্ধ থাকলে সেলাররা শুধু অ্যাডমিনের উত্তরের অপেক্ষায় থাকবে, AI কিছু পাঠাবে না।",
    activeProvider: "সক্রিয় প্রোভাইডার",
    model: "মডেল (উপরের সাজেশন দেখে বসাও)",
    modelMustMatchProvider: "⚠️ মডেল অবশ্যই নির্বাচিত প্রোভাইডারের হতে হবে, নাহলে AI ব্যর্থ হবে",
    effort: "Effort (গুণমান বনাম খরচ)",
    maxPerDay: "প্রতিদিন সর্বোচ্চ AI রিপ্লাই (ফাঁকা রাখলে সীমাহীন)",
    todayCount: "আজ পাঠানো হয়েছে",
    extraPrompt: "অতিরিক্ত নির্দেশনা (ঐচ্ছিক)",
    extraPromptHint: "ডিপ্লয় ছাড়াই AI-কে অতিরিক্ত নিয়ম/তথ্য দিতে এখানে লিখুন — মূল system prompt-এর সাথে যুক্ত হবে।",
    noKeyWarning: "সক্রিয় প্রোভাইডারে এখনও কোনো key সংরক্ষিত নেই — নিচে থেকে key দাও, নাহলে চালু থাকলেও AI কোনো উত্তর পাঠাতে পারবে না।",
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
    providersTitle: "AI Providers & API Keys",
    providersIntro: "Add keys for as many providers as you like — pick any one below as the active agent. Gemini, Groq, and OpenRouter have free tiers. Groq is the most reliable free option — Gemini's free quota runs out quickly, and OpenRouter's free models get temporarily rate-limited by demand (the AI safely hands off to an admin when that happens, it never gets stuck silently).",
    free: "Free tier",
    apiKeyLabel: "API Key",
    apiKeyPlaceholderSaved: "Saved — type a new key to replace it",
    apiKeyPlaceholderEmpty: "Paste API key",
    defaultModelLabel: "Suggested default model (editable)",
    getKeyFrom: "get a key",
    savedTick: "✓ Saved",
    notSaved: "No key",
    saveProvider: "Save this provider",
    activeSectionTitle: "Which AI agent is active",
    enabled: "Keep the AI agent enabled",
    enabledHint: "When off, sellers just wait for an admin reply — the AI sends nothing.",
    activeProvider: "Active provider",
    model: "Model (see suggestion above)",
    modelMustMatchProvider: "⚠️ The model must belong to the selected provider, or the AI will fail",
    effort: "Effort (quality vs. cost)",
    maxPerDay: "Max AI replies per day (leave blank for unlimited)",
    todayCount: "Sent today",
    extraPrompt: "Extra instructions (optional)",
    extraPromptHint: "Add rules/context for the AI without a deploy — appended to the base system prompt.",
    noKeyWarning: "The active provider has no saved key yet — add one below, otherwise the AI can't reply even when enabled.",
  },
};

export default function AiSupportSettingsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [form, setForm] = useState<Settings>({
    is_enabled: false,
    provider: "anthropic",
    model: "claude-opus-5",
    effort: "medium",
    max_ai_replies_per_day: null,
    daily_reply_count: 0,
    system_prompt_extra: "",
  });
  const [providers, setProviders] = useState<Record<Provider, ProviderRow>>(
    () =>
      Object.fromEntries(
        PROVIDERS.map((p) => [p, { provider: p, has_key: false, masked_key: null, default_model: null }]),
      ) as Record<Provider, ProviderRow>,
  );
  const [keyDrafts, setKeyDrafts] = useState<Record<Provider, string>>(
    () => Object.fromEntries(PROVIDERS.map((p) => [p, ""])) as Record<Provider, string>,
  );
  const [modelDrafts, setModelDrafts] = useState<Record<Provider, string>>(
    () => Object.fromEntries(PROVIDERS.map((p) => [p, ""])) as Record<Provider, string>,
  );
  const [savingProvider, setSavingProvider] = useState<Provider | null>(null);
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
  const authHeaders = useCallback((): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

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
        const [settingsRes, providersRes] = await Promise.all([
          fetch(`${API}/admin/settings/ai-support`, { headers: authHeaders() }),
          fetch(`${API}/admin/ai-providers`, { headers: authHeaders() }),
        ]);
        const settingsData = await settingsRes.json();
        if (settingsRes.ok && settingsData?.data) {
          setForm((prev) => ({ ...prev, ...settingsData.data }));
        }
        const providersData = await providersRes.json();
        if (providersRes.ok && providersData?.data) {
          const rows: ProviderRow[] = providersData.data;
          setProviders(Object.fromEntries(rows.map((r) => [r.provider, r])) as Record<Provider, ProviderRow>);
          setModelDrafts(Object.fromEntries(rows.map((r) => [r.provider, r.default_model ?? ""])) as Record<Provider, string>);
        }
        setMessage(t.loaded);
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const menus = useMemo(() => buildAdminMenu(locale), [t]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((p) => ({ ...p, [k]: v }));

  const allSuggestedModels = useMemo(() => PROVIDERS.map((p) => PROVIDER_META[p].suggestedModel), []);

  // Switching provider without updating the model field silently breaks the
  // agent (e.g. picking Groq while the model still reads "gemini-2.5-flash"
  // — a real production incident this guards against). Only auto-fill when
  // the current value still looks like an untouched suggestion, never
  // overwrite a deliberately customized model name.
  const handleProviderChange = (nextProvider: Provider) => {
    setForm((prev) => {
      const looksUntouched = prev.model.trim() === "" || allSuggestedModels.includes(prev.model.trim());
      const suggestion = providers[nextProvider]?.default_model || PROVIDER_META[nextProvider].suggestedModel;

      return { ...prev, provider: nextProvider, model: looksUntouched ? suggestion : prev.model };
    });
  };

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/settings/ai-support`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          is_enabled: form.is_enabled,
          provider: form.provider,
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

  const saveProvider = async (provider: Provider) => {
    setSavingProvider(provider);
    try {
      const res = await fetch(`${API}/admin/ai-providers/${provider}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          api_key: keyDrafts[provider] || undefined,
          default_model: modelDrafts[provider] || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.data) {
        setProviders((prev) => ({ ...prev, [provider]: data.data }));
        setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
      }
    } finally {
      setSavingProvider(null);
    }
  };

  const activeHasKey = providers[form.provider]?.has_key ?? false;

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
      <div className="space-y-4">
        <section className="catv-panel p-5">
          <h2 className="text-xl font-bold">{t.providersTitle}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.providersIntro}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map((p) => {
              const meta = PROVIDER_META[p];
              const row = providers[p];
              return (
                <div key={p} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{meta.label}</span>
                    <div className="flex items-center gap-1.5">
                      {meta.free && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {t.free}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold ${row?.has_key ? "text-emerald-500" : "text-[var(--muted)]"}`}>
                        {row?.has_key ? t.savedTick : t.notSaved}
                      </span>
                    </div>
                  </div>

                  <label className="mt-2 block">
                    <span className="mb-1 block text-[11px] text-[var(--muted)]">{t.apiKeyLabel}</span>
                    <input
                      type="password"
                      value={keyDrafts[p]}
                      onChange={(e) => setKeyDrafts((prev) => ({ ...prev, [p]: e.target.value }))}
                      placeholder={row?.has_key ? `${row.masked_key} — ${t.apiKeyPlaceholderSaved}` : t.apiKeyPlaceholderEmpty}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-[11px] text-[var(--muted)]">{t.defaultModelLabel}</span>
                    <input
                      type="text"
                      value={modelDrafts[p] || meta.suggestedModel}
                      onChange={(e) => setModelDrafts((prev) => ({ ...prev, [p]: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="mt-2 flex items-center justify-between">
                    <a
                      href={`https://${meta.keyUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[var(--accent)] hover:underline"
                    >
                      {meta.keyUrl} — {t.getKeyFrom}
                    </a>
                    <button
                      type="button"
                      onClick={() => void saveProvider(p)}
                      disabled={savingProvider === p}
                      className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {savingProvider === p ? t.saving : t.saveProvider}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="catv-panel p-5">
          <h2 className="text-xl font-bold">{t.activeSectionTitle}</h2>

          {!activeHasKey && (
            <p className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
              {t.noKeyWarning}
            </p>
          )}

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
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.activeProvider}</span>
              <select
                value={form.provider}
                onChange={(e) => handleProviderChange(e.target.value as Provider)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_META[p].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{t.model}</span>
              <input
                type="text"
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-[11px] text-[var(--muted)]">
                {t.modelMustMatchProvider} — {PROVIDER_META[form.provider].label}: {PROVIDER_META[form.provider].suggestedModel}
              </span>
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
      </div>
    </CatvShell>
  );
}
