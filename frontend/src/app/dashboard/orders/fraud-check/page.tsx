"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const RISK_STYLE: Record<string, string> = {
  low:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  high:   "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_STYLE: Record<string, string> = {
  pending:    "bg-yellow-500/15 text-yellow-400",
  confirmed:  "bg-blue-500/15 text-blue-400",
  processing: "bg-indigo-500/15 text-indigo-400",
  shipped:    "bg-cyan-500/15 text-cyan-400",
  delivered:  "bg-emerald-500/15 text-emerald-400",
  cancelled:  "bg-red-500/15 text-red-400",
  returned:   "bg-orange-500/15 text-orange-400",
};

const t = {
  bn: {
    pageTitle: "ফ্রড চেক",
    phonePlaceholder: "ফোন নম্বর লিখুন (01XXXXXXXXX)",
    check: "চেক করুন",
    checking: "চেক হচ্ছে...",
    bulkTitle: "বাল্ক চেক",
    bulkPlaceholder: "একাধিক ফোন নম্বর লিখুন (প্রতি লাইনে একটি)",
    bulkCheck: "সব চেক করুন",
    bulkChecking: "চেক হচ্ছে...",
    addBlacklist: "ব্ল্যাকলিস্টে যোগ করুন",
    adding: "যোগ হচ্ছে...",
    blacklistSuccess: "ব্ল্যাকলিস্টে যোগ করা হয়েছে",
    fraudScore: "ফ্রড স্কোর",
    riskLevel: "ঝুঁকি স্তর",
    totalOrders: "মোট অর্ডার",
    delivered: "ডেলিভারি",
    cancelled: "বাতিল",
    returned: "রিটার্ন",
    blacklisted: "⛔ ব্ল্যাকলিস্টেড",
    orderHistory: "অর্ডার ইতিহাস",
    orderNo: "অর্ডার নং",
    status: "স্ট্যাটাস",
    total: "মোট",
    date: "তারিখ",
    noOrders: "কোনো অর্ডার নেই",
    enterPhone: "একটি ফোন নম্বর দিয়ে চেক শুরু করুন",
    bulkResults: "বাল্ক ফলাফল",
    phone: "ফোন",
    sharedSellers: "শেয়ার্ড বিক্রেতা",
    sharedBlacklist: "গ্লোবাল ব্ল্যাকলিস্ট",
  },
  en: {
    pageTitle: "Fraud Check",
    phonePlaceholder: "Enter phone (01XXXXXXXXX)",
    check: "Check",
    checking: "Checking...",
    bulkTitle: "Bulk Check",
    bulkPlaceholder: "Enter multiple phones (one per line)",
    bulkCheck: "Check All",
    bulkChecking: "Checking...",
    addBlacklist: "Add to Blacklist",
    adding: "Adding...",
    blacklistSuccess: "Added to blacklist",
    fraudScore: "Fraud Score",
    riskLevel: "Risk Level",
    totalOrders: "Total Orders",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
    blacklisted: "⛔ Blacklisted",
    orderHistory: "Order History",
    orderNo: "Order #",
    status: "Status",
    total: "Total",
    date: "Date",
    noOrders: "No orders",
    enterPhone: "Enter a phone number to start checking",
    bulkResults: "Bulk Results",
    phone: "Phone",
    sharedSellers: "Shared Sellers",
    sharedBlacklist: "Global Blacklists",
  },
};

type FraudResult = {
  phone: string; fraud_score: number; risk_level: string; is_blacklisted: boolean;
  stats: { total: number; delivered: number; cancelled: number; returned: number };
  shared?: { seller_count: number; global_blacklisted_count: number };
  orders: { id: number; order_number: string; status: string; total: string; created_at: string }[];
};

export default function FraudCheckPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FraudResult | null>(null);
  const [addingBl, setAddingBl] = useState(false);
  const [blMsg, setBlMsg] = useState<string | null>(null);

  const [bulkInput, setBulkInput] = useState("");
  const [bulkChecking, setBulkChecking] = useState(false);
  const [bulkResults, setBulkResults] = useState<FraudResult[]>([]);

  const handleCheck = async () => {
    if (!phone.trim()) return;
    setChecking(true); setResult(null); setBlMsg(null);
    try {
      const res = await fetch(`${API}/fraud/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (res.ok) { const d = await res.json(); setResult(d.data); }
    } finally { setChecking(false); }
  };

  const handleBulk = async () => {
    const phones = bulkInput.split("\n").map(p => p.trim()).filter(Boolean);
    if (!phones.length) return;
    setBulkChecking(true); setBulkResults([]);
    try {
      const res = await fetch(`${API}/fraud/bulk-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phones }),
      });
      if (res.ok) { const d = await res.json(); setBulkResults(d.data ?? []); }
    } finally { setBulkChecking(false); }
  };

  const handleAddBlacklist = async (ph: string) => {
    setAddingBl(true); setBlMsg(null);
    try {
      const res = await fetch(`${API}/fraud/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: ph }),
      });
      const d = await res.json();
      if (res.ok) {
        setBlMsg(txt.blacklistSuccess);
        if (result && result.phone === ph) setResult({ ...result, is_blacklisted: true });
      } else {
        setBlMsg(d.message ?? "Error");
      }
    } finally { setAddingBl(false); }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB");

  return (
    <UserShell activeKey="fraud-check" defaultExpandedKey="orders"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      <div className="grid gap-4 lg:grid-cols-3">

        {/* Left: Single check + bulk */}
        <div className="flex flex-col gap-4">

          {/* Single phone check */}
          <div className="catv-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">{txt.pageTitle}</h3>
            <div className="flex gap-2">
              <input value={phone} onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && void handleCheck()}
                placeholder={txt.phonePlaceholder}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              <button onClick={() => void handleCheck()} disabled={checking || !phone.trim()}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {checking ? txt.checking : txt.check}
              </button>
            </div>
          </div>

          {/* Bulk check */}
          <div className="catv-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">{txt.bulkTitle}</h3>
            <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} rows={5}
              placeholder={txt.bulkPlaceholder}
              className="mb-3 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            <button onClick={() => void handleBulk()} disabled={bulkChecking || !bulkInput.trim()}
              className="w-full rounded-xl bg-[var(--accent)] py-2 text-sm font-semibold text-white disabled:opacity-60">
              {bulkChecking ? txt.bulkChecking : txt.bulkCheck}
            </button>
          </div>

          {/* Bulk results */}
          {bulkResults.length > 0 && (
            <div className="catv-panel p-4">
              <h3 className="mb-3 text-sm font-semibold">{txt.bulkResults}</h3>
              <div className="flex flex-col gap-2">
                {bulkResults.map(r => (
                  <div key={r.phone}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${RISK_STYLE[r.risk_level] ?? ""}`}>
                    <span className="font-mono">{r.phone}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{r.fraud_score}</span>
                      <span className="capitalize">{r.risk_level}</span>
                      {r.is_blacklisted && <span>⛔</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Result detail */}
        <div className="lg:col-span-2">
          {!result ? (
            <div className="catv-panel flex h-40 items-center justify-center text-sm text-[var(--muted)]">
              {txt.enterPhone}
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Score card */}
              <div className={`catv-panel border p-5 ${RISK_STYLE[result.risk_level] ?? ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-bold">{result.phone}</p>
                    {result.is_blacklisted && (
                      <p className="mt-1 text-xs font-semibold">{txt.blacklisted}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black">{result.fraud_score}</p>
                    <p className="text-xs uppercase tracking-wide">{txt.fraudScore}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-3 text-center text-xs">
                  {[
                    [txt.totalOrders, result.stats.total],
                    [txt.delivered, result.stats.delivered],
                    [txt.cancelled, result.stats.cancelled],
                    [txt.returned, result.stats.returned],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="rounded-xl bg-white/5 py-2">
                      <p className="text-lg font-bold">{val}</p>
                      <p className="text-[10px] opacity-80">{label}</p>
                    </div>
                  ))}
                </div>

                {result.shared && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <p className="opacity-80">{txt.sharedSellers}</p>
                      <p className="text-base font-bold">{result.shared.seller_count}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <p className="opacity-80">{txt.sharedBlacklist}</p>
                      <p className="text-base font-bold">{result.shared.global_blacklisted_count}</p>
                    </div>
                  </div>
                )}

                {!result.is_blacklisted && (
                  <div className="mt-4">
                    {blMsg ? (
                      <p className="text-xs font-semibold">{blMsg}</p>
                    ) : (
                      <button onClick={() => void handleAddBlacklist(result.phone)} disabled={addingBl}
                        className="rounded-xl border border-current px-4 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-60">
                        {addingBl ? txt.adding : txt.addBlacklist}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Order history */}
              <div className="catv-panel p-4">
                <h3 className="mb-3 text-sm font-semibold">{txt.orderHistory}</h3>
                {result.orders.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">{txt.noOrders}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-[var(--muted)] uppercase">
                          <th className="pb-2 pr-4">{txt.orderNo}</th>
                          <th className="pb-2 pr-4">{txt.status}</th>
                          <th className="pb-2 pr-4 text-right">{txt.total}</th>
                          <th className="pb-2 text-right">{txt.date}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.orders.map(o => (
                          <tr key={o.id} className="border-b border-[var(--border)]/50">
                            <td className="py-2 pr-4 font-mono text-[var(--accent)]">{o.order_number}</td>
                            <td className="py-2 pr-4">
                              <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[o.status] ?? ""}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right">৳{Number(o.total).toLocaleString()}</td>
                            <td className="py-2 text-right text-[var(--muted)]">{fmtDate(o.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}

