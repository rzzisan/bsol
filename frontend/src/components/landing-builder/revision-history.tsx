"use client";

import { useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import type { Locale } from "@/lib/dashboard-client";
import { LANDING_API_BASE } from "@/lib/landing-pages";

type Revision = { id: number; title: string; created_at: string; user_name: string | null };

const TEXT = {
  bn: {
    button: "ভার্সন হিস্টোরি",
    title: "আগের ভার্সন",
    hint: "প্রতিবার save করার আগের অবস্থা এখানে থাকে (শেষ ৩০টা)। ফিরিয়ে আনলে এখনকার অবস্থাও একটা ভার্সন হিসেবে থেকে যায়।",
    empty: "এখনো কোনো আগের ভার্সন নেই। পেজটা save করলে এখানে দেখা যাবে।",
    loading: "লোড হচ্ছে...",
    loadFailed: "ভার্সন লোড করা যায়নি।",
    restore: "ফিরিয়ে আনুন",
    restoring: "ফিরিয়ে আনা হচ্ছে...",
    restoreFailed: "ভার্সন ফিরিয়ে আনা যায়নি।",
    confirm: "এই ভার্সন ফিরিয়ে আনবেন? পেজের কনটেন্ট, ডিজাইন ও প্রোডাক্ট সেই সময়ের মতো হয়ে যাবে। স্ট্যাটাস ও লিংক বদলাবে না।",
    confirmDirty: "\n\nএখনো save না করা পরিবর্তন হারিয়ে যাবে।",
    close: "বন্ধ করুন",
  },
  en: {
    button: "Version history",
    title: "Earlier versions",
    hint: "The page as it was before each save is kept here (last 30). Restoring keeps the current state as a version too.",
    empty: "No earlier versions yet. They appear here once the page is saved.",
    loading: "Loading...",
    loadFailed: "Could not load versions.",
    restore: "Restore",
    restoring: "Restoring...",
    restoreFailed: "Could not restore this version.",
    confirm: "Restore this version? The page content, design and products go back to how they were then. Status and link stay the same.",
    confirmDirty: "\n\nChanges you have not saved will be lost.",
    close: "Close",
  },
};

export function RevisionHistory({
  pageId,
  token,
  locale,
  isDirty,
  onRestored,
}: {
  pageId: string;
  token: string;
  locale: Locale;
  isDirty: boolean;
  onRestored: () => void;
}) {
  const t = TEXT[locale] ?? TEXT.en;
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  async function load() {
    setRevisions(null);
    setError(null);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${pageId}/revisions`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      setRevisions((await res.json()).data ?? []);
    } catch {
      setError(t.loadFailed);
    }
  }

  function toggle() {
    if (!open) void load();
    setOpen(!open);
  }

  async function restore(revision: Revision) {
    if (!window.confirm(t.confirm + (isDirty ? t.confirmDirty : ""))) return;
    setRestoringId(revision.id);
    setError(null);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${pageId}/revisions/${revision.id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      onRestored();
    } catch {
      setError(t.restoreFailed);
    } finally {
      setRestoringId(null);
    }
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="relative">
      <button type="button" onClick={toggle} title={t.button} aria-label={t.button} aria-expanded={open} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs font-semibold text-[var(--foreground)]">
        <History size={16} /> <span className="hidden sm:inline">{t.button}</span>
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h4>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="rounded p-1 text-[var(--muted)]">
              <X size={14} />
            </button>
          </div>
          <p className="mb-3 text-xs text-[var(--muted)]">{t.hint}</p>
          {error ? <p className="mb-2 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-400">{error}</p> : null}
          {revisions === null && !error ? <p className="text-xs text-[var(--muted)]">{t.loading}</p> : null}
          {revisions?.length === 0 ? <p className="text-xs text-[var(--muted)]">{t.empty}</p> : null}
          {revisions && revisions.length > 0 ? (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {revisions.map((revision) => (
                <li key={revision.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[var(--foreground)]">{formatDate(revision.created_at)}</div>
                    <div className="truncate text-[11px] text-[var(--muted)]">
                      {revision.title}{revision.user_name ? ` · ${revision.user_name}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => restore(revision)}
                    disabled={restoringId !== null}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-1 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
                  >
                    <RotateCcw size={12} /> {restoringId === revision.id ? t.restoring : t.restore}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
