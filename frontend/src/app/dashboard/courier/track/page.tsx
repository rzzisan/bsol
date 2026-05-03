"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const STATUS_STYLES: Record<string, string> = {
  booked:       "bg-blue-500/15 text-blue-400",
  in_transit:   "bg-yellow-500/15 text-yellow-400",
  delivered:    "bg-emerald-500/15 text-emerald-400",
  returned:     "bg-red-500/15 text-red-400",
  partial_delivered: "bg-orange-500/15 text-orange-400",
  cancelled:    "bg-zinc-500/15 text-zinc-400",
};

const t = {
  bn: {
    pageTitle: "পার্সেল ট্র্যাক করুন",
    search: "অর্ডার নম্বর / ফোন",
    loading: "লোড হচ্ছে...",
    noOrders: "কোনো ট্র্যাকিং রেকর্ড নেই।",
    orderNo: "অর্ডার নং",
    customer: "গ্রাহক",
    courier: "কুরিয়ার",
    trackingId: "ট্র্যাকিং আইডি",
    courierStatus: "কুরিয়ার স্ট্যাটাস",
    actions: "অ্যাকশন",
    refresh: "রিফ্রেশ",
    refreshing: "চেক হচ্ছে...",
    total: "মোট",
  },
  en: {
    pageTitle: "Track Parcels",
    search: "Order no / phone",
    loading: "Loading...",
    noOrders: "No booked orders yet.",
    orderNo: "Order #",
    customer: "Customer",
    courier: "Courier",
    trackingId: "Tracking ID",
    courierStatus: "Status",
    actions: "Actions",
    refresh: "Refresh",
    refreshing: "Checking...",
    total: "Total",
  },
};

type Order = {
  id: number; order_number: string; customer_name: string | null;
  customer_phone: string; courier_name: string | null;
  courier_tracking_id: string | null; courier_status: string | null;
  total: string;
};

export default function TrackPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState<number | null>(null);

  const fetchBooked = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`${API}/courier/booked?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setOrders(d.data ?? []);
        setTotal(d.meta?.total ?? 0);
        setLastPage(d.meta?.last_page ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, token]);

  useEffect(() => { void fetchBooked(); }, [fetchBooked]);
  useEffect(() => { setPage(1); }, [search]);

  const refreshOrder = async (orderId: number) => {
    setRefreshing(orderId);
    try {
      const res = await fetch(`${API}/courier/track/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        const newStatus = d.data?.order_status_slug ?? d.data?.delivery_status ?? d.data?.status;
        if (newStatus) {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, courier_status: newStatus } : o));
        }
      }
    } finally {
      setRefreshing(null);
    }
  };

  return (
    <UserShell activeKey="track-parcel" defaultExpandedKey="courier"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {/* Toolbar */}
      <div className="catv-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={txt.search}
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <p className="text-xs text-[var(--muted)]">{total} {locale === "bn" ? "টি পার্সেল" : "parcels"}</p>
      </div>

      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.orderNo}</th>
              <th className="px-4 py-3">{txt.customer}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.courier}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.trackingId}</th>
              <th className="px-4 py-3">{txt.courierStatus}</th>
              <th className="px-4 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)] text-xs">{txt.noOrders}</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3 font-mono text-xs text-[var(--accent)]">{o.order_number}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{o.customer_name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{o.customer_phone}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs capitalize">{o.courier_name ?? "—"}</td>
                <td className="px-4 py-3 hidden md:table-cell font-mono text-xs">{o.courier_tracking_id ?? "—"}</td>
                <td className="px-4 py-3">
                  {o.courier_status ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[o.courier_status] ?? "bg-zinc-500/15 text-zinc-400"}`}>
                      {o.courier_status.replace(/_/g, " ")}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {(o.courier_name === "steadfast" || o.courier_name === "pathao") ? (
                    <button onClick={() => void refreshOrder(o.id)} disabled={refreshing === o.id}
                      className="rounded-xl border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-soft)] disabled:opacity-50">
                      {refreshing === o.id ? txt.refreshing : txt.refresh}
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40">
                {locale === "bn" ? "আগে" : "Prev"}
              </button>
              <span className="text-xs self-center">{page}/{lastPage}</span>
              <button disabled={page === lastPage} onClick={() => setPage(p => p + 1)}
                className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40">
                {locale === "bn" ? "পরে" : "Next"}
              </button>
            </div>
          </div>
        )}
      </div>
    </UserShell>
  );
}
