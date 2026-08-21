"use client";

import { createContext, useContext } from "react";
import type { TrackingConfig } from "@/lib/tracking";

/**
 * Shares the shop's tracking config (fetched once in app/store/layout.tsx,
 * a server component) with client components scattered across every /store
 * page — ProductCard in particular, which renders many times per page and
 * would otherwise need `tracking` prop-drilled through every parent or
 * re-fetched per card. S9, seller_storefront_context.md §12.
 */
const StorefrontTrackingContext = createContext<TrackingConfig>(null);

export function StorefrontTrackingProvider({
  tracking,
  children,
}: {
  tracking: TrackingConfig;
  children: React.ReactNode;
}) {
  return <StorefrontTrackingContext.Provider value={tracking}>{children}</StorefrontTrackingContext.Provider>;
}

export function useStorefrontTracking(): TrackingConfig {
  return useContext(StorefrontTrackingContext);
}
