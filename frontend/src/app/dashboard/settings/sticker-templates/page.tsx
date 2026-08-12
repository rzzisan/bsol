"use client";

import { useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

// Mirrors CourierFactory::PROVIDERS on the backend — the couriers a
// per-template override can be set for. "manual" covers manual tracking entry.
const COURIERS = ["steadfast", "pathao", "redx", "carrybee", "paperfly", "manual"] as const;

const t = {
  bn: {
    pageTitle: "স্টিকার টেমপ্লেট",
    intro: "কুরিয়ার লেবেল/স্টিকার প্রিন্ট করার সময় কোন ডিজাইন ব্যবহার হবে তা বেছে নিন। ডিফল্ট টেমপ্লেটটি সব কুরিয়ারে প্রিন্ট হবে, তবে চাইলে নির্দিষ্ট কুরিয়ারের জন্য আলাদা টেমপ্লেট বেছে নেওয়া যায়।",
    loading: "লোড হচ্ছে...",
    defaultTemplate: "ডিফল্ট টেমপ্লেট",
    setDefault: "ডিফল্ট হিসেবে বেছে নিন",
    isDefault: "✓ ডিফল্ট",
    noPreview: "প্রিভিউ নাই",
    close: "বন্ধ করুন",
    courierOverrides: "কুরিয়ার-ভিত্তিক টেমপ্লেট (ঐচ্ছিক)",
    courierOverridesHint: "নির্দিষ্ট না করলে ডিফল্ট টেমপ্লেট ব্যবহার হবে।",
    useDefault: "— ডিফল্ট ব্যবহার করুন —",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    saveSuccess: "সেভ হয়েছে।",
    saveFailed: "সেভ করা যায়নি, আবার চেষ্টা করুন।",
    couriers: {
      steadfast: "স্টেডফাস্ট", pathao: "পাঠাও", redx: "রেডএক্স",
      carrybee: "ক্যারিবি", paperfly: "পেপারফ্লাই", manual: "ম্যানুয়াল এন্ট্রি",
    } as Record<string, string>,
  },
  en: {
    pageTitle: "Sticker Templates",
    intro: "Choose which label design prints for your courier stickers. The default applies to every courier unless you set a specific one below.",
    loading: "Loading...",
    defaultTemplate: "Default Template",
    setDefault: "Set as default",
    isDefault: "✓ Default",
    noPreview: "No preview",
    close: "Close",
    courierOverrides: "Per-Courier Templates (optional)",
    courierOverridesHint: "Leave as default unless you want a different design for that courier.",
    useDefault: "— Use default —",
    save: "Save",
    saving: "Saving...",
    saveSuccess: "Saved.",
    saveFailed: "Could not save, please try again.",
    couriers: {
      steadfast: "Steadfast", pathao: "Pathao", redx: "RedX",
      carrybee: "CarryBee", paperfly: "Paperfly", manual: "Manual Entry",
    } as Record<string, string>,
  },
};

type CatalogItem = { key: string; label_bn: string; label_en: string; size_label: string; preview_url: string | null };
type Override = { courier: string; template_key: string };

export default function StickerTemplatesPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = t[locale];
  const token = getStoredToken();

  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [defaultKey, setDefaultKey] = useState("classic");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [enlarged, setEnlarged] = useState<CatalogItem | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [catRes, setRes] = await Promise.all([
          fetch(`${API}/sticker-templates/catalog`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/sticker-templates/settings`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (catRes.ok) {
          const d = await catRes.json();
          setCatalog(d.data ?? []);
        }
        if (setRes.ok) {
          const d = await setRes.json();
          setDefaultKey(d.data?.default_template_key ?? "classic");
          const map: Record<string, string> = {};
          for (const o of (d.data?.courier_overrides ?? []) as Override[]) {
            map[o.courier] = o.template_key;
          }
          setOverrides(map);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    try {
      const courier_overrides = Object.entries(overrides)
        .filter(([, key]) => key)
        .map(([courier, template_key]) => ({ courier, template_key }));

      const res = await fetch(`${API}/sticker-templates/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ default_template_key: defaultKey, courier_overrides }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setResult({ success: true, msg: txt.saveSuccess });
      } else {
        const errMsg = d.errors ? Object.values(d.errors as Record<string, string[]>).flat().join(", ") : (d.message ?? txt.saveFailed);
        setResult({ success: false, msg: errMsg });
      }
    } catch {
      setResult({ success: false, msg: txt.saveFailed });
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserShell activeKey="sticker-templates" defaultExpandedKey="settings"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      <div className="catv-panel max-w-4xl p-5">
        <p className="mb-5 text-sm text-[var(--muted)]">{txt.intro}</p>

        {loading ? (
          <p className="text-center text-sm text-[var(--muted)]">{txt.loading}</p>
        ) : (
          <div className="grid gap-6">
            {result && (
              <div className={`rounded-xl px-3 py-2 text-sm ${result.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {result.msg}
              </div>
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold">{txt.defaultTemplate}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.map((tpl) => {
                  const isDefault = tpl.key === defaultKey;
                  return (
                    <button key={tpl.key} type="button" onClick={() => setDefaultKey(tpl.key)}
                      className={`rounded-xl border p-3 text-left transition ${
                        isDefault
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "border-[var(--border)] hover:bg-[var(--surface-soft)]"
                      }`}>
                      <div
                        onClick={(e) => { if (tpl.preview_url) { e.stopPropagation(); setEnlarged(tpl); } }}
                        className="mb-2 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-white"
                      >
                        {tpl.preview_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tpl.preview_url} alt={locale === "bn" ? tpl.label_bn : tpl.label_en}
                            className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-xs text-[var(--muted)]">{txt.noPreview}</span>
                        )}
                      </div>
                      <div className="px-1">
                        <div className="font-semibold">{locale === "bn" ? tpl.label_bn : tpl.label_en}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{tpl.size_label}</div>
                        <div className={`mt-2 text-xs font-semibold ${isDefault ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
                          {isDefault ? txt.isDefault : txt.setDefault}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">{txt.courierOverrides}</h3>
              <p className="mb-3 text-xs text-[var(--muted)]">{txt.courierOverridesHint}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {COURIERS.map((courier) => (
                  <label key={courier} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
                    <span className="text-sm">{txt.couriers[courier] ?? courier}</span>
                    <select value={overrides[courier] ?? ""} onChange={e => setOverrides(o => ({ ...o, [courier]: e.target.value }))}
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs outline-none focus:border-[var(--accent)]">
                      <option value="">{txt.useDefault}</option>
                      {catalog.map((tpl) => (
                        <option key={tpl.key} value={tpl.key}>{locale === "bn" ? tpl.label_bn : tpl.label_en}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => void handleSave()} disabled={saving}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? txt.saving : txt.save}
              </button>
            </div>
          </div>
        )}
      </div>

      {enlarged && enlarged.preview_url && (
        <div onClick={() => setEnlarged(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-full rounded-xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enlarged.preview_url} alt={locale === "bn" ? enlarged.label_bn : enlarged.label_en}
              className="max-h-[75vh] max-w-full object-contain" />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-black">{locale === "bn" ? enlarged.label_bn : enlarged.label_en}</span>
              <button onClick={() => setEnlarged(null)} className="rounded-lg border border-black/20 px-3 py-1 text-xs text-black">
                {txt.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  );
}
