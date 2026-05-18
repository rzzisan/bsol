"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken, type Locale } from "@/lib/dashboard-client";
import {
  LANDING_API_BASE,
  type LandingPageProductInput,
  type LandingPageRecord,
  type LandingTemplate,
  type ProductItem,
  getLandingTemplateName,
  toNumberOrNull,
} from "@/lib/landing-pages";

type LandingPageFormProps = {
  locale: Locale;
  mode: "create" | "edit";
  pageId?: string;
  initialPage?: LandingPageRecord | null;
};

type ProductDraft = {
  product_id: number;
  title_override: string;
  subtitle: string;
  badge_text: string;
  price_override: string;
  default_qty: number;
  selected_by_default: boolean;
  sort_order: number;
};

const text = {
  bn: {
    title: "পেজ শিরোনাম",
    slug: "স্লাগ (ঐচ্ছিক)",
    template: "টেমপ্লেট",
    templateHint: "ডিফল্ট template content apply করতে একটি টেমপ্লেট বেছে নিন।",
    products: "পণ্য সংযুক্ত করুন",
    productsHint: "যে পণ্যগুলো checkout section-এ দেখাতে চান সেগুলো attach করুন।",
    searchProducts: "পণ্য খুঁজুন...",
    noProducts: "কোনো পণ্য পাওয়া যায়নি।",
    selectedProducts: "সংযুক্ত পণ্য",
    save: "সংরক্ষণ করুন",
    creating: "তৈরি হচ্ছে...",
    saving: "সংরক্ষণ হচ্ছে...",
    createSuccess: "ল্যান্ডিং পেজ তৈরি হয়েছে।",
    updateSuccess: "ল্যান্ডিং পেজ আপডেট হয়েছে।",
    loadFailed: "ডেটা লোড করা যায়নি।",
    submitFailed: "সংরক্ষণ করা যায়নি।",
    chooseTemplate: "টেমপ্লেট নির্বাচন করুন",
    noTemplate: "কাস্টম / টেমপ্লেট ছাড়া",
    attach: "যুক্ত করুন",
    remove: "সরান",
    defaultQty: "ডিফল্ট Qty",
    badge: "ব্যাজ",
    overrideTitle: "টাইটেল ওভাররাইড",
    overrideSubtitle: "সাবটাইটেল",
    overridePrice: "দাম ওভাররাইড",
    selectedByDefault: "ডিফল্ট সিলেক্টেড",
    productEmpty: "এখনও কোনো পণ্য attach করা হয়নি।",
  },
  en: {
    title: "Page title",
    slug: "Slug (optional)",
    template: "Template",
    templateHint: "Pick a template to apply default content.",
    products: "Attach products",
    productsHint: "Attach products you want to show in checkout/product sections.",
    searchProducts: "Search products...",
    noProducts: "No products found.",
    selectedProducts: "Attached products",
    save: "Save",
    creating: "Creating...",
    saving: "Saving...",
    createSuccess: "Landing page created successfully.",
    updateSuccess: "Landing page updated successfully.",
    loadFailed: "Failed to load data.",
    submitFailed: "Failed to save landing page.",
    chooseTemplate: "Select a template",
    noTemplate: "Custom / no template",
    attach: "Attach",
    remove: "Remove",
    defaultQty: "Default Qty",
    badge: "Badge",
    overrideTitle: "Title override",
    overrideSubtitle: "Subtitle",
    overridePrice: "Price override",
    selectedByDefault: "Selected by default",
    productEmpty: "No products attached yet.",
  },
};

function normalizeDraft(input: LandingPageProductInput & { product?: ProductItem | null }, index: number): ProductDraft {
  return {
    product_id: input.product_id,
    title_override: input.title_override ?? "",
    subtitle: input.subtitle ?? "",
    badge_text: input.badge_text ?? "",
    price_override: input.price_override == null ? "" : String(input.price_override),
    default_qty: input.default_qty ?? 1,
    selected_by_default: input.selected_by_default ?? true,
    sort_order: input.sort_order ?? index + 1,
  };
}

export default function LandingPageForm({ locale, mode, pageId, initialPage }: LandingPageFormProps) {
  const router = useRouter();
  const t = text[locale];
  const token = getStoredToken();

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [templates, setTemplates] = useState<LandingTemplate[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState(initialPage?.title ?? "");
  const [slug, setSlug] = useState(initialPage?.slug ?? "");
  const [templateId, setTemplateId] = useState<string>(initialPage?.template_id ? String(initialPage.template_id) : "");
  const [selectedProducts, setSelectedProducts] = useState<ProductDraft[]>(
    (initialPage?.products ?? []).map((item, index) => normalizeDraft(item, index)),
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError(t.loadFailed);
      return;
    }

    const loadBootstrap = async () => {
      try {
        setError(null);
        const [templatesRes, productsRes, pageRes] = await Promise.all([
          fetch(`${LANDING_API_BASE}/landing/templates`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/products?per_page=100`, { headers: { Authorization: `Bearer ${token}` } }),
          mode === "edit" && pageId
            ? fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve(null),
        ]);

        if (!templatesRes.ok || !productsRes.ok || (pageRes && !pageRes.ok)) {
          throw new Error(t.loadFailed);
        }

        const templatesJson = await templatesRes.json();
        const productsJson = await productsRes.json();
        setTemplates(templatesJson.data ?? []);
        setProducts((productsJson.data ?? []).filter((item: ProductItem) => item.status !== "archived"));

        if (pageRes) {
          const pageJson = await pageRes.json();
          const page = pageJson.data as LandingPageRecord;
          setTitle(page.title ?? "");
          setSlug(page.slug ?? "");
          setTemplateId(page.template_id ? String(page.template_id) : "");
          setSelectedProducts((page.products ?? []).map((item, index) => normalizeDraft(item, index)));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.loadFailed);
      } finally {
        setLoading(false);
      }
    };

    void loadBootstrap();
  }, [token, mode, pageId, t.loadFailed]);

  const filteredProducts = useMemo(() => {
    const attachedIds = new Set(selectedProducts.map((item) => item.product_id));
    const needle = query.trim().toLowerCase();
    return products.filter((item) => {
      if (attachedIds.has(item.id)) return false;
      if (!needle) return true;
      return [item.name, item.sku ?? ""].join(" ").toLowerCase().includes(needle);
    });
  }, [products, query, selectedProducts]);

  const selectedProductDetails = useMemo(() => {
    const map = new Map(products.map((item) => [item.id, item]));
    return selectedProducts.map((item, index) => ({
      ...item,
      sort_order: index + 1,
      product: map.get(item.product_id) ?? null,
    }));
  }, [products, selectedProducts]);

  const addProduct = (product: ProductItem) => {
    setSelectedProducts((prev) => [
      ...prev,
      {
        product_id: product.id,
        title_override: "",
        subtitle: "",
        badge_text: "",
        price_override: "",
        default_qty: 1,
        selected_by_default: true,
        sort_order: prev.length + 1,
      },
    ]);
  };

  const removeProduct = (productId: number) => {
    setSelectedProducts((prev) => prev.filter((item) => item.product_id !== productId).map((item, index) => ({ ...item, sort_order: index + 1 })));
  };

  const patchProduct = (productId: number, changes: Partial<ProductDraft>) => {
    setSelectedProducts((prev) => prev.map((item) => item.product_id === productId ? { ...item, ...changes } : item));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError(t.submitFailed);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title,
        slug: slug.trim() || undefined,
        template_id: templateId ? Number(templateId) : null,
        products: selectedProducts.map((item, index) => ({
          product_id: item.product_id,
          title_override: item.title_override || null,
          subtitle: item.subtitle || null,
          badge_text: item.badge_text || null,
          price_override: toNumberOrNull(item.price_override),
          default_qty: item.default_qty,
          selected_by_default: item.selected_by_default,
          sort_order: index + 1,
        })),
      };

      const url = mode === "edit" && pageId
        ? `${LANDING_API_BASE}/landing/pages/${pageId}`
        : `${LANDING_API_BASE}/landing/pages`;

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || Object.values(json.errors ?? {}).flat().join(" ") || t.submitFailed);
      }

      const nextId = json.data?.id ?? pageId;
      setSuccess(mode === "edit" ? t.updateSuccess : t.createSuccess);
      if (nextId) {
        setTimeout(() => router.push(`/dashboard/landing-pages/${nextId}`), 600);
      } else {
        setTimeout(() => router.push("/dashboard/landing-pages"), 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.submitFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl catv-panel p-4 sm:p-5">
      {loading ? (
        <div className="text-sm text-[var(--muted)]">{locale === "bn" ? "ডেটা লোড হচ্ছে..." : "Loading data..."}</div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.title}</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.slug}</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">{t.template}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{t.templateHint}</p>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)]"
              >
                <option value="">{t.noTemplate}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {getLandingTemplateName(template, locale)}
                  </option>
                ))}
              </select>
              {templateId && templates.find((item) => String(item.id) === templateId)?.description ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {templates.find((item) => String(item.id) === templateId)?.description}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--foreground)]">{t.selectedProducts}</h3>
                  <p className="text-sm text-[var(--muted)]">{t.productsHint}</p>
                </div>
              </div>

              {selectedProductDetails.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{t.productEmpty}</div>
              ) : (
                <div className="mt-3 space-y-4">
                  {selectedProductDetails.map((item, index) => (
                    <div key={item.product_id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--foreground)]">{item.product?.name ?? `#${item.product_id}`}</h4>
                          <p className="text-xs text-[var(--muted)]">SKU: {item.product?.sku || "—"} · ৳{Number(item.product?.selling_price ?? item.product?.regular_price ?? 0).toLocaleString()}</p>
                        </div>
                        <button type="button" onClick={() => removeProduct(item.product_id)} className="rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-400">
                          {t.remove}
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input value={item.title_override} onChange={(e) => patchProduct(item.product_id, { title_override: e.target.value })} placeholder={t.overrideTitle} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <input value={item.subtitle} onChange={(e) => patchProduct(item.product_id, { subtitle: e.target.value })} placeholder={t.overrideSubtitle} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <input value={item.badge_text} onChange={(e) => patchProduct(item.product_id, { badge_text: e.target.value })} placeholder={t.badge} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <input value={item.price_override} onChange={(e) => patchProduct(item.product_id, { price_override: e.target.value })} placeholder={t.overridePrice} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                          <span>{t.defaultQty}</span>
                          <input type="number" min={1} max={100} value={item.default_qty} onChange={(e) => patchProduct(item.product_id, { default_qty: Math.max(1, Number(e.target.value) || 1) })} className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm" />
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                          <input type="checkbox" checked={item.selected_by_default} onChange={(e) => patchProduct(item.product_id, { selected_by_default: e.target.checked })} className="accent-[var(--accent)]" />
                          <span>{t.selectedByDefault}</span>
                        </label>
                      </div>
                      <div className="mt-2 text-xs text-[var(--muted)]">#{index + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(error || success) && (
              <div className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                {error || success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? (mode === "edit" ? t.saving : t.creating) : t.save}
            </button>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <h3 className="text-base font-semibold text-[var(--foreground)]">{t.products}</h3>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchProducts}
              className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
            <div className="mt-3 space-y-3">
              {filteredProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{t.noProducts}</div>
              ) : (
                filteredProducts.slice(0, 20).map((product) => (
                  <div key={product.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">{product.name}</h4>
                      <p className="mt-1 text-xs text-[var(--muted)]">SKU: {product.sku || "—"}</p>
                      <p className="text-xs text-[var(--muted)]">৳{Number(product.selling_price ?? product.regular_price ?? 0).toLocaleString()} · Stock {product.stock ?? 0}</p>
                    </div>
                    <button type="button" onClick={() => addProduct(product)} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">
                      {t.attach}
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        </form>
      )}
    </section>
  );
}
