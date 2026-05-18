"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UserShell from "@/components/user-shell";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";
import { LANDING_API_BASE, getLandingTemplateName, type LandingPageRecord } from "@/lib/landing-pages";

const text: Record<string, Record<string, string>> = {
  bn: {
    title: "ল্যান্ডিং পেজ বিস্তারিত",
    back: "ফিরে যান",
    edit: "এডিট",
    loading: "লোড হচ্ছে...",
    notFound: "ল্যান্ডিং পেজ পাওয়া যায়নি।",
  },
  en: {
    title: "Landing Page Details",
    back: "Go Back",
    edit: "Edit",
    loading: "Loading...",
    notFound: "Landing page not found.",
  },
};

export default function LandingPageDetails({ params }: { params: { id: string } }) {
  const [page, setPage] = useState<LandingPageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState<Locale>("bn");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLocale(getStoredLocale());

    const handleStorage = () => setLocale(getStoredLocale());
    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setLoading(false);
          return;
        }
        
        const res = await fetch(`${LANDING_API_BASE}/landing/pages/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) {
          console.error(`API error: ${res.status}`);
          setLoading(false);
          return;
        }
        
        const data = await res.json();
        setPage(data.data || null);
      } catch (err) {
        console.error("Error loading landing page:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPage();
  }, [params.id]);

  const t = text[locale] || text.bn;

  const copyUrl = async () => {
    if (!page?.public_url) return;
    try {
      await navigator.clipboard.writeText(page.public_url);
      setFlash(locale === "bn" ? "Public URL copy হয়েছে।" : "Public URL copied.");
    } catch {
      setFlash(locale === "bn" ? "URL copy করা যায়নি।" : "Failed to copy URL.");
    }
  };

  const publishPage = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token || !page) return;
    setBusy(true);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${page.id}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPage((prev) => prev ? { ...prev, ...data.data, public_url: prev.public_url } : prev);
        setFlash(locale === "bn" ? "পেজ publish হয়েছে।" : "Page published.");
      }
    } finally {
      setBusy(false);
    }
  };

  const unpublishPage = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token || !page) return;
    setBusy(true);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${page.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: page.title,
          slug: page.slug,
          status: "draft",
          template_id: page.template_id ?? null,
          products: (page.products ?? []).map((item, index) => ({
            product_id: item.product_id,
            title_override: item.title_override ?? null,
            subtitle: item.subtitle ?? null,
            badge_text: item.badge_text ?? null,
            price_override: item.price_override ?? null,
            default_qty: item.default_qty ?? 1,
            selected_by_default: item.selected_by_default ?? true,
            sort_order: item.sort_order ?? index + 1,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPage((prev) => prev ? { ...prev, ...data.data, status: "draft", published_at: null } : prev);
        setFlash(locale === "bn" ? "পেজ draft করা হয়েছে।" : "Page moved to draft.");
      }
    } finally {
      setBusy(false);
    }
  };

  const deletePage = async () => {
    if (!page) return;
    const confirmed = window.confirm(locale === "bn" ? "এই পেজটি মুছে ফেলতে চান?" : "Delete this page?");
    if (!confirmed) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/pages/${page.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.push("/dashboard/landing-pages");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <UserShell activeKey="landing-pages" pageTitle={{ bn: text.bn.title, en: text.en.title }}>
        <div className="catv-panel p-4 sm:p-5 text-sm text-[var(--muted)]">{t.loading}</div>
      </UserShell>
    );
  }

  if (!page) {
    return (
      <UserShell activeKey="landing-pages" pageTitle={{ bn: text.bn.title, en: text.en.title }}>
        <div className="catv-panel p-4 sm:p-5 text-sm text-red-400">{t.notFound}</div>
      </UserShell>
    );
  }

  return (
    <UserShell
      activeKey="landing-pages"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{
        bn: "Landing page এর বিস্তারিত তথ্য দেখুন।",
        en: "Review landing page details.",
      }}
    >
      <section className="mx-auto max-w-2xl catv-panel p-4 sm:p-5">
        {flash ? <div className="mb-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{flash}</div> : null}
        <button
          className="mb-4 inline-flex rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)]"
          onClick={() => router.back()}
        >
          {t.back}
        </button>
        <h2 className="mb-4 text-2xl font-bold text-[var(--foreground)]">{page.title}</h2>
        <div className="space-y-3 text-sm text-[var(--foreground)]">
          <div><span className="font-semibold">Status:</span> {page.status}</div>
          <div><span className="font-semibold">Template:</span> {getLandingTemplateName(page.template, locale)}</div>
          <div><span className="font-semibold">Slug:</span> {page.slug}</div>
          <div><span className="font-semibold">Public URL:</span> <span className="break-all text-[var(--accent)]">{page.public_url}</span></div>
          <div><span className="font-semibold">Created:</span> {page.created_at}</div>
          <div><span className="font-semibold">Updated:</span> {page.updated_at}</div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/landing-pages/${page.id}/edit`}
            className="inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            {t.edit}
          </Link>
          {page.public_url ? (
            <a href={page.public_url} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
              {locale === "bn" ? "Preview" : "Preview"}
            </a>
          ) : null}
          <button type="button" onClick={() => void copyUrl()} className="inline-flex rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
            {locale === "bn" ? "URL copy" : "Copy URL"}
          </button>
          {page.status !== "published" ? (
            <button type="button" disabled={busy} onClick={() => void publishPage()} className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "..." : locale === "bn" ? "Publish" : "Publish"}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void unpublishPage()} className="inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "..." : locale === "bn" ? "Unpublish" : "Unpublish"}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void deletePage()} className="inline-flex rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-60">
            {locale === "bn" ? "Delete" : "Delete"}
          </button>
        </div>
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <h3 className="text-base font-semibold text-[var(--foreground)]">{locale === "bn" ? "সংযুক্ত পণ্য" : "Attached products"}</h3>
          {page.products?.length ? (
            <div className="mt-3 space-y-3">
              {page.products.map((item) => (
                <div key={`${item.product_id}-${item.sort_order ?? 0}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
                  <div className="font-semibold text-[var(--foreground)]">{item.title_override || item.product?.name || `#${item.product_id}`}</div>
                  <div className="mt-1 text-[var(--muted)]">SKU: {item.product?.sku || "—"} · Qty {item.default_qty ?? 1}</div>
                  {item.badge_text ? <div className="mt-1 text-xs text-[var(--accent)]">{item.badge_text}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-[var(--muted)]">{locale === "bn" ? "কোনো পণ্য attach করা হয়নি।" : "No products attached yet."}</div>
          )}
        </div>
      </section>
    </UserShell>
  );
}
