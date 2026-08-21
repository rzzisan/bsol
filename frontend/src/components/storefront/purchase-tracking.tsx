"use client";

import { useEffect, useRef } from "react";
import { useBsolTracking } from "@/lib/tracking";
import { useStorefrontTracking } from "@/lib/storefront-tracking-context";

/**
 * Fires Purchase once on the order-confirmation page's mount (S9,
 * seller_storefront_context.md §12) — the storefront's equivalent of
 * thank-you-view.tsx's own trackPurchase() call. event_id is
 * `order_{orderId}`, identical to SendFacebookCapiPurchaseEventJob's
 * server-side CAPI event id, so Meta dedupes the browser/server copies of
 * the same purchase against each other.
 */
export default function StorefrontPurchaseTracking({
  orderId,
  value,
  contentIds,
}: {
  orderId: number;
  value: number;
  contentIds: number[];
}) {
  const tracking = useStorefrontTracking();
  const { trackPurchase } = useBsolTracking({ slug: "store-order", tracking: tracking ?? undefined }, { viewContent: false });
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    trackPurchase(orderId, { value, currency: "BDT", content_ids: contentIds, content_type: "product" });
    // Fires once per mount by design — orderId/value/contentIds are stable
    // for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
