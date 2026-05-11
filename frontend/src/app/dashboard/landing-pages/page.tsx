"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { buildApiHeaders, getTemplateLabel, LANDING_API_BASE, readApiResponse, type LandingPageData } from "@/lib/landing";

const t = {
  bn: {
    pageTitle: "ল্যান্ডিং পেইজসমূহ",
    create: "নতুন ল্যান্ডিং",
    loading: "লোড হচ্ছে...",
    empty: "কোনো ল্যান্ডিং পেইজ পাওয়া যায়নি।",
    search: "টাইটেল বা স্লাগ দিয়ে খুঁজুন",
    all: "সব",
    draft: "ড্রাফট",
    published: "পাবলিশড",
    archived: "আর্কাইভড",
    title: "শিরোনাম",
    template: "টেমপ্লেট",
    status: "স্ট্যাটাস",
    publicUrl: "পাবলিক URL",
    actions: "অ্যাকশন",
    edit: "এডিট",
    analytics: "অ্যানালিটিক্স",
    view: "ভিজিট",
    publish: "পাবলিশ",
    archive: "আর্কাইভ",
    statsTotal: "মোট",
    statsPublished: "পাবলিশড",
    statsDraft: "ড্রাফট",
  },
  en: {
    pageTitle: "Landing Pages",
    create: "Create Landing",
    loading: "Loading...",
    empty: "No landing pages found.",
    search: "Search by title or slug",
    all: "All",
    draft: "Draft",
    published: "Published",
    archived: "Archived",
    title: "Title",
    template: "Template",
    status: "Status",
    publicUrl: "Public URL",
    actions: "Actions",
    edit: "Edit",
    analytics: "Analytics",
    view: "Visit",
    publish: "Publish",
    archive: "Archive",
    statsTotal: "Total",
    statsPublished: "Published",
    statsDraft: "Draft",
  },
};

export default function LandingPagesPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LandingPageData[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      const res = await fetch(`${LANDING_API_BASE}/landing/pages?${params.toString()}`, {
        headers: buildApiHeaders(token),
      });
      const result = await readApiResponse<LandingPageData[]>(res);
      if (result.ok) {
        setItems((result.data ?? []) as LandingPageData[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const publish = async (id: number) => {
    if (!token) return;
    await fetch(`${LANDING_API_BASE}/landing/pages/${id}/publish`, {
      method: "PUT",
      headers: buildApiHeaders(token),
    });
    void loadData();
  };

  const archive = async (id: number) => {
    if (!token) return;
    await fetch(`${LANDING_API_BASE}/landing/pages/${id}/archive`, {
      method: "PUT",
      headers: buildApiHeaders(token),
    });
    void loadData();
  };

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.status === "published").length,
    draft: items.filter((item) => item.status === "draft").length,
  }), [items]);

  return (
    <UserShell activeKey="landing-pages" defaultExpandedKey="landing" pageTitle={{ bn: "ল্যান্ডিং পেইজসমূহ", en: "Landing Pages" }}>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: txt.statsTotal, value: stats.total, color: "bg-[#0f7c7b]" },
          { label: txt.statsPublished, value: stats.published, color: "bg-[#2f7ec1]" },
          { label: txt.statsDraft, value: stats.draft, color: "bg-[#8b5cf6]" },
        ].map((card) => (
          <article key={card.label} className={`${card.color} rounded-2xl p-4 text-white`}>
            <p className="text-xs text-white/80">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </article>
        ))}
      </div>

      <div className="catv-panel mt-4 flex flex-wrap items-center gap-3 p-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={txt.search} className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="all">{txt.all}</option>
          <option value="draft">{txt.draft}</option>
          <option value="published">{txt.published}</option>
          <option value="archived">{txt.archived}</option>
        </select>
        <button onClick={() => void loadData()} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Search</button>
        <Link href="/dashboard/landing-pages/create" className="ml-auto rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">+ {txt.create}</Link>
      </div>

      <div className="catv-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">{txt.title}</th>
              <th className="px-4 py-3">{txt.template}</th>
              <th className="px-4 py-3">{txt.status}</th>
              <th className="px-4 py-3">{txt.publicUrl}</th>
              <th className="px-4 py-3 text-right">{txt.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">{txt.loading}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">{txt.empty}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-xs text-[var(--muted)]">/{item.slug}</p>
                </td>
                <td className="px-4 py-3">{item.template ? getTemplateLabel(item.template, locale) : "-"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === "published" ? "bg-emerald-500/15 text-emerald-500" : item.status === "draft" ? "bg-sky-500/15 text-sky-500" : "bg-slate-500/15 text-slate-500"}`}>
                    {txt[item.status as "draft" | "published" | "archived"]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">{item.public_url ?? "-"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link href={`/dashboard/landing-pages/${item.id}/edit`} className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold">{txt.edit}</Link>
                    <Link href={`/dashboard/landing-pages/${item.id}/analytics`} className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-600">{txt.analytics}</Link>
                    {item.status !== "published" ? <button onClick={() => void publish(item.id)} className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-600">{txt.publish}</button> : null}
                    {item.status !== "archived" ? <button onClick={() => void archive(item.id)} className="rounded-lg border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-600">{txt.archive}</button> : null}
                    {item.status === "published" ? <Link href={`/store/${item.slug}`} target="_blank" className="rounded-lg border border-sky-300 px-3 py-1 text-xs font-semibold text-sky-600">{txt.view}</Link> : null}
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
