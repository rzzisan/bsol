"use client";

import { TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { blockText, tr } from "./text";
import type { BlockEditorProps } from "./types";

export const galleryDefaults = () => ({ title: "", columns: "3", images: [] });

export function GalleryEditor({ item, patch, locale, openMedia }: BlockEditorProps) {
  const t = blockText(locale);
  const images = (item.images as Array<{ url?: string | null; alt?: string | null }> | undefined) ?? [];
  return (
    <>
      <TextField label={tr(locale, "শিরোনাম (ঐচ্ছিক)", "Title (optional)")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
      <SelectField
        label={tr(locale, "প্রতি সারিতে ছবি", "Images per row")}
        value={String(item.columns ?? "3")}
        onChange={(v) => patch({ columns: v })}
        options={[
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ]}
      />
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => openMedia("images")} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
          {t.pickImages}
        </button>
        <span className="text-xs text-[var(--muted)]">{t.selectedCount}: {images.length}</span>
      </div>
      {images.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <div key={`${image.url}-${index}`} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url ?? ""} alt={image.alt ?? ""} className="aspect-square w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
