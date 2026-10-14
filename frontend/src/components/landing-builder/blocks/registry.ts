// One entry per block type: label, icon, default values for a new item and
// the editor form. Adding a block type means adding a file here and one
// registry entry (plus its renderer in public-landing-page-view.tsx).
import type { ComponentType } from "react";
import { HelpCircle, Image as ImageIcon, Images, LayoutGrid, Rows3, ShieldCheck, Star, Timer, Type, Video } from "lucide-react";
import type { Locale } from "@/lib/dashboard-client";
import type { BlockType } from "@/lib/landing-layout";
import type { BlockEditorProps } from "./types";
import { CarouselEditor, carouselDefaults } from "./carousel";
import { CountdownEditor, countdownDefaults } from "./countdown";
import { FaqEditor, faqDefaults } from "./faq";
import { FeaturesEditor, featuresDefaults } from "./features";
import { HtmlSectionEditor } from "./html-section";
import { ImageTextEditor, imageTextDefaults } from "./image-text";
import { ReviewsEditor, reviewsDefaults } from "./reviews";
import { RichTextEditor, richTextDefaults } from "./rich-text";
import { SpacerEditor, spacerDefaults } from "./spacer";
import { TrustBadgesEditor, trustBadgesDefaults } from "./trust-badges";
import { VideoEditor, videoDefaults } from "./video";

export type BlockDefinition = {
  label: Record<Locale, string>;
  icon: ComponentType<{ size?: number }>;
  // Shown in the "add block" menus. Legacy and singleton types are not.
  addable: boolean;
  defaults: () => Record<string, unknown>;
  Editor: ComponentType<BlockEditorProps> | null;
};

export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  rich_text_blocks: { label: { bn: "রিচ টেক্সট", en: "Rich Text" }, icon: Type, addable: true, defaults: richTextDefaults, Editor: RichTextEditor },
  image_text_blocks: { label: { bn: "ছবি + টেক্সট", en: "Image + Text" }, icon: ImageIcon, addable: true, defaults: imageTextDefaults, Editor: ImageTextEditor },
  features: { label: { bn: "ফিচার গ্রিড", en: "Feature Grid" }, icon: LayoutGrid, addable: true, defaults: featuresDefaults, Editor: FeaturesEditor },
  trust_badges: { label: { bn: "ট্রাস্ট ব্যাজ", en: "Trust Badges" }, icon: ShieldCheck, addable: true, defaults: trustBadgesDefaults, Editor: TrustBadgesEditor },
  carousel_images: { label: { bn: "ইমেজ ক্যারুসেল", en: "Image Carousel" }, icon: Images, addable: true, defaults: carouselDefaults, Editor: CarouselEditor },
  video_embeds: { label: { bn: "ভিডিও", en: "Video Embed" }, icon: Video, addable: true, defaults: videoDefaults, Editor: VideoEditor },
  countdown_blocks: { label: { bn: "কাউন্টডাউন", en: "Countdown Timer" }, icon: Timer, addable: true, defaults: countdownDefaults, Editor: CountdownEditor },
  reviews: { label: { bn: "রিভিউ", en: "Reviews" }, icon: Star, addable: true, defaults: reviewsDefaults, Editor: ReviewsEditor },
  faq: { label: { bn: "FAQ", en: "FAQ" }, icon: HelpCircle, addable: true, defaults: faqDefaults, Editor: FaqEditor },
  spacers: { label: { bn: "স্পেসার", en: "Spacer" }, icon: Rows3, addable: true, defaults: spacerDefaults, Editor: SpacerEditor },
  html_sections: { label: { bn: "টেক্সট সেকশন", en: "Text Section" }, icon: Type, addable: false, defaults: () => ({}), Editor: HtmlSectionEditor },
  products: { label: { bn: "পণ্য ও চেকআউট", en: "Products & Checkout" }, icon: LayoutGrid, addable: false, defaults: () => ({}), Editor: null },
};

// Registry order is the "add block" menu order.
export const ADDABLE_BLOCK_TYPES = (Object.keys(BLOCK_REGISTRY) as BlockType[]).filter((type) => BLOCK_REGISTRY[type].addable);

export function blockLabel(type: BlockType, locale: Locale): string {
  return BLOCK_REGISTRY[type].label[locale] ?? BLOCK_REGISTRY[type].label.en;
}
