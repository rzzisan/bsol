"use client";

import type { StorefrontHome } from "@/lib/storefront-client";

/**
 * Call/WhatsApp/Messenger — plain tel:/wa.me/m.me deep-links, no API calls.
 * seller_storefront_context.md §7: independent of the paused WhatsApp Cloud
 * API automation feature, no Meta App Review dependency.
 */
export default function ContactButtons({ home, productName }: { home: StorefrontHome | null; productName: string }) {
  if (!home) return null;

  const waMessage = encodeURIComponent(`${productName} সম্পর্কে জানতে চাই।`);
  const waNumber = home.whatsapp_number?.replace(/[^\d]/g, "");
  const waWithCountry = waNumber && !waNumber.startsWith("880") ? `880${waNumber.replace(/^0/, "")}` : waNumber;

  const buttons: Array<{ key: string; show: boolean; href: string; label: string; className: string }> = [
    {
      key: "call",
      show: home.show_call_button && !!home.phone,
      href: `tel:${home.phone}`,
      label: "📞 Call for Order",
      className: "border border-slate-300 text-slate-700",
    },
    {
      key: "whatsapp",
      show: home.show_whatsapp_button && !!waWithCountry,
      href: `https://wa.me/${waWithCountry}?text=${waMessage}`,
      label: "🟢 Via WhatsApp",
      className: "bg-emerald-600 text-white",
    },
    {
      key: "messenger",
      show: home.show_messenger_button && !!home.messenger_page_id,
      href: `https://m.me/${home.messenger_page_id}`,
      label: "💬 Via Messenger",
      className: "bg-blue-600 text-white",
    },
  ];

  const visible = buttons.filter((b) => b.show);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((b) => (
        <a
          key={b.key}
          href={b.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-full px-4 py-2 text-center text-sm font-semibold ${b.className}`}
        >
          {b.label}
        </a>
      ))}
    </div>
  );
}
