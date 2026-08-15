"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CatvShell from "@/components/catv-shell";
import { buildAdminMenu } from "@/lib/admin-menu";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  normalizeRole,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");
const APEX = process.env.NEXT_PUBLIC_SUBDOMAIN_APEX ?? "zyrotechbd.com";

const t = {
  bn: {
    title: "সংরক্ষিত সাবডোমেইন",
    intro: `এই নামগুলো কোনো সেলার নিজের শপের ঠিকানা হিসেবে নিতে পারবে না। ${APEX}-এ নতুন DNS রেকর্ড যোগ করলে সেই নামটাও এখানে যোগ করুন, নইলে কোনো সেলার সেটা দাবি করে চালু সার্ভিস দখল করে ফেলতে পারে।`,
    addLabel: "নতুন নাম সংরক্ষণ করুন",
    placeholder: "যেমন: newbrand",
    reason: "কারণ (ঐচ্ছিক)",
    reasonPlaceholder: "কেন সংরক্ষিত",
    add: "যোগ করুন",
    adding: "যোগ হচ্ছে...",
    search: "খুঁজুন",
    label: "নাম",
    reasonCol: "কারণ",
    type: "ধরন",
    action: "",
    system: "সুরক্ষিত",
    custom: "কাস্টম",
    remove: "সরান",
    removing: "সরছে...",
    systemHint: "এই নামটি চালু সার্ভিসের দিকে যায় — সরানো যাবে না।",
    removeConfirm: "'{label}' সরালে যেকোনো সেলার এটি নিতে পারবে। নিশ্চিত?",
    empty: "কিছু পাওয়া যায়নি।",
    loading: "লোড হচ্ছে...",
    total: "মোট",
  },
  en: {
    title: "Reserved Subdomains",
    intro: `Sellers cannot claim these as their shop address. When you add a DNS record to ${APEX}, add that name here too — otherwise a seller could claim it and take over a live service.`,
    addLabel: "Reserve a new name",
    placeholder: "e.g. newbrand",
    reason: "Reason (optional)",
    reasonPlaceholder: "Why it's reserved",
    add: "Add",
    adding: "Adding...",
    search: "Search",
    label: "Name",
    reasonCol: "Reason",
    type: "Type",
    action: "",
    system: "Protected",
    custom: "Custom",
    remove: "Remove",
    removing: "Removing...",
    systemHint: "This name points at a live service and cannot be released.",
    removeConfirm: "Releasing '{label}' lets any seller claim it. Continue?",
    empty: "Nothing found.",
    loading: "Loading...",
    total: "Total",
  },
};

type Row = {
  id: number;
  label: string;
  reason: string | null;
  is_system: boolean;
};

const MENU_LABELS = {
  bn: {
    dashboard: "ড্যাশবোর্ড", customers: "গ্রাহক", activeCustomers: "অ্যাকটিভ গ্রাহক",
    pendingCustomers: "পেন্ডিং গ্রাহক", sms: "এসএমএস", smsGateway: "এসএমএস গেটওয়ে",
    smsSend: "এসএমএস সেন্ড", smsHistory: "এসএমএস হিস্টোরি", smsCredit: "এসএমএস ক্রেডিট",
    packages: "প্যাকেজ", billing: "বিলিং", reports: "রিপোর্ট", settings: "সেটিংস",
    emailSettings: "ইমেইল সেটিংস", reservedSubdomains: "সংরক্ষিত সাবডোমেইন",
  },
  en: {
    dashboard: "Dashboard", customers: "Customers", activeCustomers: "Active Customers",
    pendingCustomers: "Pending Customers", sms: "SMS", smsGateway: "SMS Gateway",
    smsSend: "Send SMS", smsHistory: "SMS History", smsCredit: "SMS Credit",
    packages: "Packages", billing: "Billing", reports: "Reports", settings: "Settings",
    emailSettings: "Email Settings", reservedSubdomains: "Reserved Subdomains",
  },
};

export default function ReservedSubdomainsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = getStoredUser();
    return stored && normalizeRole(stored) === "admin" ? stored : null;
  });
  const txt = t[locale];
  const menus = useMemo(() => buildAdminMenu(MENU_LABELS[locale]), [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/reserved-subdomains`, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      const d = await res.json();
      if (res.ok) setRows(d.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const add = async () => {
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/admin/reserved-subdomains`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
        body: JSON.stringify({ label: newLabel.trim(), reason: newReason.trim() || null }),
      });
      const d = await res.json();
      if (res.ok) {
        setNewLabel("");
        setNewReason("");
        await load();
      } else {
        setMsg({ ok: false, text: d.message ?? "Failed." });
      }
    } finally {
      setAdding(false);
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(txt.removeConfirm.replace("{label}", row.label))) return;
    setRemovingId(row.id);
    setMsg(null);
    try {
      const res = await fetch(`${API}/admin/reserved-subdomains/${row.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      if (res.ok) {
        await load();
      } else {
        const d = await res.json();
        setMsg({ ok: false, text: d.message ?? "Failed." });
      }
    } finally {
      setRemovingId(null);
    }
  };

  const visible = query.trim()
    ? rows.filter(
        (r) =>
          r.label.includes(query.trim().toLowerCase()) ||
          (r.reason ?? "").toLowerCase().includes(query.trim().toLowerCase()),
      )
    : rows;

  return (
    <CatvShell
      title={txt.title}
      subtitle={txt.intro}
      locale={locale}
      theme={theme}
      localeLabel={locale === "bn" ? "ভাষা" : "Language"}
      themeLabel={locale === "bn" ? "থিম" : "Theme"}
      sidebarTitle={locale === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}
      searchPlaceholder={locale === "bn" ? "সার্চ করুন" : "Search"}
      userName={user?.name}
      userMeta={user?.email}
      menu={menus}
      activeKey="settings-reserved-subdomains"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <div className="catv-panel m-4 max-w-4xl p-5 sm:m-5">
        <p className="mb-5 text-sm text-[var(--muted)]">{txt.intro}</p>

        {msg && (
          <div className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            {msg.text}
          </div>
        )}

        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">{txt.addLabel}</span>
            <div className="flex items-center gap-1">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder={txt.placeholder}
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <span className="shrink-0 text-xs text-[var(--muted)]">.{APEX}</span>
            </div>
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">{txt.reason}</span>
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder={txt.reasonPlaceholder}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <button
            type="button"
            onClick={() => void add()}
            disabled={adding || newLabel.trim().length === 0}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {adding ? txt.adding : txt.add}
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={txt.search}
            className="w-56 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <span className="text-xs text-[var(--muted)]">
            {txt.total}: {visible.length}
          </span>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">{txt.loading}</p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">{txt.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)]">
                  <th className="px-3 py-2">{txt.label}</th>
                  <th className="px-3 py-2">{txt.reasonCol}</th>
                  <th className="px-3 py-2">{txt.type}</th>
                  <th className="px-3 py-2 text-right">{txt.action}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2 text-xs text-[var(--muted)]">{row.reason ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_system ? "bg-amber-500/15 text-amber-500" : "bg-slate-500/15 text-[var(--muted)]"}`}
                      >
                        {row.is_system ? txt.system : txt.custom}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.is_system ? (
                        <span className="text-xs text-[var(--muted)]" title={txt.systemHint}>
                          —
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void remove(row)}
                          disabled={removingId === row.id}
                          className="rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                        >
                          {removingId === row.id ? txt.removing : txt.remove}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CatvShell>
  );
}
