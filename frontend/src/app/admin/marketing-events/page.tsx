"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CatvShell from "@/components/catv-shell";
import { buildAdminMenu } from "@/lib/admin-menu";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  LOCALE_STORAGE_KEY,
  normalizeRole,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const labels = {
  bn: {
    title: "মার্কেটিং ইভেন্ট লগ",
    subtitle: "BSOL নিজের অ্যাকুইজিশন ফানেলের CompleteRegistration/Subscribe ইভেন্ট — সেলারদের নিজের ট্র্যাকিং লগ থেকে আলাদা। platform_marketing_tracking_context.md।",
    loginRequired: "অ্যাডমিন হিসেবে লগইন করুন",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজে প্রবেশ করতে পারবেন",
    goHome: "হোমে যান",
    loading: "লোড হচ্ছে...",
    matchTitle: "ম্যাচ কোয়ালিটি",
    matchIntro: "সাম্প্রতিক ইভেন্টগুলোর মধ্যে কতগুলোতে Meta-র সবচেয়ে শক্তিশালী ম্যাচ সিগন্যাল ছিল — ব্রাউজার কুকি (fbp/fbc) ও ফোন নম্বর হ্যাশ।",
    matchSampled: (n: number) => `সাম্প্রতিক ${n}টা ইভেন্ট থেকে হিসাব করা`,
    matchNoSample: "এখনো কোনো ইভেন্ট নেই।",
    matchFbp: "ব্রাউজার কুকি (fbp)",
    matchFbc: "অ্যাড ক্লিক (fbc)",
    matchPhone: "ফোন নম্বর",
    channelsTitle: "অ্যাকুইজিশন চ্যানেল",
    channelsIntro: "কে কোন চ্যানেল থেকে রেজিস্টার করেছে — প্রথম ভিজিটেই ক্যাপচার হওয়া UTM অনুযায়ী। যাদের কোনো UTM নেই (অফলাইন লিড, সরাসরি URL) তারা 'organic_direct'-এ পড়ে — তারাও প্রতিটা ইভেন্টে পিক্সেল ডেটাসেটে যোগ হয়, শুধু কোনো নির্দিষ্ট ক্যাম্পেইনের ক্রেডিট পায় না।",
    channelOrganic: "অর্গানিক / অফলাইন / ডাইরেক্ট",
    colChannel: "চ্যানেল",
    colSignups: "রেজিস্ট্রেশন",
    colPaying: "পেয়িং কাস্টমার",
    colRevenue: "রেভিনিউ",
    campaignsTitle: "টপ ক্যাম্পেইন",
    campaignsIntro: "কোন নির্দিষ্ট ক্যাম্পেইন সবচেয়ে বেশি পেয়িং কাস্টমার আনছে — সেটাই স্কেল করার মতো ক্যাম্পেইন।",
    colCampaign: "ক্যাম্পেইন",
    colSource: "সোর্স",
    noChannels: "এখনো কোনো রেজিস্ট্রেশন নেই।",
    noCampaigns: "এখনো কোনো ক্যাম্পেইন-ট্যাগড রেজিস্ট্রেশন নেই।",
    countsTitle: "মোট সংখ্যা",
    logTitle: "ইভেন্ট লগ",
    filterAllStatus: "সব স্ট্যাটাস",
    statusQueued: "কিউতে",
    statusSent: "পাঠানো হয়েছে",
    statusFailed: "ব্যর্থ",
    filterEventName: "ইভেন্টের নাম (যেমন Subscribe)",
    colEvent: "ইভেন্ট",
    colUser: "ইউজার",
    colTime: "সময়",
    colStatus: "স্ট্যাটাস",
    colValue: "মূল্য",
    colMatch: "ম্যাচ সিগন্যাল",
    colError: "সমস্যা",
    noEvents: "কোনো ইভেন্ট পাওয়া যায়নি।",
    prevPage: "পূর্ববর্তী",
    nextPage: "পরবর্তী",
    pageOf: (cur: number, last: number) => `${cur} / ${last}`,
    settingsLink: "← Pixel সেটিংসে যান",
    menu: {
      dashboard: "ড্যাশবোর্ড",
      customers: "গ্রাহক",
      activeCustomers: "অ্যাকটিভ গ্রাহক",
      pendingCustomers: "পেন্ডিং গ্রাহক",
      sms: "এসএমএস",
      smsGateway: "এসএমএস গেটওয়ে",
      smsSend: "এসএমএস সেন্ড",
      smsHistory: "এসএমএস হিস্টোরি",
      smsCredit: "এসএমএস ক্রেডিট",
      packages: "প্যাকেজ",
      billing: "বিলিং",
      reports: "রিপোর্ট",
      settings: "সেটিংস",
      emailSettings: "ইমেইল সেটিংস",
      notificationTemplates: "নোটিফিকেশন টেমপ্লেট",
      notificationUseCases: "ইউজকেস ম্যাপিং",
      productMediaSettings: "Product Media",
      platformBranding: "প্ল্যাটফর্ম ব্র্যান্ডিং",
      facebookSettings: "ফেসবুক অ্যাপ",
      tracking: "ট্র্যাকিং ব্যবহার",
      marketingEvents: "মার্কেটিং ইভেন্ট",
    },
  },
  en: {
    title: "Marketing Event Log",
    subtitle: "BSOL's own acquisition-funnel CompleteRegistration/Subscribe events — separate from any seller's own tracking log. platform_marketing_tracking_context.md.",
    loginRequired: "Please login as admin",
    accessDenied: "Only admins can access this page",
    goHome: "Go Home",
    loading: "Loading...",
    matchTitle: "Match Quality",
    matchIntro: "Share of recent events carrying Meta's strongest match signals — browser cookies (fbp/fbc) and a hashed phone number.",
    matchSampled: (n: number) => `Computed from the latest ${n} events`,
    matchNoSample: "No events yet.",
    matchFbp: "Browser cookie (fbp)",
    matchFbc: "Ad click (fbc)",
    matchPhone: "Phone number",
    channelsTitle: "Acquisition Channels",
    channelsIntro: "Who registered through which channel — bucketed by the UTM captured on their very first visit. Anyone with no UTM (offline lead, direct URL) falls into 'organic_direct' — they still feed every event into the pixel dataset, they just don't get credited to a specific campaign.",
    channelOrganic: "Organic / Offline / Direct",
    colChannel: "Channel",
    colSignups: "Signups",
    colPaying: "Paying Customers",
    colRevenue: "Revenue",
    campaignsTitle: "Top Campaigns",
    campaignsIntro: "Which specific campaign is actually producing paying customers — that's the one worth scaling.",
    colCampaign: "Campaign",
    colSource: "Source",
    noChannels: "No registrations yet.",
    noCampaigns: "No campaign-tagged registrations yet.",
    countsTitle: "Totals",
    logTitle: "Event Log",
    filterAllStatus: "All statuses",
    statusQueued: "Queued",
    statusSent: "Sent",
    statusFailed: "Failed",
    filterEventName: "Event name (e.g. Subscribe)",
    colEvent: "Event",
    colUser: "User",
    colTime: "Time",
    colStatus: "Status",
    colValue: "Value",
    colMatch: "Match signal",
    colError: "Error",
    noEvents: "No events found.",
    prevPage: "Previous",
    nextPage: "Next",
    pageOf: (cur: number, last: number) => `${cur} / ${last}`,
    settingsLink: "← Go to Pixel settings",
    menu: {
      dashboard: "Dashboard",
      customers: "Customers",
      activeCustomers: "Active Customers",
      pendingCustomers: "Pending Customers",
      sms: "SMS",
      smsGateway: "SMS Gateway",
      smsSend: "Send SMS",
      smsHistory: "SMS History",
      smsCredit: "SMS Credit",
      packages: "Packages",
      billing: "Billing",
      reports: "Reports",
      settings: "Settings",
      emailSettings: "Email Settings",
      notificationTemplates: "Notification Templates",
      notificationUseCases: "Use-case Mapping",
      productMediaSettings: "Product Media",
      platformBranding: "Platform Branding",
      facebookSettings: "Facebook App",
      tracking: "Tracking Usage",
      marketingEvents: "Marketing Events",
    },
  },
};

type MatchQuality = { sampled: number; fbp_rate: number | null; fbc_rate: number | null; phone_rate: number | null };

type ChannelRow = { channel: string; signups: number; paying_customers: number; revenue: number };
type CampaignRow = { source: string; campaign: string; signups: number; revenue: number };

type EventRow = {
  id: number;
  event_name: string;
  event_id: string;
  status: "queued" | "sent" | "failed";
  created_at: string;
  sent_at: string | null;
  user: { id: number; name: string; email: string } | null;
  value: number | null;
  currency: string | null;
  has_fbp: boolean;
  has_fbc: boolean;
  response_code: number | null;
  error_message: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-yellow-500/15 text-yellow-400",
  sent: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
};

export default function AdminMarketingEventsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [matchQuality, setMatchQuality] = useState<MatchQuality | null>(null);
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [eventNameFilter, setEventNameFilter] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const t = useMemo(() => labels[locale], [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const token = getStoredToken();

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      setState("unauthenticated");
      return;
    }
    if (normalizeRole(storedUser) !== "admin") {
      setState("forbidden");
      return;
    }
    setUser(storedUser);
    setState("ready");
  }, [token]);

  const loadEvents = useCallback(async () => {
    if (!token) return;
    setEventsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (eventNameFilter.trim()) params.set("event_name", eventNameFilter.trim());

      const res = await fetch(`${API}/admin/marketing-events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setEvents(json.data);
        setMatchQuality(json.match_quality ?? null);
        setCounts(json.counts ?? {});
        setLastPage(json.pagination?.last_page ?? 1);
      }
    } catch {
      // silent — table just stays empty, retry on next visit
    } finally {
      setEventsLoading(false);
    }
  }, [token, page, statusFilter, eventNameFilter]);

  const loadChannels = useCallback(async () => {
    if (!token) return;
    setChannelsLoading(true);
    try {
      const res = await fetch(`${API}/admin/marketing-events/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setChannels(json.channels ?? []);
        setCampaigns(json.campaigns ?? []);
      }
    } catch {
      // silent — sections just stay empty, retry on next visit
    } finally {
      setChannelsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (state === "ready") {
      void loadEvents();
      void loadChannels();
    }
  }, [state, loadEvents, loadChannels]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, eventNameFilter]);

  const statusLabel: Record<string, string> = {
    queued: t.statusQueued,
    sent: t.statusSent,
    failed: t.statusFailed,
  };

  const menus = useMemo(() => buildAdminMenu({ ...t.menu }), [t]);

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{state === "forbidden" ? t.accessDenied : t.loginRequired}</p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">{t.goHome}</a>
        </section>
      </main>
    );
  }

  return (
    <CatvShell
      title={t.title}
      subtitle={t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={locale === "bn" ? "ভাষা" : "Language"}
      themeLabel={locale === "bn" ? "থিম" : "Theme"}
      sidebarTitle={locale === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}
      searchPlaceholder={locale === "bn" ? "সার্চ করুন" : "Search"}
      userName={user?.name}
      userMeta={user?.email}
      menu={menus}
      activeKey="marketing-events"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="space-y-5">
        <a href="/admin/settings/facebook" className="text-sm font-medium text-[var(--accent)] hover:underline">
          {t.settingsLink}
        </a>

        {Object.keys(counts).length > 0 && (
          <section className="catv-panel p-5">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{t.countsTitle}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(counts).map(([eventName, byStatus]) => (
                <div key={eventName} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-xs text-[var(--muted)]">{eventName}</p>
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {Object.values(byStatus).reduce((sum, n) => sum + n, 0)}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {Object.entries(byStatus).map(([s, n]) => `${statusLabel[s] ?? s}: ${n}`).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="catv-panel p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{t.channelsTitle}</h2>
          <p className="mt-1 mb-3 text-xs text-[var(--muted)]">{t.channelsIntro}</p>

          {channelsLoading ? (
            <p className="text-sm text-[var(--muted)]">{t.loading}</p>
          ) : channels.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t.noChannels}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="px-2 py-2 font-medium">{t.colChannel}</th>
                    <th className="px-2 py-2 font-medium">{t.colSignups}</th>
                    <th className="px-2 py-2 font-medium">{t.colPaying}</th>
                    <th className="px-2 py-2 font-medium">{t.colRevenue}</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((row) => (
                    <tr key={row.channel} className="border-b border-[var(--border)]/50">
                      <td className="px-2 py-2 font-medium text-[var(--foreground)]">
                        {row.channel === "organic_direct" ? t.channelOrganic : row.channel}
                      </td>
                      <td className="px-2 py-2 text-[var(--muted)]">{row.signups}</td>
                      <td className="px-2 py-2 text-[var(--muted)]">{row.paying_customers}</td>
                      <td className="px-2 py-2 text-[var(--muted)]">{row.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="catv-panel p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{t.campaignsTitle}</h2>
          <p className="mt-1 mb-3 text-xs text-[var(--muted)]">{t.campaignsIntro}</p>

          {channelsLoading ? (
            <p className="text-sm text-[var(--muted)]">{t.loading}</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t.noCampaigns}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="px-2 py-2 font-medium">{t.colCampaign}</th>
                    <th className="px-2 py-2 font-medium">{t.colSource}</th>
                    <th className="px-2 py-2 font-medium">{t.colSignups}</th>
                    <th className="px-2 py-2 font-medium">{t.colRevenue}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((row) => (
                    <tr key={`${row.source}|${row.campaign}`} className="border-b border-[var(--border)]/50">
                      <td className="px-2 py-2 font-medium text-[var(--foreground)]">{row.campaign}</td>
                      <td className="px-2 py-2 text-[var(--muted)]">{row.source}</td>
                      <td className="px-2 py-2 text-[var(--muted)]">{row.signups}</td>
                      <td className="px-2 py-2 text-[var(--muted)]">{row.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="catv-panel p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{t.matchTitle}</h2>
          <p className="mt-1 mb-3 text-xs text-[var(--muted)]">{t.matchIntro}</p>

          {matchQuality && matchQuality.sampled > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--muted)]">{t.matchSampled(matchQuality.sampled)}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: t.matchFbp, rate: matchQuality.fbp_rate },
                  { label: t.matchFbc, rate: matchQuality.fbc_rate },
                  { label: t.matchPhone, rate: matchQuality.phone_rate },
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
            <p className="text-sm text-[var(--muted)]">{t.matchNoSample}</p>
          )}
        </section>

        <section className="catv-panel p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{t.logTitle}</h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)]"
              >
                <option value="">{t.filterAllStatus}</option>
                <option value="queued">{t.statusQueued}</option>
                <option value="sent">{t.statusSent}</option>
                <option value="failed">{t.statusFailed}</option>
              </select>
              <input
                value={eventNameFilter}
                onChange={(e) => setEventNameFilter(e.target.value)}
                placeholder={t.filterEventName}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)]"
              />
            </div>
          </div>

          {eventsLoading ? (
            <p className="text-sm text-[var(--muted)]">{t.loading}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t.noEvents}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="px-2 py-2 font-medium">{t.colEvent}</th>
                    <th className="px-2 py-2 font-medium">{t.colUser}</th>
                    <th className="px-2 py-2 font-medium">{t.colTime}</th>
                    <th className="px-2 py-2 font-medium">{t.colStatus}</th>
                    <th className="px-2 py-2 font-medium">{t.colValue}</th>
                    <th className="px-2 py-2 font-medium">{t.colMatch}</th>
                    <th className="px-2 py-2 font-medium">{t.colError}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--border)]/50">
                      <td className="px-2 py-2 font-medium text-[var(--foreground)]">
                        {e.event_name}
                        <div className="text-[10px] font-normal text-[var(--muted)]">{e.event_id}</div>
                      </td>
                      <td className="px-2 py-2 text-[var(--muted)]">
                        {e.user ? (
                          <>
                            {e.user.name}
                            <div className="text-[10px]">{e.user.email}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2 text-[var(--muted)]">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[e.status] ?? ""}`}>
                          {statusLabel[e.status] ?? e.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-[var(--muted)]">
                        {e.value !== null ? `${e.value} ${e.currency ?? ""}` : "—"}
                      </td>
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
              <span className="text-[var(--muted)]">{t.pageOf(page, lastPage)}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1 || eventsLoading}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
                >
                  {t.prevPage}
                </button>
                <button
                  disabled={page >= lastPage || eventsLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
                >
                  {t.nextPage}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </CatvShell>
  );
}
