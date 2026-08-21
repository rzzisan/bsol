"use client";

import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import { money } from "@/lib/storefront-client";

/**
 * Checkout submission (POST /public/storefront/orders) is S3, not built
 * yet — this page shows real cart contents/totals but "Proceed to
 * checkout" is intentionally disabled rather than pointing at a dead
 * endpoint. See seller_storefront_context.md §12.
 */
export default function CartRoute() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold">আপনার কার্ট খালি</p>
        <Link href="/search" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
          প্রোডাক্ট দেখুন
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">কার্ট</h1>

      <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 p-3">
            <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-slate-100">
              {item.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnail} alt={item.name} className="h-full w-full rounded-lg object-cover" />
              ) : null}
            </div>
            <div className="flex-1">
              <Link href={`/product/${item.slug}`} className="text-sm font-medium hover:underline">
                {item.name}
              </Link>
              <p className="text-sm text-slate-500">{money(item.unitPrice)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                className="h-7 w-7 rounded-lg border border-slate-200 text-sm"
              >
                −
              </button>
              <span className="w-6 text-center text-sm">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                className="h-7 w-7 rounded-lg border border-slate-200 text-sm"
              >
                +
              </button>
            </div>
            <div className="w-20 text-right text-sm font-semibold">{money(item.unitPrice * item.quantity)}</div>
            <button onClick={() => removeItem(item.productId)} className="text-slate-400 hover:text-red-500" aria-label="Remove">
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
        <span className="text-sm text-slate-500">সাবটোটাল</span>
        <span className="text-lg font-bold">{money(subtotal)}</span>
      </div>

      <button
        disabled
        title="চেকআউট শীঘ্রই আসছে"
        className="mt-4 w-full rounded-xl bg-slate-300 px-5 py-3 text-sm font-semibold text-slate-500"
      >
        চেকআউট (শীঘ্রই আসছে)
      </button>
    </div>
  );
}
