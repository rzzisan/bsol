"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getStoredToken } from "@/lib/dashboard-client";
import { useLocale } from "@/lib/locale-context";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

// Same slugs as the seeded ai_knowledge_base_articles rows — one article per
// module, matching the real seller menu (user-shell.tsx). Longest-prefix
// match wins, so a specific sub-path (e.g. whatsapp inbox vs. whatsapp
// automation, which live under different articles) beats a shorter one.
const ROUTE_TO_SLUG_RULES: Array<[string, string]> = [
  ["/dashboard/orders", "orders"],
  ["/dashboard/products", "products"],
  ["/dashboard/customers", "customers"],
  ["/dashboard/courier", "courier"],
  ["/dashboard/settings/courier", "courier"],
  ["/dashboard/sms", "sms"],
  ["/dashboard/whatsapp/automation", "sms"],
  ["/dashboard/whatsapp/inbox", "whatsapp"],
  ["/dashboard/settings/whatsapp", "whatsapp"],
  ["/dashboard/leads", "facebook"],
  ["/dashboard/settings/facebook", "facebook"],
  ["/dashboard/marketing/facebook-capi", "facebook"],
  ["/dashboard/landing-pages", "landing_pages"],
  ["/dashboard/abandoned-checkouts", "landing_pages"],
  ["/dashboard/analytics", "analytics"],
  ["/dashboard/accounting", "accounting"],
  ["/dashboard/settings/subscription", "subscription_billing"],
  ["/dashboard/order-credits", "subscription_billing"],
  ["/dashboard/storefront-addon", "subscription_billing"],
  ["/dashboard/settings/shop", "settings_store"],
  ["/dashboard/settings/storefront", "settings_store"],
  ["/dashboard/settings/sticker-templates", "settings_store"],
  ["/dashboard/settings/payments", "settings_store"],
  ["/dashboard/settings/wordpress", "settings_store"],
  ["/dashboard/settings/staff", "settings_store"],
  ["/dashboard/tickets", "support"],
];

const ROUTE_TO_SLUG: Array<[string, string]> = [...ROUTE_TO_SLUG_RULES].sort((a, b) => b[0].length - a[0].length);

function slugForPath(pathname: string): string | null {
  const match = ROUTE_TO_SLUG.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : null;
}

const text = {
  bn: {
    button: "কীভাবে ব্যবহার করব?",
    title: "এই পেজ কীভাবে ব্যবহার করবেন",
    loading: "লোড হচ্ছে…",
    error: "লোড করা যায়নি, আবার চেষ্টা করুন।",
    close: "বন্ধ করুন",
  },
  en: {
    button: "How do I use this?",
    title: "How to use this page",
    loading: "Loading…",
    error: "Couldn't load this — please try again.",
    close: "Close",
  },
};

export default function PageHelpButton() {
  const locale = useLocale();
  const t = text[locale];
  const pathname = usePathname();
  const slug = useMemo(() => slugForPath(pathname ?? ""), [pathname]);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [article, setArticle] = useState<{ title: string; content: string } | null>(null);

  // Reset any previously loaded article when the seller navigates to a
  // different page, so a stale article never flashes before the new fetch.
  useEffect(() => {
    setArticle(null);
    setOpen(false);
  }, [slug]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    try {
      const token = getStoredToken();
      const res = await fetch(`${API_BASE_URL}/help/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setArticle(data.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  if (!slug) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6">
      {open && (
        <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">{article?.title ?? t.title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.close}
              className="rounded-full p-1 text-[var(--muted)] transition hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            >
              ✕
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-4 py-3 text-sm">
            {loading && <p className="text-center text-xs text-[var(--muted)]">{t.loading}</p>}
            {!loading && error && <p className="text-center text-xs text-red-500">{t.error}</p>}
            {!loading && !error && article && (
              <p className="whitespace-pre-wrap break-words text-[var(--foreground)]">{article.content}</p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!article) void load();
        }}
        className="flex items-center gap-2 rounded-full bg-[var(--surface)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] shadow-xl transition hover:bg-[var(--surface-soft)]"
      >
        <span aria-hidden>❓</span>
        <span className="hidden sm:inline">{t.button}</span>
      </button>
    </div>
  );
}
