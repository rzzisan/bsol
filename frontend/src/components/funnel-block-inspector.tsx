"use client";

import { useEffect, useState } from "react";
import type { LandingPageBlock } from "@/lib/funnel";
import { getBlockDefinition } from "@/components/funnel-block-registry";

type Props = {
  block: LandingPageBlock | null;
  locale: "bn" | "en";
  onSave: (payload: { settings_json?: Record<string, unknown>; content_json?: Record<string, unknown>; visibility_rules_json?: Record<string, unknown>; locked?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
  busy: boolean;
};

export default function FunnelBlockInspector({ block, locale, onSave, onDelete, busy }: Props) {
  const [settingsText, setSettingsText] = useState("{}");
  const [contentText, setContentText] = useState("{}");
  const [visibilityText, setVisibilityText] = useState("{}");
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!block) return;
    setSettingsText(JSON.stringify(block.settings_json ?? {}, null, 2));
    setContentText(JSON.stringify(block.content_json ?? {}, null, 2));
    setVisibilityText(JSON.stringify(block.visibility_rules_json ?? {}, null, 2));
    setLocked(!!block.locked);
    setError("");
  }, [block]);

  if (!block) {
    return <p className="text-xs text-[var(--muted)]">Select a block to configure.</p>;
  }

  const def = getBlockDefinition(block.block_type);

  const submit = async () => {
    try {
      setError("");
      await onSave({
        settings_json: JSON.parse(settingsText),
        content_json: JSON.parse(contentText),
        visibility_rules_json: JSON.parse(visibilityText),
        locked,
      });
    } catch {
      setError("Invalid JSON in inspector fields.");
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <p className="font-semibold">{def?.label[locale] ?? block.block_type}</p>
        <p className="mt-1 text-[var(--muted)]">{def?.description[locale] ?? "Custom block"}</p>
      </div>

      <label className="block">
        <span className="mb-1 block font-semibold text-[var(--muted)]">settings_json</span>
        <textarea rows={7} value={settingsText} onChange={(e) => setSettingsText(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-[11px]" />
      </label>

      <label className="block">
        <span className="mb-1 block font-semibold text-[var(--muted)]">content_json</span>
        <textarea rows={7} value={contentText} onChange={(e) => setContentText(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-[11px]" />
      </label>

      <label className="block">
        <span className="mb-1 block font-semibold text-[var(--muted)]">visibility_rules_json</span>
        <textarea rows={4} value={visibilityText} onChange={(e) => setVisibilityText(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-[11px]" />
      </label>

      <label className="flex items-center gap-2 font-semibold text-[var(--muted)]">
        <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
        locked
      </label>

      {error ? <p className="rounded-lg bg-red-500/10 px-2 py-1 text-red-500">{error}</p> : null}

      <div className="flex gap-2">
        <button onClick={() => void submit()} disabled={busy} className="rounded-lg bg-[var(--accent)] px-3 py-2 font-semibold text-white disabled:opacity-60">Save Block</button>
        <button onClick={() => void onDelete()} disabled={busy} className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-600 disabled:opacity-60">Delete</button>
      </div>
    </div>
  );
}
