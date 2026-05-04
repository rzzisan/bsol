"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import {
  getStoredLocale,
  getStoredToken,
  type Locale,
} from "@/lib/dashboard-client";

interface SmsHistoryRow {
  id: number;
  gateway_name: string | null;
  provider: string | null;
  phone_number: string;
  message: string;
  status: "sent" | "failed";
  http_status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string | null;
}

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const text = {
  bn: {
    title: "ইউজার ড্যাশবোর্ড",
    subtitle: "আপনার নিজের SMS send history দেখুন ও ট্র্যাক করুন।",
    loginRequired: "ড্যাশবোর্ড দেখতে হলে আগে লগইন করুন।",
    accessDenied: "এই পেজটি সাধারণ ইউজারদের জন্য।",
    goHome: "হোমে যান",
    menuDashboard: "ড্যাশবোর্ড",
    menuOrders: "My Orders",
    menuCourier: "Courier Tracking",
    menuBilling: "Billing & Subscription",
    menuProfile: "Profile Settings",
    menuSms: "এসএমএস",
    menuSmsSend: "SMS পাঠান",
    menuSmsHistory: "SMS হিস্টোরি",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    filters: {
      search: "সার্চ",
      status: "স্ট্যাটাস",
      all: "সব",
      sent: "সফল",
      failed: "ব্যর্থ",
      reload: "রিলোড",
      loading: "লোড হচ্ছে...",
    },
    table: {
      id: "ID",
      gateway: "গেটওয়ে",
      phone: "ফোন",
      message: "মেসেজ",
      status: "স্ট্যাটাস",
      code: "HTTP",
      response: "Response / Error",
      date: "তারিখ",
    },
    empty: "কোনো SMS history নেই।",
    prev: "আগের",
    next: "পরের",
  },
  en: {
    title: "User Dashboard",
    subtitle: "View and track your own SMS send history.",
    loginRequired: "Please login first to access the dashboard.",
    accessDenied: "This page is available for regular users only.",
    goHome: "Go Home",
    menuDashboard: "Dashboard",
    menuOrders: "My Orders",
    menuCourier: "Courier Tracking",
    menuBilling: "Billing & Subscription",
    menuProfile: "Profile Settings",
    menuSms: "SMS",
    menuSmsSend: "Send SMS",
    menuSmsHistory: "SMS History",
    languageLabel: "Language",
    themeLabel: "Theme",
    filters: {
      search: "Search",
      status: "Status",
      all: "All",
      sent: "Sent",
      failed: "Failed",
      reload: "Reload",
      loading: "Loading...",
    },
    table: {
      id: "ID",
      gateway: "Gateway",
      phone: "Phone",
      message: "Message",
      status: "Status",
      code: "HTTP",
      response: "Response / Error",
      date: "Date",
    },
    empty: "No SMS history found.",
    prev: "Previous",
    next: "Next",
  },
};

export default function UserSmsHistoryPage() {
  const [locale] = useState<Locale>(getStoredLocale);

  const [rows, setRows] = useState<SmsHistoryRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed">("all");
  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  const t = useMemo(() => text[locale], [locale]);

  async function loadHistory(page = 1) {
    const token = getStoredToken();
    if (!token) return;

    setLoadingRows(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "20");
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);

    try {
      const res = await fetch(`${API_BASE_URL}/sms/history?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Failed to load SMS history.");
        setRows([]);
        return;
      }

      setRows((data?.histories ?? []) as SmsHistoryRow[]);
      setMeta(
        (data?.meta as PaginationMeta | undefined) ?? {
          current_page: 1,
          last_page: 1,
          per_page: 20,
          total: 0,
        },
      );
    } catch {
      setError("Network error. Please try again.");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    void loadHistory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserShell
      activeKey="sms-history"
      defaultExpandedKey="sms"
      pageTitle={{ bn: "SMS হিস্টোরি", en: "SMS History" }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      <section className="catv-panel mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.filters.search}</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="017..., message..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">{t.filters.status}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "sent" | "failed")}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
            >
              <option value="all">{t.filters.all}</option>
              <option value="sent">{t.filters.sent}</option>
              <option value="failed">{t.filters.failed}</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadHistory(1)}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              disabled={loadingRows}
            >
              {loadingRows ? t.filters.loading : t.filters.reload}
            </button>
          </div>
        </div>
      </section>

      <div className="catv-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.id}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.gateway}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.phone}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.message}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.status}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.code}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.response}</th>
                <th className="border border-[#d7e1ee] px-3 py-2 text-left font-semibold">{t.table.date}</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr>
                  <td colSpan={8} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.filters.loading}
                  </td>
                </tr>
              )}

              {!loadingRows && error && (
                <tr>
                  <td colSpan={8} className="border border-[#e5ebf5] px-4 py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}

              {!loadingRows && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="border border-[#e5ebf5] px-4 py-6 text-center text-[var(--muted)]">
                    {t.empty}
                  </td>
                </tr>
              )}

              {!loadingRows &&
                !error &&
                rows.map((row) => (
                  <tr key={row.id} className="bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]">
                    <td className="border border-[#e5ebf5] px-3 py-2">{row.id}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {row.gateway_name ? `${row.gateway_name} (${row.provider ?? "-"})` : "-"}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">{row.phone_number}</td>
                    <td className="border border-[#e5ebf5] px-3 py-2 max-w-[280px] truncate" title={row.message}>
                      {row.message}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          row.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">{row.http_status_code ?? "-"}</td>
                    <td
                      className="border border-[#e5ebf5] px-3 py-2 max-w-[320px] truncate"
                      title={row.error_message ?? row.response_body ?? "-"}
                    >
                      {row.error_message ?? row.response_body ?? "-"}
                    </td>
                    <td className="border border-[#e5ebf5] px-3 py-2">
                      {new Date(row.created_at ?? row.sent_at ?? "").toLocaleString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-sm">
          <span className="text-[var(--muted)]">
            Page {meta.current_page} / {meta.last_page} • Total {meta.total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadHistory(Math.max(1, meta.current_page - 1))}
              disabled={loadingRows || meta.current_page <= 1}
              className="rounded-lg border border-[var(--border)] px-3 py-1 font-medium disabled:opacity-50"
            >
              {t.prev}
            </button>
            <button
              type="button"
              onClick={() => void loadHistory(Math.min(meta.last_page, meta.current_page + 1))}
              disabled={loadingRows || meta.current_page >= meta.last_page}
              className="rounded-lg border border-[var(--border)] px-3 py-1 font-medium disabled:opacity-50"
            >
              {t.next}
            </button>
          </div>
        </div>
      </div>
    </UserShell>
  );
}
