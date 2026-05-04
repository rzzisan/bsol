"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

type TriggerEvent =
  | "order_confirmed"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "payment_due"
  | "failed_delivery_retry";

interface SmsAutomationRule {
  id: number;
  name: string;
  trigger_event: TriggerEvent;
  template_text: string;
  delay_minutes: number;
  is_active: boolean;
  created_at: string;
}

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const TEMPLATE_PLACEHOLDERS = [
  "{customer_name}",
  "{order_number}",
  "{total}",
  "{courier}",
  "{tracking_id}",
  "{shop_name}",
  "{delivery_date}",
];

const text = {
  bn: {
    pageTitle: "SMS অটোমেশন",
    pageSubtitle: "অর্ডারের নির্দিষ্ট event-এ অটো SMS পাঠাতে rules তৈরি করুন।",
    createTitle: "নতুন Rule তৈরি করুন",
    editTitle: "Rule আপডেট করুন",
    fields: {
      name: "Rule নাম",
      trigger: "Trigger Event",
      template: "Message Template",
      delay: "Delay (মিনিট)",
      active: "Active",
      placeholders: "Placeholders",
      placeholderHint: "Placeholder-এ ক্লিক করলে Message Template-এ যোগ হবে",
    },
    actions: {
      create: "Rule তৈরি করুন",
      update: "Rule আপডেট",
      cancel: "বাতিল",
      edit: "এডিট",
      delete: "ডিলিট",
      refresh: "রিফ্রেশ",
    },
    empty: "কোনো automation rule পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    saving: "সেভ হচ্ছে...",
    deleting: "ডিলিট হচ্ছে...",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
    confirmDelete: "এই rule টি ডিলিট করতে চান?",
    triggers: {
      order_confirmed: "Order Confirmed",
      order_shipped: "Order Shipped",
      order_delivered: "Order Delivered",
      order_cancelled: "Order Cancelled",
      payment_due: "Payment Due",
      failed_delivery_retry: "Failed Delivery Retry",
    },
  },
  en: {
    pageTitle: "SMS Automation",
    pageSubtitle: "Create rules to auto-send SMS on specific order events.",
    createTitle: "Create New Rule",
    editTitle: "Update Rule",
    fields: {
      name: "Rule Name",
      trigger: "Trigger Event",
      template: "Message Template",
      delay: "Delay (minutes)",
      active: "Active",
      placeholders: "Placeholders",
      placeholderHint: "Click a placeholder to insert into Message Template",
    },
    actions: {
      create: "Create Rule",
      update: "Update Rule",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      refresh: "Refresh",
    },
    empty: "No automation rules found.",
    loading: "Loading...",
    saving: "Saving...",
    deleting: "Deleting...",
    error: "Request failed. Please try again.",
    confirmDelete: "Are you sure to delete this rule?",
    triggers: {
      order_confirmed: "Order Confirmed",
      order_shipped: "Order Shipped",
      order_delivered: "Order Delivered",
      order_cancelled: "Order Cancelled",
      payment_due: "Payment Due",
      failed_delivery_retry: "Failed Delivery Retry",
    },
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [rules, setRules] = useState<SmsAutomationRule[]>([]);
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    trigger_event: "order_confirmed" as TriggerEvent,
    template_text: "",
    delay_minutes: 0,
    is_active: true,
  });

  const triggerOptions: TriggerEvent[] = [
    "order_confirmed",
    "order_shipped",
    "order_delivered",
    "order_cancelled",
    "payment_due",
    "failed_delivery_retry",
  ];

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      trigger_event: "order_confirmed",
      template_text: "",
      delay_minutes: 0,
      is_active: true,
    });
  };

  const loadRules = async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/sms/automation/rules`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? t.error);
        setRules([]);
        return;
      }

      setRules((data?.data ?? []) as SmsAutomationRule[]);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitRule = async (e: FormEvent) => {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return;

    setSaving(true);
    setError(null);

    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId
        ? `${API}/sms/automation/rules/${editingId}`
        : `${API}/sms/automation/rules`;

      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }

      resetForm();
      await loadRules();
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (rule: SmsAutomationRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      trigger_event: rule.trigger_event,
      template_text: rule.template_text,
      delay_minutes: rule.delay_minutes,
      is_active: rule.is_active,
    });
  };

  const removeRule = async (id: number) => {
    if (!confirm(t.confirmDelete)) return;

    const token = getStoredToken();
    if (!token) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`${API}/sms/automation/rules/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? t.error);
        return;
      }

      if (editingId === id) resetForm();
      await loadRules();
    } catch {
      setError(t.error);
    } finally {
      setDeletingId(null);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = templateTextareaRef.current;

    if (!textarea) {
      setForm((prev) => ({
        ...prev,
        template_text: prev.template_text ? `${prev.template_text} ${placeholder}` : placeholder,
      }));
      return;
    }

    const start = textarea.selectionStart ?? form.template_text.length;
    const end = textarea.selectionEnd ?? start;
    const before = form.template_text.slice(0, start);
    const after = form.template_text.slice(end);
    const nextText = `${before}${placeholder}${after}`;
    const nextCursor = start + placeholder.length;

    setForm((prev) => ({ ...prev, template_text: nextText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  return (
    <UserShell
      activeKey="sms-automation"
      defaultExpandedKey="sms"
      pageTitle={{ bn: text.bn.pageTitle, en: text.en.pageTitle }}
      pageSubtitle={{ bn: text.bn.pageSubtitle, en: text.en.pageSubtitle }}
    >
      <section className="catv-panel mx-4 mb-4 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {editingId ? t.editTitle : t.createTitle}
          </h2>
          <button
            type="button"
            onClick={() => void loadRules()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
          >
            {t.actions.refresh}
          </button>
        </div>

        <form onSubmit={submitRule} className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.name}</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.trigger}</label>
            <select
              value={form.trigger_event}
              onChange={(e) => setForm((prev) => ({ ...prev, trigger_event: e.target.value as TriggerEvent }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
            >
              {triggerOptions.map((trigger) => (
                <option key={trigger} value={trigger}>
                  {t.triggers[trigger]}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.template}</label>
            <textarea
              ref={templateTextareaRef}
              required
              rows={4}
              value={form.template_text}
              onChange={(e) => setForm((prev) => ({ ...prev, template_text: e.target.value }))}
              placeholder="Hi {customer_name}, order #{order_number} is confirmed."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
            />
            <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t.fields.placeholders}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.fields.placeholderHint}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                  <button
                    key={placeholder}
                    type="button"
                    onClick={() => insertPlaceholder(placeholder)}
                    className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-semibold hover:bg-[var(--surface)]"
                  >
                    {placeholder}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.delay}</label>
            <input
              type="number"
              min={0}
              value={form.delay_minutes}
              onChange={(e) => setForm((prev) => ({ ...prev, delay_minutes: Number(e.target.value || 0) }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
            />
          </div>

          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            {t.fields.active}
          </label>

          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving ? t.saving : editingId ? t.actions.update : t.actions.create}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              >
                {t.actions.cancel}
              </button>
            ) : null}
          </div>
        </form>

        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
      </section>

      <section className="catv-panel mx-4 mb-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">{t.fields.name}</th>
                <th className="px-3 py-2">{t.fields.trigger}</th>
                <th className="px-3 py-2">{t.fields.delay}</th>
                <th className="px-3 py-2">{t.fields.active}</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">{t.loading}</td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">{t.empty}</td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{rule.name}</p>
                      <p className="line-clamp-2 text-xs text-[var(--muted)]">{rule.template_text}</p>
                    </td>
                    <td className="px-3 py-2">{t.triggers[rule.trigger_event]}</td>
                    <td className="px-3 py-2">{rule.delay_minutes}</td>
                    <td className="px-3 py-2">{rule.is_active ? "✅" : "⏸️"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(rule)}
                          className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold"
                        >
                          {t.actions.edit}
                        </button>
                        <button
                          onClick={() => void removeRule(rule.id)}
                          disabled={deletingId === rule.id}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                        >
                          {deletingId === rule.id ? t.deleting : t.actions.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </UserShell>
  );
}
