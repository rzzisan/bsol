import type { Locale } from "@/lib/dashboard-client";

/**
 * JSON-LD structured data for the platform's own marketing homepage
 * (bn at "/", en at "/en" — seo_context.md). Not used anywhere else —
 * a seller's storefront/landing pages are a separate concern with their
 * own SEO surface (seller_storefront_context.md §12).
 */

const SITE_URL = "https://bsol.zyrotechbd.com";
const LOGO_URL = `${SITE_URL}/app-icon-1024.png`;

const COPY: Record<Locale, { name: string; description: string }> = {
  bn: {
    name: "BSOL",
    description:
      "অর্ডার, ৫টি কুরিয়ার, ফেইক-অর্ডার প্রোটেকশন, ৭টি পেমেন্ট গেটওয়ে, ফেসবুক/হোয়াটসঅ্যাপ মার্কেটিং ও প্রফিট ট্র্যাকিং — বাংলাদেশি F-commerce ব্যবসার জন্য অল-ইন-ওয়ান প্ল্যাটফর্ম।",
  },
  en: {
    name: "BSOL",
    description:
      "Orders, 5 couriers, fake-order protection, 7 payment gateways, Facebook/WhatsApp marketing, and profit tracking — the all-in-one platform for Bangladesh F-commerce businesses.",
  },
};

export function buildSoftwareApplicationJsonLd(locale: Locale) {
  const copy = COPY[locale];

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: copy.name,
    description: copy.description,
    url: locale === "bn" ? SITE_URL : `${SITE_URL}/en`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "BDT",
      description: locale === "bn" ? "কার্ড ছাড়াই ফ্রি অ্যাকাউন্ট" : "Free account, no card required",
    },
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zyrotech BSOL",
    url: SITE_URL,
    logo: LOGO_URL,
  };
}
