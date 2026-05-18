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
  return Number.isFinite(amount) ? `৳${amount.toLocaleString()}` : "৳0";
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
            <h4 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{locale === "bn" ? "প্রোডাক্ট" : "Products"}</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {selectedProducts.map((item) => {
                const product = item.product;
                const price = item.price_override || product?.selling_price || product?.regular_price || 0;
                return (
                  <div key={item.product_id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="font-semibold text-[var(--foreground)]">{item.title_override || product?.name || `#${item.product_id}`}</div>
                    {item.subtitle ? <div className="mt-1 text-sm text-[var(--muted)]">{item.subtitle}</div> : null}
                    {item.badge_text ? <div className="mt-2 inline-flex rounded-full bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-500">{item.badge_text}</div> : null}
                    <div className="mt-2 text-base font-bold text-[var(--accent)]">{money(price)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

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
