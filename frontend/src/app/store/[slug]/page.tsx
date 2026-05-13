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
    choosePackage: "প্যাকেজ নির্বাচন করুন",
    shipping: "শিপিং নির্বাচন করুন",
    upsell: "বিশেষ অফার",
    quantity: "পরিমাণ",
    packagePrice: "প্যাকেজ মূল্য",
    shippingFee: "শিপিং",
    upsellFee: "আপসেল",
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
    choosePackage: "Choose package",
    shipping: "Choose shipping",
    upsell: "Special offer",
    quantity: "Quantity",
    packagePrice: "Package price",
    shippingFee: "Shipping",
    upsellFee: "Upsell",
    total: "Total",
  },
};

type LockedCheckoutPackage = {
  id: string;
  title: string;
  price: number;
  badge?: string;
  is_default?: boolean;
};

type LockedShippingOption = {
  id: string;
  label: string;
  fee: number;
  is_default?: boolean;
};

type LockedCheckoutData = {
  packages: LockedCheckoutPackage[];
  shippingOptions: LockedShippingOption[];
  upsellEnabled: boolean;
  upsellLabel: string;
  upsellPrice: number;
};

function normalizeLockedCheckout(page: LandingPageData | null): LockedCheckoutData {
  const content = (page?.content_json ?? {}) as Record<string, unknown>;
  const checkout = (content.checkout ?? {}) as Record<string, unknown>;
  const upsell = (checkout.upsell ?? {}) as Record<string, unknown>;

  const packages = Array.isArray(checkout.packages)
    ? (checkout.packages as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        price: Number(item.price ?? 0),
        badge: item.badge ? String(item.badge) : undefined,
        is_default: Boolean(item.is_default),
      }))
    : [];

  const shippingOptions = Array.isArray(checkout.shipping_options)
    ? (checkout.shipping_options as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id ?? ""),
        label: String(item.label ?? ""),
        fee: Number(item.fee ?? 0),
        is_default: Boolean(item.is_default),
      }))
    : [];

  return {
    packages,
    shippingOptions,
    upsellEnabled: Boolean(upsell.enabled),
    upsellLabel: String(upsell.checkbox_label ?? "Add upsell"),
    upsellPrice: Number(upsell.price ?? 0),
  };
}

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
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedShippingId, setSelectedShippingId] = useState("");
  const [upsellChecked, setUpsellChecked] = useState(false);

  const buildTrackingPayload = (extra: Record<string, unknown> = {}) => {
    if (typeof window === "undefined") {
      return { slug, ...extra };
    }

    const sessionKey = "landing_session_id";
    const visitorKey = "landing_visitor_id";

    let sessionId = window.sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = `sess_${crypto.randomUUID()}`;
      window.sessionStorage.setItem(sessionKey, sessionId);
    }

    let visitorId = window.localStorage.getItem(visitorKey);
    if (!visitorId) {
      visitorId = `vis_${crypto.randomUUID()}`;
      window.localStorage.setItem(visitorKey, visitorId);
    }

    const params = new URLSearchParams(window.location.search);
    const source = (params.get("utm_source") ?? params.get("source") ?? document.referrer) || "direct";
    const device = /Mobi|Android/i.test(window.navigator.userAgent) ? "mobile" : "desktop";
    const country = String((window.navigator.language ?? "en-US").split("-")[1] ?? "BD").toUpperCase().slice(0, 2);

    return {
      slug,
      session_id: sessionId,
      visitor_id: visitorId,
      source,
      device,
      country,
      ...extra,
    };
  };

  const isLockedProfile = useMemo(() => {
    if (!page) return false;
    const content = (page.content_json ?? {}) as Record<string, unknown>;
    const profile = String((content.layout_profile ?? page.template?.layout_profile ?? "") as string);
    return page.template?.code === "naturiva_package_upsell" && profile === "naturiva_exact_clone_locked";
  }, [page]);

  const lockedCheckout = useMemo(() => normalizeLockedCheckout(page), [page]);

  const selectedPackage = useMemo(
    () => lockedCheckout.packages.find((item) => item.id === selectedPackageId) ?? null,
    [lockedCheckout.packages, selectedPackageId],
  );

  const selectedShipping = useMemo(
    () => lockedCheckout.shippingOptions.find((item) => item.id === selectedShippingId) ?? null,
    [lockedCheckout.shippingOptions, selectedShippingId],
  );

  useEffect(() => {
    if (!isLockedProfile) return;

    const defaultPkg = lockedCheckout.packages.find((item) => item.is_default) ?? lockedCheckout.packages[0];
    const defaultShipping = lockedCheckout.shippingOptions.find((item) => item.is_default) ?? lockedCheckout.shippingOptions[0];

    setSelectedPackageId(defaultPkg?.id ?? "");
    setSelectedShippingId(defaultShipping?.id ?? "");
    setUpsellChecked(false);
  }, [isLockedProfile, lockedCheckout.packages, lockedCheckout.shippingOptions]);

  const trackEvent = (type: string) => {
    void fetch(`${LANDING_API_BASE}/landing/track/cta`, {
      method: "POST",
      headers: buildApiHeaders(undefined, true),
      body: JSON.stringify(buildTrackingPayload({ type })),
    });
  };

  const trackCheckoutStart = () => {
    void fetch(`${LANDING_API_BASE}/landing/track/checkout-start`, {
      method: "POST",
      headers: buildApiHeaders(undefined, true),
      body: JSON.stringify(buildTrackingPayload()),
    });
  };

  const trackUpsellAccepted = () => {
    void fetch(`${LANDING_API_BASE}/landing/track/upsell`, {
      method: "POST",
      headers: buildApiHeaders(undefined, true),
      body: JSON.stringify(buildTrackingPayload()),
    });
  };

  const trackOrderComplete = (revenue: number) => {
    void fetch(`${LANDING_API_BASE}/landing/track/order-complete`, {
      method: "POST",
      headers: buildApiHeaders(undefined, true),
      body: JSON.stringify(buildTrackingPayload({ revenue })),
    });
  };

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
            body: JSON.stringify(buildTrackingPayload()),
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

  const lockedTotal = useMemo(() => {
    if (!isLockedProfile) return 0;
    const packagePrice = Number(selectedPackage?.price ?? 0);
    const shippingFee = Number(selectedShipping?.fee ?? 0);
    const upsellFee = upsellChecked && lockedCheckout.upsellEnabled ? Number(lockedCheckout.upsellPrice ?? 0) : 0;
    return packagePrice + shippingFee + upsellFee;
  }, [isLockedProfile, selectedPackage, selectedShipping, upsellChecked, lockedCheckout.upsellEnabled, lockedCheckout.upsellPrice]);

  const displayTotal = isLockedProfile ? lockedTotal : total;

  const scrollToCheckout = () => {
    trackEvent("cta_click_order_now");
    trackCheckoutStart();
    checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitOrder = async () => {
    if (!page) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      trackEvent("checkout_submit");

      const fallbackProductId = page.products?.[0]?.product_id;
      if (!fallbackProductId) {
        setError("No product attached to this landing page.");
        setSubmitting(false);
        return;
      }

      const payload = isLockedProfile
        ? {
            customer_name: customer.name,
            customer_phone: customer.phone,
            customer_address: customer.address,
            notes: customer.notes,
            selected_package_id: selectedPackageId,
            selected_shipping_id: selectedShippingId,
            upsell_checked: upsellChecked,
            shipping_charge: Number(selectedShipping?.fee ?? 0) + (upsellChecked && lockedCheckout.upsellEnabled ? Number(lockedCheckout.upsellPrice ?? 0) : 0),
            items: [
              {
                product_id: fallbackProductId,
                quantity: 1,
              },
            ],
          }
        : {
            customer_name: customer.name,
            customer_phone: customer.phone,
            customer_address: customer.address,
            notes: customer.notes,
            items: (page.products ?? []).map((item) => ({
              product_id: item.product_id,
              quantity: quantities[item.product_id] ?? Number(item.default_qty ?? 1),
            })),
          };

      const res = await fetch(`${LANDING_API_BASE}/landing/public/${slug}/order`, {
        method: "POST",
        headers: buildApiHeaders(undefined, true),
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse<{ order_number?: string }>(res);
      if (!res.ok) {
        setError(result.message ?? "Order failed.");
        return;
      }

      if (upsellChecked && lockedCheckout.upsellEnabled) {
        trackUpsellAccepted();
      }

      trackOrderComplete(displayTotal);
      trackEvent("order_success");
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
              {isLockedProfile ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold">{t.choosePackage}</h3>
                    <div className="mt-3 space-y-2">
                      {lockedCheckout.packages.map((pkg) => (
                        <label key={pkg.id} className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                          <div>
                            <p className="font-semibold">{pkg.title}</p>
                            <p className="text-sm text-[var(--muted)]">৳{Number(pkg.price ?? 0).toLocaleString()}</p>
                          </div>
                          <input
                            type="radio"
                            name="package"
                            checked={selectedPackageId === pkg.id}
                            onChange={() => {
                              setSelectedPackageId(pkg.id);
                              trackEvent("package_select");
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold">{t.shipping}</h3>
                    <div className="mt-3 space-y-2">
                      {lockedCheckout.shippingOptions.map((ship) => (
                        <label key={ship.id} className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                          <p className="text-sm font-semibold">{ship.label} - ৳{Number(ship.fee ?? 0).toLocaleString()}</p>
                          <input
                            type="radio"
                            name="shipping"
                            checked={selectedShippingId === ship.id}
                            onChange={() => {
                              setSelectedShippingId(ship.id);
                              trackEvent("shipping_select");
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {lockedCheckout.upsellEnabled ? (
                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                      <div>
                        <p className="text-sm font-bold">{t.upsell}</p>
                        <p className="text-xs text-[var(--muted)]">{lockedCheckout.upsellLabel} (+৳{Number(lockedCheckout.upsellPrice ?? 0).toLocaleString()})</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={upsellChecked}
                        onChange={(e) => {
                          setUpsellChecked(e.target.checked);
                          trackEvent("upsell_toggle");
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              ) : (
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
              )}

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
                {isLockedProfile ? (
                  <div className="space-y-2 text-sm font-semibold">
                    <div className="flex items-center justify-between"><span>{t.packagePrice}</span><span>৳{Number(selectedPackage?.price ?? 0).toLocaleString()}</span></div>
                    <div className="flex items-center justify-between"><span>{t.shippingFee}</span><span>৳{Number(selectedShipping?.fee ?? 0).toLocaleString()}</span></div>
                    <div className="flex items-center justify-between"><span>{t.upsellFee}</span><span>৳{(upsellChecked && lockedCheckout.upsellEnabled ? Number(lockedCheckout.upsellPrice ?? 0) : 0).toLocaleString()}</span></div>
                    <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-black"><span>{t.total}</span><span>৳{displayTotal.toLocaleString()}</span></div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{t.total}</span>
                    <span>৳{displayTotal.toLocaleString()}</span>
                  </div>
                )}
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
