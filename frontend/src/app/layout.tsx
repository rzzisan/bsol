import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://bsol.zyrotechbd.com";
// Purpose-built 1200x630 banner (frontend/public/og-banner.png) — see
// homepage_redesign_context.md for how it was generated (SVG -> sharp,
// no browser round-trip needed). Replaces the earlier fallback of reusing
// the square app icon, which cropped awkwardly in FB/Twitter link previews.
const OG_IMAGE = `${SITE_URL}/og-banner.png`;
const OG_TITLE = "BSOL — বাংলাদেশি F-commerce ব্যবসার জন্য অল-ইন-ওয়ান প্ল্যাটফর্ম";
const OG_DESCRIPTION =
  "অর্ডার, ৫টি কুরিয়ার, ফেইক-অর্ডার প্রোটেকশন, ৭টি পেমেন্ট গেটওয়ে, ফেসবুক/হোয়াটসঅ্যাপ মার্কেটিং ও প্রফিট ট্র্যাকিং — সব এক জায়গায়। কার্ড ছাড়াই ফ্রি অ্যাকাউন্ট খুলুন।";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: OG_TITLE,
  description: OG_DESCRIPTION,
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: SITE_URL,
    siteName: "BSOL",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "BSOL" }],
    locale: "bn_BD",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
