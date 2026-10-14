"use client";

import { ImagePickerField, TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { blockText, tr } from "./text";
import type { BlockEditorProps, SectionSettings } from "./types";

export const reviewsDefaults = () => ({ name: "", quote: "", rating: 5, avatar_url: "" });

export function ReviewsEditor({ item, patch, locale, openMedia, isFirstOfType, section, onSectionChange }: BlockEditorProps) {
  return (
    <>
      {isFirstOfType ? (
        <div className="mb-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--muted)]">{blockText(locale).sectionWideHint}</p>
          <TextField label={tr(locale, "রিভিউ সেকশনের টাইটেল", "Reviews section title")} value={section.reviewsTitle} onChange={(v) => onSectionChange({ reviewsTitle: v })} placeholder={tr(locale, "কাস্টমারদের মতামত", "Customer Reviews")} />
          <SelectField
            label={tr(locale, "রিভিউয়ের ডিজাইন", "Reviews design")}
            value={section.reviewsLayout}
            onChange={(v) => onSectionChange({ reviewsLayout: v as SectionSettings["reviewsLayout"] })}
            className="bg-[var(--surface-soft)]"
            options={[
              { value: "grid", label: tr(locale, "দুই কলামের গ্রিড", "Two-column grid") },
              { value: "list", label: tr(locale, "এক কলামের তালিকা", "Single-column list") },
              { value: "highlight", label: tr(locale, "বড় রঙিন কার্ড", "Large colored cards") },
            ]}
          />
        </div>
      ) : null}
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
