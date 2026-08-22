"use client";

import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import { money } from "@/lib/storefront-client";

/** Right-edge floating cart badge (black "N ITEMS" / orange total) — matches the reference. */
export default function CaresolutionFloatingCart() {
  const { itemCount, subtotal } = useCart();

  if (itemCount === 0) return null;

  return (
    <Link
      href="/cart"
      className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-l-xl text-center text-xs font-bold text-white shadow-xl"
    >
      <span className="bg-black px-3 py-2">
        {itemCount} ITEM{itemCount > 1 ? "S" : ""}
      </span>
      <span className="bg-orange-600 px-3 py-2">{money(subtotal)}</span>
    </Link>
  );
}
