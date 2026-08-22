"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/storefront-cart";
import { money, type ProductSummary } from "@/lib/storefront-client";
import { useStorefrontTracking } from "@/lib/storefront-tracking-context";
import { useStorefrontTheme } from "@/lib/storefront-theme-context";
import { trackAddToCartEvent } from "@/lib/tracking";
import CaresolutionProductCard from "./templates/caresolution/CaresolutionProductCard";

/**
 * Reused on Home, Category, Search, and "related products" — branching
 * here reskins all four surfaces for the "caresolution" template with no
 * other page needing to change. See seller_storefront_context.md's
 * theme-templates addendum.
 */
export default function ProductCard({ product }: { product: ProductSummary }) {
  const theme = useStorefrontTheme();
  const { addItem } = useCart();
  const tracking = useStorefrontTracking();
  const [message, setMessage] = useState<string | null>(null);

  if (theme === "caresolution") {
    return <CaresolutionProductCard product={product} />;
  }

  const discounted = Number(product.selling_price) < Number(product.regular_price);

  function handleAddToCart() {
    const result = addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      thumbnail: product.thumbnail,
      unitPrice: Number(product.selling_price),
      productType: product.product_type,
    });

    if (result.ok) {
      trackAddToCartEvent(tracking, `store-product-${product.slug}`, {
        content_ids: [product.id],
        content_name: product.name,
        value: Number(product.selling_price),
        currency: "BDT",
      });
    }

    setMessage(result.ok ? "কার্টে যোগ হয়েছে" : "একই কার্টে ফিজিক্যাল ও ডিজিটাল প্রোডাক্ট একসাথে যোগ করা যায় না");
    window.setTimeout(() => setMessage(null), 2500);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Link href={`/product/${product.slug}`} className="block aspect-square bg-slate-100">
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt={product.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">No image</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={`/product/${product.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">
          {product.name}
        </Link>
        <div className="mt-auto flex items-baseline gap-2">
          <span className="font-bold">{money(product.selling_price)}</span>
          {discounted ? <span className="text-xs text-slate-400 line-through">{money(product.regular_price)}</span> : null}
        </div>
        {!product.in_stock ? <span className="text-xs text-red-500">স্টক নেই</span> : null}
        <button
          onClick={handleAddToCart}
          disabled={!product.in_stock}
          className="mt-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Add to Cart
        </button>
        {message ? <p className="text-[11px] text-slate-500">{message}</p> : null}
      </div>
    </div>
  );
}
