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
  theme_settings?: {
    primary_color?: string | null;
    accent_color?: string | null;
    background_color?: string | null;
    text_color?: string | null;
    button_text_color?: string | null;
    font_family?: string | null;
  } | null;
  content?: {
    hero?: {
      headline?: string | null;
      subheadline?: string | null;
      cta_text?: string | null;
      background_image_url?: string | null;
      layout?: "center" | "image-right" | null;
    };
    html_sections?: Array<{ id?: string; title?: string | null; html?: string | null }>;
    carousel_images?: Array<{
      id?: string;
      title?: string | null;
      template?: string | null;
      images?: Array<{ id?: number | null; url?: string | null; alt?: string | null }>;
    }>;
    features?: Array<{ id?: string; title?: string | null; description?: string | null; icon?: string | null }>;
    features_title?: string | null;
    reviews?: Array<{ id?: string; name?: string | null; quote?: string | null; rating?: number | null; avatar_url?: string | null }>;
    faq?: Array<{ id?: string; q?: string | null; a?: string | null }>;
    rich_text_blocks?: Array<{ id?: string; title?: string | null; body?: unknown }>;
    image_text_blocks?: Array<{
      id?: string;
      image_url?: string | null;
      image_position?: "left" | "right" | null;
      heading?: string | null;
      body?: string | null;
      cta_text?: string | null;
      cta_url?: string | null;
    }>;
    trust_badges?: Array<{ id?: string; icon?: string | null; label?: string | null; sublabel?: string | null }>;
    countdown_blocks?: Array<{ id?: string; message?: string | null; end_datetime?: string | null }>;
    video_embeds?: Array<{ id?: string; title?: string | null; url?: string | null }>;
    spacers?: Array<{ id?: string; style?: "space" | "line" | "dots" | null; size?: "sm" | "md" | "lg" | null }>;
    contact?: { phone?: string | null };
    shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
    layout_order?: Array<string | { type: string; id: string }>;
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
    background_image_url?: string | null;
    layout?: "center" | "image-right" | null;
  };
  html_sections?: Array<{ id?: string; title?: string | null; html?: string | null }>;
  carousel_images?: Array<{
    id?: string;
    title?: string | null;
    template?: string | null;
    images?: Array<{ id?: number | null; url?: string | null; alt?: string | null }>;
  }>;
  features?: Array<{ id?: string; title?: string | null; description?: string | null; icon?: string | null }>;
  features_title?: string | null;
  reviews?: Array<{ id?: string; name?: string | null; quote?: string | null; rating?: number | null; avatar_url?: string | null }>;
  faq?: Array<{ id?: string; q?: string | null; a?: string | null }>;
  rich_text_blocks?: Array<{ id?: string; title?: string | null; body?: unknown }>;
  image_text_blocks?: Array<{
    id?: string;
    image_url?: string | null;
    image_position?: "left" | "right" | null;
    heading?: string | null;
    body?: string | null;
    cta_text?: string | null;
    cta_url?: string | null;
  }>;
  trust_badges?: Array<{ id?: string; icon?: string | null; label?: string | null; sublabel?: string | null }>;
  countdown_blocks?: Array<{ id?: string; message?: string | null; end_datetime?: string | null }>;
  video_embeds?: Array<{ id?: string; title?: string | null; url?: string | null }>;
  spacers?: Array<{ id?: string; style?: "space" | "line" | "dots" | null; size?: "sm" | "md" | "lg" | null }>;
  contact?: { phone?: string | null };
  shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
  layout_order?: Array<string | { type: string; id: string }>;
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

function pickArray<T>(pageValue: unknown, templateValue: unknown): T[] {
  if (Array.isArray(pageValue)) return pageValue as T[];
  if (Array.isArray(templateValue)) return templateValue as T[];
  return [];
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
    html_sections: pickArray(pageContent.html_sections, templateContent.html_sections),
    carousel_images: pickArray(pageContent.carousel_images, templateContent.carousel_images),
    features: pickArray(pageContent.features, templateContent.features),
    features_title: pageContent.features_title ?? templateContent.features_title ?? null,
    reviews: pickArray(pageContent.reviews, templateContent.reviews),
    faq: pickArray(pageContent.faq, templateContent.faq),
    rich_text_blocks: pickArray(pageContent.rich_text_blocks, templateContent.rich_text_blocks),
    image_text_blocks: pickArray(pageContent.image_text_blocks, templateContent.image_text_blocks),
    trust_badges: pickArray(pageContent.trust_badges, templateContent.trust_badges),
    countdown_blocks: pickArray(pageContent.countdown_blocks, templateContent.countdown_blocks),
    video_embeds: pickArray(pageContent.video_embeds, templateContent.video_embeds),
    spacers: pickArray(pageContent.spacers, templateContent.spacers),
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
