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
    stickerSettings: "স্টিকার প্রিন্ট সেটিং",
    stickerSettingsHint: "কুরিয়ার স্টিকারের \"FROM (SENDER)\" অংশে আপনার এই তথ্যগুলো দেখানো হবে কি না, তা নিয়ন্ত্রণ করুন।",
    showPhoneOnSticker: "স্টিকারে ফোন নাম্বার দেখাও",
    showAddressOnSticker: "স্টিকারে ঠিকানা দেখাও",
    subdomainTitle: "শপের নিজস্ব ঠিকানা (সাবডোমেইন)",
    subdomainHint: "আপনার ড্যাশবোর্ড ও ল্যান্ডিং পেজ এই ঠিকানায় দেখা যাবে।",
    subdomainLabel: "সাবডোমেইন",
    subdomainPlaceholder: "যেমন: rahimfashion",
    checking: "যাচাই করা হচ্ছে...",
    available: "এই ঠিকানাটি পাওয়া যাচ্ছে",
    claim: "ঠিকানা সেট করুন",
    claiming: "সেট হচ্ছে...",
    currentAddress: "বর্তমান ঠিকানা",
    visit: "খুলুন",
    change: "পরিবর্তন করুন",
    cancel: "বাতিল",
    release: "ঠিকানা ছেড়ে দিন",
    releasing: "ছাড়া হচ্ছে...",
    subdomainSaved: "ঠিকানা সেট হয়েছে। এখন থেকে লগইন করলে এখানেই আসবেন।",
    subdomainReleased: "ঠিকানা ছেড়ে দেওয়া হয়েছে।",
    changeWarning: "সতর্কতা: ঠিকানা একবার বদলালে পুরনোটি চিরতরে বন্ধ হয়ে যাবে এবং অন্য কেউ সেটি নিতে পারবে না। চালু বিজ্ঞাপনের লিংক ও ট্র্যাকিং ডেটা ভেঙে যাবে — বিজ্ঞাপন চালু করার আগেই ঠিকানা চূড়ান্ত করুন।",
    releaseConfirm: "ঠিকানাটি ছেড়ে দিলে সেটি আর কখনো ফিরে পাওয়া যাবে না এবং ওই ঠিকানার সব লিংক কাজ করা বন্ধ করবে। নিশ্চিত?",
    saveProfileFirst: "সাবডোমেইন সেট করার আগে শপ প্রোফাইল সেভ করুন।",
    reasonTaken: "এই ঠিকানাটি ইতিমধ্যে ব্যবহার হচ্ছে।",
    reasonReserved: "এই ঠিকানাটি সংরক্ষিত, ব্যবহার করা যাবে না।",
    reasonTooShort: "কমপক্ষে ৩ অক্ষর দিন।",
    reasonTooLong: "সর্বোচ্চ ৬৩ অক্ষর।",
    reasonInvalid: "শুধু ছোট হাতের অক্ষর, সংখ্যা ও মাঝখানে একক হাইফেন ব্যবহার করুন।",
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
    stickerSettings: "Sticker Print Settings",
    stickerSettingsHint: "Control whether your phone/address show up on the courier sticker's \"FROM (SENDER)\" block.",
    showPhoneOnSticker: "Show phone number on sticker",
    showAddressOnSticker: "Show address on sticker",
    subdomainTitle: "Your shop address (subdomain)",
    subdomainHint: "Your dashboard and landing pages will be served at this address.",
    subdomainLabel: "Subdomain",
    subdomainPlaceholder: "e.g. rahimfashion",
    checking: "Checking...",
    available: "This address is available",
    claim: "Set address",
    claiming: "Setting...",
    currentAddress: "Current address",
    visit: "Open",
    change: "Change",
    cancel: "Cancel",
    release: "Release address",
    releasing: "Releasing...",
    subdomainSaved: "Address set. From now on, logging in will take you here.",
    subdomainReleased: "Address released.",
    changeWarning: "Warning: changing this permanently retires the old address — nobody, including you, can claim it again. Live ad links and tracking data pointing at it will break, so settle on an address before launching ads.",
    releaseConfirm: "Releasing this address is permanent — it can never be reclaimed, and every link to it will stop working. Continue?",
    saveProfileFirst: "Save your shop profile before choosing a subdomain.",
    reasonTaken: "This address is already taken.",
    reasonReserved: "This address is reserved and cannot be used.",
    reasonTooShort: "Use at least 3 characters.",
    reasonTooLong: "Use at most 63 characters.",
    reasonInvalid: "Use lowercase letters, numbers and single hyphens in the middle only.",
  },
};

const APEX = process.env.NEXT_PUBLIC_SUBDOMAIN_APEX ?? "zyrotechbd.com";

type Availability = { label: string; available: boolean; reason: string | null; host: string | null };

type ShopProfile = {
  shop_name: string;
  phone: string;
  email: string | null;
  address: string;
  logo_url: string | null;
  show_phone_on_sticker: boolean;
  show_address_on_sticker: boolean;
};

/**
 * Subdomain claim/change/release (custom_domain_context.md §5).
 *
 * Kept out of the main profile form on purpose: it has its own endpoints,
 * and its consequences (a permanent tombstone, broken ad links) are not
 * something a seller should trigger by pressing the form's Save button.
 */
function SubdomainPanel({
  txt,
  token,
  initial,
  profileExists,
}: {
  txt: (typeof t)["bn"];
  token: string | null;
  initial: { subdomain: string | null; status: string };
  profileExists: boolean;
}) {
  const [current, setCurrent] = useState<string | null>(
    initial.status === "active" ? initial.subdomain : null,
  );
  const [editing, setEditing] = useState(!current);
  const [input, setInput] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ success: boolean; text: string } | null>(null);

  const label = input.trim().toLowerCase();

  // The result carries the label it belongs to, so a stale answer for a
  // previously typed label is simply not shown — no need to clear state
  // synchronously inside the effect, which React 19 flags as a cascading
  // render.
  const settled = availability && availability.label === label ? availability : null;
  const checking = editing && label.length > 0 && settled === null;

  const reasonText = (reason: string | null) =>
    ({
      taken: txt.reasonTaken,
      reserved: txt.reasonReserved,
      too_short: txt.reasonTooShort,
      too_long: txt.reasonTooLong,
      invalid_format: txt.reasonInvalid,
    })[reason ?? ""] ?? null;

  // Debounced so typing doesn't fire a request per keystroke against the
  // 30/min throttle on the check endpoint.
  useEffect(() => {
    if (!editing || label.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API}/shop-profile/subdomain/check?label=${encodeURIComponent(label)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const d = await res.json();
        if (res.ok) setAvailability({ ...(d.data as Availability), label });
      } catch {
        /* leave it as "checking" — the next keystroke retries */
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [label, editing, token]);

  const claim = async () => {
    if (!settled?.available) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/shop-profile/subdomain`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label }),
      });
      const d = await res.json();
      if (res.ok) {
        setCurrent(d.data.subdomain);
        setEditing(false);
        setInput("");
        setAvailability(null);
        setMsg({ success: true, text: txt.subdomainSaved });
      } else {
        setMsg({ success: false, text: reasonText(d.error_code) ?? d.message });
      }
    } catch {
      setMsg({ success: false, text: txt.saveFailed });
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!window.confirm(txt.releaseConfirm)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/shop-profile/subdomain`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCurrent(null);
        setEditing(true);
        setMsg({ success: true, text: txt.subdomainReleased });
      } else {
        const d = await res.json();
        setMsg({ success: false, text: d.message ?? txt.saveFailed });
      }
    } catch {
      setMsg({ success: false, text: txt.saveFailed });
    } finally {
      setBusy(false);
    }
  };

  const invalidReason = settled && !settled.available ? reasonText(settled.reason) : null;

  return (
    <div className="catv-panel mt-5 max-w-2xl p-5">
      <p className="text-sm font-semibold">{txt.subdomainTitle}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{txt.subdomainHint}</p>

      {msg && (
        <div
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${msg.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}
        >
          {msg.text}
        </div>
      )}

      {!profileExists ? (
        <p className="mt-4 text-sm text-amber-400">{txt.saveProfileFirst}</p>
      ) : current && !editing ? (
        <div className="mt-4">
          <span className="block text-xs text-[var(--muted)]">{txt.currentAddress}</span>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-[var(--surface-soft)] px-3 py-1.5 text-sm">
              {current}.{APEX}
            </code>
            <a
              href={`https://${current}.${APEX}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              {txt.visit}
            </a>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-soft)]"
            >
              {txt.change}
            </button>
            <button
              type="button"
              onClick={() => void release()}
              disabled={busy}
              className="rounded-xl border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
            >
              {busy ? txt.releasing : txt.release}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {current && (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-400">{txt.changeWarning}</p>
          )}

          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">{txt.subdomainLabel}</span>
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder={txt.subdomainPlaceholder}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <span className="shrink-0 text-sm text-[var(--muted)]">.{APEX}</span>
            </div>
          </label>

          {checking && <p className="text-xs text-[var(--muted)]">{txt.checking}</p>}
          {!checking && settled?.available && (
            <p className="text-xs text-emerald-400">{txt.available}</p>
          )}
          {!checking && invalidReason && <p className="text-xs text-red-400">{invalidReason}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void claim()}
              disabled={busy || checking || !settled?.available}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? txt.claiming : txt.claim}
            </button>
            {current && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setInput("");
                  setAvailability(null);
                }}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]"
              >
                {txt.cancel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShopProfilePage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = t[locale];
  const token = getStoredToken();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ShopProfile>({
    shop_name: "", phone: "", email: "", address: "", logo_url: null,
    show_phone_on_sticker: true, show_address_on_sticker: true,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // show() returns firstOrNew(), so an unsaved profile comes back without an
  // id — the subdomain endpoints need a persisted row to attach to.
  const [profileExists, setProfileExists] = useState(false);
  const [subdomain, setSubdomain] = useState<{ subdomain: string | null; status: string }>({
    subdomain: null,
    status: "none",
  });

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
              show_phone_on_sticker: d.data.show_phone_on_sticker ?? true,
              show_address_on_sticker: d.data.show_address_on_sticker ?? true,
            });
            setProfileExists(Boolean(d.data.id));
            setSubdomain({
              subdomain: d.data.subdomain ?? null,
              status: d.data.subdomain_status ?? "none",
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
      body.append("show_phone_on_sticker", form.show_phone_on_sticker ? "1" : "0");
      body.append("show_address_on_sticker", form.show_address_on_sticker ? "1" : "0");
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
          show_phone_on_sticker: d.data.show_phone_on_sticker ?? true,
          show_address_on_sticker: d.data.show_address_on_sticker ?? true,
        });
        setLogoFile(null);
        setRemoveLogo(false);
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoPreview(null);
        setProfileExists(true);
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

            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm font-semibold">{txt.stickerSettings}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{txt.stickerSettingsHint}</p>
              <div className="mt-3 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.show_phone_on_sticker}
                    onChange={e => setForm(f => ({ ...f, show_phone_on_sticker: e.target.checked }))} />
                  {txt.showPhoneOnSticker}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.show_address_on_sticker}
                    onChange={e => setForm(f => ({ ...f, show_address_on_sticker: e.target.checked }))} />
                  {txt.showAddressOnSticker}
                </label>
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

      {!loading && (
        <SubdomainPanel txt={txt} token={token} initial={subdomain} profileExists={profileExists} />
      )}
    </UserShell>
  );
}
