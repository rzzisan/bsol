"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "অনলাইন পেমেন্ট ভেরিফাই",
    subtitle: "কাস্টমার পার্সোনাল বিকাশ/নগদ/রকেট-এ টাকা পাঠিয়ে যে দাবিগুলো জমা দিয়েছে, সেগুলো যাচাই করে অ্যাপ্রুভ/রিজেক্ট করুন।",
    loading: "লোড হচ্ছে...",
    noRows: "যাচাইয়ের অপেক্ষায় কোনো দাবি নেই।",
    colOrder: "অর্ডার",
    colProvider: "মাধ্যম",
    colSender: "প্রেরকের নম্বর",
    colTrxId: "Transaction ID",
    colAmount: "পরিমাণ",
    claimedAmount: (n: string) => `কাস্টমার দাবি করেছে: ৳${n}`,
    colScreenshot: "স্ক্রিনশট",
    viewScreenshot: "দেখুন",
    noScreenshot: "নেই",
    approve: "অ্যাপ্রুভ",
    reject: "রিজেক্ট",
    approving: "হচ্ছে...",
    approveSuccess: "পেমেন্ট ভেরিফাই করা হয়েছে।",
    rejectSuccess: "দাবিটি বাতিল করা হয়েছে।",
    actionError: "কিছু একটা সমস্যা হয়েছে।",
    rejectPrompt: "রিজেক্ট করার কারণ (ঐচ্ছিক):",
    amountRequired: "কত টাকা পেয়েছেন তা লিখুন।",
    amountHint: "আসলে যা পেয়েছেন তা লিখুন — কাস্টমারের দাবির থেকে ভিন্ন হতে পারে।",
  },
  en: {
    pageTitle: "Online Payment Verification",
    subtitle: "Verify and approve/reject claims customers submitted after sending money to your personal bKash/Nagad/Rocket number.",
    loading: "Loading...",
    noRows: "No claims awaiting verification.",
    colOrder: "Order",
    colProvider: "Channel",
    colSender: "Sender number",
    colTrxId: "Transaction ID",
    colAmount: "Amount",
    claimedAmount: (n: string) => `Customer claimed: ৳${n}`,
    colScreenshot: "Screenshot",
    viewScreenshot: "View",
    noScreenshot: "None",
    approve: "Approve",
    reject: "Reject",
    approving: "Working...",
    approveSuccess: "Payment verified.",
    rejectSuccess: "Claim rejected.",
    actionError: "Something went wrong.",
    rejectPrompt: "Reason for rejection (optional):",
    amountRequired: "Enter the amount you actually received.",
    amountHint: "Enter what you actually received — may differ from the customer's claim.",
  },
};

const providerLabel: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };

type Claim = {
  id: number;
  provider: string;
  amount: number;
  sender_number: string | null;
  customer_trx_id: string | null;
  screenshot_url: string | null;
  created_at: string;
  order: { id: number; order_number: string; customer_name: string | null; customer_phone: string | null; total: number } | null;
};

export default function OnlinePaymentVerificationPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Seller-entered "what I actually received" per claim — pre-filled from
  // the customer's own claim amount but always editable/required before
  // approving. See online_payment_context.md.
  const [amountInputs, setAmountInputs] = useState<Record<number, string>>({});

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/online-payments/pending-verification`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        const list: Claim[] = d.data ?? [];
        setClaims(list);
        setAmountInputs((prev) => {
          const next = { ...prev };
          for (const c of list) {
            if (next[c.id] === undefined) next[c.id] = String(c.amount);
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void fetchClaims(); }, [fetchClaims]);

  const act = async (id: number, approve: boolean) => {
    const amount = amountInputs[id];
    if (approve && (!amount || Number(amount) <= 0)) {
      setMessage({ type: "error", text: txt.amountRequired });
      return;
    }
    const note = approve ? undefined : (window.prompt(txt.rejectPrompt) ?? undefined);
    setActingId(id);
    setMessage(null);
    try {
      const res = await fetch(`${API}/online-payments/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approve, note, amount: approve ? Number(amount) : undefined }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok) {
        setMessage({ type: "success", text: approve ? txt.approveSuccess : txt.rejectSuccess });
        setClaims((prev) => prev.filter((c) => c.id !== id));
      } else {
        setMessage({ type: "error", text: d?.message ?? txt.actionError });
      }
    } finally {
      setActingId(null);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString(locale === "bn" ? "bn-BD" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <UserShell activeKey="online-payment-verification" defaultExpandedKey="accounting"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      <p className="mb-4 text-sm text-[var(--muted)]">{txt.subtitle}</p>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {message.text}
        </div>
      )}

      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-3 py-3">{txt.colOrder}</th>
              <th className="px-3 py-3">{txt.colProvider}</th>
              <th className="px-3 py-3">{txt.colSender}</th>
              <th className="px-3 py-3">{txt.colTrxId}</th>
              <th className="px-3 py-3">{txt.colAmount}</th>
              <th className="px-3 py-3">{txt.colScreenshot}</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : claims.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noRows}</td></tr>
            ) : claims.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-3 py-3">
                  {c.order && (
                    <a href={`/dashboard/orders/${c.order.id}`} className="font-mono text-xs text-[var(--accent)] hover:underline">
                      {c.order.order_number}
                    </a>
                  )}
                  <p className="text-xs text-[var(--muted)]">{c.order?.customer_name}</p>
                  <p className="text-[10px] text-[var(--muted)]">{fmtDate(c.created_at)}</p>
                </td>
                <td className="px-3 py-3 text-xs font-semibold">{providerLabel[c.provider] ?? c.provider}</td>
                <td className="px-3 py-3 font-mono text-xs">{c.sender_number ?? "—"}</td>
                <td className="px-3 py-3 font-mono text-xs">{c.customer_trx_id ?? "—"}</td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amountInputs[c.id] ?? String(c.amount)}
                    onChange={(e) => setAmountInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    className="w-28 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm font-semibold outline-none focus:border-[var(--accent)]"
                  />
                  <p className="mt-1 text-[10px] text-[var(--muted)]" title={txt.amountHint}>
                    {txt.claimedAmount(c.amount.toLocaleString())}
                  </p>
                </td>
                <td className="px-3 py-3 text-xs">
                  {c.screenshot_url ? (
                    <a href={c.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                      {txt.viewScreenshot}
                    </a>
                  ) : (
                    <span className="text-[var(--muted)]">{txt.noScreenshot}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => void act(c.id, true)}
                      disabled={actingId === c.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {actingId === c.id ? txt.approving : txt.approve}
                    </button>
                    <button
                      onClick={() => void act(c.id, false)}
                      disabled={actingId === c.id}
                      className="rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-60"
                    >
                      {txt.reject}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UserShell>
  );
}
