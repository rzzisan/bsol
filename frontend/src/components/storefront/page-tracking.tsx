"use client";

import { useBsolTracking } from "@/lib/tracking";
import { useStorefrontTracking } from "@/lib/storefront-tracking-context";

/**
 * Invisible mount-effect wrapper around useBsolTracking() (S9,
 * seller_storefront_context.md §12) — one instance per page, never per
 * product card (see trackAddToCartEvent's docblock for why). Fires
 * PageView always, ViewContent only when `viewContent` isn't false.
 *
 * Reads the shop's tracking config from context (provided once in
 * app/store/layout.tsx) rather than taking it as a prop — a client Context
 * Provider in a layout reaches client components rendered anywhere inside
 * it, even through server-rendered page content, so every page gets it for
 * free without a second fetch.
 */
export default function StorefrontPageTracking({
  slug,
  viewContent,
  viewContentData,
}: {
  slug: string;
  viewContent?: boolean;
  viewContentData?: Record<string, unknown>;
}) {
  const tracking = useStorefrontTracking();
  useBsolTracking({ slug, tracking: tracking ?? undefined }, { viewContent, viewContentData });
  return null;
}
