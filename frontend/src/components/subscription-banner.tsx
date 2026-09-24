"use client";

interface SubscriptionBannerProps {
  status: string;
  daysLeft: number | null;
  isExpired: boolean;
  /** Customer orders placed while expired, hidden until renewal (backend HeldOrderService). */
  heldOrders?: number;
  heldExpireAt?: string | null;
  locale?: "en" | "bn";
}

const text = {
  bn: {
    expiredTitle: "সাবস্ক্রিপশনের মেয়াদ শেষ হয়ে গেছে",
    expiredMessage: "নতুন অর্ডার/কাস্টমার/প্রোডাক্ট যোগ করতে প্ল্যান রিনিউ করুন।",
    trialTitle: (days: number) => `আপনার ফ্রি ট্রায়ালের ${days} দিন বাকি`,
    trialMessage: "ট্রায়াল শেষ হওয়ার আগে একটি প্ল্যান বেছে নিন।",
    expiringTitle: (days: number) => `আপনার প্ল্যানের মেয়াদ ${days} দিনের মধ্যে শেষ হবে`,
    expiringMessage: "সেবা বিঘ্নিত না হতে এখনই রিনিউ করুন।",
    renewButton: "প্ল্যান দেখুন",
    heldTitle: (n: number) => `আপনার ${n}টি নতুন অর্ডার প্লেস হয়েছে`,
    heldMessage: (date: string | null) =>
      `দেখতে হলে প্ল্যান রিনিউ করুন।${date ? ` ${date}-এর মধ্যে রিনিউ না করলে এই অর্ডারগুলো মুছে যাবে।` : ""}`,
  },
  en: {
    expiredTitle: "Your subscription has expired",
    expiredMessage: "Renew your plan to keep creating orders, customers, and products.",
    trialTitle: (days: number) => `${days} day(s) left in your free trial`,
    trialMessage: "Pick a plan before your trial ends.",
    expiringTitle: (days: number) => `Your plan expires in ${days} day(s)`,
    expiringMessage: "Renew now to avoid any service interruption.",
    renewButton: "View Plans",
    heldTitle: (n: number) => `You have ${n} new order${n === 1 ? "" : "s"} waiting`,
    heldMessage: (date: string | null) =>
      `Renew your plan to view them.${date ? ` Orders not released by ${date} will be deleted.` : ""}`,
  },
};

export default function SubscriptionBanner({
  status,
  daysLeft,
  isExpired,
  heldOrders = 0,
  heldExpireAt = null,
  locale = "en",
}: SubscriptionBannerProps) {
  const t = text[locale];

  if (!isExpired && (daysLeft === null || daysLeft > 5)) return null;

  const isTrial = status === "trial";
  const title = isExpired
    ? t.expiredTitle
    : isTrial
    ? t.trialTitle(daysLeft ?? 0)
    : t.expiringTitle(daysLeft ?? 0);
  const message = isExpired ? t.expiredMessage : isTrial ? t.trialMessage : t.expiringMessage;
  const heldDate = heldExpireAt
    ? new Date(heldExpireAt).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB")
    : null;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-4 rounded-lg border-l-4 p-4 ${
        isExpired
          ? "border-rose-500 bg-rose-50 dark:bg-rose-950 dark:text-rose-100"
          : "border-amber-500 bg-amber-50 dark:bg-amber-950 dark:text-amber-100"
      }`}
    >
      <div className="flex-1">
        <h3 className={`font-semibold ${isExpired ? "text-rose-900 dark:text-rose-100" : "text-amber-900 dark:text-amber-100"}`}>
          {title}
        </h3>
        <p className={`mt-1 text-sm ${isExpired ? "text-rose-700 dark:text-rose-200" : "text-amber-700 dark:text-amber-200"}`}>
          {message}
        </p>
        {isExpired && heldOrders > 0 && (
          <div className="mt-3 rounded-md bg-rose-100 p-3 dark:bg-rose-900">
            <p className="font-semibold text-rose-900 dark:text-rose-100">{t.heldTitle(heldOrders)}</p>
            <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">{t.heldMessage(heldDate)}</p>
          </div>
        )}
      </div>
      <a
        href="/dashboard/settings/subscription"
        className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-white ${
          isExpired ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
        }`}
      >
        {t.renewButton}
      </a>
    </div>
  );
}
