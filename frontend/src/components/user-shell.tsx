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
  setStoredUser,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

// ─── Bilingual menu labels ────────────────────────────────────────────────────

const menuText = {
  bn: {
    sidebarTitle: "বিজনেস ড্যাশবোর্ড",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    loginRequired: "ড্যাশবোর্ড দেখতে হলে আগে লগইন করুন।",
    accessDenied: "এই পেজটি সাধারণ ইউজারদের জন্য।",
    goHome: "হোমে যান",

    // menu items
    dashboard: "ড্যাশবোর্ড",

    orders: "অর্ডার",
    allOrders: "সকল অর্ডার",
    createOrder: "নতুন অর্ডার",
    fraudCheck: "ফ্রড চেক",
    blacklist: "ব্লকলিস্ট",

    products: "পণ্য",
    productList: "পণ্য তালিকা",
    categories: "ক্যাটাগরি",
    stock: "স্টক ম্যানেজমেন্ট",

    customers: "কাস্টমার",
    customerList: "কাস্টমার তালিকা",
    vipCustomers: "VIP কাস্টমার",
    riskyCustomers: "ঝুঁকিপূর্ণ / ব্লকড",

    courier: "কুরিয়ার",
    bookParcel: "পার্সেল বুক",
    trackOrders: "ট্র্যাক করুন",
    courierPerf: "পারফরমেন্স",

    sms: "এসএমএস",
    smsSend: "SMS পাঠান",
    smsHistory: "SMS হিস্টোরি",
    smsAutomation: "অটোমেশন",

    analytics: "অ্যানালিটিক্স",
    salesReport: "সেলস রিপোর্ট",
    intelligence: "কাস্টমার ইন্টেলিজেন্স",
    adsRoi: "Ads ROI",
    courierReport: "কুরিয়ার রিপোর্ট",

    accounting: "হিসাব",
    dailyReport: "দৈনিক রিপোর্ট",
    expenses: "খরচ",
    profit: "মুনাফা",

    settings: "সেটিংস",
    shopProfile: "শপ প্রোফাইল",
    courierAccounts: "কুরিয়ার একাউন্ট",
    subscription: "সাবস্ক্রিপশন",
  },
  en: {
    sidebarTitle: "Business Dashboard",
    languageLabel: "Language",
    themeLabel: "Theme",
    loginRequired: "Please login first to access the dashboard.",
    accessDenied: "This page is available for regular users only.",
    goHome: "Go Home",

    dashboard: "Dashboard",

    orders: "Orders",
    allOrders: "All Orders",
    createOrder: "New Order",
    fraudCheck: "Fraud Check",
    blacklist: "Blacklist",

    products: "Products",
    productList: "Product List",
    categories: "Categories",
    stock: "Stock Management",

    customers: "Customers",
    customerList: "Customer List",
    vipCustomers: "VIP Customers",
    riskyCustomers: "Risky / Blocked",

    courier: "Courier",
    bookParcel: "Book Parcel",
    trackOrders: "Track Orders",
    courierPerf: "Performance",

    sms: "SMS",
    smsSend: "Send SMS",
    smsHistory: "SMS History",
    smsAutomation: "Automation",

    analytics: "Analytics",
    salesReport: "Sales Report",
    intelligence: "Customer Intelligence",
    adsRoi: "Ads ROI",
    courierReport: "Courier Report",

    accounting: "Accounting",
    dailyReport: "Daily Report",
    expenses: "Expenses",
    profit: "Profit",

    settings: "Settings",
    shopProfile: "Shop Profile",
    courierAccounts: "Courier Accounts",
    subscription: "Subscription",
  },
};

// ─── Build menu from labels ───────────────────────────────────────────────────

function buildMenu(t: typeof menuText.bn): ShellMenuItem[] {
  return [
    {
      key: "dashboard",
      label: t.dashboard,
      href: "/dashboard",
      icon: "🏠",
    },
    {
      key: "orders",
      label: t.orders,
      icon: "📦",
      children: [
        { key: "all-orders", label: t.allOrders, href: "/dashboard/orders" },
        { key: "create-order", label: t.createOrder, href: "/dashboard/orders/create" },
        { key: "fraud-check", label: t.fraudCheck, href: "/dashboard/orders/fraud-check" },
        { key: "blacklist", label: t.blacklist, href: "/dashboard/orders/blacklist" },
      ],
    },
    {
      key: "products",
      label: t.products,
      icon: "🛍️",
      children: [
        { key: "product-list", label: t.productList, href: "/dashboard/products" },
        { key: "categories", label: t.categories, href: "/dashboard/products/categories" },
        { key: "stock", label: t.stock, href: "/dashboard/products/stock" },
      ],
    },
    {
      key: "customers",
      label: t.customers,
      icon: "👥",
      children: [
        { key: "customer-list", label: t.customerList, href: "/dashboard/customers" },
        { key: "vip-customers", label: t.vipCustomers, href: "/dashboard/customers/vip" },
        { key: "risky-customers", label: t.riskyCustomers, href: "/dashboard/customers/risky" },
      ],
    },
    {
      key: "courier",
      label: t.courier,
      icon: "🚚",
      children: [
        { key: "book-parcel", label: t.bookParcel, href: "/dashboard/courier" },
        { key: "track-orders", label: t.trackOrders, href: "/dashboard/courier/track" },
        { key: "courier-perf", label: t.courierPerf, href: "/dashboard/courier/performance" },
      ],
    },
    {
      key: "sms",
      label: t.sms,
      icon: "✉️",
      children: [
        { key: "sms-send", label: t.smsSend, href: "/dashboard/sms/send" },
        { key: "sms-history", label: t.smsHistory, href: "/dashboard/sms/history" },
        { key: "sms-automation", label: t.smsAutomation, href: "/dashboard/sms/automation" },
      ],
    },
    {
      key: "analytics",
      label: t.analytics,
      icon: "📊",
      children: [
        { key: "sales-report", label: t.salesReport, href: "/dashboard/analytics/sales" },
        { key: "intelligence", label: t.intelligence, href: "/dashboard/analytics/intelligence" },
        { key: "ads-roi", label: t.adsRoi, href: "/dashboard/analytics/ads-roi" },
        { key: "courier-report", label: t.courierReport, href: "/dashboard/analytics/courier" },
      ],
    },
    {
      key: "accounting",
      label: t.accounting,
      icon: "🧾",
      children: [
        { key: "daily-report", label: t.dailyReport, href: "/dashboard/accounting" },
        { key: "expenses", label: t.expenses, href: "/dashboard/accounting/expenses" },
        { key: "profit", label: t.profit, href: "/dashboard/accounting/profit" },
      ],
    },
    {
      key: "settings",
      label: t.settings,
      icon: "⚙️",
      children: [
        { key: "shop-profile", label: t.shopProfile, href: "/dashboard/settings/shop" },
        { key: "courier-accounts", label: t.courierAccounts, href: "/dashboard/settings/courier" },
        { key: "subscription", label: t.subscription, href: "/dashboard/settings/subscription" },
      ],
    },
  ];
}

// ─── Props ────────────────────────────────────────────────────────────────────

type UserShellProps = {
  /** Active sidebar menu key — e.g. "all-orders", "book-parcel", "dashboard" */
  activeKey: string;
  /** Parent key to expand by default — e.g. "orders", "courier" */
  defaultExpandedKey?: string;
  /** Optional page title override (falls back to sidebarTitle) */
  pageTitle?: { bn: string; en: string };
  /** Optional page subtitle override */
  pageSubtitle?: { bn: string; en: string };
  children: React.ReactNode;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserShell({
  activeKey,
  defaultExpandedKey,
  pageTitle,
  pageSubtitle,
  children,
}: UserShellProps) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");

  // theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // locale
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  // auth check
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

  // background profile sync
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const syncUser = async () => {
      try {
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.user) return;
        const normalized: AuthUser = { ...data.user, role: data.user.role ?? "user" };
        setStoredUser(normalized);
        setUser(normalized);
      } catch {
        // silent
      }
    };

    void syncUser();
  }, []);

  const t = useMemo(() => menuText[locale], [locale]);
  const menu = useMemo(() => buildMenu(t), [t]);

  const title = pageTitle ? pageTitle[locale] : t.sidebarTitle;
  const subtitle = pageSubtitle ? pageSubtitle[locale] : "";

  // email verification
  const handleInitiateEmailVerification = async () => {
    const token = getStoredToken();
    if (!token || !user) return;

    try {
      const res = await fetch("/api/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || "Failed to send verification email");
        return;
      }

      const data = await res.json();
      if (data.token) {
        sessionStorage.setItem("email_verification_token", data.token);
        sessionStorage.setItem("email_verification_email", data.email);
        router.push("/verify-email");
      } else if (data.message === "Your email is already verified.") {
        const updatedUser: AuthUser = {
          ...user,
          email_verified_at: new Date().toISOString(),
        };
        setStoredUser(updatedUser);
        setUser(updatedUser);
      }
    } catch {
      alert("An error occurred while sending the verification email");
    }
  };

  // ─── Not authenticated / forbidden ────────────────────────────────────────

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.sidebarTitle}</h1>
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
      title={title}
      subtitle={subtitle}
      locale={locale}
      theme={theme}
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle={t.sidebarTitle}
      userName={user?.name}
      userMeta={user?.email}
      menu={menu}
      activeKey={activeKey}
      defaultExpandedKey={defaultExpandedKey ?? null}
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
      {children}
    </CatvShell>
  );
}
