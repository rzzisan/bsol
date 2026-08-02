"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "ফেসবুক লিডস",
    empty: "কোনো লিড পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    notConnectedTitle: "কোনো Facebook Page কানেক্ট করা নেই",
    notConnectedDesc: "Page কানেক্ট করলে কমেন্ট এবং ইনবক্স মেসেজ থেকে লিড এখানে দেখা যাবে।",
    connectLink: "Facebook Page কানেক্ট করুন",
    filterAll: "সব",
    filterComment: "কমেন্ট",
    filterMessage: "মেসেজ",
    filterNew: "নতুন",
    filterConverted: "কাস্টমার হয়েছে",
    filterIgnored: "ইগনোর করা",
    ignoreBtn: "ইগনোর",
    convertBtn: "কাস্টমার বানান",
    convertedLabel: "কাস্টমার:",
    phonePlaceholder: "মোবাইল নাম্বার (01XXXXXXXXX)",
    namePlaceholder: "নাম (ঐচ্ছিক)",
    saveBtn: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    cancel: "বাতিল",
    channelComment: "কমেন্ট",
    channelMessage: "মেসেজ",
    statusNew: "নতুন",
    statusConverted: "কনভার্টেড",
    statusIgnored: "ইগনোর্ড",
    invalidPhone: "সঠিক মোবাইল নাম্বার দিন।",
  },
  en: {
    pageTitle: "Facebook Leads",
    empty: "No leads yet.",
    loading: "Loading...",
    notConnectedTitle: "No Facebook Page connected",
    notConnectedDesc: "Connect a Page to start capturing leads from comments and inbox messages here.",
    connectLink: "Connect Facebook Page",
    filterAll: "All",
    filterComment: "Comments",
    filterMessage: "Messages",
    filterNew: "New",
    filterConverted: "Converted",
    filterIgnored: "Ignored",
    ignoreBtn: "Ignore",
    convertBtn: "Convert to Customer",
    convertedLabel: "Customer:",
    phonePlaceholder: "Phone (01XXXXXXXXX)",
    namePlaceholder: "Name (optional)",
    saveBtn: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    channelComment: "Comment",
    channelMessage: "Message",
    statusNew: "New",
    statusConverted: "Converted",
    statusIgnored: "Ignored",
    invalidPhone: "Enter a valid phone number.",
  },
};

type Lead = {
  id: number;
  channel: "comment" | "message";
  sender_name: string | null;
  sender_fb_id: string | null;
  message: string | null;
  detected_phone: string | null;
  status: "new" | "converted" | "ignored";
  is_read: boolean;
  received_at: string;
  customer: { id: number; name: string | null; phone: string } | null;
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const tr = t[locale];

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<"" | "comment" | "message">("");
  const [statusFilter, setStatusFilter] = useState<"" | "new" | "converted" | "ignored">("");
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageConnected, setPageConnected] = useState<boolean | null>(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${getStoredToken()}` }), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/facebook/connect/status`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success) setPageConnected(json.connected);
      } catch {
        setPageConnected(false);
      }
    })();
  }, [authHeaders]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (channelFilter) params.set("channel", channelFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`${API}/facebook/leads?${params.toString()}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setLeads(json.data);
      }
    } catch {
      // keep last-known list on transient network failure
    } finally {
      setLoading(false);
    }
  }, [authHeaders, channelFilter, statusFilter]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  async function markRead(id: number) {
    try {
      await fetch(`${API}/facebook/leads/${id}/read`, { method: "PUT", headers: authHeaders() });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, is_read: true } : l)));
    } catch {
      // non-critical — read state will sync on next list refresh
    }
  }

  async function ignoreLead(id: number) {
    try {
      const res = await fetch(`${API}/facebook/leads/${id}/ignore`, { method: "PUT", headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setLeads((prev) => prev.map((l) => (l.id === id ? json.data : l)));
      }
    } catch {
      // no-op — seller can retry the action
    }
  }

  function startConvert(lead: Lead) {
    setConvertingId(lead.id);
    setPhoneInput(lead.detected_phone ?? "");
    setNameInput(lead.sender_name ?? "");
    setFormError(null);
  }

  async function submitConvert(id: number) {
    if (!/^01[3-9][0-9]{8}$/.test(phoneInput)) {
      setFormError(tr.invalidPhone);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`${API}/facebook/leads/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ phone: phoneInput, name: nameInput || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setLeads((prev) => prev.map((l) => (l.id === id ? json.data.lead : l)));
        setConvertingId(null);
      } else {
        setFormError(json.message ?? tr.invalidPhone);
      }
    } catch {
      setFormError(tr.invalidPhone);
    } finally {
      setSaving(false);
    }
  }

  const filterBtn = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium ${
      active
        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
    }`;

  return (
    <UserShell activeKey="facebook-leads" pageTitle={{ bn: tr.pageTitle, en: tr.pageTitle }}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button className={filterBtn(channelFilter === "")} onClick={() => setChannelFilter("")}>{tr.filterAll}</button>
          <button className={filterBtn(channelFilter === "comment")} onClick={() => setChannelFilter("comment")}>{tr.filterComment}</button>
          <button className={filterBtn(channelFilter === "message")} onClick={() => setChannelFilter("message")}>{tr.filterMessage}</button>
          <span className="mx-1 self-center text-[var(--border)]">|</span>
          <button className={filterBtn(statusFilter === "new")} onClick={() => setStatusFilter(statusFilter === "new" ? "" : "new")}>{tr.filterNew}</button>
          <button className={filterBtn(statusFilter === "converted")} onClick={() => setStatusFilter(statusFilter === "converted" ? "" : "converted")}>{tr.filterConverted}</button>
          <button className={filterBtn(statusFilter === "ignored")} onClick={() => setStatusFilter(statusFilter === "ignored" ? "" : "ignored")}>{tr.filterIgnored}</button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">{tr.loading}</p>
        ) : leads.length === 0 && pageConnected === false ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">{tr.notConnectedTitle}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{tr.notConnectedDesc}</p>
            <Link
              href="/dashboard/settings/facebook"
              className="mt-3 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              {tr.connectLink}
            </Link>
          </div>
        ) : leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">{tr.empty}</p>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => !lead.is_read && markRead(lead.id)}
                className={`rounded-xl border p-4 ${
                  lead.is_read ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--accent)] bg-[var(--surface)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                      {lead.channel === "comment" ? tr.channelComment : tr.channelMessage}
                    </span>
                    <span>{lead.sender_name ?? lead.sender_fb_id}</span>
                    <span>· {new Date(lead.received_at).toLocaleString()}</span>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {lead.status === "new" ? tr.statusNew : lead.status === "converted" ? tr.statusConverted : tr.statusIgnored}
                  </span>
                </div>

                <p className="mt-2 text-sm text-[var(--foreground)]">{lead.message}</p>

                {lead.customer ? (
                  <p className="mt-2 text-xs text-green-600">
                    {tr.convertedLabel} {lead.customer.name ?? lead.customer.phone} ({lead.customer.phone})
                  </p>
                ) : lead.status === "new" ? (
                  convertingId === lead.id ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] p-3">
                      <input
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder={tr.phonePlaceholder}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                      />
                      <input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder={tr.namePlaceholder}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                      />
                      {formError && <p className="text-xs text-red-600">{formError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => void submitConvert(lead.id)}
                          disabled={saving}
                          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {saving ? tr.saving : tr.saveBtn}
                        </button>
                        <button
                          onClick={() => setConvertingId(null)}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
                        >
                          {tr.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => startConvert(lead)}
                        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                      >
                        {tr.convertBtn}
                      </button>
                      <button
                        onClick={() => void ignoreLead(lead.id)}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
                      >
                        {tr.ignoreBtn}
                      </button>
                    </div>
                  )
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </UserShell>
  );
}
