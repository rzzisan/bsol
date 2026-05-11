"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import LandingRenderer from "@/components/landing-renderer";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";
import { buildApiHeaders, LANDING_API_BASE, readApiResponse, type LandingPageData } from "@/lib/landing";

const text = {
  bn: {
    loading: "লোড হচ্ছে...",
    notFound: "ল্যান্ডিং পেইজ পাওয়া যায়নি বা এখনও পাবলিশ হয়নি।",
    checkout: "অর্ডার ফর্ম",
    name: "আপনার নাম",
    phone: "ফোন নম্বর",
    address: "সম্পূর্ণ ঠিকানা",
    notes: "অতিরিক্ত নোট",
    submit: "অর্ডার কনফার্ম করুন",
    submitting: "অর্ডার হচ্ছে...",
    success: "আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে।",
    chooseProducts: "প্রডাক্ট নির্বাচন করুন",
    quantity: "পরিমাণ",
    total: "মোট",
  },
  en: {
    loading: "Loading...",
    notFound: "Landing page not found or not published yet.",
    checkout: "Order Form",
    name: "Your name",
    phone: "Phone number",
    address: "Full address",
    notes: "Additional notes",
    submit: "Confirm Order",
    submitting: "Submitting...",
    success: "Your order has been received successfully.",
    chooseProducts: "Choose products",
    quantity: "Quantity",
    total: "Total",
  },
};

export default function PublicLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<LandingPageData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const checkoutRef = useRef<HTMLDivElement | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", notes: "" });
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${LANDING_API_BASE}/landing/public/${slug}`, {
          headers: buildApiHeaders(),
        });
        const result = await readApiResponse<LandingPageData>(res);
        if (result.ok && result.data) {
          const pageData = result.data as LandingPageData;
          setPage(pageData);
          const initialQty: Record<number, number> = {};
          (pageData.products ?? []).forEach((item) => {
            initialQty[item.product_id] = Number(item.default_qty ?? 1);
          });
          setQuantities(initialQty);
          void fetch(`${LANDING_API_BASE}/landing/track/view`, {
            method: "POST",
            headers: buildApiHeaders(undefined, true),
            body: JSON.stringify({ slug }),
          });
        } else {
          setError(result.message ?? t.notFound);
        }
      } catch {
        setError(t.notFound);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug, t.notFound]);

  const total = useMemo(() => (page?.products ?? []).reduce((sum, item) => {
    const price = Number(item.custom_price ?? item.product?.selling_price ?? 0);
    const qty = quantities[item.product_id] ?? Number(item.default_qty ?? 1);
    return sum + price * qty;
  }, 0), [page, quantities]);

  const scrollToCheckout = () => {
    void fetch(`${LANDING_API_BASE}/landing/track/cta`, {
      method: "POST",
      headers: buildApiHeaders(undefined, true),
      body: JSON.stringify({ slug, type: "cta" }),
    });
    checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitOrder = async () => {
    if (!page) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await fetch(`${LANDING_API_BASE}/landing/track/cta`, {
        method: "POST",
        headers: buildApiHeaders(undefined, true),
        body: JSON.stringify({ slug, type: "checkout" }),
      });

      const res = await fetch(`${LANDING_API_BASE}/landing/public/${slug}/order`, {
        method: "POST",
        headers: buildApiHeaders(undefined, true),
        body: JSON.stringify({
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_address: customer.address,
          notes: customer.notes,
          items: (page.products ?? []).map((item) => ({
            product_id: item.product_id,
            quantity: quantities[item.product_id] ?? Number(item.default_qty ?? 1),
          })),
        }),
      });
      const result = await readApiResponse<{ order_number?: string }>(res);
      if (!res.ok) {
        setError(result.message ?? "Order failed.");
        return;
      }
      setMessage(`${t.success} #${result.data?.order_number ?? ""}`);
      setCustomer({ name: "", phone: "", address: "", notes: "" });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen p-6 text-center text-sm text-[var(--muted)]">{t.loading}</main>;
  }

  if (!page) {
    return <main className="min-h-screen p-6 text-center text-sm text-red-500">{error || t.notFound}</main>;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <LandingRenderer page={page} locale={locale} onPrimaryCta={scrollToCheckout} />

        <aside ref={checkoutRef} className="xl:sticky xl:top-4 xl:self-start">
          <div className="catv-panel overflow-hidden">
            <div className="bg-[var(--accent)] px-5 py-4 text-white">
              <h2 className="text-xl font-bold">{t.checkout}</h2>
              <p className="mt-1 text-sm text-white/85">{page.title}</p>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <h3 className="text-sm font-bold">{t.chooseProducts}</h3>
                <div className="mt-3 space-y-3">
                  {(page.products ?? []).map((item) => {
                    const qty = quantities[item.product_id] ?? Number(item.default_qty ?? 1);
                    const price = Number(item.custom_price ?? item.product?.selling_price ?? 0);
                    return (
                      <div key={item.product_id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.custom_title ?? item.product?.name ?? `Product #${item.product_id}`}</p>
                            <p className="text-sm text-[var(--muted)]">৳{price.toLocaleString()}</p>
                          </div>
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => setQuantities((prev) => ({ ...prev, [item.product_id]: Math.max(1, Number(e.target.value)) }))}
                            className="w-20 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                            aria-label={t.quantity}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.name}</span>
                <input value={customer.name} onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.phone}</span>
                <input value={customer.phone} onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.address}</span>
                <textarea value={customer.address} onChange={(e) => setCustomer((prev) => ({ ...prev, address: e.target.value }))} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.notes}</span>
                <textarea value={customer.notes} onChange={(e) => setCustomer((prev) => ({ ...prev, notes: e.target.value }))} rows={2} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>

              <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{t.total}</span>
                  <span>৳{total.toLocaleString()}</span>
                </div>
              </div>

              {error ? <div className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div> : null}
              {message ? <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">{message}</div> : null}

              <button onClick={() => void submitOrder()} disabled={submitting} className="w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
                {submitting ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
