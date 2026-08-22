"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/storefront-cart";
import { money, type ProductSummary } from "@/lib/storefront-client";
import { useStorefrontTracking } from "@/lib/storefront-tracking-context";
import { trackAddToCartEvent } from "@/lib/tracking";
import { useCaresolutionToast } from "./caresolution-toast-context";

/**
 * CareSolution-style product card — SALE ribbon, strikethrough+bold
 * pricing, outline "Cart" + solid orange "Buy" buttons. Same base-product
 * add-to-cart semantics as the Standard ProductCard (no variant picker at
 * the card level, matching that component's existing behavior).
 */
export default function CaresolutionProductCard({ product }: { product: ProductSummary }) {
  const router = useRouter();
  const { addItem } = useCart();
  const tracking = useStorefrontTracking();
  const showToast = useCaresolutionToast();

  const discounted = Number(product.selling_price) < Number(product.regular_price);

  function add(): boolean {
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
      showToast("Product has been added to your cart.");
    } else {
      showToast("একই কার্টে ফিজিক্যাল ও ডিজিটাল প্রোডাক্ট একসাথে যোগ করা যায় না");
    }

    return result.ok;
  }

  function handleBuyNow() {
    if (add()) router.push("/checkout");
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Link href={`/product/${product.slug}`} className="relative block aspect-square bg-slate-100">
        {discounted ? (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
            SALE
          </span>
        ) : null}
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
          {discounted ? <span className="text-xs text-slate-400 line-through">{money(product.regular_price)}</span> : null}
          <span className="font-bold text-slate-900">{money(product.selling_price)}</span>
        </div>
        {!product.in_stock ? <span className="text-xs text-red-500">স্টক নেই</span> : null}
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => add()}
            disabled={!product.in_stock}
            className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
          >
            🛒 Cart
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!product.in_stock}
            className="flex-1 rounded-lg bg-orange-600 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}
