"use client";

import { useEffect, useMemo, useState } from "react";
import CatvShell from "@/components/catv-shell";
import { buildAdminMenu } from "@/lib/admin-menu";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  normalizeRole,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";
import { GATEWAY_PROVIDER_META } from "@/lib/gateway-providers";
import { CreditCard, Eye, EyeOff, Lock, Radio, ShieldCheck } from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    title: "প্ল্যাটফর্ম পেমেন্ট গেটওয়ে",
    intro:
      "সেলার যেসব মার্চেন্ট গেটওয়ে তাদের কাস্টমারদের থেকে পেমেন্ট নিতে ব্যবহার করতে পারে, ঠিক সেই একই গেটওয়েগুলো এখানে চালু করলে সেলাররা প্ল্যাটফর্মকে (সাবস্ক্রিপশন, এসএমএস ক্রেডিট, অর্ডার ক্রেডিট, স্টোরফ্রন্ট অ্যাড-অন) পে করার সময় বেছে নিতে পারবে। একাধিক গেটওয়ে একসাথে চালু রাখা যায়।",
    loading: "লোড হচ্ছে...",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    saveSuccess: "সেটিংস সফলভাবে সেভ হয়েছে!",
    saveError: "সেভ ব্যর্থ হয়েছে।",
    enable: "চালু করুন",
    enabled: "চালু আছে",
    disabled: "বন্ধ আছে",
    liveMode: "লাইভ মোড (Production)",
    sandboxMode: "Sandbox (টেস্ট মোড)",
    activeChannelsCount: "টি গেটওয়ে সক্রিয়",
    securityNotice: "সকল সিক্রেট কি ও পাসওয়ার্ড ডাটাবেজে এনক্রিপ্ট করে সুরক্ষিত রাখা হয়।",
    usedFor: "ব্যবহৃত হবে: সাবস্ক্রিপশন, এসএমএস ক্রেডিট, অর্ডার ক্রেডিট, স্টোরফ্রন্ট অ্যাড-অন — এই ৪টি সেলফ-সার্ভিস পেমেন্টে।",
  },
  en: {
    title: "Platform Payment Gateways",
    intro:
      "The same merchant gateways sellers can offer their own customers are available here for collecting seller→platform payments (subscription renewal, SMS credit, order-credit add-on, storefront add-on). More than one can be enabled at once — sellers pick which to pay with.",
    loading: "Loading...",
    save: "Save",
    saving: "Saving...",
    saveSuccess: "Settings saved successfully!",
    saveError: "Failed to save settings.",
    enable: "Enable",
    enabled: "Enabled",
    disabled: "Disabled",
    liveMode: "Live Mode (Production)",
    sandboxMode: "Sandbox (Test Mode)",
    activeChannelsCount: "active gateway(s)",
    securityNotice: "All secret keys and passwords are encrypted at rest.",
    usedFor: "Used for: subscription, SMS credit, order-credit, storefront add-on self-service payments.",
  },
};

type GatewayCredentialForm = {
  enabled: boolean;
  is_live: boolean;
  credentials: Record<string, string>;
};

const EMPTY: GatewayCredentialForm = { enabled: false, is_live: false, credentials: {} };

export default function PlatformPaymentGatewaysPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = getStoredUser();
    return stored && normalizeRole(stored) === "admin" ? stored : null;
  });
  const txt = t[locale];
  const menus = useMemo(() => buildAdminMenu(locale), [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const token = getStoredToken();
  const [activeTab, setActiveTab] = useState<string>(GATEWAY_PROVIDER_META[0].provider);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, GatewayCredentialForm>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/admin/platform-payment-gateways`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const d = await res.json();
        const rows: Array<{ provider: string; enabled: boolean; is_live: boolean; credentials: Record<string, string> }> =
          d.data?.credentials ?? [];
        const map: Record<string, GatewayCredentialForm> = {};
        for (const row of rows) {
          map[row.provider] = { enabled: row.enabled, is_live: row.is_live, credentials: row.credentials ?? {} };
        }
        setForms(map);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const form = (provider: string): GatewayCredentialForm => forms[provider] ?? EMPTY;
  const setForm = (provider: string, patch: Partial<GatewayCredentialForm>) =>
    setForms((prev) => {
      const current = prev[provider] ?? EMPTY;
      return { ...prev, [provider]: { ...current, ...patch, credentials: { ...current.credentials, ...patch.credentials } } };
    });

  const toggleSecret = (key: string) => setVisibleSecrets((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async (provider: string) => {
    setSaving(provider);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/platform-payment-gateways/${provider}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form(provider)),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d) {
        setMessage({ ok: true, text: txt.saveSuccess });
        if (d.data) setForms((prev) => ({ ...prev, [provider]: d.data }));
      } else {
        const firstFieldError = d?.errors ? Object.values(d.errors as Record<string, string[]>)[0]?.[0] : undefined;
        setMessage({ ok: false, text: firstFieldError ?? d?.message ?? txt.saveError });
      }
    } finally {
      setSaving(null);
    }
  };

  const activeCount = Object.values(forms).filter((f) => f.enabled).length;
  const current = GATEWAY_PROVIDER_META.find((g) => g.provider === activeTab)!;
  const currentForm = form(activeTab);

  return (
    <CatvShell
      title={txt.title}
      subtitle={txt.intro}
      locale={locale}
      theme={theme}
      localeLabel={locale === "bn" ? "ভাষা" : "Language"}
      themeLabel={locale === "bn" ? "থিম" : "Theme"}
      sidebarTitle={locale === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}
      searchPlaceholder={locale === "bn" ? "সার্চ করুন" : "Search"}
      userName={user?.name}
      userMeta={user?.email}
      menu={menus}
      activeKey="settings-platform-payment-gateways"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {loading ? (
        <div className="catv-panel m-4 p-12 text-center text-[var(--muted)] sm:m-5">{txt.loading}</div>
      ) : (
        <div className="m-4 max-w-4xl space-y-4 sm:m-5">
          <div className="catv-panel p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <CreditCard className="h-5 w-5 text-[var(--accent)]" />
                  {txt.title}
                </h2>
                <p className="mt-1 max-w-2xl text-xs text-[var(--muted)] sm:text-sm">{txt.intro}</p>
                <p className="mt-1 text-xs text-[var(--muted)] opacity-80">{txt.usedFor}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold sm:self-center">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {activeCount} {txt.activeChannelsCount}
              </span>
            </div>
          </div>

          {message && (
            <div
              className={`rounded-xl border p-3.5 text-sm font-medium ${
                message.ok ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="catv-panel p-2">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {GATEWAY_PROVIDER_META.map((g) => {
                const f = form(g.provider);
                const isSelected = activeTab === g.provider;
                return (
                  <button
                    key={g.provider}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setActiveTab(g.provider);
                      setMessage(null);
                    }}
                    className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                      isSelected
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "border border-transparent text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span>{g.label}</span>
                    {f.enabled && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="catv-panel p-5 sm:p-6" role="tabpanel">
            <div className="mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold sm:text-lg">{current.label}</h3>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${current.badgeBg} ${current.badgeColor}`}>
                    {currentForm.enabled ? txt.enabled : txt.disabled}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">{current.description[locale]}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium hover:bg-[var(--background)]/50">
                  <input
                    type="checkbox"
                    checked={currentForm.is_live}
                    onChange={(e) => setForm(activeTab, { is_live: e.target.checked })}
                    className="h-4 w-4 rounded accent-[var(--accent)]"
                  />
                  <span className="font-semibold">{txt.liveMode}</span>
                </label>
                <div className="h-4 w-px bg-[var(--border)]" />
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium hover:bg-[var(--background)]/50">
                  <input
                    type="checkbox"
                    checked={currentForm.enabled}
                    onChange={(e) => setForm(activeTab, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded accent-[var(--accent)]"
                  />
                  <span className={`font-semibold ${currentForm.enabled ? "text-emerald-400" : "text-[var(--muted)]"}`}>{txt.enable}</span>
                </label>
              </div>
            </div>

            <div
              className={`mb-6 flex items-center gap-2 rounded-xl border p-3.5 text-xs ${
                currentForm.is_live ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"
              }`}
            >
              <Radio className="h-4 w-4 shrink-0 animate-pulse" />
              <span className="font-semibold">{currentForm.is_live ? txt.liveMode : txt.sandboxMode}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {current.fields.map((field) => {
                const uniqueKey = `${activeTab}_${field.key}`;
                const isPassword = field.type === "password";
                const isVisible = visibleSecrets[uniqueKey];
                return (
                  <label key={field.key} className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
                      <span>{field.label}</span>
                      {isPassword && (
                        <span className="flex items-center gap-1 text-[10px] opacity-70">
                          <Lock className="h-3 w-3" /> Encrypted
                        </span>
                      )}
                    </span>
                    <div className="relative">
                      <input
                        type={isPassword && !isVisible ? "password" : "text"}
                        value={currentForm.credentials[field.key] ?? ""}
                        onChange={(e) => setForm(activeTab, { credentials: { [field.key]: e.target.value } })}
                        placeholder={field.placeholder}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 pr-10 text-sm font-mono outline-none transition focus:border-[var(--accent)]"
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => toggleSecret(uniqueKey)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-[var(--muted)] opacity-80">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{txt.securityNotice}</span>
            </div>

            <div className="mt-6 flex justify-end border-t border-[var(--border)] pt-4">
              <button
                onClick={() => void save(activeTab)}
                disabled={saving === activeTab}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                {saving === activeTab && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                <span>{saving === activeTab ? txt.saving : txt.save}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </CatvShell>
  );
}
