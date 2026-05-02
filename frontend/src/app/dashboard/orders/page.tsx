"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const STATUSES = ["pending","confirmed","processing","shipped","delivered","cancelled","returned"] as const;
type Status = typeof STATUSES[number];

const statusColor: Record<Status, string> = {
  pending:    "bg-yellow-500/15 text-yellow-400",
  confirmed:  "bg-blue-500/15 text-blue-400",
  processing: "bg-indigo-500/15 text-indigo-400",
  shipped:    "bg-purple-500/15 text-purple-400",
  delivered:  "bg-emerald-500/15 text-emerald-400",
  cancelled:  "bg-red-500/15 text-red-400",
  returned:   "bg-orange-500/15 text-orange-400",
};

const riskColor: Record<string, string> = {
  low:    "bg-emerald-500/10 text-emerald-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  high:   "bg-red-500/10 text-red-400",
};

const t = {
  bn: {
    pageTitle: "অর্ডার তালিকা",
    createOrder: "নতুন অর্ডার",
    loading: "লোড হচ্ছে...",
    noOrders: "কোনো অর্ডার নেই।",
    search: "অর্ডার নম্বর / নাম / ফোন",
    allStatuses: "সব স্ট্যাটাস",
    bulkUpdate: "বাল্ক স্ট্যাটাস পরিবর্তন",
    applyBulk: "প্রয়োগ করুন",
    orderNo: "অর্ডার নং",
    customer: "গ্রাহক",
    total: "মোট",
    status: "স্ট্যাটাস",
    risk: "ঝুঁকি",
    date: "তারিখ",
    actions: "অ্যাকশন",
    view: "দেখুন",
    statusNames: { pending:"অপেক্ষমান", confirmed:"নিশ্চিত", processing:"প্রক্রিয়াধীন",
                   shipped:"পাঠানো হয়েছে", delivered:"ডেলিভারি হয়েছে", cancelled:"বাতিল", returned:"ফেরত" },
    riskNames: { low:"কম", medium:"মাঝারি", high:"উচ্চ" },
    totalOrders: "মোট অর্ডার",
    todayOrders: "আজকের অর্ডার",
    pendingOrders: "অপেক্ষমান",
    deliveredOrders: "ডেলিভারি হয়েছে",
    changeStatusTitle: "স্ট্যাটাস পরিবর্তন",
    note: "নোট",
    save: "সংরক্ষণ",
    cancel: "বাতিল",
    saving: "সংরক্ষণ হচ্ছে...",
  },
  en: {
    pageTitle: "Order List",
    createOrder: "New Order",
    loading: "Loading...",
    noOrders: "No orders found.",
    search: "Order no / name / phone",
    allStatuses: "All Statuses",
    bulkUpdate: "Bulk Status Update",
    applyBulk: "Apply",
    orderNo: "Order #",
    customer: "Customer",
    total: "Total",
    status: "Status",
    risk: "Risk",
    date: "Date",
    actions: "Actions",
    view: "View",
    statusNames: { pending:"Pending", confirmed:"Confirmed", processing:"Processing",
                   shipped:"Shipped", delivered:"Delivered", cancelled:"Cancelled", returned:"Returned" },
    riskNames: { low:"Low", medium:"Medium", high:"High" },
    totalOrders: "Total Orders",
    todayOrders: "Today",
    pendingOrders: "Pending",
    deliveredOrders: "Delivered",
    changeStatusTitle: "Change Status",
    note: "Note",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
  },
};

type Order = {
  id: number; order_number: string; customer_name: string | null;
  customer_phone: string; total: string; status: Status;
  risk_level: string; created_at: string; payment_status: string;
};
type Stats = { total: number; today: number; pending: number; delivered: number };

export default function OrdersPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, pending: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // bulk
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<Status>("confirmed");
  const [bulkLoading, setBulkLoading] = useState(false);

  // status change modal
  const [statusModal, setStatusModal] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<Status>("confirmed");
  const [statusNote, setStatusNote] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const token = getStoredToken();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search) params.set("search", search);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const [ordRes, statRes] = await Promise.all([
        fetch(`${API}/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/orders/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (ordRes.ok) {
        const d = await ordRes.json();
        setOrders(d.data ?? []);
        setTotal(d.meta?.total ?? 0);
        setLastPage(d.meta?.last_page ?? 1);
      }
      if (statRes.ok) {
        const d = await statRes.json();
        setStats({ total: d.data?.total ?? 0, today: d.data?.today ?? 0, pending: d.data?.pending ?? 0, delivered: d.data?.delivered ?? 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, filterStatus]);

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(prev => prev.size === orders.length ? new Set() : new Set(orders.map(o => o.id)));

  const applyBulk = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    await fetch(`${API}/orders/bulk-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: [...selected], status: bulkStatus }),
    });
    setSelected(new Set());
    setBulkLoading(false);
    void fetchData();
  };

  const openStatusModal = (o: Order) => { setStatusModal(o); setNewStatus(o.status); setStatusNote(""); };
  const closeStatusModal = () => setStatusModal(null);

  const handleStatusSave = async () => {
    if (!statusModal) return;
    setStatusSaving(true);
    await fetch(`${API}/orders/${statusModal.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus, note: statusNote }),
    });
    setStatusSaving(false);
    closeStatusModal();
    void fetchData();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", { day: "2-digit", month: "short", year: "2-digit" });

  return (
    <UserShell activeKey="all-orders" defaultExpandedKey="orders"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: txt.totalOrders,     value: stats.total,     color: "bg-[#0f7c7b]" },
          { label: txt.todayOrders,     value: stats.today,     color: "bg-[#2f7ec1]" },
          { label: txt.pendingOrders,   value: stats.pending,   color: "bg-[#b8860b]" },
          { label: txt.deliveredOrders, value: stats.delivered, color: "bg-[#196c40]" },
        ].map(c => (
          <article key={c.label} className={`${c.color} rounded-2xl p-4 text-white`}>
            <p className="text-xs text-white/80">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "..." : c.value}</p>
          </article>
        ))}
      </div>

      {/* Toolbar */}
      <div className="catv-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={txt.search}
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="all">{txt.allStatuses}</option>
          {STATUSES.map(s => <option key={s} value={s}>{txt.statusNames[s]}</option>)}
        </select>

        {/* Bulk update strip */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-1.5 text-sm">
            <span className="text-[var(--accent)] font-semibold">{selected.size}</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as Status)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs">
              {STATUSES.map(s => <option key={s} value={s}>{txt.statusNames[s]}</option>)}
            </select>
            <button onClick={applyBulk} disabled={bulkLoading}
              className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
              {txt.applyBulk}
            </button>
          </div>
        )}

        <Link href="/dashboard/orders/create"
          className="ml-auto rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + {txt.createOrder}
        </Link>
      </div>

      {/* Table */}
      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-3 py-3 w-8">
                <input type="checkbox" checked={selected.size === orders.length && orders.length > 0}
                  onChange={toggleAll} className="accent-[var(--accent)]" />
              </th>
              <th className="px-3 py-3">{txt.orderNo}</th>
              <th className="px-3 py-3">{txt.customer}</th>
              <th className="px-3 py-3 text-right">{txt.total}</th>
              <th className="px-3 py-3">{txt.status}</th>
              <th className="px-3 py-3 hidden md:table-cell">{txt.risk}</th>
              <th className="px-3 py-3 hidden md:table-cell">{txt.date}</th>
              <th className="px-3 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noOrders}</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)}
                    className="accent-[var(--accent)]" />
                </td>
                <td className="px-3 py-3 font-mono text-xs text-[var(--accent)]">{o.order_number}</td>
                <td className="px-3 py-3">
                  <p className="font-medium">{o.customer_name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{o.customer_phone}</p>
                </td>
                <td className="px-3 py-3 text-right font-semibold">৳{Number(o.total).toLocaleString()}</td>
                <td className="px-3 py-3">
                  <button onClick={() => openStatusModal(o)}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 ${statusColor[o.status] ?? ""}`}>
                    {txt.statusNames[o.status]}
                  </button>
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskColor[o.risk_level] ?? ""}`}>
                    {txt.riskNames[o.risk_level as keyof typeof txt.riskNames] ?? o.risk_level}
                  </span>
                </td>
                <td className="px-3 py-3 hidden md:table-cell text-xs text-[var(--muted)]">{fmtDate(o.created_at)}</td>
                <td className="px-3 py-3 text-right">
                  <Link href={`/dashboard/orders/${o.id}`}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                    {txt.view}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">{total} {locale === "bn" ? "টি অর্ডার" : "orders"}</p>
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

      {/* Status change modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && closeStatusModal()}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold">{txt.changeStatusTitle}</h3>
            <p className="mb-4 text-xs text-[var(--muted)]">{statusModal.order_number}</p>
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.status}</span>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as Status)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  {STATUSES.map(s => <option key={s} value={s}>{txt.statusNames[s]}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.note}</span>
                <textarea rows={2} value={statusNote} onChange={e => setStatusNote(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeStatusModal} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.cancel}</button>
              <button onClick={handleStatusSave} disabled={statusSaving}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {statusSaving ? txt.saving : txt.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
