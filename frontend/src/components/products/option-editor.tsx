"use client";

import { useState } from "react";
import type { ProductOption, ProductOptionValue, OptionType } from "@/types/variant";

interface Props {
  productId: number;
  options: ProductOption[];
  token: string | null;
  apiBase: string;
  onOptionsChange: (options: ProductOption[]) => void;
}

const OPTION_TYPES: { value: OptionType; label: string }[] = [
  { value: "select", label: "Dropdown" },
  { value: "color_swatch", label: "Color Swatch" },
  { value: "image_swatch", label: "Image Swatch" },
  { value: "text", label: "Text Input" },
];

export default function OptionEditor({ productId, options, token, apiBase, onOptionsChange }: Props) {
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
      if (!res.ok) throw new Error(json.message ?? "Failed to add option");
      onOptionsChange([...options, json.data]);
      setNewOptionName("");
      setAdding(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error adding option");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOption(optionId: number) {
    if (!confirm("Delete this option? All values and related variant mappings will also be removed.")) return;
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
        <h3 className="text-sm font-semibold text-gray-700">Variant Options</h3>
        <button
          onClick={() => setAdding(true)}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
        >
          + Add Option
        </button>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {/* Existing options */}
      {options.map((option) => (
        <OptionRow
          key={option.id}
          option={option}
          onAddValue={(val, hex) => addValue(option, val, hex)}
          onDeleteValue={(vid) => deleteValue(option.id, vid)}
          onDeleteOption={() => deleteOption(option.id)}
        />
      ))}

      {/* New option form */}
      {adding && (
        <div className="border border-dashed border-blue-300 rounded-lg p-4 bg-blue-50 space-y-3">
          <p className="text-xs font-medium text-blue-700">New Option</p>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Option name (e.g., Color, Size, Material)"
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addOption()}
              autoFocus
            />
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none"
              value={newOptionType}
              onChange={(e) => setNewOptionType(e.target.value as OptionType)}
            >
              {OPTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addOption}
              disabled={saving}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Option"}
            </button>
            <button
              onClick={() => { setAdding(false); setNewOptionName(""); }}
              className="text-sm text-gray-600 px-4 py-1.5 rounded border hover:bg-gray-100"
            >
              Cancel
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
  onAddValue,
  onDeleteValue,
  onDeleteOption,
}: {
  option: ProductOption;
  onAddValue: (value: string, colorHex?: string) => void;
  onDeleteValue: (id: number) => void;
  onDeleteOption: () => void;
}) {
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
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-gray-800">{option.name}</span>
          <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            {option.type.replace("_", " ")}
          </span>
        </div>
        <button
          onClick={onDeleteOption}
          className="text-xs text-red-500 hover:text-red-700"
          title="Delete option"
        >
          ✕ Remove
        </button>
      </div>

      {/* Values */}
      <div className="flex flex-wrap gap-2 mb-3">
        {option.values.map((v) => (
          <ValueChip
            key={v.id}
            value={v}
            optionType={option.type}
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
                className="w-8 h-8 rounded cursor-pointer border border-gray-300"
              />
            )}
            <input
              className="border border-gray-300 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Value…"
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setAdding(false); }}
              autoFocus
            />
            <button onClick={submit} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">✓</button>
            <button onClick={() => { setAdding(false); setNewVal(""); }} className="text-xs text-gray-500 px-1">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-xs border border-dashed border-blue-400 text-blue-600 px-3 py-1 rounded hover:bg-blue-50"
          >
            + Add value
          </button>
        )}
      </div>
    </div>
  );
}

function ValueChip({
  value,
  optionType,
  onDelete,
}: {
  value: ProductOptionValue;
  optionType: OptionType;
  onDelete: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-full">
      {optionType === "color_swatch" && value.color_hex && (
        <span
          className="w-3.5 h-3.5 rounded-full inline-block border border-gray-300 flex-shrink-0"
          style={{ backgroundColor: value.color_hex }}
        />
      )}
      {value.label || value.value}
      <button
        onClick={onDelete}
        className="text-gray-400 hover:text-red-500 ml-0.5 leading-none"
        title="Remove value"
      >
        ×
      </button>
    </span>
  );
}
