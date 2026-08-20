"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type DeliveryStatus = {
  product_name: string | null;
  delivery_type: "hosted_file" | "external_url";
  status: string;
  expired: boolean;
  downloads_used: number;
  max_downloads: number;
  otp_required: boolean;
  otp_verified: boolean;
  otp_sent: boolean;
  otp_target: string | null;
  can_download: boolean;
};

const TEXT = {
  bn: {
    loading: "লোড হচ্ছে...",
    notFound: "এই লিংকটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।",
    expired: "এই ডাউনলোড লিংকের মেয়াদ শেষ হয়ে গেছে।",
    exhausted: "সর্বোচ্চ ডাউনলোড সীমা শেষ হয়ে গেছে।",
    sendCode: (target: string) => `${target} নম্বরে/ইমেইলে একটি কোড পাঠান`,
    sendCodeBtn: "কোড পাঠান",
    codeSent: "কোড পাঠানো হয়েছে। নিচে লিখুন।",
    codePlaceholder: "৬-সংখ্যার কোড",
    verify: "যাচাই করুন",
    verifying: "যাচাই হচ্ছে...",
    sending: "পাঠানো হচ্ছে...",
    wrongCode: "ভুল কোড। আবার চেষ্টা করুন।",
    sendFailed: "কোড পাঠানো যায়নি।",
    download: "ডাউনলোড করুন",
    downloadsInfo: (used: number, max: number) => `${used} / ${max} বার ব্যবহৃত`,
    verified: "ভেরিফাই সম্পন্ন — এখন ডাউনলোড করতে পারেন।",
  },
  en: {
    loading: "Loading...",
    notFound: "This link is invalid or has expired.",
    expired: "This download link has expired.",
    exhausted: "The maximum number of downloads has been reached.",
    sendCode: (target: string) => `Send a code to ${target}`,
    sendCodeBtn: "Send code",
    codeSent: "Code sent. Enter it below.",
    codePlaceholder: "6-digit code",
    verify: "Verify",
    verifying: "Verifying...",
    sending: "Sending...",
    wrongCode: "Incorrect code. Please try again.",
    sendFailed: "Could not send the code.",
    download: "Download",
    downloadsInfo: (used: number, max: number) => `Used ${used} / ${max}`,
    verified: "Verified — you can download now.",
  },
};

export default function DigitalDownloadPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const language: "bn" | "en" = typeof navigator !== "undefined" && navigator.language?.startsWith("en") ? "en" : "bn";
  const t = TEXT[language];

  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otpCode, setOtpCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    const res = await fetch(`/api/public/digital-deliveries/${encodeURIComponent(token)}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setStatus(json.data as DeliveryStatus);
    setLoading(false);
  }

  useEffect(() => {
    if (token) loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function sendOtp() {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/public/digital-deliveries/${encodeURIComponent(token)}/send-otp`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(json.message === "no_recipient" || json.message === "send_failed" ? t.sendFailed : t.sendFailed);
      return;
    }
    await loadStatus();
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    const res = await fetch(`/api/public/digital-deliveries/${encodeURIComponent(token)}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp_code: otpCode }),
    });
    const json = await res.json().catch(() => ({}));
    setVerifying(false);
    if (!res.ok) {
      setError(t.wrongCode);
      return;
    }
    await loadStatus();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-500">
        {t.loading}
      </main>
    );
  }

  if (notFound || !status) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-red-600">{t.notFound}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{status.product_name ?? "—"}</h1>

        {status.expired ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{t.expired}</p>
        ) : status.downloads_used >= status.max_downloads ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{t.exhausted}</p>
        ) : status.delivery_type === "external_url" || !status.otp_required || status.otp_verified ? (
          <div className="mt-5">
            {status.otp_required && status.otp_verified ? (
              <p className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{t.verified}</p>
            ) : null}
            <a
              href={`/api/public/digital-deliveries/${encodeURIComponent(token)}/download`}
              className="block rounded-2xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              {t.download}
            </a>
            <p className="mt-3 text-center text-xs text-slate-400">
              {t.downloadsInfo(status.downloads_used, status.max_downloads)}
            </p>
          </div>
        ) : (
          <div className="mt-5">
            {error ? <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

            {!status.otp_sent ? (
              <button
                type="button"
                onClick={sendOtp}
                disabled={sending}
                className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sending ? t.sending : status.otp_target ? t.sendCode(status.otp_target) : t.sendCodeBtn}
              </button>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-3">
                <p className="text-sm text-slate-500">{t.codeSent}</p>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder={t.codePlaceholder}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-lg tracking-widest text-slate-900"
                />
                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {verifying ? t.verifying : t.verify}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
