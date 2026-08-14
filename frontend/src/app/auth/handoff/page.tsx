"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getStoredLocale,
  mergeAuthPayload,
  setStoredToken,
  setStoredUser,
  type Locale,
} from "@/lib/dashboard-client";

/**
 * Second half of the subdomain login handoff (custom_domain_context.md §6).
 *
 * The seller signed in on bsol.<apex>, where no token was issued, and was
 * sent here with a single-use code. This page trades that code for a token
 * belonging to *this* origin.
 *
 * The exchange deliberately uses a same-origin relative URL rather than
 * NEXT_PUBLIC_API_BASE_URL: the backend only accepts a code on the host it
 * was minted for, so posting to bsol's absolute API URL would always fail
 * the host check.
 */

const t = {
  bn: {
    working: "সাইন ইন সম্পন্ন হচ্ছে...",
    missing: "সাইন ইন লিংকটি অসম্পূর্ণ।",
    failed: "এই সাইন ইন লিংকের মেয়াদ শেষ হয়ে গেছে বা আগেই ব্যবহার হয়েছে।",
    network: "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।",
    retry: "আবার লগইন করুন",
  },
  en: {
    working: "Finishing sign-in...",
    missing: "This sign-in link is incomplete.",
    failed: "This sign-in link has expired or has already been used.",
    network: "Network error. Please try again.",
    retry: "Log in again",
  },
};

function HandoffExchange() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = t[locale];
  const params = useSearchParams();
  const code = params.get("code");
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  // Derived rather than set from the effect: a missing code is knowable at
  // render time, and React 19 flags setState in an effect body.
  const error = code ? exchangeError : txt.missing;

  // A code is single-use, so React's development double-invoke of effects
  // would burn it on the first render and fail on the second.
  const attempted = useRef(false);

  useEffect(() => {
    if (!code || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const res = await fetch("/api/auth/handoff/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.token) {
          setExchangeError(data?.message ?? txt.failed);
          return;
        }

        const merged = mergeAuthPayload(data);
        setStoredToken(data.token);
        setStoredUser({ ...merged, role: merged.role === "admin" ? "admin" : "user" });

        // Full navigation, not router.push: the dashboard shell reads the
        // token from localStorage during its own mount.
        window.location.replace("/dashboard");
      } catch {
        setExchangeError(txt.network);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-200">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-8 text-center shadow-xl">
        {error ? (
          <>
            <p className="text-sm text-red-400">{error}</p>
            <a
              href={`https://bsol.${process.env.NEXT_PUBLIC_SUBDOMAIN_APEX ?? "zyrotechbd.com"}`}
              className="mt-5 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
            >
              {txt.retry}
            </a>
          </>
        ) : (
          <>
            <div
              className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500"
              aria-hidden
            />
            <p className="mt-4 text-sm text-slate-400">{txt.working}</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function HandoffPage() {
  return (
    <Suspense fallback={null}>
      <HandoffExchange />
    </Suspense>
  );
}
