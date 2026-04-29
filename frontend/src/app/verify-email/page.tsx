"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getStoredToken, getStoredUser, setStoredUser, type AuthUser } from "@/lib/dashboard-client";

const text = {
  bn: {
    title: "ইমেইল ভেরিফিকেশন",
    subtitle: "আপনার ইমেইল ভেরিফাই করতে নিচের যেকোনো একটি পদ্ধতি ব্যবহার করুন।",
    otpTab: "OTP দিয়ে ভেরিফাই করুন",
    linkTab: "লিংক দিয়ে ভেরিফাই করুন",
    otpDescription: "আপনার ইমেইলে পাঠানো 6 অঙ্কের OTP দিয়ে ভেরিফাই করুন।",
    linkDescription: "আপনার ইমেইলে পাঠানো লিংক এ ক্লিক করুন।",
    otpLabel: "OTP কোড",
    otpPlaceholder: "000000",
    verifyButton: "ভেরিফাই করুন",
    verifying: "ভেরিফাই করছে...",
    resendButton: "আবার পাঠান",
    resending: "পাঠাচ্ছে...",
    loginRequired: "ভেরিফিকেশনের জন্য লগইন করুন।",
    goHome: "হোমে যান",
    success: "ইমেইল ভেরিফিকেশন সফল!",
    successMessage: "আপনার ইমেইল সফলভাবে ভেরিফাই হয়েছে।",
    goToDashboard: "ড্যাশবোর্ডে যান",
    error: "একটি ত্রুটি ঘটেছে।",
    remainingAttempts: "বাকি চেষ্টা:",
  },
  en: {
    title: "Email Verification",
    subtitle: "Verify your email using one of the methods below.",
    otpTab: "Verify with OTP",
    linkTab: "Verify with Link",
    otpDescription: "Enter the 6-digit code sent to your email.",
    linkDescription: "Click the link sent to your email.",
    otpLabel: "OTP Code",
    otpPlaceholder: "000000",
    verifyButton: "Verify",
    verifying: "Verifying...",
    resendButton: "Resend OTP",
    resending: "Resending...",
    loginRequired: "Please login first to verify your email.",
    goHome: "Go Home",
    success: "Email verification successful!",
    successMessage: "Your email has been successfully verified.",
    goToDashboard: "Go to Dashboard",
    error: "An error occurred.",
    remainingAttempts: "Remaining attempts:",
  },
};

function parseApiPayload(raw: string): Record<string, unknown> {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { message: raw };
  }
}

function syncStoredUserFromApi(userPayload: unknown): void {
  if (!userPayload || typeof userPayload !== "object") return;

  const apiUser = userPayload as Record<string, unknown>;
  const currentUser = getStoredUser();

  const fallback: AuthUser = currentUser ?? {
    id: Number(apiUser.id ?? 0),
    name: String(apiUser.name ?? ""),
    email: String(apiUser.email ?? ""),
    mobile: (apiUser.mobile as string | null | undefined) ?? null,
    role: apiUser.role === "admin" ? "admin" : "user",
    email_verified_at: (apiUser.email_verified_at as string | null | undefined) ?? null,
    mobile_verified_at: (apiUser.mobile_verified_at as string | null | undefined) ?? null,
  };

  const nextUser: AuthUser = {
    ...fallback,
    ...apiUser,
    id: Number(apiUser.id ?? fallback.id),
    name: String(apiUser.name ?? fallback.name),
    email: String(apiUser.email ?? fallback.email),
    mobile: (apiUser.mobile as string | null | undefined) ?? fallback.mobile ?? null,
    role: (apiUser.role as "admin" | "user" | undefined) ?? fallback.role ?? "user",
  };

  setStoredUser(nextUser);
}

function getErrorMessage(data: Record<string, unknown>, fallback: string): string {
  return typeof data.message === "string" && data.message.trim().length > 0
    ? data.message
    : fallback;
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locale, setLocale] = useState<"en" | "bn">("en");
  const [activeTab, setActiveTab] = useState<"otp" | "link">("otp");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState("");

  const t = text[locale];
  const token = typeof window !== "undefined" ? sessionStorage.getItem("email_verification_token") : null;
  const linkToken = searchParams.get("token");

  // Handle link-based verification
  useEffect(() => {
    if (linkToken) {
      handleLinkVerification(linkToken);
    }
  }, [linkToken]);

  // Load locale
  useEffect(() => {
    const storedLocale = localStorage.getItem("locale") as "en" | "bn" | null;
    if (storedLocale) {
      setLocale(storedLocale);
    }
  }, []);

  // Restore cooldown
  useEffect(() => {
    const cooldownEnd = sessionStorage.getItem("email_resend_cooldown_end");
    if (cooldownEnd) {
      const remaining = Math.max(0, (parseInt(cooldownEnd) - Date.now()) / 1000);
      if (remaining > 0) {
        setResendCooldown(Math.ceil(remaining));
      }
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  // Restore email
  useEffect(() => {
    const stored = sessionStorage.getItem("email_verification_email");
    if (stored) {
      setMaskedEmail(stored);
    }
  }, []);

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);
  };

  const handleOtpVerify = async () => {
    if (otp.length !== 6) {
      setError("Please enter a 6-digit OTP");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authToken = getStoredToken();

      const response = await fetch("/api/email/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({token, otp}),
      });

      const raw = await response.text();
      const data = parseApiPayload(raw);

      if (response.ok) {
        if (data.user) {
          syncStoredUserFromApi(data.user);
        }
        sessionStorage.removeItem("email_verification_token");
        sessionStorage.removeItem("email_verification_email");
        sessionStorage.removeItem("email_resend_cooldown_end");
        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setError(getErrorMessage(data, t.error));
        if (typeof data.remaining_attempts === "number") {
          setRemainingAttempts(data.remaining_attempts);
        }
      }
    } catch (err) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkVerification = async (verifyToken: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/email/verify-link?token=${encodeURIComponent(verifyToken)}`, {
        method: "GET",
      });

      const data = await response.json();

      if (response.ok) {
        if (data.user) {
          syncStoredUserFromApi(data.user);
        }
        sessionStorage.removeItem("email_verification_token");
        sessionStorage.removeItem("email_verification_email");
        sessionStorage.removeItem("email_resend_cooldown_end");
        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setError(data.message || t.error);
      }
    } catch (err) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const authToken = getStoredToken();

      const response = await fetch("/api/email/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({token}),
      });

      const raw = await response.text();
      const data = parseApiPayload(raw);

      if (response.ok) {
        const nextResendSeconds =
          typeof data.next_resend_after_seconds === "number" ? data.next_resend_after_seconds : 120;

        setResendCooldown(nextResendSeconds);
        sessionStorage.setItem(
          "email_resend_cooldown_end",
          (Date.now() + nextResendSeconds * 1000).toString()
        );
        setOtp("");
      } else {
        setError(getErrorMessage(data, t.error));
        if (typeof data.retry_after_seconds === "number") {
          setResendCooldown(data.retry_after_seconds);
        }
      }
    } catch (err) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  if (!token && !linkToken) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">{t.loginRequired}</p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
            {t.goHome}
          </a>
        </section>
      </main>
    );
  }

  if (success) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md px-4 py-8">
        <section className="rounded-3xl border border-green-300 bg-green-50 p-6 text-center dark:border-green-700 dark:bg-green-950">
          <div className="text-4xl">✓</div>
          <h1 className="mt-3 text-xl font-semibold text-green-900 dark:text-green-100 sm:text-2xl">
            {t.success}
          </h1>
          <p className="mt-3 text-sm text-green-700 dark:text-green-200 sm:text-base">{t.successMessage}</p>
          <a href="/dashboard" className="mt-5 inline-flex rounded-xl bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700">
            {t.goToDashboard}
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-8">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t.title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t.subtitle}</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-950">
            {error}
            {remainingAttempts !== null && <div className="mt-2">{t.remainingAttempts} {remainingAttempts}</div>}
          </div>
        )}

        <div className="mt-6 flex gap-2 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab("otp")}
            className={`px-4 py-2 font-semibold ${
              activeTab === "otp"
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            {t.otpTab}
          </button>
          <button
            onClick={() => setActiveTab("link")}
            className={`px-4 py-2 font-semibold ${
              activeTab === "link"
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            {t.linkTab}
          </button>
        </div>

        {activeTab === "otp" && (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-[var(--muted)]">{t.otpDescription}</p>
              {maskedEmail && <p className="mt-1 text-xs text-[var(--muted)]">Email: {maskedEmail}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)]">{t.otpLabel}</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
                placeholder={t.otpPlaceholder}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-center text-lg font-semibold text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleOtpVerify}
                disabled={loading || otp.length !== 6}
                className="flex-1 rounded-lg bg-[var(--accent)] py-3 font-semibold text-white disabled:opacity-50"
              >
                {loading ? t.verifying : t.verifyButton}
              </button>
              <button
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="flex-1 rounded-lg border border-[var(--accent)] py-3 font-semibold text-[var(--accent)] disabled:opacity-50"
              >
                {loading || resendCooldown > 0 ? `${t.resending}${resendCooldown > 0 ? ` (${resendCooldown}s)` : ""}` : t.resendButton}
              </button>
            </div>
          </div>
        )}

        {activeTab === "link" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-[var(--muted)]">{t.linkDescription}</p>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-center">
              <p className="text-sm text-[var(--muted)]">Click the link in your email to verify.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
