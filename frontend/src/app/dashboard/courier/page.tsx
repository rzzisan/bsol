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
    book: "বুক করুন",
    booking: "বুকিং হচ্ছে...",
    booked: "বুকড ✓",
    codAmount: "COD পরিমাণ (৳)",
    note: "নোট / বিশেষ নির্দেশনা",
    trackingId: "ট্র্যাকিং আইডি",
    cancel: "বাতিল",
    confirm: "নিশ্চিত করুন",
    confirming: "হচ্ছে...",
    modalTitle: "পার্সেল বুক করুন",
    steadfast: "Steadfast",
    pathao: "Pathao",
    manual: "ম্যানুয়াল",
    courier: "কুরিয়ার সার্ভিস",
    store: "পার্সেল পিকআপ স্টোর",
    selectStore: "স্টোর নির্বাচন করুন",
    loadingStores: "স্টোর লোড হচ্ছে...",
    deliveryType: "ডেলিভারি ধরন",
    normalDelivery: "Normal Delivery",
    onDemandDelivery: "On Demand",
    itemType: "আইটেম ধরন",
    document: "ডকুমেন্ট",
    parcel: "পার্সেল",
    itemWeight: "ওজন (KG)",
    itemDescription: "আইটেম বিবরণ (ঐচ্ছিক)",
    calcPrice: "ডেলিভারি চার্জ হিসাব",
    calculating: "হিসাব হচ্ছে...",
    deliveryFee: "ডেলিভারি ফি",
    selectAll: "সব নির্বাচন",
    bulkBook: "বাল্ক বুক",
    bulkTitle: "বাল্ক পার্সেল বুকিং",
    selectedCount: "টি সিলেক্টেড",
    bulkHint: "সিলেক্টেড অর্ডারগুলো Pathao-তে বুক হবে। প্রতিটি অর্ডারের নিজস্ব COD amount (order total) ব্যবহার হবে।",
    bulkConfirm: "একসাথে বুক করুন",
    bulkSuccess: (s: number, f: number) => `বাল্ক বুকিং শেষ। সফল: ${s}, ব্যর্থ: ${f}`,
    minTwoOrders: "বাল্ক বুকিং এর জন্য অন্তত ২টি অর্ডার নির্বাচন করুন।",
    successMsg: (id: string) => `বুকড! Consignment: ${id}`,
    errorMsg: "বুকিং ব্যর্থ হয়েছে।",
    noStoreWarning: "Pathao Store পাওয়া যায়নি। Settings → Courier-এ credentials সেট করুন।",
    prev: "আগে",
    next: "পরে",
    ordersReady: "টি অর্ডার রেডি",
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
    book: "Book",
    booking: "Booking...",
    booked: "Booked ✓",
    codAmount: "COD Amount (৳)",
    note: "Note / Special Instruction",
    trackingId: "Tracking ID",
    cancel: "Cancel",
    confirm: "Confirm",
    confirming: "Processing...",
    modalTitle: "Book Parcel",
    steadfast: "Steadfast",
    pathao: "Pathao",
    manual: "Manual",
    courier: "Courier Service",
    store: "Pickup Store",
    selectStore: "Select store",
    loadingStores: "Loading stores...",
    deliveryType: "Delivery Type",
    normalDelivery: "Normal Delivery",
    onDemandDelivery: "On Demand",
    itemType: "Item Type",
    document: "Document",
    parcel: "Parcel",
    itemWeight: "Weight (KG)",
    itemDescription: "Item Description (optional)",
    calcPrice: "Calculate Delivery Charge",
    calculating: "Calculating...",
    deliveryFee: "Delivery Fee",
    selectAll: "Select all",
    bulkBook: "Bulk Book",
    bulkTitle: "Bulk Parcel Booking",
    selectedCount: "selected",
    bulkHint: "Selected orders will be booked in Pathao. Each order will keep its own COD amount (order total).",
    bulkConfirm: "Book All",
    bulkSuccess: (s: number, f: number) => `Bulk booking completed. Success: ${s}, Failed: ${f}`,
    minTwoOrders: "Select at least 2 orders for bulk booking.",
    successMsg: (id: string) => `Booked! Consignment: ${id}`,
    errorMsg: "Booking failed.",
    noStoreWarning: "No Pathao store found. Configure credentials in Settings → Courier.",
    prev: "Prev",
    next: "Next",
    ordersReady: "orders ready",
  },
};

type Order = {
  id: number; order_number: string; customer_name: string | null;
  customer_phone: string; customer_address: string | null;
  customer_district: string | null; customer_thana: string | null; customer_area: string | null;
  pathao_city_id: number | null; pathao_zone_id: number | null; pathao_area_id: number | null;
  total: string; status: string;
};

type PathaoStore = { store_id: number; store_name: string; store_address: string; is_active: number };

type BookForm = {
  courier: "steadfast" | "pathao" | "manual";
  cod_amount: string;
  note: string;
  tracking_id: string;
  store_id: string;
  delivery_type: "48" | "12";
  item_type: "1" | "2";
  item_weight: string;
  item_description: string;
};

type BulkForm = {
  store_id: string;
  delivery_type: "48" | "12";
  item_type: "1" | "2";
  item_weight: string;
  item_description: string;
  note: string;
};

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
  const [form, setForm] = useState<BookForm>({
    courier: "pathao", cod_amount: "", note: "", tracking_id: "",
    store_id: "", delivery_type: "48", item_type: "2", item_weight: "0.5", item_description: "",
  });
  const [booking, setBooking] = useState(false);
  const [bookResult, setBookResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [bookedIds, setBookedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkBooking, setBulkBooking] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: boolean; msg: string } | null>(null);

  const [pathaoStores, setPathaoStores] = useState<PathaoStore[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storesFetched, setStoresFetched] = useState(false);
  const [priceResult, setPriceResult] = useState<{ fee: number; final: number } | null>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkForm>({
    store_id: "", delivery_type: "48", item_type: "2", item_weight: "0.5", item_description: "", note: "",
  });

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
        const visibleIds = new Set<number>((d.data ?? []).map((o: Order) => o.id));
        setSelectedIds(prev => new Set([...prev].filter(id => visibleIds.has(id))));
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, token]);

  useEffect(() => { void fetchReady(); }, [fetchReady]);
  useEffect(() => { setPage(1); }, [search]);

  const fetchPathaoStores = useCallback(async () => {
    if (storesFetched) return;
    setLoadingStores(true);
    try {
      const res = await fetch(`${API}/courier/pathao/stores`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        const active = (d.data ?? []).filter((s: PathaoStore) => s.is_active);
        setPathaoStores(active);
        if (active.length > 0) {
          setForm(f => ({ ...f, store_id: String(active[0].store_id) }));
        }
      }
    } finally {
      setLoadingStores(false);
      setStoresFetched(true);
    }
  }, [storesFetched, token]);

  const openModal = (o: Order) => {
    setModal(o);
    setForm({
      courier: "pathao", cod_amount: String(Math.round(Number(o.total))), note: "", tracking_id: "",
      store_id: pathaoStores.length > 0 ? String(pathaoStores[0].store_id) : "",
      delivery_type: "48", item_type: "2", item_weight: "0.5", item_description: "",
    });
    setBookResult(null);
    setPriceResult(null);
    void fetchPathaoStores();
  };

  const toggleSelect = (orderId: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(orderId); else next.delete(orderId);
      return next;
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const visible = orders.filter(o => !bookedIds.has(o.id)).map(o => o.id);
      visible.forEach(id => checked ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const openBulkModal = () => {
    if (selectedIds.size < 2) {
      setBulkResult({ success: false, msg: txt.minTwoOrders });
      return;
    }
    setBulkResult(null);
    setBulkForm({
      store_id: pathaoStores.length > 0 ? String(pathaoStores[0].store_id) : "",
      delivery_type: "48",
      item_type: "2",
      item_weight: "0.5",
      item_description: "",
      note: "",
    });
    setBulkModal(true);
    void fetchPathaoStores();
  };

  const handleBulkBook = async () => {
    if (selectedIds.size < 2) return;
    setBulkBooking(true);
    setBulkResult(null);
    try {
      const res = await fetch(`${API}/courier/book/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          courier: "pathao",
          order_ids: Array.from(selectedIds),
          store_id: bulkForm.store_id ? Number(bulkForm.store_id) : undefined,
          delivery_type: Number(bulkForm.delivery_type),
          item_type: Number(bulkForm.item_type),
          item_weight: Number(bulkForm.item_weight),
          item_description: bulkForm.item_description || undefined,
          note: bulkForm.note || undefined,
        }),
      });
      const d = await res.json();
      if (res.ok && d.data) {
        const successIds = (d.data.results ?? []).filter((r: { success: boolean; order_id: number }) => r.success).map((r: { success: boolean; order_id: number }) => r.order_id);
        setBookedIds(prev => new Set([...prev, ...successIds]));
        setSelectedIds(prev => {
          const next = new Set(prev);
          successIds.forEach((id: number) => next.delete(id));
          return next;
        });
        setBulkResult({ success: true, msg: txt.bulkSuccess(d.data.success ?? 0, d.data.failed ?? 0) });
        setTimeout(() => { setBulkModal(false); void fetchReady(); }, 1800);
      } else {
        setBulkResult({ success: false, msg: d.message ?? txt.errorMsg });
      }
    } finally {
      setBulkBooking(false);
    }
  };

  const calculatePathaoPrice = async () => {
    if (!modal || !form.store_id) return;
    if (!modal.pathao_city_id || !modal.pathao_zone_id) return;
    setCalculatingPrice(true);
    setPriceResult(null);
    try {
      const res = await fetch(`${API}/courier/pathao/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          store_id: Number(form.store_id),
          item_type: Number(form.item_type),
          delivery_type: Number(form.delivery_type),
          item_weight: Number(form.item_weight),
          recipient_city: modal.pathao_city_id,
          recipient_zone: modal.pathao_zone_id,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setPriceResult({ fee: d.data.price, final: d.data.final_price });
      }
    } finally {
      setCalculatingPrice(false);
    }
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

      if (form.courier === "manual") {
        body.tracking_id = form.tracking_id;
      } else if (form.courier === "pathao") {
        if (form.store_id) body.store_id = Number(form.store_id);
        body.delivery_type = Number(form.delivery_type);
        body.item_type = Number(form.item_type);
        body.item_weight = Number(form.item_weight);
        if (form.item_description) body.item_description = form.item_description;
        if (form.note) body.special_instruction = form.note;
      }

      const res = await fetch(`${API}/courier/book/${modal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const id = data.consignment_id ? String(data.consignment_id) : (form.tracking_id || "saved");
        const feeMsg = data.delivery_fee ? ` | Fee: ৳${data.delivery_fee}` : "";
        setBookResult({ success: true, msg: txt.successMsg(id) + feeMsg });
        setBookedIds(prev => new Set([...prev, modal.id]));
        setTimeout(() => { setModal(null); void fetchReady(); }, 2000);
      } else {
        const errMsg = data.errors
          ? Object.values(data.errors as Record<string, string[]>).flat().join(", ")
          : (data.message ?? txt.errorMsg);
        setBookResult({ success: false, msg: errMsg });
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <UserShell activeKey="book-parcel" defaultExpandedKey="courier"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      <div className="catv-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={txt.search}
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <button onClick={() => openBulkModal()}
          disabled={selectedIds.size < 2}
          className="rounded-xl border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-40 disabled:cursor-not-allowed">
          {txt.bulkBook} ({selectedIds.size})
        </button>
        <p className="text-xs text-[var(--muted)]">{total} {txt.ordersReady}</p>
      </div>

      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  aria-label={txt.selectAll}
                  checked={orders.length > 0 && orders.filter(o => !bookedIds.has(o.id)).every(o => selectedIds.has(o.id))}
                  onChange={e => toggleSelectAllVisible(e.target.checked)}
                  className="h-4 w-4"
                />
              </th>
              <th className="px-4 py-3">{txt.orderNo}</th>
              <th className="px-4 py-3">{txt.customer}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.address}</th>
              <th className="px-4 py-3 text-right">{txt.total}</th>
              <th className="px-4 py-3 text-right">{txt.book}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)] text-xs">{txt.noOrders}</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3">
                  {!bookedIds.has(o.id) && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(o.id)}
                      onChange={e => toggleSelect(o.id, e.target.checked)}
                      className="h-4 w-4"
                    />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--accent)]">{o.order_number}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{o.customer_name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{o.customer_phone}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted)]">
                  {[o.customer_address, o.customer_district, o.customer_thana, o.customer_area].filter(Boolean).join(", ") || "—"}
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
          <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-3">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40">{txt.prev}</button>
            <span className="text-xs">{page}/{lastPage}</span>
            <button disabled={page === lastPage} onClick={() => setPage(p => p + 1)}
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40">{txt.next}</button>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] p-6 shadow-xl overflow-y-auto max-h-[90vh]">
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
                <select value={form.courier}
                  onChange={e => { setForm(f => ({ ...f, courier: e.target.value as BookForm["courier"] })); setPriceResult(null); if (e.target.value === "pathao") void fetchPathaoStores(); }}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="pathao">{txt.pathao}</option>
                  <option value="steadfast">{txt.steadfast}</option>
                  <option value="manual">{txt.manual}</option>
                </select>
              </label>

              {form.courier === "manual" && (
                <label>
                  <span className="mb-1 block text-xs text-[var(--muted)]">{txt.trackingId}</span>
                  <input value={form.tracking_id} onChange={e => setForm(f => ({ ...f, tracking_id: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </label>
              )}

              {form.courier === "pathao" && (
                <>
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">{txt.store}</span>
                    <select value={form.store_id} onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
                      disabled={loadingStores}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-50">
                      <option value="">{loadingStores ? txt.loadingStores : txt.selectStore}</option>
                      {pathaoStores.map(s => (
                        <option key={s.store_id} value={s.store_id}>{s.store_name}</option>
                      ))}
                    </select>
                    {storesFetched && !loadingStores && pathaoStores.length === 0 && (
                      <p className="mt-1 text-xs text-amber-400">{txt.noStoreWarning}</p>
                    )}
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.deliveryType}</span>
                      <select value={form.delivery_type} onChange={e => setForm(f => ({ ...f, delivery_type: e.target.value as "48"|"12" }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                        <option value="48">{txt.normalDelivery}</option>
                        <option value="12">{txt.onDemandDelivery}</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.itemType}</span>
                      <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value as "1"|"2" }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                        <option value="2">{txt.parcel}</option>
                        <option value="1">{txt.document}</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">{txt.itemWeight} (0.5–10 KG)</span>
                    <input type="number" step="0.5" min="0.5" max="10" value={form.item_weight}
                      onChange={e => setForm(f => ({ ...f, item_weight: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                  </label>

                  {modal.pathao_city_id && modal.pathao_zone_id && form.store_id && (
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => void calculatePathaoPrice()} disabled={calculatingPrice}
                        className="rounded-xl border border-[var(--accent)] px-3 py-1.5 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-60">
                        {calculatingPrice ? txt.calculating : txt.calcPrice}
                      </button>
                      {priceResult && (
                        <span className="text-sm font-semibold text-emerald-400">
                          {txt.deliveryFee}: ৳{priceResult.final}
                        </span>
                      )}
                    </div>
                  )}

                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">{txt.itemDescription}</span>
                    <input value={form.item_description} onChange={e => setForm(f => ({ ...f, item_description: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                  </label>
                </>
              )}

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.codAmount}</span>
                <input type="number" value={form.cod_amount} onChange={e => setForm(f => ({ ...f, cod_amount: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.note}</span>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setModal(null)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">
                {txt.cancel}
              </button>
              <button onClick={() => void handleBook()} disabled={booking}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {booking ? txt.confirming : txt.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && setBulkModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-[var(--surface)] p-6 shadow-xl overflow-y-auto max-h-[90vh]">
            <h3 className="mb-1 text-base font-bold">{txt.bulkTitle}</h3>
            <p className="mb-3 text-xs text-[var(--muted)]">{selectedIds.size} {txt.selectedCount}</p>
            <p className="mb-4 text-xs text-[var(--muted)]">{txt.bulkHint}</p>

            {bulkResult && (
              <div className={`mb-4 rounded-xl px-3 py-2 text-sm ${bulkResult.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {bulkResult.msg}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.store}</span>
                <select value={bulkForm.store_id} onChange={e => setBulkForm(f => ({ ...f, store_id: e.target.value }))}
                  disabled={loadingStores}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">{loadingStores ? txt.loadingStores : txt.selectStore}</option>
                  {pathaoStores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.deliveryType}</span>
                <select value={bulkForm.delivery_type} onChange={e => setBulkForm(f => ({ ...f, delivery_type: e.target.value as "48"|"12" }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="48">{txt.normalDelivery}</option>
                  <option value="12">{txt.onDemandDelivery}</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.itemType}</span>
                <select value={bulkForm.item_type} onChange={e => setBulkForm(f => ({ ...f, item_type: e.target.value as "1"|"2" }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="2">{txt.parcel}</option>
                  <option value="1">{txt.document}</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.itemWeight}</span>
                <input type="number" min="0.5" max="10" step="0.5"
                  value={bulkForm.item_weight}
                  onChange={e => setBulkForm(f => ({ ...f, item_weight: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.itemDescription}</span>
                <input value={bulkForm.item_description}
                  onChange={e => setBulkForm(f => ({ ...f, item_description: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.note}</span>
                <input value={bulkForm.note}
                  onChange={e => setBulkForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setBulkModal(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">
                {txt.cancel}
              </button>
              <button onClick={() => void handleBulkBook()} disabled={bulkBooking || !bulkForm.store_id}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {bulkBooking ? txt.confirming : txt.bulkConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
