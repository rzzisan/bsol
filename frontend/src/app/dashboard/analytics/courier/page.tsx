"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

type RangeKey = "today" | "week" | "month" | "30d";

interface CourierRow {
  courier_name: string;
  total_bookings: number;
  delivered: number;
  returned: number;
  cancelled: number;
  success_rate: number;
  return_rate: number;
  total_courier_charge: number;
  delivered_revenue: number;
  avg_delivery_hours: number | null;
}

const text = {
  bn: {
    title: "কুরিয়ার বিশ্লেষণ",
    subtitle: "কুরিয়ার-ভিত্তিক ডেলিভারি সাফল্য, রিটার্ন রেট এবং খরচ",
    loading: "লোড হচ্ছে...",
    error: "ডাটা লোড করা যায়নি।",
    ranges: { today: "আজ", week: "এই সপ্তাহ", month: "এই মাস", "30d": "৩০ দিন" },
    empty: "এই সময়সীমায় কোনো কুরিয়ার বুকিং নেই।",
    cols: {
      courier: "কুরিয়ার",
      bookings: "মোট বুকিং",
      delivered: "ডেলিভারড",
      returned: "রিটার্ন",
      cancelled: "বাতিল",
      success_rate: "সাফল্য রেট",
      return_rate: "রিটার্ন রেট",
      avg_hours: "গড় ডেলিভারি সময়",
      charge: "মোট কুরিয়ার খরচ",
      revenue: "ডেলিভারড রেভিনিউ",
    },
    hours: "ঘণ্টা",
  },
  en: {
    title: "Courier Analytics",
    subtitle: "Courier-wise delivery success, return rate and cost",
    loading: "Loading...",
    error: "Failed to load data.",
    ranges: { today: "Today", week: "This Week", month: "This Month", "30d": "30 Days" },
    empty: "No courier bookings in this range.",
    cols: {
      courier: "Courier",
      bookings: "Total Bookings",
      delivered: "Delivered",
      returned: "Returned",
      cancelled: "Cancelled",
      success_rate: "Success Rate",
      return_rate: "Return Rate",
      avg_hours: "Avg Delivery Time",
      charge: "Total Courier Charge",
      revenue: "Delivered Revenue",
    },
    hours: "hrs",
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);

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
        const res = await fetch(`${API}/analytics/courier${rangeParam}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data?.message ?? t.error) as string);
          return;
        }
        setCouriers((data?.data?.couriers ?? []) as CourierRow[]);
      } catch {
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [range, t.error]);

  const money = (n: number) => `৳${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <UserShell
      activeKey="courier-report"
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

      <section className="mx-4 mb-6 grid gap-3">
        {loading ? (
          <div className="catv-panel p-8 text-center text-sm text-[var(--muted)]">{t.loading}</div>
        ) : couriers.length === 0 ? (
          <div className="catv-panel p-8 text-center text-sm text-[var(--muted)]">{t.empty}</div>
        ) : (
          couriers.map((c) => (
            <div key={c.courier_name} className="catv-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase text-[var(--foreground)]">{c.courier_name}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    c.success_rate >= 70
                      ? "bg-emerald-500/10 text-emerald-600"
                      : c.success_rate >= 40
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {t.cols.success_rate}: {c.success_rate}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <div>
                  <p className="text-xs text-[var(--muted)]">{t.cols.bookings}</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">{c.total_bookings}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{t.cols.delivered}</p>
                  <p className="mt-1 font-semibold text-emerald-600">{c.delivered}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{t.cols.returned}</p>
                  <p className="mt-1 font-semibold text-rose-600">{c.returned}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{t.cols.cancelled}</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">{c.cancelled}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{t.cols.return_rate}</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">{c.return_rate}%</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{t.cols.avg_hours}</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">
                    {c.avg_delivery_hours !== null ? `${c.avg_delivery_hours} ${t.hours}` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{t.cols.charge}</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">{money(c.total_courier_charge)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </UserShell>
  );
}
