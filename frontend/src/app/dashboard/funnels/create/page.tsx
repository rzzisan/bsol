"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { buildApiHeaders, FUNNEL_API_BASE, readApiResponse, type FunnelData } from "@/lib/funnel";

const text = {
  bn: {
    title: "নতুন Funnel তৈরি",
    subtitle: "নাম দিয়ে দ্রুত funnel scaffold তৈরি করুন",
    name: "Funnel নাম",
    slug: "Slug (optional)",
    create: "Funnel তৈরি করুন",
    creating: "তৈরি হচ্ছে...",
  },
  en: {
    title: "Create Funnel",
    subtitle: "Create a funnel scaffold quickly with a name",
    name: "Funnel name",
    slug: "Slug (optional)",
    create: "Create Funnel",
    creating: "Creating...",
  },
};

export default function CreateFunnelPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const token = getStoredToken();
  const router = useRouter();
  const t = useMemo(() => text[locale], [locale]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/funnels`, {
        method: "POST",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() || null }),
      });
      const result = await readApiResponse<FunnelData>(res);
      if (result.ok && result.data?.id) {
        router.push(`/dashboard/funnels/${result.data.id}/edit`);
      } else {
        alert(result.message || "Failed to create funnel");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserShell
      activeKey="funnel-create"
      defaultExpandedKey="landing"
      pageTitle={{ bn: t.title, en: t.title }}
      pageSubtitle={{ bn: t.subtitle, en: t.subtitle }}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="catv-panel mt-4 max-w-2xl space-y-4 p-4">
        <div>
          <label className="mb-1 block text-sm font-semibold">{t.name}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">{t.slug}</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <button disabled={saving} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? t.creating : t.create}
        </button>
      </form>
    </UserShell>
  );
}
