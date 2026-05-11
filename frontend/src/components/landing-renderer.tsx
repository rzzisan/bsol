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
  const content = page.content_json ?? {};
  const contact = content.contact ?? {};
  const policy = content.policy ?? {};
  const sections = [...(content.sections ?? [])]
    .filter((section) => section.enabled !== false)
    .sort((a, b) => a.order - b.order);
  const primary = page.theme_tokens_json?.primary_color ?? "#0f7c7b";
  const accent = page.theme_tokens_json?.accent_color ?? "#1f2937";

  const heroTitle = String(
    sections.find((item) => item.type === "hero")?.data?.hero_title ??
      sections.find((item) => item.type === "hook")?.data?.hook_headline ??
      page.title,
  );

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
