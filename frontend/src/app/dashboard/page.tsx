"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CatvShell, { type ShellMenuItem } from "@/components/catv-shell";
import EmailVerificationBanner from "@/components/email-verification-banner";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  LOCALE_STORAGE_KEY,
  normalizeRole,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

const text = {
  bn: {
    title: "ইউজার ড্যাশবোর্ড",
    subtitle: "আপনার অর্ডার, সাবস্ক্রিপশন এবং অ্যাকাউন্ট অ্যাক্টিভিটি এক জায়গায়।",
    loginRequired: "ড্যাশবোর্ড দেখতে হলে আগে লগইন করুন।",
    accessDenied: "এই পেজটি সাধারণ ইউজারদের জন্য।",
    goHome: "হোমে যান",
    quickActions: "Quick Actions",
    menuDashboard: "ড্যাশবোর্ড",
    menuOrders: "My Orders",
    menuCourier: "Courier Tracking",
    menuBilling: "Billing & Subscription",
    menuProfile: "Profile Settings",
    menuSms: "এসএমএস",
    menuSmsSend: "SMS পাঠান",
    menuSmsHistory: "SMS হিস্টোরি",
    cards: [
      { label: "চলমান অর্ডার", value: "0", hint: "আজকের active order" },
      { label: "ডেলিভার্ড", value: "0", hint: "এ মাসে complete" },
      { label: "সাবস্ক্রিপশন", value: "Starter", hint: "বর্তমান প্ল্যান" },
    ],
    modules: [
      "My Orders",
      "Courier Tracking",
      "Billing & Subscription",
      "Profile Settings",
    ],
    languageLabel: "ভাষা",
    themeLabel: "থিম",
  },
  en: {
    title: "User Dashboard",
    subtitle: "Your orders, subscription, and account activities in one place.",
    loginRequired: "Please login first to access the dashboard.",
    accessDenied: "This page is available for regular users only.",
    goHome: "Go Home",
    quickActions: "Quick Actions",
    menuDashboard: "Dashboard",
    menuOrders: "My Orders",
    menuCourier: "Courier Tracking",
    menuBilling: "Billing & Subscription",
    menuProfile: "Profile Settings",
    menuSms: "SMS",
    menuSmsSend: "Send SMS",
    menuSmsHistory: "SMS History",
    cards: [
      { label: "Active Orders", value: "0", hint: "today's active orders" },
      { label: "Delivered", value: "0", hint: "completed this month" },
      { label: "Subscription", value: "Starter", hint: "current package" },
    ],
    modules: [
      "My Orders",
      "Courier Tracking",
      "Billing & Subscription",
      "Profile Settings",
    ],
    languageLabel: "Language",
    themeLabel: "Theme",
  },
};

export default function UserDashboardPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

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

    if (normalizeRole(storedUser) !== "user") {
      setState("forbidden");
      return;
    }

    setUser(storedUser);
    setState("ready");
  }, []);

  const t = useMemo(() => text[locale], [locale]);

  const menu = useMemo<ShellMenuItem[]>(
    () => [
      { key: "dashboard", label: t.menuDashboard, href: "/dashboard", icon: "🏠" },
      { key: "orders", label: t.menuOrders, icon: "📦" },
      { key: "courier", label: t.menuCourier, icon: "🚚" },
      { key: "billing", label: t.menuBilling, icon: "💳" },
      {
        key: "sms",
        label: t.menuSms,
        icon: "✉️",
        children: [
          { key: "sms-send", label: t.menuSmsSend, href: "/dashboard/sms/send" },
          { key: "sms-history", label: t.menuSmsHistory, href: "/dashboard/sms/history" },
        ],
      },
      { key: "profile", label: t.menuProfile, icon: "⚙️" },
    ],
    [t],
  );

  const handleInitiateEmailVerification = async () => {
    if (!user) return;

    const token = getStoredToken();
    if (!token) {
      router.push("/");
      return;
    }

    try {
      const response = await fetch("/api/email/send-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          // Store the verification token and redirect to verify-email page
          sessionStorage.setItem("email_verification_token", data.token);
          sessionStorage.setItem("email_verification_email", data.email);
          router.push("/verify-email");
        }
      } else {
        const error = await response.json();
        alert(error.message || "Failed to send verification email");
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      alert("An error occurred while sending the verification email");
    }
  };

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            {state === "forbidden" ? t.accessDenied : t.loginRequired}
          </p>
          <a
            href="/"
            className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
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
      sidebarTitle={t.title}
      userName={user?.name}
      userMeta={user?.email}
      menu={menu}
      activeKey="dashboard"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {!user?.email_verified_at && (
        <div className="p-4 sm:p-5">
          <EmailVerificationBanner
            userEmail={user?.email || ""}
            onInitiateVerification={handleInitiateEmailVerification}
            locale={locale}
          />
        </div>
      )}

      <section className="catv-panel p-4 sm:p-5">
        <h2 className="text-lg font-bold sm:text-xl">{t.quickActions}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{user?.name} • {user?.email}</p>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        {t.cards.map((card, idx) => (
          <article
            key={card.label}
            className={`rounded-2xl p-4 text-white shadow-md ${
              idx % 3 === 0 ? "bg-[#0f7c7b]" : idx % 3 === 1 ? "bg-[#2f7ec1]" : "bg-[#ff7a59]"
            }`}
          >
            <p className="text-xs font-semibold text-white/90">{card.label}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-white/85">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="catv-panel mt-4 p-4 sm:p-5">
        <h3 className="text-base font-semibold">{t.quickActions}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {t.modules.map((module) => (
            <div
              key={module}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium"
            >
              {module}
            </div>
          ))}
        </div>
      </section>
    </CatvShell>
  );
}
