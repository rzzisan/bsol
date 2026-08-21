"use client";

import { useState } from "react";
import { submitWalletClaim } from "@/lib/storefront-client";

const WALLET_LABELS: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };

/**
 * Shown on the order-confirmation page when payment_method is a personal
 * wallet provider and the order isn't paid yet — mirrors thank-you-view.tsx's
 * WalletClaimCard for the landing-page checkout. S3b (seller_storefront_context.md §12).
 */
export default function WalletClaimCard({ token, provider }: { token: string; provider: string }) {
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await submitWalletClaim(token, { provider, sender_number: senderNumber, customer_trx_id: trxId });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        পেমেন্টের তথ্য পাঠানো হয়েছে। সেলার যাচাই করার পর অর্ডার কনফার্ম হবে।
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
      <p className="text-sm font-semibold text-amber-800">
        {WALLET_LABELS[provider] ?? provider}-এ টাকা পাঠিয়ে নিচের তথ্য দিন
      </p>
      <input
        required
        placeholder="যে নম্বর থেকে পাঠিয়েছেন *"
        value={senderNumber}
        onChange={(e) => setSenderNumber(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <input
        required
        placeholder="ট্রানজেকশন আইডি (TrxID) *"
        value={trxId}
        onChange={(e) => setTrxId(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "পাঠানো হচ্ছে..." : "জমা দিন"}
      </button>
    </form>
  );
}
