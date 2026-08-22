import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchHome } from "@/lib/storefront-client";
import StorefrontPageTracking from "@/components/storefront/page-tracking";
import StandardHome from "@/components/storefront/templates/standard/StandardHome";
import CaresolutionHome from "@/components/storefront/templates/caresolution/CaresolutionHome";

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
  const title = home?.shop_name ?? "Shop";

  return {
    title,
    description: home?.about_text ?? undefined,
    openGraph: {
      title,
      description: home?.about_text ?? undefined,
      images: home?.logo_url ? [{ url: home.logo_url }] : undefined,
      type: "website",
    },
  };
}

export default async function StorefrontHomeRoute() {
  const baseUrl = getBaseUrl(await headers());
  const home = await fetchHome(baseUrl);

  if (!home) {
    notFound();
  }

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: home.shop_name,
    url: baseUrl,
    logo: home.logo_url ?? undefined,
  };

  return (
    <>
      <StorefrontPageTracking slug="store-home" viewContent={false} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      {home.theme_template === "caresolution" ? <CaresolutionHome home={home} /> : <StandardHome home={home} />}
    </>
  );
}
