import type { StorefrontHome } from "@/lib/storefront-client";

/** Floating green WhatsApp circle — same wa.me deep-link logic as ContactButtons, no API calls. */
export default function CaresolutionWhatsAppFloat({ home }: { home: StorefrontHome | null }) {
  if (!home || !home.show_whatsapp_button) return null;

  const waNumber = home.whatsapp_number?.replace(/[^\d]/g, "");
  if (!waNumber) return null;
  const waWithCountry = !waNumber.startsWith("880") ? `880${waNumber.replace(/^0/, "")}` : waNumber;
  const message = encodeURIComponent(`${home.shop_name ?? "শপ"} থেকে কেনাকাটা সম্পর্কে জানতে চাই।`);

  return (
    <a
      href={`https://wa.me/${waWithCountry}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-xl md:bottom-6"
    >
      🟢
    </a>
  );
}
