import type { Metadata } from "next";
import { headers } from "next/headers";
import { Hind_Siliguri, Noto_Sans_Bengali, Tiro_Bangla, Anek_Bangla, Poppins, Inter } from "next/font/google";
import PublicLandingPageView, { type PublicLandingPage } from "@/components/public-landing-page-view";

// One of these is picked at render time based on the page's
// theme_settings.font_family (see FONT_CSS_VARS in lib/theme-presets.ts) —
// all are loaded up front since next/font/google calls must be static,
// module-level expressions.
const hindSiliguri = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind-siliguri" });
const notoSansBengali = Noto_Sans_Bengali({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto-sans-bengali" });
const tiroBangla = Tiro_Bangla({ subsets: ["bengali"], weight: "400", variable: "--font-tiro-bangla" });
const anekBangla = Anek_Bangla({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-anek-bangla" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });

const FONT_VARIABLE_CLASSES = [hindSiliguri, notoSansBengali, tiroBangla, anekBangla, poppins, inter]
  .map((f) => f.variable)
  .join(" ");

type RouteProps = {
  params: Promise<{ slug: string }>;
};

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (forwardedProto && host) {
    return `${forwardedProto}://${host}`;
  }

  if (host) {
    return `https://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

async function fetchLandingPage(slug: string) {
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);

  const res = await fetch(`${baseUrl}/api/public/landing-pages/${slug}`, {
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.data) {
    return null;
  }

  return json.data as PublicLandingPage;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchLandingPage(slug);

  if (!page) {
    return {
      title: "Landing page unavailable",
      description: "The requested landing page could not be found.",
    };
  }

  return {
    title: page.seo_meta?.meta_title || page.title,
    description: page.seo_meta?.meta_description || page.content?.hero?.subheadline || page.title,
  };
}

export default async function PublicLandingPageRoute({ params }: RouteProps) {
  const { slug } = await params;
  const page = await fetchLandingPage(slug);

  if (!page) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-700">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Landing page unavailable</h1>
          <p className="mt-3 text-sm text-red-500">Landing page not found.</p>
        </div>
      </main>
    );
  }

  return (
    <div className={FONT_VARIABLE_CLASSES}>
      <PublicLandingPageView page={page} />
    </div>
  );
}
