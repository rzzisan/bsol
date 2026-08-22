import Link from "next/link";
import type { StorefrontHome } from "@/lib/storefront-client";
import ProductCard from "@/components/storefront/product-card";
import CaresolutionHero from "./CaresolutionHero";

/** CareSolution-style homepage body — same `home` data as StandardHome, restyled. */
export default function CaresolutionHome({ home }: { home: StorefrontHome }) {
  const hasContent = home.banner_images.length > 0 || home.featured_products.length > 0 || home.category_sections.length > 0;

  return (
    <div className="space-y-10">
      <CaresolutionHero home={home} />

      {/* Featured categories */}
      {home.featured_categories.length > 0 ? (
        <section>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400">Explore</p>
          <h2 className="text-center text-2xl font-extrabold">
            Featured <span className="text-orange-600">Categories</span>
          </h2>
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {home.featured_categories.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-4 text-center text-xs font-medium hover:border-orange-300"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-lg text-orange-600">
                  {c.name.charAt(0)}
                </span>
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Top selling / featured products */}
      {home.featured_products.length > 0 ? <CaresolutionSection title="Top Selling Products" href="/search" products={home.featured_products} /> : null}

      {/* Category-wise product rows */}
      {home.category_sections.map((section) => (
        <CaresolutionSection
          key={section.category.id}
          title={section.category.name}
          href={`/category/${section.category.slug}`}
          products={section.products}
        />
      ))}

      {!hasContent ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-slate-500">এই শপে এখনো কোনো প্রোডাক্ট যোগ করা হয়নি।</p>
          <Link href="/search" className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white">
            সব প্রোডাক্ট দেখুন
          </Link>
        </div>
      ) : null}

      {/* About */}
      {home.about_text || home.about_image_url ? (
        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="text-xl font-extrabold">{home.shop_name}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">About Us</p>
            {home.about_text ? <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{home.about_text}</p> : null}
          </div>
          {home.about_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={home.about_image_url} alt="" className="w-full rounded-xl object-cover" />
          ) : null}
        </section>
      ) : null}

      {/* Partner logos */}
      {home.partner_logos.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-center justify-center gap-8 rounded-2xl border border-slate-200 bg-white p-6">
            {home.partner_logos.map((p, i) =>
              p.link_url ? (
                <a key={i} href={p.link_url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt="" className="h-10 object-contain grayscale" />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p.image_url} alt="" className="h-10 object-contain grayscale" />
              ),
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CaresolutionSection({
  title,
  href,
  products,
}: {
  title: string;
  href: string;
  products: StorefrontHome["featured_products"];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="border-l-4 border-red-600 pl-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-xs text-slate-400">Explore our latest {title.toLowerCase()}</p>
        </div>
        <Link href={href} className="shrink-0 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold hover:border-orange-300">
          View All →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
