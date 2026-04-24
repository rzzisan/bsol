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
    title: "অ্যাডমিন ড্যাশবোর্ড",
    subtitle: "ইউজার, সাবস্ক্রিপশন প্যাকেজ এবং প্ল্যাটফর্ম অপারেশন ম্যানেজ করার base panel।",
    loginRequired: "অ্যাডমিন ড্যাশবোর্ড দেখতে হলে আগে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন ইউজার এই পেজে প্রবেশ করতে পারবেন।",
    goHome: "হোমে যান",
    overviewTitle: "Management Overview",
    tiles: [
      { title: "Users", desc: "সকল ইউজার দেখা, সার্চ ও filter" },
      { title: "User Control", desc: "ইউজার add / edit / delete workflow" },
      { title: "Packages", desc: "সাবস্ক্রিপশন package create / update / archive" },
      { title: "Access Control", desc: "role-based admin/user permission scaffold" },
    ],
    languageLabel: "ভাষা",
    themeLabel: "থিম",
  },
  en: {
    title: "Admin Dashboard",
    subtitle: "Base panel to manage users, subscription packages, and platform operations.",
    loginRequired: "Please login as an admin to access the admin dashboard.",
    accessDenied: "Only admin users can access this page.",
    goHome: "Go Home",
    overviewTitle: "Management Overview",
    tiles: [
      { title: "Users", desc: "View all users with search and filters" },
      { title: "User Control", desc: "User add / edit / delete workflow" },
      { title: "Packages", desc: "Create / update / archive subscription packages" },
      { title: "Access Control", desc: "Role-based admin/user permission scaffold" },
    ],
    languageLabel: "Language",
    themeLabel: "Theme",
  },
};

export default function AdminDashboardPage() {
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

    if (normalizeRole(storedUser) !== "admin") {
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

      <section className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{t.overviewTitle}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {t.tiles.map((tile) => (
            <article
              key={tile.title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
            >
              <h3 className="text-base font-semibold text-[var(--foreground)]">{tile.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{tile.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
