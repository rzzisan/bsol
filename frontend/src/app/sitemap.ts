import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * Root-level (not under /store) so it's reachable at the conventional
 * /sitemap.xml on every host — proxy.ts doesn't rewrite "sitemap.xml"
 * (dots are excluded from landing-page slug matching), so this file alone
 * handles both bsol.<apex> and every seller subdomain. Host-aware via
 * headers() rather than being scoped per-shop by URL, since the sitemap
 * has to live at the exact path search engines expect.
 * seller_storefront_context.md §12 (S8).
 */

type SitemapData = {
  categories: Array<{ slug: string; updated_at: string | null }>;
  products: Array<{ slug: string; updated_at: string | null }>;
  landing_pages: Array<{ slug: string; updated_at: string | null }>;
};

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (forwardedProto && host) return `${forwardedProto}://${host}`;
  if (host) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);
  const isShop = headerList.get("x-bsol-shop-subdomain") !== null;

  if (!isShop) {
    // Platform host itself — the marketing homepage in both languages
    // (seo_context.md) plus the two static legal pages. Everything else
    // (dashboard/admin/auth/onboarding) is robots.ts-disallowed already.
    return [
      { url: baseUrl, changeFrequency: "weekly", priority: 1 },
      { url: `${baseUrl}/en`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${baseUrl}/terms`, changeFrequency: "monthly", priority: 0.2 },
      { url: `${baseUrl}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    ];
  }

  let data: SitemapData | null = null;
  try {
    const res = await fetch(`${baseUrl}/api/public/storefront/sitemap-data`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    data = res.ok ? json.data : null;
  } catch {
    data = null;
  }

  const entries: MetadataRoute.Sitemap = [{ url: baseUrl, changeFrequency: "daily", priority: 1 }];

  if (!data) return entries;

  for (const c of data.categories) {
    entries.push({ url: `${baseUrl}/category/${c.slug}`, lastModified: c.updated_at ?? undefined, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const p of data.products) {
    entries.push({ url: `${baseUrl}/product/${p.slug}`, lastModified: p.updated_at ?? undefined, changeFrequency: "weekly", priority: 0.8 });
  }
  for (const lp of data.landing_pages) {
    entries.push({ url: `${baseUrl}/${lp.slug}`, lastModified: lp.updated_at ?? undefined, changeFrequency: "weekly", priority: 0.7 });
  }

  return entries;
}
