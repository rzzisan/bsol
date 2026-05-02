"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const statusColor: Record<string, string> = {
  pending:    "bg-yellow-500/15 text-yellow-400",
  confirmed:  "bg-blue-500/15 text-blue-400",
  processing: "bg-indigo-500/15 text-indigo-400",
  shipped:    "bg-purple-500/15 text-purple-400",
  delivered:  "bg-emerald-500/15 text-emerald-400",
  cancelled:  "bg-red-500/15 text-red-400",
  returned:   "bg-orange-500/15 text-orange-400",
};

const riskColor: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  high: "bg-red-500/15 text-red-400",
};

const t = {
  bn: {
    back: "← কাস্টমার তালিকা",
    loading: "লোড হচ্ছে...",
    notFound: "কাস্টমার পাওয়া যায়নি।",
    phone: "ফোন",
    email: "ইমেইল",
    address: "ঠিকানা",
    notes: "নোট",
    totalOrders: "মোট অর্ডার",
    totalSpent: "মোট ক্রয়",
    lastOrder: "শেষ অর্ডার",
    riskLevel: "ঝুঁকি স্তর",
    tags: "ট্যাগ",
    orderHistory: "অর্ডারের ইতিহাস",
    noOrders: "কোনো অর্ডার নেই।",
    orderNo: "অর্ডার নং",
    total: "মোট",
    status: "স্ট্যাটাস",
    date: "তারিখ",
    viewOrder: "দেখুন",
    editTitle: "কাস্টমার সম্পাদনা",
    editBtn: "সম্পাদনা",
    blockBtn: "ব্লক করুন",
    unblockBtn: "আনব্লক করুন",
    vipToggle: "VIP করুন",
    removeVip: "VIP সরান",
    save: "সংরক্ষণ",
    cancel: "বাতিল",
    saving: "সংরক্ষণ হচ্ছে...",
    low: "কম", medium: "মাঝারি", high: "উচ্চ",
    never: "কখনো না",
    blocked: "ব্লকড",
  },
  en: {
    back: "← Customer List",
    loading: "Loading...",
    notFound: "Customer not found.",
    phone: "Phone",
    email: "Email",
    address: "Address",
    notes: "Notes",
    totalOrders: "Total Orders",
    totalSpent: "Total Spent",
    lastOrder: "Last Order",
    riskLevel: "Risk Level",
    tags: "Tags",
    orderHistory: "Order History",
    noOrders: "No orders.",
    orderNo: "Order #",
    total: "Total",
    status: "Status",
    date: "Date",
    viewOrder: "View",
    editTitle: "Edit Customer",
    editBtn: "Edit",
    blockBtn: "Block",
    unblockBtn: "Unblock",
    vipToggle: "Mark VIP",
    removeVip: "Remove VIP",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
    low: "Low", medium: "Medium", high: "High",
    never: "Never",
    blocked: "Blocked",
  },
};

type Order = {
  id: number; order_number: string; total: string;
  status: string; created_at: string;
};
type Customer = {
  id: number; name: string | null; phone: string; email: string | null;
  address: string | null; district: string | null; thana: string | null;
  notes: string | null; tags: string[]; risk_level: string; is_blocked: boolean;
  fraud_score: number; total_orders: number; total_spent: number;
  last_order_at: string | null; orders: Order[];
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/customers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setCustomer(d.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { void fetchCustomer(); }, [fetchCustomer]);

  const openEdit = () => {
    if (!customer) return;
    setForm({ name: customer.name ?? "", email: customer.email ?? "", address: customer.address ?? "",
      district: customer.district ?? "", thana: customer.thana ?? "", notes: customer.notes ?? "",
      risk_level: customer.risk_level });
    setModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(`${API}/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setModal(false);
    void fetchCustomer();
  };

  const toggleBlock = async () => {
    await fetch(`${API}/customers/${id}/toggle-block`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    void fetchCustomer();
  };

  const toggleVip = async () => {
    if (!customer) return;
    const tags = customer.tags.includes("vip")
      ? customer.tags.filter(t => t !== "vip")
      : [...customer.tags, "vip"];
    await fetch(`${API}/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tags }),
    });
    void fetchCustomer();
  };

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", { day: "2-digit", month: "short", year: "2-digit" })
    : txt.never;

  if (loading) return (
    <UserShell activeKey="customer-list" defaultExpandedKey="customers"
      pageTitle={{ bn: "কাস্টমার প্রোফাইল", en: "Customer Profile" }}>
      <p className="text-center py-16 text-[var(--muted)]">{txt.loading}</p>
    </UserShell>
  );

  if (!customer) return (
    <UserShell activeKey="customer-list" defaultExpandedKey="customers"
      pageTitle={{ bn: "কাস্টমার প্রোফাইল", en: "Customer Profile" }}>
      <p className="text-center py-16 text-[var(--muted)]">{txt.notFound}</p>
    </UserShell>
  );

  return (
    <UserShell activeKey="customer-list" defaultExpandedKey="customers"
      pageTitle={{ bn: customer.name ?? customer.phone, en: customer.name ?? customer.phone }}>

      <Link href="/dashboard/customers" className="mb-4 inline-block text-sm text-[var(--accent)] hover:underline">{txt.back}</Link>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Profile card */}
        <div className="catv-panel p-5 md:col-span-1">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{customer.name ?? "—"}</h2>
              <p className="text-sm text-[var(--muted)]">{customer.phone}</p>
              {customer.email && <p className="text-xs text-[var(--muted)]">{customer.email}</p>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskColor[customer.risk_level] ?? ""}`}>
                {txt[customer.risk_level as "low"|"medium"|"high"]}
              </span>
              {customer.is_blocked && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">{txt.blocked}</span>
              )}
            </div>
          </div>

          <dl className="space-y-2 text-sm">
            {customer.address && (
              <div><dt className="text-xs text-[var(--muted)]">{txt.address}</dt>
                <dd>{customer.address}{customer.district ? `, ${customer.district}` : ""}{customer.thana ? `, ${customer.thana}` : ""}</dd>
              </div>
            )}
            {customer.notes && (
              <div><dt className="text-xs text-[var(--muted)]">{txt.notes}</dt><dd className="italic">{customer.notes}</dd></div>
            )}
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-[var(--surface-soft)] p-3">
              <p className="text-2xl font-bold">{customer.total_orders}</p>
              <p className="text-xs text-[var(--muted)]">{txt.totalOrders}</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3">
              <p className="text-lg font-bold">৳{Number(customer.total_spent).toLocaleString()}</p>
              <p className="text-xs text-[var(--muted)]">{txt.totalSpent}</p>
            </div>
          </div>

          {customer.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {customer.tags.map(tag => (
                <span key={tag} className={`rounded-full px-2 py-0.5 text-xs font-semibold
                  ${tag === "vip" ? "bg-purple-500/15 text-purple-400" : "bg-[var(--surface)] text-[var(--muted)]"}`}>
                  {tag.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button onClick={openEdit} className="w-full rounded-xl border border-[var(--border)] py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.editBtn}</button>
            <button onClick={toggleVip}
              className="w-full rounded-xl border border-purple-500/30 py-2 text-sm text-purple-400 hover:bg-purple-500/10">
              {customer.tags.includes("vip") ? txt.removeVip : txt.vipToggle}
            </button>
            <button onClick={toggleBlock}
              className={`w-full rounded-xl border py-2 text-sm
                ${customer.is_blocked ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}>
              {customer.is_blocked ? txt.unblockBtn : txt.blockBtn}
            </button>
          </div>
        </div>

        {/* Order history */}
        <div className="catv-panel p-5 md:col-span-2">
          <h3 className="mb-4 text-base font-bold">{txt.orderHistory}</h3>
          {customer.orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">{txt.noOrders}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)] uppercase">
                    <th className="px-3 py-2 text-left">{txt.orderNo}</th>
                    <th className="px-3 py-2 text-right">{txt.total}</th>
                    <th className="px-3 py-2">{txt.status}</th>
                    <th className="px-3 py-2 hidden md:table-cell">{txt.date}</th>
                    <th className="px-3 py-2 text-right">{txt.viewOrder}</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map(o => (
                    <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--accent)]">{o.order_number}</td>
                      <td className="px-3 py-2 text-right font-semibold">৳{Number(o.total).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[o.status] ?? ""}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell text-xs text-[var(--muted)]">{fmtDate(o.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/dashboard/orders/${o.id}`}
                          className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                          {txt.viewOrder}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-4 text-base font-bold">{txt.editTitle}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["name","email","address","district","thana","notes"] as const).map(field => (
                <label key={field} className={field === "address" || field === "notes" ? "sm:col-span-2" : ""}>
                  <span className="mb-1 block text-xs capitalize text-[var(--muted)]">{txt[field as keyof typeof txt]}</span>
                  {field === "notes" || field === "address" ? (
                    <textarea rows={2} value={(form[field] as string) ?? ""}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none" />
                  ) : (
                    <input value={(form[field] as string) ?? ""}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                  )}
                </label>
              ))}
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.riskLevel}</span>
                <select value={form.risk_level ?? "low"} onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="low">{txt.low}</option>
                  <option value="medium">{txt.medium}</option>
                  <option value="high">{txt.high}</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setModal(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.cancel}</button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? txt.saving : txt.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
