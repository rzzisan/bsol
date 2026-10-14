"use client";

import { TextField } from "@/components/landing-builder/block-fields";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const priceBoxDefaults = () => ({ title: "", regular_price: "", offer_price: "", note: "", cta_text: "" });

export function PriceBoxEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <>
      <TextField label={tr(locale, "শিরোনাম", "Title")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} placeholder={tr(locale, "আজকের অফার", "Today's offer")} />
      <div className="grid grid-cols-2 gap-2">
        <TextField label={tr(locale, "আগের দাম", "Regular price")} value={String(item.regular_price ?? "")} onChange={(v) => patch({ regular_price: v })} placeholder="1500" />
        <TextField label={tr(locale, "অফার দাম", "Offer price")} value={String(item.offer_price ?? "")} onChange={(v) => patch({ offer_price: v })} placeholder="990" />
      </div>
      <TextField label={tr(locale, "ছোট নোট (ঐচ্ছিক)", "Note (optional)")} value={String(item.note ?? "")} onChange={(v) => patch({ note: v })} placeholder={tr(locale, "ডেলিভারি চার্জ ফ্রি", "Free delivery")} />
      <TextField label={tr(locale, "বাটন টেক্সট (ঐচ্ছিক)", "Button text (optional)")} value={String(item.cta_text ?? "")} onChange={(v) => patch({ cta_text: v })} />
    </>
  );
}
