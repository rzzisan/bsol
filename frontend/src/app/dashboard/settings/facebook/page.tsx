"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "ফেসবুক পেজ",
    intro: "আপনার Facebook Page কানেক্ট করলে পেজের কমেন্ট এবং ইনবক্স মেসেজ থেকে অটোমেটিক লিড ক্যাপচার হবে — Leads ইনবক্সে দেখা যাবে।",
    loading: "লোড হচ্ছে...",
    connected: "কানেক্টেড",
    notConnected: "কানেক্টেড নয়",
    pageName: "পেজ",
    connectedAt: "কানেক্ট হয়েছে",
    webhookStatus: "লিড ক্যাপচার",
    webhookActive: "সক্রিয়",
    webhookInactive: "সমস্যা আছে — পুনরায় কানেক্ট করুন",
    connectBtn: "Facebook Page কানেক্ট করুন",
    connecting: "কানেক্ট হচ্ছে...",
    disconnectBtn: "ডিসকানেক্ট করুন",
    disconnecting: "ডিসকানেক্ট হচ্ছে...",
    selectPageTitle: "একাধিক Page পাওয়া গেছে, একটি নির্বাচন করুন",
    selectBtn: "কানেক্ট করুন",
    selecting: "কানেক্ট হচ্ছে...",
    notConfigured: "সার্ভারে এখনো Facebook App কনফিগার করা হয়নি — এডমিনকে জানান।",
    genericError: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",
    disconnectSuccess: "Facebook Page ডিসকানেক্ট করা হয়েছে।",
    connectSuccess: "Facebook Page সফলভাবে কানেক্ট হয়েছে।",
  },
  en: {
    pageTitle: "Facebook Page",
    intro: "Connecting your Facebook Page auto-captures leads from Page comments and inbox messages — view them in the Leads inbox.",
    loading: "Loading...",
    connected: "Connected",
    notConnected: "Not connected",
    pageName: "Page",
    connectedAt: "Connected on",
    webhookStatus: "Lead capture",
    webhookActive: "Active",
    webhookInactive: "Issue detected — please reconnect",
    connectBtn: "Connect Facebook Page",
    connecting: "Connecting...",
    disconnectBtn: "Disconnect",
    disconnecting: "Disconnecting...",
    selectPageTitle: "Multiple Pages found, pick one",
    selectBtn: "Connect",
    selecting: "Connecting...",
    notConfigured: "Facebook App is not configured on the server yet — contact the admin.",
    genericError: "Something went wrong, please try again.",
    disconnectSuccess: "Facebook Page disconnected.",
    connectSuccess: "Facebook Page connected successfully.",
  },
};

type Status = {
  connected: boolean;
  data?: {
    page_name: string | null;
    fb_page_id: string;
    connected_at: string;
    webhook_subscribed: boolean;
  };
};

type PendingPage = { id: string; name: string };

export default function Page() {
  return (
    <Suspense>
      <FacebookSettingsPage />
    </Suspense>
  );
}

function FacebookSettingsPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const tr = t[locale];
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const [pendingPages, setPendingPages] = useState<PendingPage[]>([]);
  const [selecting, setSelecting] = useState(false);

  const authHeaders = useCallback(() => {
    const token = getStoredToken();
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/facebook/connect/status`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setStatus(json);
    } catch {
      // silent — status panel just stays empty, retry happens on next visit
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const fbError = searchParams.get("fb_error");
    const connected = searchParams.get("connected");
    const selectSession = searchParams.get("select_session");

    if (fbError) {
      setMessage({ type: "error", text: decodeURIComponent(fbError) });
    } else if (connected) {
      setMessage({ type: "success", text: tr.connectSuccess });
      void loadStatus();
    } else if (selectSession) {
      setPendingSession(selectSession);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!pendingSession) return;
    (async () => {
      try {
        const res = await fetch(`${API}/facebook/connect/pending-pages?session=${encodeURIComponent(pendingSession)}`, {
          headers: authHeaders(),
        });
        const json = await res.json();
        if (json.success) {
          setPendingPages(json.data);
        } else {
          setMessage({ type: "error", text: json.message ?? tr.genericError });
          setPendingSession(null);
        }
      } catch {
        setMessage({ type: "error", text: tr.genericError });
        setPendingSession(null);
      }
    })();
  }, [pendingSession, authHeaders, tr.genericError]);

  async function handleConnect() {
    setConnecting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/facebook/connect/redirect`, { headers: authHeaders() });
      const json = await res.json();
      if (!json.success) {
        setMessage({ type: "error", text: json.message ?? tr.notConfigured });
        setConnecting(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setMessage({ type: "error", text: tr.genericError });
      setConnecting(false);
    }
  }

  async function handleSelectPage(pageId: string) {
    if (!pendingSession) return;
    setSelecting(true);
    try {
      const res = await fetch(`${API}/facebook/connect/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ session: pendingSession, page_id: pageId }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: tr.connectSuccess });
        setPendingSession(null);
        setPendingPages([]);
        void loadStatus();
      } else {
        setMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setMessage({ type: "error", text: tr.genericError });
    } finally {
      setSelecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/facebook/connect`, { method: "DELETE", headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: tr.disconnectSuccess });
        void loadStatus();
      } else {
        setMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setMessage({ type: "error", text: tr.genericError });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <UserShell activeKey="facebook-connect" defaultExpandedKey="settings" pageTitle={{ bn: tr.pageTitle, en: tr.pageTitle }}>
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-[var(--muted)]">{tr.intro}</p>

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

        {pendingSession && pendingPages.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">{tr.selectPageTitle}</h3>
            <div className="space-y-2">
              {pendingPages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3"
                >
                  <span className="text-sm text-[var(--foreground)]">{page.name}</span>
                  <button
                    onClick={() => void handleSelectPage(page.id)}
                    disabled={selecting}
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {selecting ? tr.selecting : tr.selectBtn}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">{tr.loading}</p>
          ) : status?.connected && status.data ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm font-semibold text-[var(--foreground)]">{tr.connected}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[var(--muted)]">{tr.pageName}</p>
                  <p className="text-[var(--foreground)]">{status.data.page_name ?? status.data.fb_page_id}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{tr.connectedAt}</p>
                  <p className="text-[var(--foreground)]">{new Date(status.data.connected_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{tr.webhookStatus}</p>
                  <p className={status.data.webhook_subscribed ? "text-green-600" : "text-amber-600"}>
                    {status.data.webhook_subscribed ? tr.webhookActive : tr.webhookInactive}
                  </p>
                </div>
              </div>
              <button
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-60"
              >
                {disconnecting ? tr.disconnecting : tr.disconnectBtn}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]" />
                <span className="text-sm font-semibold text-[var(--foreground)]">{tr.notConnected}</span>
              </div>
              <button
                onClick={() => void handleConnect()}
                disabled={connecting}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {connecting ? tr.connecting : tr.connectBtn}
              </button>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}
