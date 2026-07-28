"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { mergeLandingContent, DEFAULT_CHECKOUT_FIELDS, type CheckoutFieldConfig, type LandingTemplate } from "@/lib/landing-pages";
import { resolveFontCssVar } from "@/lib/theme-presets";
import { resolveBlockIcon } from "@/lib/block-icons";
import { renderTiptapJSON } from "@/lib/rich-text-render";
import type { LayoutEntry } from "@/lib/landing-layout";

type CheckoutDraft = {
  enabled: boolean;
  quantity: number;
};

type CustomerForm = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_district: string;
  customer_thana: string;
  customer_area: string;
  notes: string;
};

type PublicProduct = {
  product_id: number;
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
  } | null;
};

type CarouselImage = {
  id?: number | null;
  url?: string | null;
  alt?: string | null;
};

type CarouselBlock = {
  title?: string | null;
  template?: string | null;
  images?: CarouselImage[];
};

export type PublicLandingPage = {
  id: number;
  title: string;
  slug: string;
  public_url?: string;
  template?: LandingTemplate | null;
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
    countdown_blocks?: Array<{ id?: string; message?: string | null; end_datetime?: string | null }>;
    video_embeds?: Array<{ id?: string; title?: string | null; url?: string | null }>;
    spacers?: Array<{ id?: string; style?: "space" | "line" | "dots" | null; size?: "sm" | "md" | "lg" | null }>;
    contact?: { phone?: string | null };
    shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
    layout_order?: Array<string | LayoutEntry>;
  } | null;
  seo_meta?: {
    meta_title?: string | null;
    meta_description?: string | null;
  } | null;
  custom_css?: string | null;
  products?: PublicProduct[];
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `৳${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "৳0.00";
}

function getProductPrices(item: PublicProduct) {
  const originalPrice = Number(item.product?.selling_price ?? item.product?.regular_price ?? 0);
  const currentPrice = Number(item.price_override ?? originalPrice);

  return {
    originalPrice,
    currentPrice,
  };
}

function CarouselBlockView({
  block,
  theme,
}: {
  block: CarouselBlock;
  theme: {
    primary: string;
  };
}) {
  const images = (block.images ?? []).filter((img) => Boolean(img?.url?.trim()));
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length, images.map((img) => img.url).join("|")]);

  useEffect(() => {
    if (images.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;

  const template = block.template === "style-2" ? "style-2" : "style-1";
  const slideHeight = template === "style-2" ? "aspect-[4/3] sm:aspect-[16/9]" : "aspect-[4/3] sm:aspect-[16/9]";

  function goTo(index: number) {
    setActiveIndex((index + images.length) % images.length);
  }

  function getCoverflowStyle(imageIndex: number) {
    const total = images.length;
    const rawOffset = imageIndex - activeIndex;
    const offset = ((rawOffset % total) + total) % total;
    const signedOffset = offset > total / 2 ? offset - total : offset;
    const absOffset = Math.abs(signedOffset);

    if (absOffset > 2) {
      return {
        opacity: 0,
        transform: "translate3d(0, 0, -1200px) scale(0.65)",
        zIndex: 0,
        pointerEvents: "none" as const,
      };
    }

    const translateX = signedOffset * 34;
    const translateZ = absOffset === 0 ? 0 : -Math.max(120, absOffset * 120);
    const rotateY = signedOffset * -34;
    const scale = absOffset === 0 ? 1 : absOffset === 1 ? 0.93 : 0.84;
    const opacity = absOffset === 0 ? 1 : absOffset === 1 ? 0.95 : 0.75;

    return {
      opacity,
      transform: `translate3d(${translateX}%, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      zIndex: 20 - absOffset,
      pointerEvents: absOffset === 0 ? "auto" as const : "none" as const,
    };
  }

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      {block.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{block.title}</h2> : null}

      {template === "style-2" ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-6 sm:px-6 sm:py-10">
          <div className="relative mx-auto flex min-h-[15rem] w-full items-center justify-center perspective-[1600px] sm:min-h-[18rem]">
            {images.map((image, imageIndex) => {
              const isActive = imageIndex === activeIndex;
              const style = getCoverflowStyle(imageIndex);

              return (
                <button
                  key={`${image.url}-${imageIndex}`}
                  type="button"
                  onClick={() => goTo(imageIndex)}
                  aria-label={`Go to slide ${imageIndex + 1}`}
                  aria-current={isActive ? "true" : undefined}
                  className="absolute left-1/2 top-1/2 w-[88%] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out focus:outline-none sm:w-[72%]"
                  style={{
                    ...style,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div className="overflow-hidden rounded-2xl bg-slate-50 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url ?? ""}
                      alt={image.alt || `Carousel image ${imageIndex + 1}`}
                      className="h-[12rem] w-full object-contain sm:h-[22rem] sm:object-cover"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 via-transparent to-transparent" />
                </button>
              );
            })}
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-xl transition hover:bg-white"
              >
                <span className="block text-xl leading-none">‹</span>
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-xl transition hover:bg-white"
              >
                <span className="block text-xl leading-none">›</span>
              </button>
            </>
          ) : null}

          {images.length > 1 ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {images.map((image, imageIndex) => (
                <button
                  key={`${image.url}-dot-${imageIndex}`}
                  type="button"
                  aria-label={`Go to slide ${imageIndex + 1}`}
                  onClick={() => goTo(imageIndex)}
                  className={`h-2.5 rounded-full transition-all ${imageIndex === activeIndex ? "w-8 bg-slate-900" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-3 text-center text-xs text-slate-500">
            {activeIndex + 1} / {images.length}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className={`relative w-full ${slideHeight}`}>
            {images.map((image, imageIndex) => {
              const isActive = imageIndex === activeIndex;
              return (
                <div
                  key={`${image.url}-${imageIndex}`}
                  className={`absolute inset-0 transition-all duration-700 ease-out ${isActive ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"}`}
                  aria-hidden={!isActive}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url ?? ""}
                    alt={image.alt || `Carousel image ${imageIndex + 1}`}
                    className="h-full w-full object-contain sm:object-cover"
                  />
                </div>
              );
            })}
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition hover:bg-white"
              >
                <span className="block text-xl leading-none">‹</span>
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition hover:bg-white"
              >
                <span className="block text-xl leading-none">›</span>
              </button>
            </>
          ) : null}
        </div>
      )}

      {template === "style-1" && images.length > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {images.map((image, imageIndex) => (
            <button
              key={`${image.url}-dot-${imageIndex}`}
              type="button"
              aria-label={`Go to slide ${imageIndex + 1}`}
              onClick={() => goTo(imageIndex)}
              className={`h-2.5 rounded-full transition-all ${imageIndex === activeIndex ? "w-6 bg-slate-900" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
            />
          ))}
        </div>
      ) : null}

      {template === "style-1" ? (
        <div className="mt-2 text-center text-xs text-slate-500">
          {activeIndex + 1} / {images.length}
        </div>
      ) : null}
    </div>
  );
}

function RichTextBlockView({ block, theme }: { block: { title?: string | null; body?: unknown }; theme: { primary: string } }) {
  const html = useMemo(() => renderTiptapJSON(block.body as JSONContent | null | undefined), [block.body]);

  if (!block.title && !html) return null;

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      {block.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{block.title}</h2> : null}
      <div className="lp-html lp-rich-text max-w-none text-sm leading-7 text-slate-700" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function ImageTextBlockView({
  block,
  theme,
}: {
  block: { image_url?: string | null; image_position?: string | null; heading?: string | null; body?: string | null; cta_text?: string | null; cta_url?: string | null };
  theme: { primary: string; accent: string; buttonText: string };
}) {
  if (!block.image_url && !block.heading && !block.body) return null;
  const imageRight = block.image_position === "right";

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      <div className={`grid items-center gap-6 md:grid-cols-2 ${imageRight ? "" : "md:[&>*:first-child]:order-2"}`}>
        <div>
          {block.heading ? <h2 className="text-2xl font-bold" style={{ color: theme.primary }}>{block.heading}</h2> : null}
          {block.body ? <p className="mt-3 text-sm leading-7 text-slate-600">{block.body}</p> : null}
          {block.cta_text ? (
            <a href={block.cta_url || "#checkout"} className="mt-5 inline-flex rounded-2xl px-5 py-2.5 text-sm font-semibold shadow" style={{ backgroundColor: theme.accent, color: theme.buttonText }}>
              {block.cta_text}
            </a>
          ) : null}
        </div>
        {block.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.image_url} alt={block.heading || ""} className="w-full rounded-2xl object-cover" />
        ) : null}
      </div>
    </div>
  );
}

function TrustBadgeRow({ badges }: { badges: Array<{ icon?: string | null; label?: string | null; sublabel?: string | null }> }) {
  if (badges.length === 0) return null;
  return (
    <div className="lp-card grid gap-3 rounded-3xl p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
      {badges.map((badge, index) => {
        const Icon = resolveBlockIcon(badge.icon);
        return (
          <div key={`trust-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <Icon size={22} className="shrink-0 text-slate-700" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{badge.label}</div>
              {badge.sublabel ? <div className="truncate text-xs text-slate-500">{badge.sublabel}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeatureGrid({ features, title, theme }: { features: Array<{ title?: string | null; description?: string | null; icon?: string | null }>; title?: string | null; theme: { primary: string } }) {
  if (features.length === 0) return null;
  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>{title || "কেন এই পেজটি বেছে নেবেন?"}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = resolveBlockIcon(feature.icon);
          return (
            <div key={`${feature.title ?? "feature"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
              {feature.icon ? <Icon size={22} className="mb-3 text-slate-700" /> : null}
              <h3 className="text-lg font-bold text-slate-900">{feature.title || `Feature ${index + 1}`}</h3>
              {feature.description ? <p className="mt-2 text-sm text-slate-600">{feature.description}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseVideoEmbedSrc(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com") {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const match = parsed.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      return match ? `https://www.youtube.com/embed/${match[2]}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "facebook.com" || host === "fb.watch") {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`;
    }
    return null;
  } catch {
    return null;
  }
}

function VideoEmbedView({ block, theme }: { block: { title?: string | null; url?: string | null }; theme: { primary: string } }) {
  const src = block.url ? parseVideoEmbedSrc(block.url) : null;
  if (!src) return null;

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      {block.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{block.title}</h2> : null}
      <div className="aspect-video w-full overflow-hidden rounded-2xl">
        <iframe src={src} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={block.title || "Video"} />
      </div>
    </div>
  );
}

function CountdownView({ block, theme }: { block: { message?: string | null; end_datetime?: string | null }; theme: { accent: string; buttonText: string } }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!block.end_datetime || now === null) return null;
  const end = new Date(block.end_datetime).getTime();
  const remaining = Math.max(0, end - now);
  if (remaining <= 0) return null;

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);

  return (
    <div className="rounded-3xl p-5 text-center text-white sm:p-6" style={{ backgroundColor: theme.accent }}>
      {block.message ? <p className="mb-3 text-sm font-semibold sm:text-base">{block.message}</p> : null}
      <div className="flex items-center justify-center gap-3 text-white" style={{ color: theme.buttonText }}>
        {[["Days", days], ["Hours", hours], ["Min", minutes], ["Sec", seconds]].map(([label, value]) => (
          <div key={label as string} className="rounded-xl bg-black/15 px-3 py-2">
            <div className="text-xl font-bold tabular-nums sm:text-2xl">{String(value).padStart(2, "0")}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpacerView({ block }: { block: { style?: string | null; size?: string | null } }) {
  const sizeClass = block.size === "sm" ? "h-6" : block.size === "lg" ? "h-20" : "h-12";
  if (block.style === "line") {
    return <div className={`flex items-center ${sizeClass}`}><div className="w-full border-t border-slate-200" /></div>;
  }
  if (block.style === "dots") {
    return (
      <div className={`flex items-center justify-center gap-2 ${sizeClass}`}>
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-300" />)}
      </div>
    );
  }
  return <div className={sizeClass} />;
}

export default function PublicLandingPageView({ page, previewMode = false }: { page: PublicLandingPage; previewMode?: boolean }) {
  const router = useRouter();
  const [checkout, setCheckout] = useState<Record<number, CheckoutDraft>>(
    Object.fromEntries(
      (page.products ?? []).map((item) => [
        item.product_id,
        {
          enabled: Boolean(item.selected_by_default ?? true),
          quantity: Math.max(1, Number(item.default_qty ?? 1)),
        },
      ]),
    ),
  );
  const [shippingZone, setShippingZone] = useState<"inside" | "outside">("inside");
  const [customer, setCustomer] = useState<CustomerForm>({
    customer_name: "",
    customer_phone: "",
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
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "bkash" | "card">("cod");

  const theme = useMemo(() => ({
    primary: page?.theme_settings?.primary_color ?? "#0f766e",
    accent: page?.theme_settings?.accent_color ?? "#f97316",
    background: page?.theme_settings?.background_color ?? "#f8fafc",
    text: page?.theme_settings?.text_color ?? "#0f172a",
    buttonText: page?.theme_settings?.button_text_color ?? "#ffffff",
    fontFamily: page?.theme_settings?.font_family ?? "Hind Siliguri",
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
  const shipping = content.shipping ?? {};
  const checkoutFields = (content.checkout_fields && content.checkout_fields.length > 0 ? content.checkout_fields : DEFAULT_CHECKOUT_FIELDS).filter((field) => field.enabled);
  const shippingCharge = shippingZone === "inside"
    ? Number(shipping.inside_dhaka ?? 80)
    : Number(shipping.outside_dhaka ?? shipping.inside_dhaka ?? 120);
  const selectedProducts = products.filter((item) => checkout[item.product_id]?.enabled);
  const subtotal = selectedProducts.reduce((sum, item) => {
    const quantity = checkout[item.product_id]?.quantity ?? 1;
    const price = getProductPrices(item).currentPrice;
    return sum + (price * quantity);
  }, 0);
  const originalSubtotal = selectedProducts.reduce((sum, item) => {
    const quantity = checkout[item.product_id]?.quantity ?? 1;
    return sum + (getProductPrices(item).originalPrice * quantity);
  }, 0);
  const discountTotal = Math.max(0, originalSubtotal - subtotal);
  const total = Math.max(0, subtotal + shippingCharge);
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

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();

    if (previewMode) {
      setSubmitError(null);
      setSubmitSuccess("এটি একটি প্রিভিউ — অর্ডার সাবমিট হয়নি। আসল অর্ডারে কাস্টমার Thank You পেজে যাবে।");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const payload = {
        ...customer,
        custom_fields: customFieldValues,
        shipping_charge: shippingCharge,
        items: products.map((item) => ({
          enabled: checkout[item.product_id]?.enabled ?? false,
          product_id: item.product_id,
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
        const message = json.message || Object.values(json.errors ?? {}).flat().join(" ") || "অর্ডার সাবমিট করা যায়নি।";
        throw new Error(message);
      }

      if (json.data?.order_id && json.data?.public_token) {
        router.push(`/lp/${page.slug}/thank-you?order=${json.data.order_id}&token=${encodeURIComponent(json.data.public_token)}`);
        return;
      }

      // Fallback (e.g. backend not yet returning public_token): inline banner.
      setSubmitSuccess(json.message || `অর্ডার সফল হয়েছে। অর্ডার নম্বর: ${json.data?.order_number ?? "—"}`);
      setCustomer({
        customer_name: "",
        customer_phone: "",
        customer_address: "",
        customer_district: "",
        customer_thana: "",
        customer_area: "",
        notes: "",
      });
      setCustomFieldValues({});
      setCheckout((prev) => Object.fromEntries(Object.entries(prev).map(([productId, item]) => [productId, { ...item, quantity: 1 }])));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "অর্ডার সাবমিট করা যায়নি।");
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
            <input required={field.required} value={value} onChange={(e) => updateCustomer(key, e.target.value)} className={fieldClassName} />
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
            <option value="">নির্বাচন করুন</option>
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
        ...changes,
      },
    }));
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text }}>
      <style>{`
        .lp-shell { font-family: var(${resolveFontCssVar(theme.fontFamily)}), system-ui, -apple-system, sans-serif; }
        .lp-card { background: rgba(255,255,255,0.92); border: 1px solid rgba(148,163,184,0.18); box-shadow: 0 20px 50px rgba(15,23,42,0.08); }
        .lp-html ul { padding-left: 1.25rem; list-style: disc; }
        .lp-html ol { padding-left: 1.25rem; list-style: decimal; }
        .lp-html p + p { margin-top: .75rem; }
        .lp-html li + li { margin-top: .35rem; }
        .lp-rich-text h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: .5rem; }
        .lp-rich-text a { color: ${theme.primary}; text-decoration: underline; }
        .lp-rich-text strong { font-weight: 700; }
        ${page.custom_css ?? ""}
      `}</style>

      <section
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
          <a href="#checkout" className="mt-8 inline-flex rounded-2xl px-6 py-3 text-base font-semibold shadow-lg transition hover:translate-y-[-1px]" style={{ backgroundColor: theme.accent, color: theme.buttonText }}>
            {hero.cta_text || "অর্ডার করতে চাই"}
          </a>
        </div>
      </section>

      <section className="lp-shell mx-auto max-w-5xl px-4 py-10">
        <div className="space-y-6">
          {renderRuns.map((run, runIndex) => {
            const sectionKey = run.blockType;

            if (sectionKey === "html_sections") {
              return pickRun(htmlSections, run).map((section, index) => (
                <div key={`${section.id ?? section.title ?? "section"}-${index}`} className="lp-card rounded-3xl p-6 sm:p-8">
                  {section.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{section.title}</h2> : null}
                  <div className="lp-html max-w-none text-sm leading-7 text-slate-700" dangerouslySetInnerHTML={{ __html: section.html ?? "" }} />
                </div>
              ));
            }

            if (sectionKey === "carousel_images") {
              const blocks = pickRun(carouselBlocks, run);
              if (blocks.length === 0) return null;
              return blocks.map((block, blockIndex) => (
                <CarouselBlockView key={`carousel-${block.id ?? blockIndex}`} block={block} theme={theme} />
              ));
            }

            if (sectionKey === "features") {
              return <FeatureGrid key={`features-${runIndex}`} features={pickRun(features, run)} title={content.features_title} theme={theme} />;
            }

            if (sectionKey === "trust_badges") {
              return <TrustBadgeRow key={`trust-${runIndex}`} badges={pickRun(trustBadges, run)} />;
            }

            if (sectionKey === "rich_text_blocks") {
              return pickRun(richTextBlocks, run).map((block, index) => (
                <RichTextBlockView key={`richtext-${block.id ?? index}`} block={block} theme={theme} />
              ));
            }

            if (sectionKey === "image_text_blocks") {
              return pickRun(imageTextBlocks, run).map((block, index) => (
                <ImageTextBlockView key={`imagetext-${block.id ?? index}`} block={block} theme={theme} />
              ));
            }

            if (sectionKey === "video_embeds") {
              return pickRun(videoEmbeds, run).map((block, index) => (
                <VideoEmbedView key={`video-${block.id ?? index}`} block={block} theme={theme} />
              ));
            }

            if (sectionKey === "countdown_blocks") {
              return pickRun(countdownBlocks, run).map((block, index) => (
                <CountdownView key={`countdown-${block.id ?? index}`} block={block} theme={theme} />
              ));
            }

            if (sectionKey === "spacers") {
              return pickRun(spacers, run).map((block, index) => (
                <SpacerView key={`spacer-${block.id ?? index}`} block={block} />
              ));
            }

            if (sectionKey === "faq") {
              const items = pickRun(faq, run);
              if (items.length === 0) return null;
              return (
                <div key={`faq-${runIndex}`} className="lp-card rounded-3xl p-6 sm:p-8">
                  <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>সাধারণ প্রশ্ন</h2>
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <details key={`${item.id ?? item.q ?? "faq"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-900">{item.q || `Question ${index + 1}`}</summary>
                        {item.a ? <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p> : null}
                      </details>
                    ))}
                  </div>
                </div>
              );
            }

            if (sectionKey === "reviews") {
              const items = pickRun(reviews, run);
              if (items.length === 0) return null;
              return (
                <div key={`reviews-${runIndex}`} className="lp-card rounded-3xl p-6 sm:p-8">
                  <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>Customer Reviews</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {items.map((review, index) => (
                      <blockquote key={`${review.id ?? review.name ?? "review"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                        {review.rating ? <div className="mb-2 text-amber-400">{"★".repeat(Math.max(0, Math.min(5, review.rating)))}<span className="text-slate-200">{"★".repeat(5 - Math.max(0, Math.min(5, review.rating)))}</span></div> : null}
                        <p className="text-sm leading-7 text-slate-700">“{review.quote || ""}”</p>
                        <footer className="mt-3 flex items-center gap-2">
                          {review.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={review.avatar_url} alt={review.name ?? ""} className="h-8 w-8 rounded-full object-cover" />
                          ) : null}
                          {review.name ? <span className="text-sm font-semibold text-slate-900">— {review.name}</span> : null}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                </div>
              );
            }

            if (sectionKey === "products") {
              return (
                <div key="products" id="products" className="lp-card rounded-3xl p-6 sm:p-8">
            <h2 className="mb-2 text-center text-2xl font-bold" style={{ color: theme.primary }}>{content.products_section_title || "আপনার পছন্দ মতো প্রোডাক্ট সিলেক্ট করুন"}</h2>
            <p className="mb-6 text-center text-sm text-slate-500">{content.products_section_subtitle || "পছন্দের product নির্বাচন করুন, quantity ঠিক করুন, তারপর নিচের shipping details পূরণ করে order complete করুন।"}</p>
            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">কোনো product attach করা হয়নি।</div>
            ) : (
              <div className="space-y-4">
                {products.map((item) => {
                  const product = item.product!;
                  const { originalPrice, currentPrice } = getProductPrices(item);
                  const draft = checkout[item.product_id] ?? {
                    enabled: Boolean(item.selected_by_default ?? true),
                    quantity: Math.max(1, Number(item.default_qty ?? 1)),
                  };

                  return (
                    <article key={`${item.product_id}-${item.sort_order ?? 0}`} className={`rounded-3xl border bg-white p-4 shadow-sm transition ${draft.enabled ? "border-orange-300 ring-1 ring-orange-200" : "border-orange-200"}`}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <input
                            type="checkbox"
                            checked={draft.enabled}
                            onChange={(e) => patchCheckout(item.product_id, { enabled: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 accent-[var(--accent)]"
                          />
                          {product.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.thumbnail} alt={item.title_override || product.name} className="h-16 w-16 rounded-2xl border border-orange-100 object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">No image</div>
                          )}
                          <div className="min-w-0">
                            {item.badge_text ? <span className="mb-2 inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600">{item.badge_text}</span> : null}
                            <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">{item.title_override || product.name}</h3>
                            <p className="mt-1 text-xs text-slate-500">{item.subtitle || product.sku || "Selected product"}</p>
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

          <form id="checkout" onSubmit={submitOrder} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="lp-card rounded-3xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold" style={{ color: theme.primary }}>Shipping Details</h2>
              <p className="mt-2 text-sm text-slate-500">আপনার shipping address ও contact details দিন।</p>

              {submitError ? <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</div> : null}
              {submitSuccess ? <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitSuccess}</div> : null}

              <div className="mt-6 space-y-5">
                {checkoutFields.filter((field) => field.key !== "notes").map(renderCheckoutField)}

                <div>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Shipping</span>
                  <div className="space-y-3">
                    <label className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition ${shippingZone === "inside" ? "border-orange-300 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-700"}`}>
                      <span className="flex items-center gap-2">
                        <input type="radio" checked={shippingZone === "inside"} onChange={() => setShippingZone("inside")} />
                        ঢাকার ভিতরে
                      </span>
                      <strong>{money(shipping.inside_dhaka)}</strong>
                    </label>
                    <label className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition ${shippingZone === "outside" ? "border-orange-300 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-700"}`}>
                      <span className="flex items-center gap-2">
                        <input type="radio" checked={shippingZone === "outside"} onChange={() => setShippingZone("outside")} />
                        ঢাকার বাইরে
                      </span>
                      <strong>{money(shipping.outside_dhaka)}</strong>
                    </label>
                  </div>
                </div>

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
                      Order summary দেখতে অন্তত একটি product select করুন।
                    </div>
                  ) : (
                    selectedProducts.map((item) => {
                      const product = item.product!;
                      const { currentPrice } = getProductPrices(item);
                      const quantity = checkout[item.product_id]?.quantity ?? 1;
                      return (
                        <div key={`summary-${item.product_id}`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                          {product.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.thumbnail} alt={item.title_override || product.name} className="h-16 w-16 rounded-2xl border border-slate-100 object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">No image</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">{item.title_override || product.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.subtitle || product.sku || "Selected product"}</div>
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
                  <div className="flex justify-between"><span>Original Price</span><strong>{money(originalSubtotal)}</strong></div>
                  <div className="flex justify-between"><span>Product Discount</span><strong className="text-rose-500">-{money(discountTotal)}</strong></div>
                  <div className="flex justify-between"><span>Shipping</span><strong>{money(shippingCharge)}</strong></div>
                  <div className="flex justify-between border-t border-slate-200 pt-3 text-base"><span className="font-semibold">TOTAL</span><strong style={{ color: theme.primary }}>{money(total)}</strong></div>
                </div>
              </div>

              <div className="lp-card rounded-3xl p-6 sm:p-8">
                <h3 className="text-lg font-bold" style={{ color: theme.primary }}>Payment Method</h3>
                <div className="mt-4 space-y-3">
                  <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${paymentMethod === "cod" ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
                    <input type="radio" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="mt-1" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Cash on delivery</div>
                      <div className="mt-1 text-xs text-slate-500">Pay with cash upon delivery.</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-60">
                    <input type="radio" disabled />
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Pay with bKash</div>
                      <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-60">
                    <input type="radio" disabled />
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Card / Mobile Banking</div>
                      <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                    </div>
                  </label>
                </div>

                <p className="mt-4 text-xs leading-6 text-slate-500">Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our privacy policy.</p>

                <button type="submit" disabled={submitting || selectedProducts.length === 0} className="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: theme.accent, color: theme.buttonText }}>
                  {submitting ? "অর্ডার পাঠানো হচ্ছে..." : selectedProducts.length === 0 ? "অর্ডারের জন্য product select করুন" : `Place Order ${money(total)}`}
                </button>
              </div>
            </div>
          </form>

          <div className="lp-card rounded-3xl p-6 sm:p-8">
            <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>ডেলিভারি ও যোগাযোগ</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">Inside Dhaka</div><div className="mt-2 text-2xl font-bold text-slate-900">{money(shipping.inside_dhaka)}</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">Outside Dhaka</div><div className="mt-2 text-2xl font-bold text-slate-900">{money(shipping.outside_dhaka)}</div></div>
            </div>
            {content.contact?.phone ? <p className="mt-5 text-sm text-slate-600">যোগাযোগ: <a className="font-semibold" href={`tel:${content.contact.phone}`}>{content.contact.phone}</a></p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
