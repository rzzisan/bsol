"use client";

import { TextField } from "@/components/landing-builder/block-fields";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

// Legacy block from the old editor: title only, the HTML itself is read-only.
export function HtmlSectionEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <>
      <TextField label={tr(locale, "শিরোনাম", "Title")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
      <p className="text-xs text-[var(--muted)]">{tr(locale, "এই সেকশনটি পুরনো এডিটরে তৈরি — নতুন বিল্ডারে কোড এডিট করা যায় না।", "Created in the old editor — code can't be edited from this builder.")}</p>
    </>
  );
}
