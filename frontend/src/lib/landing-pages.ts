export const LANDING_API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

export type LandingTemplate = {
  id: number;
  code: string;
  name_bn: string;
  name_en: string;
  description?: string | null;
  preview_image?: string | null;
  default_content?: Record<string, unknown> | null;
  schema?: Record<string, unknown> | null;
  sort_order?: number;
};

export type ProductItem = {
  id: number;
  name: string;
  sku?: string | null;
  selling_price?: string | number | null;
  regular_price?: string | number | null;
  stock?: number | null;
  thumbnail?: string | null;
  status?: string | null;
};

export type LandingPageProductInput = {
  product_id: number;
  title_override?: string | null;
  subtitle?: string | null;
  badge_text?: string | null;
  price_override?: string | number | null;
  default_qty?: number;
  selected_by_default?: boolean;
  sort_order?: number;
};

export type LandingPageRecord = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published" | string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  public_url?: string;
  product_count?: number;
  template?: LandingTemplate | null;
  template_id?: number | null;
  content?: {
    hero?: {
      headline?: string | null;
      subheadline?: string | null;
      cta_text?: string | null;
    };
    html_sections?: Array<{ title?: string | null; html?: string | null }>;
    carousel_images?: Array<{
      title?: string | null;
      template?: string | null;
      images?: Array<{ id?: number | null; url?: string | null; alt?: string | null }>;
    }>;
    features?: Array<{ title?: string | null; description?: string | null }>;
    reviews?: Array<{ name?: string | null; quote?: string | null }>;
    faq?: Array<{ q?: string | null; a?: string | null }>;
    contact?: { phone?: string | null };
    shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
    layout_order?: string[];
    [key: string]: unknown;
  } | null;
  seo_meta?: {
    meta_title?: string | null;
    meta_description?: string | null;
    [key: string]: unknown;
  } | null;
  custom_css?: string | null;
  products?: Array<LandingPageProductInput & { id?: number; product?: ProductItem | null }>;
};

export type LandingImportFile = string;

export type LandingPageContent = {
  hero?: {
    headline?: string | null;
    subheadline?: string | null;
    cta_text?: string | null;
  };
  html_sections?: Array<{ title?: string | null; html?: string | null }>;
  carousel_images?: Array<{
    title?: string | null;
    template?: string | null;
    images?: Array<{ id?: number | null; url?: string | null; alt?: string | null }>;
  }>;
  features?: Array<{ title?: string | null; description?: string | null }>;
  reviews?: Array<{ name?: string | null; quote?: string | null }>;
  faq?: Array<{ q?: string | null; a?: string | null }>;
  contact?: { phone?: string | null };
  shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
  layout_order?: string[];
  [key: string]: unknown;
};

export function getLandingTemplateName(template: LandingTemplate | null | undefined, locale: "bn" | "en") {
  if (!template) return locale === "bn" ? "কাস্টম" : "Custom";
  return locale === "bn" ? (template.name_bn || template.name_en || template.code) : (template.name_en || template.name_bn || template.code);
}

export function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function mergeLandingContent(
  content?: LandingPageRecord["content"] | LandingPageContent | null,
  template?: LandingTemplate | null,
): LandingPageContent {
  const templateContent = (template?.default_content ?? {}) as LandingPageContent;
  const pageContent = (content ?? {}) as LandingPageContent;

  return {
    ...templateContent,
    ...pageContent,
    hero: {
      ...(templateContent.hero ?? {}),
      ...(pageContent.hero ?? {}),
    },
    html_sections: Array.isArray(pageContent.html_sections)
      ? pageContent.html_sections
      : Array.isArray(templateContent.html_sections)
        ? templateContent.html_sections
        : [],
    carousel_images: Array.isArray(pageContent.carousel_images)
      ? pageContent.carousel_images
      : Array.isArray(templateContent.carousel_images)
        ? templateContent.carousel_images
        : [],
    features: Array.isArray(pageContent.features)
      ? pageContent.features
      : Array.isArray(templateContent.features)
        ? templateContent.features
        : [],
    reviews: Array.isArray(pageContent.reviews)
      ? pageContent.reviews
      : Array.isArray(templateContent.reviews)
        ? templateContent.reviews
        : [],
    faq: Array.isArray(pageContent.faq)
      ? pageContent.faq
      : Array.isArray(templateContent.faq)
        ? templateContent.faq
        : [],
    contact: {
      ...(templateContent.contact ?? {}),
      ...(pageContent.contact ?? {}),
    },
    shipping: {
      inside_dhaka: pageContent.shipping?.inside_dhaka ?? templateContent.shipping?.inside_dhaka ?? 80,
      outside_dhaka: pageContent.shipping?.outside_dhaka ?? templateContent.shipping?.outside_dhaka ?? 120,
    },
    layout_order: Array.isArray(pageContent.layout_order)
      ? pageContent.layout_order
      : Array.isArray(templateContent.layout_order)
        ? templateContent.layout_order
        : [],
  };
}
