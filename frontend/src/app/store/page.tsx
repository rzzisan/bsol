import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

/**
 * Storefront homepage — S0 placeholder (seller_storefront_context.md §12).
 * Reached only via proxy.ts's rewrite of `/` on a seller subdomain when
 * homepage_mode is 'storefront' (the default); never a direct public URL
 * (proxy.ts 404s a direct /store hit). The real catalog homepage (banner,
 * featured categories, top-selling grid, category rows) ships in S5/S6 —
 * this just proves the routing end-to-end and stops root from redirecting
 * to the platform login (the bug this phase fixes).
 */

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

type ShopInfo = { shop_name: string; logo_url: string | null };

async function fetchShop(): Promise<ShopInfo | null> {
  const headerList = await headers();
  const label = headerList.get("x-bsol-shop-subdomain");

  if (!label) {
    return null;
  }

  const baseUrl = getBaseUrl(headerList);
  const res = await fetch(`${baseUrl}/api/public/shop-by-subdomain/${encodeURIComponent(label)}`, {
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.data) {
    return null;
  }

  return { shop_name: json.data.shop_name, logo_url: json.data.logo_url ?? null };
}

export async function generateMetadata(): Promise<Metadata> {
  const shop = await fetchShop();

  return {
    title: shop ? shop.shop_name : "Shop",
    robots: shop ? undefined : { index: false },
  };
}

export default async function StorefrontHomeRoute() {
  const shop = await fetchShop();

  if (!shop) {
    notFound();
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      {shop.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.logo_url} alt={shop.shop_name} className="h-16 w-16 rounded-full object-cover" />
      ) : null}
      <div>
        <h1 className="text-xl font-bold">{shop.shop_name}</h1>
        <p className="mt-1 text-sm text-slate-500">পূর্ণাঙ্গ হোমপেজ (ব্যানার, ক্যাটাগরি) শীঘ্রই আসছে</p>
      </div>
      <a
        href="/search"
        className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        সব প্রোডাক্ট দেখুন
      </a>
    </div>
  );
}
