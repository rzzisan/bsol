"use client";

import { use, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { buildApiHeaders, LANDING_API_BASE, readApiResponse, type LandingAnalyticsRow } from "@/lib/landing";

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
    date: "তারিখ",
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
    date: "Date",
    empty: "No analytics yet.",
  },
};

export default function LandingAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);
  const token = getStoredToken();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LandingAnalyticsRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`${LANDING_API_BASE}/landing/pages/${id}/analytics`, {
          headers: buildApiHeaders(token),
        });
        const result = await readApiResponse<{ rows?: LandingAnalyticsRow[]; summary?: Record<string, number> }>(res);
        if (result.ok) {
          setRows((result.data?.rows ?? []) as LandingAnalyticsRow[]);
          setSummary((result.data?.summary ?? {}) as Record<string, number>);
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, token]);

  return (
    <UserShell activeKey="landing-pages" defaultExpandedKey="landing" pageTitle={{ bn: "ল্যান্ডিং অ্যানালিটিক্স", en: "Landing Analytics" }}>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          [t.totalViews, summary.total_views ?? 0, "bg-[#0f7c7b]"],
          [t.uniqueVisitors, summary.unique_visitors ?? 0, "bg-[#2f7ec1]"],
          [t.ctaClicks, summary.cta_clicks ?? 0, "bg-[#8b5cf6]"],
          [t.checkoutStarts, summary.checkout_starts ?? 0, "bg-[#d97706]"],
          [t.ordersCompleted, summary.orders_completed ?? 0, "bg-[#16a34a]"],
          [t.revenue, summary.revenue ?? 0, "bg-[#dc2626]"],
        ].map(([label, value, color]) => (
          <article key={String(label)} className={`${String(color)} rounded-2xl p-4 text-white`}>
            <p className="text-xs text-white/80">{label}</p>
            <p className="mt-1 text-2xl font-bold">{String(label) === t.revenue ? `৳${Number(value).toLocaleString()}` : value}</p>
          </article>
        ))}
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
              <th className="px-4 py-3">{t.ordersCompleted}</th>
              <th className="px-4 py-3">{t.revenue}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">{t.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">{t.empty}</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3">{row.view_date}</td>
                <td className="px-4 py-3">{row.total_views}</td>
                <td className="px-4 py-3">{row.unique_visitors}</td>
                <td className="px-4 py-3">{row.cta_clicks}</td>
                <td className="px-4 py-3">{row.checkout_starts}</td>
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
