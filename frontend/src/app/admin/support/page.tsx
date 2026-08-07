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

interface ConversationUser {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
}

interface Conversation {
  id: number;
  user_id: number;
  status: "open" | "closed";
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_type: "user" | "admin" | null;
  user_unread_count: number;
  admin_unread_count: number;
  user: ConversationUser;
}

interface SupportMessage {
  id: number;
  conversation_id: number;
  sender_type: "user" | "admin";
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

type StatusFilter = "all" | "open" | "closed";

const text = {
  bn: {
    title: "সাপোর্ট ইনবক্স",
    subtitle: "সব সেলারের সাপোর্ট চ্যাট — যেকোনো অ্যাডমিন যেকোনো কথোপকথন দেখতে ও রিপ্লাই দিতে পারবেন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    menuDashboard: "ড্যাশবোর্ড",
    menuCustomers: "গ্রাহক",
    menuActive: "অ্যাকটিভ গ্রাহক",
    menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস",
    menuSmsGateway: "এসএমএস গেটওয়ে",
    menuSmsSend: "এসএমএস সেন্ড",
    menuSmsHistory: "এসএমএস হিস্টোরি",
    menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ",
    menuBilling: "বিলিং",
    menuReports: "রিপোর্ট",
    menuSettings: "সেটিংস",
    menuEmailSettings: "ইমেইল সেটিংস",
    menuLandingPages: "ল্যান্ডিং পেজ",
    menuLandingTemplates: "ল্যান্ডিং টেমপ্লেট",
    menuCourierCache: "কুরিয়ার ক্যাশ",
    menuSupport: "সাপোর্ট",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    searchPlaceholder: "নাম, ইমেইল বা মোবাইল দিয়ে খুঁজুন",
    statusAll: "সব",
    statusOpen: "চলমান",
    statusClosed: "বন্ধ",
    noConversations: "কোনো কথোপকথন পাওয়া যায়নি।",
    selectConversation: "একটি কথোপকথন সিলেক্ট করুন",
    close: "বন্ধ করুন",
    reopen: "আবার খুলুন",
    placeholder: "রিপ্লাই লিখুন…",
    send: "পাঠান",
    empty: "এখনও কোনো মেসেজ নেই।",
    loadOlder: "আগের মেসেজ",
    loading: "লোড হচ্ছে…",
    backToList: "তালিকায় ফিরুন",
    noMobile: "মোবাইল নেই",
    sendError: "মেসেজ পাঠানো যায়নি।",
  },
  en: {
    title: "Support Inbox",
    subtitle: "All sellers' support chats — any admin can view and reply to any conversation.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    menuDashboard: "Dashboard",
    menuCustomers: "Customers",
    menuActive: "Active Customers",
    menuPending: "Pending Customers",
    menuSms: "SMS",
    menuSmsGateway: "SMS Gateway",
    menuSmsSend: "Send SMS",
    menuSmsHistory: "SMS History",
    menuSmsCredit: "SMS Credit",
    menuPackages: "Packages",
    menuBilling: "Billing",
    menuReports: "Reports",
    menuSettings: "Settings",
    menuEmailSettings: "Email Settings",
    menuLandingPages: "Landing Pages",
    menuLandingTemplates: "Landing Templates",
    menuCourierCache: "Courier Cache",
    menuSupport: "Support",
    languageLabel: "Language",
    themeLabel: "Theme",
    searchPlaceholder: "Search by name, email or mobile",
    statusAll: "All",
    statusOpen: "Open",
    statusClosed: "Closed",
    noConversations: "No conversations found.",
    selectConversation: "Select a conversation",
    close: "Close",
    reopen: "Reopen",
    placeholder: "Type a reply…",
    send: "Send",
    empty: "No messages yet.",
    loadOlder: "Load older",
    loading: "Loading…",
    backToList: "Back to list",
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

export default function AdminSupportPage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);
  const selectedIdRef = useRef<number | null>(null);
  selectedIdRef.current = selectedId;

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

  const menu = useMemo(
    () =>
      buildAdminMenu({
        dashboard: t.menuDashboard,
        customers: t.menuCustomers,
        activeCustomers: t.menuActive,
        pendingCustomers: t.menuPending,
        sms: t.menuSms,
        smsGateway: t.menuSmsGateway,
        smsSend: t.menuSmsSend,
        smsHistory: t.menuSmsHistory,
        smsCredit: t.menuSmsCredit,
        packages: t.menuPackages,
        billing: t.menuBilling,
        reports: t.menuReports,
        settings: t.menuSettings,
        emailSettings: t.menuEmailSettings,
        landingPages: t.menuLandingPages,
        landingTemplates: t.menuLandingTemplates,
        courierCache: t.menuCourierCache,
        support: t.menuSupport,
      }),
    [t],
  );

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ per_page: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`${API_BASE_URL}/admin/support/conversations?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.data ?? []);
    } catch {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, search, authHeaders]);

  useEffect(() => {
    if (state !== "ready") return;
    void loadConversations();
    const interval = setInterval(loadConversations, 15000);
    return () => clearInterval(interval);
  }, [state, loadConversations]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  const markRead = useCallback(
    async (conversationId: number) => {
      try {
        await fetch(`${API_BASE_URL}/admin/support/conversations/${conversationId}/read`, {
          method: "POST",
          headers: authHeaders(),
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, admin_unread_count: 0 } : c)),
        );
      } catch {
        // silent
      }
    },
    [authHeaders],
  );

  const loadMessages = useCallback(
    async (conversationId: number) => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/support/conversations/${conversationId}/messages`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: SupportMessage[] = data.data ?? [];
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
        const res = await fetch(
          `${API_BASE_URL}/admin/support/conversations/${selectedId}/messages?after_id=${lastIdRef.current}`,
          { headers: authHeaders() },
        );
        if (!res.ok) return;
        const data = await res.json();
        const incoming: SupportMessage[] = data.data ?? [];
        if (incoming.length) {
          setMessages((prev) => [...prev, ...incoming]);
          lastIdRef.current = incoming[incoming.length - 1].id;
          scrollToBottom();
          if (incoming.some((m) => m.sender_type === "user")) void markRead(selectedId);
          void loadConversations();
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
      const res = await fetch(
        `${API_BASE_URL}/admin/support/conversations/${selectedId}/messages?before_id=${messages[0].id}`,
        { headers: authHeaders() },
      );
      if (!res.ok) return;
      const data = await res.json();
      const older: SupportMessage[] = data.data ?? [];
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
      const res = await fetch(`${API_BASE_URL}/admin/support/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: value }),
      });
      if (!res.ok) {
        setError(t.sendError);
        return;
      }
      const data = await res.json();
      const created: SupportMessage = data.data;
      setMessages((prev) => [...prev, created]);
      lastIdRef.current = created.id;
      setDraft("");
      scrollToBottom();
      void loadConversations();
    } catch {
      setError(t.sendError);
    } finally {
      setSending(false);
    }
  }, [draft, selectedId, sending, authHeaders, scrollToBottom, loadConversations, t.sendError]);

  const toggleStatus = useCallback(
    async (conversation: Conversation) => {
      const nextStatus = conversation.status === "open" ? "closed" : "open";
      try {
        const res = await fetch(`${API_BASE_URL}/admin/support/conversations/${conversation.id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) return;
        setConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? { ...c, status: nextStatus } : c)),
        );
      } catch {
        // silent
      }
    },
    [authHeaders],
  );

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

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
      userName={t.menuSupport}
      userMeta={t.title}
      menu={menu}
      activeKey="support"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="grid h-[calc(100vh-11rem)] min-h-[28rem] grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Conversation list */}
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
            <div className="flex gap-1">
              {(["all", "open", "closed"] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`flex-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                    statusFilter === f
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {f === "all" ? t.statusAll : f === "open" ? t.statusOpen : t.statusClosed}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList && conversations.length === 0 && (
              <p className="p-4 text-center text-xs text-[var(--muted)]">{t.loading}</p>
            )}
            {!loadingList && conversations.length === 0 && (
              <p className="p-4 text-center text-xs text-[var(--muted)]">{t.noConversations}</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-[var(--border)] px-3 py-2.5 text-left transition hover:bg-[var(--surface-soft)] ${
                  selectedId === c.id ? "bg-[var(--surface-soft)]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                    {c.user?.name ?? `#${c.user_id}`}
                  </span>
                  {c.admin_unread_count > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {c.admin_unread_count > 9 ? "9+" : c.admin_unread_count}
                    </span>
                  )}
                </div>
                <span className="truncate text-xs text-[var(--muted)]">
                  {c.last_message_sender_type === "admin" ? "↩ " : ""}
                  {c.last_message_preview ?? "—"}
                </span>
                <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
                  <span>{formatTime(c.last_message_at, locale)}</span>
                  <span className={c.status === "open" ? "text-emerald-500" : ""}>
                    {c.status === "open" ? t.statusOpen : t.statusClosed}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Chat panel */}
        <section
          className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${
            selectedId ? "flex" : "hidden lg:flex"
          }`}
        >
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
              {t.selectConversation}
            </div>
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
                    <p className="text-sm font-semibold text-[var(--foreground)]">{selected.user?.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {selected.user?.email} · {selected.user?.mobile ?? t.noMobile}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleStatus(selected)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--border)]"
                >
                  {selected.status === "open" ? t.close : t.reopen}
                </button>
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
                {messages.length === 0 && (
                  <p className="mt-6 text-center text-xs text-[var(--muted)]">{t.empty}</p>
                )}
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
