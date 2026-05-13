"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import LandingRenderer from "@/components/landing-renderer";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import {
  buildApiHeaders,
  getTemplateDescription,
  getTemplateLabel,
  LANDING_API_BASE,
  readApiResponse,
  type LandingPageData,
  type LandingPageProduct,
  type LandingTemplate,
  type ProductOption,
} from "@/lib/landing";

const text = {
  bn: {
    loading: "লোড হচ্ছে...",
    title: "টাইটেল",
    slug: "স্লাগ",
    metaTitle: "মেটা টাইটেল",
    metaDescription: "মেটা ডেসক্রিপশন",
    template: "টেমপ্লেট",
    chooseTemplate: "টেমপ্লেট নির্বাচন করুন",
    products: "প্রডাক্ট যুক্ত করুন",
    noProducts: "কোনো প্রডাক্ট নির্বাচন করা হয়নি",
    addProduct: "প্রডাক্ট যোগ করুন",
    sectionContent: "সেকশন কনটেন্ট",
    lockedLayout: "Locked Layout Mode",
    lockedLayoutHint: "এই টেমপ্লেটে section order/structure পরিবর্তন করা যাবে না।",
    lockedData: "Locked Content Data",
    preview: "লাইভ প্রিভিউ",
    saveDraft: "ড্রাফট সেভ",
    publish: "পাবলিশ",
    archive: "আর্কাইভ",
    saving: "সংরক্ষণ হচ্ছে...",
    publishing: "পাবলিশ হচ্ছে...",
    archived: "আর্কাইভ হচ্ছে...",
    backToList: "তালিকায় ফিরে যান",
    createSuccess: "ল্যান্ডিং পেইজ সফলভাবে তৈরি হয়েছে।",
    updateSuccess: "ল্যান্ডিং পেইজ আপডেট হয়েছে।",
    publishSuccess: "ল্যান্ডিং পেইজ পাবলিশ হয়েছে।",
    archiveSuccess: "ল্যান্ডিং পেইজ আর্কাইভ হয়েছে।",
    selectProduct: "প্রডাক্ট নির্বাচন করুন",
    customTitle: "কাস্টম টাইটেল",
    customPrice: "কাস্টম মূল্য",
    defaultQty: "ডিফল্ট Qty",
    featured: "ফিচার্ড",
    remove: "মুছুন",
    colors: "ব্র্যান্ড কালার",
    primaryColor: "Primary",
    accentColor: "Accent",
    contactPhone: "সাপোর্ট ফোন",
    whatsapp: "হোয়াটসঅ্যাপ",
    privacy: "Privacy URL",
    terms: "Terms URL",
    returnUrl: "Return URL",
    fieldRequired: "টাইটেল এবং টেমপ্লেট আবশ্যক।",
    publishHint: "পাবলিশ করার আগে অন্তত ১টি প্রডাক্ট, privacy ও terms URL যুক্ত করুন।",
    invalidLockedJson: "Locked template data invalid. Required কাঠামো ঠিক করুন।",
  },
  en: {
    loading: "Loading...",
    title: "Title",
    slug: "Slug",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    template: "Template",
    chooseTemplate: "Choose a template",
    products: "Attach products",
    noProducts: "No product selected yet",
    addProduct: "Add product",
    sectionContent: "Section content",
    lockedLayout: "Locked Layout Mode",
    lockedLayoutHint: "Section order and structure cannot be changed in this template.",
    lockedData: "Locked Content Data",
    preview: "Live preview",
    saveDraft: "Save Draft",
    publish: "Publish",
    archive: "Archive",
    saving: "Saving...",
    publishing: "Publishing...",
    archived: "Archiving...",
    backToList: "Back to list",
    createSuccess: "Landing page created successfully.",
    updateSuccess: "Landing page updated successfully.",
    publishSuccess: "Landing page published successfully.",
    archiveSuccess: "Landing page archived successfully.",
    selectProduct: "Select product",
    customTitle: "Custom title",
    customPrice: "Custom price",
    defaultQty: "Default Qty",
    featured: "Featured",
    remove: "Remove",
    colors: "Brand colors",
    primaryColor: "Primary",
    accentColor: "Accent",
    contactPhone: "Support phone",
    whatsapp: "WhatsApp",
    privacy: "Privacy URL",
    terms: "Terms URL",
    returnUrl: "Return URL",
    fieldRequired: "Title and template are required.",
    publishHint: "Before publishing, add at least one product plus privacy and terms URLs.",
    invalidLockedJson: "Locked template data is invalid. Please fix required structure.",
  },
};

type EditorProps = {
  pageId?: number;
};

type Section = {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  data: Record<string, unknown>;
};

type FormState = {
  template_id: string;
  title: string;
  slug: string;
  meta_title: string;
  meta_description: string;
  theme_tokens_json: {
    primary_color: string;
    accent_color: string;
  };
  content_json: {
    sections: Section[];
    contact: {
      phone: string;
      whatsapp: string;
    };
    policy: {
      privacy_url: string;
      terms_url: string;
      return_url: string;
    };
  };
  products: LandingPageProduct[];
};

type LockedContent = {
  layout_profile: string;
  hero: { title: string; subtitle: string; disclaimer: string };
  proof: { video_url: string; review_images: Array<Record<string, unknown>> };
  offer_strip: { cta_label: string; package_highlights: Array<Record<string, unknown>> };
  contact: { call_numbers: string[]; whatsapp_numbers: string[] };
  checkout: {
    section_title: string;
    packages: Array<Record<string, unknown>>;
    shipping_options: Array<Record<string, unknown>>;
    upsell: { enabled: boolean; title: string; price: number; checkbox_label?: string; description_html?: string; image?: string };
    cod_confirmation_text: string;
    submit_label: string;
  };
  bottom_cta: { text: string; phone: string };
  policy: { privacy_url: string; terms_url: string };
  theme: { primary: string; accent: string; button_text: string };
};

function normalizeLockedContent(raw: unknown): LockedContent {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const checkout = (src.checkout && typeof src.checkout === "object" ? src.checkout : {}) as Record<string, unknown>;
  const upsell = (checkout.upsell && typeof checkout.upsell === "object" ? checkout.upsell : {}) as Record<string, unknown>;

  return {
    layout_profile: "naturiva_exact_clone_locked",
    hero: {
      title: String((src.hero as Record<string, unknown> | undefined)?.title ?? ""),
      subtitle: String((src.hero as Record<string, unknown> | undefined)?.subtitle ?? ""),
      disclaimer: String((src.hero as Record<string, unknown> | undefined)?.disclaimer ?? ""),
    },
    proof: {
      video_url: String((src.proof as Record<string, unknown> | undefined)?.video_url ?? ""),
      review_images: Array.isArray((src.proof as Record<string, unknown> | undefined)?.review_images)
        ? ((src.proof as Record<string, unknown>).review_images as Array<Record<string, unknown>>)
        : [],
    },
    offer_strip: {
      cta_label: String((src.offer_strip as Record<string, unknown> | undefined)?.cta_label ?? ""),
      package_highlights: Array.isArray((src.offer_strip as Record<string, unknown> | undefined)?.package_highlights)
        ? ((src.offer_strip as Record<string, unknown>).package_highlights as Array<Record<string, unknown>>)
        : [],
    },
    contact: {
      call_numbers: Array.isArray((src.contact as Record<string, unknown> | undefined)?.call_numbers)
        ? ((src.contact as Record<string, unknown>).call_numbers as unknown[]).map((v) => String(v ?? ""))
        : [],
      whatsapp_numbers: Array.isArray((src.contact as Record<string, unknown> | undefined)?.whatsapp_numbers)
        ? ((src.contact as Record<string, unknown>).whatsapp_numbers as unknown[]).map((v) => String(v ?? ""))
        : [],
    },
    checkout: {
      section_title: String(checkout.section_title ?? ""),
      packages: Array.isArray(checkout.packages) ? (checkout.packages as Array<Record<string, unknown>>) : [],
      shipping_options: Array.isArray(checkout.shipping_options) ? (checkout.shipping_options as Array<Record<string, unknown>>) : [],
      upsell: {
        enabled: Boolean(upsell.enabled ?? false),
        title: String(upsell.title ?? ""),
        price: Number(upsell.price ?? 0),
        checkbox_label: String(upsell.checkbox_label ?? ""),
        description_html: String(upsell.description_html ?? ""),
        image: String(upsell.image ?? ""),
      },
      cod_confirmation_text: String(checkout.cod_confirmation_text ?? ""),
      submit_label: String(checkout.submit_label ?? "Confirm Order"),
    },
    bottom_cta: {
      text: String((src.bottom_cta as Record<string, unknown> | undefined)?.text ?? "Click to Call"),
      phone: String((src.bottom_cta as Record<string, unknown> | undefined)?.phone ?? ""),
    },
    policy: {
      privacy_url: String((src.policy as Record<string, unknown> | undefined)?.privacy_url ?? ""),
      terms_url: String((src.policy as Record<string, unknown> | undefined)?.terms_url ?? ""),
    },
    theme: {
      primary: String((src.theme as Record<string, unknown> | undefined)?.primary ?? "#0b7a2a"),
      accent: String((src.theme as Record<string, unknown> | undefined)?.accent ?? "#ff6a00"),
      button_text: String((src.theme as Record<string, unknown> | undefined)?.button_text ?? "#ffffff"),
    },
  };
}

function isLockedTemplate(template?: LandingTemplate | null): boolean {
  return template?.code === "naturiva_package_upsell"
    && template?.layout_profile === "naturiva_exact_clone_locked"
    && template?.editor_mode === "locked";
}

function buildFallbackSections(template?: LandingTemplate | null): Section[] {
  const code = template?.code ?? "generic";

  if (code === "goofi_flashcard_offer") {
    return [
      {
        id: "hero",
        type: "hero",
        enabled: true,
        order: 1,
        data: {
          hero_title: "সন্তানের শেখা আরও মজার ও স্মার্ট করুন",
          hero_subtitle: "Play-based flashcard journey with strong parent trust signals and fast checkout flow.",
          cta_text_primary: "এখনই অর্ডার করুন",
        },
      },
      {
        id: "authority",
        type: "authority",
        enabled: true,
        order: 2,
        data: {
          authority_text: "Early learning experts inspired framework",
          reach_text: "১২,০০০+ পরিবারের আস্থা",
          proof_text: "Research-informed activity cards",
        },
      },
      {
        id: "reviews",
        type: "reviews",
        enabled: true,
        order: 3,
        data: {
          review_images: [
            { title: "Parent review #1", caption: "Before/after learning confidence improvement" },
            { title: "Parent review #2", caption: "Daily engagement boosted through playful cards" },
          ],
        },
      },
      {
        id: "faq",
        type: "faq",
        enabled: true,
        order: 4,
        data: {
          faq_items: [
            { question: "ডেলিভারি কত দিনে?", answer: "ঢাকার ভিতরে ১-২ দিন, ঢাকার বাইরে ২-৪ দিন।" },
            { question: "বয়স কত হলে ব্যবহার করা যাবে?", answer: "সাধারণত ২+ থেকে শুরু করা যায়, প্যাকভেদে গাইড থাকবে।" },
          ],
        },
      },
      {
        id: "guarantees",
        type: "guarantees",
        enabled: true,
        order: 5,
        data: {
          guarantee_items: [
            "Cash on Delivery available",
            "Secure payment and order support",
            "Easy replacement support",
            "Fast nationwide delivery",
          ],
        },
      },
      { id: "cta", type: "cta", enabled: true, order: 6, data: { cta_text_primary: "চেকআউটে যান" } },
    ];
  }

  if (code === "laambd_story_checkout") {
    return [
      { id: "hook", type: "hook", enabled: true, order: 1, data: { hook_headline: "ব্যথা, অস্বস্তি, অস্থিরতা — এখনই সমাধানের পথে যান", hook_paragraph: "Story-driven emotional hook section." } },
      { id: "benefits", type: "benefits", enabled: true, order: 2, data: { benefit_points: ["সহজে ব্যবহারযোগ্য", "দৈনন্দিন রুটিনে মানানসই", "দ্রুত অর্ডার ফর্ম"] } },
      { id: "usage", type: "usage", enabled: true, order: 3, data: { usage_rules: ["প্রতিদিন নির্দিষ্ট সময়ে ব্যবহার করুন", "প্যাক নির্দেশনা অনুসরণ করুন"] } },
      { id: "packages", type: "offer_packages", enabled: true, order: 4, data: { offer_packages: [{ label: "১ মাস", price: "1290", badge: "Best Value", notes: "সবচেয়ে জনপ্রিয়" }] } },
    ];
  }

  if (code === "naturiva_package_upsell") {
    return [
      { id: "hero", type: "hero", enabled: true, order: 1, data: { hero_title: "স্মার্ট প্যাকেজ অফার", hero_subtitle: "Package-led landing with upsell potential." } },
      { id: "reviews", type: "reviews", enabled: true, order: 2, data: { reviews: [{ title: "Customer result", caption: "Real customer feedback block" }] } },
      { id: "packages", type: "packages", enabled: true, order: 3, data: { packages: [{ name: "৩০ দিনের প্যাক", price: "1590", bonus: "Free consultation" }] } },
      { id: "final_cta", type: "final_cta", enabled: true, order: 4, data: { final_cta_text: "এখনই অর্ডার নিশ্চিত করুন" } },
    ];
  }

  return [{ id: "hero", type: "hero", enabled: true, order: 1, data: { hero_title: "Landing title", hero_subtitle: "Landing subtitle" } }];
}

function sectionsFromTemplate(template?: LandingTemplate | null): Section[] {
  const rawSections = (template?.default_schema_json as { sections?: Section[] } | null)?.sections;
  return rawSections && rawSections.length > 0 ? rawSections : buildFallbackSections(template);
}

export default function LandingPageEditor({ pageId }: EditorProps) {
  const router = useRouter();
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);
  const token = getStoredToken();
  const templateSyncRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "publishing" | "archiving">("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<LandingTemplate[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [currentPage, setCurrentPage] = useState<LandingPageData | null>(null);
  const [lockedContent, setLockedContent] = useState<LockedContent | null>(null);

  const [form, setForm] = useState<FormState>({
    template_id: "",
    title: "",
    slug: "",
    meta_title: "",
    meta_description: "",
    theme_tokens_json: {
      primary_color: "#0f7c7b",
      accent_color: "#1f2937",
    },
    content_json: {
      sections: [],
      contact: { phone: "", whatsapp: "" },
      policy: { privacy_url: "", terms_url: "", return_url: "" },
    },
    products: [],
  });

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.id) === form.template_id) ?? null,
    [form.template_id, templates],
  );

  const lockedMode = useMemo(() => isLockedTemplate(selectedTemplate), [selectedTemplate]);

  const previewPage = useMemo<LandingPageData>(() => ({
    id: currentPage?.id ?? 0,
    user_id: currentPage?.user_id ?? 0,
    template_id: Number(form.template_id || 0),
    title: form.title || (locale === "bn" ? "নতুন ল্যান্ডিং পেইজ" : "New Landing Page"),
    slug: form.slug,
    status: currentPage?.status ?? "draft",
    public_url: currentPage?.public_url ?? null,
    meta_title: form.meta_title,
    meta_description: form.meta_description,
    theme_tokens_json: form.theme_tokens_json,
    content_json: (lockedMode ? (lockedContent as unknown as LandingPageData["content_json"]) : form.content_json) ?? form.content_json,
    template: selectedTemplate,
    products: form.products.map((item) => ({
      ...item,
      product: item.product ?? productOptions.find((product) => product.id === item.product_id) ?? null,
    })),
  }), [currentPage, form, locale, productOptions, selectedTemplate, lockedContent, lockedMode]);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError("Authentication token missing.");
        setLoading(false);
        return;
      }

      try {
        const [templatesRes, productsRes, pageRes] = await Promise.all([
          fetch(`${LANDING_API_BASE}/landing/templates/available`, {
            headers: buildApiHeaders(token),
          }),
          fetch(`${LANDING_API_BASE}/orders/create/bootstrap`, {
            headers: buildApiHeaders(token),
          }),
          pageId
            ? fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, {
                headers: buildApiHeaders(token),
              })
            : Promise.resolve(null),
        ]);

        const templatesResult = await readApiResponse<LandingTemplate[]>(templatesRes);
        const productsResult = await readApiResponse<{ products: ProductOption[] }>(productsRes);
        const pageResult = pageRes ? await readApiResponse<LandingPageData>(pageRes) : null;

        if (templatesResult.ok) {
          setTemplates((templatesResult.data ?? []) as LandingTemplate[]);
        } else if (templatesResult.status === 401) {
          setError("Session expired. Please login again.");
        }

        if (productsResult.ok) {
          setProductOptions((productsResult.data?.products ?? []) as ProductOption[]);
        } else if (productsResult.status === 401) {
          setError("Session expired. Please login again.");
        }

        if (pageRes && pageResult?.ok && pageResult.data) {
          const page = pageResult.data as LandingPageData;
          setCurrentPage(page);
          if (isLockedTemplate(page.template)) {
            setLockedContent(normalizeLockedContent(page.content_json));
          }
          setForm({
            template_id: String(page.template_id),
            title: page.title ?? "",
            slug: page.slug ?? "",
            meta_title: page.meta_title ?? "",
            meta_description: page.meta_description ?? "",
            theme_tokens_json: {
              primary_color: page.theme_tokens_json?.primary_color ?? "#0f7c7b",
              accent_color: page.theme_tokens_json?.accent_color ?? "#1f2937",
            },
            content_json: {
              sections: page.content_json?.sections ?? [],
              contact: {
                phone: page.content_json?.contact?.phone ?? "",
                whatsapp: page.content_json?.contact?.whatsapp ?? "",
              },
              policy: {
                privacy_url: page.content_json?.policy?.privacy_url ?? "",
                terms_url: page.content_json?.policy?.terms_url ?? "",
                return_url: page.content_json?.policy?.return_url ?? "",
              },
            },
            products: (page.products ?? []).map((item, index) => ({
              product_id: item.product_id,
              custom_title: item.custom_title ?? "",
              custom_price: item.custom_price ?? "",
              default_qty: item.default_qty ?? 1,
              display_order: item.display_order ?? index,
              is_featured: item.is_featured ?? false,
              product: item.product ?? null,
            })),
          });
          templateSyncRef.current = true;
        }
      } catch {
        setError("Failed to load landing builder data.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [pageId, token]);

  useEffect(() => {
    if (!selectedTemplate || templateSyncRef.current) {
      templateSyncRef.current = false;
      return;
    }

    if (lockedMode) {
      setLockedContent(normalizeLockedContent(selectedTemplate.default_schema_json));
      return;
    }

    setForm((prev) => ({
      ...prev,
      content_json: {
        ...prev.content_json,
        sections: sectionsFromTemplate(selectedTemplate),
      },
    }));
  }, [selectedTemplate, lockedMode]);

  const updateSection = (index: number, field: string, value: string) => {
    setForm((prev) => {
      const sections = [...prev.content_json.sections];
      sections[index] = {
        ...sections[index],
        data: {
          ...sections[index].data,
          [field]: value,
        },
      };

      return {
        ...prev,
        content_json: {
          ...prev.content_json,
          sections,
        },
      };
    });
  };

  const updateSectionJson = (index: number, field: string, value: string) => {
    setForm((prev) => {
      const sections = [...prev.content_json.sections];
      let parsed: unknown = value;

      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }

      sections[index] = {
        ...sections[index],
        data: {
          ...sections[index].data,
          [field]: parsed,
        },
      };

      return {
        ...prev,
        content_json: {
          ...prev.content_json,
          sections,
        },
      };
    });
  };

  const addProduct = () => {
    setForm((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          product_id: productOptions[0]?.id ?? 0,
          custom_title: "",
          custom_price: "",
          default_qty: 1,
          display_order: prev.products.length,
          is_featured: false,
          product: productOptions[0] ?? null,
        },
      ],
    }));
  };

  const setProductField = (index: number, field: keyof LandingPageProduct, value: unknown) => {
    setForm((prev) => {
      const items = [...prev.products];
      const next = { ...items[index], [field]: value };
      if (field === "product_id") {
        next.product = productOptions.find((product) => product.id === Number(value)) ?? null;
      }
      items[index] = next;
      return { ...prev, products: items };
    });
  };

  const removeProduct = (index: number) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const persist = async (action: "save" | "publish" | "archive") => {
    if (!token) return;
    if (!form.title || !form.template_id) {
      setError(t.fieldRequired);
      return;
    }

    setSavingState(action === "save" ? "saving" : action === "publish" ? "publishing" : "archiving");
    setError("");
    setMessage("");

    try {
      const payload = {
        template_id: Number(form.template_id),
        title: form.title,
        slug: form.slug || undefined,
        meta_title: form.meta_title || undefined,
        meta_description: form.meta_description || undefined,
        theme_tokens_json: form.theme_tokens_json,
        content_json: lockedMode ? lockedContent : form.content_json,
        products: form.products
          .filter((item) => item.product_id)
          .map((item, index) => ({
            product_id: Number(item.product_id),
            custom_title: item.custom_title || null,
            custom_price: item.custom_price === "" || item.custom_price == null ? null : Number(item.custom_price),
            default_qty: Number(item.default_qty ?? 1),
            display_order: index,
            is_featured: !!item.is_featured,
          })),
      };

      if (lockedMode && (!lockedContent || lockedContent.layout_profile !== "naturiva_exact_clone_locked")) {
        setError(t.invalidLockedJson);
        setSavingState("idle");
        return;
      }

      const baseUrl = pageId ? `${LANDING_API_BASE}/landing/pages/${pageId}` : `${LANDING_API_BASE}/landing/pages`;
      const saveRes = await fetch(baseUrl, {
        method: pageId ? "PUT" : "POST",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify(payload),
      });
      const saveResult = await readApiResponse<LandingPageData>(saveRes);

      if (!saveRes.ok) {
        setError(saveResult.status === 401 ? "Session expired. Please login again." : saveResult.message || "Request failed.");
        setSavingState("idle");
        return;
      }

      const savedPage = (saveResult.data ?? null) as LandingPageData | null;
      const effectiveId = savedPage?.id ?? pageId;
      setMessage(pageId ? t.updateSuccess : t.createSuccess);

      if (!pageId && effectiveId) {
        router.replace(`/dashboard/landing-pages/${effectiveId}/edit`);
      }

      if (action === "publish" && effectiveId) {
        const publishRes = await fetch(`${LANDING_API_BASE}/landing/pages/${effectiveId}/publish`, {
          method: "PUT",
          headers: buildApiHeaders(token),
        });
        const publishResult = await readApiResponse(publishRes);
        if (!publishRes.ok) {
          setError(publishResult.status === 401 ? "Session expired. Please login again." : publishResult.message || t.publishHint);
          setSavingState("idle");
          return;
        }
        setMessage(t.publishSuccess);
      }

      if (action === "archive" && effectiveId) {
        const archiveRes = await fetch(`${LANDING_API_BASE}/landing/pages/${effectiveId}/archive`, {
          method: "PUT",
          headers: buildApiHeaders(token),
        });
        const archiveResult = await readApiResponse(archiveRes);
        if (!archiveRes.ok) {
          setError(archiveResult.status === 401 ? "Session expired. Please login again." : archiveResult.message || "Archive failed.");
          setSavingState("idle");
          return;
        }
        setMessage(t.archiveSuccess);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingState("idle");
    }
  };

  if (loading) {
    return <div className="catv-panel p-6 text-sm text-[var(--muted)]">{t.loading}</div>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
      <section className="space-y-5">
        <article className="catv-panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{pageId ? t.updateSuccess : t.saveDraft}</h2>
            <button onClick={() => router.push("/dashboard/landing-pages")} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">
              {t.backToList}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.template}</span>
              <select
                value={form.template_id}
                onChange={(e) => setForm((prev) => ({ ...prev, template_id: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="">{t.chooseTemplate}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{getTemplateLabel(template, locale)}</option>
                ))}
              </select>
              {selectedTemplate ? <p className="mt-2 text-xs text-[var(--muted)]">{getTemplateDescription(selectedTemplate, locale)}</p> : null}
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.title}</span>
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.slug}</span>
              <input value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.metaTitle}</span>
              <input value={form.meta_title} onChange={(e) => setForm((prev) => ({ ...prev, meta_title: e.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>

            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.metaDescription}</span>
              <textarea value={form.meta_description} onChange={(e) => setForm((prev) => ({ ...prev, meta_description: e.target.value }))} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
          </div>
        </article>

        <article className="catv-panel p-5">
          <h3 className="text-base font-bold">{t.colors}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.primaryColor}</span>
              <input type="color" value={form.theme_tokens_json.primary_color} onChange={(e) => setForm((prev) => ({ ...prev, theme_tokens_json: { ...prev.theme_tokens_json, primary_color: e.target.value } }))} className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-2" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.accentColor}</span>
              <input type="color" value={form.theme_tokens_json.accent_color} onChange={(e) => setForm((prev) => ({ ...prev, theme_tokens_json: { ...prev.theme_tokens_json, accent_color: e.target.value } }))} className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-2" />
            </label>
          </div>
        </article>

        <article className="catv-panel p-5">
          <h3 className="text-base font-bold">{t.sectionContent}</h3>
          {lockedMode ? <p className="mt-2 text-xs font-semibold text-amber-600">{t.lockedLayoutHint}</p> : null}
          <div className="mt-4 space-y-4">
            {lockedMode && lockedContent ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-700">{t.lockedLayout}</p>
                  <p className="mt-1 text-xs text-amber-700">{t.lockedLayoutHint}</p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <h4 className="mb-3 text-sm font-bold">Hero</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={lockedContent.hero.title} onChange={(e) => setLockedContent((prev) => prev ? { ...prev, hero: { ...prev.hero, title: e.target.value } } : prev)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" placeholder="hero title" />
                    <input value={lockedContent.hero.subtitle} onChange={(e) => setLockedContent((prev) => prev ? { ...prev, hero: { ...prev.hero, subtitle: e.target.value } } : prev)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" placeholder="hero subtitle" />
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <h4 className="mb-3 text-sm font-bold">Packages</h4>
                  <div className="space-y-3">
                    {lockedContent.checkout.packages.map((pkg, index) => (
                      <div key={String(pkg.id ?? index)} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 md:grid-cols-4">
                        <input value={String(pkg.title ?? "")} onChange={(e) => setLockedContent((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.checkout.packages];
                          next[index] = { ...next[index], title: e.target.value };
                          return { ...prev, checkout: { ...prev.checkout, packages: next } };
                        })} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="title" />
                        <input type="number" value={Number(pkg.price ?? 0)} onChange={(e) => setLockedContent((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.checkout.packages];
                          next[index] = { ...next[index], price: Number(e.target.value) };
                          return { ...prev, checkout: { ...prev.checkout, packages: next } };
                        })} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="price" />
                        <input value={String(pkg.badge ?? "")} onChange={(e) => setLockedContent((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.checkout.packages];
                          next[index] = { ...next[index], badge: e.target.value };
                          return { ...prev, checkout: { ...prev.checkout, packages: next } };
                        })} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="badge" />
                        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                          <input type="radio" name="default_package" checked={Boolean(pkg.is_default)} onChange={() => setLockedContent((prev) => {
                            if (!prev) return prev;
                            const next = prev.checkout.packages.map((item, itemIndex) => ({ ...item, is_default: itemIndex === index }));
                            return { ...prev, checkout: { ...prev.checkout, packages: next } };
                          })} />
                          default
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <h4 className="mb-3 text-sm font-bold">Shipping + Policy</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={lockedContent.contact.call_numbers[0] ?? ""} onChange={(e) => setLockedContent((prev) => {
                      if (!prev) return prev;
                      const callNumbers = [...prev.contact.call_numbers];
                      callNumbers[0] = e.target.value;
                      return { ...prev, contact: { ...prev.contact, call_numbers: callNumbers } };
                    })} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="call number" />
                    <input value={lockedContent.contact.whatsapp_numbers[0] ?? ""} onChange={(e) => setLockedContent((prev) => {
                      if (!prev) return prev;
                      const whatsappNumbers = [...prev.contact.whatsapp_numbers];
                      whatsappNumbers[0] = e.target.value;
                      return { ...prev, contact: { ...prev.contact, whatsapp_numbers: whatsappNumbers } };
                    })} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="whatsapp number" />
                    <input value={lockedContent.policy.privacy_url} onChange={(e) => setLockedContent((prev) => prev ? { ...prev, policy: { ...prev.policy, privacy_url: e.target.value } } : prev)} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="privacy url" />
                    <input value={lockedContent.policy.terms_url} onChange={(e) => setLockedContent((prev) => prev ? { ...prev, policy: { ...prev.policy, terms_url: e.target.value } } : prev)} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="terms url" />
                    <input value={lockedContent.bottom_cta.phone} onChange={(e) => setLockedContent((prev) => prev ? { ...prev, bottom_cta: { ...prev.bottom_cta, phone: e.target.value } } : prev)} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="phone" />
                    <input type="number" value={Number(lockedContent.checkout.upsell.price ?? 0)} onChange={(e) => setLockedContent((prev) => prev ? { ...prev, checkout: { ...prev.checkout, upsell: { ...prev.checkout.upsell, price: Number(e.target.value) } } } : prev)} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="upsell price" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {lockedContent.checkout.shipping_options.map((ship, index) => (
                      <div key={String(ship.id ?? index)} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 md:grid-cols-3">
                        <input value={String(ship.label ?? "")} onChange={(e) => setLockedContent((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.checkout.shipping_options];
                          next[index] = { ...next[index], label: e.target.value };
                          return { ...prev, checkout: { ...prev.checkout, shipping_options: next } };
                        })} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="shipping label" />
                        <input type="number" value={Number(ship.fee ?? 0)} onChange={(e) => setLockedContent((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.checkout.shipping_options];
                          next[index] = { ...next[index], fee: Number(e.target.value) };
                          return { ...prev, checkout: { ...prev.checkout, shipping_options: next } };
                        })} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="fee" />
                        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                          <input type="radio" name="default_shipping" checked={Boolean(ship.is_default)} onChange={() => setLockedContent((prev) => {
                            if (!prev) return prev;
                            const next = prev.checkout.shipping_options.map((item, itemIndex) => ({ ...item, is_default: itemIndex === index }));
                            return { ...prev, checkout: { ...prev.checkout, shipping_options: next } };
                          })} />
                          default shipping
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : form.content_json.sections.map((section, sectionIndex) => (
              <div key={section.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold capitalize">{section.type.replaceAll("_", " ")}</h4>
                    <p className="text-xs text-[var(--muted)]">ID: {section.id}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={(e) => {
                        setForm((prev) => {
                          const sections = [...prev.content_json.sections];
                          sections[sectionIndex] = { ...sections[sectionIndex], enabled: e.target.checked };
                          return { ...prev, content_json: { ...prev.content_json, sections } };
                        });
                      }}
                    />
                    enabled
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(section.data).map(([key, value]) => {
                    if (Array.isArray(value) || (value && typeof value === "object")) {
                      return (
                        <label key={key} className="md:col-span-2">
                          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{key}</span>
                          <textarea
                            rows={4}
                            value={JSON.stringify(value, null, 2)}
                            onChange={(e) => updateSectionJson(sectionIndex, key, e.target.value)}
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs"
                          />
                        </label>
                      );
                    }

                    return (
                      <label key={key}>
                        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{key}</span>
                        <input value={String(value ?? "")} onChange={(e) => updateSection(sectionIndex, key, e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </article>

        {!lockedMode ? <article className="catv-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold">{t.products}</h3>
            <button onClick={addProduct} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">+ {t.addProduct}</button>
          </div>

          {form.products.length === 0 ? <p className="text-sm text-[var(--muted)]">{t.noProducts}</p> : null}

          <div className="space-y-4">
            {form.products.map((item, index) => (
              <div key={`${item.product_id}-${index}`} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.selectProduct}</span>
                  <select value={item.product_id} onChange={(e) => setProductField(index, "product_id", Number(e.target.value))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                    {productOptions.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.customTitle}</span>
                  <input value={String(item.custom_title ?? "")} onChange={(e) => setProductField(index, "custom_title", e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.customPrice}</span>
                  <input type="number" min="0" value={String(item.custom_price ?? "")} onChange={(e) => setProductField(index, "custom_price", e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.defaultQty}</span>
                  <input type="number" min="1" value={Number(item.default_qty ?? 1)} onChange={(e) => setProductField(index, "default_qty", Number(e.target.value))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
                  <input type="checkbox" checked={!!item.is_featured} onChange={(e) => setProductField(index, "is_featured", e.target.checked)} />
                  {t.featured}
                </label>
                <div className="flex items-end justify-end">
                  <button onClick={() => removeProduct(index)} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-500">{t.remove}</button>
                </div>
              </div>
            ))}
          </div>
        </article> : null}

        <article className="catv-panel p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.contactPhone}</span>
              <input value={form.content_json.contact.phone} onChange={(e) => setForm((prev) => ({ ...prev, content_json: { ...prev.content_json, contact: { ...prev.content_json.contact, phone: e.target.value } } }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.whatsapp}</span>
              <input value={form.content_json.contact.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, content_json: { ...prev.content_json, contact: { ...prev.content_json.contact, whatsapp: e.target.value } } }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.privacy}</span>
              <input value={form.content_json.policy.privacy_url} onChange={(e) => setForm((prev) => ({ ...prev, content_json: { ...prev.content_json, policy: { ...prev.content_json.policy, privacy_url: e.target.value } } }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.terms}</span>
              <input value={form.content_json.policy.terms_url} onChange={(e) => setForm((prev) => ({ ...prev, content_json: { ...prev.content_json, policy: { ...prev.content_json.policy, terms_url: e.target.value } } }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.returnUrl}</span>
              <input value={form.content_json.policy.return_url} onChange={(e) => setForm((prev) => ({ ...prev, content_json: { ...prev.content_json, policy: { ...prev.content_json.policy, return_url: e.target.value } } }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </label>
          </div>

          {error ? <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}
          {message ? <p className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">{message}</p> : null}
          <p className="mt-4 text-xs text-[var(--muted)]">{t.publishHint}</p>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button onClick={() => void persist("save")} disabled={savingState !== "idle"} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {savingState === "saving" ? t.saving : t.saveDraft}
            </button>
            <button onClick={() => void persist("publish")} disabled={savingState !== "idle"} className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {savingState === "publishing" ? t.publishing : t.publish}
            </button>
            {pageId ? (
              <button onClick={() => void persist("archive")} disabled={savingState !== "idle"} className="rounded-xl border border-amber-300 px-5 py-2 text-sm font-semibold text-amber-600 disabled:opacity-60">
                {savingState === "archiving" ? t.archived : t.archive}
              </button>
            ) : null}
          </div>
        </article>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <h3 className="text-base font-bold">{t.preview}</h3>
        <LandingRenderer page={previewPage} locale={locale} />
      </aside>
    </div>
  );
}
