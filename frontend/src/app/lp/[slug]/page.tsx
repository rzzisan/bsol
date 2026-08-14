import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PublicLandingPageView, { type PublicLandingPage } from "@/components/public-landing-page-view";
import { FONT_VARIABLE_CLASSES } from "./fonts";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (forwardedProto && host) {
    return `${forwardedProto}://${host}`;
  }

  if (host) {
    return `https://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

async function fetchLandingPage(slug: string) {
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);

  const res = await fetch(`${baseUrl}/api/public/landing-pages/${slug}`, {
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.data) {
    return null;
  }

  return json.data as PublicLandingPage;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchLandingPage(slug);

  if (!page) {
    return {
      title: "Landing page unavailable",
      description: "The requested landing page could not be found.",
    };
  }

  return {
    title: page.seo_meta?.meta_title || page.title,
    description: page.seo_meta?.meta_description || page.content?.hero?.subheadline || page.title,
  };
}

export default async function PublicLandingPageRoute({ params }: RouteProps) {
  const { slug } = await params;
  const page = await fetchLandingPage(slug);

  // A real 404, not a 200 page that says "unavailable": these URLs are ad
  // destinations on the seller's own domain, so a soft-200 would let a typo'd
  // campaign link look healthy and would get the dead URL indexed.
  if (!page) {
    notFound();
  }

  return (
    <div className={FONT_VARIABLE_CLASSES}>
      <PublicLandingPageView page={page} />
    </div>
  );
}
