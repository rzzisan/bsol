"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const riskColor: Record<string, string> = {
  medium: "bg-yellow-500/15 text-yellow-400",
  high:   "bg-red-500/15 text-red-400",
};

const t = {
  bn: {
    pageTitle: "ঝুঁকিপূর্ণ কাস্টমার",
    loading: "লোড হচ্ছে...",
    noRisky: "কোনো ঝুঁকিপূর্ণ কাস্টমার নেই।",
    name: "নাম ও ফোন",
    orders: "অর্ডার",
    spent: "মোট ক্রয়",
    risk: "ঝুঁকি",
    lastOrder: "শেষ অর্ডার",
    actions: "অ্যাকশন",
    view: "দেখুন",
    block: "ব্লক",
    unblock: "আনব্লক",
    never: "কখনো না",
    high: "উচ্চ", medium: "মাঝারি",
  },
  en: {
    pageTitle: "Risky Customers",
    loading: "Loading...",
    noRisky: "No risky customers found.",
    name: "Name & Phone",
    orders: "Orders",
    spent: "Total Spent",
    risk: "Risk",
    lastOrder: "Last Order",
    actions: "Actions",
    view: "View",
    block: "Block",
    unblock: "Unblock",
    never: "Never",
    high: "High", medium: "Medium",
  },
};

type Customer = {
  id: number; name: string | null; phone: string;
  total_orders: number; total_spent: number; last_order_at: string | null;
  risk_level: string; is_blocked: boolean; fraud_score: number;
};

export default function RiskyPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRisky = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch medium + high risk separately and merge
      const [medRes, highRes] = await Promise.all([
        fetch(`${API}/customers?risk_level=medium&per_page=50`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/customers?risk_level=high&per_page=50`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const med  = medRes.ok  ? (await medRes.json()).data  ?? [] : [];
      const high = highRes.ok ? (await highRes.json()).data ?? [] : [];
      // Sort high risk first
      setCustomers([...high, ...med]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void fetchRisky(); }, [fetchRisky]);

  const toggleBlock = async (c: Customer) => {
    await fetch(`${API}/customers/${c.id}/toggle-block`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    void fetchRisky();
  };

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", { day: "2-digit", month: "short", year: "2-digit" })
    : txt.never;

  return (
    <UserShell activeKey="risky-customers" defaultExpandedKey="customers"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.name}</th>
              <th className="px-4 py-3">{txt.risk}</th>
              <th className="px-4 py-3 text-center">{txt.orders}</th>
              <th className="px-4 py-3 text-right">{txt.spent}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.lastOrder}</th>
              <th className="px-4 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noRisky}</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} className={`border-b border-[var(--border)] hover:bg-[var(--surface-soft)] ${c.is_blocked ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{c.phone}</p>
                  {c.fraud_score > 0 && (
                    <p className="text-[10px] text-red-400">Fraud score: {c.fraud_score}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskColor[c.risk_level] ?? ""}`}>
                    {txt[c.risk_level as "high"|"medium"]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">{c.total_orders}</td>
                <td className="px-4 py-3 text-right">৳{Number(c.total_spent).toLocaleString()}</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted)]">{fmtDate(c.last_order_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/customers/${c.id}`}
                    className="mr-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                    {txt.view}
                  </Link>
                  <button onClick={() => toggleBlock(c)}
                    className={`rounded-lg border px-2 py-1 text-xs
                      ${c.is_blocked ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}>
                    {c.is_blocked ? txt.unblock : txt.block}
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
