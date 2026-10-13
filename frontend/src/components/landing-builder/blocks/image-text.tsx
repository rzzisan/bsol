"use client";

import { ImagePickerField, TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const imageTextDefaults = () => ({ image_url: "", image_position: "left", heading: "", body: "", cta_text: "", cta_url: "" });

export function ImageTextEditor({ item, patch, locale, openMedia }: BlockEditorProps) {
  return (
    <>
      <ImagePickerField label={tr(locale, "ছবি", "Image")} value={String(item.image_url ?? "")} locale={locale} onPick={() => openMedia("image_url")} />
      <SelectField
        label={tr(locale, "ছবির অবস্থান", "Image position")}
        value={String(item.image_position ?? "left")}
        onChange={(v) => patch({ image_position: v })}
        options={[
          { value: "left", label: tr(locale, "বামে", "Left") },
          { value: "right", label: tr(locale, "ডানে", "Right") },
        ]}
      />
      <TextField label={tr(locale, "হেডিং", "Heading")} value={String(item.heading ?? "")} onChange={(v) => patch({ heading: v })} />
      <TextAreaField label={tr(locale, "বর্ণনা", "Body")} value={String(item.body ?? "")} onChange={(v) => patch({ body: v })} />
      <TextField label={tr(locale, "বাটন টেক্সট (ঐচ্ছিক)", "Button text (optional)")} value={String(item.cta_text ?? "")} onChange={(v) => patch({ cta_text: v })} />
      <TextField label={tr(locale, "বাটন লিংক (ঐচ্ছিক)", "Button link (optional)")} value={String(item.cta_url ?? "")} onChange={(v) => patch({ cta_url: v })} />
    </>
  );
}
