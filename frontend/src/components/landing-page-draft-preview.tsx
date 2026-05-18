import type { Locale } from "@/lib/dashboard-client";
import type { ProductItem } from "@/lib/landing-pages";

type HtmlSectionDraft = { title: string; html: string };
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

export default function LandingPageDraftPreview({
  locale,
  title,
  heroHeadline,
  heroSubheadline,
  heroCtaText,
  htmlSections,
  features,
  reviews,
  faq,
  selectedProducts,
  shippingInside,
  shippingOutside,
  contactPhone,
  customCss,
}: LandingPageDraftPreviewProps) {
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
        {htmlSections.filter((item) => item.title || item.html).map((section, index) => (
          <section key={`${section.title}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            {section.title ? <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{section.title}</h4> : null}
            <div className="prose prose-sm max-w-none text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: section.html || "" }} />
          </section>
        ))}

        {features.some((item) => item.title || item.description) ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
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
        ) : null}

        {selectedProducts.length > 0 ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
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
        ) : null}

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

        {reviews.some((item) => item.name || item.quote) ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
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
        ) : null}

        {faq.some((item) => item.q || item.a) ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
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
        ) : null}

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
