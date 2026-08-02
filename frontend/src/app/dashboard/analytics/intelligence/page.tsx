"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

type RangeKey = "today" | "week" | "month" | "30d";

interface DistrictRow {
  district: string;
  orders: number;
  revenue: string | number;
}

interface CustomersData {
  summary: {
    total_customers: number;
    new_customers: number;
    loyal_customers: number;
    vip_customers: number;
    risky_customers: number;
    blocked_customers: number;
    repeat_buyer_rate: number;
    avg_ltv: number;
  };
  district_breakdown: DistrictRow[];
}

const text = {
  bn: {
    title: "কাস্টমার ইন্টেলিজেন্স",
    subtitle: "কাস্টমার স্কোরিং, রিপিট বায়ার এবং জেলাভিত্তিক অর্ডার",
    loading: "লোড হচ্ছে...",
    error: "ডাটা লোড করা যায়নি।",
    ranges: { today: "আজ", week: "এই সপ্তাহ", month: "এই মাস", "30d": "৩০ দিন" },
    cards: {
      total_customers: "মোট কাস্টমার",
      new_customers: "নতুন কাস্টমার",
      loyal_customers: "লয়্যাল কাস্টমার",
      vip_customers: "ভিআইপি কাস্টমার",
      risky_customers: "রিস্কি কাস্টমার",
      blocked_customers: "ব্লকড কাস্টমার",
      repeat_buyer_rate: "রিপিট বায়ার রেট",
      avg_ltv: "গড় লাইফটাইম ভ্যালু",
    },
    districtTitle: "জেলাভিত্তিক অর্ডার",
    districtCols: { district: "জেলা", orders: "অর্ডার", revenue: "ডেলিভারড রেভিনিউ" },
    empty: "এই সময়সীমায় কোনো ডাটা নেই।",
  },
  en: {
    title: "Customer Intelligence",
    subtitle: "Customer scoring, repeat buyers and district-wise orders",
    loading: "Loading...",
    error: "Failed to load data.",
    ranges: { today: "Today", week: "This Week", month: "This Month", "30d": "30 Days" },
    cards: {
      total_customers: "Total Customers",
      new_customers: "New Customers",
      loyal_customers: "Loyal Customers",
      vip_customers: "VIP Customers",
      risky_customers: "Risky Customers",
      blocked_customers: "Blocked Customers",
      repeat_buyer_rate: "Repeat Buyer Rate",
      avg_ltv: "Avg Lifetime Value",
    },
    districtTitle: "District-wise Orders",
    districtCols: { district: "District", orders: "Orders", revenue: "Delivered Revenue" },
    empty: "No data in this range.",
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CustomersData | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const rangeParam = range === "30d" ? "" : `?range=${range}`;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/analytics/customers${rangeParam}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) {
          setError((json?.message ?? t.error) as string);
          return;
        }
        setData(json.data as CustomersData);
      } catch {
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [range, t.error]);

  const money = (n: number) => `৳${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const maxDistrictOrders = Math.max(1, ...(data?.district_breakdown.map((r) => r.orders) ?? [1]));

  return (
    <UserShell
      activeKey="intelligence"
      defaultExpandedKey="analytics"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      <div className="mx-4 mb-4 flex flex-wrap gap-2">
        {(Object.keys(t.ranges) as RangeKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              range === key
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.ranges[key]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="mx-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.total_customers}</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {loading ? "…" : data?.summary.total_customers ?? 0}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.new_customers}</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {loading ? "…" : data?.summary.new_customers ?? 0}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.loyal_customers}</p>
          <p className="mt-2 text-xl font-bold text-emerald-600">
            {loading ? "…" : data?.summary.loyal_customers ?? 0}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.vip_customers}</p>
          <p className="mt-2 text-xl font-bold text-amber-600">
            {loading ? "…" : data?.summary.vip_customers ?? 0}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.risky_customers}</p>
          <p className="mt-2 text-xl font-bold text-rose-600">
            {loading ? "…" : data?.summary.risky_customers ?? 0}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.blocked_customers}</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {loading ? "…" : data?.summary.blocked_customers ?? 0}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.repeat_buyer_rate}</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {loading ? "…" : `${data?.summary.repeat_buyer_rate ?? 0}%`}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.avg_ltv}</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {loading ? "…" : money(data?.summary.avg_ltv ?? 0)}
          </p>
        </div>
      </section>

      <section className="catv-panel mx-4 mb-6 overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">{t.districtTitle}</div>
        <div className="divide-y divide-[var(--border)]">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">{t.loading}</p>
          ) : !data || data.district_breakdown.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">{t.empty}</p>
          ) : (
            data.district_breakdown.map((row) => (
              <div key={row.district} className="flex items-center gap-3 px-4 py-3">
                <div className="w-28 shrink-0 truncate text-sm font-medium text-[var(--foreground)]">{row.district}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${Math.max(4, (row.orders / maxDistrictOrders) * 100)}%` }}
                  />
                </div>
                <div className="w-12 shrink-0 text-right text-sm font-semibold text-[var(--foreground)]">{row.orders}</div>
                <div className="w-24 shrink-0 text-right text-xs text-[var(--muted)]">{money(Number(row.revenue))}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </UserShell>
  );
}
