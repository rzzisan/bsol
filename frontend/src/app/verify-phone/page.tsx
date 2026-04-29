"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

export default function VerifyPhonePage() {
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [maskedMobile, setMaskedMobile] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("otp_token");
    const storedMobile = sessionStorage.getItem("otp_mobile");
    const storedCooldown = Number(sessionStorage.getItem("otp_resend_cooldown") ?? "0");
    if (!storedToken) {
      // No session – redirect to home
      window.location.href = "/";
      return;
    }
    setToken(storedToken);
    setMaskedMobile(storedMobile ?? "");
    if (Number.isFinite(storedCooldown) && storedCooldown > 0) {
      setResendCooldown(Math.ceil(storedCooldown));
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) {
      sessionStorage.removeItem("otp_resend_cooldown");
      return;
    }

    sessionStorage.setItem("otp_resend_cooldown", String(resendCooldown));
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function formatCountdown(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/otp/verify-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "OTP verification failed.");
        if (data?.remaining_attempts !== undefined) {
          setRemainingAttempts(data.remaining_attempts as number);
        }
      } else {
        setSuccess(true);
        sessionStorage.removeItem("otp_token");
        sessionStorage.removeItem("otp_mobile");
        sessionStorage.removeItem("otp_resend_cooldown");

        // Persist auth and redirect
        localStorage.setItem("auth_token", data.token as string);
        const user = data.user as { role?: string };
        localStorage.setItem("auth_user", JSON.stringify({ ...user, role: user.role ?? "user" }));

        setTimeout(() => {
          window.location.href = user.role === "admin" ? "/admin" : "/dashboard";
        }, 1200);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!token) return;
    setError(null);
    setResending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/otp/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Could not resend OTP.");
        if (data?.retry_after_seconds !== undefined) {
          setResendCooldown(Math.max(0, Math.ceil(Number(data.retry_after_seconds) || 0)));
        }
      } else {
        setOtp("");
        setRemainingAttempts(null);
        setError(null);
        setResendCooldown(Math.max(0, Math.ceil(Number(data?.next_resend_after_seconds) || 0)));
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-sm text-[var(--muted)]">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-lg">
        {/* Icon */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/10 text-3xl">
            📱
          </div>
        </div>

        <h1 className="mb-1 text-center text-xl font-bold text-[var(--foreground)]">
          ফোন ভেরিফিকেশন
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--muted)]">
          {maskedMobile
            ? <>নম্বর <span className="font-semibold text-[var(--foreground)]">{maskedMobile}</span>-এ পাঠানো ৬ সংখ্যার OTP দিন</>
            : "আপনার মোবাইলে পাঠানো ৬ সংখ্যার OTP দিন"}
        </p>

        {success ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-green-400">✓ ভেরিফিকেশন সফল! রেজিস্ট্রেশন সম্পন্ন।</p>
            <p className="mt-1 text-xs text-[var(--muted)]">ড্যাশবোর্ডে নিয়ে যাওয়া হচ্ছে…</p>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4" noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                {error}
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <span className="block mt-1 text-xs">
                    বাকি সুযোগ: {remainingAttempts} বার
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label
                htmlFor="otp_input"
                className="text-xs font-semibold text-[var(--muted)]"
              >
                OTP কোড
              </label>
              <input
                id="otp_input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="_ _ _ _ _ _"
                value={otp}
                autoComplete="one-time-code"
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-[var(--foreground)] placeholder-[var(--muted)]/40 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "যাচাই করা হচ্ছে…" : "OTP যাচাই করুন"}
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition"
              >
                ← ফিরে যান
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                className="text-xs text-[var(--accent)] hover:underline disabled:opacity-50 transition"
              >
                {resending
                  ? "পাঠানো হচ্ছে…"
                  : resendCooldown > 0
                    ? `OTP আবার পাঠান (${formatCountdown(resendCooldown)})`
                    : "OTP আবার পাঠান"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
