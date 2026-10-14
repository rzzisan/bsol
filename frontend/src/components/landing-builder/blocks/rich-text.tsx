"use client";

import type { JSONContent } from "@tiptap/react";
import { RichTextEditorField, TextField } from "@/components/landing-builder/block-fields";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const richTextDefaults = () => ({ title: "", body: { type: "doc", content: [{ type: "paragraph" }] } });

export function RichTextEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <>
      <TextField label={tr(locale, "শিরোনাম (ঐচ্ছিক)", "Title (optional)")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
      <RichTextEditorField value={item.body as JSONContent | undefined} onChange={(json) => patch({ body: json })} />
    </>
  );
}
