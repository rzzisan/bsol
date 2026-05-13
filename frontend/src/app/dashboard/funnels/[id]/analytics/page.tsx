"use client";

import { use, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { buildApiHeaders, FUNNEL_API_BASE, readApiResponse, type FunnelAnalyticsRow } from "@/lib/funnel";

const text = {
  bn: { title: "Funnel Analytics", loading: "লোড হচ্ছে...", empty: "এখনও analytics data নেই।", step: "স্টেপ", events: "ইভেন্টস" },
  en: { title: "Funnel Analytics", loading: "Loading...", empty: "No analytics data yet.", step: "Step", events: "Events" },
};

export default function FunnelAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [locale] = useState<Locale>(getStoredLocale);
  const token = getStoredToken();
  const t = useMemo(() => text[locale], [locale]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FunnelAnalyticsRow[]>([]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${FUNNEL_API_BASE}/funnels/${id}/analytics`, { headers: buildApiHeaders(token) });
        const result = await readApiResponse<FunnelAnalyticsRow[]>(res);
        if (result.ok) {
          setRows(Array.isArray(result.data) ? result.data : []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  return (
    <UserShell
      activeKey="funnels"
      defaultExpandedKey="landing"
      pageTitle={{ bn: t.title, en: t.title }}
      pageSubtitle={{ bn: "Step-wise conversion metrics", en: "Step-wise conversion metrics" }}
    >
      <div className="catv-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">{t.step}</th>
              <th className="px-4 py-3">{t.events}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} className="px-4 py-10 text-center text-[var(--muted)]">{t.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-10 text-center text-[var(--muted)]">{t.empty}</td></tr>
            ) : rows.map((row) => (
              <tr key={row.step_id} className="border-b border-[var(--border)]">
                <td className="px-4 py-3 font-semibold">{row.step_type}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(row.conversions ?? {}).map(([name, count]) => (
                      <span key={name} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs">
                        {name}: {count}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UserShell>
  );
}
