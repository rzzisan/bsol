"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

type Status = "open" | "pending" | "resolved" | "closed";
type Category = "billing" | "order" | "product" | "technical" | "account" | "other";

interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  category: Category;
  priority: "low" | "medium" | "high" | "urgent";
  status: Status;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_type: "user" | "admin" | "ai" | null;
  user_unread_count: number;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_type: "user" | "admin" | "ai";
  sender_id: number | null;
  sender: { id: number; name: string } | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Signature line under a reply — the real team member's name, or "BSOL" for
// an AI-authored reply (never reveals it was automated).
function signatureFor(m: TicketMessage): string | null {
  if (m.sender_type === "user") return null;
  if (m.sender_type === "admin") return m.sender?.name ?? "BSOL";
  return "BSOL";
}

const CATEGORIES: Category[] = ["billing", "order", "product", "technical", "account", "other"];

const text = {
  bn: {
    pageTitle: "আমার টিকেট",
    newTicket: "নতুন টিকেট",
    subject: "বিষয়",
    subjectPlaceholder: "সংক্ষেপে সমস্যাটি লিখুন",
    category: { billing: "বিলিং", order: "অর্ডার", product: "প্রোডাক্ট", technical: "টেকনিক্যাল", account: "অ্যাকাউন্ট", other: "অন্যান্য" } as Record<Category, string>,
    status: { open: "খোলা", pending: "অপেক্ষমাণ", resolved: "সমাধান হয়েছে", closed: "বন্ধ" } as Record<Status, string>,
    message: "মেসেজ",
    messagePlaceholder: "বিস্তারিত লিখুন…",
    submit: "টিকেট খুলুন",
    submitting: "পাঠানো হচ্ছে…",
    cancel: "বাতিল",
    noTickets: "এখনও কোনো টিকেট নেই। উপরে থেকে একটি নতুন টিকেট খুলুন।",
    selectTicket: "একটি টিকেট সিলেক্ট করুন",
    placeholder: "রিপ্লাই লিখুন…",
    send: "পাঠান",
    empty: "এখনও কোনো মেসেজ নেই।",
    loadOlder: "আগের মেসেজ",
    loading: "লোড হচ্ছে…",
    sendError: "মেসেজ পাঠানো যায়নি।",
    aiHint: "সাধারণ প্রশ্নে দ্রুত উত্তর পাবেন — জটিল কিছু হলে আমাদের টিম নিজেই দেখবে।",
  },
  en: {
    pageTitle: "My Tickets",
    newTicket: "New Ticket",
    subject: "Subject",
    subjectPlaceholder: "Briefly describe the issue",
    category: { billing: "Billing", order: "Order", product: "Product", technical: "Technical", account: "Account", other: "Other" } as Record<Category, string>,
    status: { open: "Open", pending: "Pending", resolved: "Resolved", closed: "Closed" } as Record<Status, string>,
    message: "Message",
    messagePlaceholder: "Describe your issue in detail…",
    submit: "Open Ticket",
    submitting: "Sending…",
    cancel: "Cancel",
    noTickets: "No tickets yet. Open a new one above.",
    selectTicket: "Select a ticket",
    placeholder: "Type a reply…",
    send: "Send",
    empty: "No messages yet.",
    loadOlder: "Load older",
    loading: "Loading…",
    sendError: "Couldn't send the message.",
    aiHint: "You'll get a quick reply for common questions — our team handles anything more involved.",
  },
};

function formatTime(iso: string | null, locale: Locale) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MyTicketsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);

  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API}/tickets?per_page=50`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setTickets(data.data ?? []);
    } catch {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadTickets();
    const interval = setInterval(loadTickets, 15000);
    return () => clearInterval(interval);
  }, [loadTickets]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  const markRead = useCallback(
    async (ticketId: number) => {
      try {
        await fetch(`${API}/tickets/${ticketId}/read`, { method: "POST", headers: authHeaders() });
        setTickets((prev) => prev.map((tk) => (tk.id === ticketId ? { ...tk, user_unread_count: 0 } : tk)));
      } catch {
        // silent
      }
    },
    [authHeaders],
  );

  const loadMessages = useCallback(
    async (ticketId: number) => {
      try {
        const res = await fetch(`${API}/tickets/${ticketId}/messages`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const list: TicketMessage[] = data.data ?? [];
        setMessages(list);
        setHasMore(Boolean(data.has_more));
        if (list.length) lastIdRef.current = list[list.length - 1].id;
        scrollToBottom();
      } catch {
        // silent
      }
    },
    [authHeaders, scrollToBottom],
  );

  useEffect(() => {
    if (!selectedId) return;
    lastIdRef.current = 0;
    setMessages([]);
    void loadMessages(selectedId);
    void markRead(selectedId);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/tickets/${selectedId}/messages?after_id=${lastIdRef.current}`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const incoming: TicketMessage[] = data.data ?? [];
        if (incoming.length) {
          setMessages((prev) => [...prev, ...incoming]);
          lastIdRef.current = incoming[incoming.length - 1].id;
          scrollToBottom();
          if (incoming.some((m) => m.sender_type === "admin" || m.sender_type === "ai")) void markRead(selectedId);
        }
      } catch {
        // silent
      }
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const loadOlder = useCallback(async () => {
    if (!selectedId || !messages.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`${API}/tickets/${selectedId}/messages?before_id=${messages[0].id}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const older: TicketMessage[] = data.data ?? [];
      setMessages((prev) => [...older, ...prev]);
      setHasMore(Boolean(data.has_more));
    } finally {
      setLoadingOlder(false);
    }
  }, [selectedId, messages, loadingOlder, authHeaders]);

  const handleSend = useCallback(async () => {
    const value = draft.trim();
    if (!value || !selectedId || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API}/tickets/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: value }),
      });
      if (!res.ok) {
        setError(t.sendError);
        return;
      }
      const data = await res.json();
      const created: TicketMessage = data.data;
      setMessages((prev) => [...prev, created]);
      lastIdRef.current = created.id;
      setDraft("");
      scrollToBottom();
    } catch {
      setError(t.sendError);
    } finally {
      setSending(false);
    }
  }, [draft, selectedId, sending, authHeaders, scrollToBottom, t.sendError]);

  const handleCreate = useCallback(async () => {
    if (!subject.trim() || !newMessage.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subject: subject.trim(), category, message: newMessage.trim() }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setSubject("");
      setNewMessage("");
      setCategory("other");
      setShowForm(false);
      await loadTickets();
      if (data?.data?.id) setSelectedId(data.data.id);
    } finally {
      setCreating(false);
    }
  }, [subject, newMessage, category, creating, authHeaders, loadTickets]);

  const selected = tickets.find((tk) => tk.id === selectedId) ?? null;

  return (
    <UserShell locale={locale} onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")} activeKey="my-tickets" pageTitle={{ bn: t.pageTitle, en: t.pageTitle }}>
      <div className="grid h-[calc(100vh-11rem)] min-h-[28rem] grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        <section
          className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${
            selectedId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="border-b border-[var(--border)] p-3">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            >
              + {t.newTicket}
            </button>
            {showForm && (
              <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t.subjectPlaceholder}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t.category[c]}
                    </option>
                  ))}
                </select>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t.messagePlaceholder}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-[var(--muted)]">{t.aiHint}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={creating || !subject.trim() || !newMessage.trim()}
                    className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {creating ? t.submitting : t.submit}
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
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList && tickets.length === 0 && <p className="p-4 text-center text-xs text-[var(--muted)]">{t.loading}</p>}
            {!loadingList && tickets.length === 0 && <p className="p-4 text-center text-xs text-[var(--muted)]">{t.noTickets}</p>}
            {tickets.map((tk) => (
              <button
                key={tk.id}
                type="button"
                onClick={() => setSelectedId(tk.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-[var(--border)] px-3 py-2.5 text-left transition hover:bg-[var(--surface-soft)] ${
                  selectedId === tk.id ? "bg-[var(--surface-soft)]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-mono text-[var(--muted)]">{tk.ticket_number}</span>
                  {tk.user_unread_count > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {tk.user_unread_count > 9 ? "9+" : tk.user_unread_count}
                    </span>
                  )}
                </div>
                <span className="truncate text-sm font-semibold text-[var(--foreground)]">{tk.subject}</span>
                <span className="truncate text-xs text-[var(--muted)]">
                  {tk.last_message_sender_type === "ai" || tk.last_message_sender_type === "admin" ? "↩ " : ""}
                  {tk.last_message_preview ?? "—"}
                </span>
                <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
                  <span>{formatTime(tk.last_message_at, locale)}</span>
                  <span>{t.status[tk.status]}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section
          className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${
            selectedId ? "flex" : "hidden lg:flex"
          }`}
        >
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">{t.selectTicket}</div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)] lg:hidden"
                    aria-label="back"
                  >
                    ←
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {selected.ticket_number} · {selected.subject}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {t.category[selected.category]} · {t.status[selected.status]}
                    </p>
                  </div>
                </div>
              </div>

              <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {hasMore && (
                  <div className="flex justify-center pb-1">
                    <button
                      type="button"
                      onClick={loadOlder}
                      disabled={loadingOlder}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      {loadingOlder ? t.loading : t.loadOlder}
                    </button>
                  </div>
                )}
                {messages.length === 0 && <p className="mt-6 text-center text-xs text-[var(--muted)]">{t.empty}</p>}
                {/* AI-authored replies render identically to admin replies —
                    seller-facing view, one consistent support team, no
                    visible "AI" tell (support_ticketing_ai_context.md). */}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        m.sender_type === "user"
                          ? "bg-[var(--accent)] text-white"
                          : "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.message}</p>
                      {signatureFor(m) && <p className="mt-1 text-xs font-medium text-[var(--muted)]">- {signatureFor(m)}</p>}
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          m.sender_type === "user" ? "text-white/70" : "text-[var(--muted)]"
                        }`}
                      >
                        {formatTime(m.created_at, locale)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="px-3 pt-1 text-xs text-red-500">{error}</p>}

              <div className="flex items-end gap-2 border-t border-[var(--border)] p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={t.placeholder}
                  rows={1}
                  className="max-h-24 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !draft.trim()}
                  className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {t.send}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </UserShell>
  );
}
