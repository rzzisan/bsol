import type { CategorySummary, StorefrontHome } from "@/lib/storefront-client";
import { CaresolutionToastProvider } from "./caresolution-toast-context";
import CaresolutionHeader from "./CaresolutionHeader";
import CaresolutionMobileNav from "./CaresolutionMobileNav";
import CaresolutionFooter from "./CaresolutionFooter";
import CaresolutionFloatingCart from "./CaresolutionFloatingCart";
import CaresolutionWhatsAppFloat from "./CaresolutionWhatsAppFloat";

/**
 * CareSolution-style chrome (theme-templates addendum,
 * seller_storefront_context.md) — dark header + desktop category nav row,
 * mobile bottom tab bar + slide-in menu drawer, dark footer. Mirrors
 * StandardShell's role in app/store/layout.tsx.
 */
export default function CaresolutionShell({
  home,
  categories,
  children,
}: {
  home: StorefrontHome | null;
  categories: CategorySummary[] | null;
  children: React.ReactNode;
}) {
  return (
    <CaresolutionToastProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <CaresolutionHeader home={home} categories={categories} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-6">{children}</main>

        <CaresolutionFooter home={home} />

        <CaresolutionMobileNav home={home} categories={categories} />
        <CaresolutionFloatingCart />
        <CaresolutionWhatsAppFloat home={home} />
      </div>
    </CaresolutionToastProvider>
  );
}
