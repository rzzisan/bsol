"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import { money, submitCheckout } from "@/lib/storefront-client";

/**
 * COD-only for now — see StorefrontCheckoutController's class docblock.
 * A digital-only cart is guarded client-side too (§6/§12, S3) so the
 * customer sees a clear reason instead of a generic backend error.
 */
export default function CheckoutRoute() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    customer_district: "",
    customer_thana: "",
    customer_area: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDigitalCart = items.length > 0 && items.every((i) => i.productType === "digital");

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

  if (isDigitalCart) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-800">
        ডিজিটাল প্রোডাক্ট এই মুহূর্তে স্টোরফ্রন্ট থেকে অনলাইন পেমেন্ট ছাড়া কেনা যাচ্ছে না — শীঘ্রই আসছে।
      </div>
    );
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await submitCheckout({
      ...form,
      customer_district: form.customer_district || undefined,
      customer_thana: form.customer_thana || undefined,
      customer_area: form.customer_area || undefined,
      notes: form.notes || undefined,
      items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    clear();
    router.push(`/order/${result.data.public_token}`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold">চেকআউট</h1>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center justify-between py-1 text-sm">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{money(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
          <span>সাবটোটাল</span>
          <span>{money(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">পেমেন্ট: ক্যাশ অন ডেলিভারি</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          required
          placeholder="নাম *"
          value={form.customer_name}
          onChange={(e) => setField("customer_name", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="ফোন নম্বর *"
          value={form.customer_phone}
          onChange={(e) => setField("customer_phone", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <textarea
          required
          rows={2}
          placeholder="ঠিকানা *"
          value={form.customer_address}
          onChange={(e) => setField("customer_address", e.target.value)}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="জেলা"
            value={form.customer_district}
            onChange={(e) => setField("customer_district", e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="থানা"
            value={form.customer_thana}
            onChange={(e) => setField("customer_thana", e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <input
          placeholder="এলাকা"
          value={form.customer_area}
          onChange={(e) => setField("customer_area", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <textarea
          rows={2}
          placeholder="অতিরিক্ত নোট (ঐচ্ছিক)"
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "অর্ডার হচ্ছে..." : "অর্ডার কনফার্ম করুন (COD)"}
        </button>
      </form>
    </div>
  );
}
