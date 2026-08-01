"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import CatvShell from "@/components/catv-shell";
import LandingPageBuilder from "@/components/landing-page-builder";
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

const text = {
  bn: {
    title: "ল্যান্ডিং পেজ থেকে টেমপ্লেট তৈরি করুন",
    subtitle: "সেলারের পেজটি রিভিউ ও এডিট করে নাম, স্ক্রীনশটসহ টেমপ্লেট হিসেবে পাবলিশ করুন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    missingSource: "কোনো সোর্স ল্যান্ডিং পেজ পাওয়া যায়নি। \"ল্যান্ডিং পেজ (সব সেলার)\" লিস্ট থেকে শুরু করুন।",
    menuDashboard: "ড্যাশবোর্ড", menuCustomers: "গ্রাহক", menuActive: "অ্যাকটিভ গ্রাহক", menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস", menuSmsGateway: "এসএমএস গেটওয়ে", menuSmsSend: "এসএমএস সেন্ড", menuSmsHistory: "এসএমএস হিস্টোরি", menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ", menuBilling: "বিলিং", menuLandingPages: "ল্যান্ডিং পেজ", menuLandingTemplates: "ল্যান্ডিং টেমপ্লেট", menuReports: "রিপোর্ট", menuSettings: "সেটিংস", menuEmailSettings: "ইমেইল সেটিংস",
    languageLabel: "ভাষা", themeLabel: "থিম",
  },
  en: {
    title: "Convert Landing Page to Template",
    subtitle: "Review and edit the seller's page, then publish it as a template with a name and screenshot.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    missingSource: "No source landing page found. Start from the \"Landing Pages (All Sellers)\" list.",
    menuDashboard: "Dashboard", menuCustomers: "Customers", menuActive: "Active Customers", menuPending: "Pending Customers",
    menuSms: "SMS", menuSmsGateway: "SMS Gateway", menuSmsSend: "Send SMS", menuSmsHistory: "SMS History", menuSmsCredit: "SMS Credit",
    menuPackages: "Packages", menuBilling: "Billing", menuLandingPages: "Landing Pages", menuLandingTemplates: "Landing Templates", menuReports: "Reports", menuSettings: "Settings", menuEmailSettings: "Email Settings",
    languageLabel: "Language", themeLabel: "Theme",
  },
};

function CreateTemplateContent() {
  const searchParams = useSearchParams();
  const fromPage = searchParams.get("from_page") ?? undefined;

  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

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

  const t = useMemo(() => text[locale], [locale]);

  const menu = useMemo(
    () =>
      buildAdminMenu({
        dashboard: t.menuDashboard,
        customers: t.menuCustomers,
        activeCustomers: t.menuActive,
        pendingCustomers: t.menuPending,
        sms: t.menuSms,
        smsGateway: t.menuSmsGateway,
        smsSend: t.menuSmsSend,
        smsHistory: t.menuSmsHistory,
        smsCredit: t.menuSmsCredit,
        packages: t.menuPackages,
        billing: t.menuBilling,
        landingPages: t.menuLandingPages,
        landingTemplates: t.menuLandingTemplates,
        reports: t.menuReports,
        settings: t.menuSettings,
        emailSettings: t.menuEmailSettings,
      }),
    [t],
  );

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            {state === "forbidden" ? t.accessDenied : t.loginRequired}
          </p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
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
      sidebarTitle="Admin Panel"
      userName={t.menuLandingTemplates}
      userMeta={t.menuLandingTemplates}
      menu={menu}
      activeKey="landing-templates"
      defaultExpandedKey="landing"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {fromPage ? (
        <LandingPageBuilder mode="admin-template" sourcePageId={fromPage} locale={locale} />
      ) : (
        <section className="catv-panel p-5 text-sm text-red-500">{t.missingSource}</section>
      )}
    </CatvShell>
  );
}

export default function AdminCreateTemplatePage() {
  return (
    <Suspense fallback={null}>
      <CreateTemplateContent />
    </Suspense>
  );
}
