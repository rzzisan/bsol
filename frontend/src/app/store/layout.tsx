import Link from "next/link";
import { headers } from "next/headers";
import { CartProvider } from "@/lib/storefront-cart";
import { fetchHome } from "@/lib/storefront-client";
import FloatingCartButton from "@/components/storefront/floating-cart-button";

/**
 * Shared chrome for every /store/* page (home, category, product, search,
 * cart) — seller_storefront_context.md §12 (S4/S6). A minimal top bar
 * (logo/shop name + browse link) rather than the full S5 homepage nav,
 * which ships later; this is enough for category/product/cart pages to be
 * reachable and navigable on their own.
 */

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (forwardedProto && host) return `${forwardedProto}://${host}`;
  if (host) return `https://${host}`;

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);
  const home = await fetchHome(baseUrl);

  return (
    <CartProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold">
              {home?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={home.logo_url} alt={home.shop_name ?? "Shop"} className="h-8 w-8 rounded-full object-cover" />
              ) : null}
              <span className="truncate">{home?.shop_name ?? "Shop"}</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/search" className="text-slate-600 hover:text-slate-900">
                সব প্রোডাক্ট
              </Link>
              <Link href="/cart" className="text-slate-600 hover:text-slate-900">
                কার্ট
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

        <FloatingCartButton />
      </div>
    </CartProvider>
  );
}
