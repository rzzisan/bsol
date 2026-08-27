import type { Metadata } from "next";
import HomeContent from "@/components/marketing/home-content";
import { buildOrganizationJsonLd, buildSoftwareApplicationJsonLd } from "@/lib/seo";

const TITLE = "BSOL — The All-in-One Platform for Bangladesh F-commerce Businesses";
const DESCRIPTION =
  "Orders, 5 couriers, fake-order protection, 7 payment gateways, Facebook/WhatsApp marketing, and profit tracking — all in one place. Create a free account, no card required.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/en",
    languages: {
      "bn-BD": "/",
      en: "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/en",
    siteName: "BSOL",
    images: [{ url: "/og-banner.png", width: 1200, height: 630, alt: "BSOL" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-banner.png"],
  },
};

export default function EnglishHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSoftwareApplicationJsonLd("en")) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd()) }}
      />
      <HomeContent initialLocale="en" />
    </>
  );
}
