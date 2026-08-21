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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {shop.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.logo_url}
            alt={shop.shop_name}
            style={{ height: 64, marginBottom: 16, display: "inline-block" }}
          />
        ) : null}
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>{shop.shop_name}</h1>
        <p style={{ margin: "0 0 4px", color: "#475569", fontSize: 15 }}>
          অনলাইন শপ শীঘ্রই আসছে
        </p>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
          Full storefront coming soon.
        </p>
      </div>
    </main>
  );
}
