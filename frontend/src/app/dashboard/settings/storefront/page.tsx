"use client";

import { useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

/**
 * Storefront homepage settings — S0 slice only (seller_storefront_context.md
 * §12): just the homepage_mode picker. The rest of storefront_settings
 * (banners, theme color, featured categories, policies) gets its UI in S5.
 */
const t = {
  bn: {
    pageTitle: "স্টোরফ্রন্ট",
    intro: "আপনার সাবডোমেইনের হোমপেজ (রুট ঠিকানা) কী দেখাবে বেছে নিন। যেটাই বেছে নিন, ক্যাটাগরি/প্রোডাক্ট পেজ সবসময় সরাসরি লিংকে চালু থাকবে।",
    loading: "লোড হচ্ছে...",
    modeStorefront: "শপ হোমপেজ (ডিফল্ট)",
    modeStorefrontHint: "একটা পূর্ণাঙ্গ ক্যাটালগ হোমপেজ — এখনো নির্মাণাধীন (আসছে ধাপে)।",
    modeLandingPage: "আমার একটা ল্যান্ডিং পেজ",
    modeLandingPageHint: "আপনার প্রকাশিত ল্যান্ডিং পেজগুলোর একটা রুট ঠিকানায় দেখাবে।",
    pickPage: "ল্যান্ডিং পেজ বেছে নিন",
    noPages: "কোনো প্রকাশিত ল্যান্ডিং পেজ নেই — আগে একটা পেজ প্রকাশ করুন।",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    saveSuccess: "সেভ হয়েছে।",
    saveFailed: "সেভ করা যায়নি, আবার চেষ্টা করুন।",
    selectRequired: "একটা ল্যান্ডিং পেজ বেছে নিন।",
  },
  en: {
    pageTitle: "Storefront",
    intro: "Choose what your subdomain's homepage (root address) shows. Either way, category/product pages stay live at their own direct links.",
    loading: "Loading...",
    modeStorefront: "Shop homepage (default)",
    modeStorefrontHint: "A full catalog homepage — still under construction (coming in a later phase).",
    modeLandingPage: "One of my landing pages",
    modeLandingPageHint: "Shows one of your published landing pages at the root address.",
    pickPage: "Pick a landing page",
    noPages: "No published landing page yet — publish one first.",
    save: "Save",
    saving: "Saving...",
    saveSuccess: "Saved.",
    saveFailed: "Could not save, please try again.",
    selectRequired: "Please pick a landing page.",
  },
};

type LandingPageOption = { id: number; title: string; status: string };
type Settings = { homepage_mode: "storefront" | "landing_page"; homepage_landing_page_id: number | null };

export default function StorefrontSettingsPage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<LandingPageOption[]>([]);
  const [mode, setMode] = useState<"storefront" | "landing_page">("storefront");
  const [pageId, setPageId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const txt = t[locale];

  useEffect(() => {
    setLocale(getStoredLocale());
    setToken(getStoredToken());
  }, []);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const [settingsRes, pagesRes] = await Promise.all([
          fetch(`${API}/storefront-settings`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/landing/pages?per_page=100`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const settingsJson = await settingsRes.json().catch(() => ({}));
        const pagesJson = await pagesRes.json().catch(() => ({}));

        const settings: Settings | undefined = settingsJson?.data;
        if (settings?.homepage_mode) setMode(settings.homepage_mode);
        if (settings?.homepage_landing_page_id) setPageId(settings.homepage_landing_page_id);

        const published: LandingPageOption[] = (pagesJson?.data ?? []).filter(
          (p: LandingPageOption) => p.status === "published",
        );
        setPages(published);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSave() {
    if (mode === "landing_page" && !pageId) {
      setMessage({ success: false, text: txt.selectRequired });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`${API}/storefront-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          homepage_mode: mode,
          homepage_landing_page_id: mode === "landing_page" ? pageId : null,
        }),
      });

      if (!res.ok) throw new Error("save failed");

      setMessage({ success: true, text: txt.saveSuccess });
    } catch {
      setMessage({ success: false, text: txt.saveFailed });
    } finally {
      setSaving(false);
    }
  }

  return (
    <UserShell activeKey="storefront-settings" defaultExpandedKey="settings">
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold sm:text-2xl">{txt.pageTitle}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{txt.intro}</p>

        {loading ? (
          <p className="mt-6 text-sm text-[var(--muted)]">{txt.loading}</p>
        ) : (
          <section className="catv-panel mt-5 p-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3">
              <input
                type="radio"
                checked={mode === "storefront"}
                onChange={() => setMode("storefront")}
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-sm font-semibold">{txt.modeStorefront}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{txt.modeStorefrontHint}</span>
              </span>
            </label>

            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3">
              <input
                type="radio"
                checked={mode === "landing_page"}
                onChange={() => setMode("landing_page")}
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
              />
              <span className="w-full">
                <span className="block text-sm font-semibold">{txt.modeLandingPage}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{txt.modeLandingPageHint}</span>

                {mode === "landing_page" ? (
                  pages.length > 0 ? (
                    <select
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value ? Number(e.target.value) : "")}
                      className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    >
                      <option value="">{txt.pickPage}</option>
                      {pages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-xs text-amber-600">{txt.noPages}</p>
                  )
                ) : null}
              </span>
            </label>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? txt.saving : txt.save}
              </button>
              {message ? (
                <p className={`text-sm ${message.success ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </UserShell>
  );
}
