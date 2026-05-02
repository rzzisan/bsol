"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const riskColor: Record<string, string> = {
  low:    "bg-emerald-500/15 text-emerald-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  high:   "bg-red-500/15 text-red-400",
};

const t = {
  bn: {
    pageTitle: "কাস্টমার তালিকা",
    syncBtn: "অর্ডার থেকে Sync করুন",
    syncing: "Sync হচ্ছে...",
    search: "নাম / ফোন দিয়ে খুঁজুন",
    allRisk: "সব ঝুঁকি",
    low: "কম", medium: "মাঝারি", high: "উচ্চ",
    vipOnly: "শুধু VIP",
    loading: "লোড হচ্ছে...",
    noCustomers: "কোনো কাস্টমার নেই।",
    name: "নাম ও ফোন",
    orders: "অর্ডার",
    spent: "মোট ক্রয়",
    lastOrder: "শেষ অর্ডার",
    risk: "ঝুঁকি",
    actions: "অ্যাকশন",
    view: "দেখুন",
    block: "ব্লক",
    unblock: "আনব্লক",
    totalCustomers: "মোট কাস্টমার",
    vipCount: "VIP",
    highRisk: "উচ্চ ঝুঁকি",
    repeat: "নিয়মিত (৩+)",
    tags: { vip: "VIP", wholesale: "পাইকার", blocked: "ব্লক" },
    never: "কখনো না",
  },
  en: {
    pageTitle: "Customer List",
    syncBtn: "Sync from Orders",
    syncing: "Syncing...",
    search: "Search by name / phone",
    allRisk: "All Risk",
    low: "Low", medium: "Medium", high: "High",
    vipOnly: "VIP only",
    loading: "Loading...",
    noCustomers: "No customers found.",
    name: "Name & Phone",
    orders: "Orders",
    spent: "Total Spent",
    lastOrder: "Last Order",
    risk: "Risk",
    actions: "Actions",
    view: "View",
    block: "Block",
    unblock: "Unblock",
    totalCustomers: "Total Customers",
    vipCount: "VIP",
    highRisk: "High Risk",
    repeat: "Repeat (3+)",
    tags: { vip: "VIP", wholesale: "Wholesale", blocked: "Blocked" },
    never: "Never",
  },
};

type Customer = {
  id: number; name: string | null; phone: string; email: string | null;
  total_orders: number; total_spent: number; last_order_at: string | null;
  risk_level: string; is_blocked: boolean; tags: string[];
};
type Stats = { total: number; vip: number; high_risk: number; repeat_customers: number };

export default function CustomersPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, vip: 0, high_risk: 0, repeat_customers: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState("all");
  const [filterVip, setFilterVip] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search) params.set("search", search);
      if (filterRisk !== "all") params.set("risk_level", filterRisk);
      if (filterVip) params.set("vip", "1");

      const [cusRes, statRes] = await Promise.all([
        fetch(`${API}/customers?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/customers/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cusRes.ok) {
        const d = await cusRes.json();
        setCustomers(d.data ?? []);
        setTotal(d.meta?.total ?? 0);
        setLastPage(d.meta?.last_page ?? 1);
      }
      if (statRes.ok) {
        const d = await statRes.json();
        setStats(d.data ?? stats);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, filterRisk, filterVip, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, filterRisk, filterVip]);

  const handleSync = async () => {
    setSyncing(true);
    await fetch(`${API}/customers/sync-all`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setSyncing(false);
    void fetchData();
  };

  const handleToggleBlock = async (c: Customer) => {
    await fetch(`${API}/customers/${c.id}/toggle-block`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    void fetchData();
  };

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", { day: "2-digit", month: "short", year: "2-digit" })
    : txt.never;

  return (
    <UserShell activeKey="customer-list" defaultExpandedKey="customers"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: txt.totalCustomers, value: stats.total,             color: "bg-[#0f7c7b]" },
          { label: txt.vipCount,       value: stats.vip,               color: "bg-[#7b3fbd]" },
          { label: txt.highRisk,       value: stats.high_risk,         color: "bg-[#c0392b]" },
          { label: txt.repeat,         value: stats.repeat_customers,  color: "bg-[#2f7ec1]" },
        ].map(c => (
          <article key={c.label} className={`${c.color} rounded-2xl p-4 text-white`}>
            <p className="text-xs text-white/80">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "..." : c.value}</p>
          </article>
        ))}
      </div>

      {/* Toolbar */}
      <div className="catv-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={txt.search}
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="all">{txt.allRisk}</option>
          <option value="low">{txt.low}</option>
          <option value="medium">{txt.medium}</option>
          <option value="high">{txt.high}</option>
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={filterVip} onChange={e => setFilterVip(e.target.checked)}
            className="accent-[var(--accent)]" />
          {txt.vipOnly}
        </label>
        <button onClick={handleSync} disabled={syncing}
          className="ml-auto rounded-xl border border-[var(--accent)]/40 px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-60">
          {syncing ? txt.syncing : txt.syncBtn}
        </button>
      </div>

      {/* Table */}
      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.name}</th>
              <th className="px-4 py-3 text-center">{txt.orders}</th>
              <th className="px-4 py-3 text-right">{txt.spent}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.lastOrder}</th>
              <th className="px-4 py-3">{txt.risk}</th>
              <th className="px-4 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noCustomers}</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} className={`border-b border-[var(--border)] hover:bg-[var(--surface-soft)] ${c.is_blocked ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{c.phone}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.tags.map(tag => (
                      <span key={tag} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold
                        ${tag === "vip" ? "bg-purple-500/15 text-purple-400" : "bg-[var(--surface)] text-[var(--muted)]"}`}>
                        {txt.tags[tag as keyof typeof txt.tags] ?? tag}
                      </span>
                    ))}
                    {c.is_blocked && (
                      <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                        {txt.tags.blocked}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center font-semibold">{c.total_orders}</td>
                <td className="px-4 py-3 text-right font-semibold">৳{Number(c.total_spent).toLocaleString()}</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted)]">{fmtDate(c.last_order_at)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskColor[c.risk_level] ?? ""}`}>
                    {txt[c.risk_level as "low" | "medium" | "high"] ?? c.risk_level}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/customers/${c.id}`}
                    className="mr-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                    {txt.view}
                  </Link>
                  <button onClick={() => handleToggleBlock(c)}
                    className={`rounded-lg border px-2 py-1 text-xs
                      ${c.is_blocked ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}>
                    {c.is_blocked ? txt.unblock : txt.block}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">{total} {locale === "bn" ? "জন কাস্টমার" : "customers"}</p>
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
