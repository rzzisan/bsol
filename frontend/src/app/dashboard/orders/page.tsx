"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, openAuthenticatedPdf, type Locale } from "@/lib/dashboard-client";

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
    allSites: "সব সাইট",
    bulkUpdate: "বাল্ক স্ট্যাটাস পরিবর্তন",
    applyBulk: "প্রয়োগ করুন",
    orderNo: "অর্ডার নং",
    customer: "গ্রাহক",
    total: "মোট",
    paidCol: "জমা",
    dueCol: "বকেয়া",
    status: "স্ট্যাটাস",
    risk: "ঝুঁকি",
    date: "তারিখ",
    actions: "অ্যাকশন",
    view: "দেখুন",
    invoice: "ইনভয়েস",
    invoicePreparing: "তৈরি হচ্ছে...",
    invoiceFailed: "ইনভয়েস তৈরি করা যায়নি।",
    statusNames: { pending:"অপেক্ষমান", confirmed:"নিশ্চিত", processing:"প্রক্রিয়াধীন",
                   shipped:"পাঠানো হয়েছে", delivered:"ডেলিভারি হয়েছে", cancelled:"বাতিল", returned:"ফেরত" },
    riskNames: { low:"কম", medium:"মাঝারি", high:"উচ্চ" },
    otpVerifiedBadge: "OTP ভেরিফাইড",
    onlinePaymentPendingBadge: (method: string) => `${method} — পেমেন্ট বাকি`,
    totalOrders: "মোট অর্ডার",
    todayOrders: "আজকের অর্ডার",
    pendingOrders: "অপেক্ষমান",
    deliveredOrders: "ডেলিভারি হয়েছে",
    changeStatusTitle: "স্ট্যাটাস পরিবর্তন",
    note: "নোট",
    save: "সংরক্ষণ",
    cancel: "বাতিল",
    saving: "সংরক্ষণ হচ্ছে...",
    payment: "পেমেন্ট",
    paymentModalTitle: "পেমেন্ট কালেকশন",
    billSummary: "বিল সামারি",
    subtotal: "সাবটোটাল",
    shipping: "শিপিং চার্জ",
    orderDiscount: "অর্ডার ডিসকাউন্ট",
    grandTotal: "সর্বমোট",
    paidSoFar: "এ পর্যন্ত পরিশোধিত",
    extraDiscount: "অতিরিক্ত ছাড়",
    dueAmount: "বাকি",
    overpaidBy: "অতিরিক্ত পরিশোধিত",
    fullyPaid: "সম্পূর্ণ পরিশোধিত",
    livePreviewHint: "এই এন্ট্রি অনুযায়ী, এখনো সংরক্ষণ হয়নি",
    newEntry: "নতুন পেমেন্ট এন্ট্রি",
    purpose: "পেমেন্ট ধরন",
    purposeNames: { advance: "অগ্রিম", courier_charge: "কুরিয়ার চার্জ", full_payment: "ফুল পেমেন্ট", other: "অন্যান্য" },
    method: "পেমেন্ট মাধ্যম",
    methodNames: { cash: "ক্যাশ", bank: "ব্যাংক", bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", upay: "উপায়", other: "অন্যান্য" },
    amount: "টাকার পরিমাণ",
    discount: "ডিসকাউন্ট",
    collectedBy: "কে রিসিভ করলো",
    collectedAt: "তারিখ",
    screenshot: "স্ক্রিনশট",
    screenshotHint: "বিকাশ/নগদ/রকেট/উপায়ে টাকা নিলে স্ক্রিনশট আবশ্যক",
    addPayment: "পেমেন্ট যোগ করুন",
    adding: "সংরক্ষণ হচ্ছে...",
    history: "কালেকশন হিস্ট্রি",
    noPayments: "এখনো কোনো পেমেন্ট এন্ট্রি নেই।",
    receivedBy: "রিসিভার",
    loggedBy: "এন্ট্রি করেছেন",
    viewScreenshot: "স্ক্রিনশট দেখুন",
    deleteEntry: "মুছুন",
    deleteConfirm: "এই পেমেন্ট এন্ট্রি মুছে ফেলতে চান?",
    close: "বন্ধ করুন",
  },
  en: {
    pageTitle: "Order List",
    createOrder: "New Order",
    loading: "Loading...",
    noOrders: "No orders found.",
    search: "Order no / name / phone",
    allStatuses: "All Statuses",
    allSites: "All Sites",
    bulkUpdate: "Bulk Status Update",
    applyBulk: "Apply",
    orderNo: "Order #",
    customer: "Customer",
    total: "Total",
    paidCol: "Paid",
    dueCol: "Due",
    status: "Status",
    risk: "Risk",
    date: "Date",
    actions: "Actions",
    view: "View",
    invoice: "Invoice",
    invoicePreparing: "Preparing...",
    invoiceFailed: "Could not generate the invoice.",
    statusNames: { pending:"Pending", confirmed:"Confirmed", processing:"Processing",
                   shipped:"Shipped", delivered:"Delivered", cancelled:"Cancelled", returned:"Returned" },
    riskNames: { low:"Low", medium:"Medium", high:"High" },
    otpVerifiedBadge: "OTP verified",
    onlinePaymentPendingBadge: (method: string) => `${method} — payment pending`,
    totalOrders: "Total Orders",
    todayOrders: "Today",
    pendingOrders: "Pending",
    deliveredOrders: "Delivered",
    changeStatusTitle: "Change Status",
    note: "Note",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
    payment: "Payment",
    paymentModalTitle: "Payment Collection",
    billSummary: "Bill Summary",
    subtotal: "Subtotal",
    shipping: "Shipping charge",
    orderDiscount: "Order discount",
    grandTotal: "Grand total",
    paidSoFar: "Paid so far",
    extraDiscount: "Extra discount",
    dueAmount: "Due",
    overpaidBy: "Overpaid by",
    fullyPaid: "Fully paid",
    livePreviewHint: "based on this entry, not yet saved",
    newEntry: "New Payment Entry",
    purpose: "Payment purpose",
    purposeNames: { advance: "Advance", courier_charge: "Courier charge", full_payment: "Full payment", other: "Other" },
    method: "Payment method",
    methodNames: { cash: "Cash", bank: "Bank", bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay", other: "Other" },
    amount: "Amount",
    discount: "Discount",
    collectedBy: "Received by",
    collectedAt: "Date",
    screenshot: "Screenshot",
    screenshotHint: "Required for bKash/Nagad/Rocket/Upay",
    addPayment: "Add Payment",
    adding: "Saving...",
    history: "Collection History",
    noPayments: "No payment entries yet.",
    receivedBy: "Received by",
    loggedBy: "Logged by",
    viewScreenshot: "View screenshot",
    deleteEntry: "Delete",
    deleteConfirm: "Delete this payment entry?",
    close: "Close",
  },
};

type Order = {
  id: number; order_number: string; customer_name: string | null;
  customer_phone: string; total: string; status: Status;
  risk_level: string; created_at: string; payment_status: string;
  payment_method: string;
  otp_verified_at: string | null;
  platform_api_key_id: number | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
};
type Stats = { total: number; today: number; pending: number; delivered: number };
type WpSite = { id: number; domain: string; status: string };

const PURPOSES = ["advance", "courier_charge", "full_payment", "other"] as const;
const METHODS = ["cash", "bank", "bkash", "nagad", "rocket", "upay", "other"] as const;
const SCREENSHOT_REQUIRED_METHODS = ["bkash", "nagad", "rocket", "upay"];

type OrderPaymentSummary = {
  id: number; order_number: string; customer_name: string | null; customer_phone: string;
  status: string; payment_method: string; payment_status: string;
  subtotal: string; shipping_charge: string; discount: string; total: string;
  paid_amount: number; collection_discount: number; due_amount: number;
};
type Collector = { id: number; name: string };
type PaymentEntry = {
  id: number; purpose: string; method: string; amount: string; discount: string;
  screenshot_url: string | null; note: string | null; collected_at: string;
  collector: Collector | null; creator: Collector | null;
};

export default function OrdersPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, pending: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSite, setFilterSite] = useState<string>("all");
  const [wpSites, setWpSites] = useState<WpSite[]>([]);
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

  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // payment collection modal
  const [paymentModalOrderId, setPaymentModalOrderId] = useState<number | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<OrderPaymentSummary | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    purpose: "advance" as typeof PURPOSES[number],
    method: "cash" as typeof METHODS[number],
    amount: "",
    discount: "",
    collectedBy: "",
    collectedAt: "",
    note: "",
  });
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);

  const token = getStoredToken();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search) params.set("search", search);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterSite !== "all") params.set("platform_api_key_id", filterSite);

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
  }, [page, search, filterStatus, filterSite, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, filterStatus, filterSite]);

  // Loaded once for the site filter dropdown + to resolve each order's
  // platform_api_key_id into a domain badge — reuses the same endpoint the
  // WordPress settings page uses, no new backend surface needed.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/wordpress/api-keys`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setWpSites((d.data ?? []).filter((s: WpSite) => s.status !== "revoked"));
        }
      } catch {
        // silent — filter/badges just stay empty
      }
    })();
  }, [token]);

  const siteDomainById = useMemo(() => {
    const map = new Map<number, string>();
    wpSites.forEach((s) => map.set(s.id, s.domain));
    return map;
  }, [wpSites]);

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

  const downloadInvoice = async (orderId: number) => {
    setDownloadingInvoiceId(orderId);
    setInvoiceError(null);
    const result = await openAuthenticatedPdf(`${API}/orders/${orderId}/invoice`);
    if (!result.success) setInvoiceError(result.message ?? txt.invoiceFailed);
    setDownloadingInvoiceId(null);
  };

  const loadPaymentData = useCallback(async (orderId: number) => {
    setPaymentLoading(true);
    try {
      const res = await fetch(`${API}/orders/${orderId}/payments`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setPaymentSummary(d.data?.order ?? null);
        setPayments(d.data?.payments ?? []);
        setCollectors(d.data?.collectors ?? []);
      }
    } finally {
      setPaymentLoading(false);
    }
  }, [token]);

  const openPaymentModal = (o: Order) => {
    setPaymentModalOrderId(o.id);
    setPaymentFormError(null);
    setScreenshotFile(null);
    setPaymentForm({ purpose: "advance", method: "cash", amount: "", discount: "", collectedBy: "", collectedAt: "", note: "" });
    void loadPaymentData(o.id);
  };
  const closePaymentModal = () => {
    setPaymentModalOrderId(null);
    setPaymentSummary(null);
    setPayments([]);
  };

  const submitPayment = async () => {
    if (!paymentModalOrderId) return;
    if (!paymentForm.collectedBy) {
      setPaymentFormError(locale === "bn" ? "কে রিসিভ করলো তা নির্বাচন করুন।" : "Select who received the payment.");
      return;
    }
    if (SCREENSHOT_REQUIRED_METHODS.includes(paymentForm.method) && !screenshotFile) {
      setPaymentFormError(txt.screenshotHint);
      return;
    }
    setPaymentSaving(true);
    setPaymentFormError(null);
    try {
      const body = new FormData();
      body.append("purpose", paymentForm.purpose);
      body.append("method", paymentForm.method);
      if (paymentForm.amount) body.append("amount", paymentForm.amount);
      if (paymentForm.discount) body.append("discount", paymentForm.discount);
      body.append("collected_by", paymentForm.collectedBy);
      if (paymentForm.collectedAt) body.append("collected_at", paymentForm.collectedAt);
      if (paymentForm.note) body.append("note", paymentForm.note);
      if (screenshotFile) body.append("screenshot", screenshotFile);

      const res = await fetch(`${API}/orders/${paymentModalOrderId}/payments`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body,
      });
      const d = await res.json();
      if (!res.ok) {
        const firstError = d?.errors ? (Object.values(d.errors)[0] as string[])?.[0] : null;
        setPaymentFormError(firstError ?? d?.message ?? (locale === "bn" ? "সংরক্ষণ ব্যর্থ হয়েছে।" : "Could not save the payment."));
        return;
      }
      setPaymentForm({ purpose: "advance", method: "cash", amount: "", discount: "", collectedBy: "", collectedAt: "", note: "" });
      setScreenshotFile(null);
      await loadPaymentData(paymentModalOrderId);
      void fetchData();
    } finally {
      setPaymentSaving(false);
    }
  };

  const deletePayment = async (paymentId: number) => {
    if (!paymentModalOrderId) return;
    if (!window.confirm(txt.deleteConfirm)) return;
    setDeletingPaymentId(paymentId);
    try {
      await fetch(`${API}/orders/${paymentModalOrderId}/payments/${paymentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadPaymentData(paymentModalOrderId);
      void fetchData();
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Live due-amount preview — subtracts the amount/discount currently being
  // typed (not yet submitted) from the server-confirmed due, so the seller
  // sees the effect of this entry before saving it.
  const previewDueAmount = useMemo(() => {
    if (!paymentSummary) return 0;
    const typedAmount = parseFloat(paymentForm.amount) || 0;
    const typedDiscount = parseFloat(paymentForm.discount) || 0;
    return paymentSummary.due_amount - typedAmount - typedDiscount;
  }, [paymentSummary, paymentForm.amount, paymentForm.discount]);

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

      {invoiceError && (
        <div className="catv-panel mb-4 p-3 text-sm text-red-400">{invoiceError}</div>
      )}

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

        {wpSites.length > 0 && (
          <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="all">{txt.allSites}</option>
            {wpSites.map(s => <option key={s.id} value={s.id}>{s.domain}</option>)}
          </select>
        )}

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
              <th className="px-3 py-3 text-right hidden lg:table-cell">{txt.paidCol}</th>
              <th className="px-3 py-3 text-right hidden lg:table-cell">{txt.dueCol}</th>
              <th className="px-3 py-3">{txt.status}</th>
              <th className="px-3 py-3 hidden md:table-cell">{txt.risk}</th>
              <th className="px-3 py-3 hidden md:table-cell">{txt.date}</th>
              <th className="px-3 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noOrders}</td></tr>
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
                <td className="px-3 py-3 text-right hidden lg:table-cell text-emerald-500">
                  {o.paid_amount != null ? `৳${Number(o.paid_amount).toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-3 text-right hidden lg:table-cell">
                  {o.due_amount != null ? (
                    <span className={Number(o.due_amount) > 0 ? "text-red-400" : Number(o.due_amount) < 0 ? "text-yellow-500" : "text-emerald-500"}>
                      ৳{Number(o.due_amount).toLocaleString()}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button onClick={() => openStatusModal(o)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 ${statusColor[o.status] ?? ""}`}>
                      {txt.statusNames[o.status]}
                    </button>
                    {o.otp_verified_at ? (
                      <span
                        title={txt.otpVerifiedBadge}
                        className="rounded-full bg-teal-500/15 px-2 py-0.5 text-xs font-semibold text-teal-400"
                      >
                        OTP
                      </span>
                    ) : null}
                    {["bkash", "nagad", "rocket"].includes(o.payment_method) && o.payment_status !== "paid" ? (
                      <span
                        title={txt.onlinePaymentPendingBadge(o.payment_method)}
                        className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500"
                      >
                        {o.payment_method === "bkash" ? "bKash" : o.payment_method === "nagad" ? "Nagad" : "Rocket"} ⏳
                      </span>
                    ) : null}
                    {o.platform_api_key_id && siteDomainById.get(o.platform_api_key_id) ? (
                      <span
                        title={siteDomainById.get(o.platform_api_key_id)}
                        className="rounded-full bg-[var(--muted)]/15 px-2 py-0.5 text-xs font-medium text-[var(--muted)]"
                      >
                        {siteDomainById.get(o.platform_api_key_id)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskColor[o.risk_level] ?? ""}`}>
                    {txt.riskNames[o.risk_level as keyof typeof txt.riskNames] ?? o.risk_level}
                  </span>
                </td>
                <td className="px-3 py-3 hidden md:table-cell text-xs text-[var(--muted)]">{fmtDate(o.created_at)}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => void downloadInvoice(o.id)} disabled={downloadingInvoiceId === o.id}
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)] disabled:opacity-50">
                      {downloadingInvoiceId === o.id ? txt.invoicePreparing : txt.invoice}
                    </button>
                    <button onClick={() => openPaymentModal(o)}
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                      {txt.payment}
                    </button>
                    <Link href={`/dashboard/orders/${o.id}`}
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                      {txt.view}
                    </Link>
                  </div>
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

      {/* Payment collection modal */}
      {paymentModalOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && closePaymentModal()}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold">{txt.paymentModalTitle}</h3>
            <p className="mb-4 text-xs text-[var(--muted)]">{paymentSummary?.order_number ?? "..."}</p>

            {paymentLoading || !paymentSummary ? (
              <p className="py-10 text-center text-sm text-[var(--muted)]">{txt.loading}</p>
            ) : (
              <>
                {/* Bill summary */}
                <div className="mb-4 rounded-xl border border-[var(--border)] p-3">
                  <p className="mb-2 text-xs font-semibold text-[var(--muted)] uppercase">{txt.billSummary}</p>
                  <div className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
                    <span className="text-[var(--muted)]">{txt.subtotal}</span>
                    <span className="text-right font-medium sm:text-left">৳{Number(paymentSummary.subtotal).toLocaleString()}</span>
                    <span className="text-[var(--muted)]">{txt.shipping}</span>
                    <span className="text-right font-medium sm:text-left">৳{Number(paymentSummary.shipping_charge).toLocaleString()}</span>
                    <span className="text-[var(--muted)]">{txt.orderDiscount}</span>
                    <span className="text-right font-medium sm:text-left">৳{Number(paymentSummary.discount).toLocaleString()}</span>
                    <span className="text-[var(--muted)]">{txt.grandTotal}</span>
                    <span className="text-right font-semibold sm:text-left">৳{Number(paymentSummary.total).toLocaleString()}</span>
                    <span className="text-[var(--muted)]">{txt.paidSoFar}</span>
                    <span className="text-right font-medium text-emerald-500 sm:text-left">৳{Number(paymentSummary.paid_amount).toLocaleString()}</span>
                    <span className="text-[var(--muted)]">{txt.extraDiscount}</span>
                    <span className="text-right font-medium sm:text-left">৳{Number(paymentSummary.collection_discount).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 border-t border-[var(--border)] pt-2 text-sm font-semibold">
                    {previewDueAmount > 0 ? (
                      <span className="text-red-400">{txt.dueAmount}: ৳{previewDueAmount.toLocaleString()}</span>
                    ) : previewDueAmount < 0 ? (
                      <span className="text-yellow-500">{txt.overpaidBy}: ৳{Math.abs(previewDueAmount).toLocaleString()}</span>
                    ) : (
                      <span className="text-emerald-500">{txt.fullyPaid}</span>
                    )}
                    {(paymentForm.amount || paymentForm.discount) && (
                      <span className="ml-2 text-xs font-normal text-[var(--muted)]">({txt.livePreviewHint})</span>
                    )}
                  </div>
                </div>

                {/* History */}
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold text-[var(--muted)] uppercase">{txt.history}</p>
                  {payments.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">{txt.noPayments}</p>
                  ) : (
                    <div className="grid gap-2">
                      {payments.map(p => (
                        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] p-2.5 text-sm">
                          <div>
                            <p className="font-semibold">
                              ৳{Number(p.amount).toLocaleString()}
                              {Number(p.discount) > 0 && <span className="ml-1 text-xs font-normal text-[var(--muted)]">({txt.discount} − ৳{Number(p.discount).toLocaleString()})</span>}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {txt.purposeNames[p.purpose as keyof typeof txt.purposeNames] ?? p.purpose} · {txt.methodNames[p.method as keyof typeof txt.methodNames] ?? p.method} · {fmtDate(p.collected_at)}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {txt.receivedBy}: {p.collector?.name ?? "—"}
                              {p.creator && p.creator.id !== p.collector?.id ? ` (${txt.loggedBy}: ${p.creator.name})` : ""}
                            </p>
                            {p.note && <p className="text-xs text-[var(--muted)]">{p.note}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {p.screenshot_url && (
                              <a href={p.screenshot_url} target="_blank" rel="noopener noreferrer"
                                className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-soft)]">
                                {txt.viewScreenshot}
                              </a>
                            )}
                            <button onClick={() => void deletePayment(p.id)} disabled={deletingPaymentId === p.id}
                              className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                              {txt.deleteEntry}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* New entry form */}
                <div className="rounded-xl border border-[var(--border)] p-3">
                  <p className="mb-3 text-xs font-semibold text-[var(--muted)] uppercase">{txt.newEntry}</p>
                  {paymentFormError && <p className="mb-3 text-xs text-red-400">{paymentFormError}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.purpose}</span>
                      <select value={paymentForm.purpose} onChange={e => setPaymentForm(f => ({ ...f, purpose: e.target.value as typeof PURPOSES[number] }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                        {PURPOSES.map(p => <option key={p} value={p}>{txt.purposeNames[p]}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.method}</span>
                      <select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value as typeof METHODS[number] }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                        {METHODS.map(m => <option key={m} value={m}>{txt.methodNames[m]}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.amount}</span>
                      <input type="number" min="0" step="0.01" value={paymentForm.amount}
                        onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.discount}</span>
                      <input type="number" min="0" step="0.01" value={paymentForm.discount}
                        onChange={e => setPaymentForm(f => ({ ...f, discount: e.target.value }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.collectedBy}</span>
                      <select value={paymentForm.collectedBy} onChange={e => setPaymentForm(f => ({ ...f, collectedBy: e.target.value }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                        <option value="">—</option>
                        {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.collectedAt}</span>
                      <input type="date" value={paymentForm.collectedAt}
                        onChange={e => setPaymentForm(f => ({ ...f, collectedAt: e.target.value }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.note}</span>
                      <textarea rows={2} value={paymentForm.note} onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none" />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-xs text-[var(--muted)]">
                        {txt.screenshot}
                        {SCREENSHOT_REQUIRED_METHODS.includes(paymentForm.method) && <span className="ml-1 text-red-400">({txt.screenshotHint})</span>}
                      </span>
                      <input type="file" accept="image/*" onChange={e => setScreenshotFile(e.target.files?.[0] ?? null)}
                        className="w-full text-sm" />
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end gap-3">
                    <button onClick={closePaymentModal} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.close}</button>
                    <button onClick={() => void submitPayment()} disabled={paymentSaving}
                      className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {paymentSaving ? txt.adding : txt.addPayment}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </UserShell>
  );
}
