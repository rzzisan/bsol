"use client";

import { useCallback, useState } from "react";

interface EmailVerificationBannerProps {
  userEmail: string;
  onInitiateVerification: () => Promise<void>;
  locale?: "en" | "bn";
}

const text = {
  bn: {
    title: "ইমেইল ভেরিফিকেশন প্রয়োজন",
    message: "অনুগ্রহ করে আপনার ইমেইল ভেরিফাই করুন।",
    verifyButton: "ভেরিফাই করুন",
    verifying: "ভেরিফাই করছে...",
    closeButton: "বন্ধ করুন",
  },
  en: {
    title: "Email Verification Required",
    message: "Please verify your email to continue.",
    verifyButton: "Verify Email",
    verifying: "Verifying...",
    closeButton: "Dismiss",
  },
};

export default function EmailVerificationBanner({
  userEmail,
  onInitiateVerification,
  locale = "en",
}: EmailVerificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const t = text[locale];

  const handleVerify = useCallback(async () => {
    try {
      setIsLoading(true);
      await onInitiateVerification();
    } finally {
      setIsLoading(false);
    }
  }, [onInitiateVerification]);

  if (!isVisible) return null;

  return (
    <div className="mb-4 flex items-center gap-4 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex-1">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100">{t.title}</h3>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
          {t.message} ({userEmail})
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleVerify}
          disabled={isLoading}
          className="whitespace-nowrap rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isLoading ? t.verifying : t.verifyButton}
        </button>
        <button
          onClick={() => setIsVisible(false)}
          disabled={isLoading}
          className="whitespace-nowrap rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:text-amber-100 dark:hover:bg-amber-900"
        >
          {t.closeButton}
        </button>
      </div>
    </div>
  );
}
