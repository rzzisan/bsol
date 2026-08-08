"use client";

import { useState } from "react";
import type { ProductOption, ProductOptionValue, OptionType } from "@/types/variant";
import type { Locale } from "@/lib/dashboard-client";

interface Props {
  productId: number;
  options: ProductOption[];
  token: string | null;
  apiBase: string;
  onOptionsChange: (options: ProductOption[]) => void;
  locale: Locale;
}

const text = {
  bn: {
    heading: "ভেরিয়েন্ট অপশন",
    addOption: "+ অপশন যোগ করুন",
    addFailed: "অপশন যোগ করা যায়নি",
    addError: "অপশন যোগ করতে সমস্যা হয়েছে",
    confirmDeleteOption: "এই অপশনটি মুছবেন? সব ভ্যালু এবং সংশ্লিষ্ট ভেরিয়েন্ট ম্যাপিংও মুছে যাবে।",
    newOption: "নতুন অপশন",
    optionNamePlaceholder: "অপশনের নাম (যেমন: কালার, সাইজ, ম্যাটেরিয়াল)",
    saving: "সেভ হচ্ছে…",
    saveOption: "অপশন সেভ করুন",
    cancel: "বাতিল",
    deleteOptionTitle: "অপশন মুছুন",
    removeValueTitle: "ভ্যালু সরান",
    addValue: "+ ভ্যালু যোগ করুন",
    valuePlaceholder: "ভ্যালু…",
    types: {
      select: "ড্রপডাউন",
      color_swatch: "কালার সোয়াচ",
      image_swatch: "ইমেজ সোয়াচ",
      text: "টেক্সট ইনপুট",
    },
  },
  en: {
    heading: "Variant Options",
    addOption: "+ Add Option",
    addFailed: "Failed to add option",
    addError: "Error adding option",
    confirmDeleteOption: "Delete this option? All values and related variant mappings will also be removed.",
    newOption: "New Option",
    optionNamePlaceholder: "Option name (e.g., Color, Size, Material)",
    saving: "Saving…",
    saveOption: "Save Option",
    cancel: "Cancel",
    deleteOptionTitle: "Delete option",
    removeValueTitle: "Remove value",
    addValue: "+ Add value",
    valuePlaceholder: "Value…",
    types: {
      select: "Dropdown",
      color_swatch: "Color Swatch",
      image_swatch: "Image Swatch",
      text: "Text Input",
    },
  },
};

export default function OptionEditor({ productId, options, token, apiBase, onOptionsChange, locale }: Props) {
  const t = text[locale];
  const optionTypes: { value: OptionType; label: string }[] = [
    { value: "select", label: t.types.select },
    { value: "color_swatch", label: t.types.color_swatch },
    { value: "image_swatch", label: t.types.image_swatch },
    { value: "text", label: t.types.text },
  ];

  const [adding, setAdding] = useState(false);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionType, setNewOptionType] = useState<OptionType>("select");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  async function addOption() {
    if (!newOptionName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/products/${productId}/options`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newOptionName.trim(), type: newOptionType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? t.addFailed);
      onOptionsChange([...options, json.data]);
      setNewOptionName("");
      setAdding(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.addError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOption(optionId: number) {
    if (!confirm(t.confirmDeleteOption)) return;
    const res = await fetch(`${apiBase}/products/${productId}/options/${optionId}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      onOptionsChange(options.filter((o) => o.id !== optionId));
    }
  }

  async function addValue(option: ProductOption, value: string, colorHex?: string) {
    if (!value.trim()) return;
    const body: Record<string, unknown> = { value: value.trim(), position: option.values.length };
    if (colorHex) body.color_hex = colorHex;

    const res = await fetch(`${apiBase}/products/${productId}/options/${option.id}/values`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return;

    onOptionsChange(
      options.map((o) =>
        o.id === option.id ? { ...o, values: [...o.values, json.data] } : o
      )
    );
  }

  async function deleteValue(optionId: number, valueId: number) {
    const res = await fetch(`${apiBase}/products/${productId}/options/${optionId}/values/${valueId}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      onOptionsChange(
        options.map((o) =>
          o.id === optionId ? { ...o, values: o.values.filter((v) => v.id !== valueId) } : o
        )
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.heading}</h3>
        <button
          onClick={() => setAdding(true)}
          className="text-xs bg-[var(--accent)] text-white px-3 py-1.5 rounded hover:opacity-90"
        >
          {t.addOption}
        </button>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {/* Existing options */}
      {options.map((option) => (
        <OptionRow
          key={option.id}
          option={option}
          locale={locale}
          onAddValue={(val, hex) => addValue(option, val, hex)}
          onDeleteValue={(vid) => deleteValue(option.id, vid)}
          onDeleteOption={() => deleteOption(option.id)}
        />
      ))}

      {/* New option form */}
      {adding && (
        <div className="border border-dashed border-[var(--accent)]/40 rounded-lg p-4 bg-[var(--accent)]/10 space-y-3">
          <p className="text-xs font-medium text-[var(--accent)]">{t.newOption}</p>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              placeholder={t.optionNamePlaceholder}
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addOption()}
              autoFocus
            />
            <select
              className="border border-[var(--border)] bg-[var(--background)] rounded px-3 py-2 text-sm focus:outline-none"
              value={newOptionType}
              onChange={(e) => setNewOptionType(e.target.value as OptionType)}
            >
              {optionTypes.map((ot) => (
                <option key={ot.value} value={ot.value}>{ot.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addOption}
              disabled={saving}
              className="text-sm bg-[var(--accent)] text-white px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t.saving : t.saveOption}
            </button>
            <button
              onClick={() => { setAdding(false); setNewOptionName(""); }}
              className="text-sm text-[var(--muted)] px-4 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--surface-soft)]"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single option row ──────────────────────────────────────────────────────

function OptionRow({
  option,
  locale,
  onAddValue,
  onDeleteValue,
  onDeleteOption,
}: {
  option: ProductOption;
  locale: Locale;
  onAddValue: (value: string, colorHex?: string) => void;
  onDeleteValue: (id: number) => void;
  onDeleteOption: () => void;
}) {
  const t = text[locale];
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");
  const [newColor, setNewColor] = useState("#000000");

  function submit() {
    if (!newVal.trim()) return;
    onAddValue(newVal.trim(), option.type === "color_swatch" ? newColor : undefined);
    setNewVal("");
    setAdding(false);
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-[var(--foreground)]">{option.name}</span>
          <span className="ml-2 text-xs text-[var(--muted)] bg-[var(--surface-soft)] px-2 py-0.5 rounded">
            {option.type.replace("_", " ")}
          </span>
        </div>
        <button
          onClick={onDeleteOption}
          className="text-xs text-red-500 hover:text-red-700"
          title={t.deleteOptionTitle}
        >
          ✕ {locale === "bn" ? "সরান" : "Remove"}
        </button>
      </div>

      {/* Values */}
      <div className="flex flex-wrap gap-2 mb-3">
        {option.values.map((v) => (
          <ValueChip
            key={v.id}
            value={v}
            optionType={option.type}
            removeTitle={t.removeValueTitle}
            onDelete={() => onDeleteValue(v.id)}
          />
        ))}

        {/* Inline add */}
        {adding ? (
          <div className="flex items-center gap-1">
            {option.type === "color_swatch" && (
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-[var(--border)]"
              />
            )}
            <input
              className="border border-[var(--border)] bg-[var(--background)] rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
              placeholder={t.valuePlaceholder}
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setAdding(false); }}
              autoFocus
            />
            <button onClick={submit} className="text-xs bg-[var(--accent)] text-white px-2 py-1 rounded hover:opacity-90">✓</button>
            <button onClick={() => { setAdding(false); setNewVal(""); }} className="text-xs text-[var(--muted)] px-1">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-xs border border-dashed border-[var(--accent)]/40 text-[var(--accent)] px-3 py-1 rounded hover:bg-[var(--accent)]/10"
          >
            {t.addValue}
          </button>
        )}
      </div>
    </div>
  );
}

function ValueChip({
  value,
  optionType,
  removeTitle,
  onDelete,
}: {
  value: ProductOptionValue;
  optionType: OptionType;
  removeTitle: string;
  onDelete: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[var(--surface-soft)] text-[var(--foreground)] text-xs px-2.5 py-1 rounded-full">
      {optionType === "color_swatch" && value.color_hex && (
        <span
          className="w-3.5 h-3.5 rounded-full inline-block border border-[var(--border)] flex-shrink-0"
          style={{ backgroundColor: value.color_hex }}
        />
      )}
      {value.label || value.value}
      <button
        onClick={onDelete}
        className="text-[var(--muted)] hover:text-red-500 ml-0.5 leading-none"
        title={removeTitle}
      >
        ×
      </button>
    </span>
  );
}
