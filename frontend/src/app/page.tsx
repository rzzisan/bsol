"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Languages,
  LayoutGrid,
  LineChart,
  MessageCircle,
  Moon,
  Package,
  ShieldAlert,
  Smartphone,
  Sun,
  Truck,
} from "lucide-react";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  LOCALE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

type AuthTab = "login" | "register";

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
const content = {
  bn: {
    brandName: "Zyrotech BSOL",
    nav: { features: "ফিচার", roadmap: "রোডম্যাপ", login: "লগইন", signup: "ফ্রি অ্যাকাউন্ট" },
    badge: "Hybrid Commerce SaaS Platform",
    title: "বাংলাদেশি F-commerce ব্যবসার জন্য স্মার্ট অপারেশন প্ল্যাটফর্ম",
    subtitle:
      "অর্ডার, কুরিয়ার, ফেইক অর্ডার রিস্ক, CRM এবং প্রফিট ট্র্যাকিং—সব এক জায়গায় এনে আপনার ব্যবসা চালান আরও দ্রুত ও নিরাপদভাবে।",
    heroHighlights: [
      "সেটআপ শুরু করতে কোনো কার্ড লাগে না",
      "বাংলা ও ইংরেজি — দুই ভাষাতেই সম্পূর্ণ সাপোর্ট",
      "মোবাইল থেকেই পুরো ব্যবসা নিয়ন্ত্রণ করুন",
    ],
    ctaPrimary: "ফ্রি অ্যাকাউন্ট খুলুন",
    ctaSecondary: "ফিচার দেখুন",
    statStrip: [
      { label: "কোর মডিউল", value: "৫+" },
      { label: "ভাষা সাপোর্ট", value: "বাংলা + English" },
      { label: "ডিজাইন", value: "মোবাইল-ফার্স্ট" },
      { label: "ড্যাশবোর্ড অ্যাক্সেস", value: "২৪/৭" },
    ],
    sectionTitle: "কোর প্রোডাক্ট মডিউল",
    sectionDescription:
      "আপনার প্রতিদিনের অপারেশন সহজ করতে প্রতিটি মডিউল বাস্তব ব্যবসার প্রয়োজন মাথায় রেখে ডিজাইন করা হয়েছে।",
    benefitsTitle: "কেন BSOL বেছে নেবেন",
    benefitsDescription:
      "একটি শক্ত ফাউন্ডেশনের উপর তৈরি — যাতে আপনার টিম প্রথম দিন থেকেই স্বাচ্ছন্দ্যে কাজ শুরু করতে পারে।",
    readyItems: [
      "মোবাইল-ফার্স্ট UI কাঠামো",
      "ডার্ক / লাইট থিম সুইচার",
      "বাংলা / English language toggle",
      "Feature-based modular layout",
      "নিরাপদ, API-ভিত্তিক ব্যাকএন্ড আর্কিটেকচার",
    ],
    roadmapTitle: "MVP রোডম্যাপ",
    roadmapDescription: "ধাপে ধাপে প্রোডাক্ট বিল্ড ও রিলিজ করার জন্য পরিকল্পিত পাইপলাইন।",
    roadmap: [
      {
        phase: "Phase 1",
        title: "Order + Courier Core",
        detail: "ম্যানুয়াল অর্ডার এন্ট্রি, কুরিয়ার API কানেক্টর, ট্র্যাকিং টাইমলাইন, ইনভয়েস প্রিভিউ।",
      },
      {
        phase: "Phase 2",
        title: "Risk Engine + CRM",
        detail: "ফেইক-অর্ডার স্কোরিং, কাস্টমার রেটিং, ইনবক্স লেবেল, টার্গেটেড ব্রডকাস্ট সেগমেন্ট।",
      },
      {
        phase: "Phase 3",
        title: "Analytics + ROI Intelligence",
        detail: "অ্যাড স্পেন্ড সিঙ্ক, টিম ওয়ার্কফ্লো, নেট প্রফিট ভিজিবিলিটি, ইনভেন্টরি ইনসাইট।",
      },
    ],
    ctaBandTitle: "আজই আপনার ব্যবসা BSOL-এ নিয়ে আসুন",
    ctaBandSubtitle: "কয়েক মিনিটেই একাউন্ট তৈরি করে অর্ডার, কুরিয়ার এবং কাস্টমার ম্যানেজমেন্ট শুরু করুন।",
    ctaBandButton: "ফ্রি অ্যাকাউন্ট তৈরি করুন",
    footerTagline: "বাংলাদেশি F-commerce ব্যবসার জন্য অল-ইন-ওয়ান অপারেশন প্ল্যাটফর্ম।",
    footerProductTitle: "প্রোডাক্ট",
    footerLegalTitle: "লিগ্যাল",
    footerAccountTitle: "অ্যাকাউন্ট",
    copyright: (year: number) => `© ${year} Zyrotech BSOL. সর্বস্বত্ব সংরক্ষিত।`,
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    auth: {
      loginTab: "লগইন",
      registerTab: "রেজিস্ট্রেশন",
      nameLabel: "পূর্ণ নাম",
      namePlaceholder: "আপনার পূর্ণ নাম লিখুন",
      mobileLabel: "মোবাইল নম্বর",
      mobilePlaceholder: "01XXXXXXXXX",
      emailLabel: "ইমেইল অ্যাড্রেস",
      emailPlaceholder: "example@email.com",
      passwordLabel: "পাসওয়ার্ড",
      passwordPlaceholder: "মিনিমাম ৮ অক্ষর",
      confirmPasswordLabel: "পাসওয়ার্ড নিশ্চিত করুন",
      confirmPasswordPlaceholder: "পাসওয়ার্ড আবার লিখুন",
      loginBtn: "লগইন করুন",
      registerBtn: "অ্যাকাউন্ট তৈরি করুন",
      loggingIn: "লগইন হচ্ছে...",
      registering: "রেজিস্ট্রেশন হচ্ছে...",
      logoutBtn: "লগআউট",
      dashboardBtn: "ড্যাশবোর্ডে যান",
      welcomeBack: "স্বাগতম",
      loggedInAs: "আপনি সফলভাবে লগইন করেছেন।",
      mobileDisplay: "মোবাইল",
      emailDisplay: "ইমেইল",
      passwordMismatch: "পাসওয়ার্ড দুটি মিলছে না।",
      passwordTooShort: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে।",
      authSectionTitle: "শুরু করুন",
      authSectionSubtitle: "লগইন করুন অথবা নতুন অ্যাকাউন্ট তৈরি করুন — সম্পূর্ণ ফ্রি।",
      forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?",
    },
  },
  en: {
    brandName: "Zyrotech BSOL",
    nav: { features: "Features", roadmap: "Roadmap", login: "Login", signup: "Free account" },
    badge: "Hybrid Commerce SaaS Platform",
    title: "Smart operations platform for Bangladesh F-commerce businesses",
    subtitle:
      "Unify orders, couriers, fake-order risk checks, CRM, and profitability tracking in one place — and run your business faster and safer.",
    heroHighlights: [
      "No card required to get started",
      "Fully supported in Bangla and English",
      "Run your entire business from your phone",
    ],
    ctaPrimary: "Create free account",
    ctaSecondary: "See features",
    statStrip: [
      { label: "Core modules", value: "5+" },
      { label: "Language support", value: "Bangla + English" },
      { label: "Design", value: "Mobile-first" },
      { label: "Dashboard access", value: "24/7" },
    ],
    sectionTitle: "Core Product Modules",
    sectionDescription:
      "Every module is designed around real day-to-day operations, so running your business gets simpler, not more complex.",
    benefitsTitle: "Why choose BSOL",
    benefitsDescription:
      "Built on a solid foundation — so your team can get comfortable and productive from day one.",
    readyItems: [
      "Mobile-first UI structure",
      "Dark / light theme switcher",
      "Bangla / English language toggle",
      "Feature-based modular layout",
      "Secure, API-first backend architecture",
    ],
    roadmapTitle: "MVP Roadmap",
    roadmapDescription: "A phased pipeline for building and shipping the product step by step.",
    roadmap: [
      {
        phase: "Phase 1",
        title: "Order + Courier Core",
        detail: "Manual order entry, courier API connector wrappers, tracking timeline, invoice preview.",
      },
      {
        phase: "Phase 2",
        title: "Risk Engine + CRM",
        detail: "Fake-order scoring, customer rating graph, inbox labels, targeted broadcast segments.",
      },
      {
        phase: "Phase 3",
        title: "Analytics + ROI Intelligence",
        detail: "Ad spend sync, team workflows, net profit visibility, and inventory insights.",
      },
    ],
    ctaBandTitle: "Bring your business to BSOL today",
    ctaBandSubtitle: "Create your account in minutes and start managing orders, couriers, and customers.",
    ctaBandButton: "Create free account",
    footerTagline: "The all-in-one operations platform for Bangladesh F-commerce businesses.",
    footerProductTitle: "Product",
    footerLegalTitle: "Legal",
    footerAccountTitle: "Account",
    copyright: (year: number) => `© ${year} Zyrotech BSOL. All rights reserved.`,
    languageLabel: "Language",
    themeLabel: "Theme",
    auth: {
      loginTab: "Login",
      registerTab: "Register",
      nameLabel: "Full Name",
      namePlaceholder: "Enter your full name",
      mobileLabel: "Mobile Number",
      mobilePlaceholder: "01XXXXXXXXX",
      emailLabel: "Email Address",
      emailPlaceholder: "example@email.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimum 8 characters",
      confirmPasswordLabel: "Confirm Password",
      confirmPasswordPlaceholder: "Re-enter your password",
      loginBtn: "Login",
      registerBtn: "Create Account",
      loggingIn: "Logging in...",
      registering: "Creating account...",
      logoutBtn: "Logout",
      dashboardBtn: "Go to dashboard",
      welcomeBack: "Welcome",
      loggedInAs: "You have successfully logged in.",
      mobileDisplay: "Mobile",
      emailDisplay: "Email",
      passwordMismatch: "Passwords do not match.",
      passwordTooShort: "Password must be at least 8 characters.",
      authSectionTitle: "Get started",
      authSectionSubtitle: "Login to your account or create a new one — completely free.",
      forgotPassword: "Forgot password?",
    },
  },
};

const modules = {
  bn: [
    {
      icon: Truck,
      title: "অটোমেটেড অর্ডার + কুরিয়ার",
      description: "একটি single form থেকে Pathao / Steadfast / RedX integration-ready dispatch pipeline।",
    },
    {
      icon: ShieldAlert,
      title: "ফেইক অর্ডার ফিল্টারিং",
      description: "ফোন নম্বর history, return behavior, এবং shared customer trust score ভিত্তিক risk indicator।",
    },
    {
      icon: LineChart,
      title: "সেলস + ROI ইন্টেলিজেন্স",
      description: "Ad spend, conversion insights, operational visibility, এবং profit-driven decision support।",
    },
    {
      icon: Package,
      title: "ইনভেন্টরি + Ads ROI",
      description: "Ad spend, cost of goods, delivery cost, এবং net margin analytics এক জায়গায়।",
    },
    {
      icon: MessageCircle,
      title: "মেসেঞ্জার CRM + ব্রডকাস্ট",
      description: "Customer labels, follow-up queue, personalized promotion broadcast workflow।",
    },
  ],
  en: [
    {
      icon: Truck,
      title: "Automated Order + Courier",
      description: "A single order form feeding integration-ready dispatch flows for Pathao / Steadfast / RedX.",
    },
    {
      icon: ShieldAlert,
      title: "Fake Order Filtering",
      description: "Phone-history, return behavior, and shared customer trust score driven risk indicators.",
    },
    {
      icon: LineChart,
      title: "Sales + ROI Intelligence",
      description: "Ad spend, conversion insights, operational visibility, and profit-driven decision support.",
    },
    {
      icon: Package,
      title: "Inventory + Ads ROI",
      description: "Unified analytics for ad spend, cost of goods, delivery charge, and real net margin.",
    },
    {
      icon: MessageCircle,
      title: "Messenger CRM + Broadcast",
      description: "Customer labels, follow-up pipeline, and personalized promotional broadcasting workflow.",
    },
  ],
};

const benefitIcons = [Smartphone, Moon, Languages, LayoutGrid, BadgeCheck];

// ---------------------------------------------------------------------------
// Input component
// ---------------------------------------------------------------------------
function FormInput({
  id,
  label,
  type,
  placeholder,
  value,
  onChange,
  required,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-[var(--muted)] sm:text-sm">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth Section (tab is controlled from the page so header CTAs can preset it)
// ---------------------------------------------------------------------------
function AuthSection({
  locale,
  t,
  tab,
  onTabChange,
}: {
  locale: Locale;
  t: (typeof content)["bn"]["auth"];
  tab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (storedUser && storedToken) {
      setUser(storedUser);
    }
  }, []);

  function clearErrors() {
    setError(null);
  }

  function persistAuth(token: string, userData: AuthUser) {
    const normalizedUser: AuthUser = {
      ...userData,
      role: userData.role === "admin" ? "admin" : "user",
    };
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(normalizedUser));
    setUser(normalizedUser);

    const destination = normalizedUser.role === "admin" ? "/admin" : "/dashboard";
    window.location.href = destination;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const firstError = data?.errors
          ? Object.values(data.errors as Record<string, string[]>)[0]?.[0]
          : data?.message;
        setError(firstError ?? "Login failed.");
      } else {
        persistAuth(data.token, data.user as AuthUser);
        setLoginEmail("");
        setLoginPassword("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    if (regPassword.length < 8) {
      setError(t.passwordTooShort);
      return;
    }
    if (regPassword !== regConfirm) {
      setError(t.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/otp/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: regName,
          mobile: regMobile,
          email: regEmail,
          password: regPassword,
          password_confirmation: regConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const firstError = data?.errors
          ? Object.values(data.errors as Record<string, string[]>)[0]?.[0]
          : data?.message;
        setError(firstError ?? "Registration failed.");
      } else {
        sessionStorage.setItem("otp_token", data.token as string);
        sessionStorage.setItem("otp_mobile", data.mobile as string);
        if (data?.next_resend_after_seconds !== undefined) {
          sessionStorage.setItem("otp_resend_cooldown", String(data.next_resend_after_seconds));
        }
        window.location.href = "/verify-phone";
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const token = getStoredToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // ignore network errors on logout
      }
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setUser(null);
    clearErrors();
  }

  if (user) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
            {t.welcomeBack}, {user.name}!
          </h2>
          <div className="flex items-center gap-2">
            <a
              href={user.role === "admin" ? "/admin" : "/dashboard"}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t.dashboardBtn}
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-400"
            >
              {t.logoutBtn}
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">{t.loggedInAs}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {user.mobile && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t.mobileDisplay}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{user.mobile}</p>
            </div>
          )}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t.emailDisplay}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{user.email}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1">
        {(["login", "register"] as AuthTab[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => {
              onTabChange(tabKey);
              clearErrors();
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              tab === tabKey
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--foreground)] hover:bg-[var(--surface)]"
            }`}
          >
            {tabKey === "login" ? t.loginTab : t.registerTab}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {tab === "login" && (
        <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
          <FormInput
            id="login_email"
            label={t.emailLabel}
            type="email"
            placeholder={t.emailPlaceholder}
            value={loginEmail}
            onChange={setLoginEmail}
            required
            autoComplete="email"
          />
          <FormInput
            id="login_password"
            label={t.passwordLabel}
            type="password"
            placeholder={t.passwordPlaceholder}
            value={loginPassword}
            onChange={setLoginPassword}
            required
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t.loggingIn : t.loginBtn}
          </button>
          <div className="text-center">
            <a href={`/forgot-password?lang=${locale}`} className="text-sm text-[var(--accent)] hover:underline">
              {t.forgotPassword}
            </a>
          </div>
        </form>
      )}

      {tab === "register" && (
        <form onSubmit={handleRegister} className="flex flex-col gap-4" noValidate>
          <FormInput
            id="reg_name"
            label={t.nameLabel}
            type="text"
            placeholder={t.namePlaceholder}
            value={regName}
            onChange={setRegName}
            required
            autoComplete="name"
          />
          <FormInput
            id="reg_mobile"
            label={t.mobileLabel}
            type="tel"
            placeholder={t.mobilePlaceholder}
            value={regMobile}
            onChange={setRegMobile}
            required
            autoComplete="tel"
          />
          <FormInput
            id="reg_email"
            label={t.emailLabel}
            type="email"
            placeholder={t.emailPlaceholder}
            value={regEmail}
            onChange={setRegEmail}
            required
            autoComplete="email"
          />
          <FormInput
            id="reg_password"
            label={t.passwordLabel}
            type="password"
            placeholder={t.passwordPlaceholder}
            value={regPassword}
            onChange={setRegPassword}
            required
            autoComplete="new-password"
          />
          <FormInput
            id="reg_confirm"
            label={t.confirmPasswordLabel}
            type="password"
            placeholder={t.confirmPasswordPlaceholder}
            value={regConfirm}
            onChange={setRegConfirm}
            required
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t.registering : t.registerBtn}
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [legalLinks, setLegalLinks] = useState<{
    terms_link_label_bn?: string | null;
    terms_link_label_en?: string | null;
    privacy_link_label_bn?: string | null;
    privacy_link_label_en?: string | null;
  } | null>(null);

  const authRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const roadmapRef = useRef<HTMLDivElement>(null);

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
    fetch(`${API_BASE_URL}/public/platform-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) setLegalLinks(json.data);
      })
      .catch(() => {
        // footer legal labels fall back to defaults below
      });
  }, []);

  const text = useMemo(() => content[locale], [locale]);
  const cards = useMemo(() => modules[locale], [locale]);
  const year = new Date().getFullYear();

  function goToAuth(tab: AuthTab) {
    setAuthTab(tab);
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const termsLabel =
    (locale === "bn" ? legalLinks?.terms_link_label_bn : legalLinks?.terms_link_label_en) ||
    (locale === "bn" ? "ব্যবহারের শর্তাবলি" : "Terms of Use");
  const privacyLabel =
    (locale === "bn" ? legalLinks?.privacy_link_label_bn : legalLinks?.privacy_link_label_en) ||
    (locale === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy");

  return (
    <div className="min-h-screen w-full">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/app-icon-1024.png"
              alt={text.brandName}
              width={38}
              height={38}
              className="rounded-xl border border-[var(--border)]"
              priority
            />
            <span className="text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg">
              {text.brandName}
            </span>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <button
              type="button"
              onClick={() => scrollTo(featuresRef)}
              className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {text.nav.features}
            </button>
            <button
              type="button"
              onClick={() => scrollTo(roadmapRef)}
              className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {text.nav.roadmap}
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
              title={text.languageLabel}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] sm:text-sm"
            >
              <Languages size={16} />
              <span className="hidden sm:inline">{locale === "bn" ? "বাংলা" : "English"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={text.themeLabel}
              className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2 text-[var(--foreground)] transition hover:bg-[var(--surface)]"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => goToAuth("login")}
              className="hidden rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] sm:inline-flex"
            >
              {text.nav.login}
            </button>
            <button
              type="button"
              onClick={() => goToAuth("register")}
              className="rounded-xl bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {text.nav.signup}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Hero */}
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10">
          <div className="space-y-5">
            <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--muted)] sm:text-sm">
              {text.badge}
            </span>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--foreground)] sm:text-4xl lg:text-5xl">
              {text.title}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
              {text.subtitle}
            </p>

            <ul className="flex flex-col gap-2.5 pt-1 sm:gap-3">
              {text.heroHighlights.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--foreground)] sm:text-base">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                    <BadgeCheck size={14} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => goToAuth("register")}
                className="inline-flex items-center rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:text-base"
              >
                {text.ctaPrimary}
              </button>
              <button
                type="button"
                onClick={() => scrollTo(featuresRef)}
                className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] sm:text-base"
              >
                {text.ctaSecondary}
              </button>
            </div>
          </div>

          {/* Auth card */}
          <div
            ref={authRef}
            className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg shadow-black/5 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">
              {text.auth.authSectionTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{text.auth.authSectionSubtitle}</p>
            <div className="mt-5">
              <AuthSection locale={locale} t={text.auth} tab={authTab} onTabChange={setAuthTab} />
            </div>
          </div>
        </section>

        {/* Stat strip */}
        <section className="mt-8 grid grid-cols-2 gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] p-5 sm:grid-cols-4 sm:p-6">
          {text.statStrip.map((stat) => (
            <div key={stat.label} className="text-center sm:text-left">
              <p className="text-lg font-bold text-[var(--foreground)] sm:text-2xl">{stat.value}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* Features */}
        <section ref={featuresRef} id="features" className="mt-16 scroll-mt-20">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {text.sectionTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{text.sectionDescription}</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]/40 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
                    <Icon size={20} />
                  </span>
                  <h4 className="mt-3.5 text-base font-semibold text-[var(--foreground)]">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Benefits */}
        <section className="mt-16 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-10">
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                {text.benefitsTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{text.benefitsDescription}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {text.readyItems.map((item, idx) => {
                  const Icon = benefitIcons[idx % benefitIcons.length];
                  return (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3.5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent)]">
                        <Icon size={16} />
                      </span>
                      <span className="text-sm leading-6 text-[var(--foreground)]">{item}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Decorative abstract dashboard illustration */}
            <div className="relative hidden aspect-[4/3] w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/15 via-transparent to-[var(--accent)]/5" />
              <div className="absolute left-6 right-6 top-6 h-8 rounded-lg bg-[var(--surface)] shadow-sm" />
              <div className="absolute left-6 top-20 h-24 w-[46%] rounded-2xl bg-[var(--surface)] shadow-sm" />
              <div className="absolute right-6 top-20 h-24 w-[46%] rounded-2xl bg-[var(--accent)]/20" />
              <div className="absolute bottom-6 left-6 right-6 h-28 rounded-2xl bg-[var(--surface)] shadow-sm">
                <div className="flex h-full items-end gap-2 px-4 pb-4">
                  {[40, 65, 50, 80, 60, 90, 45].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="w-full rounded-md bg-[var(--accent)]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section ref={roadmapRef} id="roadmap" className="mt-16 scroll-mt-20">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {text.roadmapTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{text.roadmapDescription}</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {text.roadmap.map((item, idx) => (
              <div
                key={item.phase}
                className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                  {idx + 1}
                </span>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {item.phase}
                </p>
                <h4 className="mt-1 text-base font-semibold text-[var(--foreground)]">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="mt-16 overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/80 p-6 text-center sm:p-10">
          <h3 className="text-xl font-bold text-white sm:text-2xl">{text.ctaBandTitle}</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/85 sm:text-base">{text.ctaBandSubtitle}</p>
          <button
            type="button"
            onClick={() => goToAuth("register")}
            className="mt-5 inline-flex items-center rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-[var(--accent)] shadow-sm transition hover:opacity-90 sm:text-base"
          >
            {text.ctaBandButton}
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-[var(--border)]">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <Image
                src="/app-icon-1024.png"
                alt={text.brandName}
                width={32}
                height={32}
                className="rounded-lg border border-[var(--border)]"
              />
              <span className="text-base font-bold text-[var(--foreground)]">{text.brandName}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">{text.footerTagline}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{text.footerProductTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>
                <button type="button" onClick={() => scrollTo(featuresRef)} className="hover:text-[var(--foreground)]">
                  {text.nav.features}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo(roadmapRef)} className="hover:text-[var(--foreground)]">
                  {text.nav.roadmap}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{text.footerAccountTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>
                <button type="button" onClick={() => goToAuth("login")} className="hover:text-[var(--foreground)]">
                  {text.nav.login}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => goToAuth("register")} className="hover:text-[var(--foreground)]">
                  {text.nav.signup}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{text.footerLegalTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>
                <a href={`/terms?lang=${locale}`} className="hover:text-[var(--foreground)]">
                  {termsLabel}
                </a>
              </li>
              <li>
                <a href={`/privacy?lang=${locale}`} className="hover:text-[var(--foreground)]">
                  {privacyLabel}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--border)] px-4 py-5 text-center text-xs text-[var(--muted)] sm:px-6 lg:px-8">
          {text.copyright(year)}
        </div>
      </footer>
    </div>
  );
}
