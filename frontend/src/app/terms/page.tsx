"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { renderTiptapJSON } from "@/lib/rich-text-render";
import { getStoredLocale, LOCALE_STORAGE_KEY, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

type PlatformSettings = {
  terms_title_bn: string | null;
  terms_title_en: string | null;
  terms_content_bn: JSONContent | null;
  terms_content_en: JSONContent | null;
};

const t = {
  bn: { loading: "লোড হচ্ছে...", lang: "English" },
  en: { loading: "Loading...", lang: "বাংলা" },
};

export default function PublicTermsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    fetch(`${API}/public/platform-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setSettings(json?.data ?? null))
      .catch(() => {});
  }, []);

  const toggleLocale = () => {
    const next = locale === "bn" ? "en" : "bn";
    setLocale(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {}
  };

  const title = locale === "bn" ? settings?.terms_title_bn : settings?.terms_title_en;
  const content = locale === "bn" ? settings?.terms_content_bn : settings?.terms_content_en;
  const html = useMemo(() => renderTiptapJSON(content), [content]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <a href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-700">← Home</a>
          <button onClick={toggleLocale} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            {t[locale].lang}
          </button>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          {!settings ? (
            <p className="py-10 text-center text-sm text-slate-400">{t[locale].loading}</p>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title || (locale === "bn" ? "ব্যবহারের শর্তাবলি" : "Terms of Use")}</h1>
              <div
                className="lp-html prose prose-slate mt-6 max-w-none text-sm leading-7 text-slate-700"
                dangerouslySetInnerHTML={{ __html: html || `<p>${locale === "bn" ? "কোনো কনটেন্ট যোগ করা হয়নি।" : "No content added yet."}</p>` }}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
