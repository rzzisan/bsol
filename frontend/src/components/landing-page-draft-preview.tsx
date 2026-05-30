"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/dashboard-client";
import type { ProductItem } from "@/lib/landing-pages";

type HtmlSectionDraft = { title: string; html: string };
type CarouselImageDraft = { id?: number | null; url: string; alt?: string };
type CarouselBlockDraft = { title: string; template: string; images: CarouselImageDraft[] };
type FeatureDraft = { title: string; description: string };
type ReviewDraft = { name: string; quote: string };
type FaqDraft = { q: string; a: string };
type PreviewProduct = {
  product_id: number;
  title_override: string;
  subtitle: string;
  badge_text: string;
  price_override: string;
  default_qty: number;
  selected_by_default: boolean;
  sort_order: number;
  product: ProductItem | null;
};

type LandingPageDraftPreviewProps = {
  locale: Locale;
  title: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroCtaText: string;
  htmlSections: HtmlSectionDraft[];
  carouselBlocks: CarouselBlockDraft[];
  layoutOrder: string[];
  features: FeatureDraft[];
  reviews: ReviewDraft[];
  faq: FaqDraft[];
  selectedProducts: PreviewProduct[];
  shippingInside: string;
  shippingOutside: string;
  contactPhone: string;
  customCss: string;
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `৳${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "৳0.00";
}

function CarouselPreviewBlock({
  block,
}: {
  block: CarouselBlockDraft;
}) {
  const images = (block.images ?? []).filter((img) => img.url?.trim());
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length, images.map((img) => img.url).join("|")]);

  if (images.length === 0) return null;

  const template = block.template === "style-2" ? "style-2" : "style-1";

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

  if (template === "style-2") {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
        {block.title ? <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{block.title}</h4> : null}
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
                    <img src={image.url} alt={image.alt || `Carousel ${imageIndex + 1}`} className="h-[12rem] w-full object-contain sm:h-[22rem] sm:object-cover" />
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 via-transparent to-transparent" />
                </button>
              );
            })}
          </div>

          {images.length > 1 ? (
            <>
              <button type="button" aria-label="Previous slide" onClick={() => goTo(activeIndex - 1)} className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-xl transition hover:bg-white">
                <span className="block text-xl leading-none">‹</span>
              </button>
              <button type="button" aria-label="Next slide" onClick={() => goTo(activeIndex + 1)} className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-xl transition hover:bg-white">
                <span className="block text-xl leading-none">›</span>
              </button>
            </>
          ) : null}
        </div>

        {images.length > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      {block.title ? <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{block.title}</h4> : null}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((image, imageIndex) => (
            <div key={`${image.url}-${imageIndex}`} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt || `Carousel ${imageIndex + 1}`} className="h-44 w-full object-contain sm:object-cover" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPageDraftPreview({
  locale,
  title,
  heroHeadline,
  heroSubheadline,
  heroCtaText,
  htmlSections,
  carouselBlocks,
  layoutOrder,
  features,
  reviews,
  faq,
  selectedProducts,
  shippingInside,
  shippingOutside,
  contactPhone,
  customCss,
}: LandingPageDraftPreviewProps) {
  const defaultLayoutOrder = ["html_sections", "carousel_images", "features", "faq", "reviews", "products"];
  const orderedSections = layoutOrder.length > 0 ? layoutOrder : defaultLayoutOrder;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <style>{customCss}</style>
      <div className="rounded-t-2xl bg-gradient-to-r from-teal-700 to-teal-900 px-5 py-8 text-white">
        <h3 className="text-2xl font-bold">{heroHeadline || title || (locale === "bn" ? "প্রিভিউ শিরোনাম" : "Preview title")}</h3>
        {heroSubheadline ? <p className="mt-2 text-sm text-white/85">{heroSubheadline}</p> : null}
        <button type="button" className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
          {heroCtaText || (locale === "bn" ? "অর্ডার করতে চাই" : "Order now")}
        </button>
      </div>

      <div className="space-y-5 p-5">
        {orderedSections.map((sectionKey) => {
          if (sectionKey === "html_sections") {
            return htmlSections.filter((item) => item.title || item.html).map((section, index) => (
              <section key={`${section.title}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                {section.title ? <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{section.title}</h4> : null}
                <div className="prose prose-sm max-w-none text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: section.html || "" }} />
              </section>
            ));
          }

          if (sectionKey === "carousel_images") {
            if (carouselBlocks.length === 0) return null;
            return carouselBlocks.map((block, blockIndex) => <CarouselPreviewBlock key={`preview-carousel-${blockIndex}`} block={block} />);
          }

          if (sectionKey === "features") {
            if (!features.some((item) => item.title || item.description)) return null;
            return (
              <section key="preview-features" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{locale === "bn" ? "ফিচার" : "Features"}</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {features.filter((item) => item.title || item.description).map((feature, index) => (
                    <div key={`${feature.title}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                      <div className="font-semibold text-[var(--foreground)]">{feature.title || `Feature ${index + 1}`}</div>
                      {feature.description ? <div className="mt-1 text-sm text-[var(--muted)]">{feature.description}</div> : null}
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (sectionKey === "faq") {
            if (!faq.some((item) => item.q || item.a)) return null;
            return (
              <section key="preview-faq" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">FAQ</h4>
                <div className="space-y-2">
                  {faq.filter((item) => item.q || item.a).map((item, index) => (
                    <details key={`${item.q}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                      <summary className="cursor-pointer font-semibold text-[var(--foreground)]">{item.q || `FAQ ${index + 1}`}</summary>
                      {item.a ? <p className="mt-2 text-sm text-[var(--muted)]">{item.a}</p> : null}
                    </details>
                  ))}
                </div>
              </section>
            );
          }

          if (sectionKey === "reviews") {
            if (!reviews.some((item) => item.name || item.quote)) return null;
            return (
              <section key="preview-reviews" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{locale === "bn" ? "রিভিউ" : "Reviews"}</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {reviews.filter((item) => item.name || item.quote).map((review, index) => (
                    <blockquote key={`${review.name}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground)]">
                      <p>“{review.quote}”</p>
                      {review.name ? <footer className="mt-2 font-semibold text-[var(--muted)]">— {review.name}</footer> : null}
                    </blockquote>
                  ))}
                </div>
              </section>
            );
          }

          if (sectionKey !== "products") return null;

          if (selectedProducts.length === 0) return null;

          return (
            <section key="preview-products" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{locale === "bn" ? "পছন্দের প্রোডাক্ট" : "Selected Products"}</h4>
              <div className="space-y-3">
                {selectedProducts.map((item) => {
                const product = item.product;
                const price = item.price_override || product?.selling_price || product?.regular_price || 0;
                return (
                  <div key={item.product_id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--foreground)]">{item.title_override || product?.name || `#${item.product_id}`}</div>
                      {item.subtitle ? <div className="mt-1 text-sm text-[var(--muted)]">{item.subtitle}</div> : null}
                      {item.badge_text ? <div className="mt-2 inline-flex rounded-full bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-500">{item.badge_text}</div> : null}
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-sm">
                        <span className="px-2 py-1">−</span>
                        <span className="border-x border-[var(--border)] px-3 py-1 font-semibold">{item.default_qty}</span>
                        <span className="px-2 py-1">+</span>
                      </div>
                      <div className="mt-2 text-base font-bold text-[var(--accent)]">{money(price)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            </section>
          );
        })}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{locale === "bn" ? "চেকআউট প্রিভিউ" : "Checkout Preview"}</h4>
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-3 text-sm font-semibold text-[var(--foreground)]">{locale === "bn" ? "Shipping Details" : "Shipping Details"}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted)]">{locale === "bn" ? "আপনার নাম" : "Your name"}</div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted)]">{locale === "bn" ? "মোবাইল নাম্বার" : "Phone"}</div>
              </div>
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted)]">{locale === "bn" ? "সম্পূর্ণ ঠিকানা" : "Full address"}</div>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">Inside Dhaka: {money(shippingInside)}</div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted)]">Outside Dhaka: {money(shippingOutside)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-3 text-sm font-semibold text-[var(--foreground)]">{locale === "bn" ? "Your order" : "Your order"}</div>
              <div className="space-y-3">
                {selectedProducts.length > 0 ? selectedProducts.map((item) => {
                  const product = item.product;
                  const price = Number(item.price_override || product?.selling_price || product?.regular_price || 0);
                  return (
                    <div key={`checkout-${item.product_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">{item.title_override || product?.name || `#${item.product_id}`}</div>
                        <div className="text-[var(--muted)]">Qty {item.default_qty}</div>
                      </div>
                      <div className="font-semibold text-[var(--accent)]">{money(price * item.default_qty)}</div>
                    </div>
                  );
                }) : <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">{locale === "bn" ? "অর্ডার summary এখানে দেখা যাবে" : "Order summary will appear here"}</div>}
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--muted)]">
                <div className="font-semibold text-[var(--foreground)]">Cash on delivery</div>
                <div className="mt-1">{locale === "bn" ? "ডেলিভারির সময় পেমেন্ট" : "Pay on delivery"}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{locale === "bn" ? "ডেলিভারি / যোগাযোগ" : "Delivery / Contact"}</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-sm text-[var(--muted)]">Inside Dhaka</div>
              <div className="mt-1 text-lg font-bold text-[var(--foreground)]">{money(shippingInside)}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-sm text-[var(--muted)]">Outside Dhaka</div>
              <div className="mt-1 text-lg font-bold text-[var(--foreground)]">{money(shippingOutside)}</div>
            </div>
          </div>
          {contactPhone ? <div className="mt-3 text-sm text-[var(--foreground)]">{locale === "bn" ? "ফোন" : "Phone"}: {contactPhone}</div> : null}
        </section>
      </div>
    </div>
  );
}
