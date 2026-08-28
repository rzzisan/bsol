"use client";

import { useState } from "react";
import { submitReview } from "@/lib/storefront-client";

type Review = { customer_name: string; rating: number; comment: string | null; created_at: string };

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500">
      {"★".repeat(Math.round(value))}
      <span className="text-slate-300">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

/** Rating tab content — list of approved reviews + a submission form. S7. */
export default function ReviewsPanel({
  productSlug,
  average,
  count,
  reviews,
}: {
  productSlug: string;
  average: number;
  count: number;
  reviews: Review[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await submitReview(productSlug, { customer_name: name, rating, comment: comment || undefined });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          <Stars value={average} /> {average.toFixed(1)}/5 — {count}টি রিভিউ
        </p>
        {!showForm && !submitted ? (
          <button onClick={() => setShowForm(true)} className="text-xs font-semibold text-slate-600 hover:underline">
            রিভিউ লিখুন
          </button>
        ) : null}
      </div>

      {submitted ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          আপনার রিভিউ জমা হয়েছে, যাচাইয়ের পর প্রকাশিত হবে।
        </p>
      ) : showForm ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3">
          <input
            required
            placeholder="আপনার নাম *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className={n <= rating ? "text-amber-500" : "text-slate-300"}>
                ★
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            placeholder="মন্তব্য (ঐচ্ছিক)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "জমা হচ্ছে..." : "জমা দিন"}
          </button>
        </form>
      ) : null}

      <div className="mt-4 space-y-3">
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">এখনো কোনো রিভিউ নেই।</p>
        ) : (
          reviews.map((r, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{r.customer_name}</span>
                <Stars value={r.rating} />
              </div>
              {r.comment ? <p className="mt-1 text-sm text-slate-600">{r.comment}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
