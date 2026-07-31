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
    courierTitle: "কুরিয়ার ডেলিভারি হিস্টোরি",
    courierChecking: "কুরিয়ার থেকে ডেটা আনা হচ্ছে...",
    overall: "সর্বমোট",
    successRate: "সাফল্যের হার",
    totalParcel: "মোট পার্সেল",
    success: "সফল",
    cancelled2: "বাতিল",
    notConfigured: "সেটআপ করা হয়নি",
    notConfiguredHint: "কুরিয়ার সেটিং-এ লগইন যোগ করুন",
    fetchFailed: "ডেটা আনা যায়নি",
    lastChecked: "শেষ চেক",
    estimatedLabel: "আনুমানিক:",
    cachedBadge: "ক্যাশ",
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
    courierTitle: "Courier Delivery History",
    courierChecking: "Fetching data from couriers...",
    overall: "Overall",
    successRate: "Success Rate",
    totalParcel: "Total",
    success: "Success",
    cancelled2: "Cancelled",
    notConfigured: "Not configured",
    notConfiguredHint: "Add login in Courier Settings",
    fetchFailed: "Could not fetch data",
    lastChecked: "Last checked",
    estimatedLabel: "Estimated:",
    cachedBadge: "Cached",
  },
};

type FraudResult = {
  phone: string; fraud_score: number; risk_level: string; is_blacklisted: boolean;
  stats: { total: number; delivered: number; cancelled: number; returned: number };
  shared?: { seller_count: number; global_blacklisted_count: number };
  orders: { id: number; order_number: string; status: string; total: string; created_at: string }[];
};

type CourierCard = {
  name: string;
  data_type: "delivery" | "rating";
  total: number;
  success: number;
  cancelled: number;
  success_rate: number;
  rating: string | null;
  status: "ok" | "error" | "not_configured";
  message: string | null;
  last_checked_at: string | null;
  from_cache: boolean;
};

type CourierCheckResult = {
  phone: string;
  overall: { total: number; success: number; cancelled: number; success_rate: number };
  couriers: CourierCard[];
};

// Pathao's dashboard only exposes a qualitative rating label (e.g. "excellent_customer"),
// not raw delivery counts — map known keywords to a display label + color, best-effort.
function ratingDisplay(rating: string, locale: Locale): { label: string; color: string; estimate: string | null } {
  const r = rating.toLowerCase();
  if (r.includes("excellent")) return { label: locale === "bn" ? "চমৎকার গ্রাহক" : "Excellent Customer", color: "text-emerald-500", estimate: "~90-100%" };
  if (r.includes("good")) return { label: locale === "bn" ? "ভালো গ্রাহক" : "Good Customer", color: "text-emerald-400", estimate: "~70-89%" };
  if (r.includes("moderate")) return { label: locale === "bn" ? "মাঝারি" : "Moderate", color: "text-amber-500", estimate: "~50-69%" };
  if (r.includes("risky") || r.includes("bad")) return { label: locale === "bn" ? "ঝুঁকিপূর্ণ" : "Risky Customer", color: "text-red-500", estimate: "<50%" };
  if (r.includes("new")) return { label: locale === "bn" ? "নতুন গ্রাহক" : "New Customer", color: "text-[var(--muted)]", estimate: null };
  return { label: rating.replace(/_/g, " "), color: "text-[var(--muted)]", estimate: null };
}

const COURIER_META: Record<string, { label: string; header: string }> = {
  pathao: { label: "Pathao", header: "bg-red-600" },
  steadfast: { label: "Steadfast", header: "bg-teal-600" },
  redx: { label: "RedX", header: "bg-rose-700" },
  carrybee: { label: "CarryBee", header: "bg-amber-500 text-neutral-900" },
  paperfly: { label: "Paperfly", header: "bg-blue-600" },
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

  const [courierData, setCourierData] = useState<CourierCheckResult | null>(null);
  const [courierChecking, setCourierChecking] = useState(false);
  const [courierErrorMsg, setCourierErrorMsg] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!phone.trim()) return;
    const ph = phone.trim();
    setChecking(true); setResult(null); setBlMsg(null);
    setCourierChecking(true); setCourierData(null); setCourierErrorMsg(null);

    void (async () => {
      try {
        const res = await fetch(`${API}/fraud/check-phone`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ phone: ph }),
        });
        if (res.ok) { const d = await res.json(); setResult(d.data); }
      } finally { setChecking(false); }
    })();

    void (async () => {
      try {
        const res = await fetch(`${API}/fraud/courier-check?phone=${encodeURIComponent(ph)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (res.ok && d.success) {
          setCourierData(d.data);
        } else {
          setCourierErrorMsg(d.message ?? txt.fetchFailed);
        }
      } catch {
        setCourierErrorMsg(txt.fetchFailed);
      } finally {
        setCourierChecking(false);
      }
    })();
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
          {!result && !courierChecking && !courierData && !courierErrorMsg ? (
            <div className="catv-panel flex h-40 items-center justify-center text-sm text-[var(--muted)]">
              {txt.enterPhone}
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Courier delivery history (external, cached) */}
              {(courierChecking || courierData || courierErrorMsg) && (
                <div className="catv-panel p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{txt.courierTitle}</h3>
                    {courierChecking && (
                      <span className="text-xs text-[var(--muted)]">{txt.courierChecking}</span>
                    )}
                  </div>

                  {courierErrorMsg && !courierData && (
                    <p className="text-xs text-red-400">{courierErrorMsg}</p>
                  )}

                  {courierData && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
                      {/* Overall */}
                      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                        <div className="bg-violet-600 px-3 py-2 text-sm font-bold text-white">
                          {txt.overall}
                        </div>
                        <div className="space-y-1 bg-[var(--background)] px-3 py-2.5 text-xs">
                          <Row label={txt.successRate} value={`${courierData.overall.success_rate}%`} bold />
                          <Row label={txt.totalParcel} value={courierData.overall.total} />
                          <Row label={txt.success} value={courierData.overall.success} />
                          <Row label={txt.cancelled2} value={courierData.overall.cancelled} />
                          <Progress pct={courierData.overall.success_rate} />
                        </div>
                      </div>

                      {courierData.couriers.map(card => {
                        const meta = COURIER_META[card.name] ?? { label: card.name, header: "bg-neutral-600" };
                        return (
                          <div key={card.name} className="overflow-hidden rounded-2xl border border-[var(--border)]">
                            <div className={`flex items-center justify-between px-3 py-2 text-sm font-bold text-white ${meta.header}`}>
                              <span>{meta.label}</span>
                              {card.from_cache && (
                                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                                  {txt.cachedBadge}
                                </span>
                              )}
                            </div>
                            <div className="bg-[var(--background)] px-3 py-2.5 text-xs">
                              {card.status === "not_configured" ? (
                                <div className="py-3 text-center text-[var(--muted)]">
                                  <p className="font-semibold">{txt.notConfigured}</p>
                                  <p className="mt-1 text-[10px]">{txt.notConfiguredHint}</p>
                                </div>
                              ) : card.status === "error" ? (
                                <div className="py-3 text-center text-red-400">
                                  <p className="font-semibold">{txt.fetchFailed}</p>
                                  {card.message && <p className="mt-1 text-[10px] opacity-80">{card.message}</p>}
                                </div>
                              ) : card.data_type === "rating" && card.rating ? (
                                (() => {
                                  const r = ratingDisplay(card.rating as string, locale);
                                  return (
                                    <div className="py-3 text-center">
                                      <p className={`text-sm font-bold ${r.color}`}>{r.label}</p>
                                      {r.estimate && (
                                        <p className="mt-1 text-[10px] text-[var(--muted)]">
                                          {txt.estimatedLabel} {r.estimate}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : (
                                <div className="space-y-1">
                                  <Row label={txt.successRate} value={`${card.success_rate}%`} bold />
                                  <Row label={txt.totalParcel} value={card.total} />
                                  <Row label={txt.success} value={card.success} />
                                  <Row label={txt.cancelled2} value={card.cancelled} />
                                  <Progress pct={card.success_rate} />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {result && (
              <>
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
              </>
              )}
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={bold ? "font-bold text-emerald-500" : "font-semibold"}>{value}</span>
    </div>
  );
}

function Progress({ pct }: { pct: number }) {
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <div
        className="h-full rounded-full bg-emerald-500"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
