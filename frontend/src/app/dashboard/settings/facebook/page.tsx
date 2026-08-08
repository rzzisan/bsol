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
    connectAnotherBtn: "আরেকটি Page কানেক্ট করুন",
    connecting: "কানেক্ট হচ্ছে...",
    disconnectBtn: "ডিসকানেক্ট করুন",
    disconnecting: "ডিসকানেক্ট হচ্ছে...",
    selectPageTitle: "একাধিক Page পাওয়া গেছে, যেগুলো কানেক্ট করবেন বেছে নিন",
    selectBtn: "নির্বাচিতগুলো কানেক্ট করুন",
    selecting: "কানেক্ট হচ্ছে...",
    connectedPagesTitle: "কানেক্টেড Pages",
    notConfigured: "সার্ভারে এখনো Facebook App কনফিগার করা হয়নি — এডমিনকে জানান।",
    genericError: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",
    disconnectSuccess: "Facebook Page ডিসকানেক্ট করা হয়েছে।",
    connectSuccess: "Facebook Page সফলভাবে কানেক্ট হয়েছে।",

    capiTitle: "Conversions API (বিজ্ঞাপন ট্র্যাকিং)",
    capiIntro: "ল্যান্ডিং পেজ চেকআউট সম্পন্ন হলে সার্ভার থেকে সরাসরি আপনার নিজের Facebook Pixel-এ Purchase ইভেন্ট পাঠানো হবে — বিজ্ঞাপন ক্যাম্পেইন নিজে থেকে অপটিমাইজ হতে সাহায্য করে। Pixel ID এবং Access Token আপনার Meta Events Manager থেকে সংগ্রহ করুন।",
    pixelIdLabel: "Pixel ID",
    accessTokenLabel: "CAPI Access Token",
    accessTokenSetHint: "সেট করা আছে — পরিবর্তন করতে নতুন টোকেন লিখুন",
    accessTokenPlaceholder: "নতুন টোকেন লিখুন (খালি রাখলে অপরিবর্তিত থাকবে)",
    testEventCodeLabel: "Test Event Code (ঐচ্ছিক)",
    enabledLabel: "সক্রিয় করুন",
    saveBtn: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    testEventBtn: "টেস্ট ইভেন্ট পাঠান",
    testingEvent: "পাঠানো হচ্ছে...",
    lastSentLabel: "সর্বশেষ পাঠানো হয়েছে",
    lastErrorLabel: "সর্বশেষ সমস্যা",
    capiSaveSuccess: "সেভ করা হয়েছে।",
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
    connectAnotherBtn: "Connect Another Page",
    connecting: "Connecting...",
    disconnectBtn: "Disconnect",
    disconnecting: "Disconnecting...",
    selectPageTitle: "Multiple Pages found — pick which ones to connect",
    selectBtn: "Connect Selected",
    selecting: "Connecting...",
    connectedPagesTitle: "Connected Pages",
    notConfigured: "Facebook App is not configured on the server yet — contact the admin.",
    genericError: "Something went wrong, please try again.",
    disconnectSuccess: "Facebook Page disconnected.",
    connectSuccess: "Facebook Page connected successfully.",

    capiTitle: "Conversions API (Ad Tracking)",
    capiIntro: "When a landing-page checkout completes, a server-side Purchase event is sent directly to your own Facebook Pixel — helps your ad campaigns optimize automatically. Get the Pixel ID and Access Token from your Meta Events Manager.",
    pixelIdLabel: "Pixel ID",
    accessTokenLabel: "CAPI Access Token",
    accessTokenSetHint: "Already set — enter a new token to change it",
    accessTokenPlaceholder: "Enter new token (leave blank to keep unchanged)",
    testEventCodeLabel: "Test Event Code (optional)",
    enabledLabel: "Enable",
    saveBtn: "Save",
    saving: "Saving...",
    testEventBtn: "Send Test Event",
    testingEvent: "Sending...",
    lastSentLabel: "Last sent",
    lastErrorLabel: "Last issue",
    capiSaveSuccess: "Saved.",
  },
};

type Connection = {
  id: number;
  page_name: string | null;
  fb_page_id: string;
  connected_at: string;
  webhook_subscribed: boolean;
};

type Status = {
  connected: boolean;
  data: Connection[];
};

type PendingPage = { id: string; name: string };

type PixelSettings = {
  pixel_id: string | null;
  access_token_set: boolean;
  test_event_code: string | null;
  enabled: boolean;
  last_sent_at: string | null;
  last_error: string | null;
};

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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const [pendingPages, setPendingPages] = useState<PendingPage[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);

  const [pixel, setPixel] = useState<PixelSettings | null>(null);
  const [pixelLoading, setPixelLoading] = useState(true);
  const [pixelIdInput, setPixelIdInput] = useState("");
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [testEventCodeInput, setTestEventCodeInput] = useState("");
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [pixelSaving, setPixelSaving] = useState(false);
  const [pixelTesting, setPixelTesting] = useState(false);
  const [pixelMessage, setPixelMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const loadPixel = useCallback(async () => {
    setPixelLoading(true);
    try {
      const res = await fetch(`${API}/facebook/pixel`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setPixel(json.data);
        setPixelIdInput(json.data.pixel_id ?? "");
        setTestEventCodeInput(json.data.test_event_code ?? "");
        setPixelEnabled(json.data.enabled);
      }
    } catch {
      // silent — panel just stays empty, retry on next visit
    } finally {
      setPixelLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadPixel();
  }, [loadPixel]);

  async function handleSavePixel() {
    setPixelSaving(true);
    setPixelMessage(null);
    try {
      const res = await fetch(`${API}/facebook/pixel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          pixel_id: pixelIdInput,
          access_token: accessTokenInput || undefined,
          test_event_code: testEventCodeInput,
          enabled: pixelEnabled,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPixel(json.data);
        setAccessTokenInput("");
        setPixelMessage({ type: "success", text: tr.capiSaveSuccess });
      } else {
        setPixelMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setPixelMessage({ type: "error", text: tr.genericError });
    } finally {
      setPixelSaving(false);
    }
  }

  async function handleTestEvent() {
    setPixelTesting(true);
    setPixelMessage(null);
    try {
      const res = await fetch(`${API}/facebook/pixel/test-event`, { method: "POST", headers: authHeaders() });
      const json = await res.json();
      setPixelMessage({ type: json.success ? "success" : "error", text: json.message ?? tr.genericError });
      void loadPixel();
    } catch {
      setPixelMessage({ type: "error", text: tr.genericError });
    } finally {
      setPixelTesting(false);
    }
  }

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
          setSelectedPageIds(new Set<string>(json.data.map((p: PendingPage) => p.id)));
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

  function togglePendingPage(pageId: string) {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  async function handleConnectSelected() {
    if (!pendingSession || selectedPageIds.size === 0) return;
    setSelecting(true);
    try {
      const res = await fetch(`${API}/facebook/connect/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ session: pendingSession, page_ids: Array.from(selectedPageIds) }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: json.message || tr.connectSuccess });
        setPendingSession(null);
        setPendingPages([]);
        setSelectedPageIds(new Set());
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

  async function handleDisconnect(id: number) {
    setDisconnectingId(id);
    setMessage(null);
    try {
      const res = await fetch(`${API}/facebook/connect/${id}`, { method: "DELETE", headers: authHeaders() });
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
      setDisconnectingId(null);
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
                <label
                  key={page.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPageIds.has(page.id)}
                    onChange={() => togglePendingPage(page.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--foreground)]">{page.name}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => void handleConnectSelected()}
              disabled={selecting || selectedPageIds.size === 0}
              className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {selecting ? tr.selecting : tr.selectBtn}
            </button>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">{tr.loading}</p>
          ) : status?.connected && status.data.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{tr.connectedPagesTitle}</h3>
              {status.data.map((connection) => (
                <div key={connection.id} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {connection.page_name ?? connection.fb_page_id}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-[var(--muted)]">{tr.connectedAt}</p>
                      <p className="text-[var(--foreground)]">{new Date(connection.connected_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">{tr.webhookStatus}</p>
                      <p className={connection.webhook_subscribed ? "text-green-600" : "text-amber-600"}>
                        {connection.webhook_subscribed ? tr.webhookActive : tr.webhookInactive}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => void handleDisconnect(connection.id)}
                    disabled={disconnectingId === connection.id}
                    className="mt-3 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-60"
                  >
                    {disconnectingId === connection.id ? tr.disconnecting : tr.disconnectBtn}
                  </button>
                </div>
              ))}
              <button
                onClick={() => void handleConnect()}
                disabled={connecting}
                className="rounded-lg border border-dashed border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:opacity-60"
              >
                {connecting ? tr.connecting : tr.connectAnotherBtn}
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

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{tr.capiTitle}</h3>
          <p className="mt-1 mb-3 text-xs text-[var(--muted)]">{tr.capiIntro}</p>

          {pixelMessage && (
            <div
              className={`mb-3 rounded-lg border p-3 text-sm ${
                pixelMessage.type === "success"
                  ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                  : "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400"
              }`}
            >
              {pixelMessage.text}
            </div>
          )}

          {pixelLoading ? (
            <p className="text-sm text-[var(--muted)]">{tr.loading}</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted)]">{tr.pixelIdLabel}</label>
                  <input
                    value={pixelIdInput}
                    onChange={(e) => setPixelIdInput(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted)]">{tr.accessTokenLabel}</label>
                  <input
                    type="password"
                    value={accessTokenInput}
                    onChange={(e) => setAccessTokenInput(e.target.value)}
                    placeholder={pixel?.access_token_set ? tr.accessTokenSetHint : tr.accessTokenPlaceholder}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted)]">{tr.testEventCodeLabel}</label>
                  <input
                    value={testEventCodeInput}
                    onChange={(e) => setTestEventCodeInput(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={pixelEnabled}
                    onChange={(e) => setPixelEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {tr.enabledLabel}
                </label>
              </div>

              {pixel && (pixel.last_sent_at || pixel.last_error) && (
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  {pixel.last_sent_at && (
                    <p className="text-[var(--muted)]">
                      {tr.lastSentLabel}: {new Date(pixel.last_sent_at).toLocaleString()}
                    </p>
                  )}
                  {pixel.last_error && <p className="text-red-600">{tr.lastErrorLabel}: {pixel.last_error}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handleSavePixel()}
                  disabled={pixelSaving}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {pixelSaving ? tr.saving : tr.saveBtn}
                </button>
                <button
                  onClick={() => void handleTestEvent()}
                  disabled={pixelTesting || !pixel?.pixel_id || !pixel?.access_token_set}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-60"
                >
                  {pixelTesting ? tr.testingEvent : tr.testEventBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}
