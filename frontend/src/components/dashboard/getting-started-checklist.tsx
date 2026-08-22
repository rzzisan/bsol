"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredLocale, getStoredToken, getStoredUser, type Locale } from "@/lib/dashboard-client";

/**
 * Dashboard "Getting Started" checklist — production_audit_report_context.md
 * §7 (P1) / onboarding_checklist_context.md. Distinct from the mandatory
 * /onboarding gate (shop profile + subdomain, user-shell.tsx) — this is a
 * dismissible post-onboarding nudge, not a hard gate. Hidden entirely for
 * staff accounts (this guidance is owner-facing, same exemption the
 * mandatory onboarding gate already uses).
 */

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

type Step = { key: "profile" | "product" | "courier" | "payment"; done: boolean };
type State = { dismissed: boolean; shop_url: string | null; steps: Step[]; has_demo_products: boolean };

const t = {
  bn: {
    title: "শুরু করার ধাপসমূহ",
    subtitle: "আপনার শপ চালু করতে এই কাজগুলো করুন।",
    done: "সম্পন্ন",
    allDone: "🎉 সবগুলো ধাপ সম্পন্ন হয়েছে!",
    dismiss: "পরে দেখাবেন না",
    close: "বন্ধ করুন",
    shopLink: "আপনার শপের ঠিকানা",
    copy: "কপি করুন",
    copied: "কপি হয়েছে",
    visit: "শপ দেখুন",
    steps: {
      profile: { title: "শপ প্রোফাইল সেটআপ", desc: "সম্পন্ন হয়ে গেছে।", cta: null as string | null, href: "" },
      product: { title: "প্রথম পণ্য যোগ করুন", desc: "আপনার শপে অন্তত একটি পণ্য যোগ করুন।", cta: "পণ্য যোগ করুন", href: "/dashboard/products/create" },
      courier: { title: "কুরিয়ার কানেক্ট করুন", desc: "পার্সেল বুক করতে একটি কুরিয়ার সার্ভিস কানেক্ট করুন।", cta: "কুরিয়ার সেটআপ", href: "/dashboard/settings/courier" },
      payment: { title: "পেমেন্ট মেথড সেটআপ", desc: "কাস্টমার পেমেন্ট নেওয়ার জন্য একটি পেমেন্ট চ্যানেল চালু করুন।", cta: "পেমেন্ট সেটআপ", href: "/dashboard/settings/payments" },
    },
    demoLoad: "নমুনা পণ্য দেখুন",
    demoLoading: "লোড হচ্ছে...",
    demoRemove: "নমুনা মুছুন",
    demoHint: "বুঝতে সমস্যা হলে ৩টা নমুনা (ডেমো) পণ্য লোড করে ড্যাশবোর্ড ঘুরে দেখুন — এগুলো কখনো লাইভ শপে বা অর্ডারে দেখাবে না।",
  },
  en: {
    title: "Getting started",
    subtitle: "A few steps to get your shop up and running.",
    done: "Done",
    allDone: "🎉 All steps complete!",
    dismiss: "Don't show again",
    close: "Close",
    shopLink: "Your shop address",
    copy: "Copy",
    copied: "Copied",
    visit: "Visit shop",
    steps: {
      profile: { title: "Shop profile setup", desc: "Already done.", cta: null as string | null, href: "" },
      product: { title: "Add your first product", desc: "Add at least one real product to your shop.", cta: "Add product", href: "/dashboard/products/create" },
      courier: { title: "Connect a courier", desc: "Connect a courier service so you can book parcels.", cta: "Courier setup", href: "/dashboard/settings/courier" },
      payment: { title: "Set up a payment method", desc: "Turn on a payment channel so customers can pay.", cta: "Payment setup", href: "/dashboard/settings/payments" },
    },
    demoLoad: "Load sample products",
    demoLoading: "Loading...",
    demoRemove: "Remove sample data",
    demoHint: "Not sure where to start? Load 3 sample products to explore the dashboard — they never appear on your live shop or in real orders.",
  },
};

export default function GettingStartedChecklist() {
  const [locale] = useState<Locale>(getStoredLocale);
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const txt = t[locale];

  const isStaff = getStoredUser()?.is_staff ?? false;

  const authHeaders = () => ({ Accept: "application/json", Authorization: `Bearer ${getStoredToken()}` });

  const load = async () => {
    try {
      const res = await fetch(`${API}/dashboard/getting-started`, { headers: authHeaders() });
      if (res.ok) setState((await res.json()).data);
    } catch {
      /* dashboard still renders without the checklist */
    }
  };

  useEffect(() => {
    if (!isStaff) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isStaff || !state || state.dismissed) return null;

  const dismiss = async () => {
    setState({ ...state, dismissed: true });
    try {
      await fetch(`${API}/dashboard/getting-started/dismiss`, { method: "POST", headers: authHeaders() });
    } catch {
      /* already hidden client-side; next load will resync */
    }
  };

  const toggleDemo = async () => {
    setBusy(true);
    try {
      const method = state.has_demo_products ? "DELETE" : "POST";
      await fetch(`${API}/dashboard/getting-started/demo-products`, { method, headers: authHeaders() });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    if (!state.shop_url) return;
    void navigator.clipboard.writeText(state.shop_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const doneCount = state.steps.filter((s) => s.done).length;
  const allDone = doneCount === state.steps.length;
  const actionableSteps = state.steps.filter((s) => s.key !== "profile");

  return (
    <section className="catv-panel relative mb-4 p-4 sm:p-5">
      <button
        type="button"
        onClick={() => void dismiss()}
        aria-label={txt.close}
        className="absolute right-3 top-3 text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ✕
      </button>

      <h3 className="text-base font-semibold">{txt.title}</h3>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{txt.subtitle}</p>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${(doneCount / state.steps.length) * 100}%` }}
        />
      </div>

      {allDone ? (
        <p className="mt-4 text-sm font-semibold text-emerald-500">{txt.allDone}</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {actionableSteps.map((step) => {
            const meta = txt.steps[step.key];
            return (
              <div
                key={step.key}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                  step.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-[var(--border)] bg-[var(--surface-soft)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step.done ? "bg-emerald-500 text-white" : "border border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{meta.title}</p>
                    {!step.done && <p className="text-xs text-[var(--muted)]">{meta.desc}</p>}
                  </div>
                </div>

                {!step.done && meta.href && (
                  <Link
                    href={meta.href}
                    className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    {meta.cta}
                  </Link>
                )}

                {step.key === "product" && !step.done && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleDemo()}
                    className="shrink-0 text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
                  >
                    {busy ? txt.demoLoading : state.has_demo_products ? txt.demoRemove : txt.demoLoad}
                  </button>
                )}
              </div>
            );
          })}
          {!state.steps.find((s) => s.key === "product")?.done && (
            <p className="px-1 text-xs text-[var(--muted)]">{txt.demoHint}</p>
          )}
        </div>
      )}

      {state.shop_url && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs text-[var(--muted)]">{txt.shopLink}</p>
            <p className="truncate text-sm font-medium">{state.shop_url}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface)]"
            >
              {copied ? txt.copied : txt.copy}
            </button>
            <a
              href={state.shop_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface)]"
            >
              {txt.visit}
            </a>
          </div>
        </div>
      )}

      {allDone && (
        <button
          type="button"
          onClick={() => void dismiss()}
          className="mt-4 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-soft)]"
        >
          {txt.dismiss}
        </button>
      )}
    </section>
  );
}
