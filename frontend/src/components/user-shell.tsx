"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CatvShell, { type ShellMenuItem } from "@/components/catv-shell";
import EmailVerificationBanner from "@/components/email-verification-banner";
import SubscriptionBanner from "@/components/subscription-banner";
import SupportChatWidget from "@/components/support-chat-widget";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  hasModuleAccess,
  LOCALE_STORAGE_KEY,
  mergeAuthPayload,
  normalizeRole,
  setStoredUser,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type StaffModuleKey,
  type ThemeMode,
} from "@/lib/dashboard-client";
import { LocaleContext } from "@/lib/locale-context";

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
    smsCredit: "ক্রেডিট কিনুন",

    analytics: "অ্যানালিটিক্স",
    salesReport: "সেলস রিপোর্ট",
    intelligence: "কাস্টমার ইন্টেলিজেন্স",
    adsRoi: "Ads ROI",
    courierReport: "কুরিয়ার রিপোর্ট",
    trackingLog: "ট্র্যাকিং লগ",

    accounting: "হিসাব",
    dailyReport: "দৈনিক রিপোর্ট",
    expenses: "খরচ",
    profit: "মুনাফা",
    collectionHistory: "কালেকশন হিস্ট্রি",

    landingPages: "ল্যান্ডিং পেজ",
    abandonedCheckouts: "অসম্পূর্ণ অর্ডার",
    facebookLeads: "ফেসবুক লিডস",

    marketing: "মার্কেটিং",
    facebookCapi: "Facebook CAPI",

    settings: "সেটিংস",
    shopProfile: "শপ প্রোফাইল",
    stickerTemplates: "স্টিকার টেমপ্লেট",
    courierAccounts: "কুরিয়ার একাউন্ট",
    facebookConnect: "ফেসবুক পেজ",
    wordpressConnect: "ওয়ার্ডপ্রেস কানেক্ট",
    subscription: "সাবস্ক্রিপশন",
    staffManagement: "টিম / স্টাফ",

    // force-password-change gate
    fpcTitle: "নতুন পাসওয়ার্ড সেট করুন",
    fpcSubtitle: "আপনার একাউন্ট temporary পাসওয়ার্ড দিয়ে তৈরি হয়েছে — চালিয়ে যাওয়ার আগে একটি নতুন পাসওয়ার্ড সেট করতে হবে।",
    fpcCurrentPassword: "বর্তমান (temporary) পাসওয়ার্ড",
    fpcNewPassword: "নতুন পাসওয়ার্ড",
    fpcConfirmPassword: "নতুন পাসওয়ার্ড আবার লিখুন",
    fpcSubmit: "পাসওয়ার্ড সেট করুন",
    fpcSubmitting: "সেভ হচ্ছে...",
    fpcMismatch: "নতুন পাসওয়ার্ড দুটি মিলছে না।",
    fpcTooShort: "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।",
    fpcGenericError: "পাসওয়ার্ড সেট করা যায়নি। আবার চেষ্টা করুন।",
    fpcLogout: "লগআউট",
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
    smsCredit: "Buy Credit",

    analytics: "Analytics",
    salesReport: "Sales Report",
    intelligence: "Customer Intelligence",
    adsRoi: "Ads ROI",
    courierReport: "Courier Report",
    trackingLog: "Tracking Log",

    accounting: "Accounting",
    dailyReport: "Daily Report",
    expenses: "Expenses",
    profit: "Profit",
    collectionHistory: "Collection History",

    landingPages: "Landing Pages",
    abandonedCheckouts: "Abandoned Checkouts",
    facebookLeads: "Facebook Leads",

    marketing: "Marketing",
    facebookCapi: "Facebook CAPI",

    settings: "Settings",
    shopProfile: "Shop Profile",
    stickerTemplates: "Sticker Templates",
    courierAccounts: "Courier Accounts",
    facebookConnect: "Facebook Page",
    wordpressConnect: "WordPress Connect",
    subscription: "Subscription",
    staffManagement: "Staff & Team",

    // force-password-change gate
    fpcTitle: "Set a new password",
    fpcSubtitle: "This account was created with a temporary password — set a new one before continuing.",
    fpcCurrentPassword: "Current (temporary) password",
    fpcNewPassword: "New password",
    fpcConfirmPassword: "Confirm new password",
    fpcSubmit: "Set password",
    fpcSubmitting: "Saving...",
    fpcMismatch: "New passwords do not match.",
    fpcTooShort: "New password must be at least 8 characters.",
    fpcGenericError: "Could not set password. Please try again.",
    fpcLogout: "Log out",
  },
};

// ─── Build menu from labels ───────────────────────────────────────────────────

function buildMenu(t: typeof menuText.bn, facebookLeadsUnread: number): ShellMenuItem[] {
  return [
    {
      key: "dashboard",
      label: t.dashboard,
      href: "/dashboard",
      icon: "🏠",
    },
    {
      key: "landing-pages",
      label:  (t as any).landingPages ?? "ল্যান্ডিং পেজ",
      icon: "🌐",
      href: "/dashboard/landing-pages",
    },
    {
      key: "abandoned-checkouts",
      label: (t as any).abandonedCheckouts ?? "অসম্পূর্ণ অর্ডার",
      icon: "🛒",
      href: "/dashboard/abandoned-checkouts",
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
      key: "facebook-leads",
      label: (t as any).facebookLeads ?? "ফেসবুক লিডস",
      icon: "📨",
      href: "/dashboard/leads",
      badge: facebookLeadsUnread,
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
        { key: "sms-credit", label: t.smsCredit, href: "/dashboard/sms/credit" },
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
        { key: "tracking-log", label: t.trackingLog, href: "/dashboard/analytics/tracking" },
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
        { key: "collection-history", label: t.collectionHistory, href: "/dashboard/accounting/collections" },
      ],
    },
    {
      key: "marketing",
      label: (t as any).marketing ?? "মার্কেটিং",
      icon: "📣",
      children: [
        { key: "facebook-capi", label: (t as any).facebookCapi ?? "Facebook CAPI", href: "/dashboard/marketing/facebook-capi" },
      ],
    },
    {
      key: "settings",
      label: t.settings,
      icon: "⚙️",
      children: [
        { key: "shop-profile", label: t.shopProfile, href: "/dashboard/settings/shop" },
        { key: "sticker-templates", label: t.stickerTemplates, href: "/dashboard/settings/sticker-templates" },
        { key: "courier-accounts", label: t.courierAccounts, href: "/dashboard/settings/courier" },
        { key: "facebook-connect", label: (t as any).facebookConnect ?? "ফেসবুক পেজ", href: "/dashboard/settings/facebook" },
        { key: "wordpress-connect", label: (t as any).wordpressConnect ?? "ওয়ার্ডপ্রেস কানেক্ট", href: "/dashboard/settings/wordpress" },
        { key: "subscription", label: t.subscription, href: "/dashboard/settings/subscription" },
        { key: "staff-management", label: t.staffManagement, href: "/dashboard/settings/staff" },
      ],
    },
  ];
}

// Staff/Team sub-account role — see staff_team_role_context.md §4/§9.
// "dashboard" is always shown. Owners/admins are never filtered.

// Owner-only resources — never shown to staff regardless of any permission
// grant (billing/settings, Pattern B — matches the backend's owner_only
// route middleware, not staff_permission). "marketing" (Facebook CAPI —
// tracking_destinations, a credential) belongs here for the same reason
// "settings" does.
const OWNER_ONLY_MENU_KEYS = new Set(["settings", "sms-credit", "marketing"]);

// Maps a leaf menu item's key (a top-level item with no children, OR a
// child inside a parent group) to the backend module permission that gates
// it. Parent groups themselves (orders/products/customers/courier/sms/
// analytics/accounting) aren't listed — a group's visibility is derived
// from whether any of its children remain visible, since some groups mix
// children gated by different modules (e.g. "orders" group has fraud-check/
// blacklist gated by the separate "fraud" permission, not "orders").
const MODULE_KEY_BY_MENU_ITEM: Record<string, StaffModuleKey> = {
  "landing-pages": "landing_pages",
  "abandoned-checkouts": "landing_pages",
  "facebook-leads": "facebook",

  "all-orders": "orders",
  "create-order": "orders",
  "fraud-check": "fraud",
  blacklist: "fraud",

  "product-list": "products",
  categories: "products",
  stock: "products",

  "customer-list": "customers",
  "vip-customers": "customers",
  "risky-customers": "customers",

  "book-parcel": "courier",
  "track-orders": "courier",
  "courier-perf": "courier",

  "sms-send": "sms",
  "sms-history": "sms",
  "sms-automation": "sms",

  "sales-report": "analytics",
  intelligence: "analytics",
  "ads-roi": "analytics",
  "courier-report": "analytics",
  "tracking-log": "tracking",

  "daily-report": "accounting",
  expenses: "accounting",
  profit: "accounting",
  "collection-history": "accounting",
};

function filterMenuForStaff(menu: ShellMenuItem[], user: AuthUser | null): ShellMenuItem[] {
  if (!user?.is_staff) return menu;

  const isLeafVisible = (key: string): boolean => {
    if (OWNER_ONLY_MENU_KEYS.has(key)) return false;
    const moduleKey = MODULE_KEY_BY_MENU_ITEM[key];
    if (!moduleKey) return false; // default-deny for anything unmapped
    return hasModuleAccess(user, moduleKey);
  };

  return menu
    .filter((item) => !OWNER_ONLY_MENU_KEYS.has(item.key))
    .map((item) => (item.children ? { ...item, children: item.children.filter((c) => isLeafVisible(c.key)) } : item))
    .filter((item) => {
      if (item.key === "dashboard") return true;
      if (item.children) return item.children.length > 0;
      return isLeafVisible(item.key);
    });
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
  // Support session banner (custom_domain_context.md §11.5). Rendered from
  // localStorage rather than the API because impersonation deliberately
  // leaves no server-side "acting as" state — the token simply is the
  // seller's — so this flag is the only marker that the tab is borrowed.
  const [impersonating] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("impersonating_name"),
  );

  function exitImpersonation() {
    const adminToken = localStorage.getItem("admin_token_backup");
    localStorage.removeItem("impersonating_name");
    localStorage.removeItem("admin_token_backup");
    localStorage.removeItem("auth_user");
    if (adminToken) {
      localStorage.setItem("auth_token", adminToken);
      window.location.href = "/admin/customers/active";
    } else {
      localStorage.removeItem("auth_token");
      window.location.href = "/";
    }
  }

  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [subscription, setSubscription] = useState<{ status: string; days_left: number | null; is_expired: boolean } | null>(null);
  const [facebookLeadsUnread, setFacebookLeadsUnread] = useState(0);

  useEffect(() => {
    setLocale(getStoredLocale());
    setTheme(getStoredTheme());
  }, []);

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

    const role = normalizeRole(storedUser);
    if (role !== "user" && role !== "admin") {
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
        const normalized: AuthUser = { ...mergeAuthPayload(data), role: data.user.role ?? "user" };
        setStoredUser(normalized);
        setUser(normalized);
      } catch {
        // silent
      }
    };

    void syncUser();
  }, []);

  // subscription status for renewal/trial banner
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const loadSubscription = async () => {
      try {
        const res = await fetch("/api/subscription/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.data) return;
        setSubscription({
          status: data.data.status,
          days_left: data.data.days_left,
          is_expired: data.data.is_expired,
        });
      } catch {
        // silent — banner just won't show
      }
    };

    void loadSubscription();
  }, []);

  // Facebook Leads sidebar badge — light poll, keeps the seller aware of new
  // leads without needing to open /dashboard/leads. Same pattern as the
  // support-chat-widget unread badge (see commit bd3bb08).
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/facebook/leads/unread-count", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setFacebookLeadsUnread(data.count ?? 0);
      } catch {
        // silent — badge just stays at its last known value
      }
    };

    void poll();
    const interval = setInterval(poll, 20000);
    return () => clearInterval(interval);
  }, []);

  const t = useMemo(() => menuText[locale], [locale]);
  const menu = useMemo(
    () => filterMenuForStaff(buildMenu(t, facebookLeadsUnread), user),
    [t, facebookLeadsUnread, user],
  );

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

  // ─── Forced password change (staff temp-password flow) ───────────────────
  // §3.7: a staff account created by its owner must set a real password
  // before touching anything else — mirrors the backend's
  // ForcePasswordChange middleware, which 403s every route but /me,
  // /user, /logout until this flag clears.
  // ─── Mandatory shop setup ────────────────────────────────────────────────
  // A brand-new seller has no shop profile and no address, so nothing they
  // could do in the dashboard would actually work — landing pages can't be
  // published without a subdomain. Send them through setup first. Only on
  // the platform origin: a seller already on their own subdomain has, by
  // definition, finished.
  if (user?.onboarding?.required && !impersonating) {
    if (typeof window !== "undefined" && window.location.pathname !== "/onboarding") {
      window.location.replace("/onboarding");
    }

    return null;
  }

  if (user?.must_change_password) {
    return (
      <ForcePasswordChangeScreen
        t={t}
        locale={locale}
        theme={theme}
        onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        onSuccess={(updatedUser) => {
          setStoredUser(updatedUser);
          setUser(updatedUser);
        }}
      />
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
      currentUser={user}
      menu={menu}
      activeKey={activeKey}
      defaultExpandedKey={defaultExpandedKey ?? null}
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {impersonating && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950">
          <span>
            {locale === "bn"
              ? `সাপোর্ট মোড — আপনি ${impersonating} হিসেবে দেখছেন`
              : `Support mode — viewing as ${impersonating}`}
          </span>
          <button
            type="button"
            onClick={exitImpersonation}
            className="rounded-lg bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:opacity-90"
          >
            {locale === "bn" ? "অ্যাডমিনে ফিরুন" : "Back to admin"}
          </button>
        </div>
      )}
      {!user?.email_verified_at && (
        <div className="p-4 sm:p-5">
          <EmailVerificationBanner
            userEmail={user?.email || ""}
            onInitiateVerification={handleInitiateEmailVerification}
            locale={locale}
          />
        </div>
      )}
      {subscription && (
        <div className="p-4 sm:p-5">
          <SubscriptionBanner
            status={subscription.status}
            daysLeft={subscription.days_left}
            isExpired={subscription.is_expired}
            locale={locale}
          />
        </div>
      )}
      <LocaleContext.Provider value={locale}>
        {children}
        <SupportChatWidget />
      </LocaleContext.Provider>
    </CatvShell>
  );
}

// ─── Forced password change screen ─────────────────────────────────────────
// Staff/Team sub-account role — see staff_team_role_context.md §3.7. Full
// dashboard block, not a dismissible modal — matches the backend's hard
// gate (ForcePasswordChange middleware 403s every other route).

function ForcePasswordChangeScreen({
  t,
  locale,
  theme,
  onToggleLocale,
  onToggleTheme,
  onSuccess,
}: {
  t: typeof menuText.bn;
  locale: Locale;
  theme: ThemeMode;
  onToggleLocale: () => void;
  onToggleTheme: () => void;
  onSuccess: (user: AuthUser) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t.fpcTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.fpcMismatch);
      return;
    }

    const token = getStoredToken();
    if (!token) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: confirmPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const firstError = data?.errors ? Object.values(data.errors as Record<string, string[]>)[0]?.[0] : data?.message;
        setError(firstError ?? t.fpcGenericError);
        return;
      }

      // PUT /me doesn't recompute is_staff/owner_name/permissions (they're
      // relation-derived, not real columns) — merge onto the stored user
      // instead of replacing it, same reasoning as catv-shell.tsx's profile save.
      const stored = getStoredUser() ?? ({} as AuthUser);
      onSuccess({ ...stored, ...data.user, must_change_password: false });
    } catch {
      setError(t.fpcGenericError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    const token = getStoredToken();
    if (token) {
      try {
        await fetch("/api/logout", {
          method: "POST",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-4 flex justify-end gap-2">
        <button type="button" className="catv-chip" onClick={onToggleLocale}>
          {locale === "bn" ? "বাংলা" : "English"}
        </button>
        <button type="button" className="catv-chip" onClick={onToggleTheme}>
          {theme === "dark" ? "Dark" : "Light"}
        </button>
      </div>
      <section className="catv-panel p-5 sm:p-6">
        <h1 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{t.fpcTitle}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t.fpcSubtitle}</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t.fpcCurrentPassword}</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t.fpcNewPassword}</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{t.fpcConfirmPassword}</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {submitting ? t.fpcSubmitting : t.fpcSubmit}
          </button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 w-full text-center text-xs font-medium text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
        >
          {t.fpcLogout}
        </button>
      </section>
    </main>
  );
}
