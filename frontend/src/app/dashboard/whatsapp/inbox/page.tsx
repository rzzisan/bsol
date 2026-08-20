"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, Send } from "lucide-react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

interface WhatsappMessage {
  id: number;
  direction: "inbound" | "outbound";
  wa_id: string;
  contact_name: string | null;
  message_type: string;
  body: string | null;
  template_name: string | null;
  status: string;
  is_read: boolean;
  customer: { id: number; name: string | null; phone: string } | null;
  created_at: string;
}

interface Thread {
  wa_id: string;
  contact_name: string | null;
  lastMessage: WhatsappMessage;
  unreadCount: number;
}

const text = {
  bn: {
    pageTitle: "হোয়াটসঅ্যাপ ইনবক্স",
    pageSubtitle: "কাস্টমারের হোয়াটসঅ্যাপ মেসেজ দেখুন ও রিপ্লাই দিন (২৪ ঘণ্টার মেসেজিং উইন্ডোর মধ্যে)।",
    empty: "কোনো মেসেজ পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    selectThread: "একটা কথোপকথন বেছে নিন",
    replyPlaceholder: "রিপ্লাই লিখুন...",
    sendBtn: "পাঠান",
    sending: "পাঠানো হচ্ছে...",
    windowWarning: "শুধু শেষ ২৪ ঘণ্টার মধ্যে মেসেজ পাঠানো কাস্টমারকেই রিপ্লাই দেওয়া যাবে — টেমপ্লেট মেসেজ নয়।",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে।",
    outbound: "আপনি",
    template: "টেমপ্লেট",
  },
  en: {
    pageTitle: "WhatsApp Inbox",
    pageSubtitle: "View and reply to customer WhatsApp messages (within the 24-hour messaging window).",
    empty: "No messages found.",
    loading: "Loading...",
    selectThread: "Select a conversation",
    replyPlaceholder: "Write a reply...",
    sendBtn: "Send",
    sending: "Sending...",
    windowWarning: "Free-text replies only work for a customer who messaged within the last 24 hours — template messages don't apply here.",
    error: "Request failed.",
    outbound: "You",
    template: "Template",
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWaId, setSelectedWaId] = useState<string | null>(null);
  const [thread, setThread] = useState<WhatsappMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/whatsapp/messages?per_page=100`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setMessages((data?.data ?? []) as WhatsappMessage[]);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group the flat message list into one row per wa_id — no dedicated
  // "list threads" endpoint on the backend, this is small enough to do
  // client-side against the recent-messages page.
  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>();
    for (const m of messages) {
      const existing = map.get(m.wa_id);
      const unread = m.direction === "inbound" && !m.is_read ? 1 : 0;
      if (!existing) {
        map.set(m.wa_id, { wa_id: m.wa_id, contact_name: m.contact_name, lastMessage: m, unreadCount: unread });
      } else {
        existing.unreadCount += unread;
        if (m.id > existing.lastMessage.id) existing.lastMessage = m;
        if (!existing.contact_name && m.contact_name) existing.contact_name = m.contact_name;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastMessage.id - a.lastMessage.id);
  }, [messages]);

  const openThread = async (waId: string) => {
    setSelectedWaId(waId);
    setThreadLoading(true);
    setError(null);
    const token = getStoredToken();
    if (!token) return;
    try {
      const res = await fetch(`${API}/whatsapp/messages/thread/${encodeURIComponent(waId)}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setThread((data?.data ?? []) as WhatsappMessage[]);
      await loadMessages(); // refresh unread counts in the thread list
    } catch {
      setError(t.error);
    } finally {
      setThreadLoading(false);
    }
  };

  const sendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedWaId || !replyText.trim()) return;
    const token = getStoredToken();
    if (!token) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API}/whatsapp/messages/thread/${encodeURIComponent(selectedWaId)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: replyText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }
      setReplyText("");
      await openThread(selectedWaId);
    } catch {
      setError(t.error);
    } finally {
      setSending(false);
    }
  };

  return (
    <UserShell
      activeKey="whatsapp-inbox"
      pageTitle={{ bn: text.bn.pageTitle, en: text.en.pageTitle }}
      pageSubtitle={{ bn: text.bn.pageSubtitle, en: text.en.pageSubtitle }}
    >
      <section className="mx-4 mb-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="catv-panel overflow-hidden">
          <div className="max-h-[70vh] divide-y divide-[var(--border)] overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-[var(--muted)]">{t.loading}</p>
            ) : threads.length === 0 ? (
              <p className="p-4 text-sm text-[var(--muted)]">{t.empty}</p>
            ) : (
              threads.map((th) => (
                <button
                  key={th.wa_id}
                  onClick={() => void openThread(th.wa_id)}
                  className={`flex w-full items-start gap-2 px-3 py-3 text-left text-sm transition hover:bg-[var(--surface-soft)] ${selectedWaId === th.wa_id ? "bg-[var(--surface-soft)]" : ""}`}
                >
                  <MessageCircle size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-[var(--foreground)]">{th.contact_name || th.wa_id}</p>
                      {th.unreadCount > 0 ? (
                        <span className="shrink-0 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">{th.unreadCount}</span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-[var(--muted)]">{th.lastMessage.body || `[${th.lastMessage.template_name ?? th.lastMessage.message_type}]`}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="catv-panel flex flex-col p-4 sm:p-5">
          {!selectedWaId ? (
            <p className="text-sm text-[var(--muted)]">{t.selectThread}</p>
          ) : (
            <>
              <div className="mb-3 max-h-[55vh] flex-1 space-y-2 overflow-y-auto">
                {threadLoading ? (
                  <p className="text-sm text-[var(--muted)]">{t.loading}</p>
                ) : (
                  thread.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.direction === "outbound" ? "bg-[var(--accent)] text-white" : ""}`}
                        style={m.direction === "inbound" ? { background: "var(--surface-soft)" } : undefined}
                      >
                        {m.body || (
                          <span className="inline-flex items-center gap-1 opacity-80">
                            <CheckCircle2 size={12} /> {t.template}: {m.template_name}
                          </span>
                        )}
                        <div className={`mt-1 text-[10px] ${m.direction === "outbound" ? "text-white/70" : "text-[var(--muted)]"}`}>
                          {m.direction === "outbound" ? t.outbound : m.contact_name || m.wa_id} · {new Date(m.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <p className="mb-2 text-xs text-amber-600">{t.windowWarning}</p>

              <form onSubmit={sendReply} className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t.replyPlaceholder}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                >
                  <Send size={14} /> {sending ? t.sending : t.sendBtn}
                </button>
              </form>
            </>
          )}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </section>
    </UserShell>
  );
}
