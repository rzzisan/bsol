"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  getStoredLocale,
  getStoredTheme,
  LOCALE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
const text = {
  bn: {
    pageTitle: "পাসওয়ার্ড রিসেট",
    step1Title: "অ্যাকাউন্ট খুঁজুন",
    step1Subtitle: "আপনার ইমেইল অ্যাড্রেস বা মোবাইল নম্বর দিয়ে অ্যাকাউন্ট খুঁজুন।",
    identifierLabel: "ইমেইল বা মোবাইল নম্বর",
    identifierPlaceholder: "example@email.com বা 01XXXXXXXXX",
    findBtn: "খুঁজুন",
    finding: "খোঁজা হচ্ছে...",

    step2Title: "যোগাযোগের মাধ্যম বেছে নিন",
    step2Subtitle: "কোন মাধ্যমে পাসওয়ার্ড রিসেট OTP পাঠাবেন?",
    accountFound: "অ্যাকাউন্ট পাওয়া গেছে",
    emailMethod: "ইমেইল",
    smsMethod: "মোবাইল SMS",
    emailMethodHint: "OTP পাঠানো হবে:",
    smsMethodHint: "OTP পাঠানো হবে:",
    selectMethodFirst: "প্রথমে একটি মাধ্যম নির্বাচন করুন।",
    sendOtpBtn: "OTP পাঠান",
    sendingOtp: "পাঠানো হচ্ছে...",

    step3Title: "OTP যাচাই করুন",
    step3Subtitle: "আপনার ইমেইলে পাঠানো 6 সংখ্যার OTP কোড দিন।",
    step3SubtitleSms: "আপনার মোবাইলে পাঠানো 6 সংখ্যার OTP কোড দিন।",
    sentTo: "OTP পাঠানো হয়েছে:",
    otpLabel: "OTP কোড",
    otpPlaceholder: "000000",
    verifyBtn: "যাচাই করুন",
    verifying: "যাচাই হচ্ছে...",
    resendBtn: "আবার পাঠান",
    resending: "পাঠানো হচ্ছে...",
    remainingAttempts: "বাকি চেষ্টা:",
    resendAfter: "পুনরায় পাঠান:",
    secondsLabel: "সেকেন্ড পর",

    step4Title: "নতুন পাসওয়ার্ড সেট করুন",
    step4Subtitle: "আপনার নতুন পাসওয়ার্ড দিন।",
    newPasswordLabel: "নতুন পাসওয়ার্ড",
    newPasswordPlaceholder: "মিনিমাম ৮ অক্ষর",
    confirmPasswordLabel: "পাসওয়ার্ড নিশ্চিত করুন",
    confirmPasswordPlaceholder: "পাসওয়ার্ড আবার লিখুন",
    resetBtn: "পাসওয়ার্ড পরিবর্তন করুন",
    resetting: "পরিবর্তন হচ্ছে...",
    passwordMismatch: "পাসওয়ার্ড দুটি মিলছে না।",
    passwordTooShort: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে।",

    doneTitle: "পাসওয়ার্ড পরিবর্তন সফল!",
    doneSubtitle: "আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।",
    loginBtn: "লগইনে যান",

    backToLogin: "← লগইনে ফিরুন",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    otpDigitsError: "OTP অবশ্যই 6 সংখ্যার হতে হবে।",
    networkError: "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।",
  },
  en: {
    pageTitle: "Password Reset",
    step1Title: "Find Your Account",
    step1Subtitle: "Enter your email address or mobile number to find your account.",
    identifierLabel: "Email or Mobile Number",
    identifierPlaceholder: "example@email.com or 01XXXXXXXXX",
    findBtn: "Find Account",
    finding: "Searching...",

    step2Title: "Choose Delivery Method",
    step2Subtitle: "How would you like to receive the password reset OTP?",
    accountFound: "Account found",
    emailMethod: "Email",
    smsMethod: "Mobile SMS",
    emailMethodHint: "OTP will be sent to:",
    smsMethodHint: "OTP will be sent to:",
    selectMethodFirst: "Please select a delivery method first.",
    sendOtpBtn: "Send OTP",
    sendingOtp: "Sending...",

    step3Title: "Verify OTP",
    step3Subtitle: "Enter the 6-digit OTP sent to your email.",
    step3SubtitleSms: "Enter the 6-digit OTP sent to your mobile number.",
    sentTo: "OTP sent to:",
    otpLabel: "OTP Code",
    otpPlaceholder: "000000",
    verifyBtn: "Verify",
    verifying: "Verifying...",
    resendBtn: "Resend OTP",
    resending: "Resending...",
    remainingAttempts: "Remaining attempts:",
    resendAfter: "Resend after:",
    secondsLabel: "seconds",

    step4Title: "Set New Password",
    step4Subtitle: "Enter your new password below.",
    newPasswordLabel: "New Password",
    newPasswordPlaceholder: "Minimum 8 characters",
    confirmPasswordLabel: "Confirm Password",
    confirmPasswordPlaceholder: "Re-enter your password",
    resetBtn: "Reset Password",
    resetting: "Resetting...",
    passwordMismatch: "Passwords do not match.",
    passwordTooShort: "Password must be at least 8 characters.",

    doneTitle: "Password Reset Successful!",
    doneSubtitle: "Your password has been successfully changed. Please login with your new password.",
    loginBtn: "Go to Login",

    backToLogin: "← Back to Login",
    languageLabel: "Language",
    themeLabel: "Theme",
    otpDigitsError: "OTP must be 6 digits.",
    networkError: "Network error. Please try again.",
  },
};

type Step = "find" | "choose" | "otp" | "reset" | "done";
type DeliveryMethod = "email" | "sms";

// ---------------------------------------------------------------------------
// Main component (wrapped in Suspense for useSearchParams)
// ---------------------------------------------------------------------------
function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const initialLocale = (searchParams.get("lang") === "en" ? "en" : null) ?? getStoredLocale();

  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);

  const [step, setStep] = useState<Step>("find");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // Step 1 state
  const [identifier, setIdentifier] = useState("");

  // Step 2 state
  const [maskedEmail, setMaskedEmail] = useState("");
  const [maskedMobile, setMaskedMobile] = useState("");
  const [hasEmail, setHasEmail] = useState(false);
  const [hasMobile, setHasMobile] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<DeliveryMethod | null>(null);
  const [maskedTarget, setMaskedTarget] = useState("");

  // Step 3 state
  const [sessionToken, setSessionToken] = useState("");
  const [otp, setOtp] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Step 4 state
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const t = useMemo(() => text[locale], [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // -------------------------------------------------------------------------
  // Step 1: Find account
  // -------------------------------------------------------------------------
  async function handleFindAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/password/find-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = (await res.json()) as {
        message?: string;
        masked_email?: string | null;
        masked_mobile?: string | null;
        has_email?: boolean;
        has_mobile?: boolean;
      };
      if (!res.ok) {
        setError(data.message ?? "Error.");
        return;
      }
      const nextHasEmail = Boolean(data.has_email);
      const nextHasMobile = Boolean(data.has_mobile);
      setHasEmail(nextHasEmail);
      setHasMobile(nextHasMobile);
      setMaskedEmail(data.masked_email ?? "");
      setMaskedMobile(data.masked_mobile ?? "");
      setSelectedMethod(nextHasEmail ? "email" : nextHasMobile ? "sms" : null);
      setMaskedTarget("");
      setStep("choose");
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Send OTP via email
  // -------------------------------------------------------------------------
  async function handleSendOtp() {
    setError("");
    if (!selectedMethod) {
      setError(t.selectMethodFirst);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/password/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), method: selectedMethod }),
      });
      const data = (await res.json()) as {
        message?: string;
        token?: string;
        method?: DeliveryMethod;
        masked_target?: string;
        next_resend_after_seconds?: number;
      };
      if (!res.ok) {
        setError(data.message ?? "Error sending OTP.");
        return;
      }
      setSessionToken(data.token ?? "");
      setSelectedMethod((data.method as DeliveryMethod | undefined) ?? selectedMethod);
      setMaskedTarget(data.masked_target ?? "");
      setResendCountdown(data.next_resend_after_seconds ?? 120);
      setOtp("");
      setRemainingAttempts(null);
      setStep("otp");
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Verify OTP
  // -------------------------------------------------------------------------
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError(t.otpDigitsError);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken, otp }),
      });
      const data = (await res.json()) as {
        message?: string;
        reset_token?: string;
        remaining_attempts?: number;
      };
      if (!res.ok) {
        setError(data.message ?? "Verification failed.");
        if (typeof data.remaining_attempts === "number") {
          setRemainingAttempts(data.remaining_attempts);
        }
        return;
      }
      setResetToken(data.reset_token ?? "");
      setNewPassword("");
      setConfirmPassword("");
      setStep("reset");
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP
  async function handleResendOtp() {
    if (resendCountdown > 0) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/password/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken }),
      });
      const data = (await res.json()) as {
        message?: string;
        method?: DeliveryMethod;
        masked_target?: string;
        next_resend_after_seconds?: number;
        retry_after_seconds?: number;
      };
      if (!res.ok) {
        setError(data.message ?? "Error resending OTP.");
        if (data.retry_after_seconds) setResendCountdown(data.retry_after_seconds);
        return;
      }
      setOtp("");
      setRemainingAttempts(null);
      if (data.method) setSelectedMethod(data.method);
      if (data.masked_target) setMaskedTarget(data.masked_target);
      setResendCountdown(data.next_resend_after_seconds ?? 300);
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Reset password
  // -------------------------------------------------------------------------
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError(t.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reset_token: resetToken,
          password: newPassword,
          password_confirmation: confirmPassword,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Reset failed.");
        return;
      }
      setStep("done");
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const stepNumber: Record<Step, number> = { find: 1, choose: 2, otp: 3, reset: 4, done: 4 };
  const totalSteps = 4;
  const currentStep = stepNumber[step];

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
    >
      {/* Header bar */}
      <header
        className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <a
          href={`/?lang=${locale}`}
          className="text-sm font-medium hover:underline"
          style={{ color: "var(--accent)" }}
        >
          {t.backToLogin}
        </a>
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
            className="rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            {locale === "bn" ? "EN" : "বাং"}
          </button>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-md px-4 py-8">
        {/* Page title */}
        <h1 className="mb-6 text-center text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          {t.pageTitle}
        </h1>

        {/* Progress steps (1–4) */}
        {step !== "done" && (
          <div className="mb-8 flex items-center justify-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => {
              const n = i + 1;
              const isDone = n < currentStep;
              const isActive = n === currentStep;
              return (
                <div key={n} className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: isDone || isActive ? "var(--accent)" : "var(--surface-soft)",
                      color: isDone || isActive ? "#fff" : "var(--muted)",
                      border: `2px solid ${isDone || isActive ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {isDone ? "✓" : n}
                  </div>
                  {n < totalSteps && (
                    <div
                      className="h-0.5 w-8"
                      style={{ backgroundColor: n < currentStep ? "var(--accent)" : "var(--border)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl border p-6 shadow-sm"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          {/* ----------------------------------------------------------------
              Step 1: Find account
          ---------------------------------------------------------------- */}
          {step === "find" && (
            <>
              <h2 className="mb-1 text-lg font-semibold">{t.step1Title}</h2>
              <p className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
                {t.step1Subtitle}
              </p>
              <form onSubmit={handleFindAccount} className="flex flex-col gap-4" noValidate>
                <div>
                  <label
                    htmlFor="identifier"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    {t.identifierLabel}
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={t.identifierPlaceholder}
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !identifier.trim()}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {loading ? t.finding : t.findBtn}
                </button>
              </form>
            </>
          )}

          {/* ----------------------------------------------------------------
              Step 2: Choose delivery method
          ---------------------------------------------------------------- */}
          {step === "choose" && (
            <>
              <h2 className="mb-1 text-lg font-semibold">{t.step2Title}</h2>
              <p className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
                {t.step2Subtitle}
              </p>

              {/* Account found badge */}
              <div
                className="mb-4 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}
              >
                <span className="font-medium" style={{ color: "var(--accent)" }}>
                  ✓ {t.accountFound}
                </span>
              </div>

              {hasEmail && (
                <button
                  type="button"
                  onClick={() => setSelectedMethod("email")}
                  className="mb-3 w-full rounded-xl border px-4 py-4 flex items-center gap-3 text-left"
                  style={{
                    borderColor: selectedMethod === "email" ? "var(--accent)" : "var(--border)",
                    backgroundColor: "var(--surface-soft)",
                  }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    @
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{t.emailMethod}</p>
                    <p className="text-xs truncate" style={{ color: "var(--muted)" }}>
                      {t.emailMethodHint} <span className="font-medium">{maskedEmail}</span>
                    </p>
                  </div>
                  <div
                    className="h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: selectedMethod === "email" ? "var(--accent)" : "var(--border)" }}
                  >
                    {selectedMethod === "email" && (
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                    )}
                  </div>
                </button>
              )}

              {hasMobile && (
                <button
                  type="button"
                  onClick={() => setSelectedMethod("sms")}
                  className="mb-5 w-full rounded-xl border px-4 py-4 flex items-center gap-3 text-left"
                  style={{
                    borderColor: selectedMethod === "sms" ? "var(--accent)" : "var(--border)",
                    backgroundColor: "var(--surface-soft)",
                  }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    📱
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{t.smsMethod}</p>
                    <p className="text-xs truncate" style={{ color: "var(--muted)" }}>
                      {t.smsMethodHint} <span className="font-medium">{maskedMobile}</span>
                    </p>
                  </div>
                  <div
                    className="h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: selectedMethod === "sms" ? "var(--accent)" : "var(--border)" }}
                  >
                    {selectedMethod === "sms" && (
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                    )}
                  </div>
                </button>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading || !selectedMethod}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {loading ? t.sendingOtp : t.sendOtpBtn}
              </button>
            </>
          )}

          {/* ----------------------------------------------------------------
              Step 3: Verify OTP
          ---------------------------------------------------------------- */}
          {step === "otp" && (
            <>
              <h2 className="mb-1 text-lg font-semibold">{t.step3Title}</h2>
              <p className="mb-1 text-sm" style={{ color: "var(--muted)" }}>
                {selectedMethod === "sms" ? t.step3SubtitleSms : t.step3Subtitle}
              </p>
              <p className="mb-5 text-sm font-medium" style={{ color: "var(--accent)" }}>
                {t.sentTo} {maskedTarget || (selectedMethod === "sms" ? maskedMobile : maskedEmail)}
              </p>

              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4" noValidate>
                <div>
                  <label htmlFor="otp" className="mb-1.5 block text-sm font-medium">
                    {t.otpLabel}
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={t.otpPlaceholder}
                    required
                    autoComplete="one-time-code"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm text-center tracking-widest outline-none transition"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--foreground)",
                      fontSize: "1.25rem",
                      letterSpacing: "0.3em",
                    }}
                  />
                </div>

                {remainingAttempts !== null && (
                  <p className="text-xs text-red-400">
                    {t.remainingAttempts} {remainingAttempts}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {loading ? t.verifying : t.verifyBtn}
                </button>

                {/* Resend */}
                <div className="text-center text-sm" style={{ color: "var(--muted)" }}>
                  {resendCountdown > 0 ? (
                    <span>
                      {t.resendAfter} {resendCountdown} {t.secondsLabel}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="font-medium hover:underline disabled:opacity-60"
                      style={{ color: "var(--accent)" }}
                    >
                      {loading ? t.resending : t.resendBtn}
                    </button>
                  )}
                </div>
              </form>
            </>
          )}

          {/* ----------------------------------------------------------------
              Step 4: Reset password
          ---------------------------------------------------------------- */}
          {step === "reset" && (
            <>
              <h2 className="mb-1 text-lg font-semibold">{t.step4Title}</h2>
              <p className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
                {t.step4Subtitle}
              </p>
              <form onSubmit={handleResetPassword} className="flex flex-col gap-4" noValidate>
                <div>
                  <label htmlFor="new_password" className="mb-1.5 block text-sm font-medium">
                    {t.newPasswordLabel}
                  </label>
                  <input
                    id="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t.newPasswordPlaceholder}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium">
                    {t.confirmPasswordLabel}
                  </label>
                  <input
                    id="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t.confirmPasswordPlaceholder}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {loading ? t.resetting : t.resetBtn}
                </button>
              </form>
            </>
          )}

          {/* ----------------------------------------------------------------
              Done
          ---------------------------------------------------------------- */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}
              >
                ✓
              </div>
              <div>
                <h2 className="mb-2 text-xl font-bold">{t.doneTitle}</h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  {t.doneSubtitle}
                </p>
              </div>
              <a
                href={`/?lang=${locale}`}
                className="w-full rounded-xl py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {t.loginBtn}
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  );
}
