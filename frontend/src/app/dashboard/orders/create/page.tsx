"use client";

import { useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import OrderIntakeForm, { type InitialOrderData } from "@/components/orders/order-intake-form";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { LANDING_API_BASE } from "@/lib/landing-pages";

export default function CreateOrderPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const token = getStoredToken();

  // "Convert to Order" from an abandoned checkout: ?from_abandoned_checkout=<id>.
  // Read via window.location.search (not useSearchParams) to avoid a Suspense
  // boundary requirement, matching the pattern in public-landing-page-view.tsx.
  const [initial, setInitial] = useState<InitialOrderData | undefined>(undefined);
  const [resolvingInitial, setResolvingInitial] = useState(true);

  useEffect(() => {
    const checkoutId = new URLSearchParams(window.location.search).get("from_abandoned_checkout");
    if (!checkoutId) {
      setResolvingInitial(false);
      return;
    }

    fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/${checkoutId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const c = json?.data;
        if (!c) return;
        const locationParts = [c.customer_district, c.customer_thana, c.customer_area].filter(Boolean);
        setInitial({
          abandonedCheckoutId: c.id,
          customer_phone: c.customer_phone ?? undefined,
          customer_name: c.customer_name ?? undefined,
          customer_address: c.customer_address ?? undefined,
          notes: c.notes ?? undefined,
          capturedLocationHint: locationParts.length ? locationParts.join(" / ") : undefined,
          items: Array.isArray(c.items)
            ? c.items.map((i: { product_id: number; quantity: number }) => ({ product_id: i.product_id, quantity: i.quantity }))
            : undefined,
        });
      })
      .catch(() => {})
      .finally(() => setResolvingInitial(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserShell
      activeKey="create-order"
      defaultExpandedKey="orders"
      pageTitle={{ bn: "নতুন অর্ডার", en: "New Order" }}
      pageSubtitle={{
        bn: "এক পেজেই দ্রুত গ্রাহক, পণ্য, পেমেন্টসহ অর্ডার নিন",
        en: "Take complete orders from one page with customer, items and payment",
      }}
    >
      {resolvingInitial ? (
        <p className="py-16 text-center text-[var(--muted)]">{locale === "bn" ? "লোড হচ্ছে..." : "Loading..."}</p>
      ) : (
        <OrderIntakeForm key={locale} initial={initial} />
      )}
    </UserShell>
  );
}
