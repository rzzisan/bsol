"use client";

import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import { useStorefrontTheme } from "@/lib/storefront-theme-context";
import StorefrontPageTracking from "@/components/storefront/page-tracking";
import StandardCartPage from "@/components/storefront/templates/standard/StandardCartPage";
import CaresolutionCartPage from "@/components/storefront/templates/caresolution/CaresolutionCartPage";

/**
 * Checkout (S3, COD-only) — see /store/checkout/page.tsx and
 * StorefrontCheckoutController's class docblock for the current scope.
 * Template switch per the theme-templates addendum.
 */
export default function CartRoute() {
  const { items } = useCart();
  const theme = useStorefrontTheme();

  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <StorefrontPageTracking slug="store-cart" viewContent={false} />
        <p className="text-lg font-semibold">আপনার কার্ট খালি</p>
        <Link href="/search" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
          প্রোডাক্ট দেখুন
        </Link>
      </div>
    );
  }

  return (
    <>
      <StorefrontPageTracking slug="store-cart" viewContent={false} />
      {theme === "caresolution" ? <CaresolutionCartPage /> : <StandardCartPage />}
    </>
  );
}
