export const LANDING_API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

export type LandingTemplate = {
  id: number;
  code: string;
  name_bn: string;
  name_en: string;
  description?: string | null;
  preview_image?: string | null;
  default_content?: Record<string, unknown> | null;
  theme_settings?: Record<string, unknown> | null;
  schema?: Record<string, unknown> | null;
  is_active?: boolean;
  source_landing_page_id?: number | null;
  sort_order?: number;
  created_at?: string;
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
  has_variants?: boolean;
  active_variants_count?: number;
};

// Mirrors App\Support\ProductVariantFormatter::format() on the backend.
export type AttachedVariantOption = {
  option_value_id: number;
  option_id?: number | null;
  option_name?: string | null;
  option_type?: string | null;
  value: string;
  label?: string | null;
  color_hex?: string | null;
  image_url?: string | null;
};

export type AttachedVariant = {
  id: number;
  sku?: string | null;
  regular_price?: string | number | null;
  discount?: string | number | null;
  discount_type?: "amount" | "percent" | null;
  selling_price?: string | number | null;
  stock_qty?: number | null;
  image_url?: string | null;
  is_active?: boolean;
  options?: AttachedVariantOption[];
};

export type LandingPageProductInput = {
  product_id: number;
  // Set when the merchant pins one exact variant while building the page
  // (as opposed to attaching the whole product and letting the customer
  // pick a variant on the public checkout).
  product_variant_id?: number | null;
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
  admin_locked?: boolean;
  admin_lock_reason?: string | null;
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
    features_layout?: "cards" | "list" | "minimal" | null;
    products_section_title?: string | null;
    products_section_subtitle?: string | null;
    checkout_fields?: CheckoutFieldConfig[];
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
    trust_badges_layout?: "cards" | "row" | "minimal" | null;
    countdown_blocks?: Array<{ id?: string; message?: string | null; end_datetime?: string | null }>;
    video_embeds?: Array<{ id?: string; title?: string | null; url?: string | null }>;
    spacers?: Array<{ id?: string; style?: "space" | "line" | "dots" | null; size?: "sm" | "md" | "lg" | null }>;
    contact?: { phone?: string | null };
    shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
    thank_you?: ThankYouConfig | null;
    settings?: LandingPageSettings | null;
    layout_order?: Array<string | { type: string; id: string }>;
    [key: string]: unknown;
  } | null;
  seo_meta?: {
    meta_title?: string | null;
    meta_description?: string | null;
    [key: string]: unknown;
  } | null;
  custom_css?: string | null;
  products?: Array<LandingPageProductInput & { id?: number; product?: ProductItem | null; variant?: AttachedVariant | null }>;
};

// Mirrors App\Support\CheckoutFieldResolver on the backend — keep both in sync.
export type CheckoutFieldConfig = {
  id?: string;
  key: string;
  kind: "builtin" | "custom";
  label: string;
  type?: "text" | "textarea" | "select";
  required: boolean;
  enabled: boolean;
  options?: string[];
};

const CHECKOUT_FIELD_LABELS: Record<"bn" | "en", Record<string, string>> = {
  bn: {
    customer_name: "নাম",
    customer_phone: "ফোন নম্বর",
    customer_address: "ঠিকানা",
    customer_district: "জেলা",
    customer_thana: "থানা",
    customer_area: "এলাকা",
    notes: "অতিরিক্ত নোট",
  },
  en: {
    customer_name: "Name",
    customer_phone: "Phone number",
    customer_address: "Address",
    customer_district: "District",
    customer_thana: "Thana",
    customer_area: "Area",
    notes: "Additional notes",
  },
};

export function getDefaultCheckoutFields(language: "bn" | "en" = "bn"): CheckoutFieldConfig[] {
  const labels = CHECKOUT_FIELD_LABELS[language] ?? CHECKOUT_FIELD_LABELS.bn;
  return [
    { key: "customer_name", kind: "builtin", label: labels.customer_name, required: true, enabled: true },
    { key: "customer_phone", kind: "builtin", label: labels.customer_phone, required: true, enabled: true },
    { key: "customer_address", kind: "builtin", label: labels.customer_address, required: true, enabled: true },
    { key: "customer_district", kind: "builtin", label: labels.customer_district, required: false, enabled: true },
    { key: "customer_thana", kind: "builtin", label: labels.customer_thana, required: false, enabled: true },
    { key: "customer_area", kind: "builtin", label: labels.customer_area, required: false, enabled: true },
    { key: "notes", kind: "builtin", label: labels.notes, required: false, enabled: true },
  ];
}

export const DEFAULT_CHECKOUT_FIELDS: CheckoutFieldConfig[] = getDefaultCheckoutFields("bn");

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
  features_layout?: "cards" | "list" | "minimal" | null;
  products_section_title?: string | null;
  products_section_subtitle?: string | null;
  checkout_fields?: CheckoutFieldConfig[];
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
  trust_badges_layout?: "cards" | "row" | "minimal" | null;
  countdown_blocks?: Array<{ id?: string; message?: string | null; end_datetime?: string | null }>;
  video_embeds?: Array<{ id?: string; title?: string | null; url?: string | null }>;
  spacers?: Array<{ id?: string; style?: "space" | "line" | "dots" | null; size?: "sm" | "md" | "lg" | null }>;
  contact?: { phone?: string | null };
  shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
  thank_you?: ThankYouConfig | null;
  settings?: LandingPageSettings | null;
  layout_order?: Array<string | { type: string; id: string }>;
  [key: string]: unknown;
};

// Per-page toggles for optional landing-page behavior. Starts with phone
// validation; future toggles become sibling fields here.
export type LandingPageSettings = {
  language?: "bn" | "en" | null;
  phone_validation_enabled?: boolean | null;
  phone_validation_message?: string | null;
  otp_verification_enabled?: boolean | null;
  otp_verified_message?: string | null;
  otp_sms_template?: string | null;
  otp_form_title?: string | null;
  otp_form_description?: string | null;
  otp_form_button_text?: string | null;
  otp_form_resend_text?: string | null;
};

type DefaultSettingsShape = {
  phone_validation_enabled: boolean;
  phone_validation_message: string;
  otp_verification_enabled: boolean;
  otp_verified_message: string;
  otp_sms_template: string;
  otp_form_title: string;
  otp_form_description: string;
  otp_form_button_text: string;
  otp_form_resend_text: string;
};

const SETTINGS_DEFAULTS_BY_LANGUAGE: Record<"bn" | "en", DefaultSettingsShape> = {
  bn: {
    phone_validation_enabled: true,
    phone_validation_message: "সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)",
    otp_verification_enabled: false,
    otp_verified_message: "আপনার অর্ডারটি কনফার্ম করা হয়েছে!",
    otp_sms_template: "আপনার অর্ডার #{order_number} কনফার্ম করতে {otp} কোডটি লিখুন। কোডটি ৫ মিনিটের জন্য বৈধ।",
    otp_form_title: "ফোন নাম্বার ভেরিফাই করুন",
    otp_form_description: "আপনার ফোনে পাঠানো ৪ সংখ্যার কোডটি লিখে অর্ডার কনফার্ম করুন।",
    otp_form_button_text: "কনফার্ম করুন",
    otp_form_resend_text: "OTP পুনরায় পাঠান",
  },
  en: {
    phone_validation_enabled: true,
    phone_validation_message: "Enter a valid 11-digit Bangladeshi mobile number (e.g. 017XXXXXXXX)",
    otp_verification_enabled: false,
    otp_verified_message: "Your order has been confirmed!",
    otp_sms_template: "Enter code {otp} to confirm your order #{order_number}. This code is valid for 5 minutes.",
    otp_form_title: "Verify your phone number",
    otp_form_description: "Enter the 4-digit code sent to your phone to confirm your order.",
    otp_form_button_text: "Confirm",
    otp_form_resend_text: "Resend OTP",
  },
};

export function getDefaultSettings(language: "bn" | "en" = "bn"): DefaultSettingsShape {
  return SETTINGS_DEFAULTS_BY_LANGUAGE[language] ?? SETTINGS_DEFAULTS_BY_LANGUAGE.bn;
}

export const DEFAULT_SETTINGS: DefaultSettingsShape = getDefaultSettings("bn");

// Placeholders available in otp_sms_template — mirrors CheckoutOtpService::renderOtpMessage on the backend.
export const OTP_SMS_TEMPLATE_PLACEHOLDERS = ["{customer_name}", "{order_number}", "{order_total}", "{order_items}", "{otp}"] as const;

// Mirrors CheckoutFieldResolver::BD_PHONE_REGEX on the backend — keep both in sync.
export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

export type ThankYouConfig = {
  title?: string | null;
  message?: string | null;
  show_order_summary?: boolean | null;
  show_shipping_address?: boolean | null;
};

const THANK_YOU_DEFAULTS_BY_LANGUAGE: Record<"bn" | "en", ThankYouConfig> = {
  bn: {
    title: "ধন্যবাদ!",
    message: "আপনার অর্ডারটি প্লেস হয়েছে, শীঘ্রই কনফার্ম করা হবে।",
    show_order_summary: true,
    show_shipping_address: true,
  },
  en: {
    title: "Thank you!",
    message: "Your order has been placed and will be confirmed shortly.",
    show_order_summary: true,
    show_shipping_address: true,
  },
};

export function getDefaultThankYou(language: "bn" | "en" = "bn"): ThankYouConfig {
  return THANK_YOU_DEFAULTS_BY_LANGUAGE[language] ?? THANK_YOU_DEFAULTS_BY_LANGUAGE.bn;
}

export const DEFAULT_THANK_YOU = getDefaultThankYou("bn") satisfies ThankYouConfig;

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
  const checkoutFields = pickArray<CheckoutFieldConfig>(pageContent.checkout_fields, templateContent.checkout_fields);
  const language: "bn" | "en" = pageContent.settings?.language ?? templateContent.settings?.language ?? "bn";
  const defaultCheckoutFields = getDefaultCheckoutFields(language);
  const defaultThankYou = getDefaultThankYou(language);
  const defaultSettings = getDefaultSettings(language);

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
    features_layout: pageContent.features_layout ?? templateContent.features_layout ?? "cards",
    products_section_title: pageContent.products_section_title ?? templateContent.products_section_title ?? null,
    products_section_subtitle: pageContent.products_section_subtitle ?? templateContent.products_section_subtitle ?? null,
    checkout_fields: checkoutFields.length > 0 ? checkoutFields : defaultCheckoutFields,
    reviews: pickArray(pageContent.reviews, templateContent.reviews),
    faq: pickArray(pageContent.faq, templateContent.faq),
    rich_text_blocks: pickArray(pageContent.rich_text_blocks, templateContent.rich_text_blocks),
    image_text_blocks: pickArray(pageContent.image_text_blocks, templateContent.image_text_blocks),
    trust_badges: pickArray(pageContent.trust_badges, templateContent.trust_badges),
    trust_badges_layout: pageContent.trust_badges_layout ?? templateContent.trust_badges_layout ?? "cards",
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
    thank_you: {
      title: pageContent.thank_you?.title ?? templateContent.thank_you?.title ?? defaultThankYou.title,
      message: pageContent.thank_you?.message ?? templateContent.thank_you?.message ?? defaultThankYou.message,
      show_order_summary: pageContent.thank_you?.show_order_summary ?? templateContent.thank_you?.show_order_summary ?? defaultThankYou.show_order_summary,
      show_shipping_address: pageContent.thank_you?.show_shipping_address ?? templateContent.thank_you?.show_shipping_address ?? defaultThankYou.show_shipping_address,
    },
    settings: {
      language,
      phone_validation_enabled: pageContent.settings?.phone_validation_enabled ?? templateContent.settings?.phone_validation_enabled ?? defaultSettings.phone_validation_enabled,
      phone_validation_message: pageContent.settings?.phone_validation_message ?? templateContent.settings?.phone_validation_message ?? defaultSettings.phone_validation_message,
      otp_verification_enabled: pageContent.settings?.otp_verification_enabled ?? templateContent.settings?.otp_verification_enabled ?? defaultSettings.otp_verification_enabled,
      otp_verified_message: pageContent.settings?.otp_verified_message ?? templateContent.settings?.otp_verified_message ?? defaultSettings.otp_verified_message,
      otp_sms_template: pageContent.settings?.otp_sms_template ?? templateContent.settings?.otp_sms_template ?? defaultSettings.otp_sms_template,
      otp_form_title: pageContent.settings?.otp_form_title ?? templateContent.settings?.otp_form_title ?? defaultSettings.otp_form_title,
      otp_form_description: pageContent.settings?.otp_form_description ?? templateContent.settings?.otp_form_description ?? defaultSettings.otp_form_description,
      otp_form_button_text: pageContent.settings?.otp_form_button_text ?? templateContent.settings?.otp_form_button_text ?? defaultSettings.otp_form_button_text,
      otp_form_resend_text: pageContent.settings?.otp_form_resend_text ?? templateContent.settings?.otp_form_resend_text ?? defaultSettings.otp_form_resend_text,
    },
    layout_order: Array.isArray(pageContent.layout_order)
      ? pageContent.layout_order
      : Array.isArray(templateContent.layout_order)
        ? templateContent.layout_order
        : [],
  };
}

/**
 * Path to a landing page on the host the browser is currently on.
 *
 * A page is served at /{slug} on its seller's own subdomain and at
 * /lp/{slug} on the platform domain (custom_domain_context.md §14). Anything
 * rendered *inside* the public checkout flow — back links, the thank-you
 * step, the terms/privacy "home" link — has to follow the current host, or a
 * customer mid-checkout gets bounced to a URL that no longer exists.
 *
 * Dashboard/admin screens must NOT use this: they may be showing another
 * shop's page, so they read `public_url` from the API instead.
 */
export function landingPathForSlug(slug: string): string {
  if (typeof window === "undefined") return `/lp/${slug}`;

  const apex = (process.env.NEXT_PUBLIC_SUBDOMAIN_APEX ?? "zyrotechbd.com").toLowerCase();
  const host = window.location.hostname.toLowerCase();
  const onSellerSubdomain = host.endsWith(`.${apex}`) && host !== `bsol.${apex}`;

  return onSellerSubdomain ? `/${slug}` : `/lp/${slug}`;
}
