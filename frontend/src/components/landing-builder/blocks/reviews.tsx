"use client";

import { ImagePickerField, TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const reviewsDefaults = () => ({ name: "", quote: "", rating: 5, avatar_url: "" });

export function ReviewsEditor({ item, patch, locale, openMedia }: BlockEditorProps) {
  return (
    <>
      <ImagePickerField label={tr(locale, "প্রোফাইল ছবি (ঐচ্ছিক)", "Avatar (optional)")} value={String(item.avatar_url ?? "")} locale={locale} onPick={() => openMedia("avatar_url")} />
      <TextField label={tr(locale, "নাম", "Name")} value={String(item.name ?? "")} onChange={(v) => patch({ name: v })} />
      <TextAreaField label={tr(locale, "রিভিউ", "Quote")} value={String(item.quote ?? "")} onChange={(v) => patch({ quote: v })} rows={2} />
      <SelectField
        label={tr(locale, "রেটিং", "Rating")}
        value={String(item.rating ?? 5)}
        onChange={(v) => patch({ rating: Number(v) })}
        options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: "★".repeat(n) }))}
      />
    </>
  );
}
