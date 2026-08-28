"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CatvShell from "@/components/catv-shell";
import { buildAdminMenu } from "@/lib/admin-menu";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  LOCALE_STORAGE_KEY,
  normalizeRole,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

type Article = {
  id: number;
  slug: string;
  title: string;
  content: string;
  is_active: boolean;
  sort_order: number;
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const EMPTY_FORM = { id: null as number | null, slug: "", title: "", content: "", is_active: true };

const labels = {
  bn: {
    title: "AI নলেজ বেস",
    subtitle: "AI এজেন্ট এই কন্টেন্ট থেকেই 'কিভাবে করব' প্রশ্নের উত্তর খুঁজে বের করে — প্রতিটা মডিউল/টপিক আলাদা আর্টিকেল হিসেবে রাখুন।",
    loginRequired: "অ্যাডমিন হিসেবে লগইন করুন",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজে প্রবেশ করতে পারবেন",
    goHome: "হোমে যান",
    newArticle: "+ নতুন আর্টিকেল",
    slug: "স্লাগ (unique, শুধু ইংরেজি/হাইফেন)",
    titleField: "শিরোনাম",
    content: "কন্টেন্ট",
    active: "সক্রিয় (AI এটা সার্চে পাবে)",
    save: "সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    cancel: "বাতিল",
    edit: "এডিট",
    delete: "মুছুন",
    confirmDelete: "এই আর্টিকেলটা মুছে ফেলবেন?",
    colTitle: "শিরোনাম",
    colSlug: "স্লাগ",
    colStatus: "স্ট্যাটাস",
    statusActive: "সক্রিয়",
    statusInactive: "নিষ্ক্রিয়",
    loading: "লোড হচ্ছে…",
    empty: "এখনও কোনো আর্টিকেল নেই।",
  },
  en: {
    title: "AI Knowledge Base",
    subtitle: "The AI agent searches this content to answer 'how do I' questions — keep one article per module/topic.",
    loginRequired: "Please login as admin",
    accessDenied: "Only admins can access this page",
    goHome: "Go Home",
    newArticle: "+ New Article",
    slug: "Slug (unique, letters/hyphens only)",
    titleField: "Title",
    content: "Content",
    active: "Active (AI can find this in search)",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    confirmDelete: "Delete this article?",
    colTitle: "Title",
    colSlug: "Slug",
    colStatus: "Status",
    statusActive: "Active",
    statusInactive: "Inactive",
    loading: "Loading…",
    empty: "No articles yet.",
  },
};

export default function AiKnowledgeBasePage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const t = useMemo(() => labels[locale], [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const token = getStoredToken();
  const authHeaders = useCallback((): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const loadArticles = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API}/admin/ai-knowledge-base`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setArticles(data.data ?? []);
    } finally {
      setLoadingList(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      setState("unauthenticated");
      return;
    }
    if (normalizeRole(storedUser) !== "admin") {
      setState("forbidden");
      return;
    }
    setUser(storedUser);
    setState("ready");
    void loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const menus = useMemo(() => buildAdminMenu(locale), [t]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (a: Article) => {
    setForm({ id: a.id, slug: a.slug, title: a.title, content: a.content, is_active: a.is_active });
    setShowForm(true);
  };

  const submit = async () => {
    if (!token || !form.slug.trim() || !form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const url = form.id ? `${API}/admin/ai-knowledge-base/${form.id}` : `${API}/admin/ai-knowledge-base`;
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ slug: form.slug.trim(), title: form.title.trim(), content: form.content.trim(), is_active: form.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message ?? "Save failed");
        return;
      }
      setShowForm(false);
      await loadArticles();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Article) => {
    if (!confirm(t.confirmDelete)) return;
    await fetch(`${API}/admin/ai-knowledge-base/${a.id}`, { method: "DELETE", headers: authHeaders() });
    await loadArticles();
  };

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{state === "forbidden" ? t.accessDenied : t.loginRequired}</p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">{t.goHome}</a>
        </section>
      </main>
    );
  }

  return (
    <CatvShell
      title={t.title}
      subtitle={t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={locale === "bn" ? "ভাষা" : "Language"}
      themeLabel={locale === "bn" ? "থিম" : "Theme"}
      sidebarTitle={locale === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}
      searchPlaceholder={locale === "bn" ? "সার্চ করুন" : "Search"}
      userName={user?.name}
      userMeta={user?.email}
      menu={menus}
      activeKey="settings-ai-knowledge-base"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="space-y-4">
        <section className="catv-panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{t.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={openNew}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              {t.newArticle}
            </button>
          </div>

          {showForm && (
            <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">{t.slug}</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">{t.titleField}</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">{t.content}</span>
                <textarea
                  rows={8}
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <span className="text-sm">{t.active}</span>
              </label>
              {message ? <p className="text-xs text-red-500">{message}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={saving}
                  className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saving ? t.saving : t.save}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="catv-panel overflow-x-auto p-5">
          {loadingList && <p className="text-center text-xs text-[var(--muted)]">{t.loading}</p>}
          {!loadingList && articles.length === 0 && <p className="text-center text-xs text-[var(--muted)]">{t.empty}</p>}
          {!loadingList && articles.length > 0 && (
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[var(--accent)] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">{t.colTitle}</th>
                  <th className="px-3 py-2 text-left">{t.colSlug}</th>
                  <th className="px-3 py-2 text-left">{t.colStatus}</th>
                  <th className="px-3 py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{a.title}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--muted)]">{a.slug}</td>
                    <td className="px-3 py-2">
                      <span className={a.is_active ? "text-emerald-500" : "text-[var(--muted)]"}>
                        {a.is_active ? t.statusActive : t.statusInactive}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => openEdit(a)} className="mr-2 text-xs text-[var(--accent)] hover:underline">
                        {t.edit}
                      </button>
                      <button type="button" onClick={() => void remove(a)} className="text-xs text-red-500 hover:underline">
                        {t.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </CatvShell>
  );
}
