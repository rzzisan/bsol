"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

type RangeKey = "today" | "week" | "month" | "30d";

interface FunnelRow {
  status: string;
  count: number;
  revenue: number;
}

interface TrendRow {
  date: string;
  orders: number;
  revenue: string | number;
}

interface ProductRow {
  product_id: number;
  name: string;
  sku: string | null;
  qty_ordered: number;
  qty_delivered: number;
  qty_returned: number;
  revenue: number;
  margin: number;
  return_rate: number;
}

interface SalesData {
  range: { from: string; to: string };
  summary: {
    total_orders: number;
    delivered_orders: number;
    delivered_revenue: number;
    avg_order_value: number;
    conversion_rate: number;
    cancellation_rate: number;
  };
  funnel: FunnelRow[];
  trend: TrendRow[];
}

interface ProductsData {
  products: ProductRow[];
}

const text = {
  bn: {
    title: "সেলস রিপোর্ট",
    subtitle: "অর্ডার ফানেল, ট্রেন্ড এবং টপ পণ্য",
    loading: "লোড হচ্ছে...",
    error: "ডাটা লোড করা যায়নি।",
    ranges: { today: "আজ", week: "এই সপ্তাহ", month: "এই মাস", "30d": "৩০ দিন" },
    cards: {
      total_orders: "মোট অর্ডার",
      delivered_revenue: "ডেলিভারড রেভিনিউ",
      avg_order_value: "গড় অর্ডার মূল্য",
      conversion_rate: "কনভার্সন রেট",
      cancellation_rate: "বাতিল/রিটার্ন রেট",
    },
    funnelTitle: "অর্ডার ফানেল",
    statuses: {
      pending: "পেন্ডিং",
      confirmed: "কনফার্মড",
      processing: "প্রসেসিং",
      shipped: "শিপড",
      delivered: "ডেলিভারড",
      cancelled: "বাতিল",
      returned: "রিটার্ন",
    },
    trendTitle: "দৈনিক অর্ডার ট্রেন্ড",
    productsTitle: "টপ পণ্য",
    productCols: {
      name: "পণ্য",
      qty_ordered: "অর্ডারকৃত",
      qty_delivered: "ডেলিভারড",
      return_rate: "রিটার্ন রেট",
      revenue: "রেভিনিউ",
      margin: "মার্জিন",
    },
    empty: "এই সময়সীমায় কোনো ডাটা নেই।",
    emptyProducts: "কোনো পণ্যের বিক্রয় ডাটা নেই।",
  },
  en: {
    title: "Sales Report",
    subtitle: "Order funnel, trend and top products",
    loading: "Loading...",
    error: "Failed to load data.",
    ranges: { today: "Today", week: "This Week", month: "This Month", "30d": "30 Days" },
    cards: {
      total_orders: "Total Orders",
      delivered_revenue: "Delivered Revenue",
      avg_order_value: "Avg Order Value",
      conversion_rate: "Conversion Rate",
      cancellation_rate: "Cancel/Return Rate",
    },
    funnelTitle: "Order Funnel",
    statuses: {
      pending: "Pending",
      confirmed: "Confirmed",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled",
      returned: "Returned",
    },
    trendTitle: "Daily Order Trend",
    productsTitle: "Top Products",
    productCols: {
      name: "Product",
      qty_ordered: "Ordered",
      qty_delivered: "Delivered",
      return_rate: "Return Rate",
      revenue: "Revenue",
      margin: "Margin",
    },
    empty: "No data in this range.",
    emptyProducts: "No product sales data.",
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const rangeParam = range === "30d" ? "" : `range=${range}`;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sRes, pRes] = await Promise.all([
          fetch(`${API}/analytics/sales${rangeParam ? `?${rangeParam}` : ""}`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          }),
          fetch(`${API}/analytics/products${rangeParam ? `?${rangeParam}` : ""}`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          }),
        ]);

        const sData = await sRes.json();
        const pData = await pRes.json();

        if (!sRes.ok || !pRes.ok) {
          setError((sData?.message ?? pData?.message ?? t.error) as string);
          return;
        }

        setSales(sData.data as SalesData);
        setProducts(((pData.data as ProductsData)?.products ?? []) as ProductRow[]);
      } catch {
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [range, t.error]);

  const money = (n: number) => `৳${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const maxTrendOrders = Math.max(1, ...(sales?.trend.map((r) => r.orders) ?? [1]));

  return (
    <UserShell
      activeKey="sales-report"
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

      <section className="mx-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.total_orders}</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {loading ? "…" : sales?.summary.total_orders ?? 0}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.delivered_revenue}</p>
          <p className="mt-2 text-xl font-bold text-emerald-600">
            {loading ? "…" : money(sales?.summary.delivered_revenue ?? 0)}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.avg_order_value}</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {loading ? "…" : money(sales?.summary.avg_order_value ?? 0)}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.conversion_rate}</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {loading ? "…" : `${sales?.summary.conversion_rate ?? 0}%`}
          </p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.cancellation_rate}</p>
          <p className="mt-2 text-xl font-bold text-rose-600">
            {loading ? "…" : `${sales?.summary.cancellation_rate ?? 0}%`}
          </p>
        </div>
      </section>

      <section className="catv-panel mx-4 mb-4 p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">{t.funnelTitle}</h3>
        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">{t.loading}</p>
        ) : !sales || sales.summary.total_orders === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">{t.empty}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {sales.funnel.map((row) => (
              <div key={row.status} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--muted)]">{t.statuses[row.status as keyof typeof t.statuses]}</p>
                <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{row.count}</p>
                <p className="text-xs text-[var(--muted)]">{money(row.revenue)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="catv-panel mx-4 mb-4 p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">{t.trendTitle}</h3>
        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">{t.loading}</p>
        ) : !sales || sales.trend.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">{t.empty}</p>
        ) : (
          <div className="flex h-40 gap-1 overflow-x-auto pb-1">
            {sales.trend.map((row) => (
              <div key={row.date} className="flex min-w-[28px] flex-1 flex-col items-center" title={`${row.date}: ${row.orders}`}>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-[var(--accent)]"
                    style={{ height: `${Math.max(4, (row.orders / maxTrendOrders) * 100)}%` }}
                  />
                </div>
                <span className="mt-1 text-[10px] text-[var(--muted)]">{row.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="catv-panel mx-4 mb-6 overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">{t.productsTitle}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">{t.productCols.name}</th>
                <th className="px-3 py-2">{t.productCols.qty_ordered}</th>
                <th className="px-3 py-2">{t.productCols.qty_delivered}</th>
                <th className="px-3 py-2">{t.productCols.return_rate}</th>
                <th className="px-3 py-2">{t.productCols.revenue}</th>
                <th className="px-3 py-2">{t.productCols.margin}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">{t.loading}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">{t.emptyProducts}</td></tr>
              ) : products.map((p) => (
                <tr key={p.product_id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--foreground)]">{p.name}</div>
                    {p.sku && <div className="text-xs text-[var(--muted)]">{p.sku}</div>}
                  </td>
                  <td className="px-3 py-2">{p.qty_ordered}</td>
                  <td className="px-3 py-2">{p.qty_delivered}</td>
                  <td className={`px-3 py-2 ${p.return_rate > 20 ? "text-rose-600" : ""}`}>{p.return_rate}%</td>
                  <td className="px-3 py-2 font-semibold text-emerald-600">{money(p.revenue)}</td>
                  <td className="px-3 py-2">{money(p.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </UserShell>
  );
}
