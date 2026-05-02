"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

// ── Status helpers ──────────────────────────────────────────────────────────

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_STYLE: Record<string, string> = {
  pending:    "bg-yellow-500/15 text-yellow-400",
  confirmed:  "bg-blue-500/15 text-blue-400",
  processing: "bg-indigo-500/15 text-indigo-400",
  shipped:    "bg-cyan-500/15 text-cyan-400",
  delivered:  "bg-emerald-500/15 text-emerald-400",
  cancelled:  "bg-red-500/15 text-red-400",
  returned:   "bg-orange-500/15 text-orange-400",
};

const PAYMENT_STYLE: Record<string, string> = {
  due:     "bg-red-500/15 text-red-400",
  partial: "bg-yellow-500/15 text-yellow-400",
  paid:    "bg-emerald-500/15 text-emerald-400",
};

const RISK_STYLE: Record<string, string> = {
  low:    "bg-emerald-500/15 text-emerald-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  high:   "bg-red-500/15 text-red-400",
};

const COURIER_STATUS_STYLE: Record<string, string> = {
  booked:            "bg-blue-500/15 text-blue-400",
  in_transit:        "bg-yellow-500/15 text-yellow-400",
  delivered:         "bg-emerald-500/15 text-emerald-400",
  returned:          "bg-red-500/15 text-red-400",
  partial_delivered: "bg-orange-500/15 text-orange-400",
  cancelled:         "bg-zinc-500/15 text-zinc-400",
};

// ── Types ───────────────────────────────────────────────────────────────────

type OrderItem = {
  id: number; product_name: string; sku: string | null;
  quantity: number; unit_price: string; total: string;
  variant_info: Record<string, string> | null;
};

type StatusLog = {
  id: number; old_status: string | null; new_status: string;
  note: string | null; created_at: string;
  changed_by_user: { name: string } | null;
};

type Order = {
  id: number; order_number: string; status: OrderStatus;
  customer_name: string | null; customer_phone: string;
  customer_address: string | null; customer_district: string | null; customer_thana: string | null;
  source: string | null; source_ref: string | null;
  payment_method: string | null; payment_status: string;
  subtotal: string; shipping_charge: string; discount: string; total: string;
  notes: string | null; fraud_score: number; risk_level: string;
  courier_name: string | null; courier_tracking_id: string | null;
  courier_status: string | null; courier_charge: string | null;
  created_at: string; updated_at: string;
  items: OrderItem[]; status_logs: StatusLog[];
};

// ── Translations ─────────────────────────────────────────────────────────────

const t = {
  bn: {
    pageTitle: "অর্ডার বিস্তারিত",
    loading: "লোড হচ্ছে...",
    notFound: "অর্ডার পাওয়া যায়নি।",
    back: "← ফিরে যান",
    editOrder: "সম্পাদনা",
    changeStatus: "স্ট্যাটাস পরিবর্তন",
    bookCourier: "কুরিয়ার বুক করুন",
    deleteOrder: "মুছুন",
    confirmDelete: "এই অর্ডার মুছে ফেলবেন?",
    orderInfo: "অর্ডার তথ্য",
    customerInfo: "গ্রাহক তথ্য",
    items: "পণ্য তালিকা",
    paymentSummary: "পেমেন্ট সারসংক্ষেপ",
    courierInfo: "কুরিয়ার তথ্য",
    statusTimeline: "স্ট্যাটাস টাইমলাইন",
    orderNo: "অর্ডার নং",
    date: "তারিখ",
    source: "সোর্স",
    status: "স্ট্যাটাস",
    riskLevel: "ঝুঁকি স্তর",
    fraudScore: "ফ্রড স্কোর",
    name: "নাম",
    phone: "ফোন",
    address: "ঠিকানা",
    district: "জেলা",
    thana: "থানা",
    product: "পণ্য",
    qty: "পরিমাণ",
    unitPrice: "একক মূল্য",
    total: "মোট",
    subtotal: "সাবটোটাল",
    shipping: "শিপিং চার্জ",
    discount: "ছাড়",
    grandTotal: "সর্বমোট",
    paymentMethod: "পেমেন্ট পদ্ধতি",
    paymentStatus: "পেমেন্ট স্ট্যাটাস",
    courier: "কুরিয়ার",
    trackingId: "ট্র্যাকিং আইডি",
    courierStatus: "কুরিয়ার স্ট্যাটাস",
    courierCharge: "কুরিয়ার চার্জ",
    notes: "নোট",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    cancel: "বাতিল",
    newStatus: "নতুন স্ট্যাটাস",
    statusNote: "নোট (ঐচ্ছিক)",
    confirm: "নিশ্চিত করুন",
    confirming: "হচ্ছে...",
    deleteSuccess: "অর্ডার মুছে ফেলা হয়েছে।",
    updateSuccess: "অর্ডার আপডেট হয়েছে।",
    statusUpdated: "স্ট্যাটাস পরিবর্তন হয়েছে।",
    noCourier: "কুরিয়ার বুক করা হয়নি",
    noItems: "কোনো পণ্য নেই",
    noLogs: "কোনো স্ট্যাটাস পরিবর্তন নেই",
    variant: "ভেরিয়েন্ট",
    unknown: "অজানা",
    by: "দ্বারা",
  },
  en: {
    pageTitle: "Order Detail",
    loading: "Loading...",
    notFound: "Order not found.",
    back: "← Back",
    editOrder: "Edit",
    changeStatus: "Change Status",
    bookCourier: "Book Courier",
    deleteOrder: "Delete",
    confirmDelete: "Delete this order?",
    orderInfo: "Order Info",
    customerInfo: "Customer Info",
    items: "Items",
    paymentSummary: "Payment Summary",
    courierInfo: "Courier Info",
    statusTimeline: "Status Timeline",
    orderNo: "Order #",
    date: "Date",
    source: "Source",
    status: "Status",
    riskLevel: "Risk Level",
    fraudScore: "Fraud Score",
    name: "Name",
    phone: "Phone",
    address: "Address",
    district: "District",
    thana: "Thana",
    product: "Product",
    qty: "Qty",
    unitPrice: "Unit Price",
    total: "Total",
    subtotal: "Subtotal",
    shipping: "Shipping",
    discount: "Discount",
    grandTotal: "Grand Total",
    paymentMethod: "Payment Method",
    paymentStatus: "Payment Status",
    courier: "Courier",
    trackingId: "Tracking ID",
    courierStatus: "Courier Status",
    courierCharge: "Courier Charge",
    notes: "Notes",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    newStatus: "New Status",
    statusNote: "Note (optional)",
    confirm: "Confirm",
    confirming: "Processing...",
    deleteSuccess: "Order deleted.",
    updateSuccess: "Order updated.",
    statusUpdated: "Status updated.",
    noCourier: "No courier booked",
    noItems: "No items",
    noLogs: "No status changes",
    variant: "Variant",
    unknown: "Unknown",
    by: "by",
  },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // modals
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // edit form
  const [editForm, setEditForm] = useState({
    customer_name: "", customer_phone: "", customer_address: "",
    customer_district: "", customer_thana: "",
    payment_method: "", payment_status: "",
    shipping_charge: "", discount: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  // status form
  const [statusForm, setStatusForm] = useState({ status: "" as OrderStatus | "", note: "" });
  const [changingStatus, setChangingStatus] = useState(false);

  // deleting
  const [deleting, setDeleting] = useState(false);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setOrder(d.data);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => { void fetchOrder(); }, [fetchOrder]);

  const openEdit = () => {
    if (!order) return;
    setEditForm({
      customer_name: order.customer_name ?? "",
      customer_phone: order.customer_phone,
      customer_address: order.customer_address ?? "",
      customer_district: order.customer_district ?? "",
      customer_thana: order.customer_thana ?? "",
      payment_method: order.payment_method ?? "",
      payment_status: order.payment_status,
      shipping_charge: order.shipping_charge,
      discount: order.discount,
      notes: order.notes ?? "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...editForm,
          shipping_charge: Number(editForm.shipping_charge),
          discount: Number(editForm.discount),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast("success", txt.updateSuccess);
        setEditOpen(false);
        await fetchOrder();
      } else {
        showToast("error", d.message ?? "Error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!order || !statusForm.status) return;
    setChangingStatus(true);
    try {
      const res = await fetch(`${API}/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: statusForm.status, note: statusForm.note }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast("success", txt.statusUpdated);
        setStatusOpen(false);
        await fetchOrder();
      } else {
        showToast("error", d.message ?? "Error");
      }
    } finally {
      setChangingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/orders/${order.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("success", txt.deleteSuccess);
        setTimeout(() => router.push("/dashboard/orders"), 1000);
      }
    } finally {
      setDeleting(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", {
      dateStyle: "medium", timeStyle: "short",
    });

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <UserShell activeKey="all-orders" defaultExpandedKey="orders"
        pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
        <div className="catv-panel p-10 text-center text-[var(--muted)]">{txt.loading}</div>
      </UserShell>
    );
  }

  if (!order) {
    return (
      <UserShell activeKey="all-orders" defaultExpandedKey="orders"
        pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
        <div className="catv-panel p-10 text-center text-[var(--muted)]">{txt.notFound}</div>
      </UserShell>
    );
  }

  return (
    <UserShell activeKey="all-orders" defaultExpandedKey="orders"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2.5 text-sm shadow-xl ${
          toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
        }`}>{toast.msg}</div>
      )}

      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push("/dashboard/orders")}
          className="text-sm text-[var(--accent)] hover:underline">{txt.back}</button>

        <div className="flex flex-wrap gap-2">
          <button onClick={openEdit}
            className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-soft)]">
            {txt.editOrder}
          </button>
          <button onClick={() => { setStatusForm({ status: order.status, note: "" }); setStatusOpen(true); }}
            className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-soft)]">
            {txt.changeStatus}
          </button>
          {!order.courier_tracking_id && (
            <button onClick={() => router.push("/dashboard/courier")}
              className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              {txt.bookCourier}
            </button>
          )}
          <button onClick={() => setDeleteOpen(true)}
            className="rounded-xl border border-red-500/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
            {txt.deleteOrder}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Order Info */}
        <div className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{txt.orderInfo}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <dt className="text-[var(--muted)]">{txt.orderNo}</dt>
            <dd className="font-mono font-semibold text-[var(--accent)]">{order.order_number}</dd>

            <dt className="text-[var(--muted)]">{txt.date}</dt>
            <dd>{fmtDate(order.created_at)}</dd>

            <dt className="text-[var(--muted)]">{txt.status}</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[order.status] ?? ""}`}>
                {order.status}
              </span>
            </dd>

            <dt className="text-[var(--muted)]">{txt.source}</dt>
            <dd className="capitalize">{order.source ?? "—"}</dd>

            {order.source_ref && (
              <>
                <dt className="text-[var(--muted)]">Ref</dt>
                <dd className="truncate">{order.source_ref}</dd>
              </>
            )}

            <dt className="text-[var(--muted)]">{txt.riskLevel}</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${RISK_STYLE[order.risk_level] ?? ""}`}>
                {order.risk_level}
              </span>
            </dd>

            <dt className="text-[var(--muted)]">{txt.fraudScore}</dt>
            <dd>{order.fraud_score}</dd>

            {order.notes && (
              <>
                <dt className="text-[var(--muted)]">{txt.notes}</dt>
                <dd className="col-span-1 break-words">{order.notes}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Customer Info */}
        <div className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{txt.customerInfo}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <dt className="text-[var(--muted)]">{txt.name}</dt>
            <dd>{order.customer_name ?? "—"}</dd>

            <dt className="text-[var(--muted)]">{txt.phone}</dt>
            <dd className="font-mono">{order.customer_phone}</dd>

            <dt className="text-[var(--muted)]">{txt.address}</dt>
            <dd>{order.customer_address ?? "—"}</dd>

            <dt className="text-[var(--muted)]">{txt.district}</dt>
            <dd>{order.customer_district ?? "—"}</dd>

            <dt className="text-[var(--muted)]">{txt.thana}</dt>
            <dd>{order.customer_thana ?? "—"}</dd>
          </dl>
        </div>

        {/* Items */}
        <div className="catv-panel p-4 md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">{txt.items}</h3>
          {order.items.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">{txt.noItems}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)] uppercase">
                    <th className="pb-2 pr-4">{txt.product}</th>
                    <th className="pb-2 pr-4 text-right">{txt.qty}</th>
                    <th className="pb-2 pr-4 text-right">{txt.unitPrice}</th>
                    <th className="pb-2 text-right">{txt.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map(item => (
                    <tr key={item.id} className="border-b border-[var(--border)]/50">
                      <td className="py-2 pr-4">
                        <p className="font-medium">{item.product_name}</p>
                        {item.sku && <p className="text-[var(--muted)]">SKU: {item.sku}</p>}
                        {item.variant_info && Object.entries(item.variant_info).map(([k, v]) => (
                          <p key={k} className="text-[var(--muted)]">{k}: {v}</p>
                        ))}
                      </td>
                      <td className="py-2 pr-4 text-right">{item.quantity}</td>
                      <td className="py-2 pr-4 text-right">৳{Number(item.unit_price).toLocaleString()}</td>
                      <td className="py-2 text-right font-semibold">৳{Number(item.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Summary */}
        <div className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{txt.paymentSummary}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <dt className="text-[var(--muted)]">{txt.subtotal}</dt>
            <dd className="text-right">৳{Number(order.subtotal).toLocaleString()}</dd>

            <dt className="text-[var(--muted)]">{txt.shipping}</dt>
            <dd className="text-right">৳{Number(order.shipping_charge).toLocaleString()}</dd>

            {Number(order.discount) > 0 && (
              <>
                <dt className="text-[var(--muted)]">{txt.discount}</dt>
                <dd className="text-right text-emerald-400">-৳{Number(order.discount).toLocaleString()}</dd>
              </>
            )}

            <dt className="border-t border-[var(--border)] pt-2 font-semibold text-[var(--foreground)]">{txt.grandTotal}</dt>
            <dd className="border-t border-[var(--border)] pt-2 text-right font-bold">৳{Number(order.total).toLocaleString()}</dd>

            <dt className="text-[var(--muted)]">{txt.paymentMethod}</dt>
            <dd className="text-right capitalize">{order.payment_method ?? "—"}</dd>

            <dt className="text-[var(--muted)]">{txt.paymentStatus}</dt>
            <dd className="text-right">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${PAYMENT_STYLE[order.payment_status] ?? ""}`}>
                {order.payment_status}
              </span>
            </dd>
          </dl>
        </div>

        {/* Courier Info */}
        <div className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{txt.courierInfo}</h3>
          {!order.courier_name ? (
            <p className="text-xs text-[var(--muted)]">{txt.noCourier}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <dt className="text-[var(--muted)]">{txt.courier}</dt>
              <dd className="capitalize">{order.courier_name}</dd>

              <dt className="text-[var(--muted)]">{txt.trackingId}</dt>
              <dd className="font-mono">{order.courier_tracking_id ?? "—"}</dd>

              {order.courier_status && (
                <>
                  <dt className="text-[var(--muted)]">{txt.courierStatus}</dt>
                  <dd>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${COURIER_STATUS_STYLE[order.courier_status] ?? "bg-zinc-500/15 text-zinc-400"}`}>
                      {order.courier_status.replace(/_/g, " ")}
                    </span>
                  </dd>
                </>
              )}

              {order.courier_charge && (
                <>
                  <dt className="text-[var(--muted)]">{txt.courierCharge}</dt>
                  <dd>৳{Number(order.courier_charge).toLocaleString()}</dd>
                </>
              )}
            </dl>
          )}
        </div>

        {/* Status Timeline */}
        <div className="catv-panel p-4 md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">{txt.statusTimeline}</h3>
          {order.status_logs.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">{txt.noLogs}</p>
          ) : (
            <ol className="relative ml-3 border-l border-[var(--border)]">
              {[...order.status_logs].reverse().map((log, i) => (
                <li key={log.id} className={`mb-4 ml-4 ${i === 0 ? "opacity-100" : "opacity-75"}`}>
                  <span className={`absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-[var(--surface)] ${STATUS_STYLE[log.new_status] ?? "bg-zinc-400"}`} />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[log.new_status] ?? ""}`}>
                      {log.new_status}
                    </span>
                    {log.old_status && (
                      <span className="text-xs text-[var(--muted)]">← {log.old_status}</span>
                    )}
                    <span className="text-xs text-[var(--muted)]">
                      {fmtDate(log.created_at)}
                      {log.changed_by_user?.name && ` · ${txt.by} ${log.changed_by_user.name}`}
                    </span>
                  </div>
                  {log.note && <p className="mt-0.5 text-xs text-[var(--muted)]">{log.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && setEditOpen(false)}>
          <div className="my-8 w-full max-w-lg rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-4 text-base font-bold">{txt.editOrder}</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {([
                ["customer_name",    txt.name],
                ["customer_phone",   txt.phone],
                ["customer_address", txt.address],
                ["customer_district",txt.district],
                ["customer_thana",   txt.thana],
              ] as [keyof typeof editForm, string][]).map(([field, label]) => (
                <label key={field} className={field === "customer_address" ? "col-span-2" : ""}>
                  <span className="mb-1 block text-xs text-[var(--muted)]">{label}</span>
                  <input value={editForm[field]}
                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </label>
              ))}

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.paymentMethod}</span>
                <select value={editForm.payment_method}
                  onChange={e => setEditForm(f => ({ ...f, payment_method: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="cod">COD</option>
                  <option value="online">Online</option>
                  <option value="bkash">bKash</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.paymentStatus}</span>
                <select value={editForm.payment_status}
                  onChange={e => setEditForm(f => ({ ...f, payment_status: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="due">Due</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.shipping} (৳)</span>
                <input type="number" min="0" value={editForm.shipping_charge}
                  onChange={e => setEditForm(f => ({ ...f, shipping_charge: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.discount} (৳)</span>
                <input type="number" min="0" value={editForm.discount}
                  onChange={e => setEditForm(f => ({ ...f, discount: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>

              <label className="col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.notes}</span>
                <textarea value={editForm.notes} rows={2}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.cancel}</button>
              <button onClick={() => void handleSave()} disabled={saving}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? txt.saving : txt.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Modal ───────────────────────────────────────────────────── */}
      {statusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && setStatusOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-4 text-base font-bold">{txt.changeStatus}</h3>

            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.newStatus}</span>
                <select value={statusForm.status}
                  onChange={e => setStatusForm(f => ({ ...f, status: e.target.value as OrderStatus }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  {ORDER_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.statusNote}</span>
                <input value={statusForm.note}
                  onChange={e => setStatusForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setStatusOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.cancel}</button>
              <button onClick={() => void handleStatusChange()} disabled={changingStatus || !statusForm.status}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {changingStatus ? txt.confirming : txt.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && setDeleteOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <p className="mb-5 text-sm">{txt.confirmDelete} <span className="font-mono font-semibold text-[var(--accent)]">{order.order_number}</span></p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.cancel}</button>
              <button onClick={() => void handleDelete()} disabled={deleting}
                className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {deleting ? txt.confirming : txt.deleteOrder}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
