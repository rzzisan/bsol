import { Hind_Siliguri, Noto_Sans_Bengali, Tiro_Bangla, Anek_Bangla, Poppins, Inter } from "next/font/google";

// One of these is picked at render time based on the page's
// theme_settings.font_family (see FONT_CSS_VARS in lib/theme-presets.ts) —
// all are loaded up front since next/font/google calls must be static,
// module-level expressions. Shared by the landing page and its thank-you page.
// Only the default font (Hind Siliguri) is preloaded: preloading all six
// made every page fetch fonts it never uses. The others still load, just on
// first use instead of up front.
const hindSiliguri = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind-siliguri" });
const notoSansBengali = Noto_Sans_Bengali({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], preload: false, variable: "--font-noto-sans-bengali" });
const tiroBangla = Tiro_Bangla({ subsets: ["bengali"], weight: "400", preload: false, variable: "--font-tiro-bangla" });
const anekBangla = Anek_Bangla({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], preload: false, variable: "--font-anek-bangla" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], preload: false, variable: "--font-poppins" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], preload: false, variable: "--font-inter" });

export const FONT_VARIABLE_CLASSES = [hindSiliguri, notoSansBengali, tiroBangla, anekBangla, poppins, inter]
  .map((f) => f.variable)
  .join(" ");
