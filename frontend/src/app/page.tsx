"use client";

import { useEffect, useMemo, useState } from "react";
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
    badge: "Hybrid Commerce SaaS Foundation",
    title: "বাংলাদেশি F-commerce ব্যবসার জন্য স্মার্ট অপারেশন প্ল্যাটফর্ম",
    subtitle:
      "অর্ডার, কুরিয়ার, ফেইক অর্ডার রিস্ক, ল্যান্ডিং পেজ, CRM এবং প্রফিট ট্র্যাকিং—সব এক প্ল্যাটফর্মে আনার জন্য বেস স্ট্রাকচার তৈরি করা হয়েছে।",
    ctaPrimary: "MVP Roadmap দেখুন",
    ctaSecondary: "API Health Check",
    sectionTitle: "Core Product Modules",
    sectionDescription:
      "নিচের মডিউলগুলো আপনার দেওয়া requirement অনুযায়ী সাজানো হয়েছে, যাতে ধাপে ধাপে production SaaS বানানো যায়।",
    readyTitle: "Foundation Ready",
    readyItems: [
      "মোবাইল-ফার্স্ট UI কাঠামো",
      "ডার্ক / লাইট থিম সুইচার",
      "বাংলা / English language toggle",
      "Feature-based modular layout",
      "Laravel API integration-ready frontend",
    ],
    roadmapTitle: "Suggested MVP Phases",
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
        title: "Landing + ROI Intelligence",
        detail: "Page builder blocks, custom domain mapping, ad spend sync, net profit and inventory insights.",
      },
    ],
    footer:
      "এই স্ক্রিনটি এখন আপনার SaaS vision presentation এবং future dashboard shell হিসেবে কাজ করবে।",
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
      authSectionTitle: "অ্যাকাউন্ট",
    },
  },
  en: {
    badge: "Hybrid Commerce SaaS Foundation",
    title: "Smart operations platform for Bangladesh F-commerce businesses",
    subtitle:
      "A strong base is now in place to unify orders, couriers, fake-order risk checks, landing pages, CRM, and profitability tracking in one SaaS product.",
    ctaPrimary: "View MVP roadmap",
    ctaSecondary: "API health check",
    sectionTitle: "Core Product Modules",
    sectionDescription:
      "These modules are organized directly from your requirements so you can ship in structured phases.",
    readyTitle: "Foundation Ready",
    readyItems: [
      "Mobile-first UI structure",
      "Dark / light theme switcher",
      "Bangla / English language toggle",
      "Feature-based modular layout",
      "Laravel API integration-ready frontend",
    ],
    roadmapTitle: "Suggested MVP Phases",
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
        title: "Landing + ROI Intelligence",
        detail: "Page builder blocks, custom domain mapping, ad spend sync, net profit and inventory insights.",
      },
    ],
    footer: "This screen now acts as your SaaS vision presenter and future dashboard shell.",
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
      authSectionTitle: "Account",
    },
  },
};

const modules = {
  bn: [
    {
      title: "অটোমেটেড অর্ডার + কুরিয়ার",
      description:
        "একটি single form থেকে Pathao / Steadfast / RedX integration-ready dispatch pipeline।",
    },
    {
      title: "ফেইক অর্ডার ফিল্টারিং",
      description:
        "ফোন নম্বর history, return behavior, এবং shared customer trust score ভিত্তিক risk indicator।",
    },
    {
      title: "ল্যান্ডিং পেজ + চেকআউট বিল্ডার",
      description:
        "Block-based builder, product highlights, instant order CTA, custom domain প্রস্তুতি।",
    },
    {
      title: "ইনভেন্টরি + Ads ROI",
      description:
        "Ad spend, cost of goods, delivery cost, এবং net margin analytics এক জায়গায়।",
    },
    {
      title: "মেসেঞ্জার CRM + ব্রডকাস্ট",
      description:
        "Customer labels, follow-up queue, personalized promotion broadcast workflow।",
    },
  ],
  en: [
    {
      title: "Automated Order + Courier",
      description:
        "A single order form feeding integration-ready dispatch flows for Pathao / Steadfast / RedX.",
    },
    {
      title: "Fake Order Filtering",
      description:
        "Phone-history, return behavior, and shared customer trust score driven risk indicators.",
    },
    {
      title: "Landing + Checkout Builder",
      description:
        "Block-based page builder with product sections, instant order CTA, and domain-ready setup.",
    },
    {
      title: "Inventory + Ads ROI",
      description:
        "Unified analytics for ad spend, cost of goods, delivery charge, and real net margin.",
    },
    {
      title: "Messenger CRM + Broadcast",
      description:
        "Customer labels, follow-up pipeline, and personalized promotional broadcasting workflow.",
    },
  ],
};

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
      <label
        htmlFor={id}
        className="text-xs font-semibold text-[var(--muted)] sm:text-sm"
      >
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
// Auth Section
// ---------------------------------------------------------------------------
function AuthSection({ locale, t }: { locale: Locale; t: typeof content["bn"]["auth"] }) {
  const [tab, setTab] = useState<AuthTab>("login");
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
        // Store verification session and redirect to OTP page
        sessionStorage.setItem("otp_token", data.token as string);
        sessionStorage.setItem("otp_mobile", data.mobile as string);
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
            onClick={() => { setTab(tabKey); clearErrors(); }}
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
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
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

  const text = useMemo(() => content[locale], [locale]);
  const cards = useMemo(() => modules[locale], [locale]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--muted)] sm:text-sm">
              {text.badge}
            </span>
            <h1 className="max-w-3xl text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl lg:text-5xl">
              {text.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
              {text.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1">
              <div className="px-2 pb-1 text-xs font-semibold text-[var(--muted)]">{text.languageLabel}</div>
              <div className="flex gap-1">
                {([["bn", "বাংলা"], ["en", "English"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLocale(key)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      locale === key
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--foreground)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1">
              <div className="px-2 pb-1 text-xs font-semibold text-[var(--muted)]">{text.themeLabel}</div>
              <div className="flex gap-1">
                {([["dark", "Dark"], ["light", "Light"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      theme === key
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--foreground)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#roadmap"
            className="inline-flex items-center rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {text.ctaPrimary}
          </a>
          <a
            href={`${API_BASE_URL}/health`}
            className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)]"
          >
            {text.ctaSecondary}
          </a>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-base font-semibold text-[var(--foreground)]">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article
          id="auth"
          className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
        >
          <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)] sm:text-xl">
            {text.auth.authSectionTitle}
          </h3>
          <AuthSection locale={locale} t={text.auth} />
        </article>

        <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{text.readyTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
            {text.readyItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section
        id="roadmap"
        className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      >
        <h3 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{text.roadmapTitle}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {text.roadmap.map((item) => (
            <div
              key={item.phase}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {item.phase}
              </p>
              <h4 className="mt-1 text-base font-semibold text-[var(--foreground)]">{item.title}</h4>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{text.sectionTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{text.sectionDescription}</p>
        <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--muted)] sm:text-base">
          {text.footer}
        </p>
      </section>
    </main>
  );
}
