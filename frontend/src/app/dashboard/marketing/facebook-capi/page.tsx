"use client";

import { useCallback, useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "Facebook CAPI",
    loading: "লোড হচ্ছে...",
    genericError: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",

    capiTitle: "ট্র্যাকিং ডেস্টিনেশন (Meta Pixel)",
    capiIntro: "চেকআউট সম্পন্ন হলে সার্ভার থেকে সরাসরি Meta-তে Purchase/order ইভেন্ট পাঠানো হয় — বিজ্ঞাপন ক্যাম্পেইন নিজে থেকে অপটিমাইজ হতে সাহায্য করে। একাধিক Pixel থাকলে প্রতিটাকে আলাদা নাম দিয়ে যোগ করুন, চাইলে একটা নির্দিষ্ট ল্যান্ডিং পেজ বা WooCommerce সাইটে পিন করে দিন — না করলে সেটা পুরো দোকানের ডিফল্ট হিসেবে কাজ করবে। Dataset ID এবং Access Token আপনার Meta Events Manager থেকে সংগ্রহ করুন।",
    datasetIdLabel: "Dataset ID (আগের নাম: Pixel ID)",
    accessTokenLabel: "CAPI Access Token",
    accessTokenSetHint: "সেট করা আছে — পরিবর্তন করতে নতুন টোকেন লিখুন",
    accessTokenPlaceholder: "নতুন টোকেন লিখুন (খালি রাখলে অপরিবর্তিত থাকবে)",
    testEventCodeLabel: "Test Event Code (ঐচ্ছিক)",
    enabledLabel: "সক্রিয় করুন",
    saveBtn: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    cancelBtn: "বাতিল",
    editBtn: "এডিট করুন",
    deleteBtn: "মুছে ফেলুন",
    deleting: "মোছা হচ্ছে...",
    deleteConfirm: "এই ডেস্টিনেশনটা মুছে ফেলতে চান? এটা যে পেজ/সাইটে পিন করা ছিল সেখানে ইভেন্ট পাঠানো বন্ধ হয়ে যাবে।",
    testEventBtn: "টেস্ট ইভেন্ট পাঠান",
    testingEvent: "পাঠানো হচ্ছে...",
    lastSentLabel: "সর্বশেষ পাঠানো হয়েছে",
    lastErrorLabel: "সর্বশেষ সমস্যা",
    capiSaveSuccess: "সেভ করা হয়েছে।",
    labelLabel: "নাম (নিজের জন্য, যেমন: Main Pixel)",
    labelPlaceholder: "Default",
    scopeLabel: "কোথায় প্রযোজ্য",
    scopeShopWide: "পুরো দোকান (ডিফল্ট)",
    scopeLandingPage: "একটা নির্দিষ্ট ল্যান্ডিং পেজ",
    scopeSite: "একটা নির্দিষ্ট WooCommerce সাইট",
    selectLandingPage: "ল্যান্ডিং পেজ বেছে নিন",
    selectSite: "সাইট বেছে নিন",
    addDestinationBtn: "+ নতুন ডেস্টিনেশন যোগ করুন",
    noDestinations: "এখনো কোনো ট্র্যাকিং ডেস্টিনেশন যোগ করা হয়নি।",
    shopWideBadge: "পুরো দোকান",

    usageTitle: "ট্র্যাকিং ইভেন্ট ব্যবহার",
    usageIntro: "আপনার প্যাকেজে প্রতিদিন কত ট্র্যাকিং ইভেন্ট পাঠানো যাবে তার হিসাব। দিন গোনা হয় ঢাকা সময় অনুযায়ী।",
    usageToday: "আজকের ব্যবহার",
    usageUnlimited: "আনলিমিটেড",
    usageNotInPackage: "আপনার প্যাকেজে ট্র্যাকিং নেই — আপগ্রেড করুন।",
    usageDropped: "কোটা শেষ হওয়ায় বাদ",
    usageOverage: "লিমিটের বাইরে পাঠানো",
    usageStateOk: "সব ইভেন্ট পাঠানো হচ্ছে।",
    usageStateSampling: "PageView জাতীয় ইভেন্টের অর্ধেক পাঠানো হচ্ছে — কোটা ৬০% পার হয়েছে।",
    usageStateCritical: "PageView বন্ধ, AddToCart/ViewContent-এর অর্ধেক পাঠানো হচ্ছে — কোটা ৮০% পার হয়েছে।",
    usageStateExhausted: "আজকের কোটা শেষ। Purchase ও ডেলিভারি ইভেন্ট এখনো পাঠানো হচ্ছে — বাকিগুলো বন্ধ। আপগ্রেড করলে সব ফিরে আসবে।",
    usageAlwaysSent: "Purchase, OrderConfirmed, OrderDelivered, OrderReturned ও Lead কখনো বাদ যায় না — কোটা শেষ হলেও পাঠানো হয়।",
    usageHistoryTitle: "গত ৭ দিন",
    usageNoHistory: "এখনো কোনো ইভেন্ট পাঠানো হয়নি।",
  },
  en: {
    pageTitle: "Facebook CAPI",
    loading: "Loading...",
    genericError: "Something went wrong, please try again.",

    capiTitle: "Tracking Destinations (Meta Pixel)",
    capiIntro: "When a checkout completes, a server-side Purchase/order event is sent directly to Meta — helps your ad campaigns optimize automatically. If you run more than one Pixel, add each with its own name, optionally pinned to one landing page or WooCommerce site — leave it unpinned and it becomes the shop-wide default. Get the Dataset ID and Access Token from your Meta Events Manager.",
    datasetIdLabel: "Dataset ID (formerly Pixel ID)",
    accessTokenLabel: "CAPI Access Token",
    accessTokenSetHint: "Already set — enter a new token to change it",
    accessTokenPlaceholder: "Enter new token (leave blank to keep unchanged)",
    testEventCodeLabel: "Test Event Code (optional)",
    enabledLabel: "Enable",
    saveBtn: "Save",
    saving: "Saving...",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    deleteBtn: "Delete",
    deleting: "Deleting...",
    deleteConfirm: "Delete this destination? Events will stop reaching whatever page/site it was pinned to.",
    testEventBtn: "Send Test Event",
    testingEvent: "Sending...",
    lastSentLabel: "Last sent",
    lastErrorLabel: "Last issue",
    capiSaveSuccess: "Saved.",
    labelLabel: "Name (for your own reference, e.g. Main Pixel)",
    labelPlaceholder: "Default",
    scopeLabel: "Applies to",
    scopeShopWide: "Whole shop (default)",
    scopeLandingPage: "One specific landing page",
    scopeSite: "One specific WooCommerce site",
    selectLandingPage: "Choose a landing page",
    selectSite: "Choose a site",
    addDestinationBtn: "+ Add destination",
    noDestinations: "No tracking destinations added yet.",
    shopWideBadge: "Whole shop",

    usageTitle: "Tracking Event Usage",
    usageIntro: "How many tracking events your package allows per day. The day is counted in Dhaka time.",
    usageToday: "Used today",
    usageUnlimited: "Unlimited",
    usageNotInPackage: "Your package does not include tracking — upgrade to enable it.",
    usageDropped: "Dropped (quota spent)",
    usageOverage: "Sent beyond the limit",
    usageStateOk: "All events are being sent.",
    usageStateSampling: "Half of ambient events like PageView are being sent — past 60% of quota.",
    usageStateCritical: "PageView is off and half of AddToCart/ViewContent is being sent — past 80% of quota.",
    usageStateExhausted: "Today's quota is spent. Purchase and delivery events are still being sent — the rest are paused. Upgrading restores everything.",
    usageAlwaysSent: "Purchase, OrderConfirmed, OrderDelivered, OrderReturned and Lead are never dropped — they are sent even past the limit.",
    usageHistoryTitle: "Last 7 days",
    usageNoHistory: "No events have been sent yet.",
  },
};

type Scope = "landing_page" | "platform_api_key";

type Destination = {
  id: number;
  label: string;
  pixel_id: string | null;
  access_token_set: boolean;
  test_event_code: string | null;
  enabled: boolean;
  scope_type: Scope | null;
  scope_id: number | null;
  scope_label: string | null;
  last_sent_at: string | null;
  last_error: string | null;
};

type LandingPageOption = { id: number; title: string };
type SiteOption = { id: number; domain: string };

type DestinationDraft = {
  label: string;
  pixelId: string;
  accessToken: string;
  testEventCode: string;
  enabled: boolean;
  scopeType: Scope | "";
  scopeId: string;
};

type UsageDay = {
  date: string;
  accepted: number;
  dropped: number;
  overage: number;
  sent: number;
  failed: number;
};

type TrackingUsage = {
  today: { date: string; limit: number | null; used: number; dropped: number; overage: number; percent: number | null };
  state: "unlimited" | "not_in_package" | "ok" | "sampling" | "critical" | "exhausted";
  history: UsageDay[];
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const tr = t[locale];

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [savingId, setSavingId] = useState<number | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [pixelMessage, setPixelMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [usage, setUsage] = useState<TrackingUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const authHeaders = useCallback(() => {
    const token = getStoredToken();
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadDestinations = useCallback(async () => {
    setDestinationsLoading(true);
    try {
      const res = await fetch(`${API}/tracking/destinations`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setDestinations(json.data);
    } catch {
      // silent — list just stays empty, retry on next visit
    } finally {
      setDestinationsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadDestinations();
  }, [loadDestinations]);

  // Options for the scope picker — fetched once, reusing the same
  // endpoints the landing-pages and WordPress-settings dashboards already
  // call, not a new tracking-specific list.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/landing/pages?per_page=100`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success) {
          setLandingPages(json.data.map((p: { id: number; title: string }) => ({ id: p.id, title: p.title })));
        }
      } catch {
        // silent — the picker just shows no landing-page options
      }
    })();
    (async () => {
      try {
        const res = await fetch(`${API}/wordpress/api-keys`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success) {
          setSites(json.data.map((k: { id: number; domain: string }) => ({ id: k.id, domain: k.domain })));
        }
      } catch {
        // silent — the picker just shows no site options
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No setUsageLoading(true) here: the state starts true and mount is the
  // only caller, so a redundant opening set adds nothing here.
  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tracking/usage`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setUsage(json.data);
    } catch {
      // silent — the meter just stays empty, retry on next visit
    } finally {
      setUsageLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  async function handleSaveDestination(id: number | "new", draft: DestinationDraft) {
    setSavingId(id);
    setPixelMessage(null);
    try {
      const res = await fetch(id === "new" ? `${API}/tracking/destinations` : `${API}/tracking/destinations/${id}`, {
        method: id === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          label: draft.label || "Default",
          pixel_id: draft.pixelId,
          access_token: draft.accessToken || undefined,
          test_event_code: draft.testEventCode,
          enabled: draft.enabled,
          ...(draft.scopeType
            ? { scope_type: draft.scopeType, scope_id: draft.scopeId ? Number(draft.scopeId) : undefined }
            : {}),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingId(null);
        setPixelMessage({ type: "success", text: tr.capiSaveSuccess });
        void loadDestinations();
      } else {
        setPixelMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setPixelMessage({ type: "error", text: tr.genericError });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteDestination(id: number) {
    if (!window.confirm(tr.deleteConfirm)) return;
    setDeletingId(id);
    setPixelMessage(null);
    try {
      const res = await fetch(`${API}/tracking/destinations/${id}`, { method: "DELETE", headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        void loadDestinations();
      } else {
        setPixelMessage({ type: "error", text: json.message ?? tr.genericError });
      }
    } catch {
      setPixelMessage({ type: "error", text: tr.genericError });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTestDestination(id: number) {
    setTestingId(id);
    setPixelMessage(null);
    try {
      const res = await fetch(`${API}/tracking/destinations/${id}/test-event`, { method: "POST", headers: authHeaders() });
      const json = await res.json();
      setPixelMessage({ type: json.success ? "success" : "error", text: json.message ?? tr.genericError });
      void loadDestinations();
    } catch {
      setPixelMessage({ type: "error", text: tr.genericError });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <UserShell activeKey="facebook-capi" defaultExpandedKey="marketing" pageTitle={{ bn: tr.pageTitle, en: tr.pageTitle }}>
      <div className="mx-auto max-w-2xl space-y-4">
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

          {destinationsLoading ? (
            <p className="text-sm text-[var(--muted)]">{tr.loading}</p>
          ) : (
            <div className="space-y-3">
              {destinations.length === 0 && editingId !== "new" && (
                <p className="text-sm text-[var(--muted)]">{tr.noDestinations}</p>
              )}

              {destinations.map((destination) =>
                editingId === destination.id ? (
                  <DestinationEditor
                    key={destination.id}
                    tr={tr}
                    initial={destination}
                    landingPages={landingPages}
                    sites={sites}
                    saving={savingId === destination.id}
                    onCancel={() => setEditingId(null)}
                    onSave={(draft) => void handleSaveDestination(destination.id, draft)}
                  />
                ) : (
                  <div key={destination.id} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${destination.enabled ? "bg-green-500" : "bg-[var(--muted)]"}`} />
                        <span className="text-sm font-semibold text-[var(--foreground)]">{destination.label}</span>
                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                          {destination.scope_label ?? tr.shopWideBadge}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setEditingId(destination.id)}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
                        >
                          {tr.editBtn}
                        </button>
                        <button
                          onClick={() => void handleTestDestination(destination.id)}
                          disabled={testingId === destination.id || !destination.pixel_id || !destination.access_token_set}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-60"
                        >
                          {testingId === destination.id ? tr.testingEvent : tr.testEventBtn}
                        </button>
                        <button
                          onClick={() => void handleDeleteDestination(destination.id)}
                          disabled={deletingId === destination.id}
                          className="rounded-lg border border-red-600/30 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-600/10 disabled:opacity-60 dark:text-red-400"
                        >
                          {deletingId === destination.id ? tr.deleting : tr.deleteBtn}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      <p className="text-[var(--muted)]">
                        {tr.datasetIdLabel}: <span className="text-[var(--foreground)]">{destination.pixel_id ?? "—"}</span>
                      </p>
                      {destination.last_sent_at && (
                        <p className="text-[var(--muted)]">
                          {tr.lastSentLabel}: {new Date(destination.last_sent_at).toLocaleString()}
                        </p>
                      )}
                      {destination.last_error && (
                        <p className="text-red-600 sm:col-span-2">{tr.lastErrorLabel}: {destination.last_error}</p>
                      )}
                    </div>
                  </div>
                ),
              )}

              {editingId === "new" ? (
                <DestinationEditor
                  tr={tr}
                  initial={null}
                  landingPages={landingPages}
                  sites={sites}
                  saving={savingId === "new"}
                  onCancel={() => setEditingId(null)}
                  onSave={(draft) => void handleSaveDestination("new", draft)}
                />
              ) : (
                <button
                  onClick={() => setEditingId("new")}
                  className="rounded-lg border border-dashed border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)]"
                >
                  {tr.addDestinationBtn}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{tr.usageTitle}</h3>
          <p className="mt-1 mb-3 text-xs text-[var(--muted)]">{tr.usageIntro}</p>

          {usageLoading && <p className="text-sm text-[var(--muted)]">{tr.loading}</p>}

          {!usageLoading && usage && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">{tr.usageToday}</span>
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {usage.today.used.toLocaleString()}
                  {usage.today.limit !== null
                    ? ` / ${usage.today.limit.toLocaleString()}`
                    : ` — ${tr.usageUnlimited}`}
                </span>
              </div>

              {usage.today.percent !== null && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--background)]">
                  <div
                    className={`h-full rounded-full ${
                      usage.state === "exhausted"
                        ? "bg-red-500"
                        : usage.state === "critical"
                          ? "bg-orange-500"
                          : usage.state === "sampling"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                    }`}
                    style={{ width: `${usage.today.percent}%` }}
                  />
                </div>
              )}

              <p
                className={`text-xs ${
                  usage.state === "exhausted" || usage.state === "not_in_package"
                    ? "text-red-600 dark:text-red-400"
                    : usage.state === "critical"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-[var(--muted)]"
                }`}
              >
                {usage.state === "not_in_package"
                  ? tr.usageNotInPackage
                  : usage.state === "exhausted"
                    ? tr.usageStateExhausted
                    : usage.state === "critical"
                      ? tr.usageStateCritical
                      : usage.state === "sampling"
                        ? tr.usageStateSampling
                        : tr.usageStateOk}
              </p>

              {(usage.today.dropped > 0 || usage.today.overage > 0) && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--muted)]">
                  {usage.today.dropped > 0 && (
                    <span>
                      {tr.usageDropped}: <strong>{usage.today.dropped.toLocaleString()}</strong>
                    </span>
                  )}
                  {usage.today.overage > 0 && (
                    <span>
                      {tr.usageOverage}: <strong>{usage.today.overage.toLocaleString()}</strong>
                    </span>
                  )}
                </div>
              )}

              <p className="border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                {tr.usageAlwaysSent}
              </p>

              <div>
                <h4 className="mb-2 text-xs font-semibold text-[var(--foreground)]">{tr.usageHistoryTitle}</h4>
                {usage.history.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">{tr.usageNoHistory}</p>
                ) : (
                  <div className="space-y-1">
                    {usage.history.slice(0, 7).map((day) => (
                      <div key={day.date} className="flex justify-between gap-3 text-xs">
                        <span className="text-[var(--muted)]">{day.date}</span>
                        <span className="text-[var(--foreground)]">
                          {day.accepted.toLocaleString()}
                          {day.dropped > 0 && (
                            <span className="ml-2 text-[var(--muted)]">
                              (−{day.dropped.toLocaleString()})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}

function DestinationEditor({
  tr,
  initial,
  landingPages,
  sites,
  saving,
  onCancel,
  onSave,
}: {
  tr: typeof t.bn;
  initial: Destination | null;
  landingPages: LandingPageOption[];
  sites: SiteOption[];
  saving: boolean;
  onCancel: () => void;
  onSave: (draft: DestinationDraft) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [pixelId, setPixelId] = useState(initial?.pixel_id ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState(initial?.test_event_code ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [scopeType, setScopeType] = useState<Scope | "">(initial?.scope_type ?? "");
  const [scopeId, setScopeId] = useState(initial?.scope_id ? String(initial.scope_id) : "");

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";

  return (
    <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--background)] p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]">{tr.labelLabel}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tr.labelPlaceholder} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]">{tr.datasetIdLabel}</label>
          <input value={pixelId} onChange={(e) => setPixelId(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]">{tr.accessTokenLabel}</label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={initial?.access_token_set ? tr.accessTokenSetHint : tr.accessTokenPlaceholder}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]">{tr.testEventCodeLabel}</label>
          <input value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} className={inputClass} />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-[var(--muted)]">{tr.scopeLabel}</label>
          <select
            value={scopeType}
            onChange={(e) => {
              setScopeType(e.target.value as Scope | "");
              setScopeId("");
            }}
            className={inputClass}
          >
            <option value="">{tr.scopeShopWide}</option>
            <option value="landing_page">{tr.scopeLandingPage}</option>
            <option value="platform_api_key">{tr.scopeSite}</option>
          </select>
        </div>

        {scopeType === "landing_page" && (
          <div className="sm:col-span-2">
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className={inputClass}>
              <option value="">{tr.selectLandingPage}</option>
              {landingPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {scopeType === "platform_api_key" && (
          <div className="sm:col-span-2">
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className={inputClass}>
              <option value="">{tr.selectSite}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.domain}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 self-end pb-2 text-sm text-[var(--foreground)]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          {tr.enabledLabel}
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onSave({ label, pixelId, accessToken, testEventCode, enabled, scopeType, scopeId })}
          disabled={saving || (Boolean(scopeType) && !scopeId)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? tr.saving : tr.saveBtn}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
        >
          {tr.cancelBtn}
        </button>
      </div>
    </div>
  );
}
