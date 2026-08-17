"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "অনলাইন পেমেন্ট চ্যানেল",
    intro:
      "কাস্টমার চেকআউটে সরাসরি আপনার পার্সোনাল বিকাশ/নগদ/রকেট নম্বরে টাকা পাঠাতে পারবেন — কাস্টমার Transaction ID জমা দেবেন, আপনি যাচাই করে কনফার্ম করবেন। মার্চেন্ট একাউন্ট লাগবে না।",
    loading: "লোড হচ্ছে...",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    saveSuccess: "সেটিং সেভ হয়েছে!",
    saveError: "সেভ ব্যর্থ হয়েছে।",
    enable: "চালু করুন",
    number: "রিসিভিং নম্বর",
    numberPlaceholder: "01XXXXXXXXX",
    bkashTitle: "বিকাশ (পার্সোনাল)",
    nagadTitle: "নগদ (পার্সোনাল)",
    rocketTitle: "রকেট (পার্সোনাল)",
  },
  en: {
    pageTitle: "Online Payment Channels",
    intro:
      "Customers can send money directly to your personal bKash/Nagad/Rocket number at checkout — they submit the Transaction ID, and you verify and confirm it. No merchant account needed.",
    loading: "Loading...",
    save: "Save",
    saving: "Saving...",
    saveSuccess: "Settings saved!",
    saveError: "Failed to save.",
    enable: "Enable",
    number: "Receiving number",
    numberPlaceholder: "01XXXXXXXXX",
    bkashTitle: "bKash (Personal)",
    nagadTitle: "Nagad (Personal)",
    rocketTitle: "Rocket (Personal)",
  },
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
  bkash_personal_enabled: false, bkash_personal_number: "",
  nagad_personal_enabled: false, nagad_personal_number: "",
  rocket_personal_enabled: false, rocket_personal_number: "",
};

export default function PaymentGatewaySettingsPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  }, [token]);

  const handleSave = async () => {
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

  const channels: Array<{
    title: string;
    enabledKey: keyof Form;
    numberKey: keyof Form;
  }> = [
    { title: txt.bkashTitle, enabledKey: "bkash_personal_enabled", numberKey: "bkash_personal_number" },
    { title: txt.nagadTitle, enabledKey: "nagad_personal_enabled", numberKey: "nagad_personal_number" },
    { title: txt.rocketTitle, enabledKey: "rocket_personal_enabled", numberKey: "rocket_personal_number" },
  ];

  return (
    <UserShell activeKey="online-payment-settings" defaultExpandedKey="settings"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {loading ? (
        <div className="catv-panel p-8 text-center text-[var(--muted)]">{txt.loading}</div>
      ) : (
        <div className="grid gap-4 max-w-xl">
          <p className="text-sm text-[var(--muted)]">{txt.intro}</p>

          {message && (
            <div className={`rounded-xl px-4 py-2.5 text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {message.text}
            </div>
          )}

          {channels.map((c) => (
            <div key={c.enabledKey} className="catv-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{c.title}</h3>
                <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={Boolean(form[c.enabledKey])}
                    onChange={(e) => setForm((f) => ({ ...f, [c.enabledKey]: e.target.checked }))}
                  />
                  {txt.enable}
                </label>
              </div>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.number}</span>
                <input
                  value={String(form[c.numberKey] ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, [c.numberKey]: e.target.value }))}
                  placeholder={txt.numberPlaceholder}
                  disabled={!form[c.enabledKey]}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)] disabled:opacity-50"
                />
              </label>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => void handleSave()} disabled={saving}
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? txt.saving : txt.save}
            </button>
          </div>
        </div>
      )}
    </UserShell>
  );
}
