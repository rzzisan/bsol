"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredUser, type Locale } from "@/lib/dashboard-client";

const text = {
  bn: {
    pageTitle: "বিজনেস ড্যাশবোর্ড",
    pageSubtitle: "আপনার ব্যবসার সম্পূর্ণ চিত্র এক জায়গায়।",
    welcome: "স্বাগতম",
    todayAt: "আজকের সারসংক্ষেপ",
    cards: [
      { label: "মোট অর্ডার", value: "—", hint: "আজ পর্যন্ত", color: "bg-[#0f7c7b]" },
      { label: "ডেলিভার্ড", value: "—", hint: "এ মাসে সম্পন্ন", color: "bg-[#2f7ec1]" },
      { label: "পেন্ডিং", value: "—", hint: "প্রক্রিয়াধীন", color: "bg-[#ff7a59]" },
      { label: "হাই রিস্ক", value: "—", hint: "সন্দেহজনক অর্ডার", color: "bg-[#c0392b]" },
      { label: "কাস্টমার", value: "—", hint: "মোট নিবন্ধিত", color: "bg-[#8e44ad]" },
      { label: "পণ্য", value: "—", hint: "সক্রিয় পণ্য", color: "bg-[#d35400]" },
    ],
    shortcuts: "দ্রুত অ্যাক্সেস",
    shortcutItems: [
      { label: "নতুন অর্ডার তৈরি", href: "/dashboard/orders/create", icon: "➕" },
      { label: "ফ্রড চেক করুন", href: "/dashboard/orders/fraud-check", icon: "🔍" },
      { label: "পার্সেল বুক করুন", href: "/dashboard/courier", icon: "🚚" },
      { label: "SMS পাঠান", href: "/dashboard/sms/send", icon: "✉️" },
      { label: "কাস্টমার দেখুন", href: "/dashboard/customers", icon: "👥" },
      { label: "সেলস রিপোর্ট", href: "/dashboard/analytics/sales", icon: "📊" },
    ],
  },
  en: {
    pageTitle: "Business Dashboard",
    pageSubtitle: "Your complete business overview in one place.",
    welcome: "Welcome",
    todayAt: "Today's Summary",
    cards: [
      { label: "Total Orders", value: "—", hint: "all time", color: "bg-[#0f7c7b]" },
      { label: "Delivered", value: "—", hint: "completed this month", color: "bg-[#2f7ec1]" },
      { label: "Pending", value: "—", hint: "in progress", color: "bg-[#ff7a59]" },
      { label: "High Risk", value: "—", hint: "suspicious orders", color: "bg-[#c0392b]" },
      { label: "Customers", value: "—", hint: "total registered", color: "bg-[#8e44ad]" },
      { label: "Products", value: "—", hint: "active products", color: "bg-[#d35400]" },
    ],
    shortcuts: "Quick Access",
    shortcutItems: [
      { label: "Create New Order", href: "/dashboard/orders/create", icon: "➕" },
      { label: "Fraud Check", href: "/dashboard/orders/fraud-check", icon: "🔍" },
      { label: "Book Parcel", href: "/dashboard/courier", icon: "🚚" },
      { label: "Send SMS", href: "/dashboard/sms/send", icon: "✉️" },
      { label: "View Customers", href: "/dashboard/customers", icon: "👥" },
      { label: "Sales Report", href: "/dashboard/analytics/sales", icon: "📊" },
    ],
  },
};

export default function UserDashboardPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.name) setUserName(stored.name);
  }, []);

  useEffect(() => {
    const handleStorage = () => setLocale(getStoredLocale());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const t = useMemo(() => text[locale], [locale]);

  return (
    <UserShell
      activeKey="dashboard"
      pageTitle={{ bn: text.bn.pageTitle, en: text.en.pageTitle }}
      pageSubtitle={{ bn: text.bn.pageSubtitle, en: text.en.pageSubtitle }}
    >
      <section className="catv-panel p-4 sm:p-5">
        <h2 className="text-lg font-bold sm:text-xl">
          {t.welcome}{userName ? `, ${userName}` : ""} 👋
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.pageSubtitle}</p>
      </section>

      <section className="mt-4">
        <h3 className="mb-3 px-1 text-sm font-semibold text-[var(--muted)]">{t.todayAt}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {t.cards.map((card) => (
            <article
              key={card.label}
              className={`${card.color} rounded-2xl p-4 text-white shadow-md`}
            >
              <p className="text-xs font-semibold text-white/90">{card.label}</p>
              <p className="mt-2 text-2xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs text-white/80">{card.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="catv-panel mt-4 p-4 sm:p-5">
        <h3 className="mb-3 text-base font-semibold">{t.shortcuts}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {t.shortcutItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface)] hover:border-[var(--accent)]"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="leading-tight">{item.label}</span>
            </a>
          ))}
        </div>
      </section>
    </UserShell>
  );
}
