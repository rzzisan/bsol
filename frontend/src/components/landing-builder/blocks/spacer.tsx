"use client";

import { SelectField } from "./select-field";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const spacerDefaults = () => ({ style: "space", size: "md" });

export function SpacerEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <SelectField
        label={tr(locale, "স্টাইল", "Style")}
        value={String(item.style ?? "space")}
        onChange={(v) => patch({ style: v })}
        options={[
          { value: "space", label: tr(locale, "ফাঁকা জায়গা", "Blank space") },
          { value: "line", label: tr(locale, "লাইন", "Line") },
          { value: "dots", label: tr(locale, "ডট", "Dots") },
        ]}
      />
      <SelectField
        label={tr(locale, "সাইজ", "Size")}
        value={String(item.size ?? "md")}
        onChange={(v) => patch({ size: v })}
        options={[
          { value: "sm", label: tr(locale, "ছোট", "Small") },
          { value: "md", label: tr(locale, "মাঝারি", "Medium") },
          { value: "lg", label: tr(locale, "বড়", "Large") },
        ]}
      />
    </div>
  );
}
