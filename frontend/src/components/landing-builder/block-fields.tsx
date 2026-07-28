"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { Bold, Italic, LinkIcon, List, ListOrdered, Heading2 } from "lucide-react";
import type { Locale } from "@/lib/dashboard-client";
import { BLOCK_ICON_MAP, BLOCK_ICON_NAMES, resolveBlockIcon } from "@/lib/block-icons";
import { RICH_TEXT_EXTENSIONS } from "@/lib/rich-text-extensions";

const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

export function TextAreaField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`${inputClass} resize-none`} />
    </label>
  );
}

export function IconPickerField({ label, value, onChange, locale = "bn" }: { label: string; value: string; onChange: (v: string) => void; locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const SelectedIcon = resolveBlockIcon(value);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filteredNames = query.trim()
    ? BLOCK_ICON_NAMES.filter((name) => name.includes(query.trim().toLowerCase()))
    : BLOCK_ICON_NAMES;

  return (
    <div className="relative" ref={containerRef}>
      <span className={labelClass}>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]/40"
      >
        <SelectedIcon size={16} className="shrink-0 text-[var(--muted)]" />
        <span className="truncate capitalize">{value ? value.replace(/-/g, " ") : locale === "bn" ? "আইকন বাছাই করুন" : "Choose icon"}</span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === "bn" ? "আইকন খুঁজুন..." : "Search icons..."}
            className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
          />
          <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto">
            {filteredNames.map((name) => {
              const Icon = BLOCK_ICON_MAP[name];
              const active = value === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setQuery("");
                  }}
                  title={name}
                  className={`flex items-center justify-center rounded-lg border p-1.5 transition ${active ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)]"}`}
                >
                  <Icon size={15} />
                </button>
              );
            })}
            {filteredNames.length === 0 ? (
              <div className="col-span-8 py-3 text-center text-xs text-[var(--muted)]">{locale === "bn" ? "কোনো আইকন পাওয়া যায়নি।" : "No icons found."}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { resolveBlockIcon };

// ---------- Rich Text (Tiptap) ----------

export function RichTextEditorField({ value, onChange }: { value: JSONContent | undefined; onChange: (json: JSONContent) => void }) {
  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[100px] px-3 py-2 focus:outline-none text-[var(--foreground)]",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] p-1.5">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold size={14} />} />
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic size={14} />} />
        <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} icon={<Heading2 size={14} />} />
        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<List size={14} />} />
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<ListOrdered size={14} />} />
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
            else editor.chain().focus().unsetLink().run();
          }}
          icon={<LinkIcon size={14} />}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md p-1.5 transition ${active ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--surface-soft)]"}`}
    >
      {icon}
    </button>
  );
}

// ---------- Media picker trigger (delegates actual library UI to parent) ----------

export function ImagePickerField({
  label,
  value,
  onPick,
  locale,
}: {
  label: string;
  value: string;
  onPick: () => void;
  locale: Locale;
}) {
  return (
    <div className="block">
      <span className={labelClass}>{label}</span>
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-[var(--border)] object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[10px] text-[var(--muted)]">—</div>
        )}
        <button type="button" onClick={onPick} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
          {locale === "bn" ? "ছবি বাছাই করুন" : "Choose image"}
        </button>
      </div>
    </div>
  );
}

// ---------- Video embed URL validation (mirrors backend allowlist) ----------

const VIDEO_HOST_PATTERN = /^(www\.)?(youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch)$/i;

export function isAllowedVideoUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const host = new URL(url).hostname;
    return VIDEO_HOST_PATTERN.test(host);
  } catch {
    return false;
  }
}
