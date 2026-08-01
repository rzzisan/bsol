"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UserShell from "@/components/user-shell";
import { useLocale } from "@/lib/locale-context";
import { getStoredToken } from "@/lib/dashboard-client";
import { LANDING_API_BASE, getLandingTemplateName, type LandingTemplate } from "@/lib/landing-pages";

const text = {
  bn: {
    title: "নতুন ল্যান্ডিং পেজ শুরু করুন",
    subtitle: "একটি রেডিমেড টেমপ্লেট দিয়ে শুরু করুন, অথবা একদম খালি পেজ থেকে শুরু করুন।",
    blank: "খালি পেজ থেকে শুরু করুন",
    blankHint: "কোনো টেমপ্লেট ছাড়া নতুন করে সব ব্লক নিজে সাজান।",
    useTemplate: "এই টেমপ্লেট ব্যবহার করুন",
    loading: "লোড হচ্ছে...",
    empty: "এই মুহূর্তে কোনো টেমপ্লেট নেই — খালি পেজ থেকে শুরু করুন।",
  },
  en: {
    title: "Start a new landing page",
    subtitle: "Start from a ready-made template, or begin with a blank page.",
    blank: "Start from a blank page",
    blankHint: "No template — arrange every block yourself.",
    useTemplate: "Use this template",
    loading: "Loading...",
    empty: "No templates available right now — start from a blank page.",
  },
};

function TemplateGalleryContent() {
  const locale = useLocale();
  const t = text[locale] ?? text.en;
  const [templates, setTemplates] = useState<LandingTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${LANDING_API_BASE}/landing/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setTemplates(json.data ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="catv-panel p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/landing-pages/builder/create"
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] p-6 text-center hover:border-[var(--accent)]"
        >
          <span className="text-2xl">＋</span>
          <span className="mt-2 text-sm font-semibold text-[var(--foreground)]">{t.blank}</span>
          <span className="mt-1 text-xs text-[var(--muted)]">{t.blankHint}</span>
        </Link>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-[var(--border)] p-6 text-sm text-[var(--muted)]">
            {t.loading}
          </div>
        ) : (
          templates.map((tpl) => (
            <div key={tpl.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]">
              <div className="aspect-video w-full bg-[var(--surface)]">
                {tpl.preview_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tpl.preview_image} alt={getLandingTemplateName(tpl, locale)} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">{getLandingTemplateName(tpl, locale)}</h3>
                {tpl.description ? <p className="mt-1 text-xs text-[var(--muted)]">{tpl.description}</p> : null}
                <Link
                  href={`/dashboard/landing-pages/builder/create?template=${tpl.id}`}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white"
                >
                  {t.useTemplate}
                </Link>
              </div>
            </div>
          ))
        )}

        {!loading && templates.length === 0 ? (
          <p className="text-sm text-[var(--muted)] sm:col-span-2 lg:col-span-2">{t.empty}</p>
        ) : null}
      </div>
    </section>
  );
}

export default function LandingPageTemplatesGallery() {
  return (
    <UserShell
      activeKey="landing-pages"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      <TemplateGalleryContent />
    </UserShell>
  );
}
