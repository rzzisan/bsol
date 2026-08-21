/**
 * Shared types + fetch helpers for the public storefront (/store/*).
 * seller_storefront_context.md §12 (S4/S6). All calls are relative
 * (/api/public/storefront/...) — same-origin on the seller's own
 * subdomain, exactly like the public landing-page checkout components.
 */

// Deliberately NOT NEXT_PUBLIC_API_BASE_URL (that's absolute, pinned to
// bsol.<apex> — see custom_domain_context.md §11.4). Storefront pages must
// always resolve against the CURRENT seller host, so client-side calls stay
// relative, matching the public landing-page checkout components
// (components/public-landing-page-view.tsx uses plain `/api/...` too). An
// absolute call here would hit the platform host, which LandingPageResolver
// explicitly treats as "no shop" — every one of these would silently 404.
const API = "/api";

export type CategorySummary = { id: number; name: string; slug: string; product_count?: number };

export type ProductSummary = {
  id: number;
  slug: string;
  name: string;
  thumbnail: string | null;
  regular_price: string | number;
  discount: string | number;
  discount_type: "amount" | "percent";
  selling_price: string | number;
  in_stock: boolean;
  is_featured: boolean;
  product_type: "physical" | "digital" | null;
  category: { id: number; name: string; slug: string } | null;
};

export type SpecGroup = { group: string; items: Array<{ label: string; value: string }> };

export type VariantOption = {
  option_name: string | null;
  option_type: string | null;
  value: string | null;
  label: string | null;
  color_hex: string | null;
};

export type ProductVariantPublic = {
  id: number;
  sku: string | null;
  regular_price: string | number;
  discount: string | number;
  discount_type: "amount" | "percent";
  selling_price: string | number;
  in_stock: boolean;
  image_url: string | null;
  options: VariantOption[];
};

export type ProductDetail = ProductSummary & {
  sku: string | null;
  description: string;
  features: string[];
  specifications: SpecGroup[];
  seo_content: string | null;
  warranty_text: string | null;
  delivery_text: string | null;
  images: Array<{ id: number; url: string }>;
  variants: ProductVariantPublic[];
  rating: { average: number; count: number };
  related_products: ProductSummary[];
};

export type StorefrontHome = {
  shop_name: string | null;
  logo_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  show_call_button: boolean;
  show_whatsapp_button: boolean;
  show_messenger_button: boolean;
  messenger_page_id: string | null;
  theme_primary_color: string | null;
  banner_images: Array<{ image_url: string; link_url?: string | null }>;
  about_text: string | null;
  about_image_url: string | null;
  partner_logos: Array<{ image_url: string; link_url?: string | null }>;
  featured_categories: CategorySummary[];
  featured_products: ProductSummary[];
};

export function money(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `৳${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "৳0.00";
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.data) return null;
    return json.data as T;
  } catch {
    return null;
  }
}

// Server-side (build/request-time) fetches need an absolute same-origin URL
// — mirrors frontend/src/app/lp/[slug]/page.tsx's getBaseUrl()/fetch pattern.
async function getJsonServer<T>(baseUrl: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${baseUrl}/api${path}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.data) return null;
    return json.data as T;
  } catch {
    return null;
  }
}

export function fetchHome(baseUrl: string) {
  return getJsonServer<StorefrontHome>(baseUrl, "/public/storefront/home");
}

export function fetchCategories(baseUrl: string) {
  return getJsonServer<CategorySummary[]>(baseUrl, "/public/storefront/categories");
}

export function fetchProductDetail(baseUrl: string, slug: string) {
  return getJsonServer<ProductDetail>(baseUrl, `/public/storefront/products/${encodeURIComponent(slug)}`);
}

export type ProductListResult = { data: ProductSummary[]; meta: { total: number; current_page: number; last_page: number; per_page: number } } | null;

export async function fetchProductsServer(
  baseUrl: string,
  params: { category?: string; q?: string; sort?: string; page?: number },
): Promise<ProductListResult> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page) qs.set("page", String(params.page));

  try {
    const res = await fetch(`${baseUrl}/api/public/storefront/products?${qs.toString()}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return { data: json.data ?? [], meta: json.meta };
  } catch {
    return null;
  }
}

// Client-side (browser) variant of the same call, used by the search page's
// interactive filter/sort controls.
export async function fetchProductsClient(params: { category?: string; q?: string; sort?: string; page?: number }): Promise<ProductListResult> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page) qs.set("page", String(params.page));

  try {
    const res = await fetch(`${API}/public/storefront/products?${qs.toString()}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return { data: json.data ?? [], meta: json.meta };
  } catch {
    return null;
  }
}

export function fetchCategoriesClient() {
  return getJson<CategorySummary[]>("/public/storefront/categories");
}

// ── Checkout (S3, COD-only — see StorefrontCheckoutController) ──

export type CheckoutOrderResult = {
  order_number: string;
  public_token: string;
  subtotal: number | string;
  shipping_charge: number | string;
  total: number | string;
};

export type CheckoutPayload = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_district?: string;
  customer_thana?: string;
  customer_area?: string;
  customer_email?: string;
  notes?: string;
  items: Array<{ product_id: number; quantity: number; product_variant_id?: number }>;
};

export async function submitCheckout(
  payload: CheckoutPayload,
): Promise<{ ok: true; data: CheckoutOrderResult } | { ok: false; message: string; errors?: Record<string, string[]> }> {
  try {
    const res = await fetch(`${API}/public/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, message: json?.message ?? "Checkout failed.", errors: json?.errors };
    }

    return { ok: true, data: json.data as CheckoutOrderResult };
  } catch {
    return { ok: false, message: "Checkout failed — please try again." };
  }
}

export type StorefrontOrder = {
  order_number: string;
  created_at: string;
  status: string;
  payment_method: string;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  subtotal: number | string;
  shipping_charge: number | string;
  discount: number | string;
  total: number | string;
  items: Array<{ product_name: string; quantity: number; unit_price: number | string; total: number | string }>;
};

export function fetchOrderClient(token: string) {
  return getJson<StorefrontOrder>(`/public/storefront/orders/${encodeURIComponent(token)}`);
}

export function fetchOrderServer(baseUrl: string, token: string) {
  return getJsonServer<StorefrontOrder>(baseUrl, `/public/storefront/orders/${encodeURIComponent(token)}`);
}
