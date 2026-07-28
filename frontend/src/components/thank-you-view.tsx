"use client";

import { mergeLandingContent, DEFAULT_THANK_YOU } from "@/lib/landing-pages";
import { resolveFontCssVar } from "@/lib/theme-presets";
import type { PublicLandingPage } from "@/components/public-landing-page-view";

export type ThankYouOrder = {
  order_number: string;
  created_at?: string | null;
  status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_district?: string | null;
  customer_thana?: string | null;
  customer_area?: string | null;
  subtotal?: string | number | null;
  shipping_charge?: string | number | null;
  discount?: string | number | null;
  total?: string | number | null;
  custom_fields?: Array<{ key: string; label: string; value: string }> | null;
  items?: Array<{
    product_name: string;
    quantity: number;
    unit_price?: string | number | null;
    total?: string | number | null;
  }>;
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `৳${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "৳0.00";
}

export default function ThankYouView({
  page,
  order,
}: {
  page: PublicLandingPage;
  order: ThankYouOrder | null;
}) {
  const theme = {
    primary: page?.theme_settings?.primary_color ?? "#0f766e",
    accent: page?.theme_settings?.accent_color ?? "#f97316",
    background: page?.theme_settings?.background_color ?? "#f8fafc",
    text: page?.theme_settings?.text_color ?? "#0f172a",
    buttonText: page?.theme_settings?.button_text_color ?? "#ffffff",
    fontFamily: page?.theme_settings?.font_family ?? "Hind Siliguri",
  };

  const content = mergeLandingContent(page.content, page.template);
  const thankYou = content.thank_you ?? DEFAULT_THANK_YOU;
  const showSummary = thankYou.show_order_summary ?? true;
  const showAddress = thankYou.show_shipping_address ?? true;
  const contactPhone = content.contact?.phone ?? null;

  const areaLine = order
    ? [order.customer_area, order.customer_thana, order.customer_district].filter((part) => (part ?? "").trim()).join(", ")
    : "";
  const discount = Number(order?.discount ?? 0);

  return (
    <main className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text }}>
      <style>{`
        .lp-shell { font-family: var(${resolveFontCssVar(theme.fontFamily)}), system-ui, -apple-system, sans-serif; }
        .lp-card { background: rgba(255,255,255,0.92); border: 1px solid rgba(148,163,184,0.18); box-shadow: 0 20px 50px rgba(15,23,42,0.08); }
        ${page.custom_css ?? ""}
      `}</style>

      <section
        className="lp-shell px-4 py-14 text-white"
        style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, #0b3b36 100%)` }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="mt-5 text-3xl font-extrabold sm:text-4xl">{thankYou.title || DEFAULT_THANK_YOU.title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/90 sm:text-lg">{thankYou.message || DEFAULT_THANK_YOU.message}</p>
          {order ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold">
              অর্ডার নম্বর: <span className="tracking-wide">{order.order_number}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="lp-shell mx-auto max-w-3xl px-4 py-10">
        <div className="space-y-6">
          {!order ? (
            <div className="lp-card rounded-3xl p-6 text-center sm:p-8">
              <p className="text-sm text-slate-600">অর্ডারের তথ্য পাওয়া যায়নি।</p>
              <a
                href={`/lp/${page.slug}`}
                className="mt-4 inline-flex rounded-2xl px-5 py-2.5 text-sm font-semibold"
                style={{ backgroundColor: theme.accent, color: theme.buttonText }}
              >
                ল্যান্ডিং পেজে ফিরে যান
              </a>
            </div>
          ) : (
            <>
              {showSummary ? (
                <div className="lp-card rounded-3xl p-6 sm:p-8">
                  <h2 className="text-xl font-bold" style={{ color: theme.primary }}>অর্ডার সামারী</h2>
                  <div className="mt-4 space-y-3">
                    {(order.items ?? []).map((item, index) => (
                      <div key={`${item.product_name}-${index}`} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
                        <div>
                          <div className="font-semibold text-slate-800">{item.product_name}</div>
                          <div className="mt-0.5 text-slate-500">{item.quantity} × {money(item.unit_price)}</div>
                        </div>
                        <div className="font-semibold text-slate-800">{money(item.total)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>সাবটোটাল</span>
                      <span>{money(order.subtotal)}</span>
                    </div>
                    {discount > 0 ? (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>ডিসকাউন্ট</span>
                        <span>-{money(discount)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>ডেলিভারি চার্জ</span>
                      <span>{money(order.shipping_charge)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold" style={{ color: theme.primary }}>
                      <span>সর্বমোট</span>
                      <span>{money(order.total)}</span>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-slate-500">
                    পেমেন্ট: {order.payment_method === "cod" ? "ক্যাশ অন ডেলিভারি" : order.payment_method ?? "—"}
                  </div>
                </div>
              ) : null}

              {showAddress ? (
                <div className="lp-card rounded-3xl p-6 sm:p-8">
                  <h2 className="text-xl font-bold" style={{ color: theme.primary }}>শিপিং ঠিকানা</h2>
                  <div className="mt-4 space-y-1.5 text-sm text-slate-700">
                    {order.customer_name ? <div className="font-semibold text-slate-800">{order.customer_name}</div> : null}
                    {order.customer_phone ? <div>{order.customer_phone}</div> : null}
                    {order.customer_address ? <div>{order.customer_address}</div> : null}
                    {areaLine ? <div>{areaLine}</div> : null}
                  </div>
                  {order.custom_fields?.length ? (
                    <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm text-slate-700">
                      {order.custom_fields.map((field) => (
                        <div key={field.key}>
                          <span className="font-medium text-slate-500">{field.label}:</span> {field.value}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <div className="text-center text-sm text-slate-500">
            {contactPhone ? <p>যেকোনো প্রয়োজনে কল করুন: <a href={`tel:${contactPhone}`} className="font-semibold" style={{ color: theme.primary }}>{contactPhone}</a></p> : null}
            <a href={`/lp/${page.slug}`} className="mt-2 inline-block font-medium hover:underline" style={{ color: theme.primary }}>
              ← আবার অর্ডার করুন
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
