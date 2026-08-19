"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import {
  Wallet,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
} from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "অনলাইন পেমেন্ট চ্যানেল",
    intro:
      "আপনার অনলাইন শপের জন্য ম্যানুয়াল পার্সোনাল ওয়ালেট ও অটোমেটিক মার্চেন্ট পেমেন্ট গেটওয়ে কনফিগার করুন।",
    loading: "লোড হচ্ছে...",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    saveSuccess: "সেটিংস সফলভাবে সেভ হয়েছে!",
    saveError: "সেভ ব্যর্থ হয়েছে।",
    enable: "চালু করুন",
    enabled: "চালু আছে",
    disabled: "বন্ধ আছে",
    status: "অবস্থা",
    environment: "এনভায়রনমেন্ট",
    liveMode: "লাইভ মোড (Production)",
    sandboxMode: "Sandbox (টেস্ট মোড)",
    liveModeDesc: "আসল কাস্টমার পেমেন্ট গ্রহণের জন্য লাইভ মোড অন রাখুন",
    sandboxModeDesc: "পরীক্ষামূলক পেমেন্ট টেস্ট করার জন্য Sandbox মোড ব্যবহার করুন",
    number: "রিসিভিং নম্বর",
    numberPlaceholder: "01XXXXXXXXX",
    personalWalletTab: "পার্সোনাল ওয়ালেট",
    personalWalletSubtitle: "বিকাশ, নগদ ও রকেট পার্সোনাল নম্বর (Send Money & TrxID ভেরিফিকেশন)",
    personalWalletDesc:
      "কাস্টমার চেকআউটে সরাসরি আপনার পার্সোনাল নম্বরে টাকা পাঠিয়ে Transaction ID জমা দেবেন। মার্চেন্ট একাউন্ট ছাড়াই ব্যবহারযোগ্য।",
    bkashTitle: "বিকাশ (পার্সোনাল)",
    nagadTitle: "নগদ (পার্সোনাল)",
    rocketTitle: "রকেট (পার্সোনাল)",
    bkashDesc: "বিকাশ পার্সোনাল সেন্ড মানি",
    nagadDesc: "নগদ পার্সোনাল সেন্ড মানি",
    rocketDesc: "রকেট পার্সোনাল সেন্ড মানি",
    gatewayCategoryTitle: "অটোমেটিক মার্চেন্ট গেটওয়ে",
    gatewayCategorySubtitle: "কাস্টমার সরাসরি চেকআউট পেজে কার্ড/ওয়ালেট দিয়ে স্বয়ংক্রিয়ভাবে পে করবে",
    gatewayLive: "লাইভ মোড (Live Mode)",
    gatewayComingSoon: "শীঘ্রই আসছে",
    gatewayComingSoonDesc:
      "এই পেমেন্ট গেটওয়েটি আমাদের পরবর্তী আপডেটে যুক্ত করা হবে। খুব শীঘ্রই এটি লাইভ হবে।",
    gatewaySupported: "ব্যবহারযোগ্য",
    activeChannelsCount: "টি গেটওয়ে সক্রিয়",
    securityNotice: "আপনার সকল মার্চেন্ট সিক্রেট কি ও পাসওয়ার্ড ডাটাবেজে এনক্রিপ্ট করে সুরক্ষিত রাখা হয়।",
    instructionsTitle: "ইন্টিগ্রেশন গাইড",
  },
  en: {
    pageTitle: "Online Payment Channels",
    intro:
      "Configure manual personal wallets and automated merchant payment gateways for your online shop.",
    loading: "Loading...",
    save: "Save Settings",
    saving: "Saving...",
    saveSuccess: "Settings saved successfully!",
    saveError: "Failed to save settings.",
    enable: "Enable",
    enabled: "Enabled",
    disabled: "Disabled",
    status: "Status",
    environment: "Environment",
    liveMode: "Live Mode (Production)",
    sandboxMode: "Sandbox (Test Mode)",
    liveModeDesc: "Keep Live mode ON to accept real payments from customers",
    sandboxModeDesc: "Use Sandbox mode for testing payments safely",
    number: "Receiving Number",
    numberPlaceholder: "01XXXXXXXXX",
    personalWalletTab: "Personal Wallets",
    personalWalletSubtitle: "bKash, Nagad & Rocket Personal (Send Money & TrxID Verification)",
    personalWalletDesc:
      "Customers send money to your personal number at checkout and submit their TrxID. No merchant account needed.",
    bkashTitle: "bKash (Personal)",
    nagadTitle: "Nagad (Personal)",
    rocketTitle: "Rocket (Personal)",
    bkashDesc: "bKash Personal Send Money",
    nagadDesc: "Nagad Personal Send Money",
    rocketDesc: "Rocket Personal Send Money",
    gatewayCategoryTitle: "Automated Merchant Gateways",
    gatewayCategorySubtitle: "Customers pay directly at checkout with hosted payment verification",
    gatewayLive: "Live Mode",
    gatewayComingSoon: "Coming Soon",
    gatewayComingSoonDesc:
      "This payment gateway is scheduled for an upcoming release. It will be available very soon.",
    gatewaySupported: "Available",
    activeChannelsCount: "active gateway(s)",
    securityNotice: "All your API keys and store passwords are encrypted at rest in our database.",
    instructionsTitle: "Integration Guide",
  },
};

interface GatewayConfig {
  provider: string;
  label: string;
  badgeColor: string;
  badgeBg: string;
  description: { bn: string; en: string };
  guideUrl?: string;
  fields: Array<{ key: string; label: string; type: "text" | "password"; placeholder?: string }>;
}

const GATEWAY_PROVIDERS: GatewayConfig[] = [
  {
    provider: "sslcommerz",
    label: "SSLCommerz",
    badgeColor: "text-blue-400",
    badgeBg: "bg-blue-500/10 border-blue-500/20",
    description: {
      bn: "বাংলাদেশের জনপ্রিয় পেমেন্ট গেটওয়ে — ডেবিট/ক্রেডিট কার্ড, ইন্টারনেট ব্যাংকিং ও মোবাইল ওয়ালেট সাপোর্ট।",
      en: "Popular Bangladesh payment gateway supporting cards, internet banking & mobile wallets.",
    },
    guideUrl: "https://sslcommerz.com",
    fields: [
      { key: "store_id", label: "Store ID", type: "text", placeholder: "e.g. yourshoplive" },
      { key: "store_password", label: "Store Password", type: "password", placeholder: "e.g. your_store_passwd" },
    ],
  },
  {
    provider: "aamarpay",
    label: "AamarPay",
    badgeColor: "text-emerald-400",
    badgeBg: "bg-emerald-500/10 border-emerald-500/20",
    description: {
      bn: "সহজ ও দ্রুত পেমেন্ট গেটওয়ে — বিকাশ, নগদ, রকেট, উপায় এবং কার্ড পেমেন্ট সাপোর্ট।",
      en: "Fast checkout payment gateway supporting bKash, Nagad, Rocket, Upay & cards.",
    },
    guideUrl: "https://aamarpay.com",
    fields: [
      { key: "store_id", label: "Store ID", type: "text", placeholder: "e.g. aamarpaytest" },
      { key: "signature_key", label: "Signature Key", type: "password", placeholder: "e.g. dbb74894e824..." },
    ],
  },
  {
    provider: "zinipay",
    label: "ZiniPay",
    badgeColor: "text-amber-400",
    badgeBg: "bg-amber-500/10 border-amber-500/20",
    description: {
      bn: "মোবাইল ফিনান্সিয়াল সার্ভিসেস (MFS) ভিত্তিক অ্যাগ্রিগেটর গেটওয়ে।",
      en: "Mobile financial services aggregator gateway for local wallets.",
    },
    guideUrl: "https://zinipay.com",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "e.g. zini_live_key_..." },
    ],
  },
  {
    provider: "shurjopay",
    label: "ShurjoPay",
    badgeColor: "text-orange-400",
    badgeBg: "bg-orange-500/10 border-orange-500/20",
    description: {
      bn: "বাংলাদেশ ব্যাংক অনুমোদিত পেমেন্ট গেটওয়ে — কার্ড, নেট ব্যাংকিং ও মোবাইল ওয়ালেট সাপোর্ট।",
      en: "Bangladesh Bank licensed payment gateway supporting cards, net banking & mobile wallets.",
    },
    guideUrl: "https://shurjopay.com.bd",
    fields: [
      { key: "username", label: "Merchant Username", type: "text", placeholder: "e.g. your_merchant_username" },
      { key: "password", label: "Merchant Password", type: "password", placeholder: "e.g. your_merchant_password" },
      { key: "prefix", label: "Store Prefix", type: "text", placeholder: "e.g. NOK or SP" },
    ],
  },
  {
    provider: "eps",
    label: "EPS",
    badgeColor: "text-cyan-400",
    badgeBg: "bg-cyan-500/10 border-cyan-500/20",
    description: {
      bn: "ইলেকট্রনিক পেমেন্ট সেটেলমেন্ট গেটওয়ে।",
      en: "Electronic Payment Settlement gateway.",
    },
    fields: [],
  },
  {
    provider: "bkash_merchant",
    label: "bKash (Merchant)",
    badgeColor: "text-pink-400",
    badgeBg: "bg-pink-500/10 border-pink-500/20",
    description: {
      bn: "বিকাশ মার্চেন্ট ডিরেক্ট চেকআউট গেটওয়ে।",
      en: "Direct bKash merchant checkout integration.",
    },
    fields: [],
  },
  {
    provider: "nagad_merchant",
    label: "Nagad (Merchant)",
    badgeColor: "text-rose-400",
    badgeBg: "bg-rose-500/10 border-rose-500/20",
    description: {
      bn: "নগদ মার্চেন্ট ডিরেক্ট চেকআউট গেটওয়ে।",
      en: "Direct Nagad merchant checkout integration.",
    },
    fields: [],
  },
];

type GatewayCredentialForm = {
  enabled: boolean;
  is_live: boolean;
  credentials: Record<string, string>;
};

type Form = {
  bkash_personal_enabled: boolean;
  bkash_personal_number: string;
  nagad_personal_enabled: boolean;
  nagad_personal_number: string;
  rocket_personal_enabled: boolean;
  rocket_personal_number: string;
};

const EMPTY_FORM: Form = {
  bkash_personal_enabled: false,
  bkash_personal_number: "",
  nagad_personal_enabled: false,
  nagad_personal_number: "",
  rocket_personal_enabled: false,
  rocket_personal_number: "",
};

export default function PaymentGatewaySettingsPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [activeTab, setActiveTab] = useState<string>("personal");
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [supportedProviders, setSupportedProviders] = useState<string[]>([]);
  const [gatewayForms, setGatewayForms] = useState<Record<string, GatewayCredentialForm>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/payment-gateway-settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          if (d.data) setForm({ ...EMPTY_FORM, ...d.data });
        }
      } finally {
        setLoading(false);
      }
    })();

    void (async () => {
      const res = await fetch(`${API}/payment-gateway-credentials`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const d = await res.json();
      setSupportedProviders(d.data?.supported_providers ?? []);
      const rows: Array<{ provider: string; enabled: boolean; is_live: boolean; credentials: Record<string, string> }> =
        d.data?.credentials ?? [];
      const map: Record<string, GatewayCredentialForm> = {};
      for (const row of rows) {
        map[row.provider] = { enabled: row.enabled, is_live: row.is_live, credentials: row.credentials ?? {} };
      }
      setGatewayForms(map);
    })();
  }, [token]);

  const gatewayForm = (provider: string): GatewayCredentialForm =>
    gatewayForms[provider] ?? { enabled: false, is_live: false, credentials: {} };

  const setGatewayForm = (provider: string, patch: Partial<GatewayCredentialForm>) =>
    setGatewayForms((prev) => {
      const current = prev[provider] ?? { enabled: false, is_live: false, credentials: {} };
      return {
        ...prev,
        [provider]: { ...current, ...patch, credentials: { ...current.credentials, ...patch.credentials } },
      };
    });

  const toggleSecretVisibility = (fieldKey: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const saveGateway = async (provider: string) => {
    setSavingProvider(provider);
    setMessage(null);
    try {
      const res = await fetch(`${API}/payment-gateway-credentials/${provider}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(gatewayForm(provider)),
      });
      const d: {
        success?: boolean;
        data?: { enabled: boolean; is_live: boolean; credentials: Record<string, string> };
        message?: string;
        errors?: Record<string, string[]>;
      } | null = await res.json().catch(() => null);
      if (res.ok && d) {
        setMessage({ type: "success", text: txt.saveSuccess });
        if (d.data) setGatewayForms((prev) => ({ ...prev, [provider]: d.data! }));
      } else {
        const firstFieldError = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined;
        setMessage({ type: "error", text: firstFieldError ?? d?.message ?? txt.saveError });
      }
    } finally {
      setSavingProvider(null);
    }
  };

  const handleSavePersonal = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/payment-gateway-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d: { success?: boolean; data?: Record<string, unknown>; message?: string; errors?: Record<string, string[]> } | null =
        await res.json().catch(() => null);
      if (res.ok && d) {
        setMessage({ type: "success", text: txt.saveSuccess });
        if (d.data) setForm({ ...EMPTY_FORM, ...d.data });
      } else {
        const firstFieldError = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined;
        setMessage({ type: "error", text: firstFieldError ?? d?.message ?? txt.saveError });
      }
    } finally {
      setSaving(false);
    }
  };

  const personalChannels: Array<{
    id: string;
    title: string;
    description: string;
    enabledKey: keyof Form;
    numberKey: keyof Form;
    accentColor: string;
    badgeBg: string;
  }> = [
    {
      id: "bkash",
      title: txt.bkashTitle,
      description: txt.bkashDesc,
      enabledKey: "bkash_personal_enabled",
      numberKey: "bkash_personal_number",
      accentColor: "text-pink-500",
      badgeBg: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    },
    {
      id: "nagad",
      title: txt.nagadTitle,
      description: txt.nagadDesc,
      enabledKey: "nagad_personal_enabled",
      numberKey: "nagad_personal_number",
      accentColor: "text-orange-500",
      badgeBg: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    },
    {
      id: "rocket",
      title: txt.rocketTitle,
      description: txt.rocketDesc,
      enabledKey: "rocket_personal_enabled",
      numberKey: "rocket_personal_number",
      accentColor: "text-purple-500",
      badgeBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
  ];

  // Count active channels
  const activePersonalCount = [form.bkash_personal_enabled, form.nagad_personal_enabled, form.rocket_personal_enabled].filter(Boolean).length;
  const activeGatewayCount = Object.values(gatewayForms).filter((g) => g.enabled).length;

  const currentGatewayConfig = GATEWAY_PROVIDERS.find((g) => g.provider === activeTab);

  return (
    <UserShell
      activeKey="online-payment-settings"
      defaultExpandedKey="settings"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}
    >
      {loading ? (
        <div className="catv-panel p-12 text-center text-[var(--muted)] flex flex-col items-center justify-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <span>{txt.loading}</span>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {/* Header Banner */}
          <div className="catv-panel relative overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2.5">
                  <CreditCard className="h-5 w-5 text-[var(--accent)]" />
                  <span>{txt.pageTitle}</span>
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[var(--muted)] max-w-2xl">{txt.intro}</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {activePersonalCount + activeGatewayCount} {txt.activeChannelsCount}
                </span>
              </div>
            </div>
          </div>

          {/* Feedback message banner */}
          {message && (
            <div
              className={`flex items-center gap-2.5 rounded-xl border p-4 text-sm font-medium transition-all ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="catv-panel p-2">
            <div className="flex flex-wrap gap-1.5 sm:gap-2" role="tablist">
              {/* Personal Wallet Tab */}
              <button
                role="tab"
                aria-selected={activeTab === "personal"}
                onClick={() => {
                  setActiveTab("personal");
                  setMessage(null);
                }}
                className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === "personal"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "border border-transparent text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                }`}
              >
                <Wallet className="h-4 w-4 shrink-0" />
                <span>{txt.personalWalletTab}</span>
                {activePersonalCount > 0 && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === "personal" ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {activePersonalCount}
                  </span>
                )}
              </button>

              {/* Automatic Gateways Tabs */}
              {GATEWAY_PROVIDERS.map((g) => {
                const gf = gatewayForm(g.provider);
                const isSupported = supportedProviders.includes(g.provider) && g.fields.length > 0;
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
                    className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                      isSelected
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "border border-transparent text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 shrink-0 opacity-80" />
                    <span>{g.label}</span>
                    {gf.enabled && isSupported && (
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    )}
                    {!isSupported && (
                      <span
                        className={`rounded px-1 py-0.2 text-[10px] uppercase font-bold tracking-tight opacity-70 ${
                          isSelected ? "bg-white/20 text-white" : "bg-[var(--muted)]/15 text-[var(--muted)]"
                        }`}
                      >
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: Personal Wallets Content */}
          {activeTab === "personal" && (
            <div className="space-y-4" role="tabpanel">
              <div className="catv-panel p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4 mb-5">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-[var(--accent)]" />
                      <span>{txt.personalWalletTab}</span>
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{txt.personalWalletSubtitle}</p>
                  </div>
                  <div className="text-xs text-[var(--muted)] bg-[var(--surface-soft)] rounded-lg px-3 py-1.5 max-w-sm">
                    {txt.personalWalletDesc}
                  </div>
                </div>

                <div className="grid gap-4">
                  {personalChannels.map((c) => {
                    const isEnabled = Boolean(form[c.enabledKey]);
                    return (
                      <div
                        key={c.id}
                        className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                          isEnabled
                            ? "border-[var(--accent)]/40 bg-[var(--surface-soft)]/50"
                            : "border-[var(--border)] bg-[var(--surface-soft)]/20"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold text-sm border ${c.badgeBg}`}>
                              ৳
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-[var(--foreground)]">{c.title}</h4>
                              <p className="text-xs text-[var(--muted)]">{c.description}</p>
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => setForm((f) => ({ ...f, [c.enabledKey]: e.target.checked }))}
                              className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                            />
                            <span className={isEnabled ? "text-emerald-400" : "text-[var(--muted)]"}>
                              {isEnabled ? txt.enabled : txt.enable}
                            </span>
                          </label>
                        </div>

                        <div className="mt-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{txt.number}</span>
                            <div className="relative">
                              <input
                                value={String(form[c.numberKey] ?? "")}
                                onChange={(e) => setForm((f) => ({ ...f, [c.numberKey]: e.target.value }))}
                                placeholder={txt.numberPlaceholder}
                                disabled={!isEnabled}
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm font-mono tracking-wider outline-none transition focus:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
                              />
                            </div>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border)] flex justify-end">
                  <button
                    onClick={() => void handleSavePersonal()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    <span>{saving ? txt.saving : txt.save}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Automatic Payment Gateways Content */}
          {currentGatewayConfig && activeTab !== "personal" && (
            <div className="space-y-4" role="tabpanel">
              {supportedProviders.includes(currentGatewayConfig.provider) && currentGatewayConfig.fields.length > 0 ? (
                <div className="catv-panel p-5 sm:p-6">
                  {/* Gateway Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-bold">{currentGatewayConfig.label}</h3>
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${currentGatewayConfig.badgeBg} ${currentGatewayConfig.badgeColor}`}>
                          {gatewayForm(currentGatewayConfig.provider).enabled ? txt.enabled : txt.disabled}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                        {currentGatewayConfig.description[locale]}
                      </p>
                    </div>

                    {/* Controls: Live toggle & Enable toggle */}
                    <div className="flex flex-wrap items-center gap-3 bg-[var(--surface-soft)] p-2 rounded-xl border border-[var(--border)]">
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-[var(--background)]/50 transition">
                        <input
                          type="checkbox"
                          checked={gatewayForm(currentGatewayConfig.provider).is_live}
                          onChange={(e) =>
                            setGatewayForm(currentGatewayConfig.provider, { is_live: e.target.checked })
                          }
                          className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                        />
                        <span className="font-semibold">{txt.gatewayLive}</span>
                      </label>

                      <div className="h-4 w-px bg-[var(--border)]" />

                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-[var(--background)]/50 transition">
                        <input
                          type="checkbox"
                          checked={gatewayForm(currentGatewayConfig.provider).enabled}
                          onChange={(e) =>
                            setGatewayForm(currentGatewayConfig.provider, { enabled: e.target.checked })
                          }
                          className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                        />
                        <span className={`font-semibold ${gatewayForm(currentGatewayConfig.provider).enabled ? "text-emerald-400" : "text-[var(--muted)]"}`}>
                          {txt.enable}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Mode Banner Indicator */}
                  <div
                    className={`mb-6 flex items-center justify-between rounded-xl border p-3.5 text-xs ${
                      gatewayForm(currentGatewayConfig.provider).is_live
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 shrink-0 animate-pulse" />
                      <span className="font-semibold">
                        {gatewayForm(currentGatewayConfig.provider).is_live ? txt.liveMode : txt.sandboxMode}:
                      </span>
                      <span>
                        {gatewayForm(currentGatewayConfig.provider).is_live ? txt.liveModeDesc : txt.sandboxModeDesc}
                      </span>
                    </div>
                  </div>

                  {/* Fields Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {currentGatewayConfig.fields.map((field) => {
                      const fieldUniqueKey = `${currentGatewayConfig.provider}_${field.key}`;
                      const isPassword = field.type === "password";
                      const isVisible = visibleSecrets[fieldUniqueKey];
                      const inputType = isPassword ? (isVisible ? "text" : "password") : "text";

                      return (
                        <label key={field.key} className="block">
                          <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
                            <span>{field.label}</span>
                            {isPassword && (
                              <span className="flex items-center gap-1 text-[10px] text-[var(--muted)] opacity-70">
                                <Lock className="h-3 w-3" /> Encrypted
                              </span>
                            )}
                          </span>
                          <div className="relative">
                            <input
                              type={inputType}
                              value={gatewayForm(currentGatewayConfig.provider).credentials[field.key] ?? ""}
                              onChange={(e) =>
                                setGatewayForm(currentGatewayConfig.provider, {
                                  credentials: { [field.key]: e.target.value },
                                })
                              }
                              placeholder={field.placeholder}
                              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm font-mono outline-none transition focus:border-[var(--accent)] pr-10"
                            />
                            {isPassword && (
                              <button
                                type="button"
                                onClick={() => toggleSecretVisibility(fieldUniqueKey)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] p-1 rounded transition"
                                title={isVisible ? "Hide secret" : "Show secret"}
                              >
                                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Security Note */}
                  <div className="mt-5 flex items-center gap-2 text-xs text-[var(--muted)] opacity-80">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{txt.securityNotice}</span>
                  </div>

                  {/* Action Bar */}
                  <div className="mt-6 pt-4 border-t border-[var(--border)] flex justify-end">
                    <button
                      onClick={() => void saveGateway(currentGatewayConfig.provider)}
                      disabled={savingProvider === currentGatewayConfig.provider}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                    >
                      {savingProvider === currentGatewayConfig.provider && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      )}
                      <span>{savingProvider === currentGatewayConfig.provider ? txt.saving : txt.save}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Coming Soon Card */
                <div className="catv-panel p-8 sm:p-12 text-center flex flex-col items-center justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] border border-[var(--border)] mb-4">
                    <Sparkles className="h-7 w-7 text-[var(--accent)]" />
                  </div>
                  <h3 className="text-lg font-bold">{currentGatewayConfig.label}</h3>
                  <span className="mt-1.5 inline-flex items-center rounded-full bg-[var(--muted)]/15 px-3 py-0.5 text-xs font-semibold text-[var(--muted)]">
                    {txt.gatewayComingSoon}
                  </span>
                  <p className="mt-3 text-sm text-[var(--muted)] max-w-md">
                    {currentGatewayConfig.description[locale]} {txt.gatewayComingSoonDesc}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </UserShell>
  );
}
