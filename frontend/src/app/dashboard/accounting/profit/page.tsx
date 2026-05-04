"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

interface SummaryResp {
  income: number;
  expense: number;
  profit: number;
  top_expense_categories: Array<{ category: string; total: string }>;
}

const text = {
  bn: {
    title: "মুনাফা ড্যাশবোর্ড",
    subtitle: "আয় বনাম ব্যয় বিশ্লেষণ",
    range: "রেঞ্জ",
    day: "আজ",
    week: "সপ্তাহ",
    month: "মাস",
    cards: { income: "মোট আয়", expense: "মোট ব্যয়", profit: "নিট মুনাফা" },
    topExpense: "Top Expense Categories",
    loading: "লোড হচ্ছে...",
    error: "ডাটা লোড করা যায়নি।",
  },
  en: {
    title: "Profit Dashboard",
    subtitle: "Income vs expense analytics",
    range: "Range",
    day: "Today",
    week: "Week",
    month: "Month",
    cards: { income: "Total Income", expense: "Total Expense", profit: "Net Profit" },
    topExpense: "Top Expense Categories",
    loading: "Loading...",
    error: "Failed to load data.",
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [range, setRange] = useState<"today" | "week" | "month">("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResp>({
    income: 0,
    expense: 0,
    profit: 0,
    top_expense_categories: [],
  });

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
        const res = await fetch(`${API}/accounting/summary?range=${range}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data?.message ?? t.error);
          return;
        }

        setSummary({
          income: Number(data?.data?.income ?? 0),
          expense: Number(data?.data?.expense ?? 0),
          profit: Number(data?.data?.profit ?? 0),
          top_expense_categories: data?.data?.top_expense_categories ?? [],
        });
      } catch {
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [range, t.error]);

  const money = (n: number) => `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <UserShell
      activeKey="profit"
      defaultExpandedKey="accounting"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      <section className="mx-4 mb-4 flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--muted)]">{t.range}:</span>
        <button onClick={() => setRange("today")} className={`rounded-lg px-3 py-1 text-xs font-semibold ${range === "today" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)]"}`}>{t.day}</button>
        <button onClick={() => setRange("week")} className={`rounded-lg px-3 py-1 text-xs font-semibold ${range === "week" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)]"}`}>{t.week}</button>
        <button onClick={() => setRange("month")} className={`rounded-lg px-3 py-1 text-xs font-semibold ${range === "month" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)]"}`}>{t.month}</button>
      </section>

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

      <section className="catv-panel mx-4 mb-6 p-4">
        <h3 className="mb-3 text-sm font-semibold">{t.topExpense}</h3>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">{t.loading}</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : summary.top_expense_categories.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">-</p>
        ) : (
          <div className="space-y-2">
            {summary.top_expense_categories.map((r) => (
              <div key={r.category} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <span>{r.category}</span>
                <span className="font-semibold text-rose-600">৳{Number(r.total).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </UserShell>
  );
}
