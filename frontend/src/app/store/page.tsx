import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchHome } from "@/lib/storefront-client";
import ProductCard from "@/components/storefront/product-card";

/**
 * Storefront homepage — S5 (seller_storefront_context.md §1/§12). Reached
 * only via proxy.ts's rewrite of `/` on a seller subdomain when
 * homepage_mode is 'storefront' (the default); never a direct public URL.
 */

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (forwardedProto && host) return `${forwardedProto}://${host}`;
  if (host) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl(await headers());
  const home = await fetchHome(baseUrl);

  return { title: home?.shop_name ?? "Shop" };
}

export default async function StorefrontHomeRoute() {
  const baseUrl = getBaseUrl(await headers());
  const home = await fetchHome(baseUrl);

  if (!home) {
    notFound();
  }

  const hasContent = home.banner_images.length > 0 || home.featured_products.length > 0 || home.category_sections.length > 0;

  return (
    <div className="space-y-10">
      {/* Hero banners */}
      {home.banner_images.length > 0 ? (
        <div className={`grid gap-3 ${home.banner_images.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {home.banner_images.map((b, i) =>
            b.link_url ? (
              <a key={i} href={b.link_url} className="overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image_url} alt="" className="h-40 w-full object-cover sm:h-56" />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={b.image_url} alt="" className="h-40 w-full rounded-2xl object-cover sm:h-56" />
            ),
          )}
        </div>
      ) : null}

      {/* Featured categories */}
      {home.featured_categories.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">Featured Categories</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {home.featured_categories.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="flex min-w-[96px] flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm hover:border-slate-300"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ background: home.theme_primary_color || "#0f172a" }}
                >
                  {c.name.charAt(0)}
                </span>
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Top selling / featured products */}
      {home.featured_products.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">Top Selling Products</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {home.featured_products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Category-wise product rows */}
      {home.category_sections.map((section) => (
        <section key={section.category.id}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{section.category.name}</h2>
            <Link href={`/category/${section.category.slug}`} className="text-sm text-slate-500 hover:text-slate-900">
              See All →
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {section.products.map((p) => (
              <div key={p.id} className="w-40 flex-shrink-0 sm:w-48">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {!hasContent ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-slate-500">এই শপে এখনো কোনো প্রোডাক্ট যোগ করা হয়নি।</p>
          <Link href="/search" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            সব প্রোডাক্ট দেখুন
          </Link>
        </div>
      ) : null}

      {/* About */}
      {home.about_text || home.about_image_url ? (
        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="text-lg font-bold">{home.shop_name}</h2>
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
