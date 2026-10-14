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
  // Headings use font_family when unset.
  heading_font?: string | null;
  font_scale?: FontScale | null;
  button_shape?: ButtonShape | null;
};

export type FontScale = "sm" | "md" | "lg";
export type ButtonShape = "rounded" | "pill" | "square";

export const FONT_SCALE_PERCENT: Record<FontScale, number> = { sm: 93.75, md: 100, lg: 112.5 };
export const BUTTON_RADIUS: Record<ButtonShape, string> = { rounded: "1rem", pill: "9999px", square: "0.375rem" };

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

// A style kit sets colors, fonts and button shape together.
export const STYLE_KITS: Array<{ label: Record<"bn" | "en", string>; theme: ThemeSettings }> = [
  {
    label: { bn: "ক্লাসিক", en: "Classic" },
    theme: { ...DEFAULT_THEME, heading_font: null, font_scale: "md", button_shape: "rounded" },
  },
  {
    label: { bn: "আধুনিক", en: "Modern" },
    theme: { primary_color: "#1d4ed8", accent_color: "#f59e0b", background_color: "#f8fafc", text_color: "#0f172a", button_text_color: "#ffffff", font_family: "Hind Siliguri", heading_font: "Anek Bangla", font_scale: "md", button_shape: "pill" },
  },
  {
    label: { bn: "প্রিমিয়াম", en: "Premium" },
    theme: { primary_color: "#111111", accent_color: "#eab308", background_color: "#ffffff", text_color: "#111111", button_text_color: "#111111", font_family: "Noto Sans Bengali", heading_font: "Tiro Bangla", font_scale: "md", button_shape: "square" },
  },
  {
    label: { bn: "উজ্জ্বল অফার", en: "Bold Offer" },
    theme: { primary_color: "#be123c", accent_color: "#16a34a", background_color: "#fff7f7", text_color: "#1a1a1a", button_text_color: "#ffffff", font_family: "Hind Siliguri", heading_font: "Anek Bangla", font_scale: "lg", button_shape: "pill" },
  },
];

// Fills missing fields from DEFAULT_THEME for themes saved before a field existed.
export function normalizeTheme(source: Partial<Record<keyof ThemeSettings, unknown>> | null | undefined): ThemeSettings {
  const str = (value: unknown, fallback: string) => (typeof value === "string" && value ? value : fallback);
  const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
    (allowed as readonly unknown[]).includes(value) ? (value as T) : null;
  return {
    primary_color: str(source?.primary_color, DEFAULT_THEME.primary_color),
    accent_color: str(source?.accent_color, DEFAULT_THEME.accent_color),
    background_color: str(source?.background_color, DEFAULT_THEME.background_color),
    text_color: str(source?.text_color, DEFAULT_THEME.text_color),
    button_text_color: str(source?.button_text_color, DEFAULT_THEME.button_text_color),
    font_family: str(source?.font_family, DEFAULT_THEME.font_family),
    heading_font: typeof source?.heading_font === "string" && source.heading_font ? source.heading_font : null,
    font_scale: pick(source?.font_scale, ["sm", "md", "lg"] as const),
    button_shape: pick(source?.button_shape, ["rounded", "pill", "square"] as const),
  };
}

// Every entry must exist in Next.js's bundled Google Fonts list
// (verified against next/font/google's font-data.json) and be imported by
// name in frontend/src/app/lp/[slug]/page.tsx.
export function getFontOptions(locale: "bn" | "en" = "bn"): Array<{ label: string; value: string }> {
  return [
    { label: locale === "bn" ? "Hind Siliguri (ডিফল্ট)" : "Hind Siliguri (Default)", value: "Hind Siliguri" },
    { label: "Noto Sans Bengali", value: "Noto Sans Bengali" },
    { label: "Tiro Bangla", value: "Tiro Bangla" },
    { label: "Anek Bangla", value: "Anek Bangla" },
    { label: "Poppins (Latin)", value: "Poppins" },
    { label: "Inter (Latin)", value: "Inter" },
  ];
}

export const FONT_OPTIONS = getFontOptions("bn");

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
