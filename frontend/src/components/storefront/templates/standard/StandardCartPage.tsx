"use client";

import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import { money } from "@/lib/storefront-client";

/** The original storefront cart page (S3), extracted unchanged out of app/store/cart/page.tsx. */
export default function StandardCartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();
  const isDigitalCart = items.length > 0 && items.every((i) => i.productType === "digital");

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

      {isDigitalCart ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-700">
          ডিজিটাল প্রোডাক্ট এই মুহূর্তে স্টোরফ্রন্ট থেকে অনলাইন পেমেন্ট ছাড়া কেনা যাচ্ছে না — শীঘ্রই আসছে।
        </p>
      ) : (
        <Link
          href="/checkout"
          className="mt-4 block w-full rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
        >
          চেকআউট করুন
        </Link>
      )}
    </div>
  );
}
