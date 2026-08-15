"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearStoredAuth,
  getStoredLocale,
  getStoredToken,
  type Locale,
} from "@/lib/dashboard-client";

/**
 * Mandatory setup for a new seller: shop profile, then their shop address.
 *
 * Both are required before the account can do anything useful — a landing
 * page cannot be published without a subdomain, and a subdomain cannot be
 * claimed without a saved profile. Finishing hands the session over to the
 * seller's own address, because the token minted here belongs to the
 * platform origin and localStorage does not cross origins.
 */

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");
const APEX = process.env.NEXT_PUBLIC_SUBDOMAIN_APEX ?? "zyrotechbd.com";

const t = {
  bn: {
    title: "শপ সেটআপ",
    step: "ধাপ",
    of: "/",
    profileTitle: "শপের তথ্য",
    profileIntro: "এই তথ্যগুলো কুরিয়ার ওয়েবিল ও ইনভয়েসে ব্যবহার হবে।",
    shopName: "শপের নাম",
    shopNamePlaceholder: "যেমন: রহিম ফ্যাশন হাউজ",
    phone: "ফোন নাম্বার",
    email: "ইমেইল (ঐচ্ছিক)",
    address: "ঠিকানা (পিকআপ ঠিকানা)",
    addressPlaceholder: "দোকান/গুদামের সম্পূর্ণ ঠিকানা",
    next: "পরবর্তী ধাপ",
    saving: "সেভ হচ্ছে...",
    domainTitle: "আপনার শপের ঠিকানা",
    domainIntro: "এই ঠিকানাতেই আপনার ড্যাশবোর্ড ও ল্যান্ডিং পেজ চলবে। বিজ্ঞাপনের লিংকও এটাই হবে।",
    domainWarning: "সাবধানে বাছুন — পরে বদলালে পুরনো ঠিকানা চিরতরে বন্ধ হয়ে যাবে এবং চালু বিজ্ঞাপনের লিংক ভেঙে যাবে।",
    domainLabel: "সাবডোমেইন",
    domainPlaceholder: "যেমন: rahimfashion",
    checking: "যাচাই করা হচ্ছে...",
    available: "এই ঠিকানাটি পাওয়া যাচ্ছে",
    finish: "শেষ করুন",
    finishing: "প্রস্তুত হচ্ছে...",
    redirecting: "আপনার ঠিকানায় নিয়ে যাওয়া হচ্ছে...",
    failed: "সেভ করা যায়নি, আবার চেষ্টা করুন।",
    logout: "লগআউট",
    reasonTaken: "এই ঠিকানাটি ইতিমধ্যে ব্যবহার হচ্ছে।",
    reasonReserved: "এই ঠিকানাটি সংরক্ষিত।",
    reasonTooShort: "কমপক্ষে ৩ অক্ষর দিন।",
    reasonTooLong: "সর্বোচ্চ ৬৩ অক্ষর।",
    reasonInvalid: "শুধু ছোট হাতের অক্ষর, সংখ্যা ও মাঝখানে একক হাইফেন।",
  },
  en: {
    title: "Shop setup",
    step: "Step",
    of: "of",
    profileTitle: "Shop details",
    profileIntro: "These appear on courier waybills and invoices.",
    shopName: "Shop name",
    shopNamePlaceholder: "e.g. Rahim Fashion House",
    phone: "Phone number",
    email: "Email (optional)",
    address: "Address (pickup address)",
    addressPlaceholder: "Full address of your shop/warehouse",
    next: "Next step",
    saving: "Saving...",
    domainTitle: "Your shop address",
    domainIntro: "Your dashboard and landing pages will live here. This is also what your ads will point at.",
    domainWarning: "Choose carefully — changing it later retires the old address permanently and breaks any live ad links.",
    domainLabel: "Subdomain",
    domainPlaceholder: "e.g. rahimfashion",
    checking: "Checking...",
    available: "This address is available",
    finish: "Finish",
    finishing: "Getting ready...",
    redirecting: "Taking you to your address...",
    failed: "Could not save, please try again.",
    logout: "Log out",
    reasonTaken: "This address is already taken.",
    reasonReserved: "This address is reserved.",
    reasonTooShort: "Use at least 3 characters.",
    reasonTooLong: "Use at most 63 characters.",
    reasonInvalid: "Lowercase letters, numbers and single hyphens only.",
  },
};

type Availability = { label: string; available: boolean; reason: string | null };

export default function OnboardingPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = t[locale];

  const [step, setStep] = useState<1 | 2>(1);
  const [ready, setReady] = useState(false);
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(
    () => ({ Accept: "application/json", Authorization: `Bearer ${getStoredToken()}` }),
    [],
  );

  // Pick up where the seller left off, and prefill anything already saved.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API}/shop-profile`, { headers: authHeaders() });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d?.data) {
          setShopName(d.data.shop_name ?? "");
          setPhone(d.data.phone ?? "");
          setEmail(d.data.email ?? "");
          setAddress(d.data.address ?? "");
          if (d.data.id) setStep(2);
        }
      } finally {
        setReady(true);
      }
    })();
  }, [authHeaders]);

  const normalized = label.trim().toLowerCase();
  const settled = availability && availability.label === normalized ? availability : null;
  const checking = step === 2 && normalized.length > 0 && settled === null;

  useEffect(() => {
    if (step !== 2 || normalized.length === 0) return;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `${API}/shop-profile/subdomain/check?label=${encodeURIComponent(normalized)}`,
            { headers: authHeaders() },
          );
          const d = await res.json();
          if (res.ok) setAvailability({ ...d.data, label: normalized });
        } catch {
          /* next keystroke retries */
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [normalized, step, authHeaders]);

  const reasonText = (reason: string | null) =>
    ({
      taken: txt.reasonTaken,
      reserved: txt.reasonReserved,
      too_short: txt.reasonTooShort,
      too_long: txt.reasonTooLong,
      invalid_format: txt.reasonInvalid,
    })[reason ?? ""] ?? null;

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("shop_name", shopName.trim());
      body.append("phone", phone.trim());
      body.append("email", email.trim());
      body.append("address", address.trim());
      const res = await fetch(`${API}/shop-profile`, { method: "POST", headers: authHeaders(), body });
      if (res.ok) {
        setStep(2);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(
          d?.errors ? Object.values(d.errors as Record<string, string[]>).flat().join(", ") : (d?.message ?? txt.failed),
        );
      }
    } catch {
      setError(txt.failed);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!settled?.available) return;
    setBusy(true);
    setError(null);
    try {
      const claim = await fetch(`${API}/shop-profile/subdomain`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ label: normalized }),
      });
      const claimed = await claim.json().catch(() => ({}));
      if (!claim.ok) {
        setError(reasonText(claimed?.error_code) ?? claimed?.message ?? txt.failed);
        return;
      }

      // The token here belongs to the platform origin; the shop's own origin
      // needs its own. A single-use handoff code carries the session across.
      const handoff = await fetch(`${API}/auth/handoff/start`, { method: "POST", headers: authHeaders() });
      const data = await handoff.json().catch(() => ({}));

      if (handoff.ok && data?.redirect_to) {
        clearStoredAuth();
        window.location.href = data.redirect_to;
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError(txt.failed);
    } finally {
      setBusy(false);
    }
  };

  const profileValid = shopName.trim() && phone.trim() && address.trim();
  const input =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10 text-[var(--foreground)]">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">{txt.title}</h1>
          <span className="text-xs text-[var(--muted)]">
            {txt.step} {step} {txt.of} 2
          </span>
        </div>

        <div className="catv-panel p-5">
          {!ready ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">...</p>
          ) : step === 1 ? (
            <>
              <p className="text-sm font-semibold">{txt.profileTitle}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{txt.profileIntro}</p>

              <div className="mt-4 grid gap-3">
                <label>
                  <span className="mb-1 block text-xs text-[var(--muted)]">{txt.shopName}</span>
                  <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder={txt.shopNamePlaceholder} className={input} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">{txt.phone}</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="numeric" className={input} />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">{txt.email}</span>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={input} />
                  </label>
                </div>
                <label>
                  <span className="mb-1 block text-xs text-[var(--muted)]">{txt.address}</span>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder={txt.addressPlaceholder} className={input} />
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">{txt.domainTitle}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{txt.domainIntro}</p>
              <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-500">{txt.domainWarning}</p>

              <label className="mt-4 block">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.domainLabel}</span>
                <div className="flex items-center gap-2">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder={txt.domainPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    className={input}
                  />
                  <span className="shrink-0 text-sm text-[var(--muted)]">.{APEX}</span>
                </div>
              </label>

              {checking && <p className="mt-2 text-xs text-[var(--muted)]">{txt.checking}</p>}
              {!checking && settled?.available && <p className="mt-2 text-xs text-emerald-400">{txt.available}</p>}
              {!checking && settled && !settled.available && (
                <p className="mt-2 text-xs text-red-400">{reasonText(settled.reason)}</p>
              )}
            </>
          )}

          {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                clearStoredAuth();
                window.location.href = "/";
              }}
              className="text-xs text-[var(--muted)] hover:underline"
            >
              {txt.logout}
            </button>

            {step === 1 ? (
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={busy || !profileValid}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? txt.saving : txt.next}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void finish()}
                disabled={busy || checking || !settled?.available}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? txt.finishing : txt.finish}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
