"use client";

import { IconPickerField, TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const guaranteeDefaults = () => ({ icon: "shield-check", title: "", body: "" });

export function GuaranteeEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <>
      <IconPickerField label={tr(locale, "আইকন", "Icon")} value={String(item.icon ?? "shield-check")} onChange={(v) => patch({ icon: v })} locale={locale} />
      <TextField label={tr(locale, "শিরোনাম", "Title")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} placeholder={tr(locale, "৭ দিনের রিটার্ন গ্যারান্টি", "7-day return guarantee")} />
      <TextAreaField label={tr(locale, "বর্ণনা", "Description")} value={String(item.body ?? "")} onChange={(v) => patch({ body: v })} />
    </>
  );
}
