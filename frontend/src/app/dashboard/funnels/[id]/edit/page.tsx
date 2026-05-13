"use client";

import { use, useEffect, useMemo, useState } from "react";
import FunnelEditorShell from "@/components/funnel-editor-shell";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { buildApiHeaders, FUNNEL_API_BASE, readApiResponse, type FunnelData } from "@/lib/funnel";

const text = {
  bn: {
    title: "Funnel Edit",
    subtitle: "Canvas, inspector, এবং flow-aware editing shell",
    loading: "লোড হচ্ছে...",
  },
  en: {
    title: "Edit Funnel",
    subtitle: "Canvas, inspector, and flow-aware editing shell",
    loading: "Loading...",
  },
};

export default function EditFunnelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [locale] = useState<Locale>(getStoredLocale);
  const token = getStoredToken();
  const t = useMemo(() => text[locale], [locale]);

  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${FUNNEL_API_BASE}/funnels/${id}`, { headers: buildApiHeaders(token) });
        const result = await readApiResponse<FunnelData>(res);
        if (result.ok && result.data) {
          setFunnel(result.data);
        }
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
      pageSubtitle={{ bn: t.subtitle, en: t.subtitle }}
    >
      {loading ? (
        <div className="catv-panel mt-4 p-4 text-sm text-[var(--muted)]">{t.loading}</div>
      ) : !funnel ? (
        <div className="catv-panel mt-4 p-4 text-sm text-[var(--muted)]">Funnel not found.</div>
      ) : (
        <FunnelEditorShell
          funnel={funnel}
          token={token}
          locale={locale}
          onFunnelUpdated={setFunnel}
        />
      )}
    </UserShell>
  );
}
