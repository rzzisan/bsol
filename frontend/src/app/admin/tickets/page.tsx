"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

type Status = "open" | "pending" | "resolved" | "closed";
type Priority = "low" | "medium" | "high" | "urgent";
type Category = "billing" | "order" | "product" | "technical" | "account" | "other";

interface TicketUser {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
}

interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  category: Category;
  priority: Priority;
  status: Status;
  assigned_admin_id: number | null;
  assigned_admin: { id: number; name: string } | null;
  ai_handled: boolean;
  escalated: boolean;
  escalation_reason: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_type: "user" | "admin" | "ai" | null;
  user_unread_count: number;
  admin_unread_count: number;
  user: TicketUser;
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
// an AI-authored reply (never reveals it was automated, even to admins).
function signatureFor(m: TicketMessage): string | null {
  if (m.sender_type === "user") return null;
  if (m.sender_type === "admin") return m.sender?.name ?? "BSOL";
  return "BSOL";
}

type StatusFilter = "all" | Status;

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const STATUSES: Status[] = ["open", "pending", "resolved", "closed"];

const text = {
  bn: {
    title: "সাপোর্ট টিকেট",
    subtitle: "সব সেলারের টিকেট — যেকোনো অ্যাডমিন দেখতে ও রিপ্লাই দিতে পারবেন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    searchPlaceholder: "টিকেট নম্বর, বিষয় বা সেলার খুঁজুন",
    statusAll: "সব",
    status: { open: "খোলা", pending: "অপেক্ষমাণ", resolved: "সমাধান হয়েছে", closed: "বন্ধ" } as Record<Status, string>,
    priority: { low: "নিম্ন", medium: "মাঝারি", high: "উচ্চ", urgent: "জরুরি" } as Record<Priority, string>,
    category: { billing: "বিলিং", order: "অর্ডার", product: "প্রোডাক্ট", technical: "টেকনিক্যাল", account: "অ্যাকাউন্ট", other: "অন্যান্য" } as Record<Category, string>,
    escalatedOnly: "শুধু Escalated",
    noTickets: "কোনো টিকেট পাওয়া যায়নি।",
    selectTicket: "একটি টিকেট সিলেক্ট করুন",
    takeOver: "নিজে দায়িত্ব নিন",
    takenOverBy: "দায়িত্বে",
    aiHandling: "AI পরিচালনা করছে",
    escalatedBadge: "🚩 Escalated",
    placeholder: "রিপ্লাই লিখুন…",
    send: "পাঠান",
    empty: "এখনও কোনো মেসেজ নেই।",
    loadOlder: "আগের মেসেজ",
    loading: "লোড হচ্ছে…",
    noMobile: "মোবাইল নেই",
    sendError: "মেসেজ পাঠানো যায়নি।",
  },
  en: {
    title: "Support Tickets",
    subtitle: "All sellers' tickets — any admin can view and reply.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    languageLabel: "Language",
    themeLabel: "Theme",
    searchPlaceholder: "Search ticket #, subject or seller",
    statusAll: "All",
    status: { open: "Open", pending: "Pending", resolved: "Resolved", closed: "Closed" } as Record<Status, string>,
    priority: { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" } as Record<Priority, string>,
    category: { billing: "Billing", order: "Order", product: "Product", technical: "Technical", account: "Account", other: "Other" } as Record<Category, string>,
    escalatedOnly: "Escalated only",
    noTickets: "No tickets found.",
    selectTicket: "Select a ticket",
    takeOver: "Take over",
    takenOverBy: "Assigned to",
    aiHandling: "AI is handling this",
    escalatedBadge: "🚩 Escalated",
    placeholder: "Type a reply…",
    send: "Send",
    empty: "No messages yet.",
    loadOlder: "Load older",
    loading: "Loading…",
    noMobile: "No mobile",
    sendError: "Couldn't send the message.",
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

function priorityColor(p: Priority) {
  switch (p) {
    case "urgent":
      return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    case "high":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
  }
}

export default function AdminTicketsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    setLocale(getStoredLocale());
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      setState("unauthenticated");
      return;
    }
    if (normalizeRole(storedUser) !== "admin") {
      setState("forbidden");
      return;
    }
    setState("ready");
  }, []);

  const t = useMemo(() => text[locale], [locale]);
  const menu = useMemo(() => buildAdminMenu(locale), [t]);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ per_page: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (escalatedOnly) params.set("escalated_only", "1");
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`${API_BASE_URL}/admin/tickets?${params.toString()}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setTickets(data.data ?? []);
    } catch {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, escalatedOnly, search, authHeaders]);

  useEffect(() => {
    if (state !== "ready") return;
    void loadTickets();
    const interval = setInterval(loadTickets, 15000);
    return () => clearInterval(interval);
  }, [state, loadTickets]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  const markRead = useCallback(
    async (ticketId: number) => {
      try {
        await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}/read`, { method: "POST", headers: authHeaders() });
        setTickets((prev) => prev.map((tk) => (tk.id === ticketId ? { ...tk, admin_unread_count: 0 } : tk)));
      } catch {
        // silent
      }
    },
    [authHeaders],
  );

  const loadMessages = useCallback(
    async (ticketId: number) => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}/messages`, { headers: authHeaders() });
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
        const res = await fetch(`${API_BASE_URL}/admin/tickets/${selectedId}/messages?after_id=${lastIdRef.current}`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const incoming: TicketMessage[] = data.data ?? [];
        if (incoming.length) {
          setMessages((prev) => [...prev, ...incoming]);
          lastIdRef.current = incoming[incoming.length - 1].id;
          scrollToBottom();
          if (incoming.some((m) => m.sender_type === "user")) void markRead(selectedId);
          void loadTickets();
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
      const res = await fetch(`${API_BASE_URL}/admin/tickets/${selectedId}/messages?before_id=${messages[0].id}`, {
        headers: authHeaders(),
      });
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
      const res = await fetch(`${API_BASE_URL}/admin/tickets/${selectedId}/messages`, {
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
      void loadTickets();
    } catch {
      setError(t.sendError);
    } finally {
      setSending(false);
    }
  }, [draft, selectedId, sending, authHeaders, scrollToBottom, loadTickets, t.sendError]);

  const takeOver = useCallback(
    async (ticket: Ticket) => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/tickets/${ticket.id}/take-over`, {
          method: "POST",
          headers: authHeaders(),
        });
        if (!res.ok) return;
        void loadTickets();
      } catch {
        // silent
      }
    },
    [authHeaders, loadTickets],
  );

  const updateStatus = useCallback(
    async (ticket: Ticket, status: Status) => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/tickets/${ticket.id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) return;
        setTickets((prev) => prev.map((tk) => (tk.id === ticket.id ? { ...tk, status } : tk)));
      } catch {
        // silent
      }
    },
    [authHeaders],
  );

  const updatePriority = useCallback(
    async (ticket: Ticket, priority: Priority) => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/tickets/${ticket.id}/priority`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ priority }),
        });
        if (!res.ok) return;
        setTickets((prev) => prev.map((tk) => (tk.id === ticket.id ? { ...tk, priority } : tk)));
      } catch {
        // silent
      }
    },
    [authHeaders],
  );

  const selected = tickets.find((tk) => tk.id === selectedId) ?? null;

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            {state === "forbidden" ? t.accessDenied : t.loginRequired}
          </p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
            {t.goHome}
          </a>
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
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle="Admin Panel"
      menu={menu}
      activeKey="tickets"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="grid h-[calc(100vh-11rem)] min-h-[28rem] grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
        {/* Ticket list */}
        <section
          className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${
            selectedId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="space-y-2 border-b border-[var(--border)] p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <div className="flex flex-wrap gap-1">
              {(["all", ...STATUSES] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    statusFilter === f ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {f === "all" ? t.statusAll : t.status[f]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <input type="checkbox" checked={escalatedOnly} onChange={(e) => setEscalatedOnly(e.target.checked)} />
              {t.escalatedOnly}
            </label>
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
                  {tk.admin_unread_count > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {tk.admin_unread_count > 9 ? "9+" : tk.admin_unread_count}
                    </span>
                  )}
                </div>
                <span className="truncate text-sm font-semibold text-[var(--foreground)]">{tk.subject}</span>
                <span className="truncate text-xs text-[var(--muted)]">{tk.user?.name ?? `#${tk.user.id}`}</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${priorityColor(tk.priority)}`}>
                    {t.priority[tk.priority]}
                  </span>
                  <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                    {t.category[tk.category]}
                  </span>
                  <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                    {t.status[tk.status]}
                  </span>
                  {tk.escalated && <span className="text-[10px]">{t.escalatedBadge}</span>}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Thread panel */}
        <section
          className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${
            selectedId ? "flex" : "hidden lg:flex"
          }`}
        >
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">{t.selectTicket}</div>
          ) : (
            <>
              <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
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
                        {selected.user?.name} · {selected.user?.email} · {selected.user?.mobile ?? t.noMobile}
                      </p>
                    </div>
                  </div>
                  {selected.assigned_admin_id === null ? (
                    <button
                      type="button"
                      onClick={() => void takeOver(selected)}
                      className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--border)]"
                    >
                      {t.takeOver}
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
                      {t.takenOverBy}: {selected.assigned_admin?.name ?? "—"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {selected.ai_handled && !selected.assigned_admin_id && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                      🤖 {t.aiHandling}
                    </span>
                  )}
                  {selected.escalated && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {t.escalatedBadge}
                      {selected.escalation_reason ? `: ${selected.escalation_reason}` : ""}
                    </span>
                  )}
                  <select
                    value={selected.status}
                    onChange={(e) => void updateStatus(selected, e.target.value as Status)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t.status[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selected.priority}
                    onChange={(e) => void updatePriority(selected, e.target.value as Priority)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {t.priority[p]}
                      </option>
                    ))}
                  </select>
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
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        m.sender_type === "admin"
                          ? "bg-[var(--accent)] text-white"
                          : "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.message}</p>
                      {signatureFor(m) && <p className="mt-1 text-xs font-medium text-[var(--muted)]">- {signatureFor(m)}</p>}
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          m.sender_type === "admin" ? "text-white/70" : "text-[var(--muted)]"
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
    </CatvShell>
  );
}
