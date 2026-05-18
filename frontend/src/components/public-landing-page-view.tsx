"use client";

import { useMemo, useState } from "react";
import { mergeLandingContent, type LandingTemplate } from "@/lib/landing-pages";

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
  } | null;
  content?: {
    hero?: {
      headline?: string | null;
      subheadline?: string | null;
      cta_text?: string | null;
    };
    html_sections?: Array<{ title?: string | null; html?: string | null }>;
    features?: Array<{ title?: string | null; description?: string | null }>;
    reviews?: Array<{ name?: string | null; quote?: string | null }>;
    faq?: Array<{ q?: string | null; a?: string | null }>;
    contact?: { phone?: string | null };
    shipping?: { inside_dhaka?: number | null; outside_dhaka?: number | null };
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
  return Number.isFinite(amount) ? `৳${amount.toLocaleString()}` : "৳0";
}

export default function PublicLandingPageView({ page }: { page: PublicLandingPage }) {
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const theme = useMemo(() => ({
    primary: page?.theme_settings?.primary_color ?? "#0f766e",
    accent: page?.theme_settings?.accent_color ?? "#f97316",
    background: page?.theme_settings?.background_color ?? "#f8fafc",
    text: page?.theme_settings?.text_color ?? "#0f172a",
    buttonText: page?.theme_settings?.button_text_color ?? "#ffffff",
  }), [page]);

  const content = mergeLandingContent(page.content, page.template);
  const hero = content.hero ?? {};
  const htmlSections = content.html_sections ?? [];
  const features = content.features ?? [];
  const reviews = content.reviews ?? [];
  const faq = content.faq ?? [];
  const products = (page.products ?? []).filter((item) => item.product);
  const shipping = content.shipping ?? {};
  const shippingCharge = shippingZone === "inside"
    ? Number(shipping.inside_dhaka ?? 80)
    : Number(shipping.outside_dhaka ?? shipping.inside_dhaka ?? 120);
  const selectedProducts = products.filter((item) => checkout[item.product_id]?.enabled);
  const subtotal = selectedProducts.reduce((sum, item) => {
    const quantity = checkout[item.product_id]?.quantity ?? 1;
    const price = Number(item.price_override ?? item.product?.selling_price ?? item.product?.regular_price ?? 0);
    return sum + (price * quantity);
  }, 0);
  const total = Math.max(0, subtotal + shippingCharge);

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const payload = {
        ...customer,
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
        .lp-shell { font-family: Hind Siliguri, system-ui, -apple-system, sans-serif; }
        .lp-card { background: rgba(255,255,255,0.92); border: 1px solid rgba(148,163,184,0.18); box-shadow: 0 20px 50px rgba(15,23,42,0.08); }
        .lp-html ul { padding-left: 1.25rem; list-style: disc; }
        .lp-html ol { padding-left: 1.25rem; list-style: decimal; }
        .lp-html p + p { margin-top: .75rem; }
        .lp-html li + li { margin-top: .35rem; }
        ${page.custom_css ?? ""}
      `}</style>

      <section className="lp-shell px-4 py-16 text-white" style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, #0b3b36 100%)` }}>
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
          {htmlSections.map((section, index) => (
            <div key={`${section.title ?? "section"}-${index}`} className="lp-card rounded-3xl p-6 sm:p-8">
              {section.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{section.title}</h2> : null}
              <div className="lp-html max-w-none text-sm leading-7 text-slate-700" dangerouslySetInnerHTML={{ __html: section.html ?? "" }} />
            </div>
          ))}

          {features.length > 0 ? (
            <div className="lp-card rounded-3xl p-6 sm:p-8">
              <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>কেন এই পেজটি বেছে নেবেন?</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, index) => (
                  <div key={`${feature.title ?? "feature"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-lg font-bold text-slate-900">{feature.title || `Feature ${index + 1}`}</h3>
                    {feature.description ? <p className="mt-2 text-sm text-slate-600">{feature.description}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div id="products" className="lp-card rounded-3xl p-6 sm:p-8">
            <h2 className="mb-2 text-center text-2xl font-bold" style={{ color: theme.primary }}>প্রোডাক্ট নির্বাচন</h2>
            <p className="mb-6 text-center text-sm text-slate-500">প্রয়োজনীয় product বেছে quantity দিন, তারপর নিচের checkout form পূরণ করুন।</p>
            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">কোনো product attach করা হয়নি।</div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {products.map((item) => {
                  const product = item.product!;
                  const price = item.price_override ?? product.selling_price ?? product.regular_price ?? 0;
                  const draft = checkout[item.product_id] ?? {
                    enabled: Boolean(item.selected_by_default ?? true),
                    quantity: Math.max(1, Number(item.default_qty ?? 1)),
                  };

                  return (
                    <article key={`${item.product_id}-${item.sort_order ?? 0}`} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      {product.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.thumbnail} alt={item.title_override || product.name} className="h-52 w-full object-cover" />
                      ) : (
                        <div className="flex h-52 items-center justify-center bg-slate-100 text-slate-400">No image</div>
                      )}
                      <div className="p-5">
                        {item.badge_text ? <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">{item.badge_text}</span> : null}
                        <h3 className="mt-3 text-lg font-bold text-slate-900">{item.title_override || product.name}</h3>
                        {item.subtitle ? <p className="mt-2 text-sm text-slate-600">{item.subtitle}</p> : null}
                        <div className="mt-4 text-2xl font-extrabold" style={{ color: theme.primary }}>{money(price)}</div>
                        <div className="mt-2 text-xs text-slate-400">SKU: {product.sku || "—"}</div>
                        <label className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                          <input type="checkbox" checked={draft.enabled} onChange={(e) => patchCheckout(item.product_id, { enabled: e.target.checked })} className="accent-[var(--accent)]" />
                          এই প্রোডাক্ট নিতে চাই
                        </label>
                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</label>
                          <input type="number" min={1} max={100} value={draft.quantity} onChange={(e) => patchCheckout(item.product_id, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900" />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div id="checkout" className="lp-card rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: theme.primary }}>Checkout / Order Form</h2>
                <p className="mt-2 text-sm text-slate-500">নাম, ফোন, ঠিকানা দিন—আমরা order receive করে দ্রুত যোগাযোগ করব।</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 lg:min-w-72">
                <div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                <div className="mt-2 flex justify-between"><span>Shipping</span><strong>{money(shippingCharge)}</strong></div>
                <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-base"><span className="font-semibold">Total</span><strong style={{ color: theme.primary }}>{money(total)}</strong></div>
              </div>
            </div>

            {submitError ? <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</div> : null}
            {submitSuccess ? <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitSuccess}</div> : null}

            <form onSubmit={submitOrder} className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">আপনার নাম</span><input required value={customer.customer_name} onChange={(e) => updateCustomer("customer_name", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">মোবাইল নাম্বার</span><input required value={customer.customer_phone} onChange={(e) => updateCustomer("customer_phone", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>
              </div>

              <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">সম্পূর্ণ ঠিকানা</span><textarea required rows={3} value={customer.customer_address} onChange={(e) => updateCustomer("customer_address", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">জেলা</span><input value={customer.customer_district} onChange={(e) => updateCustomer("customer_district", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">থানা</span><input value={customer.customer_thana} onChange={(e) => updateCustomer("customer_thana", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">এরিয়া</span><input value={customer.customer_area} onChange={(e) => updateCustomer("customer_area", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Delivery Zone</span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"><input type="radio" checked={shippingZone === "inside"} onChange={() => setShippingZone("inside")} />ঢাকার ভিতরে ({money(shipping.inside_dhaka)})</label>
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"><input type="radio" checked={shippingZone === "outside"} onChange={() => setShippingZone("outside")} />ঢাকার বাইরে ({money(shipping.outside_dhaka)})</label>
                  </div>
                </div>
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">নোট (ঐচ্ছিক)</span><textarea rows={3} value={customer.notes} onChange={(e) => updateCustomer("notes", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>
              </div>

              <button type="submit" disabled={submitting || selectedProducts.length === 0} className="inline-flex rounded-2xl px-6 py-3 text-base font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: theme.accent, color: theme.buttonText }}>
                {submitting ? "অর্ডার পাঠানো হচ্ছে..." : selectedProducts.length === 0 ? "অর্ডারের জন্য product select করুন" : "অর্ডার কনফার্ম করুন"}
              </button>
            </form>
          </div>

          {reviews.length > 0 ? (
            <div className="lp-card rounded-3xl p-6 sm:p-8">
              <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>Customer Reviews</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {reviews.map((review, index) => (
                  <blockquote key={`${review.name ?? "review"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-sm leading-7 text-slate-700">“{review.quote || ""}”</p>
                    {review.name ? <footer className="mt-3 text-sm font-semibold text-slate-900">— {review.name}</footer> : null}
                  </blockquote>
                ))}
              </div>
            </div>
          ) : null}

          {faq.length > 0 ? (
            <div className="lp-card rounded-3xl p-6 sm:p-8">
              <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>সাধারণ প্রশ্ন</h2>
              <div className="space-y-3">
                {faq.map((item, index) => (
                  <details key={`${item.q ?? "faq"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">{item.q || `Question ${index + 1}`}</summary>
                    {item.a ? <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p> : null}
                  </details>
                ))}
              </div>
            </div>
          ) : null}

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
