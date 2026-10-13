"use client";

import { TextField } from "@/components/landing-builder/block-fields";
import { tr } from "./text";
import type { BlockEditorProps } from "./types";

export const countdownDefaults = () => ({ message: "", end_datetime: "" });

export function CountdownEditor({ item, patch, locale }: BlockEditorProps) {
  return (
    <>
      <TextField label={tr(locale, "মেসেজ", "Message")} value={String(item.message ?? "")} onChange={(v) => patch({ message: v })} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{tr(locale, "শেষ সময়", "End date/time")}</span>
        <input type="datetime-local" value={String(item.end_datetime ?? "")} onChange={(e) => patch({ end_datetime: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" />
      </label>
    </>
  );
}
