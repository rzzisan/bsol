// Curated design options for the no-code landing page style panel — a
// merchant picks from these instead of typing hex codes or CSS. Shared by
// Quick Edit's Design panel (Phase 1) and the future block-based builder
// (Phase 2+) so both stay in sync.

export type ThemeSettings = {
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  button_text_color: string;
  font_family: string;
};

export const DEFAULT_THEME: ThemeSettings = {
  primary_color: "#0f766e",
  accent_color: "#f97316",
  background_color: "#f8fafc",
  text_color: "#0f172a",
  button_text_color: "#ffffff",
  font_family: "Hind Siliguri",
};

// Each preset is a full 5-color combination (not just a single swatch) so
// picking one instantly gives a merchant a coherent, tested look — matches
// "no coding, no color-theory knowledge required."
export const COLOR_PRESETS: Array<{ label: string; theme: Omit<ThemeSettings, "font_family"> }> = [
  {
    label: "Teal & Orange",
    theme: { primary_color: "#0f766e", accent_color: "#f97316", background_color: "#f8fafc", text_color: "#0f172a", button_text_color: "#ffffff" },
  },
  {
    label: "Forest & Amber",
    theme: { primary_color: "#15803d", accent_color: "#db7519", background_color: "#fefef3", text_color: "#111111", button_text_color: "#ffffff" },
  },
  {
    label: "Royal Blue",
    theme: { primary_color: "#1d4ed8", accent_color: "#f59e0b", background_color: "#f8fafc", text_color: "#0f172a", button_text_color: "#ffffff" },
  },
  {
    label: "Rose & Charcoal",
    theme: { primary_color: "#be123c", accent_color: "#111111", background_color: "#fff7f7", text_color: "#1a1a1a", button_text_color: "#ffffff" },
  },
  {
    label: "Purple Premium",
    theme: { primary_color: "#6d28d9", accent_color: "#f97316", background_color: "#faf9ff", text_color: "#1a1a1a", button_text_color: "#ffffff" },
  },
  {
    label: "Classic Black",
    theme: { primary_color: "#111111", accent_color: "#eab308", background_color: "#ffffff", text_color: "#111111", button_text_color: "#ffffff" },
  },
];

// Every entry must exist in Next.js's bundled Google Fonts list
// (verified against next/font/google's font-data.json) and be imported by
// name in frontend/src/app/lp/[slug]/page.tsx.
export const FONT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Hind Siliguri (ডিফল্ট)", value: "Hind Siliguri" },
  { label: "Noto Sans Bengali", value: "Noto Sans Bengali" },
  { label: "Tiro Bangla", value: "Tiro Bangla" },
  { label: "Anek Bangla", value: "Anek Bangla" },
  { label: "Poppins (Latin)", value: "Poppins" },
  { label: "Inter (Latin)", value: "Inter" },
];

// Maps a theme_settings.font_family value to the CSS custom property that
// frontend/src/app/lp/[slug]/page.tsx defines via next/font/google's
// `variable` option — single source of truth shared by the page (which
// loads the font files) and public-landing-page-view.tsx (which selects
// the right one at render time).
export const FONT_CSS_VARS: Record<string, string> = {
  "Hind Siliguri": "--font-hind-siliguri",
  "Noto Sans Bengali": "--font-noto-sans-bengali",
  "Tiro Bangla": "--font-tiro-bangla",
  "Anek Bangla": "--font-anek-bangla",
  Poppins: "--font-poppins",
  Inter: "--font-inter",
};

export function resolveFontCssVar(fontFamily: string | undefined | null): string {
  return FONT_CSS_VARS[fontFamily ?? ""] ?? FONT_CSS_VARS["Hind Siliguri"];
}
