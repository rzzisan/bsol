"use client";

import { IconPickerField, TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { blockText, tr } from "./text";
import type { BlockEditorProps, SectionSettings } from "./types";

export const trustBadgesDefaults = () => ({ icon: "shield-check", label: "", sublabel: "" });

export function TrustBadgesEditor({ item, patch, locale, isFirstOfType, section, onSectionChange }: BlockEditorProps) {
  const t = blockText(locale);
  return (
    <>
      {isFirstOfType ? (
        <div className="mb-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--muted)]">{t.sectionWideHint}</p>
          <SelectField
            label={t.trustBadgesLayout}
            value={section.trustBadgesLayout}
            onChange={(v) => onSectionChange({ trustBadgesLayout: v as SectionSettings["trustBadgesLayout"] })}
            className="bg-[var(--surface-soft)]"
            options={[
              { value: "cards", label: t.trustBadgesLayoutCards },
              { value: "row", label: t.trustBadgesLayoutRow },
              { value: "minimal", label: t.trustBadgesLayoutMinimal },
            ]}
          />
        </div>
      ) : null}
      <IconPickerField label={tr(locale, "আইকন", "Icon")} value={String(item.icon ?? "shield-check")} onChange={(v) => patch({ icon: v })} locale={locale} />
      <TextField label={tr(locale, "লেবেল", "Label")} value={String(item.label ?? "")} onChange={(v) => patch({ label: v })} />
      <TextField label={tr(locale, "সাব-লেবেল (ঐচ্ছিক)", "Sublabel (optional)")} value={String(item.sublabel ?? "")} onChange={(v) => patch({ sublabel: v })} />
    </>
  );
}
