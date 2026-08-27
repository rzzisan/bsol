import type { Metadata } from "next";

/**
 * page.tsx here is "use client" (fetches bn/en content from PlatformSetting
 * and toggles locally) so it can't export its own metadata — without this
 * wrapper it silently inherited the homepage's exact title/description
 * (seo_context.md). A neutral bilingual title is the practical fix short of
 * splitting this page into real bn/en URLs too, which isn't worth it for a
 * page with near-zero organic-search value.
 */
export const metadata: Metadata = {
  title: "ব্যবহারের শর্তাবলি | Terms of Use — BSOL",
  description: "BSOL ব্যবহারের শর্তাবলি। Terms of use for the BSOL platform.",
  alternates: { canonical: "/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
