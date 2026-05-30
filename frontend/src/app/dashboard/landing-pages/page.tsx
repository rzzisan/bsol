"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UserShell from "@/components/user-shell";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";
import { LANDING_API_BASE, getLandingTemplateName } from "@/lib/landing-pages";

// TODO: Replace with actual i18n import
const text: Record<string, Record<string, string>> = {
  bn: {
    title: "ল্যান্ডিং পেজ",
    create: "নতুন ল্যান্ডিং পেজ",
    noPages: "কোনো ল্যান্ডিং পেজ নেই",
    loading: "লোড হচ্ছে...",
    published: "Published",
    draft: "Draft",
    actions: "Actions",
    view: "দেখুন",
    edit: "এডিট",
    statistics: "স্ট্যাটিস্টিক্স",
  },
  en: {
    title: "Landing Pages",
    create: "Create Landing Page",
    noPages: "No landing pages yet",
    loading: "Loading...",
    published: "Published",
    draft: "Draft",
    actions: "Actions",
    view: "View",
    edit: "Edit",
    statistics: "Statistics",
  },
};

interface LandingPage {
  id: number;
  title: string;
  slug: string;
  status: string;
  published_at?: string | null;
  product_count?: number;
  public_url?: string;
  template?: { id: number; code: string; name_bn: string; name_en: string } | null;
  created_at: string;
  updated_at: string;
}

export default function LandingPages() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState<Locale>("bn");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setLocale(getStoredLocale());

    const handleStorage = () => setLocale(getStoredLocale());
    window.addEventListener("storage", handleStorage);

    const fetchPages = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setLoading(false);
          return;
        }
        
        const res = await fetch(`${LANDING_API_BASE}/landing/pages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) {
          console.error(`API error: ${res.status}`);
          setLoading(false);
          return;
        }
        
        const data = await res.json();
        setPages(data.data || []);
      } catch (err) {
        console.error("Error loading landing pages:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPages();
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const t = text[locale] || text.bn;

  const loadPages = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return;
      const res = await fetch(`${LANDING_API_BASE}/landing/pages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setPages(data.data || []);
    } catch {
      // ignore refresh errors
    }
  };

  const publishPage = async (pageId: number) => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setBusyId(pageId);
    setFlash(null);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${pageId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFlash(locale === "bn" ? "পেজ publish হয়েছে।" : "Page published.");
        await loadPages();
      }
    } finally {
      setBusyId(null);
    }
  };

  const unpublishPage = async (pageId: number) => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setBusyId(pageId);
    setFlash(null);
    try {
      const target = pages.find((item) => item.id === pageId);
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: target?.title,
          slug: target?.slug,
          status: "draft",
        }),
      });
      if (res.ok) {
        setFlash(locale === "bn" ? "পেজ draft করা হয়েছে।" : "Page moved to draft.");
        await loadPages();
      }
    } finally {
      setBusyId(null);
    }
  };

  const deletePage = async (pageId: number) => {
    const confirmed = window.confirm(locale === "bn" ? "এই পেজটি মুছে ফেলতে চান?" : "Delete this page?");
    if (!confirmed) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setBusyId(pageId);
    setFlash(null);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFlash(locale === "bn" ? "পেজ delete হয়েছে।" : "Page deleted.");
        await loadPages();
      }
    } finally {
      setBusyId(null);
    }
  };

  const copyUrl = async (url?: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setFlash(locale === "bn" ? "Public URL copy হয়েছে।" : "Public URL copied.");
    } catch {
      setFlash(locale === "bn" ? "URL copy করা যায়নি।" : "Failed to copy URL.");
    }
  };

  return (
    <UserShell
      activeKey="landing-pages"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{
        bn: "আপনার সেলার ল্যান্ডিং পেজগুলো তৈরি, দেখা ও ম্যানেজ করুন।",
        en: "Create, review, and manage your seller landing pages.",
      }}
    >
      <section className="catv-panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{t.title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {locale === "bn"
                ? "নতুন পেজ তৈরি করুন, draft/published অবস্থা দেখুন, আর দ্রুত edit করুন।"
                : "Create new pages, review draft/published status, and edit quickly."}
            </p>
          </div>
          <Link
            href="/dashboard/landing-pages/create"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            {t.create}
          </Link>
        </div>
      </section>

      <section className="catv-panel mt-4 overflow-hidden">
        {flash ? <div className="border-b border-[var(--border)] px-5 py-3 text-sm text-emerald-400">{flash}</div> : null}
        {loading ? (
          <div className="p-5 text-sm text-[var(--muted)]">{t.loading}</div>
        ) : pages.length === 0 ? (
          <div className="p-5 text-sm text-[var(--muted)]">{t.noPages}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-soft)] text-left text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Template</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Products</th>
                  <th className="px-4 py-3 font-medium">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">{page.id}</td>
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{page.title}</td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{getLandingTemplateName(page.template, locale)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${page.status === "published" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {page.status === "published" ? t.published : t.draft}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{page.product_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3 text-sm">
                        <Link href={`/dashboard/landing-pages/${page.id}`} className="font-medium text-[var(--accent)] hover:underline">
                          {t.view}
                        </Link>
                        <Link href={`/admin/landing-page-analytics/${page.id}`} className="font-medium text-[var(--accent)] hover:underline">
                          {t.statistics}
                        </Link>
                        <Link href={`/dashboard/landing-pages/${page.id}/edit`} className="font-medium text-[var(--accent)] hover:underline">
                          {t.edit}
                        </Link>
                        {page.public_url ? (
                          <a href={page.public_url} target="_blank" rel="noreferrer" className="font-medium text-[var(--accent)] hover:underline">
                            {locale === "bn" ? "Preview" : "Preview"}
                          </a>
                        ) : null}
                        <button type="button" onClick={() => void copyUrl(page.public_url)} className="font-medium text-[var(--accent)] hover:underline">
                          {locale === "bn" ? "URL copy" : "Copy URL"}
                        </button>
                        {page.status !== "published" ? (
                          <button type="button" disabled={busyId === page.id} onClick={() => void publishPage(page.id)} className="font-medium text-emerald-400 hover:underline disabled:opacity-50">
                            {busyId === page.id ? "..." : locale === "bn" ? "Publish" : "Publish"}
                          </button>
                        ) : (
                          <button type="button" disabled={busyId === page.id} onClick={() => void unpublishPage(page.id)} className="font-medium text-amber-400 hover:underline disabled:opacity-50">
                            {locale === "bn" ? "Unpublish" : "Unpublish"}
                          </button>
                        )}
                        <button type="button" disabled={busyId === page.id} onClick={() => void deletePage(page.id)} className="font-medium text-red-400 hover:underline disabled:opacity-50">
                          {locale === "bn" ? "Delete" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </UserShell>
  );
}
