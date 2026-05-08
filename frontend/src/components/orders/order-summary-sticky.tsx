"use client";

export default function OrderSummarySticky({
  subtotal,
  shipping,
  discount,
  total,
  onSubmit,
  submitting,
}: {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold">Order Summary</h3>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span>৳{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-[var(--muted)]">Shipping</span><span>৳{shipping.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-[var(--muted)]">Discount</span><span>- ৳{discount.toLocaleString()}</span></div>
          <div className="mt-2 flex justify-between border-t border-[var(--border)] pt-2 text-base font-bold"><span>Total</span><span>৳{total.toLocaleString()}</span></div>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create Order"}
        </button>
      </div>
    </aside>
  );
}
