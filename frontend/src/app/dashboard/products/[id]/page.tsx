"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import MediaPolicyHint from "@/components/products/media-policy-hint";
import ProductGalleryManager from "@/components/products/product-gallery-manager";
import ProductMediaUploader from "@/components/products/product-media-uploader";
import VariantsTab from "@/components/products/variants-tab";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { computeSellingPrice } from "@/lib/pricing";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    loading: "লোড হচ্ছে...",
    notFound: "পণ্যটি পাওয়া যায়নি।",
    back: "← পণ্য তালিকা",
    details: "পণ্যের বিস্তারিত",
    mediaTitle: "ইমেজ ম্যানেজমেন্ট",
    editTitle: "পণ্য সম্পাদনা",
    save: "সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    saved: "আপডেট সফল হয়েছে।",
    fieldName: "পণ্যের নাম *",
    fieldCategory: "ক্যাটাগরি",
    fieldSku: "SKU *",
    fieldRegularPrice: "রেগুলার দাম (৳)",
    fieldDiscount: "ডিসকাউন্ট (৳)",
    fieldDiscountType: "ডিসকাউন্ট ধরন",
    discountAmount: "টাকা (৳)",
    discountPercent: "পার্সেন্ট (%)",
    autoSellingPrice: "অটো সেলিং প্রাইস",
    fieldSellingPrice: "বিক্রয় মূল্য (৳) *",
    fieldCostPrice: "ক্রয় মূল্য (৳)",
    fieldStock: "স্টক",
    fieldLowStock: "লো স্টক অ্যালার্ট",
    fieldUnit: "ইউনিট",
    fieldStatus: "স্ট্যাটাস",
    fieldTrackStock: "স্টক ট্র্যাক করুন",
    fieldDescription: "বিবরণ *",
    statusActive: "সক্রিয়",
    statusInactive: "নিষ্ক্রিয়",
    statusArchived: "আর্কাইভড",
    preview: "প্রিভিউ",
    summary: "সারাংশ",
    noCategory: "ক্যাটাগরি নেই",
    createdAt: "তৈরি হয়েছে",
    updatedAt: "সর্বশেষ আপডেট",
    totalImages: "মোট ইমেজ",
    thumbnail: "থাম্বনেইল",
    noThumbnail: "থাম্বনেইল নেই",
    noCategoryOption: "— ক্যাটাগরি নেই —",
  },
  en: {
    loading: "Loading...",
    notFound: "Product not found.",
    back: "← Product List",
    details: "Product Details",
    mediaTitle: "Image Management",
    editTitle: "Edit Product",
    save: "Save Changes",
    saving: "Saving...",
    saved: "Updated successfully.",
    fieldName: "Product Name *",
    fieldCategory: "Category",
    fieldSku: "SKU *",
    fieldRegularPrice: "Regular Price (৳)",
    fieldDiscount: "Discount (৳)",
    fieldDiscountType: "Discount Type",
    discountAmount: "Amount (৳)",
    discountPercent: "Percent (%)",
    autoSellingPrice: "Auto Selling Price",
    fieldSellingPrice: "Selling Price (৳) *",
    fieldCostPrice: "Cost Price (৳)",
    fieldStock: "Stock",
    fieldLowStock: "Low Stock Alert",
    fieldUnit: "Unit",
    fieldStatus: "Status",
    fieldTrackStock: "Track Stock",
    fieldDescription: "Description *",
    statusActive: "Active",
    statusInactive: "Inactive",
    statusArchived: "Archived",
    preview: "Preview",
    summary: "Summary",
    noCategory: "Uncategorized",
    createdAt: "Created",
    updatedAt: "Updated",
    totalImages: "Total Images",
    thumbnail: "Thumbnail",
    noThumbnail: "No thumbnail",
    noCategoryOption: "— No Category —",
  },
};

type Category = { id: number; name: string };
type Product = {
  id: number;
  name: string;
  sku: string;
  description: string;
  regular_price: string | null;
  discount: string | null;
  discount_type: "amount" | "percent";
  selling_price: string;
  cost_price: string;
  stock: number;
  low_stock_alert: number;
  track_stock: boolean;
  unit: string;
  status: "active" | "inactive" | "archived";
  category_id: number | null;
  category: { id: number; name: string } | null;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
};

type MediaItem = {
  id: number;
  url: string;
  is_primary: boolean;
  sort_order: number;
  file_name?: string | null;
};

type MediaPolicy = {
  max_gallery_images: number;
  max_file_size_mb: number;
  allowed_mime_types: string[];
  thumbnail_required?: boolean;
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken() ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [mediaPolicy, setMediaPolicy] = useState<MediaPolicy | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  const loadMedia = useCallback(async () => {
    const mediaRes = await fetch(`${API}/products/${id}/media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const mediaData = await mediaRes.json();
    if (mediaRes.ok) {
      setMediaItems(mediaData?.data ?? []);
    }
  }, [id, token]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productRes, categoryRes, policyRes] = await Promise.all([
        fetch(`${API}/products/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/products/media-policy`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!productRes.ok) {
        setProduct(null);
        return;
      }

      const productData = await productRes.json();
      const item = productData?.data as Product;
      setProduct(item);
      setForm(item);

      if (categoryRes.ok) {
        const categoryData = await categoryRes.json();
        setCategories(categoryData?.data ?? []);
      }

      if (policyRes.ok) {
        const policyData = await policyRes.json();
        setMediaPolicy(policyData?.data ?? null);
      }

      await loadMedia();
    } catch {
      setError(locale === "bn" ? "ডেটা লোড করা যায়নি।" : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [id, token, loadMedia, locale]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const setField = (key: keyof Product, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const regularPrice = Number(form.regular_price ?? form.selling_price ?? 0);
    const discountValue = Number(form.discount ?? 0);
    const discountType = (form.discount_type ?? "amount") as "amount" | "percent";
    const computedSelling = computeSellingPrice(regularPrice, discountValue, discountType);

    if (!form.name || !form.sku || !form.description || regularPrice <= 0) {
      setError(locale === "bn"
        ? "নাম, SKU, বিবরণ এবং রেগুলার মূল্য আবশ্যক।"
        : "Name, SKU, description and regular price are required.");
      return;
    }
    if (discountType === "percent" && discountValue > 100) {
      setError(locale === "bn" ? "পার্সেন্ট ডিসকাউন্ট ১০০% এর বেশি হতে পারবে না।" : "Percentage discount cannot exceed 100.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API}/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          category_id: form.category_id ?? null,
          sku: form.sku,
          description: form.description,
          regular_price: regularPrice,
          discount: discountValue,
          discount_type: discountType,
          selling_price: computedSelling,
          cost_price: Number(form.cost_price ?? 0),
          stock: Number(form.stock ?? 0),
          low_stock_alert: Number(form.low_stock_alert ?? 5),
          track_stock: !!form.track_stock,
          unit: form.unit ?? "pcs",
          status: form.status ?? "active",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message ?? Object.values(data?.errors ?? {})[0];
        setError(Array.isArray(msg) ? String(msg[0]) : String(msg ?? "Update failed"));
        return;
      }

      setProduct(data.data as Product);
      setForm(data.data as Product);
      setSuccess(txt.saved);
    } catch {
      setError(locale === "bn" ? "আপডেট করা যায়নি।" : "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (value: string) => new Date(value).toLocaleString(locale === "bn" ? "bn-BD" : "en-US");

  if (loading) {
    return (
      <UserShell activeKey="product-list" defaultExpandedKey="products" pageTitle={{ bn: "পণ্য", en: "Products" }}>
        <p className="py-16 text-center text-[var(--muted)]">{txt.loading}</p>
      </UserShell>
    );
  }

  if (!product) {
    return (
      <UserShell activeKey="product-list" defaultExpandedKey="products" pageTitle={{ bn: "পণ্য", en: "Products" }}>
        <p className="py-16 text-center text-[var(--muted)]">{txt.notFound}</p>
      </UserShell>
    );
  }

  return (
    <UserShell
      activeKey="product-list"
      defaultExpandedKey="products"
      pageTitle={{ bn: product.name, en: product.name }}
      pageSubtitle={{ bn: "ডিটেইল + এডিট + ইমেজ একসাথে", en: "Details + edit + media in one page" }}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <Link href="/dashboard/products" className="inline-block text-sm text-[var(--accent)] hover:underline">
          {txt.back}
        </Link>

        {error && <div className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}
        {success && <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{success}</div>}

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="catv-panel p-4 xl:col-span-1">
            <h3 className="mb-3 text-base font-bold">{txt.preview}</h3>
            {product.thumbnail ? (
              <img src={product.thumbnail} alt={product.name} className="h-52 w-full rounded-xl object-cover" />
            ) : (
              <div className="flex h-52 w-full items-center justify-center rounded-xl bg-[var(--surface-soft)] text-sm text-[var(--muted)]">
                {txt.noThumbnail}
              </div>
            )}

            <div className="mt-3 space-y-1 text-sm">
              <p className="font-semibold">{product.name}</p>
              <p className="text-xs text-[var(--muted)]">SKU: {product.sku}</p>
              <p className="text-xs text-[var(--muted)]">
                {product.category?.name ?? txt.noCategory}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="rounded-lg bg-[var(--surface-soft)] p-2">
                  <p className="text-[var(--muted)]">{txt.fieldRegularPrice}</p>
                  <p className="font-semibold">৳{Number(form.regular_price ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-[var(--surface-soft)] p-2">
                  <p className="text-[var(--muted)]">{txt.fieldDiscount}</p>
                  <p className="font-semibold">{(form.discount_type ?? "amount") === "percent"
                    ? `${Number(form.discount ?? 0).toLocaleString()}%`
                    : `৳${Number(form.discount ?? 0).toLocaleString()}`}</p>
                 </div>
                 <div className="rounded-lg bg-[var(--surface-soft)] p-2 col-span-2">
                  <p className="text-[var(--muted)]">{txt.autoSellingPrice}</p>
                  <p className="text-base font-bold text-[var(--accent)]">৳{computeSellingPrice(
                    Number(form.regular_price ?? form.selling_price ?? 0),
                    Number(form.discount ?? 0),
                    (form.discount_type ?? "amount") as "amount" | "percent"
                  ).toLocaleString()}</p>
                 </div>
              </div>
            </div>
          </section>

          <section className="catv-panel p-4 xl:col-span-2">
            <h3 className="mb-3 text-base font-bold">{txt.summary}</h3>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-xl bg-[var(--surface-soft)] p-3">
                <p className="text-xs text-[var(--muted)]">{txt.createdAt}</p>
                <p>{fmtDate(product.created_at)}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-soft)] p-3">
                <p className="text-xs text-[var(--muted)]">{txt.updatedAt}</p>
                <p>{fmtDate(product.updated_at)}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-soft)] p-3">
                <p className="text-xs text-[var(--muted)]">{txt.totalImages}</p>
                <p>{mediaItems.length}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-soft)] p-3">
                <p className="text-xs text-[var(--muted)]">{txt.thumbnail}</p>
                <p>{mediaItems.some((m) => m.is_primary) ? "✓" : txt.noThumbnail}</p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">{form.description || "-"}</p>
          </section>
        </div>

        <section className="catv-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold">{txt.mediaTitle}</h3>
            <MediaPolicyHint policy={mediaPolicy} />
          </div>

          <div className="mb-4">
            <ProductMediaUploader
              productId={product.id}
              token={token}
              policy={mediaPolicy}
              onUploaded={async () => {
                await loadMedia();
                await fetchData();
              }}
            />
          </div>

          <ProductGalleryManager
            productId={product.id}
            token={token}
            items={mediaItems}
            onChanged={async () => {
              await loadMedia();
              await fetchData();
            }}
          />
        </section>

        <section className="catv-panel p-4">
          <h3 className="mb-3 text-base font-bold">{txt.editTitle}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldName}</span>
              <input
                value={form.name ?? ""}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldCategory}</span>
              <select
                value={form.category_id ?? ""}
                onChange={(e) => setField("category_id", e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="">{txt.noCategoryOption}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldSku}</span>
              <input
                value={form.sku ?? ""}
                onChange={(e) => setField("sku", e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldRegularPrice}</span>
              <input
                type="number"
                min="0"
                value={form.regular_price ?? ""}
                onChange={(e) => setField("regular_price", e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldDiscount}</span>
              <input
                type="number"
                min="0"
                value={form.discount ?? ""}
                onChange={(e) => setField("discount", e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldDiscountType}</span>
              <select
                value={form.discount_type ?? "amount"}
                onChange={(e) => setField("discount_type", e.target.value as "amount" | "percent")}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="amount">{txt.discountAmount}</option>
                <option value="percent">{txt.discountPercent}</option>
              </select>
            </label>
 
             <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldSellingPrice}</span>
              <input
                type="number"
                min="0"
                value={computeSellingPrice(
                  Number(form.regular_price ?? form.selling_price ?? 0),
                  Number(form.discount ?? 0),
                  (form.discount_type ?? "amount") as "amount" | "percent"
                )}
                className="w-full cursor-not-allowed rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
             </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldCostPrice}</span>
              <input
                type="number"
                min="0"
                value={form.cost_price ?? ""}
                onChange={(e) => setField("cost_price", e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldStock}</span>
              <input
                type="number"
                min="0"
                value={form.stock ?? 0}
                onChange={(e) => setField("stock", Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldLowStock}</span>
              <input
                type="number"
                min="0"
                value={form.low_stock_alert ?? 5}
                onChange={(e) => setField("low_stock_alert", Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldUnit}</span>
              <select
                value={form.unit ?? "pcs"}
                onChange={(e) => setField("unit", e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="liter">liter</option>
                <option value="box">box</option>
                <option value="set">set</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldStatus}</span>
              <select
                value={form.status ?? "active"}
                onChange={(e) => setField("status", e.target.value as Product["status"])}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="active">{txt.statusActive}</option>
                <option value="inactive">{txt.statusInactive}</option>
                <option value="archived">{txt.statusArchived}</option>
              </select>
            </label>

            <label className="sm:col-span-2 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.track_stock}
                onChange={(e) => setField("track_stock", e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="text-sm">{txt.fieldTrackStock}</span>
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.fieldDescription}</span>
              <textarea
                rows={4}
                value={form.description ?? ""}
                onChange={(e) => setField("description", e.target.value)}
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? txt.saving : txt.save}
            </button>
          </div>
        </section>

        {/* ── Variants Section ────────────────────────────────────── */}
        <section className="catv-panel p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">
                {locale === "bn" ? "ভেরিয়েন্ট ম্যানেজমেন্ট" : "Variant Management"}
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {locale === "bn"
                  ? "কালার, সাইজ বা যেকোনো অপশন যুক্ত করুন এবং ভেরিয়েন্ট তৈরি করুন।"
                  : "Add options like Color, Size, Material etc. and generate variants."}
              </p>
            </div>
          </div>
          <VariantsTab
            productId={product.id}
            productName={product.name}
            productThumbnail={product.thumbnail}
            defaultPrice={Number(product.regular_price ?? product.selling_price ?? 0)}
            token={token}
            apiBase={API}
          />
        </section>
      </div>
    </UserShell>
  );
}
