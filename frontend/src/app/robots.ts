import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * Root-level, same reasoning as sitemap.ts — reachable at /robots.txt on
 * every host without a proxy.ts rewrite. seller_storefront_context.md §12 (S8).
 */

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (forwardedProto && host) return `${forwardedProto}://${host}`;
  if (host) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);
  const isShop = headerList.get("x-bsol-shop-subdomain") !== null;

  if (!isShop) {
    // Platform host — dashboard/admin/auth are never meant to be indexed.
    return {
      rules: [{ userAgent: "*", disallow: ["/dashboard", "/admin", "/auth", "/onboarding"] }],
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }

  // A seller subdomain also carries /dashboard (that seller's own login-
  // gated shell) — same disallow, everything else (storefront + any
  // landing pages) is crawlable.
  return {
    rules: [{ userAgent: "*", disallow: ["/dashboard"] }],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
