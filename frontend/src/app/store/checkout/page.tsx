"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/storefront-cart";
import {
  fetchPaymentChannelsClient,
  initiateGateway,
  money,
  submitCheckout,
  type PaymentChannels,
} from "@/lib/storefront-client";
import { useStorefrontTracking } from "@/lib/storefront-tracking-context";
import { useStorefrontTheme } from "@/lib/storefront-theme-context";
import { useBsolTracking } from "@/lib/tracking";

const WALLET_LABELS: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };

/** COD + online payment (S3b) — see StorefrontCheckoutController's class docblock. */
export default function CheckoutRoute() {
  const router = useRouter();
  const { items, subtotal, clear, shippingLocation } = useCart();
  const theme = useStorefrontTheme();
  const tracking = useStorefrontTracking();
  const { trackInitiateCheckout } = useBsolTracking({ slug: "store-checkout", tracking: tracking ?? undefined }, { viewContent: false });

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    customer_district: "",
    customer_thana: "",
    customer_area: "",
    customer_email: "",
    notes: "",
  });
  const [channels, setChannels] = useState<PaymentChannels | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDigitalCart = items.length > 0 && items.every((i) => i.productType === "digital");

  useEffect(() => {
    if (items.length > 0) trackInitiateCheckout();
    // Fires once on mount with items present — matches the landing-page
    // checkout's own InitiateCheckout trigger point (§9).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPaymentChannelsClient().then((data) => {
      setChannels(data);
      if (isDigitalCart) {
        // COD isn't offered for digital carts — default to the first
        // available online channel instead.
        const firstOnline = data?.wallet_channels[0]?.provider ?? data?.gateway_channels[0]?.provider;
        if (firstOnline) setPaymentMethod(firstOnline);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const noOnlineChannels = isDigitalCart && !channels?.wallet_channels.length && !channels?.gateway_channels.length;
  if (noOnlineChannels) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-800">
        ডিজিটাল প্রোডাক্টের জন্য অনলাইন পেমেন্ট এখনো চালু করা হয়নি — সেলারের সাথে যোগাযোগ করুন।
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
      customer_email: form.customer_email || undefined,
      notes: form.notes || undefined,
      payment_method: paymentMethod,
      // Only the "caresolution" template's cart page exposes the Inside/
      // Outside Dhaka picker — omitted for Standard so existing sellers'
      // orders keep today's shipping_charge=0 behavior unchanged.
      shipping_location: theme === "caresolution" ? shippingLocation : undefined,
      items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    });

    if (!result.ok) {
      setError(result.message);
      setSubmitting(false);
      return;
    }

    const isGateway = channels?.gateway_channels.some((c) => c.provider === paymentMethod);
    if (isGateway) {
      const init = await initiateGateway(result.data.public_token, paymentMethod);
      if (init.ok) {
        clear();
        window.location.href = init.redirect_url;
        return;
      }
      // Order still exists even if the gateway session failed to open —
      // send the customer to the confirmation page rather than a dead end.
    }

    setSubmitting(false);
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
      </div>

      {/* Payment method */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">পেমেন্ট পদ্ধতি</h2>
        <div className="space-y-2">
          {channels?.cod_enabled && !isDigitalCart ? (
            <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${paymentMethod === "cod" ? "border-slate-900" : "border-slate-200"}`}>
              <input type="radio" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
              ক্যাশ অন ডেলিভারি
            </label>
          ) : null}
          {channels?.wallet_channels.map((ch) => (
            <label
              key={ch.provider}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${paymentMethod === ch.provider ? "border-slate-900" : "border-slate-200"}`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" checked={paymentMethod === ch.provider} onChange={() => setPaymentMethod(ch.provider)} />
                {WALLET_LABELS[ch.provider] ?? ch.provider} (Send Money)
              </span>
              <span className="text-xs text-slate-400">{ch.number}</span>
            </label>
          ))}
          {channels?.gateway_channels.map((ch) => (
            <label
              key={ch.provider}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize ${paymentMethod === ch.provider ? "border-slate-900" : "border-slate-200"}`}
            >
              <input type="radio" checked={paymentMethod === ch.provider} onChange={() => setPaymentMethod(ch.provider)} />
              {ch.provider}
            </label>
          ))}
        </div>
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
        {isDigitalCart ? (
          <input
            type="email"
            placeholder="ইমেইল (ডিজিটাল প্রোডাক্টের জন্য প্রয়োজন হতে পারে)"
            value={form.customer_email}
            onChange={(e) => setField("customer_email", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        ) : null}
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
          {submitting ? "অর্ডার হচ্ছে..." : "অর্ডার কনফার্ম করুন"}
        </button>
      </form>
    </div>
  );
}
