"use client";

import { use, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { buildApiHeaders, FUNNEL_API_BASE, readApiResponse, type FunnelData, type FunnelFlow } from "@/lib/funnel";

const text = {
  bn: { title: "Funnel Preview", loading: "লোড হচ্ছে...", noFlow: "কোনো active flow পাওয়া যায়নি।" },
  en: { title: "Funnel Preview", loading: "Loading...", noFlow: "No active flow found." },
};

type PreviewPayload = {
  funnel: FunnelData;
  flow: FunnelFlow | null;
};

export default function FunnelPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [locale] = useState<Locale>(getStoredLocale);
  const token = getStoredToken();
  const t = useMemo(() => text[locale], [locale]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${FUNNEL_API_BASE}/funnels/${id}/preview`, { headers: buildApiHeaders(token) });
        const result = await readApiResponse<PreviewPayload>(res);
        if (result.ok && result.data) setData(result.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  return (
    <UserShell
      activeKey="funnels"
      defaultExpandedKey="landing"
      pageTitle={{ bn: t.title, en: t.title }}
      pageSubtitle={{ bn: "Draft preview (Module 3)", en: "Draft preview (Module 3)" }}
    >
      {loading ? (
        <div className="catv-panel mt-4 p-4 text-sm text-[var(--muted)]">{t.loading}</div>
      ) : !data?.flow ? (
        <div className="catv-panel mt-4 p-4 text-sm text-[var(--muted)]">{t.noFlow}</div>
      ) : (
        <div className="catv-panel mt-4 p-4">
          <h3 className="text-base font-semibold">{data.funnel.name}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">/{data.funnel.slug}</p>
          <div className="mt-4 grid gap-3">
            {(data.flow.steps ?? []).map((step) => (
              <article key={step.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <p className="text-sm font-semibold">#{step.step_order} • {step.step_type}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Page: {step.landing_page?.title ?? "-"} {step.slug ? `• /${step.slug}` : ""}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </UserShell>
  );
}
