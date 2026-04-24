"use client";

import { useEffect, useMemo, useState } from "react";

type Locale = "bn" | "en";
type ThemeMode = "dark" | "light";

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const content = {
  bn: {
    badge: "Hybrid Commerce SaaS Foundation",
    title: "বাংলাদেশি F-commerce ব্যবসার জন্য স্মার্ট অপারেশন প্ল্যাটফর্ম",
    subtitle:
      "অর্ডার, কুরিয়ার, ফেইক অর্ডার রিস্ক, ল্যান্ডিং পেজ, CRM এবং প্রফিট ট্র্যাকিং—সব এক প্ল্যাটফর্মে আনার জন্য বেস স্ট্রাকচার তৈরি করা হয়েছে।",
    ctaPrimary: "MVP Roadmap দেখুন",
    ctaSecondary: "API Health Check",
    sectionTitle: "Core Product Modules",
    sectionDescription:
      "নিচের মডিউলগুলো আপনার দেওয়া requirement অনুযায়ী সাজানো হয়েছে, যাতে ধাপে ধাপে production SaaS বানানো যায়।",
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
    footer: "এই স্ক্রিনটি এখন আপনার SaaS vision presentation এবং future dashboard shell হিসেবে কাজ করবে।",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
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
  },
};

const modules = {
  bn: [
    {
      title: "অটোমেটেড অর্ডার + কুরিয়ার",
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
        "Ad spend, cost of goods, delivery cost, এবং net margin analytics এক জায়গায়।",
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

export default function Home() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
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
                {([
                  ["bn", "বাংলা"],
                  ["en", "English"],
                ] as const).map(([key, label]) => (
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
                {([
                  ["dark", "Dark"],
                  ["light", "Light"],
                ] as const).map(([key, label]) => (
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

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{text.readyTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
            {text.readyItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article id="roadmap" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{text.roadmapTitle}</h3>
          <div className="mt-4 space-y-3">
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
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{text.sectionTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
          {text.sectionDescription}
        </p>
        <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--muted)] sm:text-base">
          {text.footer}
        </p>
      </section>
    </main>
  );
}
