import type { Locale } from "@/lib/dashboard-client";

export const BLOCK_TEXT = {
  bn: {
    featuresTitle: "ফিচার গ্রিড সেকশনের টাইটেল",
    featuresLayout: "ফিচার গ্রিডের লে-আউট",
    featuresLayoutCards: "কার্ড গ্রিড",
    featuresLayoutList: "লিস্ট",
    featuresLayoutMinimal: "মিনিমাল (আইকন সেন্টার)",
    trustBadgesLayout: "ট্রাস্ট ব্যাজের লে-আউট",
    trustBadgesLayoutCards: "কার্ড গ্রিড",
    trustBadgesLayoutRow: "কম্প্যাক্ট রো",
    trustBadgesLayoutMinimal: "মিনিমাল (আইকন সেন্টার)",
    sectionWideHint: "এই সেটিং পুরো সেকশনের সবগুলো আইটেমের জন্য প্রযোজ্য (শুধু প্রথম আইটেমে দেখানো হচ্ছে)।",
    invalidVideoUrl: "শুধু YouTube, Facebook বা Vimeo লিংক দেওয়া যাবে।",
    pickImages: "Gallery থেকে ছবি সিলেক্ট করুন",
    selectedCount: "Selected",
  },
  en: {
    featuresTitle: "Feature Grid section title",
    featuresLayout: "Feature Grid layout",
    featuresLayoutCards: "Card grid",
    featuresLayoutList: "List",
    featuresLayoutMinimal: "Minimal (centered icon)",
    trustBadgesLayout: "Trust Badges layout",
    trustBadgesLayoutCards: "Card grid",
    trustBadgesLayoutRow: "Compact row",
    trustBadgesLayoutMinimal: "Minimal (centered icon)",
    sectionWideHint: "This setting applies to the whole section (shown here on the first item only).",
    invalidVideoUrl: "Only YouTube, Facebook, or Vimeo links are allowed.",
    pickImages: "Pick images from gallery",
    selectedCount: "Selected",
  },
} satisfies Record<Locale, Record<string, string>>;

export function blockText(locale: Locale) {
  return BLOCK_TEXT[locale] ?? BLOCK_TEXT.en;
}

// Most block fields carry their own inline bn/en label.
export function tr(locale: Locale, bn: string, en: string) {
  return locale === "bn" ? bn : en;
}
