"use client";

import { useCallback, useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "ওয়ার্ডপ্রেস কানেক্ট",
    intro:
      "আপনার WooCommerce ওয়েবসাইট BSOL-এর সাথে কানেক্ট করতে প্রথমে নিচে থেকে প্লাগিন ডাউনলোড করে WordPress-এ ইনস্টল করুন, তারপর আপনার ডোমেইন দিয়ে একটি API Key তৈরি করে প্লাগিনে বসান। একাধিক ওয়েবসাইট কানেক্ট করা যাবে।",
    downloadTitle: "BSOL Connect প্লাগিন",
    downloadDesc: "ডাউনলোড করে WordPress Admin → Plugins → Add New → Upload Plugin থেকে ইনস্টল করুন।",
    downloadBtn: "প্লাগিন ডাউনলোড করুন",
    loading: "লোড হচ্ছে...",
    domainLabel: "ওয়েবসাইট ডোমেইন",
    domainPlaceholder: "example.com",
    generateBtn: "API Key তৈরি করুন",
    regenerateBtn: "নতুন Key তৈরি করুন",
    addAnotherBtn: "আরেকটি সাইট কানেক্ট করুন",
    generating: "তৈরি হচ্ছে...",
    revokeBtn: "বাতিল করুন",
    revoking: "বাতিল হচ্ছে...",
    regenerateConfirm:
      "এটি এই সাইটের বর্তমান API Key অকার্যকর করে দেবে — WordPress প্লাগিনেও নতুন Key বসাতে হবে। চালিয়ে যাবেন?",
    revokeConfirm: "এই সাইটের API Key বাতিল করলে সেই সাইট থেকে সিঙ্ক বন্ধ হয়ে যাবে। চালিয়ে যাবেন?",
    statusPending: "সংযুক্ত হয়নি",
    statusConnected: "কানেক্টেড",
    statusRevoked: "বাতিল করা হয়েছে",
    domainField: "ডোমেইন",
    keyField: "API Key",
    lastUsedField: "সর্বশেষ ব্যবহৃত",
    neverUsed: "কখনো ব্যবহার হয়নি",
    saveKeyWarning: "সংরক্ষণ করুন — এটা আর দেখানো হবে না।",
    copyBtn: "কপি করুন",
    copiedBtn: "কপি হয়েছে",
    pluginNote: "এই Key ও ডোমেইন BSOL WordPress প্লাগিনে বসাতে হবে।",
    genericError: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",
    domainRequired: "ডোমেইন লিখুন।",
    otpTitle: "চেকআউট OTP ভেরিফিকেশন",
    otpDesc: "চালু থাকলে, এই সাইট থেকে আসা প্রতিটি অর্ডারে কাস্টমারের ফোন নম্বর OTP দিয়ে ভেরিফাই করতে হবে। এসএমএস গেটওয়ে ও ব্যালেন্স আগে থেকে কনফিগার থাকতে হবে।",
    connectedSitesTitle: "কানেক্টেড সাইট",
    noSitesYet: "এখনো কোনো সাইট কানেক্ট করা হয়নি।",
    connectFormTitle: "নতুন সাইট কানেক্ট করুন",
  },
  en: {
    pageTitle: "WordPress Connect",
    intro:
      "To connect your WooCommerce site to BSOL, first download the plugin below and install it on WordPress, then generate an API Key for your domain and enter it in the plugin. You can connect more than one site.",
    downloadTitle: "BSOL Connect Plugin",
    downloadDesc: "Download it, then install via WordPress Admin → Plugins → Add New → Upload Plugin.",
    downloadBtn: "Download Plugin",
    loading: "Loading...",
    domainLabel: "Website Domain",
    domainPlaceholder: "example.com",
    generateBtn: "Generate API Key",
    regenerateBtn: "Generate New Key",
    addAnotherBtn: "Connect Another Site",
    generating: "Generating...",
    revokeBtn: "Revoke",
    revoking: "Revoking...",
    regenerateConfirm:
      "This will invalidate this site's current API key — you'll need to update it in the WordPress plugin too. Continue?",
    revokeConfirm: "Revoking this site's API key will stop it from syncing. Continue?",
    statusPending: "Not connected",
    statusConnected: "Connected",
    statusRevoked: "Revoked",
    domainField: "Domain",
    keyField: "API Key",
    lastUsedField: "Last used",
    neverUsed: "Never used",
    saveKeyWarning: "Save this now — it will not be shown again.",
    copyBtn: "Copy",
    copiedBtn: "Copied",
    pluginNote: "Enter this key and domain into the BSOL WordPress plugin.",
    genericError: "Something went wrong, please try again.",
    domainRequired: "Please enter a domain.",
    otpTitle: "Checkout OTP Verification",
    otpDesc:
      "When enabled, every order synced from this site requires the customer's phone number to be OTP-verified. Requires an SMS gateway with sufficient balance already configured.",
    connectedSitesTitle: "Connected Sites",
    noSitesYet: "No sites connected yet.",
    connectFormTitle: "Connect a new site",
  },
};

type Site = {
  id: number;
  platform: string;
  domain: string;
  masked_key: string;
  status: "pending" | "connected" | "revoked";
  last_used_at: string | null;
  created_at: string;
  otp_verification_enabled: boolean;
};

export default function WordpressConnectPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const tr = t[locale];

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [rawKey, setRawKey] = useState<{ domain: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [otpSavingId, setOtpSavingId] = useState<number | null>(null);

  const authHeaders = useCallback(() => {
    const token = getStoredToken();
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/wordpress/api-keys`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setSites(json.data ?? []);
    } catch {
      // silent — panel just stays empty, retry on next visit
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  async function handleConnect() {
    const domain = domainInput.trim();
    if (!domain) {
      setMessage({ type: "error", text: tr.domainRequired });
      return;
    }
    const existing = sites.find((s) => s.domain === domain.replace(/^https?:\/\//, "").replace(/\/$/, ""));
    if (existing && !window.confirm(tr.regenerateConfirm)) return;

    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/wordpress/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (json.success) {
        setRawKey({ domain: json.data.domain, key: json.data.api_key });
        setCopied(false);
        setDomainInput("");
        void loadSites();
      } else {
        setMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setMessage({ type: "error", text: tr.genericError });
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: number) {
    if (!window.confirm(tr.revokeConfirm)) return;

    setRevokingId(id);
    setMessage(null);
    try {
      const res = await fetch(`${API}/wordpress/api-keys/${id}`, { method: "DELETE", headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        void loadSites();
      } else {
        setMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setMessage({ type: "error", text: tr.genericError });
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy() {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey.key);
      setCopied(true);
    } catch {
      // clipboard API unavailable — the key is still visible to copy manually
    }
  }

  async function handleToggleOtp(id: number, next: boolean) {
    setOtpSavingId(id);
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, otp_verification_enabled: next } : s))); // optimistic
    try {
      const res = await fetch(`${API}/wordpress/api-keys/${id}/otp-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (!json.success) {
        setSites((prev) => prev.map((s) => (s.id === id ? { ...s, otp_verification_enabled: !next } : s)));
        setMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setSites((prev) => prev.map((s) => (s.id === id ? { ...s, otp_verification_enabled: !next } : s)));
      setMessage({ type: "error", text: tr.genericError });
    } finally {
      setOtpSavingId(null);
    }
  }

  function statusDot(status: Site["status"]) {
    return status === "connected" ? "bg-green-500" : status === "revoked" ? "bg-red-500" : "bg-[var(--muted)]";
  }

  function statusLabel(status: Site["status"]) {
    return status === "connected" ? tr.statusConnected : status === "revoked" ? tr.statusRevoked : tr.statusPending;
  }

  return (
    <UserShell activeKey="wordpress-connect" defaultExpandedKey="settings" pageTitle={{ bn: tr.pageTitle, en: tr.pageTitle }}>
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-[var(--muted)]">{tr.intro}</p>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{tr.downloadTitle}</h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{tr.downloadDesc}</p>
          </div>
          <a
            href={`${API}/wordpress/plugin-download`}
            download
            className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            {tr.downloadBtn}
          </a>
        </div>

        {message && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              message.type === "success"
                ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                : "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {rawKey && (
          <div className="rounded-xl border border-amber-600/30 bg-amber-600/10 p-4">
            <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">{rawKey.domain}</p>
            <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">{tr.saveKeyWarning}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)]">
                {rawKey.key}
              </code>
              <button
                onClick={() => void handleCopy()}
                className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
              >
                {copied ? tr.copiedBtn : tr.copyBtn}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-400/80">{tr.pluginNote}</p>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">{tr.connectedSitesTitle}</h3>

          {loading ? (
            <p className="text-sm text-[var(--muted)]">{tr.loading}</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{tr.noSitesYet}</p>
          ) : (
            <div className="space-y-3">
              {sites.map((site) => (
                <div key={site.id} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusDot(site.status)}`} />
                    <span className="text-sm font-semibold text-[var(--foreground)]">{site.domain}</span>
                    <span className="text-xs text-[var(--muted)]">— {statusLabel(site.status)}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-[var(--muted)]">{tr.keyField}</p>
                      <p className="font-mono text-[var(--foreground)]">{site.masked_key}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">{tr.lastUsedField}</p>
                      <p className="text-[var(--foreground)]">
                        {site.last_used_at ? new Date(site.last_used_at).toLocaleString() : tr.neverUsed}
                      </p>
                    </div>
                  </div>

                  {site.status !== "revoked" && (
                    <div className="mt-3 flex items-center justify-between gap-4 rounded-lg bg-[var(--background)] p-2.5">
                      <div>
                        <p className="text-xs font-semibold text-[var(--foreground)]">{tr.otpTitle}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">{tr.otpDesc}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={site.otp_verification_enabled}
                        disabled={otpSavingId === site.id}
                        onClick={() => void handleToggleOtp(site.id, !site.otp_verification_enabled)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                          site.otp_verification_enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                            site.otp_verification_enabled ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {site.status !== "revoked" && (
                    <button
                      onClick={() => void handleRevoke(site.id)}
                      disabled={revokingId === site.id}
                      className="mt-3 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-60"
                    >
                      {revokingId === site.id ? tr.revoking : tr.revokeBtn}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">{tr.connectFormTitle}</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{tr.domainLabel}</label>
              <input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder={tr.domainPlaceholder}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
            </div>
            <button
              onClick={() => void handleConnect()}
              disabled={generating}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {generating ? tr.generating : sites.length > 0 ? tr.addAnotherBtn : tr.generateBtn}
            </button>
          </div>
        </div>
      </div>
    </UserShell>
  );
}
