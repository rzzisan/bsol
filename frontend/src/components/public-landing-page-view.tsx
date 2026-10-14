"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { landingPathForSlug, mergeLandingContent, getDefaultCheckoutFields, getDefaultSettings, BD_PHONE_REGEX, type CheckoutFieldConfig, type LandingTemplate } from "@/lib/landing-pages";
import { BUTTON_RADIUS, FONT_SCALE_PERCENT, resolveFontCssVar } from "@/lib/theme-presets";
import { sanitizeHtml, CarouselBlockView, RichTextBlockView, ImageTextBlockView, TrustBadgeRow, FeatureGrid, VideoEmbedView, CountdownView, SpacerView } from "@/components/landing-blocks/block-views";
import type { LayoutEntry } from "@/lib/landing-layout";
import { BLOCK_STYLE_CSS, blockStyleProps, hasBlockStyle, readBlockStyle } from "@/lib/landing-block-style";
import { getOrCreateCheckoutSessionToken, setCheckoutSessionToken } from "@/lib/checkout-session";
import { useBsolTracking } from "@/lib/tracking";
import type { ProductOption } from "@/types/variant";

// custom_css is injected as raw text inside a <style> element (see the
// <style>{`...`}</style> block below) — it's never parsed as HTML by React,
// but a seller-supplied "</style>" substring would still end that element
// early in the browser's HTML parser and make whatever follows live markup.
// Stripping any "</style" occurrence closes that escape without touching
// legitimate CSS syntax.
function sanitizeCustomCss(css: string): string {
  return css.replace(/<\/\s*style/gi, "");
}

// Display labels for gateway_auto providers — see online_payment_context.md.
const GATEWAY_PROVIDER_LABELS: Record<string, string> = {
  sslcommerz: "SSLCommerz",
  aamarpay: "AamarPay",
  zinipay: "ZiniPay",
  shurjopay: "ShurjoPay",
  eps: "EPS",
  bkash_merchant: "bKash",
  nagad_merchant: "Nagad",
};

// Loose subset of App\Support\ProductVariantFormatter::format() — covers both
// a merchant-pinned variant (item.variant) and a customer-resolved one
// (draft.resolvedVariant), and the minimal shape reconstructed from a resumed
// abandoned-checkout snapshot.
type PublicVariantSnapshot = {
  id: number;
  sku?: string | null;
  regular_price?: string | number | null;
  selling_price?: string | number | null;
  stock_qty?: number | null;
  image_url?: string | null;
  options?: Array<{ option_value_id: number; option_name?: string | null; value: string; label?: string | null }>;
};

type CheckoutDraft = {
  enabled: boolean;
  quantity: number;
  // Set once the customer has picked a full option combination for a
  // has_variants product that wasn't pinned by the merchant.
  resolvedVariant: PublicVariantSnapshot | null;
};

type CustomerForm = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  customer_district: string;
  customer_thana: string;
  customer_area: string;
  notes: string;
};

type PublicProduct = {
  product_id: number;
  // Set when the merchant pinned one exact variant while building the page;
  // `variant` is the resolved snapshot for display (no picker shown for it).
  product_variant_id?: number | null;
  variant?: PublicVariantSnapshot | null;
  title_override?: string | null;
  subtitle?: string | null;
  badge_text?: string | null;
  price_override?: string | number | null;
  default_qty?: number | null;
  selected_by_default?: boolean | null;
  sort_order?: number | null;
  product?: {
    id: number;
    name: string;
    sku?: string | null;
    selling_price?: string | number | null;
    regular_price?: string | number | null;
    thumbnail?: string | null;
    has_variants?: boolean;
    active_variants_count?: number;
    // digital_product_context.md — external_url/file_path deliberately
    // withheld from this public payload (LandingPageController::publicShow),
    // only the type + which channels it delivers through are exposed.
    product_type?: "physical" | "digital";
    digital_delivery_channels?: string[] | null;
  } | null;
};

/** True when the customer needs to pick a variant themselves (mode 1) —
 *  the merchant attached the whole product instead of pinning one variant. */
function needsCustomerVariantPick(item: PublicProduct): boolean {
  return !item.product_variant_id && Boolean(item.product?.has_variants) && (item.product?.active_variants_count ?? 0) > 0;
}

/**
 * Unauthenticated, inline (non-modal) variant picker for the public checkout
 * — mode 1, where the merchant attached the whole product and the customer
 * chooses which combination they want. Backed by the public, page-scoped
 * options/resolve endpoints (LandingPageController::publicProductOptions /
 * publicResolveVariant), which only ever expose a product actually attached
 * to that published page.
 */
function InlineVariantPicker({ slug, productId, onResolved }: { slug: string; productId: number; onResolved: (variant: PublicVariantSnapshot | null) => void }) {
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/landing-pages/${slug}/products/${productId}/options`)
      .then((res) => res.json())
      .then((json) => setOptions(json.data ?? []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [slug, productId]);

  useEffect(() => {
    const allSelected = options.length > 0 && options.every((o) => selected[o.id] != null);
    if (!allSelected) {
      onResolved(null);
      return;
    }

    setResolving(true);
    setError("");
    fetch(`/api/public/landing-pages/${slug}/products/${productId}/variants/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_value_ids: Object.values(selected) }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (res.ok) {
          onResolved(json.data);
          setError("");
        } else {
          onResolved(null);
          setError(json.message ?? "No matching variant for this combination.");
        }
      })
      .catch(() => setError("Network error resolving variant."))
      .finally(() => setResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, options]);

  if (loading) return <p className="mt-2 text-xs text-slate-400">Loading options…</p>;
  if (options.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {options.map((option) => (
        <div key={option.id} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">{option.display_name || option.name}:</span>
          {option.values.map((val) => {
            const isChosen = selected[option.id] === val.id;
            if (option.type === "color_swatch") {
              return (
                <button
                  key={val.id}
                  type="button"
                  onClick={() => setSelected((prev) => ({ ...prev, [option.id]: val.id }))}
                  title={val.label || val.value}
                  className={`h-6 w-6 rounded-full border-2 transition ${isChosen ? "border-orange-500 scale-110" : "border-slate-300"}`}
                  style={{ backgroundColor: val.color_hex ?? "#ccc" }}
                />
              );
            }
            return (
              <button
                key={val.id}
                type="button"
                onClick={() => setSelected((prev) => ({ ...prev, [option.id]: val.id }))}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${isChosen ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}
              >
                {val.label || val.value}
              </button>
            );
          })}
        </div>
      ))}
      {resolving ? <p className="text-xs text-slate-400">Finding matching variant…</p> : null}
      {error ? <p className="text-xs text-orange-600">{error}</p> : null}
    </div>
  );
}

export type PublicLandingPage = {
  id: number;
  title: string;
  slug: string;
  public_url?: string;
  tracking?: { enabled: boolean; pixel_id: string | null } | null;
  template?: LandingTemplate | null;
  theme_settings?: {
    primary_color?: string | null;
    accent_color?: string | null;
    background_color?: string | null;
    text_color?: string | null;
    button_text_color?: string | null;
    font_family?: string | null;
    heading_font?: string | null;
    font_scale?: "sm" | "md" | "lg" | null;
    button_shape?: "rounded" | "pill" | "square" | null;
  } | null;
  content?: {
    hero?: {
      headline?: string | null;
      subheadline?: string | null;
      cta_text?: string | null;
      background_image_url?: string | null;
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
    rich_text_blocks?: Array<{ id?: string; title?: string | null; body?: JSONContent }>;
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
    contact?: { phone?: string | null; whatsapp?: string | null; floating_buttons?: boolean | null };
    shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
    settings?: { language?: "bn" | "en" | null; phone_validation_enabled?: boolean | null; phone_validation_message?: string | null } | null;
    layout_order?: Array<string | LayoutEntry>;
  } | null;
  seo_meta?: {
    meta_title?: string | null;
    meta_description?: string | null;
    og_image?: string | null;
  } | null;
  custom_css?: string | null;
  products?: PublicProduct[];
};

// wa.me needs the number in international form without "+" or spaces; a
// local Bangladeshi 01XXXXXXXXX number gets the 880 country code.
function whatsappLink(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const international = /^01\d{9}$/.test(digits) ? `88${digits}` : digits;
  return `https://wa.me/${international}`;
}

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `৳${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "৳0.00";
}

function getProductPrices(item: PublicProduct, resolvedVariant?: PublicVariantSnapshot | null) {
  const variant = item.variant ?? resolvedVariant ?? null;
  const originalPrice = Number(variant?.regular_price ?? item.product?.selling_price ?? item.product?.regular_price ?? 0);
  const currentPrice = Number(item.price_override ?? variant?.selling_price ?? originalPrice);

  return {
    originalPrice,
    currentPrice,
  };
}

// Fixed UI chrome for the public checkout page — driven by the per-page
// content.settings.language toggle, not the visitor's browser locale.
const PUBLIC_UI_TEXT = {
  bn: {
    whyChoose: "কেন এই পেজটি বেছে নেবেন?",
    faqTitle: "সাধারণ প্রশ্ন",
    selectOption: "নির্বাচন করুন",
    previewNotice: "এটি একটি প্রিভিউ — অর্ডার সাবমিট হয়নি। আসল অর্ডারে কাস্টমার Thank You পেজে যাবে।",
    orderSubmitFailed: "অর্ডার সাবমিট করা যায়নি।",
    orderSubmitNetworkError: "ইন্টারনেট সংযোগে সমস্যা হচ্ছে। আপনার নেটওয়ার্ক চেক করে আবার চেষ্টা করুন — আপনার তথ্য নিরাপদ আছে, অর্ডার এখনো সাবমিট হয়নি।",
    orderSuccess: (orderNumber: string) => `অর্ডার সফল হয়েছে। অর্ডার নম্বর: ${orderNumber}`,
    defaultCtaText: "অর্ডার করতে চাই",
    defaultProductsTitle: "আপনার পছন্দ মতো প্রোডাক্ট সিলেক্ট করুন",
    defaultProductsSubtitle: "পছন্দের product নির্বাচন করুন, quantity ঠিক করুন, তারপর নিচের shipping details পূরণ করে order complete করুন।",
    noProductsAttached: "কোনো product attach করা হয়নি।",
    shippingDetailsHint: "আপনার shipping address ও contact details দিন।",
    insideDhaka: "ঢাকার ভিতরে",
    outsideDhaka: "ঢাকার বাইরে",
    orderSummaryHint: "Order summary দেখতে অন্তত একটি product select করুন।",
    sendingOrder: "অর্ডার পাঠানো হচ্ছে...",
    selectProductToOrder: "অর্ডারের জন্য product select করুন",
    deliveryContact: "ডেলিভারি ও যোগাযোগ",
    contactLabel: "যোগাযোগ",
    noImage: "ছবি নেই",
    selectedProduct: "নির্বাচিত প্রোডাক্ট",
    originalPrice: "মূল দাম",
    productDiscount: "প্রোডাক্ট ডিসকাউন্ট",
    shippingLabel: "শিপিং",
    totalLabel: "সর্বমোট",
    paymentMethodTitle: "পেমেন্ট মেথড",
    codLabel: "ক্যাশ অন ডেলিভারি",
    codDescription: "ডেলিভারির সময় নগদে পেমেন্ট করুন।",
    payWithWallet: (provider: string) => `${provider} দিয়ে পে করুন`,
    walletInstructions: (number: string) => `অর্ডার করার পর ${number} নম্বরে টাকা পাঠান, তারপর Transaction ID সাবমিট করুন।`,
    gatewayDescription: "নিরাপদে অনলাইনে পে করুন — পেমেন্ট সম্পন্ন করতে আপনাকে রিডাইরেক্ট করা হবে।",
    privacyNotice: "আপনার ব্যক্তিগত তথ্য অর্ডার প্রসেস করতে, এই ওয়েবসাইটে আপনার অভিজ্ঞতা উন্নত করতে, এবং আমাদের প্রাইভেসি পলিসিতে বর্ণিত অন্যান্য উদ্দেশ্যে ব্যবহৃত হবে।",
    placeOrder: (amount: string) => `অর্ডার করুন ${amount}`,
  },
  en: {
    whyChoose: "Why choose this page?",
    faqTitle: "Frequently Asked Questions",
    selectOption: "Select an option",
    previewNotice: "This is a preview — no order was submitted. On the live page, customers land on the Thank You page.",
    orderSubmitFailed: "Order could not be submitted.",
    orderSubmitNetworkError: "There's a problem with your internet connection. Please check your network and try again — your details are safe, the order hasn't been submitted yet.",
    orderSuccess: (orderNumber: string) => `Order placed successfully. Order number: ${orderNumber}`,
    defaultCtaText: "I want to order",
    defaultProductsTitle: "Select your preferred products",
    defaultProductsSubtitle: "Choose your products, set the quantity, then fill in the shipping details below to complete your order.",
    noProductsAttached: "No product attached.",
    shippingDetailsHint: "Enter your shipping address and contact details.",
    insideDhaka: "Inside Dhaka",
    outsideDhaka: "Outside Dhaka",
    orderSummaryHint: "Select at least one product to see the order summary.",
    sendingOrder: "Sending order...",
    selectProductToOrder: "Select a product to order",
    deliveryContact: "Delivery & Contact",
    contactLabel: "Contact",
    noImage: "No image",
    selectedProduct: "Selected product",
    originalPrice: "Original Price",
    productDiscount: "Product Discount",
    shippingLabel: "Shipping",
    totalLabel: "TOTAL",
    paymentMethodTitle: "Payment Method",
    codLabel: "Cash on delivery",
    codDescription: "Pay with cash upon delivery.",
    payWithWallet: (provider: string) => `Pay with ${provider}`,
    walletInstructions: (number: string) => `Send money to ${number} after placing the order, then submit the Transaction ID.`,
    gatewayDescription: "Pay securely online — you'll be redirected to complete payment.",
    privacyNotice: "Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our privacy policy.",
    placeOrder: (amount: string) => `Place Order ${amount}`,
  },
} as const;

export default function PublicLandingPageView({ page, previewMode = false }: { page: PublicLandingPage; previewMode?: boolean }) {
  const router = useRouter();
  const [checkout, setCheckout] = useState<Record<number, CheckoutDraft>>(
    Object.fromEntries(
      (page.products ?? []).map((item) => [
        item.product_id,
        {
          // A whole-product attachment the customer hasn't picked a variant
          // for yet can't be pre-selected — there's nothing to add to the
          // order until they choose one.
          enabled: needsCustomerVariantPick(item) ? false : Boolean(item.selected_by_default ?? true),
          quantity: Math.max(1, Number(item.default_qty ?? 1)),
          resolvedVariant: null,
        },
      ]),
    ),
  );
  const [shippingZone, setShippingZone] = useState<"inside" | "outside">("inside");
  const [customer, setCustomer] = useState<CustomerForm>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    customer_district: "",
    customer_thana: "",
    customer_area: "",
    notes: "",
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("cod");
  // Personal-wallet "send & verify" channels the seller has turned on —
  // see online_payment_context.md. Empty until fetched; the selector only
  // ever shows COD until this resolves, so there's no flash of enabled
  // options for channels the seller hasn't actually configured.
  const [walletChannels, setWalletChannels] = useState<Array<{ provider: string; number: string }>>([]);
  // Automated merchant-gateway channels (SSLCommerz etc, Phase B/C) — a
  // separate list from walletChannels since they route to a different
  // submit flow (redirect, not a post-order claim form). See
  // online_payment_context.md.
  const [gatewayChannels, setGatewayChannels] = useState<Array<{ provider: string }>>([]);
  // Whether this specific landing page offers COD — per-page toggle,
  // defaults true until the payment-channels call resolves. See
  // online_payment_context.md.
  const [codEnabled, setCodEnabled] = useState(true);

  // previewMode covers both the editor's live-preview iframe and any other
  // non-visitor render — neither should count as a real page view or spend
  // the seller's quota (§8.3's "Pixel never on /dashboard/*" reasoning
  // extends to the preview, which renders inside the dashboard).
  const { trackInitiateCheckout, trackLead } = useBsolTracking(page, { disabled: previewMode });
  const initiateCheckoutFiredRef = useRef(false);
  const leadFiredRef = useRef(false);

  // Refs, not getElementById: in the builder the page renders inside a
  // preview iframe, where the global `document` is the dashboard's.
  const heroRef = useRef<HTMLElement>(null);
  const checkoutRef = useRef<HTMLFormElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  function scrollToCheckout() {
    checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const hero = heroRef.current;
    const checkoutForm = checkoutRef.current;
    if (!hero || !checkoutForm || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) setHeroVisible(entry.isIntersecting);
        if (entry.target === checkoutForm) setCheckoutVisible(entry.isIntersecting);
      }
    });
    observer.observe(hero);
    observer.observe(checkoutForm);
    return () => observer.disconnect();
  }, []);

  const theme = useMemo(() => ({
    primary: page?.theme_settings?.primary_color ?? "#0f766e",
    accent: page?.theme_settings?.accent_color ?? "#f97316",
    background: page?.theme_settings?.background_color ?? "#f8fafc",
    text: page?.theme_settings?.text_color ?? "#0f172a",
    buttonText: page?.theme_settings?.button_text_color ?? "#ffffff",
    fontFamily: page?.theme_settings?.font_family ?? "Hind Siliguri",
    headingFont: page?.theme_settings?.heading_font ?? null,
    fontScale: page?.theme_settings?.font_scale ?? "md",
    buttonShape: page?.theme_settings?.button_shape ?? "rounded",
  }), [page]);

  const content = mergeLandingContent(page.content, page.template);
  const hero = content.hero ?? {};
  const htmlSections = content.html_sections ?? [];
  const carouselBlocks = content.carousel_images ?? [];
  const features = content.features ?? [];
  const reviews = content.reviews ?? [];
  const faq = content.faq ?? [];
  const richTextBlocks = content.rich_text_blocks ?? [];
  const imageTextBlocks = content.image_text_blocks ?? [];
  const trustBadges = content.trust_badges ?? [];
  const countdownBlocks = content.countdown_blocks ?? [];
  const videoEmbeds = content.video_embeds ?? [];
  const spacers = content.spacers ?? [];
  const products = (page.products ?? []).filter((item) => item.product);

  const [sessionToken, setSessionToken] = useState("");
  const resumeReadyRef = useRef(previewMode); // skip capture entirely in preview mode
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SaaS attribution footer — admin-controlled, same across every merchant's
  // landing page (we're a technology provider, not the seller of record).
  const [platformSettings, setPlatformSettings] = useState<{
    credit_text_bn?: string | null;
    credit_text_en?: string | null;
    terms_link_label_bn?: string | null;
    terms_link_label_en?: string | null;
    privacy_link_label_bn?: string | null;
    privacy_link_label_en?: string | null;
  } | null>(null);
  useEffect(() => {
    fetch("/api/public/platform-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setPlatformSettings(json?.data ?? null))
      .catch(() => {});
  }, []);

  // Personal-wallet channels this seller has enabled — see
  // online_payment_context.md. Skipped in the builder preview like every
  // other network call on this page.
  useEffect(() => {
    if (previewMode) return;
    fetch(`/api/public/landing-pages/${page.slug}/payment-channels`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const channels: Array<{ provider: string; number: string }> = json?.data?.wallet_channels ?? [];
        const gateways: Array<{ provider: string }> = json?.data?.gateway_channels ?? [];
        const cod = json?.data?.cod_enabled ?? true;
        setWalletChannels(channels);
        setGatewayChannels(gateways);
        setCodEnabled(cod);
        // If this page turned COD off, the default selection can't stay on
        // an option that isn't offered — fall back to the first enabled
        // channel (wallet or gateway) instead.
        if (!cod && channels.length === 0 && gateways.length > 0) {
          setPaymentMethod(gateways[0].provider);
        } else if (!cod && channels.length > 0) {
          setPaymentMethod(channels[0].provider);
        }
      })
      .catch(() => {});
  }, [previewMode, page.slug]);

  // Resolve/adopt the checkout session token, and — if this is a resumed
  // abandoned-checkout link (?resume=<token>) — prefill the form from the
  // saved snapshot before allowing progressive capture to start again.
  useEffect(() => {
    if (previewMode) return;

    const resumeToken = new URLSearchParams(window.location.search).get("resume");
    if (!resumeToken) {
      setSessionToken(getOrCreateCheckoutSessionToken());
      resumeReadyRef.current = true;
      return;
    }

    setCheckoutSessionToken(resumeToken);
    setSessionToken(resumeToken);

    fetch(`/api/public/landing-pages/${page.slug}/abandoned-checkout/resume?token=${encodeURIComponent(resumeToken)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const d = json?.data;
        if (d) {
          setCustomer({
            customer_name: d.customer_name ?? "",
            customer_phone: d.customer_phone ?? "",
            customer_email: d.customer_email ?? "",
            customer_address: d.customer_address ?? "",
            customer_district: d.customer_district ?? "",
            customer_thana: d.customer_thana ?? "",
            customer_area: d.customer_area ?? "",
            notes: d.notes ?? "",
          });
          setCustomFieldValues(d.custom_fields ?? {});
          if (Array.isArray(d.items)) {
            setCheckout((prev) => {
              const next = { ...prev };
              for (const item of d.items as Array<{
                product_id: number;
                quantity: number;
                product_variant_id?: number | null;
                sku?: string | null;
                image?: string | null;
                unit_price?: number;
              }>) {
                // Reconstruct just enough of the variant to show a resumed
                // price/image — not the full option breakdown, so if the
                // customer wants to change it they re-open the picker.
                const resolvedVariant: PublicVariantSnapshot | null = item.product_variant_id
                  ? { id: item.product_variant_id, sku: item.sku, image_url: item.image, selling_price: item.unit_price }
                  : null;
                next[item.product_id] = { enabled: true, quantity: Math.max(1, item.quantity ?? 1), resolvedVariant };
              }
              return next;
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        resumeReadyRef.current = true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.slug]);

  // Progressive capture: once the visitor has meaningfully started the
  // checkout form (name or a partial phone number typed), debounce-save a
  // snapshot so it can be recovered later if they never submit.
  useEffect(() => {
    if (previewMode || !resumeReadyRef.current || !sessionToken) return;

    const phoneDigits = customer.customer_phone.replace(/\D/g, "");
    const hasStarted = phoneDigits.length >= 4 || customer.customer_name.trim().length >= 2;
    if (!hasStarted) return;

    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = setTimeout(() => {
      fetch(`/api/public/landing-pages/${page.slug}/abandoned-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          ...customer,
          custom_fields: customFieldValues,
          items: products.map((item) => ({
            enabled: checkout[item.product_id]?.enabled ?? false,
            product_id: item.product_id,
            product_variant_id: item.product_variant_id ?? checkout[item.product_id]?.resolvedVariant?.id ?? null,
            quantity: checkout[item.product_id]?.quantity ?? 1,
          })),
        }),
      }).catch(() => {});
    }, 1500);

    return () => {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, customFieldValues, checkout, sessionToken]);

  // InitiateCheckout on the first keystroke in any checkout field, Lead
  // specifically once the phone number becomes valid — two different
  // purchase-intent signals (tracking_capi_context.md §8.8), each fired at
  // most once per visit via the refs above.
  useEffect(() => {
    if (previewMode) return;

    if (!initiateCheckoutFiredRef.current && Object.values(customer).some((value) => value.trim() !== "")) {
      initiateCheckoutFiredRef.current = true;
      trackInitiateCheckout();
    }

    if (!leadFiredRef.current && BD_PHONE_REGEX.test(customer.customer_phone.trim())) {
      leadFiredRef.current = true;
      trackLead();
    }
  }, [customer, previewMode, trackInitiateCheckout, trackLead]);

  const shipping = content.shipping ?? {};
  const language = content.settings?.language ?? "bn";
  const t = PUBLIC_UI_TEXT[language] ?? PUBLIC_UI_TEXT.bn;
  const defaultSettings = getDefaultSettings(language);
  const checkoutFields = (content.checkout_fields && content.checkout_fields.length > 0 ? content.checkout_fields : getDefaultCheckoutFields(language)).filter((field) => field.enabled);
  const stickyCtaEnabled = content.settings?.sticky_cta_enabled ?? true;
  const floatingButtonsEnabled = content.contact?.floating_buttons ?? false;
  const floatingPhone = content.contact?.phone?.trim() || "";
  const floatingWhatsapp = whatsappLink(content.contact?.whatsapp?.trim() || floatingPhone);
  const phoneValidationEnabled = content.settings?.phone_validation_enabled ?? defaultSettings.phone_validation_enabled;
  const phoneValidationMessage = content.settings?.phone_validation_message || defaultSettings.phone_validation_message;
  const shippingCharge = shippingZone === "inside"
    ? Number(shipping.inside_dhaka ?? 80)
    : Number(shipping.outside_dhaka ?? shipping.inside_dhaka ?? 120);
  const selectedProducts = products.filter((item) => checkout[item.product_id]?.enabled);
  // digital_product_context.md §5 — mixed carts are rejected server-side
  // regardless, but gating the UI on this too means the customer never
  // even sees a COD/shipping option that would 422 at submit time.
  const isDigitalCart = selectedProducts.length > 0 && selectedProducts.every((item) => item.product?.product_type === "digital");
  // Mirrors LandingPageController::publicSubmitOrder()'s email-required
  // check exactly — only when some selected digital item lists 'email' as
  // a delivery channel, not for every digital cart.
  const digitalCartNeedsEmail = isDigitalCart && selectedProducts.some((item) => (item.product?.digital_delivery_channels ?? []).includes("email"));
  const subtotal = selectedProducts.reduce((sum, item) => {
    const quantity = checkout[item.product_id]?.quantity ?? 1;
    const price = getProductPrices(item, checkout[item.product_id]?.resolvedVariant).currentPrice;
    return sum + (price * quantity);
  }, 0);
  const originalSubtotal = selectedProducts.reduce((sum, item) => {
    const quantity = checkout[item.product_id]?.quantity ?? 1;
    return sum + (getProductPrices(item, checkout[item.product_id]?.resolvedVariant).originalPrice * quantity);
  }, 0);
  const discountTotal = Math.max(0, originalSubtotal - subtotal);
  const effectiveShippingCharge = isDigitalCart ? 0 : shippingCharge;
  const total = Math.max(0, subtotal + effectiveShippingCharge);

  // COD is hidden for a digital cart (above) — if that was still the
  // selected method (the default, or left over from switching away from a
  // physical selection), move to whatever online method is actually on offer.
  useEffect(() => {
    if (isDigitalCart && paymentMethod === "cod") {
      const fallback = walletChannels[0]?.provider ?? gatewayChannels[0]?.provider;
      if (fallback) setPaymentMethod(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDigitalCart, paymentMethod, walletChannels, gatewayChannels]);
  const defaultLayoutOrder = ["html_sections", "carousel_images", "features", "faq", "reviews", "products"];
  const layoutOrder = Array.isArray(content.layout_order) && content.layout_order.length > 0
    ? content.layout_order
    : defaultLayoutOrder;

  // The new block builder writes one layout_order entry PER ITEM (so any
  // block can be dragged relative to any other), while the old Quick Edit
  // still writes one GROUP-KEY string per section type. Normalize both into
  // runs of {type, ids}: a run of consecutive same-type item entries is
  // grouped together (so features/FAQ/reviews still render as one shared
  // grid/box when the merchant keeps them adjacent), a legacy group-key
  // string becomes a run covering every item of that type.
  type RenderRun = { blockType: string; ids: string[] | "all" };
  const renderRuns: RenderRun[] = [];
  for (const entry of layoutOrder) {
    if (typeof entry === "string") {
      renderRuns.push({ blockType: entry, ids: "all" });
      continue;
    }
    const last = renderRuns[renderRuns.length - 1];
    if (last && last.blockType === entry.type && last.ids !== "all") {
      last.ids.push(entry.id);
    } else {
      renderRuns.push({ blockType: entry.type, ids: [entry.id] });
    }
  }

  function pickRun<T extends { id?: string }>(items: T[], run: RenderRun): T[] {
    if (run.ids === "all") return items;
    const byId = new Map(items.map((item) => [item.id, item]));
    return run.ids.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
  }

  // Wraps a rendered block in its optional per-block style.
  function styled(key: string, item: unknown, node: ReactNode) {
    const style = readBlockStyle(item);
    if (!hasBlockStyle(style)) return <Fragment key={key}>{node}</Fragment>;
    const props = blockStyleProps(style);
    return <div key={key} className={props.className} style={props.style}>{node}</div>;
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();

    if (previewMode) {
      setSubmitError(null);
      setSubmitSuccess(t.previewNotice);
      scrollToCheckout();
      return;
    }

    setSubmitError(null);
    setSubmitSuccess(null);

    if (phoneValidationEnabled && !BD_PHONE_REGEX.test(customer.customer_phone.trim())) {
      setSubmitError(phoneValidationMessage);
      scrollToCheckout();
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...customer,
        custom_fields: customFieldValues,
        checkout_session_id: sessionToken || undefined,
        shipping_charge: effectiveShippingCharge,
        payment_method: paymentMethod,
        items: products.map((item) => ({
          enabled: checkout[item.product_id]?.enabled ?? false,
          product_id: item.product_id,
          product_variant_id: item.product_variant_id ?? checkout[item.product_id]?.resolvedVariant?.id ?? null,
          quantity: checkout[item.product_id]?.quantity ?? 1,
        })),
      };

      const res = await fetch(`/api/public/landing-pages/${page.slug}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = json.message || Object.values(json.errors ?? {}).flat().join(" ") || t.orderSubmitFailed;
        throw new Error(message);
      }

      if (json.data?.order_id && json.data?.public_token) {
        // A gateway_auto selection redirects to the provider's own hosted
        // checkout instead of going straight to the thank-you page — the
        // provider redirects back to our callback, which then sends the
        // browser on to thank-you itself. See online_payment_context.md.
        const isGatewayChannel = gatewayChannels.some((ch) => ch.provider === paymentMethod);
        if (isGatewayChannel) {
          const initRes = await fetch(
            `/api/public/landing-pages/${page.slug}/orders/${json.data.order_id}/online-payment/gateway/initiate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: json.data.public_token, provider: paymentMethod }),
            }
          );
          const initJson = await initRes.json().catch(() => ({}));
          if (initRes.ok && initJson.data?.redirect_url) {
            window.location.href = initJson.data.redirect_url;
            return;
          }
          // Gateway session couldn't be opened — the order still exists
          // (created above), so send the customer to thank-you anyway
          // rather than stranding them with a dead end; they can be
          // followed up on manually, same as any other unpaid order.
        }

        // The thank-you step stays on the seller's own address, where the
        // rest of the checkout already is.
        router.push(`${landingPathForSlug(page.slug)}/thank-you?order=${json.data.order_id}&token=${encodeURIComponent(json.data.public_token)}`);
        return;
      }

      // Fallback (e.g. backend not yet returning public_token): inline banner.
      setSubmitSuccess(json.message || t.orderSuccess(String(json.data?.order_number ?? "—")));
      setCustomer({
        customer_name: "",
        customer_phone: "",
        customer_email: "",
        customer_address: "",
        customer_district: "",
        customer_thana: "",
        customer_area: "",
        notes: "",
      });
      setCustomFieldValues({});
      setCheckout((prev) => Object.fromEntries(Object.entries(prev).map(([productId, item]) => [productId, { ...item, quantity: 1 }])));
      scrollToCheckout();
    } catch (err) {
      // fetch() itself (no response at all — offline, DNS failure, dropped
      // mid-request on a slow mobile connection) always rejects with a
      // TypeError; our own `throw new Error(message)` above for a real
      // (non-ok) response is a plain Error. Without this distinction a
      // flaky connection surfaced the raw browser string ("Failed to
      // fetch") to the customer, in English regardless of page language.
      // pre_launch_polish_context.md §ঘ.
      const isNetworkFailure = err instanceof TypeError;
      setSubmitError(isNetworkFailure ? t.orderSubmitNetworkError : err instanceof Error ? err.message : t.orderSubmitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function updateCustomer<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setCustomer((prev) => ({ ...prev, [key]: value }));
  }

  function updateCustomField(key: string, value: string) {
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function renderCheckoutField(field: CheckoutFieldConfig) {
    const labelText = field.required ? `${field.label} *` : field.label;
    const fieldClassName = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900";

    if (field.kind === "builtin") {
      const key = field.key as keyof CustomerForm;
      const value = customer[key] ?? "";
      const isLong = key === "customer_address" || key === "notes";
      return (
        <label key={field.key} className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">{labelText}</span>
          {isLong ? (
            <textarea required={field.required} rows={3} value={value} onChange={(e) => updateCustomer(key, e.target.value)} className={fieldClassName} />
          ) : (
            <input
              required={field.required}
              value={value}
              onChange={(e) => updateCustomer(key, e.target.value)}
              className={fieldClassName}
              {...(key === "customer_phone" ? { type: "tel", inputMode: "numeric" as const, maxLength: 11 } : {})}
            />
          )}
        </label>
      );
    }

    const value = customFieldValues[field.key] ?? "";
    return (
      <label key={field.key} className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">{labelText}</span>
        {field.type === "textarea" ? (
          <textarea required={field.required} rows={3} value={value} onChange={(e) => updateCustomField(field.key, e.target.value)} className={fieldClassName} />
        ) : field.type === "select" ? (
          <select required={field.required} value={value} onChange={(e) => updateCustomField(field.key, e.target.value)} className={fieldClassName}>
            <option value="">{t.selectOption}</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input required={field.required} value={value} onChange={(e) => updateCustomField(field.key, e.target.value)} className={fieldClassName} />
        )}
      </label>
    );
  }

  function patchCheckout(productId: number, changes: Partial<CheckoutDraft>) {
    setCheckout((prev) => ({
      ...prev,
      [productId]: {
        enabled: prev[productId]?.enabled ?? false,
        quantity: prev[productId]?.quantity ?? 1,
        resolvedVariant: prev[productId]?.resolvedVariant ?? null,
        ...changes,
      },
    }));
  }

  return (
    <main className="min-h-screen overflow-x-clip" style={{ backgroundColor: theme.background, color: theme.text }}>
      <style>{`
        .lp-shell { font-family: var(${resolveFontCssVar(theme.fontFamily)}), system-ui, -apple-system, sans-serif; }
        ${theme.headingFont ? `.lp-shell h1, .lp-shell h2, .lp-shell h3 { font-family: var(${resolveFontCssVar(theme.headingFont)}), system-ui, sans-serif; }` : ""}
        ${theme.fontScale !== "md" ? `html { font-size: ${FONT_SCALE_PERCENT[theme.fontScale]}%; }` : ""}
        .lp-btn { border-radius: ${BUTTON_RADIUS[theme.buttonShape]} !important; }
        .lp-card { background: rgba(255,255,255,0.92); border: 1px solid rgba(148,163,184,0.18); box-shadow: 0 20px 50px rgba(15,23,42,0.08); }
        .lp-html ul { padding-left: 1.25rem; list-style: disc; }
        .lp-html ol { padding-left: 1.25rem; list-style: decimal; }
        .lp-html p + p { margin-top: .75rem; }
        .lp-html li + li { margin-top: .35rem; }
        .lp-rich-text h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: .5rem; }
        .lp-rich-text a { color: ${theme.primary}; text-decoration: underline; }
        .lp-rich-text strong { font-weight: 700; }
        ${BLOCK_STYLE_CSS}
        ${sanitizeCustomCss(page.custom_css ?? "")}
      `}</style>

      <section
        ref={heroRef}
        className="lp-shell px-4 py-16 text-white"
        style={{
          background: hero.background_image_url
            ? `linear-gradient(135deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.75) 100%), url(${hero.background_image_url}) center/cover no-repeat`
            : `linear-gradient(135deg, ${theme.primary} 0%, #0b3b36 100%)`,
        }}
      >
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{hero.headline || page.title}</h1>
          {hero.subheadline ? <p className="mx-auto mt-4 max-w-3xl text-base text-white/90 sm:text-xl">{hero.subheadline}</p> : null}
          <a href="#checkout" onClick={(event) => { event.preventDefault(); scrollToCheckout(); }} className="lp-btn mt-8 inline-flex rounded-2xl px-6 py-3 text-base font-semibold shadow-lg transition hover:translate-y-[-1px]" style={{ backgroundColor: theme.accent, color: theme.buttonText }}>
            {hero.cta_text || t.defaultCtaText}
          </a>
        </div>
      </section>

      <section className="lp-shell mx-auto max-w-5xl px-4 py-10">
        <div className="space-y-6">
          {renderRuns.map((run, runIndex) => {
            const sectionKey = run.blockType;

            if (sectionKey === "html_sections") {
              return pickRun(htmlSections, run).map((section, index) => styled(`html-${section.id ?? index}`, section, (
                <div className="lp-card rounded-3xl p-6 sm:p-8">
                  {section.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{section.title}</h2> : null}
                  <div className="lp-html max-w-none text-sm leading-7 text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.html ?? "") }} />
                </div>
              )));
            }

            if (sectionKey === "carousel_images") {
              const blocks = pickRun(carouselBlocks, run);
              if (blocks.length === 0) return null;
              return blocks.map((block, blockIndex) => styled(`carousel-${block.id ?? blockIndex}`, block, (
                <CarouselBlockView block={block} theme={theme} />
              )));
            }

            if (sectionKey === "features") {
              const items = pickRun(features, run);
              return styled(`features-${runIndex}`, items[0], (
                <FeatureGrid
                  features={items}
                  title={content.features_title}
                  fallbackTitle={t.whyChoose}
                  layout={content.features_layout}
                  theme={theme}
                />
              ));
            }

            if (sectionKey === "trust_badges") {
              const items = pickRun(trustBadges, run);
              return styled(`trust-${runIndex}`, items[0], <TrustBadgeRow badges={items} layout={content.trust_badges_layout} theme={theme} />);
            }

            if (sectionKey === "rich_text_blocks") {
              return pickRun(richTextBlocks, run).map((block, index) => styled(`richtext-${block.id ?? index}`, block, (
                <RichTextBlockView block={block} theme={theme} />
              )));
            }

            if (sectionKey === "image_text_blocks") {
              return pickRun(imageTextBlocks, run).map((block, index) => styled(`imagetext-${block.id ?? index}`, block, (
                <ImageTextBlockView block={block} theme={theme} />
              )));
            }

            if (sectionKey === "video_embeds") {
              return pickRun(videoEmbeds, run).map((block, index) => styled(`video-${block.id ?? index}`, block, (
                <VideoEmbedView block={block} theme={theme} />
              )));
            }

            if (sectionKey === "countdown_blocks") {
              return pickRun(countdownBlocks, run).map((block, index) => styled(`countdown-${block.id ?? index}`, block, (
                <CountdownView block={block} theme={theme} />
              )));
            }

            if (sectionKey === "spacers") {
              return pickRun(spacers, run).map((block, index) => styled(`spacer-${block.id ?? index}`, block, (
                <SpacerView block={block} />
              )));
            }

            if (sectionKey === "faq") {
              const items = pickRun(faq, run);
              if (items.length === 0) return null;
              return styled(`faq-${runIndex}`, items[0], (
                <div className="lp-card rounded-3xl p-6 sm:p-8">
                  <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>{t.faqTitle}</h2>
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <details key={`${item.id ?? item.q ?? "faq"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-900">{item.q || `Question ${index + 1}`}</summary>
                        {item.a ? <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p> : null}
                      </details>
                    ))}
                  </div>
                </div>
              ));
            }

            if (sectionKey === "reviews") {
              const items = pickRun(reviews, run);
              if (items.length === 0) return null;
              return styled(`reviews-${runIndex}`, items[0], (
                <div className="lp-card rounded-3xl p-6 sm:p-8">
                  <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>Customer Reviews</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {items.map((review, index) => (
                      <blockquote key={`${review.id ?? review.name ?? "review"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                        {review.rating ? <div className="mb-2 text-amber-400">{"★".repeat(Math.max(0, Math.min(5, review.rating)))}<span className="text-slate-200">{"★".repeat(5 - Math.max(0, Math.min(5, review.rating)))}</span></div> : null}
                        <p className="text-sm leading-7 text-slate-700">“{review.quote || ""}”</p>
                        <footer className="mt-3 flex items-center gap-2">
                          {review.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img loading="lazy" decoding="async" src={review.avatar_url} alt={review.name ?? ""} className="h-8 w-8 rounded-full object-cover" />
                          ) : null}
                          {review.name ? <span className="text-sm font-semibold text-slate-900">— {review.name}</span> : null}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                </div>
              ));
            }

            if (sectionKey === "products") {
              return (
                <div key="products" id="products" className="lp-card rounded-3xl p-6 sm:p-8">
            <h2 className="mb-2 text-center text-2xl font-bold" style={{ color: theme.primary }}>{content.products_section_title || t.defaultProductsTitle}</h2>
            <p className="mb-6 text-center text-sm text-slate-500">{content.products_section_subtitle || t.defaultProductsSubtitle}</p>
            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{t.noProductsAttached}</div>
            ) : (
              <div className="space-y-4">
                {products.map((item) => {
                  const product = item.product!;
                  const draft = checkout[item.product_id] ?? {
                    enabled: Boolean(item.selected_by_default ?? true),
                    quantity: Math.max(1, Number(item.default_qty ?? 1)),
                    resolvedVariant: null,
                  };
                  const { originalPrice, currentPrice } = getProductPrices(item, draft.resolvedVariant);
                  const needsPick = needsCustomerVariantPick(item);
                  const activeVariant = item.variant ?? draft.resolvedVariant ?? null;
                  const thumbnail = activeVariant?.image_url || product.thumbnail;
                  // Mixed physical+digital cart is rejected server-side
                  // (digital_product_context.md §5) — block it at the
                  // checkbox too, rather than letting the customer build an
                  // invalid cart and only find out at submit.
                  const cartType = selectedProducts.find((sel) => sel.product_id !== item.product_id)?.product?.product_type;
                  const crossTypeConflict = !draft.enabled && cartType !== undefined && cartType !== product.product_type;
                  const canEnable = (!needsPick || Boolean(draft.resolvedVariant)) && !crossTypeConflict;

                  return (
                    <article key={`${item.product_id}-${item.sort_order ?? 0}`} className={`rounded-3xl border bg-white p-4 shadow-sm transition ${draft.enabled ? "border-orange-300 ring-1 ring-orange-200" : "border-orange-200"}`}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <input
                            type="checkbox"
                            checked={draft.enabled}
                            disabled={!canEnable}
                            title={crossTypeConflict ? (language === "bn" ? "ডিজিটাল ও ফিজিকাল প্রোডাক্ট একসাথে অর্ডার করা যাবে না" : "Digital and physical products can't be ordered together") : undefined}
                            onChange={(e) => patchCheckout(item.product_id, { enabled: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 accent-[var(--accent)] disabled:opacity-40"
                          />
                          {thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img loading="lazy" decoding="async" src={thumbnail} alt={item.title_override || product.name} className="h-16 w-16 rounded-2xl border border-orange-100 object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">No image</div>
                          )}
                          <div className="min-w-0 flex-1">
                            {item.badge_text ? <span className="mb-2 inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600">{item.badge_text}</span> : null}
                            <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">{item.title_override || product.name}</h3>
                            <p className="mt-1 text-xs text-slate-500">{item.subtitle || activeVariant?.sku || product.sku || "Selected product"}</p>
                            {needsPick ? (
                              <InlineVariantPicker
                                slug={page.slug}
                                productId={item.product_id}
                                onResolved={(variant) => patchCheckout(item.product_id, { resolvedVariant: variant, enabled: variant ? draft.enabled : false })}
                              />
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                          <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => patchCheckout(item.product_id, { quantity: Math.max(1, draft.quantity - 1) })}
                              className="px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                            >
                              −
                            </button>
                            <div className="min-w-10 border-x border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-900">{draft.quantity}</div>
                            <button
                              type="button"
                              onClick={() => patchCheckout(item.product_id, { quantity: Math.min(100, draft.quantity + 1) })}
                              className="px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right">
                            {originalPrice > currentPrice ? (
                              <div className="text-xs text-slate-400 line-through">{money(originalPrice)}</div>
                            ) : null}
                            <div className="text-xl font-extrabold text-orange-500">{money(currentPrice)}</div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
                </div>
              );
            }

            return null;
          })}

          <form id="checkout" ref={checkoutRef} onSubmit={submitOrder} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="lp-card rounded-3xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold" style={{ color: theme.primary }}>Shipping Details</h2>
              <p className="mt-2 text-sm text-slate-500">{t.shippingDetailsHint}</p>

              {submitError ? <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</div> : null}
              {submitSuccess ? <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitSuccess}</div> : null}

              <div className="mt-6 space-y-5">
                {isDigitalCart ? (
                  <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                    {language === "bn"
                      ? "এটি একটি ডিজিটাল প্রোডাক্ট — কোনো কুরিয়ার লাগবে না, পেমেন্ট কনফার্ম হওয়ার সাথে সাথেই ডাউনলোড লিংক পাবেন।"
                      : "This is a digital product — no courier needed, you'll get the download link as soon as payment is confirmed."}
                  </p>
                ) : null}

                {/* Address/district/thana/area are NOT force-hidden for a
                    digital cart — whether to collect them is the seller's
                    own checkout_fields configuration (they may still want
                    it, e.g. for invoicing), and hiding a field the backend
                    still marks required (CheckoutFieldResolver rules,
                    seller-side config) made the order permanently
                    unsubmittable. Only shipping/COD (irrelevant to every
                    digital order, not seller-configurable) stay gated on
                    isDigitalCart. */}
                {checkoutFields
                  .filter((field) => field.key !== "notes")
                  .map(renderCheckoutField)}

                {/* Not part of the seller-configurable checkout_fields system —
                    only needed for digital-product orders (email delivery
                    channel), but always offered since a physical order can
                    freely leave it blank. See digital_product_context.md §3. */}
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    {digitalCartNeedsEmail
                      ? (language === "bn" ? "ইমেইল *" : "Email *")
                      : (language === "bn" ? "ইমেইল (ডিজিটাল প্রোডাক্টের জন্য প্রয়োজন হতে পারে)" : "Email (may be required for digital products)")}
                  </span>
                  <input
                    type="email"
                    required={digitalCartNeedsEmail}
                    value={customer.customer_email}
                    onChange={(e) => updateCustomer("customer_email", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </label>

                {!isDigitalCart ? (
                  <div>
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Shipping</span>
                    <div className="space-y-3">
                      <label className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition ${shippingZone === "inside" ? "border-orange-300 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-700"}`}>
                        <span className="flex items-center gap-2">
                          <input type="radio" checked={shippingZone === "inside"} onChange={() => setShippingZone("inside")} />
                          {t.insideDhaka}
                        </span>
                        <strong>{money(shipping.inside_dhaka)}</strong>
                      </label>
                      <label className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition ${shippingZone === "outside" ? "border-orange-300 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-700"}`}>
                        <span className="flex items-center gap-2">
                          <input type="radio" checked={shippingZone === "outside"} onChange={() => setShippingZone("outside")} />
                          {t.outsideDhaka}
                        </span>
                        <strong>{money(shipping.outside_dhaka)}</strong>
                      </label>
                    </div>
                  </div>
                ) : null}

                {(() => {
                  const notesField = checkoutFields.find((field) => field.key === "notes");
                  return notesField ? renderCheckoutField(notesField) : null;
                })()}
              </div>
            </div>

            <div className="space-y-6">
              <div className="lp-card rounded-3xl p-6 sm:p-8">
                <h2 className="text-2xl font-bold" style={{ color: theme.primary }}>Your order</h2>
                <div className="mt-5 space-y-4">
                  {selectedProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                      {t.orderSummaryHint}
                    </div>
                  ) : (
                    selectedProducts.map((item) => {
                      const product = item.product!;
                      const draft = checkout[item.product_id];
                      const { currentPrice } = getProductPrices(item, draft?.resolvedVariant);
                      const activeVariant = item.variant ?? draft?.resolvedVariant ?? null;
                      const thumbnail = activeVariant?.image_url || product.thumbnail;
                      const quantity = draft?.quantity ?? 1;
                      return (
                        <div key={`summary-${item.product_id}`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                          {thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img loading="lazy" decoding="async" src={thumbnail} alt={item.title_override || product.name} className="h-16 w-16 rounded-2xl border border-slate-100 object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">{t.noImage}</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">{item.title_override || product.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.subtitle || activeVariant?.sku || product.sku || t.selectedProduct}</div>
                            <div className="mt-3 inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                              <button type="button" onClick={() => patchCheckout(item.product_id, { quantity: Math.max(1, quantity - 1) })} className="px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">−</button>
                              <div className="min-w-10 border-x border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-900">{quantity}</div>
                              <button type="button" onClick={() => patchCheckout(item.product_id, { quantity: Math.min(100, quantity + 1) })} className="px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">+</button>
                            </div>
                          </div>
                          <div className="text-right text-sm font-semibold text-slate-900">{money(currentPrice * quantity)}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-6 space-y-3 border-t border-dashed border-slate-200 pt-4 text-sm text-slate-600">
                  <div className="flex justify-between"><span>{t.originalPrice}</span><strong>{money(originalSubtotal)}</strong></div>
                  <div className="flex justify-between"><span>{t.productDiscount}</span><strong className="text-rose-500">-{money(discountTotal)}</strong></div>
                  {!isDigitalCart ? (
                    <div className="flex justify-between"><span>{t.shippingLabel}</span><strong>{money(effectiveShippingCharge)}</strong></div>
                  ) : null}
                  <div className="flex justify-between border-t border-slate-200 pt-3 text-base"><span className="font-semibold">{t.totalLabel}</span><strong style={{ color: theme.primary }}>{money(total)}</strong></div>
                </div>
              </div>

              <div className="lp-card rounded-3xl p-6 sm:p-8">
                <h3 className="text-lg font-bold" style={{ color: theme.primary }}>{t.paymentMethodTitle}</h3>
                <div className="mt-4 space-y-3">
                  {codEnabled && !isDigitalCart && (
                    <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${paymentMethod === "cod" ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
                      <input type="radio" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="mt-1" />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{t.codLabel}</div>
                        <div className="mt-1 text-xs text-slate-500">{t.codDescription}</div>
                      </div>
                    </label>
                  )}
                  {/* Digital products need instant, confirmed payment — COD
                      can't back that (nothing to collect cash against, and
                      today's COD-confirm path is just an OTP tap, not real
                      payment). See digital_product_context.md §4. */}
                  {isDigitalCart && walletChannels.length === 0 && gatewayChannels.length === 0 ? (
                    <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      {language === "bn"
                        ? "ডিজিটাল প্রোডাক্টের জন্য অনলাইন পেমেন্ট প্রয়োজন — এই মুহূর্তে কোনো অনলাইন পেমেন্ট মাধ্যম চালু নেই।"
                        : "Digital products require online payment — no online payment method is currently available."}
                    </p>
                  ) : null}
                  {/* Personal-wallet "send & verify" channels — only the ones
                      this seller actually turned on, from /payment-channels.
                      See online_payment_context.md. */}
                  {walletChannels.map((ch) => {
                    const providerName = ch.provider === "bkash" ? "bKash" : ch.provider === "nagad" ? "Nagad" : "Rocket";
                    const selected = paymentMethod === ch.provider;
                    return (
                      <label key={ch.provider} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${selected ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => setPaymentMethod(ch.provider)}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{t.payWithWallet(providerName)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t.walletInstructions(ch.number)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {/* Automated merchant-gateway channels — redirect flow, no
                      post-order claim form. See online_payment_context.md. */}
                  {gatewayChannels.map((ch) => {
                    const selected = paymentMethod === ch.provider;
                    return (
                      <label key={ch.provider} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${selected ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => setPaymentMethod(ch.provider)}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{GATEWAY_PROVIDER_LABELS[ch.provider] ?? ch.provider}</div>
                          <div className="mt-1 text-xs text-slate-500">{t.gatewayDescription}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <p className="mt-4 text-xs leading-6 text-slate-500">{t.privacyNotice}</p>

                <button type="submit" disabled={submitting || selectedProducts.length === 0} className="lp-btn mt-6 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: theme.accent, color: theme.buttonText }}>
                  {submitting ? t.sendingOrder : selectedProducts.length === 0 ? t.selectProductToOrder : t.placeOrder(money(total))}
                </button>
              </div>
            </div>
          </form>

          <div className="lp-card rounded-3xl p-6 sm:p-8">
            <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{t.deliveryContact}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">Inside Dhaka</div><div className="mt-2 text-2xl font-bold text-slate-900">{money(shipping.inside_dhaka)}</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">Outside Dhaka</div><div className="mt-2 text-2xl font-bold text-slate-900">{money(shipping.outside_dhaka)}</div></div>
            </div>
            {content.contact?.phone ? <p className="mt-5 text-sm text-slate-600">{t.contactLabel}: <a className="font-semibold" href={`tel:${content.contact.phone}`}>{content.contact.phone}</a></p> : null}
          </div>
        </div>
      </section>

      {platformSettings ? (
        <footer className="mx-auto max-w-4xl px-4 pb-8 pt-2 text-center text-xs leading-5 text-slate-400">
          <p>
            {(language === "bn" ? platformSettings.credit_text_bn : platformSettings.credit_text_en) || ""}
            {" "}
            <a href={`/terms?lp=${encodeURIComponent(page.slug)}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-500">
              {(language === "bn" ? platformSettings.terms_link_label_bn : platformSettings.terms_link_label_en) || (language === "bn" ? "ব্যবহারের শর্তাবলি" : "Terms of Use")}
            </a>
            {" · "}
            <a href={`/privacy?lp=${encodeURIComponent(page.slug)}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-500">
              {(language === "bn" ? platformSettings.privacy_link_label_bn : platformSettings.privacy_link_label_en) || (language === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy")}
            </a>
          </p>
        </footer>
      ) : null}

      {floatingButtonsEnabled && (floatingPhone || floatingWhatsapp) ? (
        <div className={`fixed right-4 z-40 flex flex-col gap-3 sm:bottom-6 ${stickyCtaEnabled ? "bottom-24" : "bottom-4"}`}>
          {floatingWhatsapp ? (
            <a href={floatingWhatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36A9.42 9.42 0 0 1 2.6 12.04C2.6 6.84 6.84 2.6 12.05 2.6a9.38 9.38 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.2-4.24 9.45-9.45 9.45zm8.04-17.49A11.3 11.3 0 0 0 12.04.7C5.78.7.69 5.79.69 12.04c0 2 .52 3.95 1.52 5.67L.6 23.3l5.72-1.5a11.33 11.33 0 0 0 5.72 1.46h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.31-8.02z" /></svg>
            </a>
          ) : null}
          {floatingPhone ? (
            <a href={`tel:${floatingPhone}`} aria-label={t.contactLabel} className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105" style={{ backgroundColor: theme.primary }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            </a>
          ) : null}
        </div>
      ) : null}

      {stickyCtaEnabled ? (
        <>
          {/* Keeps the footer from sitting under the bar. */}
          <div className="h-20 sm:hidden" aria-hidden="true" />
          <div
            className={`lp-shell fixed inset-x-0 bottom-0 z-40 p-3 transition-transform duration-300 sm:hidden ${heroVisible || checkoutVisible ? "translate-y-full" : "translate-y-0"}`}
            style={{ background: "linear-gradient(to top, rgba(255,255,255,0.95) 60%, rgba(255,255,255,0))" }}
          >
            <button
              type="button"
              onClick={scrollToCheckout}
              tabIndex={heroVisible || checkoutVisible ? -1 : 0}
              className="lp-btn w-full rounded-2xl px-6 py-3.5 text-base font-bold shadow-lg"
              style={{ backgroundColor: theme.accent, color: theme.buttonText }}
            >
              {hero.cta_text || t.defaultCtaText}
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}
