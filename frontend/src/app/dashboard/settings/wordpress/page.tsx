"use client";

import { useCallback, useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "ওয়ার্ডপ্রেস কানেক্ট",
    intro:
      "আপনার WooCommerce ওয়েবসাইট BSOL-এর সাথে কানেক্ট করতে প্রথমে নিচে থেকে প্লাগিন ডাউনলোড করে WordPress-এ ইনস্টল করুন, তারপর আপনার ডোমেইন দিয়ে একটি API Key তৈরি করে প্লাগিনে বসান।",
    downloadTitle: "BSOL Connect প্লাগিন",
    downloadDesc: "ডাউনলোড করে WordPress Admin → Plugins → Add New → Upload Plugin থেকে ইনস্টল করুন।",
    downloadBtn: "প্লাগিন ডাউনলোড করুন",
    loading: "লোড হচ্ছে...",
    domainLabel: "ওয়েবসাইট ডোমেইন",
    domainPlaceholder: "example.com",
    generateBtn: "API Key তৈরি করুন",
    regenerateBtn: "নতুন Key তৈরি করুন",
    generating: "তৈরি হচ্ছে...",
    revokeBtn: "বাতিল করুন",
    revoking: "বাতিল হচ্ছে...",
    regenerateConfirm:
      "এটি বর্তমান API Key অকার্যকর করে দেবে — WordPress প্লাগিনেও নতুন Key বসাতে হবে। চালিয়ে যাবেন?",
    revokeConfirm: "API Key বাতিল করলে প্লাগিন থেকে সিঙ্ক বন্ধ হয়ে যাবে। চালিয়ে যাবেন?",
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
  },
  en: {
    pageTitle: "WordPress Connect",
    intro:
      "To connect your WooCommerce site to BSOL, first download the plugin below and install it on WordPress, then generate an API Key for your domain and enter it in the plugin.",
    downloadTitle: "BSOL Connect Plugin",
    downloadDesc: "Download it, then install via WordPress Admin → Plugins → Add New → Upload Plugin.",
    downloadBtn: "Download Plugin",
    loading: "Loading...",
    domainLabel: "Website Domain",
    domainPlaceholder: "example.com",
    generateBtn: "Generate API Key",
    regenerateBtn: "Generate New Key",
    generating: "Generating...",
    revokeBtn: "Revoke",
    revoking: "Revoking...",
    regenerateConfirm:
      "This will invalidate the current API key — you'll need to update it in the WordPress plugin too. Continue?",
    revokeConfirm: "Revoking the API key will stop the plugin from syncing. Continue?",
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
  },
};

type ApiKeyStatus = {
  platform: string;
  domain: string;
  masked_key: string;
  status: "pending" | "connected" | "revoked";
  last_used_at: string | null;
  created_at: string;
};

export default function WordpressConnectPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const tr = t[locale];

  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const authHeaders = useCallback(() => {
    const token = getStoredToken();
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/wordpress/api-key`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setStatus(json.data);
        if (json.data?.domain) setDomainInput(json.data.domain);
      }
    } catch {
      // silent — panel just stays empty, retry on next visit
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleGenerate() {
    if (!domainInput.trim()) {
      setMessage({ type: "error", text: tr.domainRequired });
      return;
    }
    if (status && !window.confirm(tr.regenerateConfirm)) return;

    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/wordpress/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setRawKey(json.data.api_key);
        setCopied(false);
        void loadStatus();
      } else {
        setMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setMessage({ type: "error", text: tr.genericError });
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    if (!window.confirm(tr.revokeConfirm)) return;

    setRevoking(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/wordpress/api-key`, { method: "DELETE", headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setRawKey(null);
        void loadStatus();
      } else {
        setMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setMessage({ type: "error", text: tr.genericError });
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
    } catch {
      // clipboard API unavailable — the key is still visible to copy manually
    }
  }

  const statusDot =
    status?.status === "connected"
      ? "bg-green-500"
      : status?.status === "revoked"
        ? "bg-red-500"
        : "bg-[var(--muted)]";

  const statusLabel =
    status?.status === "connected"
      ? tr.statusConnected
      : status?.status === "revoked"
        ? tr.statusRevoked
        : tr.statusPending;

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
            <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">{tr.saveKeyWarning}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)]">
                {rawKey}
              </code>
              <button
                onClick={() => void handleCopy()}
                className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
              >
                {copied ? tr.copiedBtn : tr.copyBtn}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">{tr.loading}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
                <span className="text-sm font-semibold text-[var(--foreground)]">{statusLabel}</span>
              </div>

              {status && (
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-[var(--muted)]">{tr.domainField}</p>
                    <p className="text-[var(--foreground)]">{status.domain}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">{tr.keyField}</p>
                    <p className="font-mono text-[var(--foreground)]">{status.masked_key}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">{tr.lastUsedField}</p>
                    <p className="text-[var(--foreground)]">
                      {status.last_used_at ? new Date(status.last_used_at).toLocaleString() : tr.neverUsed}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">{tr.domainLabel}</label>
                <input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder={tr.domainPlaceholder}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handleGenerate()}
                  disabled={generating}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {generating ? tr.generating : status ? tr.regenerateBtn : tr.generateBtn}
                </button>
                {status && status.status !== "revoked" && (
                  <button
                    onClick={() => void handleRevoke()}
                    disabled={revoking}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-60"
                  >
                    {revoking ? tr.revoking : tr.revokeBtn}
                  </button>
                )}
              </div>

              <p className="text-xs text-[var(--muted)]">{tr.pluginNote}</p>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}
