export const LANDING_API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

export function buildApiHeaders(token?: string | null, includeJsonContentType = false): HeadersInit {
  return {
    Accept: "application/json",
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function readApiResponse<T = unknown>(response: Response): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  message: string;
}> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = (await response.json()) as { data?: T; message?: string } & T;
    const nestedData = typeof json === "object" && json !== null && "data" in json ? (json.data ?? null) : null;
    const message = (typeof json === "object" && json !== null && "message" in json && typeof json.message === "string")
      ? json.message
      : response.ok
        ? "OK"
        : response.status === 401
          ? "Unauthenticated."
          : "Request failed.";

    return {
      ok: response.ok,
      status: response.status,
      data: (nestedData ?? json ?? null) as T | null,
      message,
    };
  }

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    data: null,
    message: text || (response.status === 401 ? "Unauthenticated." : "Request failed."),
  };
}

export type LandingTemplate = {
  id: number;
  code: string;
  name_bn: string;
  name_en: string;
  description_bn: string | null;
  description_en: string | null;
  thumbnail_url: string | null;
  category: string;
  default_schema_json: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  access_rules?: LandingTemplateAccessRule[];
};

export type LandingTemplateAccessRule = {
  id: number;
  template_id: number;
  package_id: number | null;
  is_enabled: boolean;
  template?: LandingTemplate;
  package?: {
    id: number;
    name: string;
    slug: string;
    is_active: boolean;
  } | null;
};

export type LandingPageProduct = {
  id?: number;
  product_id: number;
  custom_title?: string | null;
  custom_price?: number | string | null;
  default_qty?: number;
  display_order?: number;
  is_featured?: boolean;
  product?: {
    id: number;
    name: string;
    selling_price: string | number;
    thumbnail?: string | null;
    status?: string;
  } | null;
};

export type LandingPageData = {
  id: number;
  user_id: number;
  template_id: number;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  public_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  theme_tokens_json?: {
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    font_family?: string;
  } | null;
  content_json?: {
    sections?: Array<{
      id: string;
      type: string;
      enabled: boolean;
      order: number;
      data: Record<string, unknown>;
    }>;
    theme?: Record<string, unknown>;
    contact?: {
      phone?: string;
      whatsapp?: string;
    };
    policy?: {
      privacy_url?: string;
      terms_url?: string;
      return_url?: string;
    };
  } | null;
  template?: LandingTemplate | null;
  products?: LandingPageProduct[];
  published_at?: string | null;
};

export type LandingAnalyticsRow = {
  id: number;
  view_date: string;
  total_views: number;
  unique_visitors: number;
  cta_clicks: number;
  checkout_starts: number;
  orders_completed: number;
  revenue: number | string;
};

export type ProductOption = {
  id: number;
  name: string;
  selling_price: string | number;
  thumbnail?: string | null;
  sku?: string | null;
  status?: string;
};

export function getTemplateLabel(template: LandingTemplate, locale: "bn" | "en") {
  return locale === "bn" ? template.name_bn : template.name_en;
}

export function getTemplateDescription(template: LandingTemplate, locale: "bn" | "en") {
  return locale === "bn" ? (template.description_bn ?? "") : (template.description_en ?? "");
}
