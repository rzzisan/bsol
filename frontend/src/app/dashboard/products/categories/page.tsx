"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "পণ্য ক্যাটাগরি",
    addCategory: "নতুন ক্যাটাগরি",
    noCategories: "কোনো ক্যাটাগরি নেই।",
    loading: "লোড হচ্ছে...",
    name: "নাম",
    slug: "স্লাগ",
    products: "পণ্য",
    actions: "অ্যাকশন",
    edit: "সম্পাদনা",
    delete: "মুছুন",
    confirmDelete: "এই ক্যাটাগরি মুছে ফেলবেন? পণ্যগুলো 'আন ক্যাটাগরাইজড' হবে।",
    modalAdd: "নতুন ক্যাটাগরি",
    modalEdit: "ক্যাটাগরি সম্পাদনা",
    fieldName: "নাম *",
    fieldDesc: "বিবরণ",
    fieldSortOrder: "সাজানোর ক্রম",
    save: "সংরক্ষণ",
    cancel: "বাতিল",
    saving: "সংরক্ষণ হচ্ছে...",
  },
  en: {
    pageTitle: "Product Categories",
    addCategory: "New Category",
    noCategories: "No categories yet.",
    loading: "Loading...",
    name: "Name",
    slug: "Slug",
    products: "Products",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    confirmDelete: "Delete this category? Products will become uncategorized.",
    modalAdd: "New Category",
    modalEdit: "Edit Category",
    fieldName: "Name *",
    fieldDesc: "Description",
    fieldSortOrder: "Sort Order",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
  },
};

type Category = { id: number; name: string; slug: string; description: string | null; sort_order: number; product_count: number };
type FormState = { name: string; description: string; sort_order: number };

export default function CategoriesPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", description: "", sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const token = getStoredToken();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setCategories(d.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void fetchCategories(); }, [fetchCategories]);

  const openAdd = () => {
    setForm({ name: "", description: "", sort_order: 0 });
    setFormError("");
    setEditId(null);
    setModal("add");
  };
  const openEdit = (c: Category) => {
    setForm({ name: c.name, description: c.description ?? "", sort_order: c.sort_order });
    setFormError("");
    setEditId(c.id);
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setEditId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError(locale === "bn" ? "নাম আবশ্যক।" : "Name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const url    = modal === "edit" ? `${API}/categories/${editId}` : `${API}/categories`;
      const method = modal === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message ?? Object.values(data.errors ?? {})[0];
        setFormError(Array.isArray(msg) ? msg[0] : String(msg));
        return;
      }
      closeModal();
      void fetchCategories();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(txt.confirmDelete)) return;
    await fetch(`${API}/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    void fetchCategories();
  };

  return (
    <UserShell activeKey="product-categories" defaultExpandedKey="products"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      <div className="flex justify-end mb-4">
        <button onClick={openAdd}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + {txt.addCategory}
        </button>
      </div>

      <div className="catv-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.name}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.slug}</th>
              <th className="px-4 py-3 text-center">{txt.products}</th>
              <th className="px-4 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noCategories}</td></tr>
            ) : categories.map(c => (
              <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)] transition-colors">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 hidden md:table-cell text-[var(--muted)] text-xs font-mono">{c.slug}</td>
                <td className="px-4 py-3 text-center">{c.product_count}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(c)}
                    className="mr-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                    {txt.edit}
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
                    {txt.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-4 text-base font-bold">{modal === "add" ? txt.modalAdd : txt.modalEdit}</h3>
            {formError && <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</div>}
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldName}</span>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldDesc}</span>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldSortOrder}</span>
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeModal} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">{txt.cancel}</button>
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? txt.saving : txt.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
