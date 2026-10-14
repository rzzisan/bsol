"use client";

import { TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const faqDefaults = () => ({ q: "", a: "" });

export function FaqEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <>
      <TextField label={tr(locale, "প্রশ্ন", "Question")} value={String(item.q ?? "")} onChange={(v) => patch({ q: v })} />
      <TextAreaField label={tr(locale, "উত্তর", "Answer")} value={String(item.a ?? "")} onChange={(v) => patch({ a: v })} rows={2} />
    </>
  );
}
