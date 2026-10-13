import type { Locale } from "@/lib/dashboard-client";

export type BlockItem = { id: string; [key: string]: unknown };

// Section-wide settings that live outside the per-item arrays (they apply to
// every item of that type), edited from the first item of the section.
export type SectionSettings = {
  featuresTitle: string;
  featuresLayout: "cards" | "list" | "minimal";
  trustBadgesLayout: "cards" | "row" | "minimal";
};

export type BlockEditorProps = {
  item: BlockItem;
  patch: (changes: Record<string, unknown>) => void;
  locale: Locale;
  // Opens the media library for this item; the picked URL lands in `field`.
  openMedia: (field: string) => void;
  isFirstOfType: boolean;
  section: SectionSettings;
  onSectionChange: (changes: Partial<SectionSettings>) => void;
};
