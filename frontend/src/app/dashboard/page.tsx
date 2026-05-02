"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, getStoredUser, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const text = {
  bn: {
    pageTitle: "বিজনেস ড্যাশবোর্ড",
    pageSubtitle: "আপনার ব্যবসার সম্পূর্ণ চিত্র এক জায়গায়।",
    welcome: "স্বাগতম",
    todayAt: "আজকের সারসংক্ষেপ",
    shortcuts: "দ্রুত অ্যাক্সেস",
    recentOrders: "সাম্প্রতিক অর্ডার",
    viewAll: "সব দেখুন →",
    noOrders: "কোনো অর্ডার নেই",
    orderNo: "অর্ডার নং",
    customer: "গ্রাহক",
    status: "স্ট্যাটাস",
    total: "মোট",
    shortcutItems: [
      { label: "নতুন অর্ডার তৈরি", href: "/dashboard/orders/create", icon: "➕" },
      { label: "ফ্রড চেক করুন", href: "/dashboard/orders/fraud-check", icon: "🔍" },
      { label: "পার্সেল বুক করুন", href: "/dashboard/courier", icon: "🚚" },
      { label: "SMS পাঠান", href: "/dashboard/sms/send", icon: "✉️" },
      { label: "কাস্টমার দেখুন", href: "/dashboard/customers", icon: "👥" },
      { label: "পণ্য ব্যবস্থাপনা", href: "/dashboard/products", icon: "📦" },
    ],
  },
  en: {
    pageTitle: "Business Dashboard",
    pageSubtitle: "Your complete business overview in one place.",
    welcome: "Welcome",
    todayAt: "Today's Summary",
    shortcuts: "Quick Access",
    recentOrders: "Recent Orders",
    viewAll: "View All →",
    noOrders: "No orders yet",
    orderNo: "Order #",
    customer: "Customer",
    status: "Status",
    total: "Total",
    shortcutItems: [
      { label: "Create New Order", href: "/dashboard/orders/create", icon: "➕" },
      { label: "Fraud Check", href: "/dashboard/orders/fraud-check", icon: "🔍" },
      { label: "Book Parcel", href: "/dashboard/courier", icon: "🚚" },
      { label: "Send SMS", href: "/dashboard/sms/send", icon: "✉️" },
      { label: "View Customers", href: "/dashboard/customers", icon: "👥" },
      { label: "Products", href: "/dashboard/products", icon: "📦" },
    ],
  },
};

const STATUS_STYLE: Record<string, string> = {
  pending:    "bg-yellow-500/15 text-yellow-400",
  confirmed:  "bg-blue-500/15 text-blue-400",
  processing: "bg-indigo-500/15 text-indigo-400",
  shipped:    "bg-cyan-500/15 text-cyan-400",
  delivered:  "bg-emerald-500/15 text-emerald-400",
  cancelled:  "bg-red-500/15 text-red-400",
  returned:   "bg-orange-500/15 text-orange-400",
};

type OrderStats = {
  total: number; today: number; pending: number; confirmed: number;
  delivered: number; cancelled: number; returned: number;
  high_risk: number; total_revenue: string;
};
type CustomerStats = { total: number; vip: number; blocked: number };
type ProductStats  = { total: number; low_stock: number; out_of_stock: number };
type RecentOrder   = { id: number; order_number: string; customer_name: string | null; customer_phone: string; status: string; total: string };

export default function UserDashboardPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [userName, setUserName] = useState<string>("");
  const token = getStoredToken();

  const [orderStats,   setOrderStats]   = useState<OrderStats | null>(null);
  const [customerStats,setCustomerStats]= useState<CustomerStats | null>(null);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.name) setUserName(stored.name);
  }, []);

  useEffect(() => {
    const handleStorage = () => setLocale(getStoredLocale());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    void (async () => {
      setLoadingStats(true);
      try {
        const [oRes, cRes, pRes, rRes] = await Promise.all([
          fetch(`${API}/orders/stats`,     { headers }),
          fetch(`${API}/customers/stats`,  { headers }),
          fetch(`${API}/products/stats`,   { headers }),
          fetch(`${API}/orders?per_page=5`, { headers }),
        ]);
        if (oRes.ok) { const d = await oRes.json(); setOrderStats(d.data); }
        if (cRes.ok) { const d = await cRes.json(); setCustomerStats(d.data); }
        if (pRes.ok) { const d = await pRes.json(); setProductStats(d.data); }
        if (rRes.ok) { const d = await rRes.json(); setRecentOrders(d.data ?? []); }
      } finally { setLoadingStats(false); }
    })();
  }, [token]);

  const t = useMemo(() => text[locale], [locale]);

  const fmt = (n: number | string | null | undefined) =>
    n == null ? "—" : Number(n).toLocaleString(locale === "bn" ? "bn-BD" : "en");

  const cards = [
    { label: locale === "bn" ? "আজকের অর্ডার" : "Today's Orders",   value: fmt(orderStats?.today),        hint: locale === "bn" ? "আজ" : "today",            color: "bg-[#0f7c7b]" },
    { label: locale === "bn" ? "মোট অর্ডার" : "Total Orders",        value: fmt(orderStats?.total),        hint: locale === "bn" ? "সর্বমোট" : "all time",    color: "bg-[#2f7ec1]" },
    { label: locale === "bn" ? "পেন্ডিং" : "Pending",                value: fmt(orderStats?.pending),      hint: locale === "bn" ? "অপেক্ষারত" : "awaiting",  color: "bg-[#ff7a59]" },
    { label: locale === "bn" ? "হাই রিস্ক" : "High Risk",            value: fmt(orderStats?.high_risk),    hint: locale === "bn" ? "সন্দেহজনক" : "suspicious", color: "bg-[#c0392b]" },
    { label: locale === "bn" ? "কাস্টমার" : "Customers",             value: fmt(customerStats?.total),     hint: locale === "bn" ? "মোট" : "total",            color: "bg-[#8e44ad]" },
    { label: locale === "bn" ? "মোট রাজস্ব" : "Total Revenue",       value: "৳" + fmt(orderStats?.total_revenue), hint: locale === "bn" ? "ডেলিভারি থেকে" : "from delivered", color: "bg-[#27ae60]" },
  ];

  return (
    <UserShell
      activeKey="dashboard"
      pageTitle={{ bn: text.bn.pageTitle, en: text.en.pageTitle }}
      pageSubtitle={{ bn: text.bn.pageSubtitle, en: text.en.pageSubtitle }}
    >
      {/* Welcome */}
      <section className="catv-panel p-4 sm:p-5">
        <h2 className="text-lg font-bold sm:text-xl">
          {t.welcome}{userName ? `, ${userName}` : ""} 👋
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.pageSubtitle}</p>
      </section>

      {/* Stat cards */}
      <section className="mt-4">
        <h3 className="mb-3 px-1 text-sm font-semibold text-[var(--muted)]">{t.todayAt}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map(card => (
            <article key={card.label} className={`${card.color} rounded-2xl p-4 text-white shadow-md`}>
              <p className="text-xs font-semibold text-white/90">{card.label}</p>
              <p className={`mt-2 text-2xl font-bold ${loadingStats ? "opacity-40" : ""}`}>{card.value}</p>
              <p className="mt-1 text-xs text-white/80">{card.hint}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Product + Customer mini stats */}
      {(productStats || customerStats) && (
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {productStats && [
            { label: locale === "bn" ? "মোট পণ্য" : "Total Products",   value: fmt(productStats.total) },
            { label: locale === "bn" ? "কম স্টক" : "Low Stock",          value: fmt(productStats.low_stock) },
          ].map(s => (
            <div key={s.label} className="catv-panel p-3 text-center">
              <p className="text-xl font-bold text-[var(--accent)]">{s.value}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
          {customerStats && [
            { label: locale === "bn" ? "VIP কাস্টমার" : "VIP Customers",  value: fmt(customerStats.vip) },
            { label: locale === "bn" ? "ব্লক করা" : "Blocked",            value: fmt(customerStats.blocked) },
          ].map(s => (
            <div key={s.label} className="catv-panel p-3 text-center">
              <p className="text-xl font-bold text-[var(--accent)]">{s.value}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </section>
      )}

      {/* Quick shortcuts */}
      <section className="catv-panel mt-4 p-4 sm:p-5">
        <h3 className="mb-3 text-base font-semibold">{t.shortcuts}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {t.shortcutItems.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface)] hover:border-[var(--accent)]">
              <span className="text-lg">{item.icon}</span>
              <span className="leading-tight">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent orders */}
      <section className="catv-panel mt-4 overflow-x-auto">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold">{t.recentOrders}</h3>
          <Link href="/dashboard/orders" className="text-xs text-[var(--accent)] hover:underline">{t.viewAll}</Link>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--muted)] uppercase">
              <th className="px-4 py-2">{t.orderNo}</th>
              <th className="px-4 py-2 hidden md:table-cell">{t.customer}</th>
              <th className="px-4 py-2">{t.status}</th>
              <th className="px-4 py-2 text-right">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--muted)]">{t.noOrders}</td></tr>
            ) : recentOrders.map(o => (
              <tr key={o.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-2.5">
                  <Link href={`/dashboard/orders/${o.id}`} className="font-mono font-semibold text-[var(--accent)] hover:underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="px-4 py-2.5 hidden md:table-cell">
                  <p className="font-medium">{o.customer_name ?? "—"}</p>
                  <p className="text-[var(--muted)]">{o.customer_phone}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[o.status] ?? ""}`}>{o.status}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold">৳{Number(o.total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </UserShell>
  );
}
