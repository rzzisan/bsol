import type { Metadata } from "next";

/**
 * Same reasoning as terms/layout.tsx — page.tsx is "use client" and can't
 * export its own metadata, so without this it silently inherited the
 * homepage's title/description (seo_context.md).
 */
export const metadata: Metadata = {
  title: "গোপনীয়তা নীতি | Privacy Policy — BSOL",
  description: "BSOL গোপনীয়তা নীতি। Privacy policy for the BSOL platform.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
