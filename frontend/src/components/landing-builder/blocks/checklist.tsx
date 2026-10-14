"use client";

import { TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const checklistDefaults = () => ({ title: "", items: "", icon: "check" });

export function ChecklistEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <>
      <TextField label={tr(locale, "শিরোনাম (ঐচ্ছিক)", "Title (optional)")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
      <TextAreaField label={tr(locale, "পয়েন্টগুলো (প্রতি লাইনে একটা)", "Points (one per line)")} value={String(item.items ?? "")} onChange={(v) => patch({ items: v })} rows={5} />
      <SelectField
        label={tr(locale, "আইকন", "Icon")}
        value={String(item.icon ?? "check")}
        onChange={(v) => patch({ icon: v })}
        options={[
          { value: "check", label: tr(locale, "টিক চিহ্ন", "Check mark") },
          { value: "cross", label: tr(locale, "ক্রস (সমস্যা বোঝাতে)", "Cross (for problems)") },
          { value: "star", label: tr(locale, "তারা", "Star") },
        ]}
      />
    </>
  );
}
