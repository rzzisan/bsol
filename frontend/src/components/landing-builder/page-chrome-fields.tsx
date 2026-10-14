"use client";

import { TextAreaField, TextField } from "@/components/landing-builder/block-fields";
import { tr } from "@/components/landing-builder/blocks/text";
import type { Locale } from "@/lib/dashboard-client";
import type { FooterConfig, NoticeBarConfig } from "@/lib/landing-pages";

function ColorInput({ label, value, onChange, locale }: { label: string; value: string | null | undefined; onChange: (v: string | null) => void; locale: Locale }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value || "#f97316"} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0" />
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-[var(--muted)] underline">{tr(locale, "থিমের রঙ", "Theme color")}</button>
        ) : (
          <span className="text-xs text-[var(--muted)]">{tr(locale, "থিমের রঙ", "Theme color")}</span>
        )}
      </div>
    </label>
  );
}

// The notice bar above the hero and the seller's own footer.
export function PageChromeFields({
  locale,
  noticeBar,
  onNoticeBarChange,
  footer,
  onFooterChange,
}: {
  locale: Locale;
  noticeBar: NoticeBarConfig;
  onNoticeBarChange: (value: NoticeBarConfig) => void;
  footer: FooterConfig;
  onFooterChange: (value: FooterConfig) => void;
}) {
  const patchNotice = (changes: Partial<NoticeBarConfig>) => onNoticeBarChange({ ...noticeBar, ...changes });
  const patchFooter = (changes: Partial<FooterConfig>) => onFooterChange({ ...footer, ...changes });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <input type="checkbox" checked={Boolean(noticeBar.enabled)} onChange={(e) => patchNotice({ enabled: e.target.checked })} className="accent-[var(--accent)]" />
          {tr(locale, "উপরে নোটিশ বার দেখান", "Show a notice bar at the top")}
        </label>
        {noticeBar.enabled ? (
          <>
            <TextField label={tr(locale, "নোটিশ", "Notice")} value={noticeBar.text ?? ""} onChange={(v) => patchNotice({ text: v })} placeholder={tr(locale, "আজই অর্ডার করলে ডেলিভারি ফ্রি!", "Free delivery if you order today!")} />
            <TextField label={tr(locale, "লিংক (ঐচ্ছিক)", "Link (optional)")} value={noticeBar.url ?? ""} onChange={(v) => patchNotice({ url: v })} placeholder="#checkout" />
            <div className="grid grid-cols-2 gap-2">
              <ColorInput label={tr(locale, "ব্যাকগ্রাউন্ড", "Background")} value={noticeBar.bg_color} onChange={(v) => patchNotice({ bg_color: v })} locale={locale} />
              <ColorInput label={tr(locale, "লেখার রঙ", "Text color")} value={noticeBar.text_color} onChange={(v) => patchNotice({ text_color: v })} locale={locale} />
            </div>
          </>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <input type="checkbox" checked={Boolean(footer.enabled)} onChange={(e) => patchFooter({ enabled: e.target.checked })} className="accent-[var(--accent)]" />
          {tr(locale, "নিচে ফুটার দেখান", "Show a footer")}
        </label>
        {footer.enabled ? (
          <>
            <TextAreaField label={tr(locale, "ফুটারের লেখা", "Footer text")} value={footer.text ?? ""} onChange={(v) => patchFooter({ text: v })} />
            <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
              <input type="checkbox" checked={Boolean(footer.show_contact)} onChange={(e) => patchFooter({ show_contact: e.target.checked })} />
              {tr(locale, "যোগাযোগের নম্বর দেখান", "Show the contact number")}
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
