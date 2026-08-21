"use client";

import { useCallback, useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "প্রোডাক্ট রিভিউ",
    intro: "কাস্টমারদের জমা দেওয়া রিভিউ অনুমোদন/প্রত্যাখ্যান করুন — অনুমোদিত রিভিউই প্রোডাক্ট পেজে দেখা যাবে।",
    tabPending: "অপেক্ষমাণ",
    tabApproved: "অনুমোদিত",
    tabAll: "সবগুলো",
    empty: "কোনো রিভিউ নেই।",
    approve: "অনুমোদন করুন",
    reject: "প্রত্যাখ্যান করুন",
    remove: "মুছে ফেলুন",
    loading: "লোড হচ্ছে...",
  },
  en: {
    pageTitle: "Product Reviews",
    intro: "Approve/reject customer-submitted reviews — only approved reviews show on the product page.",
    tabPending: "Pending",
    tabApproved: "Approved",
    tabAll: "All",
    empty: "No reviews.",
    approve: "Approve",
    reject: "Reject",
    remove: "Delete",
    loading: "Loading...",
  },
};

type Review = {
  id: number;
  customer_name: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
  product: { id: number; name: string; slug: string } | null;
};

export default function ProductReviewsPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const token = getStoredToken() ?? "";
  const txt = t[locale];

  const [status, setStatus] = useState<"pending" | "approved" | "all">("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reviews?status=${status}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setReviews(data?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [status, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setApproved(id: number, approved: boolean) {
    await fetch(`${API}/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_approved: approved }),
    });
    void load();
  }

  async function remove(id: number) {
    await fetch(`${API}/reviews/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    void load();
  }

  return (
    <UserShell activeKey="reviews" defaultExpandedKey="products" pageTitle={{ bn: "রিভিউ", en: "Reviews" }}>
      <div className="p-4 sm:p-5">
        <h1 className="text-xl font-bold sm:text-2xl">{txt.pageTitle}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{txt.intro}</p>

        <div className="mt-4 flex gap-2">
          {(["pending", "approved", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${status === s ? "bg-[var(--accent)] text-white" : "border border-[var(--border)]"}`}
            >
              {s === "pending" ? txt.tabPending : s === "approved" ? txt.tabApproved : txt.tabAll}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-[var(--muted)]">{txt.loading}</p>
        ) : reviews.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]">{txt.empty}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="catv-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {r.customer_name} — {"★".repeat(r.rating)}
                      <span className="text-[var(--muted)]">{"★".repeat(5 - r.rating)}</span>
                    </p>
                    <p className="text-xs text-[var(--muted)]">{r.product?.name ?? "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    {!r.is_approved ? (
                      <button onClick={() => setApproved(r.id, true)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                        {txt.approve}
                      </button>
                    ) : (
                      <button onClick={() => setApproved(r.id, false)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold">
                        {txt.reject}
                      </button>
                    )}
                    <button onClick={() => remove(r.id)} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white">
                      {txt.remove}
                    </button>
                  </div>
                </div>
                {r.comment ? <p className="mt-2 text-sm text-[var(--muted)]">{r.comment}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </UserShell>
  );
}
