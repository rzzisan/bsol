"use client";

import { useEffect, useMemo, useState } from "react";
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
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{t.title}</h1>
            <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">{t.subtitle}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{user?.name} • {user?.email}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
            >
              {t.languageLabel}: {locale === "bn" ? "বাংলা" : "English"}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
            >
              {t.themeLabel}: {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        {t.cards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs font-semibold text-[var(--muted)]">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{card.value}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{t.quickActions}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {t.modules.map((module) => (
            <div
              key={module}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium text-[var(--foreground)]"
            >
              {module}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
