import type { LandingPageData } from "@/lib/landing";

function sectionList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")).filter(Boolean) : [];
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

export default function LandingRenderer({
  page,
  locale,
  onPrimaryCta,
}: {
  page: LandingPageData;
  locale: "bn" | "en";
  onPrimaryCta?: () => void;
}) {
  const templateCode = page.template?.code ?? "generic";
  const content = (page.content_json ?? {}) as Record<string, unknown>;
  const layoutProfile = String((content.layout_profile ?? page.template?.layout_profile ?? "") as string);
  const contact = (content.contact ?? {}) as Record<string, unknown>;
  const policy = (content.policy ?? {}) as Record<string, unknown>;
  const sections = [...((content.sections ?? []) as Array<{ id: string; type: string; enabled?: boolean; order: number; data: Record<string, unknown> }>)]
    .filter((section) => section.enabled !== false)
    .sort((a, b) => a.order - b.order);
  const primary = page.theme_tokens_json?.primary_color ?? "#0f7c7b";
  const accent = page.theme_tokens_json?.accent_color ?? "#1f2937";

  const heroTitle = String(
    sections.find((item) => item.type === "hero")?.data?.hero_title ??
      sections.find((item) => item.type === "hook")?.data?.hook_headline ??
      page.title,
  );

  if (templateCode === "naturiva_package_upsell" && layoutProfile === "naturiva_exact_clone_locked") {
    const hero = (content.hero ?? {}) as Record<string, unknown>;
    const proof = (content.proof ?? {}) as Record<string, unknown>;
    const offerStrip = (content.offer_strip ?? {}) as Record<string, unknown>;
    const lockedContact = (content.contact ?? {}) as Record<string, unknown>;
    const checkout = (content.checkout ?? {}) as Record<string, unknown>;
    const bottomCta = (content.bottom_cta ?? {}) as Record<string, unknown>;
    const lockedPolicy = (content.policy ?? {}) as Record<string, unknown>;
    const packages = objectArray(checkout.packages);
    const shippingOptions = objectArray(checkout.shipping_options);
    const reviewImages = objectArray(proof.review_images);

    return (
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-[24px] border border-[#d4ddd1] bg-[#eef8e9] shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
        <section className="bg-[#dfd0c1] px-4 py-8 text-center sm:px-8">
          <h1 className="text-2xl font-black text-[#0b7a2a] sm:text-4xl">{String(hero.title ?? page.title)}</h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm font-semibold text-[#21693d] sm:text-base">{String(hero.subtitle ?? "")}</p>
          <button type="button" onClick={onPrimaryCta} className="mt-5 rounded-xl bg-[#00d62f] px-6 py-3 text-base font-black text-[#05370f]">
            {String(offerStrip.cta_label ?? checkout.submit_label ?? (locale === "bn" ? "অর্ডার করতে চাই" : "Order now"))}
          </button>
        </section>

        <section className="bg-black px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-2xl rounded-2xl bg-[#101010] p-4 text-center text-white">
            {String(proof.video_url ?? "ভিডিও/প্রুফ সেকশন")}
          </div>
        </section>

        <section className="px-4 py-6 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviewImages.length > 0 ? reviewImages.map((item, index) => (
              <div key={String(item.title ?? index)} className="rounded-xl border border-[#dce6d7] bg-white p-3 text-xs font-semibold text-slate-700">
                {String(item.title ?? item.caption ?? `Review ${index + 1}`)}
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-[#c7d6c0] bg-white p-3 text-xs text-slate-500">{locale === "bn" ? "রিভিউ ইমেজ যোগ করুন" : "Add review images"}</div>
            )}
          </div>
        </section>

        <section className="px-4 pb-4 sm:px-8">
          <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
            {packages.map((pkg, index) => (
              <div key={String(pkg.id ?? index)} className="rounded-lg bg-[#f97316] px-4 py-3 text-center text-sm font-black text-white">
                {String(pkg.title ?? `Package ${index + 1}`)} = {Number(pkg.price ?? 0).toLocaleString()}৳
              </div>
            ))}
            <div className="rounded-lg bg-[#0b7a2a] px-4 py-3 text-center text-sm font-black text-white">
              {String(((lockedContact.call_numbers as unknown[])?.[0] ?? "") as string)}
            </div>
          </div>
        </section>

        <section className="px-4 py-6 sm:px-8">
          <div className="rounded-2xl border border-[#7abf89] bg-[#dff0d8] p-4">
            <h2 className="text-base font-black text-[#0b7a2a]">{String(checkout.section_title ?? (locale === "bn" ? "অর্ডার সেকশন" : "Checkout"))}</h2>
            <div className="mt-3 space-y-2 text-sm text-[#184c2a]">
              {shippingOptions.map((ship, index) => (
                <div key={String(ship.id ?? index)}>{String(ship.label ?? "Shipping")} - {Number(ship.fee ?? 0).toLocaleString()}৳</div>
              ))}
            </div>
            <button type="button" onClick={onPrimaryCta} className="mt-4 w-full rounded-xl bg-[#f97316] px-5 py-3 text-base font-black text-white">
              {String(checkout.submit_label ?? "Confirm Order")}
            </button>
          </div>
        </section>

        <section className="bg-[#056b1f] px-4 py-4 text-center sm:px-8">
          <a href={`tel:${String(bottomCta.phone ?? "")}`} className="text-xl font-black text-white">{String(bottomCta.text ?? "Click to Call")}</a>
        </section>

        <section className="bg-[#f5f5f5] px-4 py-4 text-center text-xs font-semibold text-slate-600 sm:px-8">
          <a href={String(lockedPolicy.privacy_url ?? "#")} className="mx-2">Privacy policy</a>
          <a href={String(lockedPolicy.terms_url ?? "#")} className="mx-2">Terms of service</a>
        </section>
      </div>
    );
  }

  if (templateCode === "goofi_flashcard_offer") {
    const hero = sections.find((item) => item.type === "hero")?.data ?? {};
    const authority = sections.find((item) => item.type === "authority")?.data ?? {};
    const reviews = objectArray(sections.find((item) => item.type === "reviews")?.data?.review_images);
    const faqs = objectArray(sections.find((item) => item.type === "faq")?.data?.faq_items);
    const guaranteeItems = sectionList(sections.find((item) => item.type === "guarantees")?.data?.guarantee_items);

    return (
      <div
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#e9ecef] bg-[#fffdf7] text-slate-900 shadow-[0_20px_48px_rgba(15,23,42,0.12)]"
        style={{ fontFamily: page.theme_tokens_json?.font_family || "inherit" }}
      >
        <section className="px-5 py-7 sm:px-8 sm:py-9" style={{ background: `linear-gradient(145deg, ${primary}, ${accent})` }}>
          <div className="max-w-3xl text-white">
            <p className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-[0.16em]">FLASHCARD LEARNING OFFER</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
              {String(hero.hero_title ?? heroTitle)}
            </h1>
            <p className="mt-3 text-sm text-white/90 sm:text-base">
              {String(hero.hero_subtitle ?? page.meta_description ?? (locale === "bn" ? "খেলতে খেলতে শেখার স্মার্ট সমাধান।" : "A smart way to build learning through play."))}
            </p>
            <button
              type="button"
              onClick={onPrimaryCta}
              className="mt-5 rounded-full bg-[#ffd84d] px-6 py-3 text-sm font-extrabold text-slate-900 transition hover:-translate-y-0.5"
            >
              {String(hero.cta_text_primary ?? (locale === "bn" ? "এখনই অর্ডার করুন" : "Order Now"))}
            </button>
          </div>
        </section>

        <section className="grid gap-3 border-b border-[#ece6d8] bg-[#fff7d2] px-5 py-4 text-sm font-semibold text-slate-700 sm:grid-cols-3 sm:px-8">
          {[
            String(authority.authority_text ?? (locale === "bn" ? "Expert-informed learning framework" : "Expert-informed learning framework")),
            String(authority.reach_text ?? (locale === "bn" ? "হাজারো পরিবারের আস্থা" : "Trusted by thousands of families")),
            String(authority.proof_text ?? (locale === "bn" ? "Science-backed play cards" : "Science-backed play cards")),
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-[#f1df9c] bg-white/70 px-4 py-3">✅ {item}</div>
          ))}
        </section>

        <div className="space-y-6 px-5 py-6 sm:px-8">
          <section className="rounded-3xl border border-[#ece6d8] bg-white p-5">
            <h2 className="text-xl font-black">{locale === "bn" ? "অভিভাবকদের রিভিউ" : "Parent Reviews"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.length > 0 ? reviews.map((item, index) => (
                <div key={String(item.title ?? index)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{String(item.title ?? `Review ${index + 1}`)}</p>
                  <p className="mt-2 text-sm text-slate-600">{String(item.caption ?? "Happy parent feedback")}</p>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">{locale === "bn" ? "রিভিউ যোগ করুন" : "Add review items"}</div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#ece6d8] bg-white p-5">
            <h2 className="text-xl font-black">FAQ</h2>
            <div className="mt-3 space-y-3">
              {faqs.map((item, index) => (
                <details key={String(item.question ?? index)} className="rounded-2xl bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">{String(item.question ?? `FAQ ${index + 1}`)}</summary>
                  <p className="mt-2 text-sm text-slate-600">{String(item.answer ?? "")}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#ece6d8] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">{locale === "bn" ? "পছন্দের সেট বেছে নিন" : "Select Your Product"}</h2>
              <button
                type="button"
                onClick={onPrimaryCta}
                className="rounded-full px-5 py-2 text-xs font-black text-white"
                style={{ backgroundColor: primary }}
              >
                {locale === "bn" ? "চেকআউট" : "Checkout"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(page.products ?? []).map((item) => {
                const sale = Number(item.custom_price ?? item.product?.selling_price ?? 0);
                const regular = Math.round(sale * 1.3);
                return (
                  <article key={item.product_id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    {item.product?.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.product.thumbnail} alt={item.custom_title ?? item.product?.name ?? "Product"} className="h-44 w-full rounded-2xl object-cover" />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center rounded-2xl bg-slate-200 text-xs font-bold text-slate-500">NO IMAGE</div>
                    )}
                    <h3 className="mt-3 text-base font-bold">{item.custom_title ?? item.product?.name ?? `Product #${item.product_id}`}</h3>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-xl font-black text-slate-900">৳{sale.toLocaleString()}</span>
                      <span className="text-sm font-semibold text-slate-400 line-through">৳{regular.toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      {locale === "bn" ? `আপনি সাশ্রয় করছেন ৳${(regular - sale).toLocaleString()}` : `You save ৳${(regular - sale).toLocaleString()}`}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-[#ece6d8] bg-[#f8fbff] p-5">
            <h2 className="text-xl font-black">{locale === "bn" ? "ডেলিভারি ও পেমেন্ট সুবিধা" : "Delivery & Payment Assurances"}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(guaranteeItems.length > 0 ? guaranteeItems : [
                locale === "bn" ? "Cash on Delivery - সারা বাংলাদেশ" : "Cash on Delivery - Nationwide",
                locale === "bn" ? "Secure Payment Gateway" : "Secure Payment Gateway",
                locale === "bn" ? "Easy Return Support" : "Easy Return Support",
                locale === "bn" ? "দ্রুত ডেলিভারি ট্র্যাকিং" : "Fast delivery tracking",
              ]).map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">🔒 {item}</div>
              ))}
            </div>
          </section>
        </div>

        <section className="bg-slate-900 px-5 py-6 text-white sm:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">{locale === "bn" ? "সহায়তা" : "Support"}</p>
              <p className="mt-2 text-lg font-bold">{String(contact.phone ?? "+8801XXXXXXXXX")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">WhatsApp</p>
              <p className="mt-2 text-lg font-bold">{String(contact.whatsapp ?? contact.phone ?? "Not set")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">{locale === "bn" ? "পলিসি" : "Policy"}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/90">
                <a href={String(policy.privacy_url ?? "#")} target="_blank" rel="noreferrer">{locale === "bn" ? "প্রাইভেসি" : "Privacy"}</a>
                <a href={String(policy.terms_url ?? "#")} target="_blank" rel="noreferrer">{locale === "bn" ? "শর্তাবলী" : "Terms"}</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-5xl rounded-[28px] border border-black/5 bg-white text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
      style={{ fontFamily: page.theme_tokens_json?.font_family || "inherit" }}
    >
      <section className="rounded-t-[28px] px-5 py-8 text-white sm:px-8" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
        <div className="max-w-3xl">
          <p className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            {templateCode.replaceAll("_", " ")}
          </p>
          <h1 className="text-3xl font-black leading-tight sm:text-5xl">{heroTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
            {String(
              sections.find((item) => item.type === "hero")?.data?.hero_subtitle ??
                sections.find((item) => item.type === "hook")?.data?.hook_paragraph ??
                page.meta_description ??
                (locale === "bn" ? "মোবাইল-ফার্স্ট, দ্রুত কনভার্টিং ল্যান্ডিং পেইজ।" : "Mobile-first, conversion-ready landing page."),
            )}
          </p>
          <button
            type="button"
            onClick={onPrimaryCta}
            className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:-translate-y-0.5"
          >
            {String(
              sections.find((item) => item.type === "cta")?.data?.cta_text_primary ??
                sections.find((item) => item.type === "hero")?.data?.cta_text_primary ??
                sections.find((item) => item.type === "final_cta")?.data?.final_cta_text ??
                (locale === "bn" ? "অর্ডার করুন" : "Order Now"),
            )}
          </button>
        </div>
      </section>

      <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        {sections.map((section) => {
          if (section.type === "benefits" || section.type === "benefit_points") {
            const items = sectionList(section.data.benefit_points);
            return (
              <section key={section.id} className="rounded-3xl bg-slate-50 p-5">
                <h2 className="text-xl font-bold">{locale === "bn" ? "মূল উপকারিতা" : "Key Benefits"}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                      ✅ {item}
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (section.type === "faq") {
            const items = objectArray(section.data.faq_items);
            return (
              <section key={section.id} className="rounded-3xl border border-slate-200 p-5">
                <h2 className="text-xl font-bold">FAQ</h2>
                <div className="mt-4 space-y-3">
                  {items.map((item, index) => (
                    <details key={String(item.question ?? index)} className="rounded-2xl bg-slate-50 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-900">{String(item.question ?? item.title ?? `FAQ ${index + 1}`)}</summary>
                      <p className="mt-2 text-sm text-slate-600">{String(item.answer ?? item.description ?? "")}</p>
                    </details>
                  ))}
                </div>
              </section>
            );
          }

          if (section.type === "packages" || section.type === "offer_packages") {
            const items = objectArray(section.data.packages ?? section.data.offer_packages);
            return (
              <section key={section.id} className="rounded-3xl bg-amber-50 p-5">
                <h2 className="text-xl font-bold">{locale === "bn" ? "অফার প্যাকেজ" : "Offer Packages"}</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {items.map((item, index) => (
                    <article key={String(item.name ?? item.label ?? index)} className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold">{String(item.name ?? item.label ?? `Package ${index + 1}`)}</h3>
                          <p className="mt-1 text-sm text-slate-500">{String(item.note ?? item.notes ?? item.bonus ?? "")}</p>
                        </div>
                        {item.badge ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{String(item.badge)}</span> : null}
                      </div>
                      <p className="mt-4 text-2xl font-black text-slate-900">৳{String(item.price ?? item.sale_price ?? "0")}</p>
                    </article>
                  ))}
                </div>
              </section>
            );
          }

          if (section.type === "reviews" || section.type === "testimonials") {
            const items = objectArray(section.data.reviews ?? section.data.testimonial_media ?? section.data.review_images);
            return (
              <section key={section.id} className="rounded-3xl border border-slate-200 p-5">
                <h2 className="text-xl font-bold">{locale === "bn" ? "গ্রাহক মতামত" : "Customer Proof"}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item, index) => (
                    <div key={String(item.url ?? item.title ?? index)} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">{String(item.title ?? item.name ?? `Review ${index + 1}`)}</p>
                      <p className="mt-2 line-clamp-4">{String(item.caption ?? item.text ?? item.url ?? "Visual proof block")}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (section.type === "usage") {
            const items = sectionList(section.data.usage_rules);
            return (
              <section key={section.id} className="rounded-3xl bg-slate-50 p-5">
                <h2 className="text-xl font-bold">{locale === "bn" ? "ব্যবহারের নিয়ম" : "How to Use"}</h2>
                <ol className="mt-4 space-y-3 text-sm text-slate-700">
                  {items.map((item, index) => (
                    <li key={item} className="flex gap-3 rounded-2xl bg-white px-4 py-3">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          }

          return null;
        })}

        <section className="rounded-3xl border border-slate-200 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">{locale === "bn" ? "প্রডাক্ট / প্যাকেজ" : "Products / Packages"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {locale === "bn" ? "সেলার কর্তৃক যুক্ত অফার সমূহ" : "Offers attached by the seller"}
              </p>
            </div>
            <button
              type="button"
              onClick={onPrimaryCta}
              className="rounded-full px-5 py-3 text-sm font-bold text-white"
              style={{ backgroundColor: primary }}
            >
              {locale === "bn" ? "চেকআউটে যান" : "Go to checkout"}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(page.products ?? []).map((item) => (
              <article key={item.product_id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {item.product?.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.product.thumbnail} alt={item.custom_title ?? item.product?.name ?? "Product"} className="h-40 w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-slate-200 text-xs font-bold text-slate-500">NO IMAGE</div>
                )}
                <h3 className="mt-4 text-lg font-bold">{item.custom_title ?? item.product?.name ?? `Product #${item.product_id}`}</h3>
                <p className="mt-2 text-2xl font-black text-slate-900">৳{String(item.custom_price ?? item.product?.selling_price ?? "0")}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {locale === "bn" ? `ডিফল্ট পরিমাণ: ${item.default_qty ?? 1}` : `Default quantity: ${item.default_qty ?? 1}`}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-slate-900 px-5 py-6 text-white">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/70">{locale === "bn" ? "সহায়তা" : "Support"}</p>
              <p className="mt-2 text-lg font-bold">{String(contact.phone ?? "+8801XXXXXXXXX")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/70">WhatsApp</p>
              <p className="mt-2 text-lg font-bold">{String(contact.whatsapp ?? contact.phone ?? "Not set")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/70">{locale === "bn" ? "পলিসি" : "Policy"}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/90">
                <a href={String(policy.privacy_url ?? "#")} target="_blank" rel="noreferrer">{locale === "bn" ? "প্রাইভেসি" : "Privacy"}</a>
                <a href={String(policy.terms_url ?? "#")} target="_blank" rel="noreferrer">{locale === "bn" ? "শর্তাবলী" : "Terms"}</a>
                {policy.return_url ? <a href={String(policy.return_url)} target="_blank" rel="noreferrer">{locale === "bn" ? "রিটার্ন" : "Return"}</a> : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
