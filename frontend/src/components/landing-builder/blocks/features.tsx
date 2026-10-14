"use client";

import { IconPickerField, TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { blockText, tr } from "./text";
import type { BlockEditorProps, SectionSettings } from "./types";

export const featuresDefaults = () => ({ title: "", description: "", icon: "star" });

export function FeaturesEditor({ item, patch, locale, isFirstOfType, section, onSectionChange }: BlockEditorProps) {
  const t = blockText(locale);
  return (
    <>
      {isFirstOfType ? (
        <div className="mb-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--muted)]">{t.sectionWideHint}</p>
          <TextField label={t.featuresTitle} value={section.featuresTitle} onChange={(v) => onSectionChange({ featuresTitle: v })} />
          <SelectField
            label={t.featuresLayout}
            value={section.featuresLayout}
            onChange={(v) => onSectionChange({ featuresLayout: v as SectionSettings["featuresLayout"] })}
            className="bg-[var(--surface-soft)]"
            options={[
              { value: "cards", label: t.featuresLayoutCards },
              { value: "list", label: t.featuresLayoutList },
              { value: "minimal", label: t.featuresLayoutMinimal },
            ]}
          />
        </div>
      ) : null}
      <IconPickerField label={tr(locale, "আইকন", "Icon")} value={String(item.icon ?? "star")} onChange={(v) => patch({ icon: v })} locale={locale} />
      <TextField label={tr(locale, "শিরোনাম", "Title")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
      <TextAreaField label={tr(locale, "বর্ণনা", "Description")} value={String(item.description ?? "")} onChange={(v) => patch({ description: v })} rows={2} />
    </>
  );
}
