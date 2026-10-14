"use client";

import { TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { blockText, tr } from "./text";
import type { BlockEditorProps, SectionSettings } from "./types";

export const faqDefaults = () => ({ q: "", a: "" });

export function FaqEditor({ item, patch, locale, isFirstOfType, section, onSectionChange }: BlockEditorProps) {
  return (
    <>
      {isFirstOfType ? (
        <div className="mb-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--muted)]">{blockText(locale).sectionWideHint}</p>
          <TextField label={tr(locale, "FAQ সেকশনের টাইটেল", "FAQ section title")} value={section.faqTitle} onChange={(v) => onSectionChange({ faqTitle: v })} placeholder={tr(locale, "সাধারণ প্রশ্ন", "Frequently asked questions")} />
          <SelectField
            label={tr(locale, "FAQ-এর ডিজাইন", "FAQ design")}
            value={section.faqLayout}
            onChange={(v) => onSectionChange({ faqLayout: v as SectionSettings["faqLayout"] })}
            className="bg-[var(--surface-soft)]"
            options={[
              { value: "accordion", label: tr(locale, "ক্লিক করলে উত্তর খোলে", "Click to open answers") },
              { value: "open", label: tr(locale, "সব উত্তর খোলা", "All answers shown") },
              { value: "two-column", label: tr(locale, "দুই কলাম", "Two columns") },
            ]}
          />
        </div>
      ) : null}
      <TextField label={tr(locale, "প্রশ্ন", "Question")} value={String(item.q ?? "")} onChange={(v) => patch({ q: v })} />
      <TextAreaField label={tr(locale, "উত্তর", "Answer")} value={String(item.a ?? "")} onChange={(v) => patch({ a: v })} rows={2} />
    </>
  );
}
