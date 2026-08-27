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
    storefrontTitle: "স্টোরফ্রন্ট",
    storefrontHint: "সেলার শপে (স্টোরফ্রন্ট) এই প্রোডাক্ট কীভাবে দেখাবে সেট করুন।",
    showInStorefront: "স্টোরফ্রন্টে দেখাও",
    isFeatured: "হোমপেজে ফিচারড হিসেবে দেখাও",
    featuresTitle: "কী ফিচার্স (দামের নিচে দেখাবে)",
    addFeature: "+ যোগ করুন",
    specTitle: "স্পেসিফিকেশন (গ্রুপ করা টেবিল)",
    addGroup: "+ গ্রুপ যোগ করুন",
    addItem: "+ আইটেম যোগ করুন",
    groupName: "গ্রুপের নাম (যেমন: Display)",
    specLabel: "লেবেল",
    specValue: "মান",
    seoContent: "SEO কন্টেন্ট (ঐচ্ছিক)",
    seoContentHint: "প্রোডাক্ট পেজের নিচে দেখানো হবে, সার্চ ইঞ্জিনের জন্য সহায়ক।",
    warrantyOverride: "ওয়ারেন্টি (এই প্রোডাক্টের জন্য আলাদা, ঐচ্ছিক)",
    warrantyOverrideHint: "খালি রাখলে শপের ডিফল্ট ওয়ারেন্টি টেক্সট দেখাবে।",
    deliveryOverride: "ডেলিভারি তথ্য (এই প্রোডাক্টের জন্য আলাদা, ঐচ্ছিক)",
    deliveryOverrideHint: "খালি রাখলে শপের ডিফল্ট ডেলিভারি টেক্সট দেখাবে।",
    remove: "সরান",
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
    storefrontTitle: "Storefront",
    storefrontHint: "Control how this product appears on the storefront (seller shop).",
    showInStorefront: "Show in storefront",
    isFeatured: "Feature on homepage",
    featuresTitle: "Key Features (shown under the price)",
    addFeature: "+ Add",
    specTitle: "Specifications (grouped table)",
    addGroup: "+ Add group",
    addItem: "+ Add item",
    groupName: "Group name (e.g. Display)",
    specLabel: "Label",
    specValue: "Value",
    seoContent: "SEO content (optional)",
    seoContentHint: "Shown at the bottom of the product page, helps with search engines.",
    warrantyOverride: "Warranty (override for this product, optional)",
    warrantyOverrideHint: "Leave empty to use the shop's default warranty text.",
    deliveryOverride: "Delivery info (override for this product, optional)",
    deliveryOverrideHint: "Leave empty to use the shop's default delivery text.",
    remove: "Remove",
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
  // digital_product_context.md
  product_type?: "physical" | "digital";
  digital_delivery_type?: "hosted_file" | "external_url" | null;
  digital_file_name?: string | null;
  digital_file_size_bytes?: number | null;
  digital_external_url?: string | null;
  digital_delivery_channels?: string[] | null;
  digital_require_otp?: boolean;
  // seller_storefront_context.md §5.2/§12 (S2)
  show_in_storefront?: boolean;
  is_featured?: boolean;
  features?: string[] | null;
  specifications?: SpecGroup[] | null;
  seo_content?: string | null;
  warranty_override?: string | null;
  delivery_override?: string | null;
  slug?: string | null;
};

type SpecGroup = { group: string; items: Array<{ label: string; value: string }> };

type DigitalPolicy = {
  max_file_size_mb: number;
  allowed_extensions: string[];
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
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
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
  const [digitalPolicy, setDigitalPolicy] = useState<DigitalPolicy | null>(null);
  const [digitalUploading, setDigitalUploading] = useState(false);
  const [digitalError, setDigitalError] = useState("");

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
      const [productRes, categoryRes, policyRes, digitalPolicyRes] = await Promise.all([
        fetch(`${API}/products/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/products/media-policy`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/products/digital-policy`, { headers: { Authorization: `Bearer ${token}` } }),
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

      if (digitalPolicyRes.ok) {
        const digitalPolicyData = await digitalPolicyRes.json();
        setDigitalPolicy(digitalPolicyData?.data ?? null);
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
          product_type: form.product_type ?? "physical",
          digital_delivery_type: form.product_type === "digital" ? (form.digital_delivery_type ?? "hosted_file") : undefined,
          digital_external_url: form.product_type === "digital" ? (form.digital_external_url ?? null) : undefined,
          digital_delivery_channels: form.product_type === "digital" ? (form.digital_delivery_channels ?? []) : undefined,
          digital_require_otp: form.product_type === "digital" ? (form.digital_require_otp ?? true) : undefined,
          show_in_storefront: form.show_in_storefront ?? true,
          is_featured: form.is_featured ?? false,
          features: (form.features ?? []).filter((f) => f.trim() !== ""),
          specifications: (form.specifications ?? [])
            .map((g) => ({ group: g.group, items: g.items.filter((i) => i.label.trim() !== "" || i.value.trim() !== "") }))
            .filter((g) => g.group.trim() !== "" && g.items.length > 0),
          seo_content: form.seo_content ?? null,
          warranty_override: form.warranty_override ?? null,
          delivery_override: form.delivery_override ?? null,
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

  const toggleDeliveryChannel = (channel: "email" | "sms") => {
    setForm((prev) => {
      const current = prev.digital_delivery_channels ?? [];
      const next = current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel];
      return { ...prev, digital_delivery_channels: next };
    });
  };

  // ── Storefront: features (seller_storefront_context.md §5.2/§12, S2) ──
  const addFeature = () => setForm((prev) => ({ ...prev, features: [...(prev.features ?? []), ""] }));
  const updateFeature = (index: number, value: string) =>
    setForm((prev) => ({ ...prev, features: (prev.features ?? []).map((f, i) => (i === index ? value : f)) }));
  const removeFeature = (index: number) =>
    setForm((prev) => ({ ...prev, features: (prev.features ?? []).filter((_, i) => i !== index) }));

  // ── Storefront: grouped specifications ──
  const addSpecGroup = () =>
    setForm((prev) => ({ ...prev, specifications: [...(prev.specifications ?? []), { group: "", items: [] }] }));
  const updateSpecGroupName = (gi: number, name: string) =>
    setForm((prev) => ({
      ...prev,
      specifications: (prev.specifications ?? []).map((g, i) => (i === gi ? { ...g, group: name } : g)),
    }));
  const removeSpecGroup = (gi: number) =>
    setForm((prev) => ({ ...prev, specifications: (prev.specifications ?? []).filter((_, i) => i !== gi) }));
  const addSpecItem = (gi: number) =>
    setForm((prev) => ({
      ...prev,
      specifications: (prev.specifications ?? []).map((g, i) =>
        i === gi ? { ...g, items: [...g.items, { label: "", value: "" }] } : g,
      ),
    }));
  const updateSpecItem = (gi: number, ii: number, key: "label" | "value", value: string) =>
    setForm((prev) => ({
      ...prev,
      specifications: (prev.specifications ?? []).map((g, i) =>
        i === gi ? { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, [key]: value } : it)) } : g,
      ),
    }));
  const removeSpecItem = (gi: number, ii: number) =>
    setForm((prev) => ({
      ...prev,
      specifications: (prev.specifications ?? []).map((g, i) =>
        i === gi ? { ...g, items: g.items.filter((_, j) => j !== ii) } : g,
      ),
    }));

  const handleDigitalFileUpload = async (file: File) => {
    setDigitalUploading(true);
    setDigitalError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API}/products/${id}/digital-file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message ?? Object.values(data?.errors ?? {})[0];
        setDigitalError(Array.isArray(msg) ? String(msg[0]) : String(msg ?? "Upload failed"));
        return;
      }
      setProduct(data.data as Product);
      setForm((prev) => ({ ...prev, ...(data.data as Product) }));
    } catch {
      setDigitalError(locale === "bn" ? "আপলোড করা যায়নি।" : "Upload failed.");
    } finally {
      setDigitalUploading(false);
    }
  };

  const handleDigitalFileRemove = async () => {
    setDigitalUploading(true);
    setDigitalError("");
    try {
      await fetch(`${API}/products/${id}/digital-file`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setForm((prev) => ({ ...prev, digital_file_name: null, digital_file_size_bytes: null }));
    } finally {
      setDigitalUploading(false);
    }
  };

  const fmtDate = (value: string) => new Date(value).toLocaleString(locale === "bn" ? "bn-BD" : "en-US");

  if (loading) {
    return (
      <UserShell locale={locale} onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")} activeKey="product-list" defaultExpandedKey="products" pageTitle={{ bn: "পণ্য", en: "Products" }}>
        <p className="py-16 text-center text-[var(--muted)]">{txt.loading}</p>
      </UserShell>
    );
  }

  if (!product) {
    return (
      <UserShell locale={locale} onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")} activeKey="product-list" defaultExpandedKey="products" pageTitle={{ bn: "পণ্য", en: "Products" }}>
        <p className="py-16 text-center text-[var(--muted)]">{txt.notFound}</p>
      </UserShell>
    );
  }

  return (
    <UserShell locale={locale} onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
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

            <div className="sm:col-span-2 flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="product_type" checked={(form.product_type ?? "physical") === "physical"}
                  onChange={() => setField("product_type", "physical")} className="accent-[var(--accent)]" />
                {locale === "bn" ? "ফিজিকাল প্রোডাক্ট" : "Physical product"}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="product_type" checked={form.product_type === "digital"}
                  onChange={() => setField("product_type", "digital")} className="accent-[var(--accent)]" />
                {locale === "bn" ? "ডিজিটাল প্রোডাক্ট" : "Digital product"}
              </label>
            </div>

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

        {/* ── Digital Delivery Section ────────────────────────────── */}
        {form.product_type === "digital" ? (
          <section className="catv-panel p-4">
            <h3 className="text-base font-bold">
              {locale === "bn" ? "ডিজিটাল ডেলিভারি" : "Digital Delivery"}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {locale === "bn"
                ? "কীভাবে ফাইল ডেলিভার হবে এবং কোন কোন মাধ্যমে কাস্টমারকে জানানো হবে সেট করুন।"
                : "Choose how the file is delivered and which channels notify the customer."}
            </p>

            <div className="mt-4 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="digital_delivery_type"
                  checked={(form.digital_delivery_type ?? "hosted_file") === "hosted_file"}
                  onChange={() => setField("digital_delivery_type", "hosted_file")}
                  className="accent-[var(--accent)]"
                />
                {locale === "bn" ? "হোস্টেড ফাইল (আমাদের সার্ভারে আপলোড)" : "Hosted file (upload to our server)"}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="digital_delivery_type"
                  checked={form.digital_delivery_type === "external_url"}
                  onChange={() => setField("digital_delivery_type", "external_url")}
                  className="accent-[var(--accent)]"
                />
                {locale === "bn" ? "এক্সটার্নাল লিংক" : "External URL"}
              </label>
            </div>

            {(form.digital_delivery_type ?? "hosted_file") === "hosted_file" ? (
              <div className="mt-4">
                {form.digital_file_name ? (
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                    <span>
                      {form.digital_file_name}
                      {form.digital_file_size_bytes ? ` (${(form.digital_file_size_bytes / 1024 / 1024).toFixed(1)} MB)` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={handleDigitalFileRemove}
                      disabled={digitalUploading}
                      className="text-xs font-semibold text-red-500 disabled:opacity-60"
                    >
                      {locale === "bn" ? "সরান" : "Remove"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    {locale === "bn" ? "কোনো ফাইল আপলোড করা হয়নি।" : "No file uploaded yet."}
                  </p>
                )}
                <label className="mt-2 inline-block cursor-pointer rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                  {digitalUploading ? (locale === "bn" ? "আপলোড হচ্ছে..." : "Uploading...") : (locale === "bn" ? "ফাইল আপলোড/পরিবর্তন করুন" : "Upload/replace file")}
                  <input
                    type="file"
                    className="hidden"
                    disabled={digitalUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleDigitalFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {digitalPolicy ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {locale === "bn" ? "সর্বোচ্চ সাইজ" : "Max size"}: {digitalPolicy.max_file_size_mb}MB · {locale === "bn" ? "অনুমোদিত" : "Allowed"}: {digitalPolicy.allowed_extensions.join(", ")}
                  </p>
                ) : null}
                {digitalError ? <p className="mt-2 text-xs text-red-500">{digitalError}</p> : null}

                <label className="mt-4 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.digital_require_otp ?? true}
                    onChange={(e) => setField("digital_require_otp", e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="text-sm">
                    {locale === "bn" ? "ডাউনলোডের আগে SMS/ইমেইল ভেরিফিকেশন চাওয়া হবে" : "Require SMS/email verification before download"}
                  </span>
                </label>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {form.digital_require_otp ?? true
                    ? (locale === "bn"
                        ? "সুপারিশকৃত — লিংক শেয়ার করলেও অন্য কেউ ভেরিফিকেশন কোড ছাড়া ডাউনলোড করতে পারবে না।"
                        : "Recommended — even if the link is shared, no one else can download without the verification code.")
                    : (locale === "bn"
                        ? "⚠️ বন্ধ থাকলে লিংক যার কাছে যাবে সেই ডাউনলোড করতে পারবে — SMS গেটওয়ে/টেমপ্লেট সেট না থাকলে এটা বন্ধ রাখুন, নাহলে কাস্টমার আটকে যাবে।"
                        : "⚠️ When off, anyone with the link can download — turn this off if your SMS gateway/templates aren't set up yet, otherwise customers get stuck.")}
                </p>
              </div>
            ) : (
              <label className="mt-4 block">
                <span className="mb-1 block text-xs text-[var(--muted)]">
                  {locale === "bn" ? "এক্সটার্নাল ডাউনলোড লিংক" : "External download URL"}
                </span>
                <input
                  type="url"
                  value={form.digital_external_url ?? ""}
                  onChange={(e) => setField("digital_external_url", e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
            )}

            <div className="mt-4">
              <span className="mb-1 block text-xs text-[var(--muted)]">
                {locale === "bn" ? "ডেলিভারি নোটিফিকেশন মাধ্যম" : "Delivery notification channels"}
              </span>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(form.digital_delivery_channels ?? []).includes("email")}
                    onChange={() => toggleDeliveryChannel("email")}
                    className="accent-[var(--accent)]"
                  />
                  {locale === "bn" ? "ইমেইল" : "Email"}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(form.digital_delivery_channels ?? []).includes("sms")}
                    onChange={() => toggleDeliveryChannel("sms")}
                    className="accent-[var(--accent)]"
                  />
                  {locale === "bn" ? "এসএমএস" : "SMS"}
                </label>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {locale === "bn"
                  ? "কাস্টমার সবসময় অর্ডার-স্ট্যাটাস পেজ থেকেও ডাউনলোড লিংক পাবেন, এটা অতিরিক্ত মাধ্যম।"
                  : "The customer can always get the link from the order-status page too — this is an extra channel."}
              </p>
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
        ) : null}

        {/* ── Storefront Section (seller_storefront_context.md, S2) ── */}
        <section className="catv-panel p-4">
          <h3 className="text-base font-bold">{txt.storefrontTitle}</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{txt.storefrontHint}</p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.show_in_storefront ?? true}
                onChange={(e) => setField("show_in_storefront", e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {txt.showInStorefront}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_featured ?? false}
                onChange={(e) => setField("is_featured", e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {txt.isFeatured}
            </label>
          </div>

          {/* Key features */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--muted)]">{txt.featuresTitle}</span>
              <button type="button" onClick={addFeature} className="text-xs font-semibold text-[var(--accent)]">
                {txt.addFeature}
              </button>
            </div>
            <div className="space-y-2">
              {(form.features ?? []).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={f}
                    onChange={(e) => updateFeature(i, e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                  />
                  <button type="button" onClick={() => removeFeature(i)} className="text-xs text-red-500">
                    {txt.remove}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Grouped specifications */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--muted)]">{txt.specTitle}</span>
              <button type="button" onClick={addSpecGroup} className="text-xs font-semibold text-[var(--accent)]">
                {txt.addGroup}
              </button>
            </div>
            <div className="space-y-3">
              {(form.specifications ?? []).map((group, gi) => (
                <div key={gi} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={group.group}
                      onChange={(e) => updateSpecGroupName(gi, e.target.value)}
                      placeholder={txt.groupName}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm font-semibold"
                    />
                    <button type="button" onClick={() => removeSpecGroup(gi)} className="text-xs text-red-500 whitespace-nowrap">
                      {txt.remove}
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {group.items.map((item, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <input
                          value={item.label}
                          onChange={(e) => updateSpecItem(gi, ii, "label", e.target.value)}
                          placeholder={txt.specLabel}
                          className="w-1/3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                        />
                        <input
                          value={item.value}
                          onChange={(e) => updateSpecItem(gi, ii, "value", e.target.value)}
                          placeholder={txt.specValue}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                        />
                        <button type="button" onClick={() => removeSpecItem(gi, ii)} className="text-xs text-red-500">
                          {txt.remove}
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addSpecItem(gi)} className="text-xs font-semibold text-[var(--accent)]">
                      {txt.addItem}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="mt-5 block">
            <span className="mb-1 block text-xs text-[var(--muted)]">{txt.seoContent}</span>
            <p className="mb-1 text-xs text-[var(--muted)]">{txt.seoContentHint}</p>
            <textarea
              rows={3}
              value={form.seo_content ?? ""}
              onChange={(e) => setField("seo_content", e.target.value)}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs text-[var(--muted)]">{txt.warrantyOverride}</span>
            <p className="mb-1 text-xs text-[var(--muted)]">{txt.warrantyOverrideHint}</p>
            <textarea
              rows={2}
              value={form.warranty_override ?? ""}
              onChange={(e) => setField("warranty_override", e.target.value)}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs text-[var(--muted)]">{txt.deliveryOverride}</span>
            <p className="mb-1 text-xs text-[var(--muted)]">{txt.deliveryOverrideHint}</p>
            <textarea
              rows={2}
              value={form.delivery_override ?? ""}
              onChange={(e) => setField("delivery_override", e.target.value)}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>

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
            locale={locale}
          />
        </section>
      </div>
    </UserShell>
  );
}
