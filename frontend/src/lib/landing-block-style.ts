// Optional per-block design overrides, stored on each block item as `style`.
// Unset fields keep the block's normal look.
import type { CSSProperties } from "react";
import type { BlockType } from "@/lib/landing-layout";

export type BlockStyle = {
  bg_color?: string | null;
  text_color?: string | null;
  padding?: "none" | "sm" | "lg" | null;
  width?: "narrow" | "full" | null;
  align?: "left" | "center" | "right" | null;
  hide_mobile?: boolean | null;
  hide_desktop?: boolean | null;
};

// Consecutive items of these types render as one shared box, so the box
// takes its style from the first item of the run.
export const GROUPED_BLOCK_TYPES: BlockType[] = ["features", "trust_badges", "faq", "reviews"];

export function readBlockStyle(item: unknown): BlockStyle {
  const style = (item as { style?: unknown } | null)?.style;
  return style && typeof style === "object" ? (style as BlockStyle) : {};
}

export function hasBlockStyle(style: BlockStyle): boolean {
  return Object.values(style).some((value) => value !== null && value !== undefined && value !== false && value !== "");
}

// Literal class names so Tailwind picks them up.
const ALIGN_CLASSES = { left: "text-left", center: "text-center", right: "text-right" } as const;

export function blockStyleProps(style: BlockStyle): { className: string; style: CSSProperties } {
  const classes = ["lp-block"];
  if (style.bg_color) classes.push("lp-block-bg");
  if (style.text_color) classes.push("lp-block-fg");
  if (style.padding) classes.push(`lp-pad-${style.padding}`);
  if (style.width === "narrow") classes.push("mx-auto max-w-3xl");
  if (style.width === "full") classes.push("lp-block-full");
  if (style.align) classes.push(ALIGN_CLASSES[style.align]);
  if (style.hide_mobile) classes.push("max-sm:hidden");
  if (style.hide_desktop) classes.push("sm:hidden");

  const css: Record<string, string> = {};
  if (style.bg_color) css["--lp-block-bg"] = style.bg_color;
  if (style.text_color) css.color = style.text_color;
  return { className: classes.join(" "), style: css as CSSProperties };
}

// Block views draw their own `.lp-card`; these rules restyle that card from
// the wrapper so the views themselves stay unaware of block styles.
export const BLOCK_STYLE_CSS = `
  .lp-block-bg > * { background: var(--lp-block-bg) !important; border-color: transparent !important; }
  .lp-block-fg > *, .lp-block-fg h2, .lp-block-fg h3, .lp-block-fg p, .lp-block-fg summary { color: inherit !important; }
  .lp-pad-none > * { padding: 0 !important; }
  .lp-pad-sm > * { padding: 1rem !important; }
  .lp-pad-lg > * { padding: 2.5rem 1.5rem !important; }
  @media (min-width: 640px) { .lp-pad-lg > * { padding: 4rem 3rem !important; } }
  .lp-block-full { margin-inline: calc(50% - 50vw); }
  .lp-block-full > * { border-radius: 0 !important; }
`;
