"use client";

import { TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const buttonDefaults = () => ({ text: "", url: "", size: "md", full_width: false });

export function ButtonEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <>
      <TextField label={tr(locale, "বাটন টেক্সট", "Button text")} value={String(item.text ?? "")} onChange={(v) => patch({ text: v })} placeholder={tr(locale, "এখনই অর্ডার করুন", "Order now")} />
      <TextField label={tr(locale, "লিংক (খালি রাখলে অর্ডার ফর্মে যাবে)", "Link (empty scrolls to the order form)")} value={String(item.url ?? "")} onChange={(v) => patch({ url: v })} placeholder="https://" />
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label={tr(locale, "সাইজ", "Size")}
          value={String(item.size ?? "md")}
          onChange={(v) => patch({ size: v })}
          options={[
            { value: "md", label: tr(locale, "মাঝারি", "Medium") },
            { value: "lg", label: tr(locale, "বড়", "Large") },
          ]}
        />
        <label className="flex items-end gap-2 pb-2 text-xs text-[var(--foreground)]">
          <input type="checkbox" checked={Boolean(item.full_width)} onChange={(e) => patch({ full_width: e.target.checked })} />
          {tr(locale, "পুরো প্রস্থ জুড়ে", "Full width")}
        </label>
      </div>
    </>
  );
}
