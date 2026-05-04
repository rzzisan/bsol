"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

interface SummaryData {
  income: number;
  expense: number;
  profit: number;
}

interface Txn {
  id: number;
  type: "income" | "expense";
  status: "pending" | "confirmed";
  category: string;
  amount: string;
  note: string | null;
  transaction_date: string;
  is_auto: boolean;
}

const text = {
  bn: {
    title: "দৈনিক রিপোর্ট",
    subtitle: "আজকের আয়, ব্যয় ও মুনাফার সারসংক্ষেপ",
    loading: "লোড হচ্ছে...",
    error: "ডাটা লোড করা যায়নি।",
    cards: {
      income: "আজকের আয়",
      expense: "আজকের ব্যয়",
      profit: "আজকের মুনাফা",
    },
    recent: "সাম্প্রতিক ট্রানজেকশন",
    empty: "আজকে কোনো ট্রানজেকশন নেই।",
    cols: {
      date: "তারিখ",
      type: "ধরন",
      category: "ক্যাটাগরি",
      amount: "পরিমাণ",
      note: "নোট",
      status: "স্ট্যাটাস",
    },
    type: { income: "আয়", expense: "ব্যয়" },
    status: { pending: "পেন্ডিং", confirmed: "কনফার্মড" },
  },
  en: {
    title: "Daily Report",
    subtitle: "Today’s income, expense and profit summary",
    loading: "Loading...",
    error: "Failed to load data.",
    cards: {
      income: "Today Income",
      expense: "Today Expense",
      profit: "Today Profit",
    },
    recent: "Recent Transactions",
    empty: "No transactions found for today.",
    cols: {
      date: "Date",
      type: "Type",
      category: "Category",
      amount: "Amount",
      note: "Note",
      status: "Status",
    },
    type: { income: "Income", expense: "Expense" },
    status: { pending: "Pending", confirmed: "Confirmed" },
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData>({ income: 0, expense: 0, profit: 0 });
  const [rows, setRows] = useState<Txn[]>([]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sRes, tRes] = await Promise.all([
          fetch(`${API}/accounting/summary?range=today`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          }),
          fetch(`${API}/accounting/transactions?from=${new Date().toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}&per_page=20`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          }),
        ]);

        const sData = await sRes.json();
        const txData = await tRes.json();

        if (!sRes.ok || !tRes.ok) {
          setError((sData?.message ?? txData?.message ?? t.error) as string);
          return;
        }

        setSummary({
          income: Number(sData?.data?.income ?? 0),
          expense: Number(sData?.data?.expense ?? 0),
          profit: Number(sData?.data?.profit ?? 0),
        });
        setRows((txData?.data ?? []) as Txn[]);
      } catch {
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [t.error]);

  const money = (n: number) => `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <UserShell
      activeKey="daily-report"
      defaultExpandedKey="accounting"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      <section className="mx-4 mb-4 grid gap-3 sm:grid-cols-3">
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.income}</p>
          <p className="mt-2 text-xl font-bold text-emerald-600">{money(summary.income)}</p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.expense}</p>
          <p className="mt-2 text-xl font-bold text-rose-600">{money(summary.expense)}</p>
        </div>
        <div className="catv-panel p-4">
          <p className="text-xs text-[var(--muted)]">{t.cards.profit}</p>
          <p className={`mt-2 text-xl font-bold ${summary.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{money(summary.profit)}</p>
        </div>
      </section>

      <section className="catv-panel mx-4 mb-6 overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">{t.recent}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">{t.cols.date}</th>
                <th className="px-3 py-2">{t.cols.type}</th>
                <th className="px-3 py-2">{t.cols.category}</th>
                <th className="px-3 py-2">{t.cols.amount}</th>
                <th className="px-3 py-2">{t.cols.note}</th>
                <th className="px-3 py-2">{t.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">{t.loading}</td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-red-600">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">{t.empty}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{r.transaction_date}</td>
                  <td className="px-3 py-2">{t.type[r.type]}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className={`px-3 py-2 font-semibold ${r.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                    {r.type === "income" ? "+" : "-"}৳{Number(r.amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.note ?? "-"}</td>
                  <td className="px-3 py-2">{t.status[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </UserShell>
  );
}
