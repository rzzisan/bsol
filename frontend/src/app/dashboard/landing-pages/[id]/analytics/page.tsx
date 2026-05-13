"use client";

import { use, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import {
  buildApiHeaders,
  LANDING_API_BASE,
  readApiResponse,
  type LandingAnalyticsRow,
  type LandingAnalyticsTrendPoint,
  type LandingAnalyticsSummary,
  type LandingAnalyticsRange,
  type LandingAttributionBucket,
  type LandingAttributionTrendPoint,
} from "@/lib/landing";

const text = {
  bn: {
    pageTitle: "ল্যান্ডিং অ্যানালিটিক্স",
    loading: "লোড হচ্ছে...",
    totalViews: "মোট ভিউ",
    uniqueVisitors: "ইউনিক ভিজিটর",
    ctaClicks: "CTA ক্লিক",
    checkoutStarts: "চেকআউট স্টার্ট",
    ordersCompleted: "অর্ডার সম্পন্ন",
    revenue: "রেভিনিউ",
    viewToCheckout: "ভিউ → চেকআউট %",
    checkoutToOrder: "চেকআউট → অর্ডার %",
    sourceBreakdown: "সোর্স ব্রেকডাউন",
    deviceBreakdown: "ডিভাইস ব্রেকডাউন",
    sourceTrend: "সোর্স ট্রেন্ড (তারিখভিত্তিক)",
    deviceTrend: "ডিভাইস ট্রেন্ড (তারিখভিত্তিক)",
    trendTitle: "ট্রেন্ড (ভিউ/চেকআউট/অর্ডার)",
    channel: "চ্যানেল",
    filterRange: "রেঞ্জ",
    last7Days: "শেষ ৭ দিন",
    last30Days: "শেষ ৩০ দিন",
    customRange: "কাস্টম",
    startDate: "শুরু তারিখ",
    endDate: "শেষ তারিখ",
    device: "ডিভাইস",
    events: "ইভেন্ট",
    date: "তারিখ",
    orderBumps: "বাম্প",
    upsells: "আপসেল",
    empty: "এখনও কোনো অ্যানালিটিক্স নেই।",
  },
  en: {
    pageTitle: "Landing Analytics",
    loading: "Loading...",
    totalViews: "Total Views",
    uniqueVisitors: "Unique Visitors",
    ctaClicks: "CTA Clicks",
    checkoutStarts: "Checkout Starts",
    ordersCompleted: "Orders Completed",
    revenue: "Revenue",
    viewToCheckout: "View → Checkout %",
    checkoutToOrder: "Checkout → Order %",
    sourceBreakdown: "Source Breakdown",
    deviceBreakdown: "Device Breakdown",
    sourceTrend: "Source Trend (By Date)",
    deviceTrend: "Device Trend (By Date)",
    trendTitle: "Trend (Views/Checkout/Orders)",
    channel: "Channel",
    filterRange: "Range",
    last7Days: "Last 7 Days",
    last30Days: "Last 30 Days",
    customRange: "Custom",
    startDate: "Start Date",
    endDate: "End Date",
    device: "Device",
    events: "Events",
    date: "Date",
    orderBumps: "Order Bumps",
    upsells: "Upsells",
    empty: "No analytics yet.",
  },
};

type RangePreset = "7d" | "30d" | "custom";

const toDateInput = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function LandingAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);
  const token = getStoredToken();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangePreset>("30d");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toDateInput(d);
  });
  const [endDate, setEndDate] = useState(() => toDateInput(new Date()));
  const [rows, setRows] = useState<LandingAnalyticsRow[]>([]);
  const [summary, setSummary] = useState<LandingAnalyticsSummary | null>(null);
  const [trend, setTrend] = useState<LandingAnalyticsTrendPoint[]>([]);
  const [sourceBuckets, setSourceBuckets] = useState<LandingAttributionBucket[]>([]);
  const [deviceBuckets, setDeviceBuckets] = useState<LandingAttributionBucket[]>([]);
  const [sourceTrend, setSourceTrend] = useState<LandingAttributionTrendPoint[]>([]);
  const [deviceTrend, setDeviceTrend] = useState<LandingAttributionTrendPoint[]>([]);
  const [, setRangeMeta] = useState<LandingAnalyticsRange | null>(null);

  const trendMax = useMemo(() => {
    const maxViews = Math.max(...trend.map((point) => point.total_views), 0);
    const maxCheckout = Math.max(...trend.map((point) => point.checkout_starts), 0);
    const maxOrders = Math.max(...trend.map((point) => point.orders_completed), 0);
    return Math.max(maxViews, maxCheckout, maxOrders, 1);
  }, [trend]);

  const trendLine = (series: number[]) => {
    if (series.length === 0) return "";

    return series
      .map((value, index) => {
        const x = series.length === 1 ? 50 : (index / (series.length - 1)) * 100;
        const y = 30 - (value / trendMax) * 26;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  };

  const onRangeChange = (next: RangePreset) => {
    setRange(next);
    if (next === "7d") {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      setStartDate(toDateInput(start));
      setEndDate(toDateInput(end));
    }
    if (next === "30d") {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);
      setStartDate(toDateInput(start));
      setEndDate(toDateInput(end));
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      if (range === "custom" && (!startDate || !endDate)) return;

      setLoading(true);
      try {
        const query = new URLSearchParams();
        query.set("range", range);
        query.set("start_date", startDate);
        query.set("end_date", endDate);

        const res = await fetch(`${LANDING_API_BASE}/landing/pages/${id}/analytics?${query.toString()}`, {
          headers: buildApiHeaders(token),
        });
        const result = await readApiResponse<{
          rows?: LandingAnalyticsRow[];
          summary?: LandingAnalyticsSummary;
          trend?: LandingAnalyticsTrendPoint[];
          range?: LandingAnalyticsRange;
          attribution?: {
            sources?: LandingAttributionBucket[];
            devices?: LandingAttributionBucket[];
            source_trend?: LandingAttributionTrendPoint[];
            device_trend?: LandingAttributionTrendPoint[];
          };
        }>(res);
        if (result.ok) {
          setRows((result.data?.rows ?? []) as LandingAnalyticsRow[]);
          setSummary((result.data?.summary ?? null) as LandingAnalyticsSummary | null);
          setTrend((result.data?.trend ?? []) as LandingAnalyticsTrendPoint[]);
          setRangeMeta((result.data?.range ?? null) as LandingAnalyticsRange | null);
          setSourceBuckets((result.data?.attribution?.sources ?? []) as LandingAttributionBucket[]);
          setDeviceBuckets((result.data?.attribution?.devices ?? []) as LandingAttributionBucket[]);
          setSourceTrend((result.data?.attribution?.source_trend ?? []) as LandingAttributionTrendPoint[]);
          setDeviceTrend((result.data?.attribution?.device_trend ?? []) as LandingAttributionTrendPoint[]);
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, token, range, startDate, endDate]);

  return (
    <UserShell activeKey="landing-pages" defaultExpandedKey="landing" pageTitle={{ bn: "ল্যান্ডিং অ্যানালিটিক্স", en: "Landing Analytics" }}>
      <div className="catv-panel mb-4 grid gap-3 p-4 md:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--muted)]">{t.filterRange}</span>
          <select
            value={range}
            onChange={(event) => onRangeChange(event.target.value as RangePreset)}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm dark:bg-[var(--surface)]"
          >
            <option value="7d">{t.last7Days}</option>
            <option value="30d">{t.last30Days}</option>
            <option value="custom">{t.customRange}</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--muted)]">{t.startDate}</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={range !== "custom"}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm disabled:opacity-60 dark:bg-[var(--surface)]"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--muted)]">{t.endDate}</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            disabled={range !== "custom"}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm disabled:opacity-60 dark:bg-[var(--surface)]"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          [t.totalViews, summary?.total_views ?? 0, "bg-[#0f7c7b]"],
          [t.uniqueVisitors, summary?.unique_visitors ?? 0, "bg-[#2f7ec1]"],
          [t.ctaClicks, summary?.cta_clicks ?? 0, "bg-[#8b5cf6]"],
          [t.checkoutStarts, summary?.checkout_starts ?? 0, "bg-[#d97706]"],
          [t.ordersCompleted, summary?.orders_completed ?? 0, "bg-[#16a34a]"],
          [t.revenue, summary?.revenue ?? 0, "bg-[#dc2626]"],
        ].map(([label, value, color]) => (
          <article key={String(label)} className={`${String(color)} rounded-2xl p-4 text-white`}>
            <p className="text-xs text-white/80">{label}</p>
            <p className="mt-1 text-2xl font-bold">{String(label) === t.revenue ? `৳${Number(value).toLocaleString()}` : value}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.viewToCheckout}</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{Number(summary?.view_to_checkout_rate ?? 0).toFixed(2)}%</p>
        </article>
        <article className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.checkoutToOrder}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{Number(summary?.checkout_to_order_rate ?? 0).toFixed(2)}%</p>
        </article>
      </div>

      <div className="catv-panel mt-4 p-4">
        <h3 className="mb-3 text-sm font-semibold">{t.trendTitle}</h3>
        {trend.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">{t.empty}</p>
        ) : (
          <>
            <svg viewBox="0 0 100 32" className="h-36 w-full rounded-xl border border-[var(--border)] bg-white dark:bg-[var(--surface)]">
              <polyline fill="none" stroke="#0ea5e9" strokeWidth="1.6" points={trendLine(trend.map((point) => point.total_views))} />
              <polyline fill="none" stroke="#f59e0b" strokeWidth="1.6" points={trendLine(trend.map((point) => point.checkout_starts))} />
              <polyline fill="none" stroke="#16a34a" strokeWidth="1.6" points={trendLine(trend.map((point) => point.orders_completed))} />
            </svg>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />{t.totalViews}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{t.checkoutStarts}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" />{t.ordersCompleted}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.sourceBreakdown}</h3>
          {sourceBuckets.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">{t.empty}</p>
          ) : (
            <div className="space-y-2">
              {sourceBuckets.map((item) => (
                <div key={`source-${item.key}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                  <span>{item.key}</span>
                  <span className="font-semibold">{item.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.deviceBreakdown}</h3>
          {deviceBuckets.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">{t.empty}</p>
          ) : (
            <div className="space-y-2">
              {deviceBuckets.map((item) => (
                <div key={`device-${item.key}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                  <span>{item.key}</span>
                  <span className="font-semibold">{item.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.sourceTrend}</h3>
          {sourceTrend.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">{t.empty}</p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
                    <th className="px-3 py-2">{t.date}</th>
                    <th className="px-3 py-2">{t.channel}</th>
                    <th className="px-3 py-2">{t.events}</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceTrend.slice(0, 30).map((item, index) => (
                    <tr key={`source-trend-${item.trend_date}-${item.key}-${index}`} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-2">{item.trend_date}</td>
                      <td className="px-3 py-2">{item.key}</td>
                      <td className="px-3 py-2 font-semibold">{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.deviceTrend}</h3>
          {deviceTrend.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">{t.empty}</p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
                    <th className="px-3 py-2">{t.date}</th>
                    <th className="px-3 py-2">{t.device}</th>
                    <th className="px-3 py-2">{t.events}</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceTrend.slice(0, 30).map((item, index) => (
                    <tr key={`device-trend-${item.trend_date}-${item.key}-${index}`} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-2">{item.trend_date}</td>
                      <td className="px-3 py-2">{item.key}</td>
                      <td className="px-3 py-2 font-semibold">{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="catv-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">{t.date}</th>
              <th className="px-4 py-3">{t.totalViews}</th>
              <th className="px-4 py-3">{t.uniqueVisitors}</th>
              <th className="px-4 py-3">{t.ctaClicks}</th>
              <th className="px-4 py-3">{t.checkoutStarts}</th>
              <th className="px-4 py-3">{t.orderBumps}</th>
              <th className="px-4 py-3">{t.upsells}</th>
              <th className="px-4 py-3">{t.ordersCompleted}</th>
              <th className="px-4 py-3">{t.revenue}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-[var(--muted)]">{t.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-[var(--muted)]">{t.empty}</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3">{row.view_date}</td>
                <td className="px-4 py-3">{row.total_views}</td>
                <td className="px-4 py-3">{row.unique_visitors}</td>
                <td className="px-4 py-3">{row.cta_clicks}</td>
                <td className="px-4 py-3">{row.checkout_starts}</td>
                <td className="px-4 py-3">{row.order_bumps_accepted ?? 0}</td>
                <td className="px-4 py-3">{row.upsells_accepted ?? 0}</td>
                <td className="px-4 py-3">{row.orders_completed}</td>
                <td className="px-4 py-3">৳{Number(row.revenue).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UserShell>
  );
}
