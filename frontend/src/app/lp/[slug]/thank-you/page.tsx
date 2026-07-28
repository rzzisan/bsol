import type { Metadata } from "next";
import { headers } from "next/headers";
import type { PublicLandingPage } from "@/components/public-landing-page-view";
import ThankYouView, { type ThankYouOrder } from "@/components/thank-you-view";
import { FONT_VARIABLE_CLASSES } from "../fonts";

type RouteProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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

async function fetchLandingPage(baseUrl: string, slug: string) {
  const res = await fetch(`${baseUrl}/api/public/landing-pages/${slug}`, {
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.data) {
    return null;
  }

  return json.data as PublicLandingPage;
}

async function fetchOrder(baseUrl: string, slug: string, orderId: string, token: string) {
  const res = await fetch(
    `${baseUrl}/api/public/landing-pages/${slug}/orders/${orderId}?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.data) {
    return null;
  }

  return json.data as ThankYouOrder;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const headerList = await headers();
  const page = await fetchLandingPage(getBaseUrl(headerList), slug);

  return {
    title: page ? `ধন্যবাদ — ${page.title}` : "Landing page unavailable",
    robots: { index: false },
  };
}

export default async function ThankYouRoute({ params, searchParams }: RouteProps) {
  const [{ slug }, query, headerList] = await Promise.all([params, searchParams, headers()]);
  const baseUrl = getBaseUrl(headerList);

  const orderId = typeof query.order === "string" ? query.order : "";
  const token = typeof query.token === "string" ? query.token : "";

  const [page, order] = await Promise.all([
    fetchLandingPage(baseUrl, slug),
    orderId && token ? fetchOrder(baseUrl, slug, orderId, token) : Promise.resolve(null),
  ]);

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

  return (
    <div className={FONT_VARIABLE_CLASSES}>
      <ThankYouView page={page} order={order} orderId={orderId} token={token} />
    </div>
  );
}
