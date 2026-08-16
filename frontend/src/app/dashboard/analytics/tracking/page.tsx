"use client";

import { useCallback, useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "ট্র্যাকিং লগ",
    loading: "লোড হচ্ছে...",

    usageTitle: "ট্র্যাকিং ইভেন্ট ব্যবহার",
    usageToday: "আজকের ব্যবহার",
    usageUnlimited: "আনলিমিটেড",
    usageNotInPackage: "আপনার প্যাকেজে ট্র্যাকিং নেই।",
    usageDropped: "কোটা শেষ হওয়ায় বাদ",
    usageOverage: "লিমিটের বাইরে পাঠানো",
    usageStateOk: "সব ইভেন্ট পাঠানো হচ্ছে।",
    usageStateSampling: "PageView জাতীয় ইভেন্টের অর্ধেক পাঠানো হচ্ছে — কোটা ৬০% পার হয়েছে।",
    usageStateCritical: "PageView বন্ধ, AddToCart/ViewContent-এর অর্ধেক পাঠানো হচ্ছে — কোটা ৮০% পার হয়েছে।",
    usageStateExhausted: "আজকের কোটা শেষ। Purchase ও ডেলিভারি ইভেন্ট এখনো পাঠানো হচ্ছে।",

    matchTitle: "ম্যাচ কোয়ালিটি",
    matchIntro: "সাম্প্রতিক ইভেন্টগুলোর মধ্যে কতগুলোতে Meta-র সবচেয়ে শক্তিশালী ম্যাচ সিগন্যাল ছিল — ব্রাউজার কুকি (fbp/fbc) ও ফোন নম্বর হ্যাশ। উচ্চ হার মানে বিজ্ঞাপন অ্যাট্রিবিউশন তত ভালো।",
    matchSampled: (n: number) => `সাম্প্রতিক ${n}টা ইভেন্ট থেকে হিসাব করা`,
    matchNoSample: "এখনো কোনো ইভেন্ট নেই।",
    matchFbp: "ব্রাউজার কুকি (fbp)",
    matchFbc: "অ্যাড ক্লিক (fbc)",
    matchPhone: "ফোন নম্বর",

    logTitle: "ইভেন্ট লগ",
    filterAllStatus: "সব স্ট্যাটাস",
    statusQueued: "কিউতে",
    statusSent: "পাঠানো হয়েছে",
    statusFailed: "ব্যর্থ",
    statusDuplicate: "ডুপ্লিকেট",
    filterEventName: "ইভেন্টের নাম (যেমন Purchase)",
    colEvent: "ইভেন্ট",
    colTime: "সময়",
    colStatus: "স্ট্যাটাস",
    colDestination: "ডেস্টিনেশন",
    colSource: "উৎস",
    colMatch: "ম্যাচ সিগন্যাল",
    colError: "সমস্যা",
    noEvents: "কোনো ইভেন্ট পাওয়া যায়নি।",
    prevPage: "পূর্ববর্তী",
    nextPage: "পরবর্তী",
    pageOf: (cur: number, last: number) => `${cur} / ${last}`,
  },
  en: {
    pageTitle: "Tracking Log",
    loading: "Loading...",

    usageTitle: "Tracking Event Usage",
    usageToday: "Used today",
    usageUnlimited: "Unlimited",
    usageNotInPackage: "Your package does not include tracking.",
    usageDropped: "Dropped (quota spent)",
    usageOverage: "Sent beyond the limit",
    usageStateOk: "All events are being sent.",
    usageStateSampling: "Half of ambient events like PageView are being sent — past 60% of quota.",
    usageStateCritical: "PageView is off and half of AddToCart/ViewContent is being sent — past 80% of quota.",
    usageStateExhausted: "Today's quota is spent. Purchase and delivery events are still being sent.",

    matchTitle: "Match Quality",
    matchIntro: "Share of recent events carrying Meta's strongest match signals — browser cookies (fbp/fbc) and a hashed phone number. Higher is better ad attribution.",
    matchSampled: (n: number) => `Computed from the latest ${n} events`,
    matchNoSample: "No events yet.",
    matchFbp: "Browser cookie (fbp)",
    matchFbc: "Ad click (fbc)",
    matchPhone: "Phone number",

    logTitle: "Event Log",
    filterAllStatus: "All statuses",
    statusQueued: "Queued",
    statusSent: "Sent",
    statusFailed: "Failed",
    statusDuplicate: "Duplicate",
    filterEventName: "Event name (e.g. Purchase)",
    colEvent: "Event",
    colTime: "Time",
    colStatus: "Status",
    colDestination: "Destination",
    colSource: "Source",
    colMatch: "Match signal",
    colError: "Error",
    noEvents: "No events found.",
    prevPage: "Previous",
    nextPage: "Next",
    pageOf: (cur: number, last: number) => `${cur} / ${last}`,
  },
};

type UsageDay = { date: string; accepted: number; dropped: number; overage: number; sent: number; failed: number };
type TrackingUsage = {
  today: { date: string; limit: number | null; used: number; dropped: number; overage: number; percent: number | null };
  state: "unlimited" | "not_in_package" | "ok" | "sampling" | "critical" | "exhausted";
  history: UsageDay[];
};

type MatchQuality = {
  sampled: number;
  fbp_rate: number | null;
  fbc_rate: number | null;
  phone_rate: number | null;
};

type TrackingEventRow = {
  id: number;
  event_name: string;
  event_time: string;
  status: "queued" | "sent" | "failed" | "duplicate";
  destination: string | null;
  landing_page: string | null;
  site: string | null;
  order_id: number | null;
  has_fbp: boolean;
  has_fbc: boolean;
  error_message: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-yellow-500/15 text-yellow-400",
  sent: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
  duplicate: "bg-zinc-500/15 text-zinc-400",
};

export default function TrackingLogPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const tr = t[locale];

  const [usage, setUsage] = useState<TrackingUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const [events, setEvents] = useState<TrackingEventRow[]>([]);
  const [matchQuality, setMatchQuality] = useState<MatchQuality | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [eventNameFilter, setEventNameFilter] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const authHeaders = useCallback(() => {
    const token = getStoredToken();
    return { Authorization: `Bearer ${token}` };
  }, []);

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

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (eventNameFilter.trim()) params.set("event_name", eventNameFilter.trim());

      const res = await fetch(`${API}/tracking/events?${params.toString()}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setEvents(json.data);
        setMatchQuality(json.match_quality ?? null);
        setLastPage(json.pagination?.last_page ?? 1);
      }
    } catch {
      // silent — table just stays empty, retry on next visit
    } finally {
      setEventsLoading(false);
    }
  }, [authHeaders, page, statusFilter, eventNameFilter]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, eventNameFilter]);

  const statusLabel: Record<string, string> = {
    queued: tr.statusQueued,
    sent: tr.statusSent,
    failed: tr.statusFailed,
    duplicate: tr.statusDuplicate,
  };

  return (
    <UserShell activeKey="tracking-log" defaultExpandedKey="analytics" pageTitle={{ bn: tr.pageTitle, en: tr.pageTitle }}>
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Usage meter — same figures as Marketing → Facebook CAPI, shown here too since staff can open this page without owner-only destination access. */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{tr.usageTitle}</h3>

          {usageLoading && <p className="mt-2 text-sm text-[var(--muted)]">{tr.loading}</p>}

          {!usageLoading && usage && (
            <div className="mt-2 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">{tr.usageToday}</span>
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {usage.today.used.toLocaleString()}
                  {usage.today.limit !== null ? ` / ${usage.today.limit.toLocaleString()}` : ` — ${tr.usageUnlimited}`}
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
                    <span>{tr.usageDropped}: <strong>{usage.today.dropped.toLocaleString()}</strong></span>
                  )}
                  {usage.today.overage > 0 && (
                    <span>{tr.usageOverage}: <strong>{usage.today.overage.toLocaleString()}</strong></span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Match quality */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{tr.matchTitle}</h3>
          <p className="mt-1 mb-3 text-xs text-[var(--muted)]">{tr.matchIntro}</p>

          {matchQuality && matchQuality.sampled > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--muted)]">{tr.matchSampled(matchQuality.sampled)}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: tr.matchFbp, rate: matchQuality.fbp_rate },
                  { label: tr.matchFbc, rate: matchQuality.fbc_rate },
                  { label: tr.matchPhone, rate: matchQuality.phone_rate },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-xs text-[var(--muted)]">{row.label}</p>
                    <p className="text-lg font-semibold text-[var(--foreground)]">
                      {row.rate !== null ? `${Math.round(row.rate * 100)}%` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">{tr.matchNoSample}</p>
          )}
        </div>

        {/* Event log */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{tr.logTitle}</h3>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)]"
              >
                <option value="">{tr.filterAllStatus}</option>
                <option value="queued">{tr.statusQueued}</option>
                <option value="sent">{tr.statusSent}</option>
                <option value="failed">{tr.statusFailed}</option>
                <option value="duplicate">{tr.statusDuplicate}</option>
              </select>
              <input
                value={eventNameFilter}
                onChange={(e) => setEventNameFilter(e.target.value)}
                placeholder={tr.filterEventName}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)]"
              />
            </div>
          </div>

          {eventsLoading ? (
            <p className="text-sm text-[var(--muted)]">{tr.loading}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{tr.noEvents}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="px-2 py-2 font-medium">{tr.colEvent}</th>
                    <th className="px-2 py-2 font-medium">{tr.colTime}</th>
                    <th className="px-2 py-2 font-medium">{tr.colStatus}</th>
                    <th className="px-2 py-2 font-medium">{tr.colDestination}</th>
                    <th className="px-2 py-2 font-medium">{tr.colSource}</th>
                    <th className="px-2 py-2 font-medium">{tr.colMatch}</th>
                    <th className="px-2 py-2 font-medium">{tr.colError}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--border)]/50">
                      <td className="px-2 py-2 font-medium text-[var(--foreground)]">{e.event_name}</td>
                      <td className="px-2 py-2 text-[var(--muted)]">{new Date(e.event_time).toLocaleString()}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[e.status] ?? ""}`}>
                          {statusLabel[e.status] ?? e.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-[var(--muted)]">{e.destination ?? "—"}</td>
                      <td className="px-2 py-2 text-[var(--muted)]">{e.landing_page ?? e.site ?? (e.order_id ? `#${e.order_id}` : "—")}</td>
                      <td className="px-2 py-2 text-[var(--muted)]">
                        {e.has_fbp && <span className="mr-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-400">fbp</span>}
                        {e.has_fbc && <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-400">fbc</span>}
                      </td>
                      <td className="max-w-[220px] truncate px-2 py-2 text-red-500" title={e.error_message ?? undefined}>
                        {e.error_message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lastPage > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-[var(--muted)]">{tr.pageOf(page, lastPage)}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1 || eventsLoading}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
                >
                  {tr.prevPage}
                </button>
                <button
                  disabled={page >= lastPage || eventsLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
                >
                  {tr.nextPage}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}
