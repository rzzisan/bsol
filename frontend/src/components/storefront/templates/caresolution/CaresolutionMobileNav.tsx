"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/storefront-cart";
import type { CategorySummary, StorefrontHome } from "@/lib/storefront-client";
import AuthPlaceholderButton from "@/components/storefront/auth-placeholder-button";
import TrackOrderPlaceholderButton from "./track-order-placeholder-button";

/**
 * Mobile-only fixed bottom tab bar (Home/Shop/Menu/Account) + the slide-in
 * "Menu" drawer it opens (phone, Login, Track Order, Categories
 * accordion) — mirrors the reference's mobile nav. Bundled into one
 * component since the drawer's open state belongs to the bottom bar's
 * "Menu" tab.
 */
export default function CaresolutionMobileNav({
  home,
  categories,
}: {
  home: StorefrontHome | null;
  categories: CategorySummary[] | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { itemCount } = useCart();

  return (
    <>
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs overflow-y-auto bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Menu</h2>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close" className="text-xl">
                ✕
              </button>
            </div>

            {home?.phone ? (
              <div className="mb-4 border-b border-slate-100 pb-4">
                <p className="text-sm font-bold">Phone</p>
                <p className="text-sm text-slate-500">{home.phone}</p>
              </div>
            ) : null}

            <div className="mb-4 border-b border-slate-100 pb-4">
              <p className="text-sm font-bold">Login</p>
              <div className="mt-1 text-sm text-slate-500">
                <AuthPlaceholderButton />
              </div>
            </div>

            <div className="mb-4 border-b border-slate-100 pb-4">
              <p className="text-sm font-bold">Track Order</p>
              <div className="mt-1 text-sm text-slate-500">
                <TrackOrderPlaceholderButton className="text-sm text-slate-500 hover:text-slate-900" />
              </div>
            </div>

            <p className="mb-2 text-sm font-bold">Categories</p>
            <nav className="divide-y divide-slate-100">
              {(categories ?? []).map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${c.slug}`}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-between py-3 text-sm text-slate-700"
                >
                  {c.name}
                  <span>+</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
        <Link href="/" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-slate-700">
          <span className="text-lg">🏠</span>
          Home
        </Link>
        <Link href="/search" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-slate-700">
          <span className="text-lg">🛍️</span>
          Shop
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-slate-700"
        >
          <span className="relative text-lg">
            ☰
            {itemCount > 0 ? (
              <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-0.5 text-[9px] font-bold text-white">
                {itemCount}
              </span>
            ) : null}
          </span>
          Menu
        </button>
        <button
          onClick={() => alert("কাস্টমার অ্যাকাউন্ট শীঘ্রই আসছে।")}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-slate-700"
        >
          <span className="text-lg">👤</span>
          Account
        </button>
      </nav>
    </>
  );
}
