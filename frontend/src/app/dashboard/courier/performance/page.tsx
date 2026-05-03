"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "Steadfast কন্ট্রোল সেন্টার",
    subtitle: "Steadfast Courier এর balance, tracking, return, payment ও police station tools এক জায়গায়।",
    loading: "লোড হচ্ছে...",
    refresh: "রিফ্রেশ",
    tabs: {
      overview: "Overview",
      returns: "Return Requests",
      payments: "Payments",
      police: "Police Stations",
    },
    currentBalance: "বর্তমান ব্যালেন্স",
    statusLookup: "Status Lookup",
    lookupBy: "যে মাধ্যমে খুঁজবেন",
    consignment: "Consignment ID",
    invoice: "Invoice",
    tracking: "Tracking Code",
    lookupValue: "Lookup value",
    lookupBtn: "স্ট্যাটাস দেখুন",
    checking: "চেক হচ্ছে...",
    noResult: "কোনো রেজাল্ট পাওয়া যায়নি।",
    deliveryStatus: "ডেলিভারি স্ট্যাটাস",
    createReturn: "রিটার্ন রিকোয়েস্ট তৈরি",
    identifier: "Consignment / Invoice / Tracking",
    reason: "কারণ (ঐচ্ছিক)",
    createBtn: "রিকোয়েস্ট পাঠান",
    creating: "পাঠানো হচ্ছে...",
    returnRequests: "রিটার্ন রিকোয়েস্ট লিস্ট",
    payments: "পেমেন্ট লিস্ট",
    paymentId: "Payment ID",
    fetchPayment: "ডিটেইল দেখুন",
    policeStations: "Police Stations",
    search: "সার্চ",
    noData: "কোনো ডাটা নেই।",
    messageLoadError: "ডাটা লোড করা যায়নি।",
    successReturn: "রিটার্ন রিকোয়েস্ট পাঠানো হয়েছে।",
    details: "বিস্তারিত",
    amount: "Amount",
    status: "Status",
    createdAt: "Created",
    searchPolice: "থানা/স্টেশন সার্চ",
  },
  en: {
    pageTitle: "Steadfast Control Center",
    subtitle: "Balance, tracking, return, payment and police station tools for Steadfast Courier in one place.",
    loading: "Loading...",
    refresh: "Refresh",
    tabs: {
      overview: "Overview",
      returns: "Return Requests",
      payments: "Payments",
      police: "Police Stations",
    },
    currentBalance: "Current Balance",
    statusLookup: "Status Lookup",
    lookupBy: "Lookup by",
    consignment: "Consignment ID",
    invoice: "Invoice",
    tracking: "Tracking Code",
    lookupValue: "Lookup value",
    lookupBtn: "Check status",
    checking: "Checking...",
    noResult: "No result found.",
    deliveryStatus: "Delivery Status",
    createReturn: "Create Return Request",
    identifier: "Consignment / Invoice / Tracking",
    reason: "Reason (optional)",
    createBtn: "Submit request",
    creating: "Submitting...",
    returnRequests: "Return Requests",
    payments: "Payments",
    paymentId: "Payment ID",
    fetchPayment: "View details",
    policeStations: "Police Stations",
    search: "Search",
    noData: "No data found.",
    messageLoadError: "Failed to load data.",
    successReturn: "Return request submitted.",
    details: "Details",
    amount: "Amount",
    status: "Status",
    createdAt: "Created",
    searchPolice: "Search police station",
  },
};

type TabKey = "overview" | "returns" | "payments" | "police";
type LookupMode = "consignment" | "invoice" | "tracking";

function getListData(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [balance, setBalance] = useState<number | null>(null);
  const [lookupMode, setLookupMode] = useState<LookupMode>("consignment");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null);

  const [returnIdentifier, setReturnIdentifier] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [returnRequests, setReturnRequests] = useState<Record<string, unknown>[]>([]);

  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [paymentLookupId, setPaymentLookupId] = useState("");
  const [paymentDetails, setPaymentDetails] = useState<Record<string, unknown> | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [policeStations, setPoliceStations] = useState<Record<string, unknown>[]>([]);
  const [policeSearch, setPoliceSearch] = useState("");

  const fetchBalance = useCallback(async () => {
    const res = await fetch(`${API}/courier/steadfast/balance`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    if (res.ok && d.success) {
      setBalance(Number(d.data?.current_balance ?? 0));
    } else {
      throw new Error(d.message ?? txt.messageLoadError);
    }
  }, [token, txt.messageLoadError]);

  const fetchReturnRequests = useCallback(async () => {
    const res = await fetch(`${API}/courier/steadfast/return-requests`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    if (res.ok) setReturnRequests(getListData(d.data) as Record<string, unknown>[]);
  }, [token]);

  const fetchPayments = useCallback(async () => {
    const res = await fetch(`${API}/courier/steadfast/payments`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    if (res.ok) setPayments(getListData(d.data) as Record<string, unknown>[]);
  }, [token]);

  const fetchPoliceStations = useCallback(async () => {
    const res = await fetch(`${API}/courier/steadfast/police-stations`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    if (res.ok) setPoliceStations(getListData(d.data) as Record<string, unknown>[]);
  }, [token]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      await Promise.all([fetchBalance(), fetchReturnRequests(), fetchPayments(), fetchPoliceStations()]);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : txt.messageLoadError });
    } finally {
      setLoading(false);
    }
  }, [fetchBalance, fetchPayments, fetchPoliceStations, fetchReturnRequests, txt.messageLoadError]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  const handleLookup = async () => {
    if (!lookupValue.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    setMessage(null);
    try {
      const path = lookupMode === "consignment"
        ? `consignment/${encodeURIComponent(lookupValue.trim())}`
        : lookupMode === "invoice"
          ? `invoice/${encodeURIComponent(lookupValue.trim())}`
          : `tracking/${encodeURIComponent(lookupValue.trim())}`;
      const res = await fetch(`${API}/courier/steadfast/status/${path}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok && d.success) {
        setLookupResult((d.data ?? null) as Record<string, unknown> | null);
      } else {
        setMessage({ type: "error", text: d.message ?? txt.noResult });
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateReturn = async () => {
    if (!returnIdentifier.trim()) return;
    setCreatingReturn(true);
    setMessage(null);
    try {
      const identifier = returnIdentifier.trim();
      const payload: Record<string, unknown> = { reason: returnReason.trim() || undefined };
      if (/^\d+$/.test(identifier)) {
        payload.consignment_id = identifier;
      } else if (/^[A-Za-z0-9_-]+$/.test(identifier) && identifier.toLowerCase().includes("tp")) {
        payload.tracking_code = identifier;
      } else {
        payload.invoice = identifier;
      }

      const res = await fetch(`${API}/courier/steadfast/return-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setMessage({ type: "success", text: d.message ?? txt.successReturn });
        setReturnIdentifier("");
        setReturnReason("");
        void fetchReturnRequests();
      } else {
        setMessage({ type: "error", text: d.message ?? txt.messageLoadError });
      }
    } finally {
      setCreatingReturn(false);
    }
  };

  const handleFetchPayment = async () => {
    if (!paymentLookupId.trim()) return;
    setPaymentLoading(true);
    setPaymentDetails(null);
    try {
      const res = await fetch(`${API}/courier/steadfast/payments/${encodeURIComponent(paymentLookupId.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setPaymentDetails((d.data ?? null) as Record<string, unknown> | null);
    } finally {
      setPaymentLoading(false);
    }
  };

  const filteredPolice = policeStations.filter(item => stringify(item.name ?? item.station_name ?? item.thana_name ?? item.bn_name).toLowerCase().includes(policeSearch.toLowerCase()));

  return (
    <UserShell activeKey="courier-perf" defaultExpandedKey="courier" pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
      <div className="mb-4 flex items-start justify-between gap-3 catv-panel p-4">
        <div>
          <h2 className="text-lg font-bold">{txt.pageTitle}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{txt.subtitle}</p>
        </div>
        <button onClick={() => void refreshAll()} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.refresh}</button>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {message.text}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {(["overview", "returns", "payments", "police"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab ? "bg-[var(--accent)] text-white" : "catv-panel hover:bg-[var(--surface-soft)]"}`}>
            {txt.tabs[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="catv-panel p-8 text-center text-[var(--muted)]">{txt.loading}</div>
      ) : (
        <div className="grid gap-4">
          {activeTab === "overview" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="catv-panel p-5">
                  <p className="text-xs uppercase text-[var(--muted)]">{txt.currentBalance}</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-400">৳{balance?.toLocaleString() ?? "0"}</p>
                </div>
                <div className="catv-panel p-5">
                  <h3 className="mb-3 text-sm font-semibold">{txt.statusLookup}</h3>
                  <div className="grid gap-3">
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.lookupBy}</span>
                      <select value={lookupMode} onChange={e => setLookupMode(e.target.value as LookupMode)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                        <option value="consignment">{txt.consignment}</option>
                        <option value="invoice">{txt.invoice}</option>
                        <option value="tracking">{txt.tracking}</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{txt.lookupValue}</span>
                      <input value={lookupValue} onChange={e => setLookupValue(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                    </label>
                    <div className="flex justify-end">
                      <button onClick={() => void handleLookup()} disabled={lookupLoading || !lookupValue.trim()} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                        {lookupLoading ? txt.checking : txt.lookupBtn}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="catv-panel p-5">
                <h3 className="mb-3 text-sm font-semibold">{txt.details}</h3>
                {lookupResult ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(lookupResult).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-[var(--border)] px-3 py-2">
                        <p className="text-xs uppercase text-[var(--muted)]">{key.replace(/_/g, " ")}</p>
                        <p className="mt-1 text-sm">{stringify(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">{txt.noResult}</p>
                )}
              </div>
            </>
          )}

          {activeTab === "returns" && (
            <div className="grid gap-4 lg:grid-cols-[420px,1fr]">
              <div className="catv-panel p-5">
                <h3 className="mb-3 text-sm font-semibold">{txt.createReturn}</h3>
                <div className="grid gap-3">
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">{txt.identifier}</span>
                    <input value={returnIdentifier} onChange={e => setReturnIdentifier(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">{txt.reason}</span>
                    <textarea value={returnReason} onChange={e => setReturnReason(e.target.value)} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none" />
                  </label>
                  <button onClick={() => void handleCreateReturn()} disabled={creatingReturn || !returnIdentifier.trim()} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {creatingReturn ? txt.creating : txt.createBtn}
                  </button>
                </div>
              </div>
              <div className="catv-panel p-5">
                <h3 className="mb-3 text-sm font-semibold">{txt.returnRequests}</h3>
                {returnRequests.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">{txt.noData}</p>
                ) : (
                  <div className="grid gap-2">
                    {returnRequests.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-[var(--border)] px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">#{stringify(item.id ?? item.consignment_id ?? item.invoice)}</p>
                          <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-xs">{stringify(item.status)}</span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">{stringify(item.reason)}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{txt.createdAt}: {stringify(item.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="grid gap-4 lg:grid-cols-[420px,1fr]">
              <div className="catv-panel p-5">
                <h3 className="mb-3 text-sm font-semibold">{txt.fetchPayment}</h3>
                <div className="grid gap-3">
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">{txt.paymentId}</span>
                    <input value={paymentLookupId} onChange={e => setPaymentLookupId(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                  </label>
                  <button onClick={() => void handleFetchPayment()} disabled={paymentLoading || !paymentLookupId.trim()} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {paymentLoading ? txt.loading : txt.fetchPayment}
                  </button>
                  {paymentDetails && (
                    <div className="rounded-xl border border-[var(--border)] p-3 text-sm">
                      {Object.entries(paymentDetails).slice(0, 12).map(([key, value]) => (
                        <p key={key}><span className="text-[var(--muted)]">{key}:</span> {stringify(value)}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="catv-panel p-5">
                <h3 className="mb-3 text-sm font-semibold">{txt.payments}</h3>
                {payments.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">{txt.noData}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
                          <th className="px-3 py-2">{txt.paymentId}</th>
                          <th className="px-3 py-2">{txt.amount}</th>
                          <th className="px-3 py-2">{txt.status}</th>
                          <th className="px-3 py-2">{txt.createdAt}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((item, idx) => (
                          <tr key={idx} className="border-b border-[var(--border)]">
                            <td className="px-3 py-2">{stringify(item.id ?? item.payment_id)}</td>
                            <td className="px-3 py-2">{stringify(item.amount ?? item.total_amount ?? item.payable_amount)}</td>
                            <td className="px-3 py-2">{stringify(item.status)}</td>
                            <td className="px-3 py-2">{stringify(item.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "police" && (
            <div className="catv-panel p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{txt.policeStations}</h3>
                <input value={policeSearch} onChange={e => setPoliceSearch(e.target.value)} placeholder={txt.searchPolice} className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </div>
              {filteredPolice.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{txt.noData}</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {filteredPolice.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-[var(--border)] px-3 py-3">
                      {Object.entries(item).slice(0, 6).map(([key, value]) => (
                        <p key={key} className="text-sm"><span className="text-[var(--muted)]">{key}:</span> {stringify(value)}</p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </UserShell>
  );
}
