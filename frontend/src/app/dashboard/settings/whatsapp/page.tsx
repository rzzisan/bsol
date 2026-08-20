"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, Send, XCircle } from "lucide-react";
import UserShell from "@/components/user-shell";
import { SectionHeader } from "@/components/billing-ui";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

interface ConnectionInfo {
  phone_number_id: string | null;
  waba_id: string | null;
  display_phone_number: string | null;
  access_token_set: boolean;
  status: string;
  last_error: string | null;
  verified_at: string | null;
}

const text = {
  bn: {
    title: "হোয়াটসঅ্যাপ",
    subtitle: "নিজের WhatsApp Cloud API ক্রেডেনশিয়াল কানেক্ট করলে অর্ডার-স্ট্যাটাস অটোমেশন + ইনবক্স ব্যবহার করা যাবে।",
    intro: "Meta Business Suite → WhatsApp Manager থেকে নিজের phone_number_id ও একটা permanent access token বানিয়ে এখানে পেস্ট করুন — এই App-এ আলাদা কোনো OAuth/App Review লাগবে না। ⚠️ App Review পাস না হওয়া পর্যন্ত শুধু Meta-তে verified-tester হিসেবে যোগ করা নম্বরেই মেসেজ পাঠানো যাবে (সর্বোচ্চ ৫টা)।",
    phoneNumberId: "Phone Number ID",
    wabaId: "WABA ID (ঐচ্ছিক)",
    displayNumber: "ডিসপ্লে নম্বর (ঐচ্ছিক)",
    accessToken: "Access Token",
    accessTokenSetHint: "সেট করা আছে — বদলাতে নতুন টোকেন লিখুন",
    accessTokenPlaceholder: "নতুন টোকেন (খালি রাখলে অপরিবর্তিত)",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    connected: "কানেক্টেড",
    notConnected: "কানেক্টেড নয়",
    disconnected: "ডিসকানেক্টেড",
    error: "সমস্যা আছে",
    lastError: "সর্বশেষ সমস্যা",
    verifiedAt: "সর্বশেষ টেস্ট সফল",
    testTitle: "টেস্ট মেসেজ পাঠান",
    testNumberPlaceholder: "টেস্ট নম্বর (৮৮০১...)",
    testBtn: "টেস্ট পাঠান",
    testing: "পাঠানো হচ্ছে...",
    testSuccess: "টেস্ট মেসেজ পাঠানো হয়েছে।",
    testFailed: "টেস্ট ব্যর্থ হয়েছে — ক্রেডেনশিয়াল বা নম্বর চেক করো।",
    disconnect: "ডিসকানেক্ট করুন",
    disconnecting: "ডিসকানেক্ট হচ্ছে...",
    saveSuccess: "সেভ করা হয়েছে।",
    loading: "লোড হচ্ছে...",
    genericError: "কিছু একটা সমস্যা হয়েছে।",
  },
  en: {
    title: "WhatsApp",
    subtitle: "Connect your own WhatsApp Cloud API credentials to use order-status automation + the inbox.",
    intro: "Create a phone_number_id and a permanent access token in Meta Business Suite → WhatsApp Manager and paste them here — no OAuth/App Review needed on our side. ⚠️ Until App Review passes, messages can only be sent to numbers added as verified testers in Meta (max 5).",
    phoneNumberId: "Phone Number ID",
    wabaId: "WABA ID (optional)",
    displayNumber: "Display number (optional)",
    accessToken: "Access Token",
    accessTokenSetHint: "Already set — enter a new token to change it",
    accessTokenPlaceholder: "New token (leave blank to keep unchanged)",
    save: "Save",
    saving: "Saving...",
    connected: "Connected",
    notConnected: "Not connected",
    disconnected: "Disconnected",
    error: "Has an issue",
    lastError: "Last issue",
    verifiedAt: "Last successful test",
    testTitle: "Send a test message",
    testNumberPlaceholder: "Test number (8801...)",
    testBtn: "Send test",
    testing: "Sending...",
    testSuccess: "Test message sent.",
    testFailed: "Test failed — check credentials or the number.",
    disconnect: "Disconnect",
    disconnecting: "Disconnecting...",
    saveSuccess: "Saved.",
    loading: "Loading...",
    genericError: "Something went wrong.",
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({ phone_number_id: "", waba_id: "", display_phone_number: "", access_token: "" });
  const [testNumber, setTestNumber] = useState("");

  const load = async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/whatsapp/connection`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        const info = data.data as ConnectionInfo;
        setConnection(info);
        setForm((p) => ({ ...p, phone_number_id: info.phone_number_id ?? "", waba_id: info.waba_id ?? "", display_phone_number: info.display_phone_number ?? "" }));
      }
    } catch {
      setError(t.genericError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/whatsapp/connection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.genericError);
        return;
      }
      setSuccess(t.saveSuccess);
      setForm((p) => ({ ...p, access_token: "" }));
      await load();
    } catch {
      setError(t.genericError);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const token = getStoredToken();
    if (!token || !testNumber) return;
    setTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/whatsapp/connection/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: testNumber }),
      });
      const data = await res.json();
      if (!data?.success) {
        setError(data?.message ?? t.testFailed);
        return;
      }
      setSuccess(t.testSuccess);
      await load();
    } catch {
      setError(t.genericError);
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    const token = getStoredToken();
    if (!token) return;
    setDisconnecting(true);
    setError(null);
    try {
      await fetch(`${API}/whatsapp/connection`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      setForm({ phone_number_id: "", waba_id: "", display_phone_number: "", access_token: "" });
      await load();
    } catch {
      setError(t.genericError);
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = connection?.status === "connected" && connection.access_token_set;

  return (
    <UserShell
      activeKey="whatsapp-connect"
      defaultExpandedKey="settings"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      {loading ? (
        <p className="mx-4 text-sm text-[var(--muted)]">{t.loading}</p>
      ) : (
        <>
          <section className="catv-panel mx-4 mb-4 p-4 sm:p-5">
            <SectionHeader icon={MessageCircle}>{t.title}</SectionHeader>
            <p className="mb-4 text-xs text-[var(--muted)]">{t.intro}</p>

            {connection ? (
              <div className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: "var(--surface-soft)" }}>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={14} /> {t.connected}</span>
                ) : connection.status === 'error' ? (
                  <span className="inline-flex items-center gap-1.5 text-rose-600"><XCircle size={14} /> {t.error}</span>
                ) : (
                  <span className="text-[var(--muted)]">{t.notConnected}</span>
                )}
              </div>
            ) : null}

            {connection?.last_error ? (
              <p className="mb-3 text-xs text-rose-600">{t.lastError}: {connection.last_error}</p>
            ) : null}
            {connection?.verified_at ? (
              <p className="mb-3 text-xs text-[var(--muted)]">{t.verifiedAt}: {new Date(connection.verified_at).toLocaleString()}</p>
            ) : null}

            <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">{t.phoneNumberId}</label>
                <input
                  required
                  value={form.phone_number_id}
                  onChange={(e) => setForm((p) => ({ ...p, phone_number_id: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">{t.wabaId}</label>
                <input
                  value={form.waba_id}
                  onChange={(e) => setForm((p) => ({ ...p, waba_id: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">{t.displayNumber}</label>
                <input
                  value={form.display_phone_number}
                  onChange={(e) => setForm((p) => ({ ...p, display_phone_number: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">
                  {t.accessToken}
                  {connection?.access_token_set ? <span className="ml-1 text-emerald-600">({t.accessTokenSetHint})</span> : null}
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={t.accessTokenPlaceholder}
                  value={form.access_token}
                  onChange={(e) => setForm((p) => ({ ...p, access_token: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70 sm:col-span-2"
              >
                {saving ? t.saving : t.save}
              </button>
            </form>

            {isConnected ? (
              <>
                <div className="my-4 border-t border-[var(--border)]" />
                <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t.testTitle}</p>
                <div className="flex gap-2">
                  <input
                    placeholder={t.testNumberPlaceholder}
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void sendTest()}
                    disabled={testing || !testNumber}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] disabled:opacity-60"
                  >
                    <Send size={14} /> {testing ? t.testing : t.testBtn}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void disconnect()}
                  disabled={disconnecting}
                  className="mt-4 text-xs font-semibold text-rose-600 underline-offset-2 hover:underline disabled:opacity-60"
                >
                  {disconnecting ? t.disconnecting : t.disconnect}
                </button>
              </>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}
          </section>
        </>
      )}
    </UserShell>
  );
}
