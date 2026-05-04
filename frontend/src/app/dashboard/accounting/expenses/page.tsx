"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

interface Txn {
  id: number;
  type: "income" | "expense";
  category: string;
  amount: string;
  note: string | null;
  transaction_date: string;
  is_auto: boolean;
}

const text = {
  bn: {
    title: "খরচ ট্র্যাকার",
    subtitle: "ম্যানুয়াল খরচ যোগ করুন এবং সব expense ট্র্যাক করুন",
    fields: { category: "ক্যাটাগরি", amount: "পরিমাণ", date: "তারিখ", note: "নোট" },
    actions: { add: "খরচ যোগ করুন", delete: "ডিলিট", loading: "লোড হচ্ছে..." },
    empty: "কোনো expense পাওয়া যায়নি।",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    categories: ["ad_spend", "courier", "salary", "rent", "tools", "other"],
  },
  en: {
    title: "Expense Tracker",
    subtitle: "Add manual expenses and track all expense entries",
    fields: { category: "Category", amount: "Amount", date: "Date", note: "Note" },
    actions: { add: "Add Expense", delete: "Delete", loading: "Loading..." },
    empty: "No expense found.",
    error: "Request failed.",
    categories: ["ad_spend", "courier", "salary", "rent", "tools", "other"],
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [rows, setRows] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: text.en.categories[0],
    amount: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const loadExpenses = async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/accounting/transactions?type=expense&per_page=50`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setRows((data?.data ?? []) as Txn[]);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addExpense = async (e: FormEvent) => {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/accounting/transactions`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "expense",
          category: form.category,
          amount: Number(form.amount),
          transaction_date: form.transaction_date,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setForm((p) => ({ ...p, amount: "", note: "" }));
      await loadExpenses();
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const res = await fetch(`${API}/accounting/transactions/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      await loadExpenses();
    } catch {
      setError(t.error);
    }
  };

  return (
    <UserShell
      activeKey="expenses"
      defaultExpandedKey="accounting"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      <section className="catv-panel mx-4 mb-4 p-4">
        <form onSubmit={addExpense} className="grid gap-3 md:grid-cols-4">
          <select
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          >
            {t.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            required
            type="number"
            min={1}
            placeholder={t.fields.amount}
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.transaction_date}
            onChange={(e) => setForm((p) => ({ ...p, transaction_date: e.target.value }))}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          />
          <input
            placeholder={t.fields.note}
            value={form.note}
            onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="md:col-span-4 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {saving ? t.actions.loading : t.actions.add}
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="catv-panel mx-4 mb-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">{t.fields.date}</th>
                <th className="px-3 py-2">{t.fields.category}</th>
                <th className="px-3 py-2">{t.fields.amount}</th>
                <th className="px-3 py-2">{t.fields.note}</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">{t.actions.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">{t.empty}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{r.transaction_date}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2 text-rose-600">৳{Number(r.amount).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.note ?? "-"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={r.is_auto}
                      onClick={() => void remove(r.id)}
                      className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-40"
                    >
                      {t.actions.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </UserShell>
  );
}
