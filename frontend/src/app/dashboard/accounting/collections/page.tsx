"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "কালেকশন হিস্ট্রি",
    subtitle: "সব উৎসের পেমেন্ট কালেকশন — ম্যানুয়াল, কুরিয়ার COD, (ভবিষ্যতে) অনলাইন পেমেন্ট — এক জায়গায়।",
    loading: "লোড হচ্ছে...",
    noRows: "কোনো কালেকশন পাওয়া যায়নি।",
    thisMonth: "এই মাসে মোট কালেকশন",
    manualThisMonth: "ম্যানুয়াল (এই মাসে)",
    codThisMonth: "কুরিয়ার COD (এই মাসে)",
    allSources: "সব উৎস",
    sourceManual: "ম্যানুয়াল",
    sourceCod: "কুরিয়ার COD",
    sourceOnlineWallet: "অনলাইন (ওয়ালেট)",
    sourceOnlineGateway: "অনলাইন (গেটওয়ে)",
    allCollectors: "সবাই",
    search: "অর্ডার নং",
    fromDate: "শুরু",
    toDate: "শেষ",
    clearFilters: "ফিল্টার মুছুন",
    colDate: "তারিখ",
    colSource: "উৎস",
    colType: "ধরন",
    colMethod: "মাধ্যম",
    colAmount: "পরিমাণ",
    colCollector: "রিসিভার",
    colOrder: "অর্ডার",
    courierLabel: "কুরিয়ার",
    viewScreenshot: "স্ক্রিনশট",
    purposeNames: { advance: "অগ্রিম", courier_charge: "কুরিয়ার চার্জ", full_payment: "ফুল পেমেন্ট", other: "অন্যান্য", cod: "COD" } as Record<string, string>,
    methodNames: { cash: "ক্যাশ", bank: "ব্যাংক", bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", upay: "উপায়", other: "অন্যান্য", courier: "কুরিয়ার" } as Record<string, string>,
  },
  en: {
    pageTitle: "Collection History",
    subtitle: "Every payment collection source — manual, courier COD, (later) online payment — in one place.",
    loading: "Loading...",
    noRows: "No collections found.",
    thisMonth: "Total this month",
    manualThisMonth: "Manual (this month)",
    codThisMonth: "Courier COD (this month)",
    allSources: "All Sources",
    sourceManual: "Manual",
    sourceCod: "Courier COD",
    sourceOnlineWallet: "Online (Wallet)",
    sourceOnlineGateway: "Online (Gateway)",
    allCollectors: "Everyone",
    search: "Order #",
    fromDate: "From",
    toDate: "To",
    clearFilters: "Clear filters",
    colDate: "Date",
    colSource: "Source",
    colType: "Type",
    colMethod: "Method",
    colAmount: "Amount",
    colCollector: "Received by",
    colOrder: "Order",
    courierLabel: "Courier",
    viewScreenshot: "Screenshot",
    purposeNames: { advance: "Advance", courier_charge: "Courier charge", full_payment: "Full payment", other: "Other", cod: "COD" } as Record<string, string>,
    methodNames: { cash: "Cash", bank: "Bank", bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay", other: "Other", courier: "Courier" } as Record<string, string>,
  },
};

type Collector = { id: number; name: string };
type Row = {
  source: "manual" | "online_wallet" | "online_gateway" | "courier_cod";
  source_id: number;
  collected_at: string;
  type: string;
  method: string;
  amount: number;
  discount: number;
  collected_by_id: number | null;
  collected_by_name: string | null;
  screenshot_url: string | null;
  note: string | null;
  order_id: number;
  order_number: string;
  customer_name: string | null;
};
type Summary = { manual_total: number; courier_cod_total: number; grand_total: number };

const sourceColor: Record<string, string> = {
  manual: "bg-blue-500/15 text-blue-400",
  online_wallet: "bg-emerald-500/15 text-emerald-400",
  online_gateway: "bg-emerald-600/15 text-emerald-500",
  courier_cod: "bg-purple-500/15 text-purple-400",
};

export default function CollectionHistoryPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [rows, setRows] = useState<Row[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [summary, setSummary] = useState<Summary>({ manual_total: 0, courier_cod_total: 0, grand_total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCollector, setFilterCollector] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (filterSource !== "all") params.set("source", filterSource);
      if (filterCollector !== "all") params.set("collected_by", filterCollector);
      if (search) params.set("search", search);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`${API}/accounting/collections?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setRows(d.data ?? []);
        setCollectors(d.collectors ?? []);
        setTotal(d.meta?.total ?? 0);
        setLastPage(d.meta?.last_page ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterSource, filterCollector, search, fromDate, toDate, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [filterSource, filterCollector, search, fromDate, toDate]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/accounting/collections/summary?range=month`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setSummary({
          manual_total: d.data?.manual_total ?? 0,
          courier_cod_total: d.data?.courier_cod_total ?? 0,
          grand_total: d.data?.grand_total ?? 0,
        });
      }
    })();
  }, [token]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", { day: "2-digit", month: "short", year: "2-digit" });
  const clearFilters = () => { setFilterSource("all"); setFilterCollector("all"); setSearch(""); setFromDate(""); setToDate(""); };

  return (
    <UserShell activeKey="collection-history" defaultExpandedKey="accounting"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      <p className="mb-4 text-sm text-[var(--muted)]">{txt.subtitle}</p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <article className="rounded-2xl bg-[#0f7c7b] p-4 text-white">
          <p className="text-xs text-white/80">{txt.thisMonth}</p>
          <p className="mt-1 text-2xl font-bold">৳{summary.grand_total.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl bg-[#2f7ec1] p-4 text-white">
          <p className="text-xs text-white/80">{txt.manualThisMonth}</p>
          <p className="mt-1 text-2xl font-bold">৳{summary.manual_total.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl bg-[#7c3f9f] p-4 text-white">
          <p className="text-xs text-white/80">{txt.codThisMonth}</p>
          <p className="mt-1 text-2xl font-bold">৳{summary.courier_cod_total.toLocaleString()}</p>
        </article>
      </div>

      {/* Toolbar */}
      <div className="catv-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={txt.search}
          className="min-w-[140px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />

        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="all">{txt.allSources}</option>
          <option value="manual">{txt.sourceManual}</option>
          <option value="online_wallet">{txt.sourceOnlineWallet}</option>
          <option value="online_gateway">{txt.sourceOnlineGateway}</option>
          <option value="courier_cod">{txt.sourceCod}</option>
        </select>

        {collectors.length > 0 && (
          <select value={filterCollector} onChange={e => setFilterCollector(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="all">{txt.allCollectors}</option>
            {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          {txt.fromDate}
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          {txt.toDate}
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm" />
        </label>

        <button onClick={clearFilters} className="ml-auto rounded-xl border border-[var(--border)] px-3 py-2 text-xs hover:bg-[var(--surface-soft)]">
          {txt.clearFilters}
        </button>
      </div>

      {/* Table */}
      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-3 py-3">{txt.colDate}</th>
              <th className="px-3 py-3">{txt.colSource}</th>
              <th className="px-3 py-3">{txt.colType}</th>
              <th className="px-3 py-3">{txt.colMethod}</th>
              <th className="px-3 py-3 text-right">{txt.colAmount}</th>
              <th className="px-3 py-3">{txt.colCollector}</th>
              <th className="px-3 py-3">{txt.colOrder}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noRows}</td></tr>
            ) : rows.map(r => (
              <tr key={`${r.source}:${r.source_id}`} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-3 py-3 text-xs text-[var(--muted)]">{fmtDate(r.collected_at)}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sourceColor[r.source] ?? ""}`}>
                    {{
                      manual: txt.sourceManual,
                      online_wallet: txt.sourceOnlineWallet,
                      online_gateway: txt.sourceOnlineGateway,
                      courier_cod: txt.sourceCod,
                    }[r.source] ?? r.source}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs">{txt.purposeNames[r.type] ?? r.type}</td>
                <td className="px-3 py-3 text-xs">{txt.methodNames[r.method] ?? r.method}</td>
                <td className="px-3 py-3 text-right font-semibold">
                  ৳{r.amount.toLocaleString()}
                  {r.discount > 0 && <span className="ml-1 text-xs font-normal text-[var(--muted)]">(−৳{r.discount.toLocaleString()})</span>}
                </td>
                <td className="px-3 py-3 text-xs">
                  {r.source === "courier_cod"
                    ? txt.courierLabel
                    : r.collected_by_name ?? (r.source === "online_wallet" || r.source === "online_gateway" ? txt.sourceOnlineWallet : "—")}
                  {r.screenshot_url && (
                    <>
                      {" · "}
                      <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                        {txt.viewScreenshot}
                      </a>
                    </>
                  )}
                </td>
                <td className="px-3 py-3">
                  <a href={`/dashboard/orders/${r.order_id}`} className="font-mono text-xs text-[var(--accent)] hover:underline">
                    {r.order_number}
                  </a>
                  {r.customer_name && <p className="text-xs text-[var(--muted)]">{r.customer_name}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">{total} {locale === "bn" ? "টি এন্ট্রি" : "entries"}</p>
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
