"use client";

import { ImagePickerField, TextField } from "@/components/landing-builder/block-fields";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const beforeAfterDefaults = () => ({ title: "", before_url: "", after_url: "", before_label: "", after_label: "" });

export function BeforeAfterEditor({ item, patch, locale, openMedia }: BlockEditorProps) {
  return (
    <>
      <TextField label={tr(locale, "শিরোনাম (ঐচ্ছিক)", "Title (optional)")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
      <div className="grid grid-cols-2 gap-2">
        <ImagePickerField label={tr(locale, "আগের ছবি", "Before image")} value={String(item.before_url ?? "")} locale={locale} onPick={() => openMedia("before_url")} />
        <ImagePickerField label={tr(locale, "পরের ছবি", "After image")} value={String(item.after_url ?? "")} locale={locale} onPick={() => openMedia("after_url")} />
        <TextField label={tr(locale, "আগের লেবেল", "Before label")} value={String(item.before_label ?? "")} onChange={(v) => patch({ before_label: v })} placeholder={tr(locale, "আগে", "Before")} />
        <TextField label={tr(locale, "পরের লেবেল", "After label")} value={String(item.after_label ?? "")} onChange={(v) => patch({ after_label: v })} placeholder={tr(locale, "পরে", "After")} />
      </div>
    </>
  );
}
