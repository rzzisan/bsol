"use client";

import { TextField } from "@/components/landing-builder/block-fields";
import { SelectField } from "./select-field";
import { blockText, tr } from "./text";
import type { BlockEditorProps } from "./types";

export const carouselDefaults = () => ({ title: "", template: "style-1", images: [] });

export function CarouselEditor({ item, patch, locale, openMedia }: BlockEditorProps) {
  const t = blockText(locale);
  const images = (item.images as Array<{ id?: number | null; url?: string | null; alt?: string | null }> | undefined) ?? [];
  return (
    <>
      <TextField label={tr(locale, "শিরোনাম", "Title")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
      <SelectField
        label={tr(locale, "স্টাইল", "Style")}
        value={String(item.template ?? "style-1")}
        onChange={(v) => patch({ template: v })}
        options={[
          { value: "style-1", label: "Style 1" },
          { value: "style-2", label: "Style 2" },
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
          {images.map((image, imageIndex) => (
            <div key={`${image.url}-${imageIndex}`} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url ?? ""} alt={image.alt ?? ""} className="aspect-square w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
