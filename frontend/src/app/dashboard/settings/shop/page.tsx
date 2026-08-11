"use client";

import { useEffect, useRef, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "শপ প্রোফাইল",
    intro: "আপনার শপের নাম, ফোন নাম্বার, ঠিকানা এবং লোগো সেট করুন — এই তথ্যগুলো কুরিয়ার ওয়েবিল/স্টিকারের \"FROM (SENDER)\" অংশে ব্যবহার হবে।",
    loading: "লোড হচ্ছে...",
    shopName: "শপের নাম",
    shopNamePlaceholder: "যেমন: রহিম ফ্যাশন হাউজ",
    phone: "ফোন নাম্বার",
    email: "ইমেইল (ঐচ্ছিক)",
    address: "ঠিকানা (পিকআপ ঠিকানা)",
    addressPlaceholder: "দোকান/গুদামের সম্পূর্ণ ঠিকানা লিখুন",
    logo: "লোগো (ঐচ্ছিক)",
    logoHint: "JPG/PNG/WEBP, সর্বোচ্চ ২MB",
    changeLogo: "লোগো পরিবর্তন করুন",
    uploadLogo: "লোগো আপলোড করুন",
    removeLogo: "লোগো সরান",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    saveSuccess: "শপ প্রোফাইল সেভ হয়েছে।",
    saveFailed: "সেভ করা যায়নি, আবার চেষ্টা করুন।",
    required: "এই ফিল্ডটি আবশ্যক।",
  },
  en: {
    pageTitle: "Shop Profile",
    intro: "Set your shop name, phone number, address and logo — these are used in the \"FROM (SENDER)\" block on courier waybills/stickers.",
    loading: "Loading...",
    shopName: "Shop Name",
    shopNamePlaceholder: "e.g. Rahim Fashion House",
    phone: "Phone Number",
    email: "Email (optional)",
    address: "Address (pickup address)",
    addressPlaceholder: "Full address of your shop/warehouse",
    logo: "Logo (optional)",
    logoHint: "JPG/PNG/WEBP, max 2MB",
    changeLogo: "Change logo",
    uploadLogo: "Upload logo",
    removeLogo: "Remove logo",
    save: "Save",
    saving: "Saving...",
    saveSuccess: "Shop profile saved.",
    saveFailed: "Could not save, please try again.",
    required: "This field is required.",
  },
};

type ShopProfile = {
  shop_name: string;
  phone: string;
  email: string | null;
  address: string;
  logo_url: string | null;
};

export default function ShopProfilePage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = t[locale];
  const token = getStoredToken();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ShopProfile>({ shop_name: "", phone: "", email: "", address: "", logo_url: null });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/shop-profile`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          if (d.data) {
            setForm({
              shop_name: d.data.shop_name ?? "",
              phone: d.data.phone ?? "",
              email: d.data.email ?? "",
              address: d.data.address ?? "",
              logo_url: d.data.logo_url ?? null,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogoChange = (file: File | null) => {
    setLogoFile(file);
    setRemoveLogo(false);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const onRemoveLogo = () => {
    onLogoChange(null);
    setRemoveLogo(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("shop_name", form.shop_name);
      body.append("phone", form.phone);
      if (form.email) body.append("email", form.email);
      body.append("address", form.address);
      if (logoFile) body.append("logo", logoFile);
      if (removeLogo) body.append("remove_logo", "1");

      const res = await fetch(`${API}/shop-profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setForm({
          shop_name: d.data.shop_name ?? "",
          phone: d.data.phone ?? "",
          email: d.data.email ?? "",
          address: d.data.address ?? "",
          logo_url: d.data.logo_url ?? null,
        });
        setLogoFile(null);
        setRemoveLogo(false);
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoPreview(null);
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

  const displayedLogo = logoPreview ?? (!removeLogo ? form.logo_url : null);
  const canSave = form.shop_name.trim().length > 0 && form.phone.trim().length > 0 && form.address.trim().length > 0;

  return (
    <UserShell activeKey="shop-profile" defaultExpandedKey="settings"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      <div className="catv-panel max-w-2xl p-5">
        <p className="mb-5 text-sm text-[var(--muted)]">{txt.intro}</p>

        {loading ? (
          <p className="text-center text-sm text-[var(--muted)]">{txt.loading}</p>
        ) : (
          <div className="grid gap-4">
            {result && (
              <div className={`rounded-xl px-3 py-2 text-sm ${result.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {result.msg}
              </div>
            )}

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.shopName}</span>
              <input value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))}
                placeholder={txt.shopNamePlaceholder}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.phone}</span>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  type="tel" inputMode="numeric"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.email}</span>
                <input value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>

            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.address}</span>
              <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder={txt.addressPlaceholder} rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </label>

            <div>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.logo}</span>
              <div className="flex items-center gap-4">
                {displayedLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayedLogo} alt="Logo" className="h-16 w-16 rounded-xl border border-[var(--border)] object-contain bg-white" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-2xl">🏪</div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-soft)]">
                      {displayedLogo ? txt.changeLogo : txt.uploadLogo}
                    </button>
                    {displayedLogo && (
                      <button type="button" onClick={onRemoveLogo}
                        className="rounded-xl border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10">
                        {txt.removeLogo}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)]">{txt.logoHint}</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => onLogoChange(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <div className="mt-2 flex justify-end">
              <button onClick={() => void handleSave()} disabled={saving || !canSave}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? txt.saving : txt.save}
              </button>
            </div>
          </div>
        )}
      </div>
    </UserShell>
  );
}
