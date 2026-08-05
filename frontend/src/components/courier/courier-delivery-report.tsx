"use client";

import type { Locale } from "@/lib/dashboard-client";

export type CourierCard = {
  name: string;
  data_type: "delivery" | "rating";
  total: number;
  success: number;
  cancelled: number;
  success_rate: number;
  rating: string | null;
  status: "ok" | "error" | "not_configured";
  message: string | null;
  last_checked_at: string | null;
  from_cache: boolean;
};

export type CourierCheckResult = {
  phone: string;
  overall: { total: number; success: number; cancelled: number; success_rate: number };
  couriers: CourierCard[];
};

const TXT = {
  bn: {
    courierTitle: "কুরিয়ার ডেলিভারি হিস্টোরি",
    courierChecking: "কুরিয়ার থেকে ডেটা আনা হচ্ছে...",
    overall: "সর্বমোট",
    successRate: "সাফল্যের হার",
    totalParcel: "মোট পার্সেল",
    success: "সফল",
    cancelled2: "বাতিল",
    notConfigured: "সেটআপ করা হয়নি",
    notConfiguredHint: "কুরিয়ার সেটিং-এ লগইন যোগ করুন",
    fetchFailed: "ডেটা আনা যায়নি",
    estimatedLabel: "আনুমানিক:",
    cachedBadge: "ক্যাশ",
  },
  en: {
    courierTitle: "Courier Delivery History",
    courierChecking: "Fetching data from couriers...",
    overall: "Overall",
    successRate: "Success Rate",
    totalParcel: "Total",
    success: "Success",
    cancelled2: "Cancelled",
    notConfigured: "Not configured",
    notConfiguredHint: "Add login in Courier Settings",
    fetchFailed: "Could not fetch data",
    estimatedLabel: "Estimated:",
    cachedBadge: "Cached",
  },
};

// Pathao's dashboard only exposes a qualitative rating label (e.g. "excellent_customer"),
// not raw delivery counts — map known keywords to a display label + color, best-effort.
function ratingDisplay(rating: string, locale: Locale): { label: string; color: string; estimate: string | null } {
  const r = rating.toLowerCase();
  if (r.includes("excellent")) return { label: locale === "bn" ? "চমৎকার গ্রাহক" : "Excellent Customer", color: "text-emerald-500", estimate: "~90-100%" };
  if (r.includes("good")) return { label: locale === "bn" ? "ভালো গ্রাহক" : "Good Customer", color: "text-emerald-400", estimate: "~70-89%" };
  if (r.includes("moderate")) return { label: locale === "bn" ? "মাঝারি" : "Moderate", color: "text-amber-500", estimate: "~50-69%" };
  if (r.includes("risky") || r.includes("bad")) return { label: locale === "bn" ? "ঝুঁকিপূর্ণ" : "Risky Customer", color: "text-red-500", estimate: "<50%" };
  if (r.includes("new")) return { label: locale === "bn" ? "নতুন গ্রাহক" : "New Customer", color: "text-[var(--muted)]", estimate: null };
  return { label: rating.replace(/_/g, " "), color: "text-[var(--muted)]", estimate: null };
}

const COURIER_META: Record<string, { label: string; header: string }> = {
  pathao: { label: "Pathao", header: "bg-red-600" },
  steadfast: { label: "Steadfast", header: "bg-teal-600" },
  redx: { label: "RedX", header: "bg-rose-700" },
  carrybee: { label: "CarryBee", header: "bg-amber-500 text-neutral-900" },
  paperfly: { label: "Paperfly", header: "bg-blue-600" },
};

function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={bold ? "font-bold text-emerald-500" : "font-semibold"}>{value}</span>
    </div>
  );
}

function Progress({ pct }: { pct: number }) {
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <div
        className="h-full rounded-full bg-emerald-500"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/**
 * Renders the "Courier Delivery History" panel — same UI as
 * dashboard/orders/fraud-check. Caller owns the fetch (see
 * `${API}/fraud/courier-check?phone=...`) and passes the result in;
 * this component is presentational only. Returns null when there's
 * nothing to show yet.
 */
export default function CourierDeliveryReportCard({
  courierData,
  courierChecking,
  courierErrorMsg,
  locale,
}: {
  courierData: CourierCheckResult | null;
  courierChecking: boolean;
  courierErrorMsg: string | null;
  locale: Locale;
}) {
  const txt = TXT[locale];

  if (!courierChecking && !courierData && !courierErrorMsg) return null;

  return (
    <div className="catv-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{txt.courierTitle}</h3>
        {courierChecking && (
          <span className="text-xs text-[var(--muted)]">{txt.courierChecking}</span>
        )}
      </div>

      {courierErrorMsg && !courierData && (
        <p className="text-xs text-red-400">{courierErrorMsg}</p>
      )}

      {courierData && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          {/* Overall */}
          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="bg-violet-600 px-3 py-2 text-sm font-bold text-white">
              {txt.overall}
            </div>
            <div className="space-y-1 bg-[var(--background)] px-3 py-2.5 text-xs">
              <Row label={txt.successRate} value={`${courierData.overall.success_rate}%`} bold />
              <Row label={txt.totalParcel} value={courierData.overall.total} />
              <Row label={txt.success} value={courierData.overall.success} />
              <Row label={txt.cancelled2} value={courierData.overall.cancelled} />
              <Progress pct={courierData.overall.success_rate} />
            </div>
          </div>

          {courierData.couriers.map(card => {
            const meta = COURIER_META[card.name] ?? { label: card.name, header: "bg-neutral-600" };
            return (
              <div key={card.name} className="overflow-hidden rounded-2xl border border-[var(--border)]">
                <div className={`flex items-center justify-between px-3 py-2 text-sm font-bold text-white ${meta.header}`}>
                  <span>{meta.label}</span>
                  {card.from_cache && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                      {txt.cachedBadge}
                    </span>
                  )}
                </div>
                <div className="bg-[var(--background)] px-3 py-2.5 text-xs">
                  {card.status === "not_configured" ? (
                    <div className="py-3 text-center text-[var(--muted)]">
                      <p className="font-semibold">{txt.notConfigured}</p>
                      <p className="mt-1 text-[10px]">{txt.notConfiguredHint}</p>
                    </div>
                  ) : card.status === "error" ? (
                    <div className="py-3 text-center text-red-400">
                      <p className="font-semibold">{txt.fetchFailed}</p>
                      {card.message && <p className="mt-1 text-[10px] opacity-80">{card.message}</p>}
                    </div>
                  ) : card.data_type === "rating" && card.rating ? (
                    (() => {
                      const r = ratingDisplay(card.rating as string, locale);
                      return (
                        <div className="py-3 text-center">
                          <p className={`text-sm font-bold ${r.color}`}>{r.label}</p>
                          {r.estimate && (
                            <p className="mt-1 text-[10px] text-[var(--muted)]">
                              {txt.estimatedLabel} {r.estimate}
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="space-y-1">
                      <Row label={txt.successRate} value={`${card.success_rate}%`} bold />
                      <Row label={txt.totalParcel} value={card.total} />
                      <Row label={txt.success} value={card.success} />
                      <Row label={txt.cancelled2} value={card.cancelled} />
                      <Progress pct={card.success_rate} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
