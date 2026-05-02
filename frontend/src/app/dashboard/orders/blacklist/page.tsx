"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "ব্ল্যাকলিস্ট",
    search: "ফোন নম্বর খুঁজুন",
    add: "যোগ করুন",
    loading: "লোড হচ্ছে...",
    noData: "ব্ল্যাকলিস্টে কোনো নম্বর নেই।",
    phone: "ফোন নম্বর",
    reason: "কারণ",
    date: "তারিখ",
    actions: "অ্যাকশন",
    remove: "সরান",
    removing: "সরানো হচ্ছে...",
    modalTitle: "ব্ল্যাকলিস্টে যোগ করুন",
    phonePlaceholder: "01XXXXXXXXX",
    reasonPlaceholder: "কারণ (ঐচ্ছিক)",
    save: "যোগ করুন",
    saving: "হচ্ছে...",
    cancel: "বাতিল",
    confirmRemove: "এই নম্বর ব্ল্যাকলিস্ট থেকে সরাবেন?",
  },
  en: {
    pageTitle: "Blacklist",
    search: "Search phone",
    add: "Add",
    loading: "Loading...",
    noData: "No numbers in blacklist.",
    phone: "Phone",
    reason: "Reason",
    date: "Date",
    actions: "Actions",
    remove: "Remove",
    removing: "Removing...",
    modalTitle: "Add to Blacklist",
    phonePlaceholder: "01XXXXXXXXX",
    reasonPlaceholder: "Reason (optional)",
    save: "Add",
    saving: "Adding...",
    cancel: "Cancel",
    confirmRemove: "Remove this number from blacklist?",
  },
};

type BLEntry = { id: number; phone: string; reason: string | null; blocked_at: string };

export default function BlacklistPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [items, setItems] = useState<BLEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ phone: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`${API}/fraud/blacklist?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setItems(d.data ?? []);
        setTotal(d.meta?.total ?? 0);
        setLastPage(d.meta?.last_page ?? 1);
      }
    } finally { setLoading(false); }
  }, [page, search, token]);

  useEffect(() => { void fetchList(); }, [fetchList]);
  useEffect(() => { setPage(1); }, [search]);

  const handleAdd = async () => {
    if (!addForm.phone.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/fraud/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: addForm.phone.trim(), reason: addForm.reason || null }),
      });
      if (res.ok) {
        setAddOpen(false);
        setAddForm({ phone: "", reason: "" });
        await fetchList();
      }
    } finally { setSaving(false); }
  };

  const handleRemove = async (id: number) => {
    if (!confirm(txt.confirmRemove)) return;
    setRemovingId(id);
    try {
      const res = await fetch(`${API}/fraud/blacklist/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) await fetchList();
    } finally { setRemovingId(null); }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB");

  return (
    <UserShell activeKey="blacklist" defaultExpandedKey="orders"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {/* Toolbar */}
      <div className="catv-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={txt.search}
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <p className="text-xs text-[var(--muted)]">{total} {locale === "bn" ? "টি নম্বর" : "numbers"}</p>
        <button onClick={() => setAddOpen(true)}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white">
          + {txt.add}
        </button>
      </div>

      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.phone}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.reason}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.date}</th>
              <th className="px-4 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-[var(--muted)]">{txt.noData}</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3 font-mono font-semibold text-red-400">{item.phone}</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted)]">{item.reason ?? "—"}</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted)]">{fmtDate(item.blocked_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => void handleRemove(item.id)} disabled={removingId === item.id}
                    className="rounded-xl border border-red-500/40 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                    {removingId === item.id ? txt.removing : txt.remove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
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

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-4 text-base font-bold">{txt.modalTitle}</h3>
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.phone}</span>
                <input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder={txt.phonePlaceholder}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.reason}</span>
                <input value={addForm.reason} onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder={txt.reasonPlaceholder}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setAddOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.cancel}</button>
              <button onClick={() => void handleAdd()} disabled={saving || !addForm.phone.trim()}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? txt.saving : txt.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
