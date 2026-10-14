"use client";

import { COLOR_PRESETS, STYLE_KITS, getFontOptions, type ButtonShape, type FontScale, type ThemeSettings } from "@/lib/theme-presets";
import type { Locale } from "@/lib/dashboard-client";

type ColorFieldKey = "primary_color" | "accent_color" | "background_color" | "text_color" | "button_text_color";

type LandingDesignPanelProps = {
  locale: Locale;
  theme: ThemeSettings;
  onChange: (theme: ThemeSettings) => void;
};

const text = {
  bn: {
    title: "ডিজাইন — রঙ, ফন্ট ও বাটন",
    hint: "নিচের প্রি-সেট থেকে একটা থিম বেছে নিন, অথবা প্রতিটা রঙ আলাদাভাবে ঠিক করুন — কোনো কোড লেখার দরকার নেই।",
    presets: "প্রি-সেট থিম",
    primary: "প্রধান রঙ (হিরো ব্যাকগ্রাউন্ড)",
    accent: "অ্যাকসেন্ট রঙ (বাটন)",
    background: "পেজ ব্যাকগ্রাউন্ড",
    text: "লেখার রঙ",
    buttonText: "বাটনের লেখার রঙ",
    font: "ফন্ট",
    styleKits: "স্টাইল কিট (রঙ, ফন্ট ও বাটন একসাথে)",
    headingFont: "হেডিং ফন্ট",
    sameAsBody: "মূল ফন্টের মতো",
    fontScale: "লেখার সাইজ",
    scaleSm: "ছোট",
    scaleMd: "স্বাভাবিক",
    scaleLg: "বড়",
    buttonShape: "বাটনের আকার",
    shapeRounded: "গোলাকার কোণা",
    shapePill: "পিল",
    shapeSquare: "চৌকো",
  },
  en: {
    title: "Design — Colors, Fonts & Buttons",
    hint: "Pick a preset theme below, or fine-tune each color yourself — no code required.",
    presets: "Preset Themes",
    primary: "Primary Color (hero background)",
    accent: "Accent Color (buttons)",
    background: "Page Background",
    text: "Text Color",
    buttonText: "Button Text Color",
    font: "Font",
    styleKits: "Style kits (colors, fonts and buttons together)",
    headingFont: "Heading font",
    sameAsBody: "Same as body font",
    fontScale: "Text size",
    scaleSm: "Small",
    scaleMd: "Normal",
    scaleLg: "Large",
    buttonShape: "Button shape",
    shapeRounded: "Rounded",
    shapePill: "Pill",
    shapeSquare: "Square",
  },
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-xs text-[var(--muted)]">{value}</span>
      </div>
    </label>
  );
}

export default function LandingDesignPanel({ locale, theme, onChange }: LandingDesignPanelProps) {
  const t = text[locale] ?? text.en;
  const fontOptions = getFontOptions(locale);

  function patch(changes: Partial<ThemeSettings>) {
    onChange({ ...theme, ...changes });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h4>
      <p className="mt-1 text-sm text-[var(--muted)]">{t.hint}</p>

      <div className="mt-3">
        <span className="mb-2 block text-xs font-medium text-[var(--foreground)]">{t.styleKits}</span>
        <div className="flex flex-wrap gap-2">
          {STYLE_KITS.map((kit) => (
            <button
              key={kit.label.en}
              type="button"
              onClick={() => onChange({ ...kit.theme })}
              className="flex items-center gap-1.5 border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--accent)]"
              style={{ borderRadius: kit.theme.button_shape === "square" ? "0.375rem" : "9999px" }}
            >
              <span className="flex h-4 w-4 overflow-hidden rounded-full border border-black/10">
                <span className="h-full w-1/2" style={{ backgroundColor: kit.theme.primary_color }} />
                <span className="h-full w-1/2" style={{ backgroundColor: kit.theme.accent_color }} />
              </span>
              {kit.label[locale] ?? kit.label.en}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <span className="mb-2 block text-xs font-medium text-[var(--foreground)]">{t.presets}</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => patch(preset.theme)}
              title={preset.label}
              className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--accent)]"
            >
              <span className="flex h-4 w-4 overflow-hidden rounded-full border border-black/10">
                <span className="h-full w-1/2" style={{ backgroundColor: preset.theme.primary_color }} />
                <span className="h-full w-1/2" style={{ backgroundColor: preset.theme.accent_color }} />
              </span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ColorField label={t.primary} value={theme.primary_color} onChange={(v) => patch({ primary_color: v })} />
        <ColorField label={t.accent} value={theme.accent_color} onChange={(v) => patch({ accent_color: v })} />
        <ColorField label={t.background} value={theme.background_color} onChange={(v) => patch({ background_color: v })} />
        <ColorField label={t.text} value={theme.text_color} onChange={(v) => patch({ text_color: v })} />
        <ColorField label={t.buttonText} value={theme.button_text_color} onChange={(v) => patch({ button_text_color: v })} />

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t.font}</span>
          <select
            value={theme.font_family}
            onChange={(e) => patch({ font_family: e.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          >
            {fontOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t.headingFont}</span>
          <select
            value={theme.heading_font ?? ""}
            onChange={(e) => patch({ heading_font: e.target.value || null })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          >
            <option value="">{t.sameAsBody}</option>
            {fontOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t.fontScale}</span>
          <select
            value={theme.font_scale ?? "md"}
            onChange={(e) => patch({ font_scale: e.target.value as FontScale })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          >
            <option value="sm">{t.scaleSm}</option>
            <option value="md">{t.scaleMd}</option>
            <option value="lg">{t.scaleLg}</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t.buttonShape}</span>
          <select
            value={theme.button_shape ?? "rounded"}
            onChange={(e) => patch({ button_shape: e.target.value as ButtonShape })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
          >
            <option value="rounded">{t.shapeRounded}</option>
            <option value="pill">{t.shapePill}</option>
            <option value="square">{t.shapeSquare}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
