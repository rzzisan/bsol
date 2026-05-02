"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "VIP কাস্টমার",
    loading: "লোড হচ্ছে...",
    noVip: "কোনো VIP কাস্টমার নেই। উচ্চ মূল্যের কাস্টমারদের VIP ট্যাগ করুন।",
    name: "নাম ও ফোন",
    orders: "অর্ডার",
    spent: "মোট ক্রয়",
    lastOrder: "শেষ অর্ডার",
    view: "দেখুন",
    removeVip: "VIP সরান",
    never: "কখনো না",
  },
  en: {
    pageTitle: "VIP Customers",
    loading: "Loading...",
    noVip: "No VIP customers yet. Tag high-value customers as VIP.",
    name: "Name & Phone",
    orders: "Orders",
    spent: "Total Spent",
    lastOrder: "Last Order",
    view: "View",
    removeVip: "Remove VIP",
    never: "Never",
  },
};

type Customer = { id: number; name: string | null; phone: string; total_orders: number; total_spent: number; last_order_at: string | null; tags: string[] };

export default function VipPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVip = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/customers?vip=1&per_page=100`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setCustomers(d.data ?? []); }
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void fetchVip(); }, [fetchVip]);

  const removeVip = async (c: Customer) => {
    const tags = c.tags.filter(t => t !== "vip");
    await fetch(`${API}/customers/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tags }),
    });
    void fetchVip();
  };

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", { day: "2-digit", month: "short", year: "2-digit" })
    : txt.never;

  return (
    <UserShell activeKey="vip-customers" defaultExpandedKey="customers"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.name}</th>
              <th className="px-4 py-3 text-center">{txt.orders}</th>
              <th className="px-4 py-3 text-right">{txt.spent}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.lastOrder}</th>
              <th className="px-4 py-3 text-right">{txt.view}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noVip}</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{c.phone}</p>
                  <span className="mt-1 inline-block rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-400">VIP</span>
                </td>
                <td className="px-4 py-3 text-center font-semibold">{c.total_orders}</td>
                <td className="px-4 py-3 text-right font-bold">৳{Number(c.total_spent).toLocaleString()}</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted)]">{fmtDate(c.last_order_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/customers/${c.id}`}
                    className="mr-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                    {txt.view}
                  </Link>
                  <button onClick={() => removeVip(c)}
                    className="rounded-lg border border-purple-500/30 px-2 py-1 text-xs text-purple-400 hover:bg-purple-500/10">
                    {txt.removeVip}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UserShell>
  );
}
