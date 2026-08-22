import { headers } from "next/headers";
import { CartProvider } from "@/lib/storefront-cart";
import { StorefrontTrackingProvider } from "@/lib/storefront-tracking-context";
import { StorefrontThemeProvider } from "@/lib/storefront-theme-context";
import { fetchCategories, fetchHome } from "@/lib/storefront-client";
import StandardShell from "@/components/storefront/templates/standard/StandardShell";
import CaresolutionShell from "@/components/storefront/templates/caresolution/CaresolutionShell";

/**
 * Shared chrome for every /store/* page (home, category, product, search,
 * cart, checkout, order) — seller_storefront_context.md §12 (S4/S5/S6).
 * Picks a Shell per the shop's `theme_template` — see the theme-templates
 * addendum for the full template-switch design.
 */

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (forwardedProto && host) return `${forwardedProto}://${host}`;
  if (host) return `https://${host}`;

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);
  const [home, categories] = await Promise.all([fetchHome(baseUrl), fetchCategories(baseUrl)]);
  const theme = home?.theme_template ?? "standard";
  const shippingRates = {
    insideDhaka: Number(home?.shipping_charge_inside_dhaka ?? 70),
    outsideDhaka: Number(home?.shipping_charge_outside_dhaka ?? 120),
  };

  const Shell = theme === "caresolution" ? CaresolutionShell : StandardShell;

  return (
    <StorefrontTrackingProvider tracking={home?.tracking ?? null}>
      <StorefrontThemeProvider theme={theme} shippingRates={shippingRates}>
        <CartProvider>
          <Shell home={home} categories={categories}>
            {children}
          </Shell>
        </CartProvider>
      </StorefrontThemeProvider>
    </StorefrontTrackingProvider>
  );
}
