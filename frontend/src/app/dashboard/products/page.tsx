"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "পণ্য তালিকা",
    addProduct: "নতুন পণ্য",
    search: "পণ্যের নাম / SKU দিয়ে খুঁজুন",
    all: "সব",
    active: "সক্রিয়",
    inactive: "নিষ্ক্রিয়",
    archived: "আর্কাইভড",
    lowStock: "কম স্টক",
    noProducts: "কোনো পণ্য পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    name: "পণ্যের নাম",
    category: "ক্যাটাগরি",
    price: "মূল্য",
    stock: "স্টক",
    status: "স্ট্যাটাস",
    actions: "অ্যাকশন",
    edit: "সম্পাদনা",
    delete: "মুছুন",
    confirmDelete: "এই পণ্যটি মুছে ফেলবেন?",
    deleted: "পণ্য মুছে ফেলা হয়েছে।",
    uncategorized: "ক্যাটাগরি নেই",
    totalProducts: "মোট পণ্য",
    activeProducts: "সক্রিয়",
    lowStockAlert: "কম স্টক",
    statsLoading: "...",
    // modal
    modalAddTitle: "নতুন পণ্য যোগ করুন",
    modalEditTitle: "পণ্য সম্পাদনা করুন",
    fieldName: "পণ্যের নাম *",
    fieldCategory: "ক্যাটাগরি",
    fieldSku: "SKU",
    fieldSellingPrice: "বিক্রয় মূল্য (৳) *",
    fieldCostPrice: "ক্রয় মূল্য (৳)",
    fieldStock: "স্টক",
    fieldUnit: "ইউনিট",
    fieldTrackStock: "স্টক ট্র্যাক করুন",
    fieldStatus: "স্ট্যাটাস",
    fieldDescription: "বিবরণ",
    save: "সংরক্ষণ",
    cancel: "বাতিল",
    saving: "সংরক্ষণ হচ্ছে...",
    noCategoryOption: "— ক্যাটাগরি নেই —",
  },
  en: {
    pageTitle: "Product List",
    addProduct: "New Product",
    search: "Search by name / SKU",
    all: "All",
    active: "Active",
    inactive: "Inactive",
    archived: "Archived",
    lowStock: "Low Stock",
    noProducts: "No products found.",
    loading: "Loading...",
    name: "Product Name",
    category: "Category",
    price: "Price",
    stock: "Stock",
    status: "Status",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    confirmDelete: "Delete this product?",
    deleted: "Product deleted.",
    uncategorized: "Uncategorized",
    totalProducts: "Total Products",
    activeProducts: "Active",
    lowStockAlert: "Low Stock",
    statsLoading: "...",
    modalAddTitle: "Add New Product",
    modalEditTitle: "Edit Product",
    fieldName: "Product Name *",
    fieldCategory: "Category",
    fieldSku: "SKU",
    fieldSellingPrice: "Selling Price (৳) *",
    fieldCostPrice: "Cost Price (৳)",
    fieldStock: "Stock",
    fieldUnit: "Unit",
    fieldTrackStock: "Track Stock",
    fieldStatus: "Status",
    fieldDescription: "Description",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
    noCategoryOption: "— No Category —",
  },
};

type Category = { id: number; name: string };
type Product = {
  id: number; name: string; sku: string | null; selling_price: string;
  cost_price: string; stock: number; track_stock: boolean;
  unit: string; status: string; description: string | null;
  category_id: number | null; category: { id: number; name: string } | null;
  low_stock_alert: number;
};
type Stats = { total: number; active: number; lowStock: number };
type FormState = Partial<Omit<Product, "id" | "category">>;

const statusBadge: Record<string, string> = {
  active:   "bg-emerald-500/15 text-emerald-400",
  inactive: "bg-yellow-500/15 text-yellow-400",
  archived: "bg-[var(--muted)]/20 text-[var(--muted)]",
};

export default function ProductsPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, lowStock: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // modal
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const token = getStoredToken();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search) params.set("search", search);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterLowStock) params.set("low_stock", "1");

      const [prodRes, catRes, statRes] = await Promise.all([
        fetch(`${API}/products?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/products/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (prodRes.ok) {
        const d = await prodRes.json();
        setProducts(d.data ?? []);
        setTotal(d.meta?.total ?? 0);
        setLastPage(d.meta?.last_page ?? 1);
      }
      if (catRes.ok) {
        const d = await catRes.json();
        setCategories(d.data ?? []);
      }
      if (statRes.ok) {
        const d = await statRes.json();
        setStats({ total: d.data?.total ?? 0, active: d.data?.active ?? 0, lowStock: d.data?.lowStock ?? 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterLowStock, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // debounce search
  useEffect(() => { setPage(1); }, [search, filterStatus, filterLowStock]);

  const openAdd = () => {
    setForm({ status: "active", unit: "pcs", track_stock: false });
    setFormError("");
    setEditProduct(null);
    setModal("add");
  };
  const openEdit = (p: Product) => {
    setForm({ ...p });
    setFormError("");
    setEditProduct(p);
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setEditProduct(null); };

  const handleSave = async () => {
    if (!form.name || !form.selling_price) {
      setFormError(locale === "bn" ? "নাম এবং বিক্রয় মূল্য আবশ্যক।" : "Name and selling price are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const url    = modal === "edit" ? `${API}/products/${editProduct!.id}` : `${API}/products`;
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
      void fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(txt.confirmDelete)) return;
    await fetch(`${API}/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    void fetchData();
  };

  const setField = (key: keyof FormState, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  return (
    <UserShell activeKey="product-list" defaultExpandedKey="products"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {/* Stat bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: txt.totalProducts, value: stats.total, color: "bg-[#0f7c7b]" },
          { label: txt.activeProducts, value: stats.active, color: "bg-[#2f7ec1]" },
          { label: txt.lowStockAlert,  value: stats.lowStock, color: "bg-[#c0392b]" },
        ].map(c => (
          <article key={c.label} className={`${c.color} rounded-2xl p-4 text-white`}>
            <p className="text-xs text-white/80">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{loading ? txt.statsLoading : c.value}</p>
          </article>
        ))}
      </div>

      {/* Toolbar */}
      <div className="catv-panel mt-4 flex flex-wrap items-center gap-3 p-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={txt.search}
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="all">{txt.all}</option>
          <option value="active">{txt.active}</option>
          <option value="inactive">{txt.inactive}</option>
          <option value="archived">{txt.archived}</option>
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={filterLowStock} onChange={e => setFilterLowStock(e.target.checked)}
            className="accent-[var(--accent)]" />
          {txt.lowStock}
        </label>
        <button onClick={openAdd}
          className="ml-auto rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + {txt.addProduct}
        </button>
      </div>

      {/* Table */}
      <div className="catv-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
              <th className="px-4 py-3">{txt.name}</th>
              <th className="px-4 py-3 hidden md:table-cell">{txt.category}</th>
              <th className="px-4 py-3 text-right">{txt.price}</th>
              <th className="px-4 py-3 text-right">{txt.stock}</th>
              <th className="px-4 py-3">{txt.status}</th>
              <th className="px-4 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">{txt.noProducts}</td></tr>
            ) : products.map(p => (
              <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium">{p.name}</p>
                  {p.sku && <p className="text-xs text-[var(--muted)]">SKU: {p.sku}</p>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-[var(--muted)]">
                  {p.category?.name ?? txt.uncategorized}
                </td>
                <td className="px-4 py-3 text-right font-semibold">৳{Number(p.selling_price).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  {p.track_stock ? (
                    <span className={p.stock <= p.low_stock_alert ? "text-red-400 font-bold" : ""}>
                      {p.stock} {p.unit}
                    </span>
                  ) : <span className="text-[var(--muted)]">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[p.status] ?? ""}`}>
                    {locale === "bn"
                      ? p.status === "active" ? "সক্রিয়" : p.status === "inactive" ? "নিষ্ক্রিয়" : "আর্কাইভড"
                      : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(p)}
                    className="mr-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]">
                    {txt.edit}
                  </button>
                  <button onClick={() => handleDelete(p.id)}
                    className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
                    {txt.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">{total} {locale === "bn" ? "টি পণ্য" : "products"}</p>
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

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-4 text-base font-bold">
              {modal === "add" ? txt.modalAddTitle : txt.modalEditTitle}
            </h3>
            {formError && (
              <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldName}</span>
                <input value={form.name ?? ""} onChange={e => setField("name", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldCategory}</span>
                <select value={form.category_id ?? ""} onChange={e => setField("category_id", e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="">{txt.noCategoryOption}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldSku}</span>
                <input value={form.sku ?? ""} onChange={e => setField("sku", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldSellingPrice}</span>
                <input type="number" min="0" value={form.selling_price ?? ""} onChange={e => setField("selling_price", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldCostPrice}</span>
                <input type="number" min="0" value={form.cost_price ?? ""} onChange={e => setField("cost_price", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldStock}</span>
                <input type="number" min="0" value={form.stock ?? 0} onChange={e => setField("stock", Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldUnit}</span>
                <select value={form.unit ?? "pcs"} onChange={e => setField("unit", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="pcs">pcs</option>
                  <option value="kg">kg</option>
                  <option value="liter">liter</option>
                  <option value="box">box</option>
                  <option value="set">set</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldStatus}</span>
                <select value={form.status ?? "active"} onChange={e => setField("status", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option value="active">{txt.active}</option>
                  <option value="inactive">{txt.inactive}</option>
                  <option value="archived">{txt.archived}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 sm:col-span-2 cursor-pointer">
                <input type="checkbox" checked={!!form.track_stock} onChange={e => setField("track_stock", e.target.checked)}
                  className="accent-[var(--accent)] w-4 h-4" />
                <span className="text-sm">{txt.fieldTrackStock}</span>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldDescription}</span>
                <textarea rows={2} value={form.description ?? ""} onChange={e => setField("description", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeModal}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-soft)]">
                {txt.cancel}
              </button>
              <button onClick={handleSave} disabled={saving}
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
