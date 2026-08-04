"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  MessagesSquare,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "ফেসবুক লিডস",
    empty: "কোনো লিড পাওয়া যায়নি।",
    noResults: "এই সার্চ/ফিল্টারে কোনো লিড পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    notConnectedTitle: "কোনো Facebook Page কানেক্ট করা নেই",
    notConnectedDesc: "Page কানেক্ট করলে কমেন্ট এবং ইনবক্স মেসেজ থেকে লিড এখানে দেখা যাবে।",
    connectLink: "Facebook Page কানেক্ট করুন",
    searchPlaceholder: "নাম, মেসেজ বা ফোন নম্বর দিয়ে খুঁজুন...",
    filterAll: "সব",
    filterComment: "কমেন্ট",
    filterMessage: "মেসেজ",
    filterNew: "নতুন",
    filterConverted: "কাস্টমার হয়েছে",
    filterIgnored: "ইগনোর করা",
    unreadOnly: "শুধু আনরিড",
    sortNewest: "নতুন আগে",
    sortOldest: "পুরাতন আগে",
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
    replyBtn: "রিপ্লাই",
    replyPlaceholder: "আপনার রিপ্লাই লিখুন...",
    sendBtn: "পাঠান",
    sending: "পাঠানো হচ্ছে...",
    repliedLabel: "আপনি",
    replyGenericError: "রিপ্লাই পাঠানো যায়নি।",
    totalLeads: (n: number) => `মোট ${n}টি লিড`,
    pageInfo: (cur: number, last: number) => `পৃষ্ঠা ${cur} / ${last}`,
    justNow: "এইমাত্র",
    minutesAgo: (n: number) => `${n} মিনিট আগে`,
    hoursAgo: (n: number) => `${n} ঘণ্টা আগে`,
    daysAgo: (n: number) => `${n} দিন আগে`,
  },
  en: {
    pageTitle: "Facebook Leads",
    empty: "No leads yet.",
    noResults: "No leads match this search/filter.",
    loading: "Loading...",
    notConnectedTitle: "No Facebook Page connected",
    notConnectedDesc: "Connect a Page to start capturing leads from comments and inbox messages here.",
    connectLink: "Connect Facebook Page",
    searchPlaceholder: "Search by name, message, or phone...",
    filterAll: "All",
    filterComment: "Comments",
    filterMessage: "Messages",
    filterNew: "New",
    filterConverted: "Converted",
    filterIgnored: "Ignored",
    unreadOnly: "Unread only",
    sortNewest: "Newest first",
    sortOldest: "Oldest first",
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
    replyBtn: "Reply",
    replyPlaceholder: "Write your reply...",
    sendBtn: "Send",
    sending: "Sending...",
    repliedLabel: "You",
    replyGenericError: "Could not send the reply.",
    totalLeads: (n: number) => `${n} lead${n === 1 ? "" : "s"} total`,
    pageInfo: (cur: number, last: number) => `Page ${cur} of ${last}`,
    justNow: "just now",
    minutesAgo: (n: number) => `${n}m ago`,
    hoursAgo: (n: number) => `${n}h ago`,
    daysAgo: (n: number) => `${n}d ago`,
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
  replied_at: string | null;
  reply_message: string | null;
  customer: { id: number; name: string | null; phone: string } | null;
};

type Meta = { total: number; current_page: number; last_page: number };

function relativeTime(iso: string, tr: (typeof t)["bn"]): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return tr.justNow;
  if (minutes < 60) return tr.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tr.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return tr.daysAgo(days);
  return new Date(iso).toLocaleDateString();
}

function initialOf(name: string | null, fallback: string | null): string {
  const source = (name ?? fallback ?? "?").trim();
  return source ? source[0].toUpperCase() : "?";
}

const statusBadgeClass: Record<Lead["status"], string> = {
  new: "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]",
  converted: "border-green-500/30 bg-green-500/10 text-green-600",
  ignored: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]",
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const tr = t[locale];

  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<"" | "comment" | "message">("");
  const [statusFilter, setStatusFilter] = useState<"" | "new" | "converted" | "ignored">("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageConnected, setPageConnected] = useState<boolean | null>(null);
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${getStoredToken()}` }), []);

  // Debounce the free-text search so we don't fire a request per keystroke.
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

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
      if (unreadOnly) params.set("unread_only", "1");
      if (search) params.set("q", search);
      params.set("sort", sort);
      params.set("page", String(page));
      const res = await fetch(`${API}/facebook/leads?${params.toString()}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setLeads(json.data);
        if (json.meta) setMeta(json.meta);
      }
    } catch {
      // keep last-known list on transient network failure
    } finally {
      setLoading(false);
    }
  }, [authHeaders, channelFilter, statusFilter, unreadOnly, search, sort, page]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  // Any filter/sort/search change should reset back to page 1.
  function resetToFirstPage() {
    setPage(1);
  }

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

  function startReply(lead: Lead) {
    setReplyingId(lead.id);
    setReplyText("");
    setReplyError(null);
  }

  async function submitReply(id: number) {
    if (!replyText.trim()) return;
    setReplySaving(true);
    setReplyError(null);
    try {
      const res = await fetch(`${API}/facebook/leads/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: replyText }),
      });
      const json = await res.json();
      if (json.success) {
        setLeads((prev) => prev.map((l) => (l.id === id ? json.data : l)));
        setReplyingId(null);
      } else {
        setReplyError(json.message ?? tr.replyGenericError);
      }
    } catch {
      setReplyError(tr.replyGenericError);
    } finally {
      setReplySaving(false);
    }
  }

  const filterChip = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
      active
        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
    }`;

  const unreadCount = useMemo(() => leads.filter((l) => !l.is_read).length, [leads]);

  return (
    <UserShell activeKey="facebook-leads" pageTitle={{ bn: tr.pageTitle, en: tr.pageTitle }}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={tr.searchPlaceholder}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSort((s) => (s === "newest" ? "oldest" : "newest"));
                resetToFirstPage();
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
            >
              <ArrowUpDown size={14} />
              {sort === "newest" ? tr.sortNewest : tr.sortOldest}
            </button>
            <button
              type="button"
              onClick={() => {
                setUnreadOnly((v) => !v);
                resetToFirstPage();
              }}
              className={filterChip(unreadOnly)}
            >
              {tr.unreadOnly}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className={filterChip(channelFilter === "")} onClick={() => { setChannelFilter(""); resetToFirstPage(); }}>{tr.filterAll}</button>
            <button className={filterChip(channelFilter === "comment")} onClick={() => { setChannelFilter("comment"); resetToFirstPage(); }}>{tr.filterComment}</button>
            <button className={filterChip(channelFilter === "message")} onClick={() => { setChannelFilter("message"); resetToFirstPage(); }}>{tr.filterMessage}</button>
            <span className="mx-1 self-center text-[var(--border)]">|</span>
            <button className={filterChip(statusFilter === "new")} onClick={() => { setStatusFilter(statusFilter === "new" ? "" : "new"); resetToFirstPage(); }}>{tr.filterNew}</button>
            <button className={filterChip(statusFilter === "converted")} onClick={() => { setStatusFilter(statusFilter === "converted" ? "" : "converted"); resetToFirstPage(); }}>{tr.filterConverted}</button>
            <button className={filterChip(statusFilter === "ignored")} onClick={() => { setStatusFilter(statusFilter === "ignored" ? "" : "ignored"); resetToFirstPage(); }}>{tr.filterIgnored}</button>
            <span className="ml-auto text-xs text-[var(--muted)]">
              {tr.totalLeads(meta.total)}
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </span>
          </div>
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
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            {search || channelFilter || statusFilter || unreadOnly ? tr.noResults : tr.empty}
          </p>
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
                <div className="flex items-start gap-3">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-sm font-semibold text-[var(--accent)]">
                    {initialOf(lead.sender_name, lead.sender_fb_id)}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--surface)] bg-[var(--surface-soft)] text-[var(--muted)]"
                      title={lead.channel === "comment" ? tr.channelComment : tr.channelMessage}
                    >
                      {lead.channel === "comment" ? <MessagesSquare size={10} /> : <MessageCircle size={10} />}
                    </span>
                    {!lead.is_read && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm">
                        {lead.channel === "comment" && lead.sender_fb_id ? (
                          <a
                            href={`https://www.facebook.com/${lead.sender_fb_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="truncate font-medium text-[var(--foreground)] hover:text-[var(--accent)] hover:underline"
                          >
                            {lead.sender_name ?? lead.sender_fb_id}
                          </a>
                        ) : (
                          <span className="truncate font-medium text-[var(--foreground)]">
                            {lead.sender_name ?? lead.sender_fb_id}
                          </span>
                        )}
                        <span className="shrink-0 text-xs text-[var(--muted)]" title={new Date(lead.received_at).toLocaleString()}>
                          · {relativeTime(lead.received_at, tr)}
                        </span>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass[lead.status]}`}>
                        {lead.status === "new" ? tr.statusNew : lead.status === "converted" ? tr.statusConverted : tr.statusIgnored}
                      </span>
                    </div>

                    {/* Conversation thread: incoming message + our reply (if any), chat-bubble style */}
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                        {lead.message}
                      </div>
                      {lead.reply_message && (
                        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--accent)]/12 px-3 py-2 text-sm text-[var(--foreground)]">
                          <span className="mr-1 text-xs font-semibold text-[var(--accent)]">{tr.repliedLabel}:</span>
                          {lead.reply_message}
                        </div>
                      )}
                    </div>

                    {!lead.reply_message && (
                      replyingId === lead.id ? (
                        <div className="mt-2.5 flex items-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={tr.replyPlaceholder}
                            rows={1}
                            className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                          />
                          <button
                            onClick={() => void submitReply(lead.id)}
                            disabled={replySaving}
                            title={tr.sendBtn}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-60"
                          >
                            <Send size={15} />
                          </button>
                          <button
                            onClick={() => setReplyingId(null)}
                            title={tr.cancel}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)]"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => startReply(lead)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10"
                          >
                            <Send size={12} />
                            {tr.replyBtn}
                          </button>
                        </div>
                      )
                    )}
                    {replyingId === lead.id && replyError && (
                      <p className="mt-1.5 text-xs text-red-600">{replyError}</p>
                    )}

                    {lead.customer ? (
                      <p className="mt-2.5 flex items-center gap-1 text-xs text-green-600">
                        <Check size={13} />
                        {tr.convertedLabel} {lead.customer.name ?? lead.customer.phone} ({lead.customer.phone})
                      </p>
                    ) : lead.status === "new" ? (
                      convertingId === lead.id ? (
                        <div className="mt-2.5 space-y-2 rounded-lg border border-[var(--border)] p-3" onClick={(e) => e.stopPropagation()}>
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
                        <div className="mt-2.5 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => startConvert(lead)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                          >
                            <UserPlus size={12} />
                            {tr.convertBtn}
                          </button>
                          <button
                            onClick={() => void ignoreLead(lead.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
                          >
                            <X size={12} />
                            {tr.ignoreBtn}
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && leads.length > 0 && meta.last_page > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.current_page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[var(--muted)]">{tr.pageInfo(meta.current_page, meta.last_page)}</span>
            <button
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={meta.current_page >= meta.last_page}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </UserShell>
  );
}
