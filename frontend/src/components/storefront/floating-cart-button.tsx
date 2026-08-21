"use client";

import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import { money } from "@/lib/storefront-client";

/** Sticky bottom-right cart button, mirrors the reference design's mobile floating cart badge. */
export default function FloatingCartButton() {
  const { itemCount, subtotal } = useCart();

  if (itemCount === 0) return null;

  return (
    <Link
      href="/cart"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-slate-800 sm:bottom-6 sm:right-6"
    >
      <span className="relative">
        🛒
        <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold">
          {itemCount}
        </span>
      </span>
      <span>{money(subtotal)}</span>
    </Link>
  );
}
