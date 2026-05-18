"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken, type Locale } from "@/lib/dashboard-client";
import LandingPageDraftPreview from "@/components/landing-page-draft-preview";
import {
  LANDING_API_BASE,
  type LandingImportFile,
  type LandingPageContent,
  type LandingPageProductInput,
  type LandingPageRecord,
  type LandingTemplate,
  type ProductItem,
  getLandingTemplateName,
  mergeLandingContent,
  toNumberOrNull,
} from "@/lib/landing-pages";

type LandingPageStudioProps = {
  locale: Locale;
  mode: "create" | "edit";
  pageId?: string;
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

type HtmlSectionDraft = {
  title: string;
  html: string;
};

type FeatureDraft = {
  title: string;
  description: string;
};

type ReviewDraft = {
  name: string;
  quote: string;
};

type FaqDraft = {
  q: string;
  a: string;
};

type FormState = {
  title: string;
  slug: string;
  status: "draft" | "published";
  templateId: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroCtaText: string;
  metaTitle: string;
  metaDescription: string;
};

const text = {
  bn: {
    loading: "ডেটা লোড হচ্ছে...",
    loadFailed: "ডেটা লোড করা যায়নি।",
    submitFailed: "সংরক্ষণ করা যায়নি।",
    importFailed: "JSON import করা যায়নি।",
    createSuccess: "ল্যান্ডিং পেজ তৈরি হয়েছে।",
    updateSuccess: "ল্যান্ডিং পেজ আপডেট হয়েছে।",
    importedSuccess: "JSON থেকে ল্যান্ডিং পেজ তৈরি হয়েছে।",
    title: "পেজ শিরোনাম",
    slug: "স্লাগ",
    status: "স্ট্যাটাস",
    draft: "Draft",
    published: "Published",
    template: "টেমপ্লেট নির্বাচন",
    templateHint: "টেমপ্লেট বেছে নিলে default hero/content apply হবে।",
    customTemplate: "কাস্টম / টেমপ্লেট ছাড়া",
    templatePreview: "টেমপ্লেট প্রিভিউ",
    hero: "Hero / CTA",
    heroHeadline: "Hero headline",
    heroSubheadline: "Hero subheadline",
    heroCtaText: "CTA button text",
    seo: "SEO সেটিংস",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    products: "পণ্য যুক্ত করুন",
    productsHint: "ডান পাশ থেকে পণ্য attach করুন, উপরে-নিচে drag করে order বদলান।",
    selectedProducts: "সংযুক্ত পণ্য",
    emptyProducts: "এখনও কোনো পণ্য attach করা হয়নি।",
    searchProducts: "পণ্য খুঁজুন...",
    noProducts: "কোনো পণ্য পাওয়া যায়নি।",
    attach: "যুক্ত করুন",
    remove: "সরান",
    overrideTitle: "টাইটেল ওভাররাইড",
    overrideSubtitle: "সাবটাইটেল",
    badge: "ব্যাজ",
    overridePrice: "দাম ওভাররাইড",
    defaultQty: "ডিফল্ট Qty",
    selectedByDefault: "ডিফল্ট সিলেক্টেড",
    save: "সংরক্ষণ করুন",
    creating: "তৈরি হচ্ছে...",
    saving: "সংরক্ষণ হচ্ছে...",
    importSection: "JSON import",
    importHint: "রেডিমেড JSON template থেকে দ্রুত landing page তৈরি করুন।",
    importFile: "JSON ফাইল",
    importNow: "Import করুন",
    previewPublic: "Public preview",
    copyPublicUrl: "URL copy",
    publicOnlyPublished: "Preview শুধুমাত্র published পেজে কাজ করবে।",
    copied: "URL copy হয়েছে।",
    copyFailed: "URL copy করা যায়নি।",
    dragHint: "ড্রাগ করে order বদলান",
    sections: "Content sections",
    sectionsHint: "Hero ছাড়াও HTML blocks, feature list, review, FAQ, shipping ও contact edit করুন।",
    htmlSections: "HTML sections",
    sectionTitle: "সেকশন শিরোনাম",
    sectionHtml: "HTML content",
    addSection: "সেকশন যোগ করুন",
    features: "ফিচার লিস্ট",
    featureTitle: "ফিচার শিরোনাম",
    featureDescription: "ফিচার বর্ণনা",
    addFeature: "ফিচার যোগ করুন",
    reviews: "রিভিউ",
    reviewName: "রিভিউয়ারের নাম",
    reviewQuote: "রিভিউ টেক্সট",
    addReview: "রিভিউ যোগ করুন",
    faq: "FAQ",
    faqQuestion: "প্রশ্ন",
    faqAnswer: "উত্তর",
    addFaq: "FAQ যোগ করুন",
    shippingContact: "Shipping / Contact",
    insideDhaka: "ঢাকার ভিতরে",
    outsideDhaka: "ঢাকার বাইরে",
    contactPhone: "যোগাযোগের ফোন",
    customCss: "Custom CSS",
    customCssHint: "পাবলিক landing page-এ apply হবে।",
    previewCanvas: "Live preview",
    previewCanvasHint: "ডান পাশে draft landing page preview দেখুন।",
  },
  en: {
    loading: "Loading data...",
    loadFailed: "Failed to load data.",
    submitFailed: "Failed to save landing page.",
    importFailed: "Failed to import JSON.",
    createSuccess: "Landing page created successfully.",
    updateSuccess: "Landing page updated successfully.",
    importedSuccess: "Landing page imported successfully from JSON.",
    title: "Page title",
    slug: "Slug",
    status: "Status",
    draft: "Draft",
    published: "Published",
    template: "Select template",
    templateHint: "Picking a template applies default hero/content values.",
    customTemplate: "Custom / no template",
    templatePreview: "Template preview",
    hero: "Hero / CTA",
    heroHeadline: "Hero headline",
    heroSubheadline: "Hero subheadline",
    heroCtaText: "CTA button text",
    seo: "SEO settings",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    products: "Attach products",
    productsHint: "Attach products from the right, then drag to reorder them.",
    selectedProducts: "Attached products",
    emptyProducts: "No products attached yet.",
    searchProducts: "Search products...",
    noProducts: "No products found.",
    attach: "Attach",
    remove: "Remove",
    overrideTitle: "Title override",
    overrideSubtitle: "Subtitle",
    badge: "Badge",
    overridePrice: "Price override",
    defaultQty: "Default Qty",
    selectedByDefault: "Selected by default",
    save: "Save",
    creating: "Creating...",
    saving: "Saving...",
    importSection: "JSON import",
    importHint: "Quickly create a landing page from a ready-made JSON template.",
    importFile: "JSON file",
    importNow: "Import now",
    previewPublic: "Public preview",
    copyPublicUrl: "Copy URL",
    publicOnlyPublished: "Preview works only for published pages.",
    copied: "URL copied.",
    copyFailed: "Failed to copy URL.",
    dragHint: "Drag to reorder",
    sections: "Content sections",
    sectionsHint: "Edit HTML blocks, features, reviews, FAQ, shipping, and contact details.",
    htmlSections: "HTML sections",
    sectionTitle: "Section title",
    sectionHtml: "HTML content",
    addSection: "Add section",
    features: "Feature list",
    featureTitle: "Feature title",
    featureDescription: "Feature description",
    addFeature: "Add feature",
    reviews: "Reviews",
    reviewName: "Reviewer name",
    reviewQuote: "Review quote",
    addReview: "Add review",
    faq: "FAQ",
    faqQuestion: "Question",
    faqAnswer: "Answer",
    addFaq: "Add FAQ",
    shippingContact: "Shipping / Contact",
    insideDhaka: "Inside Dhaka",
    outsideDhaka: "Outside Dhaka",
    contactPhone: "Contact phone",
    customCss: "Custom CSS",
    customCssHint: "Applied on the public landing page.",
    previewCanvas: "Live preview",
    previewCanvasHint: "See a draft preview of the landing page on the right.",
  },
};

function normalizeHtmlSection(section: { title?: string | null; html?: string | null }): HtmlSectionDraft {
  return {
    title: String(section?.title ?? ""),
    html: String(section?.html ?? ""),
  };
}

function normalizeFeature(feature: { title?: string | null; description?: string | null }): FeatureDraft {
  return {
    title: String(feature?.title ?? ""),
    description: String(feature?.description ?? ""),
  };
}

function normalizeReview(review: { name?: string | null; quote?: string | null }): ReviewDraft {
  return {
    name: String(review?.name ?? ""),
    quote: String(review?.quote ?? ""),
  };
}

function normalizeFaq(faq: { q?: string | null; a?: string | null }): FaqDraft {
  return {
    q: String(faq?.q ?? ""),
    a: String(faq?.a ?? ""),
  };
}

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

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

export default function LandingPageStudio({ locale, mode, pageId }: LandingPageStudioProps) {
  const router = useRouter();
  const t = text[locale] ?? text.en;
  const token = getStoredToken();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [templates, setTemplates] = useState<LandingTemplate[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [importFiles, setImportFiles] = useState<LandingImportFile[]>([]);
  const [importFile, setImportFile] = useState<string>("");
  const [page, setPage] = useState<LandingPageRecord | null>(null);
  const [form, setForm] = useState<FormState>({
    title: "",
    slug: "",
    status: "draft",
    templateId: "",
    heroHeadline: "",
    heroSubheadline: "",
    heroCtaText: "",
    metaTitle: "",
    metaDescription: "",
  });
  const [query, setQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<ProductDraft[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [htmlSections, setHtmlSections] = useState<HtmlSectionDraft[]>([]);
  const [featureItems, setFeatureItems] = useState<FeatureDraft[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewDraft[]>([]);
  const [faqItems, setFaqItems] = useState<FaqDraft[]>([]);
  const [contactPhone, setContactPhone] = useState("");
  const [shippingInside, setShippingInside] = useState("80");
  const [shippingOutside, setShippingOutside] = useState("120");
  const [customCss, setCustomCss] = useState("");

  useEffect(() => {
    if (!token) {
      setError(t.loadFailed);
      setLoading(false);
      return;
    }

    if (mode === "edit" && !pageId) {
      setLoading(true);
      return;
    }

    const load = async () => {
      try {
        setError(null);
        const [templatesRes, productsRes, importFilesRes, pageRes] = await Promise.all([
          fetch(`${LANDING_API_BASE}/landing/templates`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/products?per_page=100`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/landing/pages/import-json/files`, { headers: { Authorization: `Bearer ${token}` } }),
          mode === "edit" && pageId
            ? fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve(null),
        ]);

        if (!templatesRes.ok || !productsRes.ok || !importFilesRes.ok || (pageRes && !pageRes.ok)) {
          throw new Error(t.loadFailed);
        }

        const templatesJson = await templatesRes.json();
        const productsJson = await productsRes.json();
        const importFilesJson = await importFilesRes.json();
        const nextTemplates = templatesJson.data ?? [];
        setTemplates(nextTemplates);
        setProducts((productsJson.data ?? []).filter((item: ProductItem) => item.status !== "archived"));
        setImportFiles(importFilesJson.data ?? []);
        setImportFile(importFilesJson.data?.[0] ?? "");

        if (pageRes) {
          const pageJson = await pageRes.json();
          const loadedPage = pageJson.data as LandingPageRecord;
          const mergedContent = mergeLandingContent(loadedPage.content, loadedPage.template);
          setPage(loadedPage);
          setForm({
            title: loadedPage.title ?? "",
            slug: loadedPage.slug ?? "",
            status: loadedPage.status === "published" ? "published" : "draft",
            templateId: loadedPage.template_id ? String(loadedPage.template_id) : "",
            heroHeadline: mergedContent.hero?.headline ?? loadedPage.title ?? "",
            heroSubheadline: mergedContent.hero?.subheadline ?? "",
            heroCtaText: mergedContent.hero?.cta_text ?? "",
            metaTitle: loadedPage.seo_meta?.meta_title ?? loadedPage.title ?? "",
            metaDescription: loadedPage.seo_meta?.meta_description ?? "",
          });
          setSelectedProducts((loadedPage.products ?? []).map((item, index) => normalizeDraft(item, index)));
          setHtmlSections((mergedContent.html_sections ?? []).map(normalizeHtmlSection));
          setFeatureItems((mergedContent.features ?? []).map(normalizeFeature));
          setReviewItems((mergedContent.reviews ?? []).map(normalizeReview));
          setFaqItems((mergedContent.faq ?? []).map(normalizeFaq));
          setContactPhone(String(mergedContent.contact?.phone ?? ""));
          setShippingInside(String(mergedContent.shipping?.inside_dhaka ?? 80));
          setShippingOutside(String(mergedContent.shipping?.outside_dhaka ?? 120));
          setCustomCss(loadedPage.custom_css ?? "");
        } else if (mode === "create") {
          const template = nextTemplates[0] as LandingTemplate | undefined;
          if (template) {
            applyTemplate(template, true);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.loadFailed);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token, mode, pageId, locale]);

  const templateMap = useMemo(() => new Map(templates.map((item) => [String(item.id), item])), [templates]);
  const selectedTemplate = templateMap.get(form.templateId) ?? null;
  const filteredProducts = useMemo(() => {
    const attached = new Set(selectedProducts.map((item) => item.product_id));
    const needle = query.trim().toLowerCase();
    return products.filter((item) => {
      if (attached.has(item.id)) return false;
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

  function applyTemplate(template: LandingTemplate, force = false) {
    const mergedContent = mergeLandingContent(null, template);
    const hero = (mergedContent.hero ?? {}) as Record<string, unknown>;
    setForm((prev) => ({
      ...prev,
      templateId: String(template.id),
      heroHeadline: force || !prev.heroHeadline ? String(hero.headline ?? prev.title ?? prev.heroHeadline ?? "") : prev.heroHeadline,
      heroSubheadline: force || !prev.heroSubheadline ? String(hero.subheadline ?? "") : prev.heroSubheadline,
      heroCtaText: force || !prev.heroCtaText ? String(hero.cta_text ?? "") : prev.heroCtaText,
      metaTitle: force || !prev.metaTitle ? prev.title || String(hero.headline ?? "") : prev.metaTitle,
    }));
    if (force || htmlSections.length === 0) {
      setHtmlSections((mergedContent.html_sections ?? []).map(normalizeHtmlSection));
    }
    if (force || featureItems.length === 0) {
      setFeatureItems((mergedContent.features ?? []).map(normalizeFeature));
    }
    if (force || reviewItems.length === 0) {
      setReviewItems((mergedContent.reviews ?? []).map(normalizeReview));
    }
    if (force || faqItems.length === 0) {
      setFaqItems((mergedContent.faq ?? []).map(normalizeFaq));
    }
    if (force || !contactPhone) {
      setContactPhone(String(mergedContent.contact?.phone ?? ""));
    }
    if (force || !shippingInside) {
      setShippingInside(String(mergedContent.shipping?.inside_dhaka ?? 80));
    }
    if (force || !shippingOutside) {
      setShippingOutside(String(mergedContent.shipping?.outside_dhaka ?? 120));
    }
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addProduct(product: ProductItem) {
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
  }

  function removeProduct(productId: number) {
    setSelectedProducts((prev) => prev.filter((item) => item.product_id !== productId).map((item, index) => ({ ...item, sort_order: index + 1 })));
  }

  function patchProduct(productId: number, changes: Partial<ProductDraft>) {
    setSelectedProducts((prev) => prev.map((item) => (item.product_id === productId ? { ...item, ...changes } : item)));
  }

  function reorderByIds(sourceId: number, targetId: number) {
    if (sourceId === targetId) return;
    setSelectedProducts((prev) => {
      const from = prev.findIndex((item) => item.product_id === sourceId);
      const to = prev.findIndex((item) => item.product_id === targetId);
      if (from < 0 || to < 0) return prev;
      return moveItem(prev, from, to).map((item, index) => ({ ...item, sort_order: index + 1 }));
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title: form.title,
        slug: form.slug.trim() || undefined,
        status: form.status,
        template_id: form.templateId ? Number(form.templateId) : null,
        content: {
          hero: {
            headline: form.heroHeadline || form.title,
            subheadline: form.heroSubheadline || null,
            cta_text: form.heroCtaText || null,
          },
          html_sections: htmlSections
            .filter((item) => item.title.trim() || item.html.trim())
            .map((item) => ({ title: item.title.trim() || null, html: item.html || null })),
          features: featureItems
            .filter((item) => item.title.trim() || item.description.trim())
            .map((item) => ({ title: item.title.trim() || null, description: item.description.trim() || null })),
          reviews: reviewItems
            .filter((item) => item.name.trim() || item.quote.trim())
            .map((item) => ({ name: item.name.trim() || null, quote: item.quote.trim() || null })),
          faq: faqItems
            .filter((item) => item.q.trim() || item.a.trim())
            .map((item) => ({ q: item.q.trim() || null, a: item.a.trim() || null })),
          contact: {
            phone: contactPhone.trim() || null,
          },
          shipping: {
            inside_dhaka: toNumberOrNull(shippingInside) ?? 80,
            outside_dhaka: toNumberOrNull(shippingOutside) ?? 120,
          },
        },
        seo_meta: {
          meta_title: form.metaTitle || form.title,
          meta_description: form.metaDescription || null,
        },
        custom_css: customCss || null,
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
        setTimeout(() => router.push(`/dashboard/landing-pages/${nextId}`), 700);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.submitFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    if (!token || !importFile) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/import-json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file_name: importFile,
          template_id: form.templateId ? Number(form.templateId) : null,
          status: form.status,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || t.importFailed);
      }
      const nextId = json.data?.id;
      setSuccess(t.importedSuccess);
      if (nextId) {
        setTimeout(() => router.push(`/dashboard/landing-pages/${nextId}`), 700);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.importFailed);
    } finally {
      setImporting(false);
    }
  }

  async function copyPublicUrl() {
    if (!page?.public_url) return;
    try {
      await navigator.clipboard.writeText(page.public_url);
      setSuccess(t.copied);
    } catch {
      setError(t.copyFailed);
    }
  }

  function patchListItem<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, changes: Partial<T>) {
    setter((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));
  }

  function removeListItem<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) {
    setter((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className="mx-auto max-w-7xl catv-panel p-4 sm:p-5">
      {loading ? (
        <div className="text-sm text-[var(--muted)]">{t.loading}</div>
      ) : (
        <div className="space-y-5">
          {page ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{locale === "bn" ? "বর্তমান পেজ" : "Current page"}</p>
                <p className="truncate text-base font-semibold text-[var(--foreground)]">{page.title}</p>
                <p className="truncate text-xs text-[var(--muted)]">{page.public_url ?? `${typeof window !== "undefined" ? window.location.origin : ""}/lp/${form.slug}`}</p>
              </div>
              <button
                type="button"
                onClick={() => window.open(page.public_url ?? `/lp/${form.slug}`, "_blank", "noopener,noreferrer")}
                disabled={form.status !== "published"}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50"
              >
                {t.previewPublic}
              </button>
              <button
                type="button"
                onClick={() => void copyPublicUrl()}
                disabled={!page.public_url}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50"
              >
                {t.copyPublicUrl}
              </button>
            </div>
          ) : null}

          {(error || success) ? (
            <div className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              {error || success}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="block xl:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.title}</span>
                  <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} required className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.slug}</span>
                  <input value={form.slug} onChange={(e) => updateForm("slug", e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.status}</span>
                  <select value={form.status} onChange={(e) => updateForm("status", e.target.value as FormState["status"])} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-[var(--foreground)]">
                    <option value="draft">{t.draft}</option>
                    <option value="published">{t.published}</option>
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--foreground)]">{t.template}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{t.templateHint}</p>
                  </div>
                  <div className="text-xs text-[var(--muted)]">{selectedTemplate ? getLandingTemplateName(selectedTemplate, locale) : t.customTemplate}</div>
                </div>
                <select value={form.templateId} onChange={(e) => {
                  const value = e.target.value;
                  updateForm("templateId", value);
                  const selected = templateMap.get(value);
                  if (selected) applyTemplate(selected);
                }} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)]">
                  <option value="">{t.customTemplate}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{getLandingTemplateName(template, locale)}</option>
                  ))}
                </select>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {templates.map((template) => {
                    const active = String(template.id) === form.templateId;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className={`overflow-hidden rounded-2xl border p-0 text-left transition ${active ? "border-[var(--accent)] bg-[var(--surface)] shadow-lg" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40"}`}
                      >
                        <div className="aspect-[16/9] bg-gradient-to-br from-[var(--accent)]/20 to-orange-400/10">
                          {template.preview_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={template.preview_image} alt={getLandingTemplateName(template, locale)} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-[var(--foreground)]">
                              {getLandingTemplateName(template, locale)}
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="text-sm font-semibold text-[var(--foreground)]">{getLandingTemplateName(template, locale)}</div>
                          <div className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{template.description || "—"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <h3 className="text-base font-semibold text-[var(--foreground)]">{t.hero}</h3>
                  <div className="mt-3 space-y-3">
                    <input value={form.heroHeadline} onChange={(e) => updateForm("heroHeadline", e.target.value)} placeholder={t.heroHeadline} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)]" />
                    <textarea value={form.heroSubheadline} onChange={(e) => updateForm("heroSubheadline", e.target.value)} placeholder={t.heroSubheadline} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] resize-none" />
                    <input value={form.heroCtaText} onChange={(e) => updateForm("heroCtaText", e.target.value)} placeholder={t.heroCtaText} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)]" />
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <h3 className="text-base font-semibold text-[var(--foreground)]">{t.seo}</h3>
                  <div className="mt-3 space-y-3">
                    <input value={form.metaTitle} onChange={(e) => updateForm("metaTitle", e.target.value)} placeholder={t.metaTitle} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)]" />
                    <textarea value={form.metaDescription} onChange={(e) => updateForm("metaDescription", e.target.value)} placeholder={t.metaDescription} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] resize-none" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--foreground)]">{t.sections}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{t.sectionsHint}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-5">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.htmlSections}</h4>
                      <button type="button" onClick={() => setHtmlSections((prev) => [...prev, { title: "", html: "" }])} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">{t.addSection}</button>
                    </div>
                    <div className="space-y-3">
                      {htmlSections.length === 0 ? <div className="text-sm text-[var(--muted)]">{locale === "bn" ? "এখনও কোনো section নেই।" : "No sections yet."}</div> : null}
                      {htmlSections.map((section, index) => (
                        <div key={`section-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                          <div className="mb-2 flex justify-end">
                            <button type="button" onClick={() => removeListItem(setHtmlSections, index)} className="rounded-lg border border-red-400/30 px-2.5 py-1 text-xs font-semibold text-red-400">{t.remove}</button>
                          </div>
                          <div className="space-y-3">
                            <input value={section.title} onChange={(e) => patchListItem(setHtmlSections, index, { title: e.target.value })} placeholder={t.sectionTitle} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
                            <textarea value={section.html} onChange={(e) => patchListItem(setHtmlSections, index, { html: e.target.value })} placeholder={t.sectionHtml} rows={5} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-y" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.features}</h4>
                        <button type="button" onClick={() => setFeatureItems((prev) => [...prev, { title: "", description: "" }])} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">{t.addFeature}</button>
                      </div>
                      <div className="space-y-3">
                        {featureItems.map((feature, index) => (
                          <div key={`feature-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                            <div className="mb-2 flex justify-end">
                              <button type="button" onClick={() => removeListItem(setFeatureItems, index)} className="rounded-lg border border-red-400/30 px-2.5 py-1 text-xs font-semibold text-red-400">{t.remove}</button>
                            </div>
                            <div className="space-y-3">
                              <input value={feature.title} onChange={(e) => patchListItem(setFeatureItems, index, { title: e.target.value })} placeholder={t.featureTitle} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
                              <textarea value={feature.description} onChange={(e) => patchListItem(setFeatureItems, index, { description: e.target.value })} placeholder={t.featureDescription} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-none" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.reviews}</h4>
                        <button type="button" onClick={() => setReviewItems((prev) => [...prev, { name: "", quote: "" }])} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">{t.addReview}</button>
                      </div>
                      <div className="space-y-3">
                        {reviewItems.map((review, index) => (
                          <div key={`review-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                            <div className="mb-2 flex justify-end">
                              <button type="button" onClick={() => removeListItem(setReviewItems, index)} className="rounded-lg border border-red-400/30 px-2.5 py-1 text-xs font-semibold text-red-400">{t.remove}</button>
                            </div>
                            <div className="space-y-3">
                              <input value={review.name} onChange={(e) => patchListItem(setReviewItems, index, { name: e.target.value })} placeholder={t.reviewName} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
                              <textarea value={review.quote} onChange={(e) => patchListItem(setReviewItems, index, { quote: e.target.value })} placeholder={t.reviewQuote} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-none" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.faq}</h4>
                      <button type="button" onClick={() => setFaqItems((prev) => [...prev, { q: "", a: "" }])} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">{t.addFaq}</button>
                    </div>
                    <div className="space-y-3">
                      {faqItems.map((item, index) => (
                        <div key={`faq-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                          <div className="mb-2 flex justify-end">
                            <button type="button" onClick={() => removeListItem(setFaqItems, index)} className="rounded-lg border border-red-400/30 px-2.5 py-1 text-xs font-semibold text-red-400">{t.remove}</button>
                          </div>
                          <div className="space-y-3">
                            <input value={item.q} onChange={(e) => patchListItem(setFaqItems, index, { q: e.target.value })} placeholder={t.faqQuestion} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
                            <textarea value={item.a} onChange={(e) => patchListItem(setFaqItems, index, { a: e.target.value })} placeholder={t.faqAnswer} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.shippingContact}</h4>
                      <div className="mt-3 space-y-3">
                        <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder={t.contactPhone} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <input value={shippingInside} onChange={(e) => setShippingInside(e.target.value)} placeholder={t.insideDhaka} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <input value={shippingOutside} onChange={(e) => setShippingOutside(e.target.value)} placeholder={t.outsideDhaka} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.customCss}</h4>
                      <p className="mt-1 text-sm text-[var(--muted)]">{t.customCssHint}</p>
                      <textarea value={customCss} onChange={(e) => setCustomCss(e.target.value)} rows={8} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-mono" />
                    </div>
                  </div>
                </div>
              </div>

              {mode === "create" ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <h3 className="text-base font-semibold text-[var(--foreground)]">{t.importSection}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{t.importHint}</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <select value={importFile || ""} onChange={(e) => setImportFile(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)]">
                      <option value="">— Select a file —</option>
                      {Array.isArray(importFiles) && importFiles.length > 0 ? (
                        importFiles.map((file) => {
                          const fileStr = String(file || "").trim();
                          return fileStr ? <option key={fileStr} value={fileStr}>{fileStr}</option> : null;
                        })
                      ) : (
                        <option disabled>No files available</option>
                      )}
                    </select>
                    <button type="button" onClick={() => void handleImport()} disabled={importing || !importFile} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--accent)] disabled:opacity-50">
                      {importing ? "..." : t.importNow}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--foreground)]">{t.selectedProducts}</h3>
                    <p className="text-sm text-[var(--muted)]">{t.productsHint}</p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{t.dragHint}</span>
                </div>
                {selectedProductDetails.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{t.emptyProducts}</div>
                ) : (
                  <div className="mt-3 space-y-4">
                    {selectedProductDetails.map((item, index) => (
                      <div
                        key={item.product_id}
                        draggable
                        onDragStart={() => setDraggingId(item.product_id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggingId != null) reorderByIds(draggingId, item.product_id);
                          setDraggingId(null);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        className={`rounded-2xl border bg-[var(--surface)] p-4 ${draggingId === item.product_id ? "border-[var(--accent)] shadow-lg" : "border-[var(--border)]"}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="cursor-grab text-lg text-[var(--muted)]">⋮⋮</span>
                              <h4 className="text-sm font-semibold text-[var(--foreground)]">{item.product?.name ?? `#${item.product_id}`}</h4>
                            </div>
                            <p className="mt-1 text-xs text-[var(--muted)]">SKU: {item.product?.sku || "—"} · ৳{Number(item.product?.selling_price ?? item.product?.regular_price ?? 0).toLocaleString()} · #{index + 1}</p>
                          </div>
                          <button type="button" onClick={() => removeProduct(item.product_id)} className="rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-400">{t.remove}</button>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? (mode === "edit" ? t.saving : t.creating) : t.save}
              </button>
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <h3 className="text-base font-semibold text-[var(--foreground)]">{t.previewCanvas}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{t.previewCanvasHint}</p>
                <div className="mt-4 overflow-hidden rounded-2xl">
                  <LandingPageDraftPreview
                    locale={locale}
                    title={form.title}
                    heroHeadline={form.heroHeadline}
                    heroSubheadline={form.heroSubheadline}
                    heroCtaText={form.heroCtaText}
                    htmlSections={htmlSections}
                    features={featureItems}
                    reviews={reviewItems}
                    faq={faqItems}
                    selectedProducts={selectedProductDetails}
                    shippingInside={shippingInside}
                    shippingOutside={shippingOutside}
                    contactPhone={contactPhone}
                    customCss={customCss}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <h3 className="text-base font-semibold text-[var(--foreground)]">{t.products}</h3>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchProducts} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" />
                <div className="mt-3 space-y-3">
                  {filteredProducts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{t.noProducts}</div>
                  ) : (
                    filteredProducts.slice(0, 30).map((product) => (
                      <div key={product.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">{product.name}</h4>
                          <p className="mt-1 text-xs text-[var(--muted)]">SKU: {product.sku || "—"}</p>
                          <p className="text-xs text-[var(--muted)]">৳{Number(product.selling_price ?? product.regular_price ?? 0).toLocaleString()} · Stock {product.stock ?? 0}</p>
                        </div>
                        <button type="button" onClick={() => addProduct(product)} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">{t.attach}</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">
                <div className="font-semibold text-[var(--foreground)]">{locale === "bn" ? "Preview note" : "Preview note"}</div>
                <p className="mt-2">{t.publicOnlyPublished}</p>
              </div>
            </aside>
          </form>
        </div>
      )}
    </section>
  );
}
