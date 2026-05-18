import type { Metadata } from "next";
import { headers } from "next/headers";
import PublicLandingPageView, { type PublicLandingPage } from "@/components/public-landing-page-view";

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

  if (!page) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-700">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Landing page unavailable</h1>
          <p className="mt-3 text-sm text-red-500">Landing page not found.</p>
        </div>
      </main>
    );
  }

  return <PublicLandingPageView page={page} />;
}
