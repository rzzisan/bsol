"use client";

import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import type { CategorySummary, StorefrontHome } from "@/lib/storefront-client";
import AuthPlaceholderButton from "@/components/storefront/auth-placeholder-button";
import TrackOrderPlaceholderButton from "./track-order-placeholder-button";

/** Dark top bar + search + (desktop-only) category nav row — reference's header. */
export default function CaresolutionHeader({
  home,
  categories,
}: {
  home: StorefrontHome | null;
  categories: CategorySummary[] | null;
}) {
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-30 bg-neutral-950 text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-extrabold">
          {home?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={home.logo_url} alt={home.shop_name ?? "Shop"} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span>🛒</span>
          )}
          <span className="truncate">{home?.shop_name ?? "Shop"}</span>
        </Link>

        <form action="/search" method="GET" className="hidden flex-1 items-center sm:flex">
          <input
            name="q"
            placeholder="Search for something..."
            className="w-full rounded-l-full border-0 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none"
          />
          <button type="submit" className="rounded-r-full bg-orange-600 px-4 py-2 text-sm font-semibold">
            🔍
          </button>
        </form>

        <nav className="ml-auto hidden items-center gap-4 text-sm sm:flex">
          <TrackOrderPlaceholderButton />
          <AuthPlaceholderButton />
        </nav>

        <Link href="/cart" className="relative shrink-0 text-xl">
          🛒
          {itemCount > 0 ? (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold">
              {itemCount}
            </span>
          ) : null}
        </Link>
      </div>

      <form action="/search" method="GET" className="flex items-center px-4 pb-3 sm:hidden">
        <input
          name="q"
          placeholder="Search for something..."
          className="w-full rounded-l-full border-0 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none"
        />
        <button type="submit" className="rounded-r-full bg-orange-600 px-4 py-2 text-sm font-semibold">
          🔍
        </button>
      </form>

      {categories && categories.length > 0 ? (
        <div
          className="hidden border-t border-white/10 sm:block"
          style={{ background: home?.nav_bg_color || "#111827", color: home?.nav_text_color || "#ffffff" }}
        >
          <div className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 py-2.5 text-sm font-medium">
            {categories.map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="whitespace-nowrap opacity-90 hover:opacity-100">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
