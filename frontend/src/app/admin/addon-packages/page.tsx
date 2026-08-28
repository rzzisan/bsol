"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

/**
 * Super-admin add-on package CRUD + purchase approve queue —
 * subscription_billing_context.md §9.4. Mirrors /admin/packages (create
 * form + list) and the SMS-credit "Purchase Requests" pending queue,
 * combined onto one page since add-on management is a smaller surface.
 */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

interface AddonPackageRow {
  id: number;
  type: string;
  name: string;
  price: string;
  quantity: number | null;
  duration_days: number | null;
  is_active: boolean;
}

interface PurchaseRow {
  id: number;
  amount: string;
  status: "pending" | "approved" | "rejected";
  trx_id: string | null;
  sender_bkash_number: string | null;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
  addon_package: { name: string } | null;
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";

export default function AdminAddonPackagesPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  const [packages, setPackages] = useState<AddonPackageRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [form, setForm] = useState({ type: "order_credit", name: "", price: "", quantity: "", duration_days: "30" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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

  const menu = useMemo(
    () =>
      buildAdminMenu(locale),
    [locale],
  );

  const authHeaders = () => ({ Authorization: `Bearer ${getStoredToken()}`, Accept: "application/json" });

  const loadPackages = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/admin/addon-packages`, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok) setPackages(data.packages ?? []);
  }, []);

  const loadPurchases = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/admin/addon-purchases?status=pending&per_page=50`, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok) setPurchases(data.data ?? []);
  }, []);

  useEffect(() => {
    if (state === "ready") {
      void loadPackages();
      void loadPurchases();
    }
  }, [state, loadPackages, loadPurchases]);

  const createPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const needsQuantityAndDuration = form.type === "order_credit";
    if (!form.name.trim() || !form.price || (needsQuantityAndDuration && (!form.quantity || !form.duration_days))) {
      setMessage({ type: "err", text: locale === "bn" ? "সব ফিল্ড পূরণ করুন।" : "Fill all fields." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/addon-packages`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          name: form.name.trim(),
          price: Number(form.price),
          quantity: needsQuantityAndDuration ? Number(form.quantity) : null,
          duration_days: needsQuantityAndDuration ? Number(form.duration_days) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.message ?? (locale === "bn" ? "তৈরি করা যায়নি।" : "Failed to create.") });
        return;
      }
      setMessage({ type: "ok", text: locale === "bn" ? "প্যাকেজ তৈরি হয়েছে।" : "Package created." });
      setForm({ type: "order_credit", name: "", price: "", quantity: "", duration_days: "30" });
      void loadPackages();
    } finally {
      setSubmitting(false);
    }
  };

  const deletePackage = async (id: number) => {
    await fetch(`${API_BASE_URL}/admin/addon-packages/${id}`, { method: "DELETE", headers: authHeaders() });
    void loadPackages();
  };

  const approvePurchase = async (id: number) => {
    await fetch(`${API_BASE_URL}/admin/addon-purchases/${id}/approve`, { method: "POST", headers: authHeaders() });
    void loadPurchases();
  };

  const rejectPurchase = async (id: number) => {
    await fetch(`${API_BASE_URL}/admin/addon-purchases/${id}/reject`, { method: "POST", headers: authHeaders() });
    void loadPurchases();
  };

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Add-on Packages</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {state === "forbidden" ? "Only admin users can view this page." : "Please login as admin."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <CatvShell
      title={locale === "bn" ? "অ্যাড-অন প্যাকেজ" : "Add-on Packages"}
      subtitle={locale === "bn" ? "অর্ডার-ক্রেডিট Add-on প্যাকেজ তৈরি ও ক্রয়-অনুমোদন" : "Order-credit add-on packages and purchase approvals"}
      locale={locale}
      theme={theme}
      localeLabel="Language"
      themeLabel="Theme"
      sidebarTitle="Admin Panel"
      userName="Add-on Packages"
      userMeta="Admin Dashboard"
      menu={menu}
      activeKey="addon-packages"
      defaultExpandedKey="customers"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel mb-5 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          {locale === "bn" ? "নতুন অ্যাড-অন প্যাকেজ" : "New add-on package"}
        </h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={createPackage}>
          <div className="md:col-span-2">
            <label className={labelCls}>{locale === "bn" ? "টাইপ" : "Type"}</label>
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="order_credit">{locale === "bn" ? "অর্ডার ক্রেডিট" : "Order credit"}</option>
              <option value="storefront">{locale === "bn" ? "স্টোরফ্রন্ট আনলক" : "Storefront unlock"}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{locale === "bn" ? "নাম" : "Name"}</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={form.type === "storefront" ? "Unlock Storefront" : "50 Orders / 1 Month"}
            />
          </div>
          <div>
            <label className={labelCls}>{locale === "bn" ? "দাম (৳)" : "Price (BDT)"}</label>
            <input
              type="number" min={0} step="0.01"
              className={inputCls}
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
            />
          </div>
          {form.type === "order_credit" && (
            <>
              <div>
                <label className={labelCls}>{locale === "bn" ? "অর্ডার সংখ্যা" : "Order quantity"}</label>
                <input
                  type="number" min={1}
                  className={inputCls}
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>{locale === "bn" ? "মেয়াদ (দিন)" : "Validity (days)"}</label>
                <input
                  type="number" min={1}
                  className={inputCls}
                  value={form.duration_days}
                  onChange={(e) => setForm((p) => ({ ...p, duration_days: e.target.value }))}
                />
              </div>
            </>
          )}
          {form.type === "storefront" && (
            <p className="text-xs text-[var(--muted)] md:col-span-2">
              {locale === "bn"
                ? "স্টোরফ্রন্ট আনলক মেইন সাবস্ক্রিপশনের মেয়াদ অনুযায়ী চলবে — আলাদা মেয়াদ/পরিমাণ লাগে না।"
                : "Storefront unlock runs co-terminous with the main subscription — no separate quantity/validity needed."}
            </p>
          )}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? (locale === "bn" ? "তৈরি হচ্ছে..." : "Creating...") : (locale === "bn" ? "তৈরি করুন" : "Create")}
            </button>
          </div>
        </form>
        {message && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </p>
        )}
      </section>

      <section className="catv-panel mb-5 overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">{locale === "bn" ? "প্যাকেজ তালিকা" : "Package list"}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[var(--accent)] text-white">
              <tr>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">Name</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">Orders</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">Days</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">Price</th>
                <th className="border border-[var(--border)] px-3 py-2 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id}>
                  <td className="border border-[var(--border)] px-3 py-2">{p.name} <span className="text-xs text-[var(--muted)]">({p.type})</span></td>
                  <td className="border border-[var(--border)] px-3 py-2 text-right">{p.quantity ?? "—"}</td>
                  <td className="border border-[var(--border)] px-3 py-2 text-right">{p.duration_days ?? "—"}</td>
                  <td className="border border-[var(--border)] px-3 py-2 text-right">৳{p.price}</td>
                  <td className="border border-[var(--border)] px-3 py-2 text-center">
                    <button
                      onClick={() => void deletePackage(p.id)}
                      className="rounded px-2 py-1 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      {locale === "bn" ? "মুছুন" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-[var(--border)] px-4 py-6 text-center text-[var(--muted)]">
                    {locale === "bn" ? "কোনো প্যাকেজ নেই।" : "No packages yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="catv-panel overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {locale === "bn" ? "পেন্ডিং ক্রয় অনুরোধ" : "Pending purchase requests"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[var(--accent)] text-white">
              <tr>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">Seller</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">Package</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">TrxID</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">Amount</th>
                <th className="border border-[var(--border)] px-3 py-2 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td className="border border-[var(--border)] px-3 py-2">{p.user?.name ?? "—"}</td>
                  <td className="border border-[var(--border)] px-3 py-2">{p.addon_package?.name ?? "—"}</td>
                  <td className="border border-[var(--border)] px-3 py-2 font-mono text-xs">{p.trx_id}</td>
                  <td className="border border-[var(--border)] px-3 py-2 text-right">৳{p.amount}</td>
                  <td className="border border-[var(--border)] px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => void approvePurchase(p.id)}
                        className="rounded px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        {locale === "bn" ? "অনুমোদন" : "Approve"}
                      </button>
                      <button
                        onClick={() => void rejectPurchase(p.id)}
                        className="rounded px-2 py-1 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        {locale === "bn" ? "প্রত্যাখ্যান" : "Reject"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-[var(--border)] px-4 py-6 text-center text-[var(--muted)]">
                    {locale === "bn" ? "কোনো পেন্ডিং অনুরোধ নেই।" : "No pending requests."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </CatvShell>
  );
}
