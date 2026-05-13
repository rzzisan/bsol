export type FunnelBlockType =
  | "hero"
  | "trust_bar"
  | "benefits"
  | "testimonials"
  | "faq"
  | "cta"
  | "product_cards"
  | "order_bump"
  | "upsell"
  | "thank_you";

export type FunnelBlockDefinition = {
  type: FunnelBlockType;
  label: { bn: string; en: string };
  description: { bn: string; en: string };
  defaultSettings: Record<string, unknown>;
  defaultContent: Record<string, unknown>;
};

export const FUNNEL_BLOCK_REGISTRY: FunnelBlockDefinition[] = [
  {
    type: "hero",
    label: { bn: "হিরো সেকশন", en: "Hero Section" },
    description: { bn: "প্রধান headline ও CTA", en: "Main headline and CTA" },
    defaultSettings: { container: "wide", align: "center", background: "#ffffff" },
    defaultContent: { title: "Big offer headline", subtitle: "Short conversion-focused message", cta_text: "Get Started" },
  },
  {
    type: "trust_bar",
    label: { bn: "ট্রাস্ট বার", en: "Trust Bar" },
    description: { bn: "বিশ্বাসযোগ্যতা badges", en: "Trust badges and confidence markers" },
    defaultSettings: { style: "inline", icon_size: "md" },
    defaultContent: { items: ["Secure checkout", "Cash on delivery", "Fast support"] },
  },
  {
    type: "benefits",
    label: { bn: "বিনিফিটস", en: "Benefits" },
    description: { bn: "মূল উপকারিতা লিস্ট", en: "Primary benefit list" },
    defaultSettings: { columns: 3 },
    defaultContent: { heading: "Why choose this", points: ["Benefit 1", "Benefit 2", "Benefit 3"] },
  },
  {
    type: "testimonials",
    label: { bn: "টেস্টিমোনিয়ালস", en: "Testimonials" },
    description: { bn: "কাস্টমার feedback", en: "Customer proof and feedback" },
    defaultSettings: { layout: "cards" },
    defaultContent: { heading: "What customers say", items: [{ name: "Customer", quote: "Great product" }] },
  },
  {
    type: "faq",
    label: { bn: "FAQ", en: "FAQ" },
    description: { bn: "সাধারণ প্রশ্ন ও উত্তর", en: "Frequently asked questions" },
    defaultSettings: { accordion: true },
    defaultContent: { heading: "Frequently Asked Questions", items: [{ q: "Question", a: "Answer" }] },
  },
  {
    type: "cta",
    label: { bn: "CTA", en: "Call To Action" },
    description: { bn: "কনভার্সন বোতাম", en: "Primary conversion section" },
    defaultSettings: { style: "solid", size: "lg" },
    defaultContent: { title: "Ready to continue?", cta_text: "Continue" },
  },
  {
    type: "product_cards",
    label: { bn: "প্রোডাক্ট কার্ড", en: "Product Cards" },
    description: { bn: "প্রোডাক্ট/package showcase", en: "Product/package showcase" },
    defaultSettings: { columns: 2 },
    defaultContent: { heading: "Choose your package", products: [] },
  },
  {
    type: "order_bump",
    label: { bn: "অর্ডার বাম্প", en: "Order Bump" },
    description: { bn: "Checkout upsell checkbox", en: "Checkout add-on offer" },
    defaultSettings: { position: "checkout" },
    defaultContent: { title: "Add this special offer", price: 199 },
  },
  {
    type: "upsell",
    label: { bn: "আপসেল", en: "Upsell" },
    description: { bn: "Post-checkout upsell", en: "One-click upsell section" },
    defaultSettings: { one_click: true },
    defaultContent: { title: "Upgrade your order", price: 499 },
  },
  {
    type: "thank_you",
    label: { bn: "থ্যাঙ্ক ইউ", en: "Thank You" },
    description: { bn: "Order confirmation section", en: "Order completion section" },
    defaultSettings: { show_order_summary: true },
    defaultContent: { title: "Thank you for your order", subtitle: "We received your request" },
  },
];

export function getBlockDefinition(type: string): FunnelBlockDefinition | null {
  return FUNNEL_BLOCK_REGISTRY.find((item) => item.type === type) ?? null;
}
