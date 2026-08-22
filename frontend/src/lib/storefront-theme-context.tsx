"use client";

import { createContext, useContext } from "react";
import type { ThemeTemplate } from "@/lib/storefront-client";

/**
 * Shares the shop's chosen design template (+ the two shipping rates the
 * "caresolution" template's cart page needs) with client components
 * scattered across /store/* — same rationale as
 * storefront-tracking-context.tsx: seeded once in app/store/layout.tsx
 * (already fetched `home` there) instead of re-fetched per component.
 * See the theme-templates addendum in seller_storefront_context.md.
 */
export type ShippingRates = { insideDhaka: number; outsideDhaka: number };

type StorefrontThemeValue = { theme: ThemeTemplate; shippingRates: ShippingRates };

const DEFAULT_VALUE: StorefrontThemeValue = {
  theme: "standard",
  shippingRates: { insideDhaka: 70, outsideDhaka: 120 },
};

const StorefrontThemeContext = createContext<StorefrontThemeValue>(DEFAULT_VALUE);

export function StorefrontThemeProvider({
  theme,
  shippingRates,
  children,
}: {
  theme: ThemeTemplate;
  shippingRates: ShippingRates;
  children: React.ReactNode;
}) {
  return (
    <StorefrontThemeContext.Provider value={{ theme, shippingRates }}>{children}</StorefrontThemeContext.Provider>
  );
}

export function useStorefrontTheme(): ThemeTemplate {
  return useContext(StorefrontThemeContext).theme;
}

export function useStorefrontShippingRates(): ShippingRates {
  return useContext(StorefrontThemeContext).shippingRates;
}
