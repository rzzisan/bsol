"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

type TriggerEvent = "order_confirmed" | "order_shipped" | "order_delivered" | "order_cancelled";

interface WhatsappAutomationRule {
  id: number;
  name: string;
  trigger_event: TriggerEvent;
  template_name: string;
  language_code: string;
  variable_mapping: string[] | null;
  delay_minutes: number;
  is_active: boolean;
}

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const VARIABLE_KEYS = ["customer_name", "order_number", "total", "courier", "tracking_id", "shop_name", "delivery_date"];

const text = {
  bn: {
    pageTitle: "হোয়াটসঅ্যাপ অটোমেশন",
    pageSubtitle: "অর্ডারের নির্দিষ্ট event-এ Meta-approved WhatsApp টেমপ্লেট অটো-পাঠাতে rule তৈরি করুন।",
    notice: "টেমপ্লেট এখানে বানানো যায় না — সেলারকে নিজে Meta WhatsApp Manager-এ টেমপ্লেট বানিয়ে অ্যাপ্রুভ করাতে হবে, এখানে শুধু নাম রেফারেন্স করা হয়।",
    createTitle: "নতুন Rule তৈরি করুন",
    editTitle: "Rule আপডেট করুন",
    fields: {
      name: "Rule নাম",
      trigger: "Trigger Event",
      templateName: "Meta-approved Template Name",
      languageCode: "Language Code",
      variableMapping: "Variable Mapping (কমা দিয়ে, {{1}},{{2}}... ক্রমে)",
      variableHint: "ব্যবহারযোগ্য: ",
      delay: "Delay (মিনিট)",
      active: "Active",
    },
    actions: { create: "Rule তৈরি করুন", update: "Rule আপডেট", cancel: "বাতিল", edit: "এডিট", delete: "ডিলিট", refresh: "রিফ্রেশ" },
    empty: "কোনো automation rule পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    saving: "সেভ হচ্ছে...",
    deleting: "ডিলিট হচ্ছে...",
    error: "রিকোয়েস্ট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
    confirmDelete: "এই rule টি ডিলিট করতে চান?",
    triggers: { order_confirmed: "Order Confirmed", order_shipped: "Order Shipped", order_delivered: "Order Delivered", order_cancelled: "Order Cancelled" },
  },
  en: {
    pageTitle: "WhatsApp Automation",
    pageSubtitle: "Create rules to auto-send a Meta-approved WhatsApp template on specific order events.",
    notice: "Templates can't be created here — the seller must create and get it approved in Meta WhatsApp Manager themselves; this only references the template name.",
    createTitle: "Create New Rule",
    editTitle: "Update Rule",
    fields: {
      name: "Rule Name",
      trigger: "Trigger Event",
      templateName: "Meta-approved Template Name",
      languageCode: "Language Code",
      variableMapping: "Variable Mapping (comma-separated, order matches {{1}},{{2}}...)",
      variableHint: "Available: ",
      delay: "Delay (minutes)",
      active: "Active",
    },
    actions: { create: "Create Rule", update: "Update Rule", cancel: "Cancel", edit: "Edit", delete: "Delete", refresh: "Refresh" },
    empty: "No automation rules found.",
    loading: "Loading...",
    saving: "Saving...",
    deleting: "Deleting...",
    error: "Request failed. Please try again.",
    confirmDelete: "Are you sure to delete this rule?",
    triggers: { order_confirmed: "Order Confirmed", order_shipped: "Order Shipped", order_delivered: "Order Delivered", order_cancelled: "Order Cancelled" },
  },
};

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);
  const t = useMemo(() => text[locale], [locale]);

  const [rules, setRules] = useState<WhatsappAutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    trigger_event: "order_confirmed" as TriggerEvent,
    template_name: "",
    language_code: "en_US",
    variable_mapping_text: "",
    delay_minutes: 0,
    is_active: true,
  });

  const triggerOptions: TriggerEvent[] = ["order_confirmed", "order_shipped", "order_delivered", "order_cancelled"];

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", trigger_event: "order_confirmed", template_name: "", language_code: "en_US", variable_mapping_text: "", delay_minutes: 0, is_active: true });
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
      const res = await fetch(`${API}/whatsapp/automation/rules`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.error);
        setRules([]);
        return;
      }
      setRules((data?.data ?? []) as WhatsappAutomationRule[]);
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
      const url = editingId ? `${API}/whatsapp/automation/rules/${editingId}` : `${API}/whatsapp/automation/rules`;
      const variable_mapping = form.variable_mapping_text.split(",").map((s) => s.trim()).filter(Boolean);

      const res = await fetch(url, {
        method,
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          trigger_event: form.trigger_event,
          template_name: form.template_name,
          language_code: form.language_code,
          variable_mapping,
          delay_minutes: form.delay_minutes,
          is_active: form.is_active,
        }),
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

  const startEdit = (rule: WhatsappAutomationRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      trigger_event: rule.trigger_event,
      template_name: rule.template_name,
      language_code: rule.language_code || "en_US",
      variable_mapping_text: (rule.variable_mapping ?? []).join(", "),
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
      const res = await fetch(`${API}/whatsapp/automation/rules/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
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

  return (
    <UserShell
      activeKey="whatsapp-automation"
      defaultExpandedKey="sms"
      pageTitle={{ bn: text.bn.pageTitle, en: text.en.pageTitle }}
      pageSubtitle={{ bn: text.bn.pageSubtitle, en: text.en.pageSubtitle }}
    >
      <section className="catv-panel mx-4 mb-4 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">{editingId ? t.editTitle : t.createTitle}</h2>
          <button type="button" onClick={() => void loadRules()} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold">
            {t.actions.refresh}
          </button>
        </div>
        <p className="mb-4 text-xs text-amber-600">{t.notice}</p>

        <form onSubmit={submitRule} className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.name}</label>
            <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.trigger}</label>
            <select value={form.trigger_event} onChange={(e) => setForm((p) => ({ ...p, trigger_event: e.target.value as TriggerEvent }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none">
              {triggerOptions.map((tr) => (
                <option key={tr} value={tr}>{t.triggers[tr]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.templateName}</label>
            <input required value={form.template_name} onChange={(e) => setForm((p) => ({ ...p, template_name: e.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.languageCode}</label>
            <input required value={form.language_code} onChange={(e) => setForm((p) => ({ ...p, language_code: e.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.variableMapping}</label>
            <input
              placeholder="customer_name, order_number, total"
              value={form.variable_mapping_text}
              onChange={(e) => setForm((p) => ({ ...p, variable_mapping_text: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.fields.variableHint}{VARIABLE_KEYS.join(", ")}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.fields.delay}</label>
            <input type="number" min={0} value={form.delay_minutes} onChange={(e) => setForm((p) => ({ ...p, delay_minutes: Number(e.target.value || 0) }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
            {t.fields.active}
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70">
              {saving ? t.saving : editingId ? t.actions.update : t.actions.create}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">
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
                <th className="px-3 py-2">{t.fields.templateName}</th>
                <th className="px-3 py-2">{t.fields.active}</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">{t.loading}</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">{t.empty}</td></tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2 font-semibold">{rule.name}</td>
                    <td className="px-3 py-2">{t.triggers[rule.trigger_event]}</td>
                    <td className="px-3 py-2 font-mono text-xs">{rule.template_name}</td>
                    <td className="px-3 py-2">{rule.is_active ? "✅" : "⏸️"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(rule)} className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold">{t.actions.edit}</button>
                        <button onClick={() => void removeRule(rule.id)} disabled={deletingId === rule.id} className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-60">
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
