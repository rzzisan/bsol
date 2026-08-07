"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredToken, getStoredUser, normalizeRole } from "@/lib/dashboard-client";
import { useLocale } from "@/lib/locale-context";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

interface SupportMessage {
  id: number;
  conversation_id: number;
  sender_type: "user" | "admin";
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

const text = {
  bn: {
    button: "সাপোর্ট",
    title: "SaaS সাপোর্ট",
    subtitle: "আমাদের টিমকে সরাসরি মেসেজ করুন",
    placeholder: "আপনার মেসেজ লিখুন…",
    send: "পাঠান",
    empty: "এখনও কোনো মেসেজ নেই। আপনার প্রশ্ন লিখে শুরু করুন।",
    loadOlder: "আগের মেসেজ দেখুন",
    loading: "লোড হচ্ছে…",
    closedNotice: "এই কথোপকথনটি বন্ধ করা হয়েছে। নতুন মেসেজ পাঠালে এটি আবার খুলে যাবে।",
    sendError: "মেসেজ পাঠানো যায়নি, আবার চেষ্টা করুন।",
    newMessage: "নতুন মেসেজ",
  },
  en: {
    button: "Support",
    title: "SaaS Support",
    subtitle: "Chat directly with our team",
    placeholder: "Type your message…",
    send: "Send",
    empty: "No messages yet. Say hello to get started.",
    loadOlder: "Load older messages",
    loading: "Loading…",
    closedNotice: "This conversation was closed. Sending a message will reopen it.",
    sendError: "Couldn't send the message — please try again.",
    newMessage: "New message",
  },
};

function formatTime(iso: string, locale: "bn" | "en") {
  try {
    return new Date(iso).toLocaleTimeString(locale === "bn" ? "bn-BD" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function SupportChatWidget() {
  const locale = useLocale();
  const t = text[locale];

  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<string>("open");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(0);
  const openRef = useRef(false);
  openRef.current = open;
  const prevUnreadRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only show for seller ("user") accounts — admins have their own inbox at /admin/support.
  useEffect(() => {
    const user = getStoredUser();
    setVisible(normalizeRole(user) === "user");
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/support/messages`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const list: SupportMessage[] = data.data ?? [];
      setMessages(list);
      setHasMore(Boolean(data.has_more));
      if (list.length) lastIdRef.current = list[list.length - 1].id;
      scrollToBottom();
    } catch {
      // silent — widget just stays empty, retried on next poll
    }
  }, [authHeaders, scrollToBottom]);

  const markRead = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/support/read`, { method: "POST", headers: authHeaders() });
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, [authHeaders]);

  const showToast = useCallback((preview: string) => {
    setToast(preview);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
  }, []);

  // Lightweight unread-count poll, always running once visible — updates the
  // notification badge on the minimized button, and pops a toast the moment
  // a *new* admin reply arrives while the chat box is closed.
  useEffect(() => {
    if (!visible) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/support/unread-count`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const count: number = data.count ?? 0;

        if (!openRef.current) {
          setUnreadCount(count);
          if (prevUnreadRef.current !== null && count > prevUnreadRef.current && data.preview) {
            showToast(data.preview);
          }
        }
        prevUnreadRef.current = count;
      } catch {
        // silent
      }
    };

    void poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [visible, authHeaders, showToast]);

  // Load history + mark read when the panel opens; poll for new messages while it's open.
  useEffect(() => {
    if (!visible || !open) return;

    void loadInitial();
    void markRead();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/support/messages?after_id=${lastIdRef.current}`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const incoming: SupportMessage[] = data.data ?? [];
        if (incoming.length) {
          setMessages((prev) => [...prev, ...incoming]);
          lastIdRef.current = incoming[incoming.length - 1].id;
          scrollToBottom();
          if (incoming.some((m) => m.sender_type === "admin")) void markRead();
        }
      } catch {
        // silent
      }
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, open]);

  const loadOlder = useCallback(async () => {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`${API_BASE_URL}/support/messages?before_id=${messages[0].id}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const older: SupportMessage[] = data.data ?? [];
      setMessages((prev) => [...older, ...prev]);
      setHasMore(Boolean(data.has_more));
    } finally {
      setLoadingOlder(false);
    }
  }, [messages, loadingOlder, authHeaders]);

  const handleSend = useCallback(async () => {
    const value = draft.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/support/messages`, {
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
      setStatus("open");
      setDraft("");
      scrollToBottom();
    } catch {
      setError(t.sendError);
    } finally {
      setSending(false);
    }
  }, [draft, sending, authHeaders, scrollToBottom, t.sendError]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {!open && toast && (
        <button
          type="button"
          onClick={() => {
            setToast(null);
            setOpen(true);
          }}
          className="flex max-w-[calc(100vw-2rem)] items-start gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left shadow-2xl sm:max-w-xs"
        >
          <span aria-hidden className="mt-0.5">💬</span>
          <span>
            <span className="block text-xs font-semibold text-[var(--foreground)]">{t.newMessage}</span>
            <span className="block truncate text-xs text-[var(--muted)]">{toast}</span>
          </span>
        </button>
      )}

      {open && (
        <div className="flex h-[70vh] max-h-[32rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{t.title}</p>
              <p className="text-xs text-[var(--muted)]">{t.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="close"
              className="rounded-full p-1 text-[var(--muted)] transition hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            >
              ✕
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
              <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender_type === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
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

          {status === "closed" && (
            <p className="border-t border-[var(--border)] px-3 py-2 text-center text-[11px] text-[var(--muted)]">
              {t.closedNotice}
            </p>
          )}

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
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setToast(null);
          setOpen((v) => !v);
        }}
        className="relative flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:opacity-90"
      >
        <span aria-hidden>💬</span>
        <span className="hidden sm:inline">{t.button}</span>
        {unreadCount > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
