"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { buildApiHeaders, FUNNEL_API_BASE, readApiResponse, type FunnelData } from "@/lib/funnel";

const text = {
  bn: {
    pageTitle: "ফানেলসমূহ",
    search: "নাম বা slug দিয়ে সার্চ করুন",
    all: "সব",
    draft: "ড্রাফট",
    published: "পাবলিশড",
    archived: "আর্কাইভড",
    loading: "লোড হচ্ছে...",
    empty: "কোনো funnel পাওয়া যায়নি।",
    create: "নতুন Funnel",
    title: "নাম",
    status: "স্ট্যাটাস",
    slug: "Slug",
    actions: "অ্যাকশন",
    edit: "এডিট",
    preview: "প্রিভিউ",
    analytics: "অ্যানালিটিক্স",
  },
  en: {
    pageTitle: "Funnels",
    search: "Search by name or slug",
    all: "All",
    draft: "Draft",
    published: "Published",
    archived: "Archived",
    loading: "Loading...",
    empty: "No funnels found.",
    create: "Create Funnel",
    title: "Name",
    status: "Status",
    slug: "Slug",
    actions: "Actions",
    edit: "Edit",
    preview: "Preview",
    analytics: "Analytics",
  },
};

export default function FunnelsPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const token = getStoredToken();
  const t = useMemo(() => text[locale], [locale]);

  const [items, setItems] = useState<FunnelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      const res = await fetch(`${FUNNEL_API_BASE}/funnels?${params.toString()}`, {
        headers: buildApiHeaders(token),
      });
      const result = await readApiResponse<FunnelData[]>(res);
      if (result.ok) {
        setItems(Array.isArray(result.data) ? result.data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <UserShell
      activeKey="funnels"
      defaultExpandedKey="landing"
      pageTitle={{ bn: "ফানেলসমূহ", en: "Funnels" }}
      pageSubtitle={{ bn: "আপনার sales funnel তৈরি ও ম্যানেজ করুন", en: "Create and manage your sales funnels" }}
    >
      <div className="catv-panel mt-4 flex flex-wrap items-center gap-3 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.search}
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="all">{t.all}</option>
          <option value="draft">{t.draft}</option>
          <option value="published">{t.published}</option>
          <option value="archived">{t.archived}</option>
        </select>
        <button onClick={() => void load()} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Search</button>
        <Link href="/dashboard/funnels/create" className="ml-auto rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">+ {t.create}</Link>
      </div>

      <div className="catv-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">{t.title}</th>
              <th className="px-4 py-3">{t.slug}</th>
              <th className="px-4 py-3">{t.status}</th>
              <th className="px-4 py-3 text-right">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">{t.loading}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">{t.empty}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3 font-semibold">{item.name}</td>
                <td className="px-4 py-3">/{item.slug}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === "published" ? "bg-emerald-500/15 text-emerald-500" : item.status === "draft" ? "bg-sky-500/15 text-sky-500" : "bg-slate-500/15 text-slate-500"}`}>
                    {t[item.status as "draft" | "published" | "archived"]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link href={`/dashboard/funnels/${item.id}/edit`} className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold">{t.edit}</Link>
                    <Link href={`/dashboard/funnels/${item.id}/preview`} className="rounded-lg border border-sky-300 px-3 py-1 text-xs font-semibold text-sky-600">{t.preview}</Link>
                    <Link href={`/dashboard/funnels/${item.id}/analytics`} className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-600">{t.analytics}</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UserShell>
  );
}
