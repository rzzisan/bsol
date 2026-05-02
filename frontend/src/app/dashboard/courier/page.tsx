"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "পার্সেল বুক করুন",
    search: "অর্ডার নম্বর / ফোন",
    loading: "লোড হচ্ছে...",
    noOrders: "বুক করার মতো কোনো অর্ডার নেই। (confirmed / processing স্ট্যাটাস দরকার)",
    orderNo: "অর্ডার নং",
    customer: "গ্রাহক",
    address: "ঠিকানা",
    total: "মোট",
    courier: "কুরিয়ার",
    book: "বুক করুন",
    booking: "বুকিং হচ্ছে...",
    booked: "বুকড ✓",
    codAmount: "COD পরিমাণ (৳)",
    note: "নোট",
    trackingId: "ট্র্যাকিং আইডি",
    cancel: "বাতিল",
    confirm: "নিশ্চিত করুন",
    confirming: "হচ্ছে...",
    modalTitle: "পার্সেল বুক করুন",
    manualTracking: "ম্যানুয়াল ট্র্যাকিং",
    steadfast: "Steadfast",
    manual: "ম্যানুয়াল",
    noCredentials: "Steadfast API Key সেট করা নেই। Settings → Courier-এ যান।",
    successMsg: (id: string) => `বুকড! Consignment: ${id}`,
    errorMsg: "বুকিং ব্যর্থ হয়েছে।",
  },
  en: {
    pageTitle: "Book Parcel",
    search: "Order no / phone",
    loading: "Loading...",
    noOrders: "No orders ready to book. (Need confirmed / processing status)",
    orderNo: "Order #",
    customer: "Customer",
    address: "Address",
    total: "Total",
    courier: "Courier",
    book: "Book",
    booking: "Booking...",
    booked: "Booked ✓",
    codAmount: "COD Amount (৳)",
    note: "Note",
    trackingId: "Tracking ID",
    cancel: "Cancel",
    confirm: "Confirm",
    confirming: "Processing...",
    modalTitle: "Book Parcel",
    manualTracking: "Manual Tracking",
    steadfast: "Steadfast",
    manual: "Manual",
    noCredentials: "Steadfast API Key not configured. Go to Settings → Courier.",
    successMsg: (id: string) => `Booked! Consignment: ${id}`,
    errorMsg: "Booking failed.",
  },
};

type Order = {
  id: number; order_number: string; customer_name: string | null;
  customer_phone: string; customer_address: string | null;
  customer_district: string | null; customer_thana: string | null;
  total: string; status: string;
};

type BookForm = { courier: "steadfast" | "manual"; cod_amount: string; note: string; tracking_id: string };

export default function BookParcelPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [modal, setModal] = useState<Order | null>(null);
  const [form, setForm] = useState<BookForm>({ courier: "steadfast", cod_amount: "", note: "", tracking_id: "" });
  const [booking, setBooking] = useState(false);
  const [bookResult, setBookResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [bookedIds, setBookedIds] = useState<Set<number>>(new Set());

  const fetchReady = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`${API}/courier/ready?${params}`, { headers: { Authorization: `Bearer ${token}` } });
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

  useEffect(() => { void fetchReady(); }, [fetchReady]);
  useEffect(() => { setPage(1); }, [search]);

  const openModal = (o: Order) => {
    setModal(o);
    setForm({ courier: "steadfast", cod_amount: String(Math.round(Number(o.total))), note: "", tracking_id: "" });
    setBookResult(null);
  };

  const handleBook = async () => {
    if (!modal) return;
    setBooking(true);
    setBookResult(null);
    try {
      const body: Record<string, unknown> = {
        courier: form.courier,
        cod_amount: Number(form.cod_amount),
        note: form.note,
      };
      if (form.courier === "manual") body.tracking_id = form.tracking_id;

      const res = await fetch(`${API}/courier/book/${modal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const id = data.consignment_id ? String(data.consignment_id) : (form.tracking_id || "saved");
        setBookResult({ success: true, msg: txt.successMsg(id) });
        setBookedIds(prev => new Set([...prev, modal.id]));
        setTimeout(() => { setModal(null); void fetchReady(); }, 1500);
      } else {
        setBookResult({ success: false, msg: data.message ?? txt.errorMsg });
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <UserShell activeKey="book-parcel" defaultExpandedKey="courier"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {/* Toolbar */}
      <div className="catv-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={txt.search}
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <p className="text-xs text-[var(--muted)]">{total} {locale === "bn" ? "টি অর্ডার রেডি" : "orders ready"}</p>
      </div>

      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.orderNo}</th>
              <th className="px-4 py-3">{txt.customer}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.address}</th>
              <th className="px-4 py-3 text-right">{txt.total}</th>
              <th className="px-4 py-3 text-right">{txt.book}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)] text-xs">{txt.noOrders}</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3 font-mono text-xs text-[var(--accent)]">{o.order_number}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{o.customer_name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{o.customer_phone}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted)]">
                  {[o.customer_address, o.customer_district, o.customer_thana].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold">৳{Number(o.total).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  {bookedIds.has(o.id) ? (
                    <span className="rounded-lg bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">{txt.booked}</span>
                  ) : (
                    <button onClick={() => openModal(o)}
                      className="rounded-xl bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
                      {txt.book}
                    </button>
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

      {/* Book modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold">{txt.modalTitle}</h3>
            <p className="mb-4 text-xs text-[var(--muted)]">{modal.order_number} — {modal.customer_name ?? modal.customer_phone}</p>

            {bookResult && (
              <div className={`mb-4 rounded-xl px-3 py-2 text-sm ${bookResult.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {bookResult.msg}
              </div>
            )}

            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.courier}</span>
                <select value={form.courier} onChange={e => setForm(f => ({ ...f, courier: e.target.value as "steadfast"|"manual" }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="steadfast">{txt.steadfast}</option>
                  <option value="manual">{txt.manual}</option>
                </select>
              </label>

              {form.courier === "manual" ? (
                <label>
                  <span className="mb-1 block text-xs text-[var(--muted)]">{txt.trackingId}</span>
                  <input value={form.tracking_id} onChange={e => setForm(f => ({ ...f, tracking_id: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </label>
              ) : (
                <label>
                  <span className="mb-1 block text-xs text-[var(--muted)]">{txt.codAmount}</span>
                  <input type="number" value={form.cod_amount} onChange={e => setForm(f => ({ ...f, cod_amount: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </label>
              )}

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.note}</span>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.cancel}</button>
              <button onClick={handleBook} disabled={booking}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {booking ? txt.confirming : txt.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
