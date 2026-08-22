"use client";

import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import { useStorefrontShippingRates } from "@/lib/storefront-theme-context";
import { money } from "@/lib/storefront-client";

/**
 * CareSolution-style cart page — Cart Items card + Order Summary card with
 * the real Inside/Outside Dhaka shipping selector (confirmed decision, see
 * the theme-templates addendum). No Promo Code, no Tax/Discount — neither
 * is a real feature yet.
 */
export default function CaresolutionCartPage() {
  const { items, removeItem, updateQuantity, subtotal, shippingLocation, setShippingLocation } = useCart();
  const { insideDhaka, outsideDhaka } = useStorefrontShippingRates();
  const isDigitalCart = items.length > 0 && items.every((i) => i.productType === "digital");
  const shipping = shippingLocation === "outside_dhaka" ? outsideDhaka : insideDhaka;
  const total = subtotal + shipping;

  return (
    <div>
      <h1 className="text-xl font-bold">Shopping Cart</h1>
      <p className="mt-1 text-sm text-slate-500">{items.length} items in your cart</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white lg:col-span-2">
          {items.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 p-4">
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
                <div className="mt-2 flex items-center gap-2">
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
              </div>
              <button onClick={() => removeItem(item.productId)} className="self-start text-slate-400 hover:text-red-500" aria-label="Remove">
                🗑️
              </button>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold">Order Summary</h2>

          {!isDigitalCart ? (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500">Shipping Location</p>
              <div className="mt-2 space-y-2 text-sm">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={shippingLocation === "inside_dhaka"}
                      onChange={() => setShippingLocation("inside_dhaka")}
                    />
                    Inside Dhaka
                  </span>
                  <span className="text-slate-500">{money(insideDhaka)}</span>
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={shippingLocation === "outside_dhaka"}
                      onChange={() => setShippingLocation("outside_dhaka")}
                    />
                    Outside Dhaka
                  </span>
                  <span className="text-slate-500">{money(outsideDhaka)}</span>
                </label>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {!isDigitalCart ? (
              <div className="flex justify-between text-slate-500">
                <span>Shipping</span>
                <span>{money(shipping)}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="font-bold">Total</span>
            <span className="text-lg font-bold">{money(isDigitalCart ? subtotal : total)}</span>
          </div>

          {isDigitalCart ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-xs text-amber-700">
              ডিজিটাল প্রোডাক্ট এই মুহূর্তে স্টোরফ্রন্ট থেকে অনলাইন পেমেন্ট ছাড়া কেনা যাচ্ছে না — শীঘ্রই আসছে।
            </p>
          ) : (
            <Link
              href="/checkout"
              className="mt-4 block w-full rounded-xl bg-orange-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-orange-700"
            >
              Proceed to Checkout
            </Link>
          )}

          <p className="mt-3 text-center text-[11px] text-slate-400">🔒 Secure Checkout &nbsp; ✓ SSL Protected</p>
        </div>
      </div>
    </div>
  );
}
