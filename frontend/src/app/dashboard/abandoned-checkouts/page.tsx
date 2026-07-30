"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { LANDING_API_BASE } from "@/lib/landing-pages";

const t = {
  bn: {
    pageTitle: "অসম্পূর্ণ অর্ডার (Abandoned Checkout)",
    search: "নাম / ফোন দিয়ে খুঁজুন",
    allStatus: "সব স্ট্যাটাস",
    inProgress: "চলমান",
    abandoned: "পরিত্যক্ত",
    converted: "কনভার্টেড",
    dismissed: "বাতিল",
    allPages: "সব ল্যান্ডিং পেজ",
    export: "CSV Export",
    loading: "লোড হচ্ছে...",
    noRows: "কোনো অসম্পূর্ণ চেকআউট নেই।",
    customer: "কাস্টমার",
    landingPage: "ল্যান্ডিং পেজ",
    items: "প্রোডাক্ট",
    status: "স্ট্যাটাস",
    lastActivity: "সর্বশেষ কার্যকলাপ",
    actions: "অ্যাকশন",
    view: "বিস্তারিত",
    copyLink: "লিংক কপি",
    linkCopied: "কপি হয়েছে!",
    dismiss: "বাতিল করুন",
    delete: "মুছুন",
    confirmDelete: "এই এন্ট্রিটি মুছে ফেলতে চান?",
    active: "চলমান",
    convertedCount: "কনভার্টেড",
    abandonedCount: "পরিত্যক্ত",
    conversionRate: "কনভার্শন রেট",
    minsAgo: (n: number) => `${n} মিনিট আগে`,
    hoursAgo: (n: number) => `${n} ঘণ্টা আগে`,
    valueRepeat: (n: number) => `${n}টি পূর্বের অর্ডার`,
  },
  en: {
    pageTitle: "Abandoned Checkouts",
    search: "Search by name / phone",
    allStatus: "All statuses",
    inProgress: "In Progress",
    abandoned: "Abandoned",
    converted: "Converted",
    dismissed: "Dismissed",
    allPages: "All landing pages",
    export: "CSV Export",
    loading: "Loading...",
    noRows: "No abandoned checkouts found.",
    customer: "Customer",
    landingPage: "Landing Page",
    items: "Product(s)",
    status: "Status",
    lastActivity: "Last Activity",
    actions: "Actions",
    view: "View",
    copyLink: "Copy link",
    linkCopied: "Copied!",
    dismiss: "Dismiss",
    delete: "Delete",
    confirmDelete: "Delete this entry?",
    active: "Active",
    convertedCount: "Converted",
    abandonedCount: "Abandoned",
    conversionRate: "Conversion rate",
    minsAgo: (n: number) => `${n} mins ago`,
    hoursAgo: (n: number) => `${n} hrs ago`,
    valueRepeat: (n: number) => `${n} past order(s)`,
  },
};

type CheckoutItem = { product_id: number; name: string; quantity: number; unit_price: number };

type AbandonedCheckoutRow = {
  id: number;
  session_token: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: CheckoutItem[] | null;
  subtotal: string | number | null;
  status: "active" | "converted" | "dismissed";
  is_abandoned: boolean;
  last_activity_at: string;
  landingPage: { id: number; title: string; slug: string } | null;
  customer_value: { total_orders: number; total_spent: number; risk_level: string } | null;
};

type Stats = { active: number; abandoned: number; converted: number; dismissed: number; total: number; conversion_rate: number };

type LandingPageOption = { id: number; title: string };

export default function AbandonedCheckoutsPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [rows, setRows] = useState<AbandonedCheckoutRow[]>([]);
  const [stats, setStats] = useState<Stats>({ active: 0, abandoned: 0, converted: 0, dismissed: 0, total: 0, conversion_rate: 0 });
  const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPage, setFilterPage] = useState("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search) params.set("q", search);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPage !== "all") params.set("landing_page_id", filterPage);

      const [listRes, statRes] = await Promise.all([
        fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (listRes.ok) {
        const d = await listRes.json();
        setRows(d.data ?? []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterStatus, filterPage, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, filterStatus, filterPage]);

  useEffect(() => {
    fetch(`${LANDING_API_BASE}/landing/pages?per_page=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setLandingPages(d?.data ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = async (row: AbandonedCheckoutRow) => {
    await fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "dismissed" }),
    });
    void fetchData();
  };

  const handleDelete = async (row: AbandonedCheckoutRow) => {
    if (!window.confirm(txt.confirmDelete)) return;
    await fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/${row.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    void fetchData();
  };

  const handleCopyLink = async (row: AbandonedCheckoutRow) => {
    if (!row.landingPage) return;
    const link = `${window.location.origin}/lp/${row.landingPage.slug}?resume=${encodeURIComponent(row.session_token)}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (filterStatus !== "all") params.set("status", filterStatus);
    const res = await fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abandoned-checkouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel = (row: AbandonedCheckoutRow) => {
    if (row.status === "converted") return { text: txt.converted, color: "bg-emerald-500/15 text-emerald-400" };
    if (row.status === "dismissed") return { text: txt.dismissed, color: "bg-slate-500/15 text-[var(--muted)]" };
    if (row.is_abandoned) return { text: txt.abandoned, color: "bg-red-500/15 text-red-400" };
    return { text: txt.inProgress, color: "bg-yellow-500/15 text-yellow-400" };
  };

  const relativeTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.round(diffMs / 60000));
    if (mins < 60) return txt.minsAgo(mins);
    return txt.hoursAgo(Math.round(mins / 60));
  };

  return (
    <UserShell activeKey="abandoned-checkouts" pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: txt.active, value: stats.active, color: "bg-[#2f7ec1]" },
          { label: txt.abandonedCount, value: stats.abandoned, color: "bg-[#c0392b]" },
          { label: txt.convertedCount, value: stats.converted, color: "bg-[#1f9d6f]" },
          { label: txt.conversionRate, value: `${stats.conversion_rate}%`, color: "bg-[#7b3fbd]" },
        ].map((c) => (
          <article key={c.label} className={`${c.color} rounded-2xl p-4 text-white`}>
            <p className="text-xs text-white/80">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "..." : c.value}</p>
          </article>
        ))}
      </div>

      {/* Toolbar */}
      <div className="catv-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={txt.search}
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="all">{txt.allStatus}</option>
          <option value="active">{txt.inProgress} / {txt.abandoned}</option>
          <option value="converted">{txt.converted}</option>
          <option value="dismissed">{txt.dismissed}</option>
        </select>
        <select
          value={filterPage}
          onChange={(e) => setFilterPage(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="all">{txt.allPages}</option>
          {landingPages.map((lp) => (
            <option key={lp.id} value={lp.id}>{lp.title}</option>
          ))}
        </select>
        <button
          onClick={handleExport}
          className="ml-auto rounded-xl border border-[var(--accent)]/40 px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10"
        >
          {txt.export}
        </button>
      </div>

      {/* Table */}
      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.customer}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.landingPage}</th>
              <th className="px-4 py-3 hidden lg:table-cell">{txt.items}</th>
              <th className="px-4 py-3">{txt.status}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.lastActivity}</th>
              <th className="px-4 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noRows}</td></tr>
            ) : rows.map((row) => {
              const s = statusLabel(row);
              return (
                <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.customer_name || "—"}</p>
                    <p className="text-xs text-[var(--muted)]">{row.customer_phone || "—"}</p>
                    {row.customer_value && row.customer_value.total_orders > 0 && (
                      <span className="mt-1 inline-block rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-400">
                        {txt.valueRepeat(row.customer_value.total_orders)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs">{row.landingPage?.title ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-[var(--muted)]">
                    {(row.items ?? []).map((i) => `${i.name} x${i.quantity}`).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>{s.text}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted)]">{relativeTime(row.last_activity_at)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/dashboard/abandoned-checkouts/${row.id}`}
                      className="mr-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
                    >
                      {txt.view}
                    </Link>
                    {row.landingPage && (
                      <button
                        onClick={() => handleCopyLink(row)}
                        className="mr-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
                      >
                        {copiedId === row.id ? txt.linkCopied : txt.copyLink}
                      </button>
                    )}
                    {row.status === "active" && (
                      <button
                        onClick={() => handleDismiss(row)}
                        className="mr-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
                      >
                        {txt.dismiss}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(row)}
                      className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      {txt.delete}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">{total} {locale === "bn" ? "টি এন্ট্রি" : "entries"}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40">
                {locale === "bn" ? "আগে" : "Prev"}
              </button>
              <span className="text-xs self-center">{page}/{lastPage}</span>
              <button disabled={page === lastPage} onClick={() => setPage((p) => p + 1)}
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
