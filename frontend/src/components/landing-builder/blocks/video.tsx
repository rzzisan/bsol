"use client";

import { TextField, isAllowedVideoUrl } from "@/components/landing-builder/block-fields";
import { blockText, tr } from "./text";
import type { BlockEditorProps } from "./types";

export const videoDefaults = () => ({ title: "", url: "" });

export function VideoEditor({ item, patch, locale }: BlockEditorProps) {
  const url = String(item.url ?? "");
  const invalid = url.trim().length > 0 && !isAllowedVideoUrl(url);
  return (
    <>
      <TextField label={tr(locale, "শিরোনাম (ঐচ্ছিক)", "Title (optional)")} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
      <TextField label="YouTube / Facebook / Vimeo URL" value={url} onChange={(v) => patch({ url: v })} placeholder="https://youtube.com/watch?v=..." />
      {invalid ? <p className="text-xs text-red-400">{blockText(locale).invalidVideoUrl}</p> : null}
    </>
  );
}
