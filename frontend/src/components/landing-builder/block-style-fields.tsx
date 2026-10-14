"use client";

import { Paintbrush } from "lucide-react";
import type { Locale } from "@/lib/dashboard-client";
import { hasBlockStyle, type BlockStyle } from "@/lib/landing-block-style";

const TEXT = {
  bn: {
    title: "ব্লক স্টাইল",
    custom: "কাস্টম",
    background: "ব্যাকগ্রাউন্ড",
    textColor: "লেখার রঙ",
    none: "ডিফল্ট",
    padding: "ভেতরের জায়গা",
    padNone: "নেই",
    padSm: "কম",
    padLg: "বেশি",
    width: "প্রস্থ",
    widthNarrow: "সরু",
    widthFull: "পুরো স্ক্রিন",
    align: "লেখার অ্যালাইনমেন্ট",
    left: "বামে",
    center: "মাঝে",
    right: "ডানে",
    hideMobile: "মোবাইলে লুকান",
    hideDesktop: "ডেস্কটপে লুকান",
    reset: "রিসেট",
    groupedHint: "এই ব্লক আগের একই ধরনের ব্লকের সাথে এক বক্সে দেখায়, তাই স্টাইল প্রথম ব্লক থেকে আসে।",
  },
  en: {
    title: "Block style",
    custom: "Custom",
    background: "Background",
    textColor: "Text color",
    none: "Default",
    padding: "Padding",
    padNone: "None",
    padSm: "Small",
    padLg: "Large",
    width: "Width",
    widthNarrow: "Narrow",
    widthFull: "Full screen",
    align: "Text alignment",
    left: "Left",
    center: "Center",
    right: "Right",
    hideMobile: "Hide on mobile",
    hideDesktop: "Hide on desktop",
    reset: "Reset",
    groupedHint: "This block shares one box with the block of the same type above it, so its style comes from the first one.",
  },
};

const selectClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs";

function OptionalColor({ label, value, onChange, noneLabel }: { label: string; value: string | null | undefined; onChange: (value: string | null) => void; noneLabel: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0"
        />
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-[var(--muted)] underline">{noneLabel}</button>
        ) : (
          <span className="text-xs text-[var(--muted)]">{noneLabel}</span>
        )}
      </div>
    </label>
  );
}

export function BlockStyleFields({
  style,
  onChange,
  locale,
  inheritsFromGroup,
}: {
  style: BlockStyle;
  onChange: (style: BlockStyle) => void;
  locale: Locale;
  // Grouped blocks after the first in a run take the first block's style.
  inheritsFromGroup: boolean;
}) {
  const t = TEXT[locale] ?? TEXT.en;
  const customized = hasBlockStyle(style);
  const patch = (changes: Partial<BlockStyle>) => onChange({ ...style, ...changes });

  return (
    <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
        <Paintbrush size={12} /> {t.title}
        {customized ? <span className="rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">{t.custom}</span> : null}
      </summary>
      {inheritsFromGroup ? (
        <p className="mt-2 text-xs text-[var(--muted)]">{t.groupedHint}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <OptionalColor label={t.background} value={style.bg_color} onChange={(v) => patch({ bg_color: v })} noneLabel={t.none} />
          <OptionalColor label={t.textColor} value={style.text_color} onChange={(v) => patch({ text_color: v })} noneLabel={t.none} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t.padding}</span>
            <select value={style.padding ?? ""} onChange={(e) => patch({ padding: (e.target.value || null) as BlockStyle["padding"] })} className={selectClass}>
              <option value="">{t.none}</option>
              <option value="none">{t.padNone}</option>
              <option value="sm">{t.padSm}</option>
              <option value="lg">{t.padLg}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t.width}</span>
            <select value={style.width ?? ""} onChange={(e) => patch({ width: (e.target.value || null) as BlockStyle["width"] })} className={selectClass}>
              <option value="">{t.none}</option>
              <option value="narrow">{t.widthNarrow}</option>
              <option value="full">{t.widthFull}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t.align}</span>
            <select value={style.align ?? ""} onChange={(e) => patch({ align: (e.target.value || null) as BlockStyle["align"] })} className={selectClass}>
              <option value="">{t.none}</option>
              <option value="left">{t.left}</option>
              <option value="center">{t.center}</option>
              <option value="right">{t.right}</option>
            </select>
          </label>
          <div className="space-y-1.5 self-end">
            <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
              <input type="checkbox" checked={Boolean(style.hide_mobile)} onChange={(e) => patch({ hide_mobile: e.target.checked || null })} />
              {t.hideMobile}
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
              <input type="checkbox" checked={Boolean(style.hide_desktop)} onChange={(e) => patch({ hide_desktop: e.target.checked || null })} />
              {t.hideDesktop}
            </label>
          </div>
          {customized ? (
            <button type="button" onClick={() => onChange({})} className="justify-self-start text-xs font-semibold text-red-400">{t.reset}</button>
          ) : null}
        </div>
      )}
    </details>
  );
}
