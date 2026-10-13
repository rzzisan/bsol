"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, Smartphone, Monitor, FileText, Palette, Layers, ShoppingBag, Settings as SettingsIcon } from "lucide-react";
import { getStoredToken, type Locale } from "@/lib/dashboard-client";
import { useLocale } from "@/lib/locale-context";
import {
  LANDING_API_BASE,
  type CheckoutFieldConfig,
  type LandingPageContent,
  type LandingPageProductInput,
  type LandingPageRecord,
  type LandingTemplate,
  type ProductItem,
  type AttachedVariant,
  getDefaultCheckoutFields,
  getDefaultThankYou,
  getDefaultSettings,
  OTP_SMS_TEMPLATE_PLACEHOLDERS,
  mergeLandingContent,
  toNumberOrNull,
} from "@/lib/landing-pages";
import { DEFAULT_THEME, type ThemeSettings } from "@/lib/theme-presets";
import LandingDesignPanel from "@/components/landing-design-panel";
import {
  BLOCK_TYPES,
  SINGLETON_BLOCK_TYPES,
  ensureItemIds,
  expandLegacyLayoutOrder,
  type BlockType,
  type LayoutEntry,
} from "@/lib/landing-layout";
import BlockList from "@/components/landing-builder/block-list";
import {
  TextField,
  TextAreaField,
  ImagePickerField,
  isAllowedVideoUrl,
} from "@/components/landing-builder/block-fields";
import PublicLandingPageView, { type PublicLandingPage } from "@/components/public-landing-page-view";
import { ADDABLE_BLOCK_TYPES, BLOCK_REGISTRY, blockLabel } from "@/components/landing-builder/blocks/registry";
import PreviewFrame, { type PreviewDevice } from "@/components/landing-builder/preview-frame";
import VariantPickerModal from "@/components/products/variant-picker-modal";
import type { ProductVariant } from "@/types/variant";

type LandingPageBuilderProps = {
  locale?: Locale;
  mode: "create" | "edit" | "admin-template";
  pageId?: string;
  // create mode: merchant picked a starter template before entering the builder.
  initialTemplateId?: string;
  // admin-template mode: seed content from a seller's existing landing page
  // (new template) or re-open an already-published template for editing.
  sourcePageId?: string;
  templateId?: string;
};

type MediaLibraryItem = { id: number; url: string; file_name?: string | null };
type MediaPolicy = { max_gallery_images: number; max_file_size_mb: number; allowed_mime_types: string[] };

type Item = { id: string; [key: string]: unknown };
type ContentState = Record<BlockType, Item[]>;

type ProductDraft = {
  product_id: number;
  // Set when the merchant pinned one exact variant instead of attaching the
  // whole product; `variant` is the resolved snapshot kept only for display
  // (label/image/price) — the backend only needs the id.
  product_variant_id: number | null;
  variant: AttachedVariant | null;
  title_override: string;
  subtitle: string;
  badge_text: string;
  price_override: string;
  default_qty: number;
  selected_by_default: boolean;
  sort_order: number;
};

function normalizeProductDraft(input: LandingPageProductInput & { product?: ProductItem | null; variant?: AttachedVariant | null }, index: number): ProductDraft {
  return {
    product_id: input.product_id,
    product_variant_id: input.product_variant_id ?? null,
    variant: input.variant ?? null,
    title_override: input.title_override ?? "",
    subtitle: input.subtitle ?? "",
    badge_text: input.badge_text ?? "",
    price_override: input.price_override == null ? "" : String(input.price_override),
    default_qty: input.default_qty ?? 1,
    selected_by_default: input.selected_by_default ?? true,
    sort_order: input.sort_order ?? index + 1,
  };
}

function variantLabel(variant: AttachedVariant | null): string {
  if (!variant) return "";
  return (variant.options ?? []).map((o) => o.label || o.value).filter(Boolean).join(" / ");
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

function emptyContentState(): ContentState {
  const state = {} as ContentState;
  for (const type of BLOCK_TYPES) state[type] = [];
  return state;
}

type TabKey = "content" | "design" | "blocks" | "products" | "settings";

const TAB_ORDER: TabKey[] = ["content", "design", "blocks", "products", "settings"];

const TAB_ICONS: Record<TabKey, React.ComponentType<{ size?: number }>> = {
  content: FileText,
  design: Palette,
  blocks: Layers,
  products: ShoppingBag,
  settings: SettingsIcon,
};

// Display labels for gateway_auto providers — see online_payment_context.md.
const GATEWAY_PROVIDER_LABELS: Record<string, string> = {
  sslcommerz: "SSLCommerz",
  aamarpay: "AamarPay",
  zinipay: "ZiniPay",
  shurjopay: "ShurjoPay",
  eps: "EPS",
  bkash_merchant: "bKash (Merchant)",
  nagad_merchant: "Nagad (Merchant)",
};

const text = {
  bn: {
    loading: "লোড হচ্ছে...",
    loadFailed: "ডেটা লোড করা যায়নি।",
    submitFailed: "সংরক্ষণ করা যায়নি।",
    createSuccess: "ল্যান্ডিং পেজ তৈরি হয়েছে।",
    updateSuccess: "ল্যান্ডিং পেজ আপডেট হয়েছে।",
    templateCreateSuccess: "টেমপ্লেট তৈরি হয়েছে।",
    templateUpdateSuccess: "টেমপ্লেট আপডেট হয়েছে।",
    templateInfoTitle: "টেমপ্লেট তথ্য",
    templateNameBn: "টেমপ্লেটের নাম (বাংলা)",
    templateNameEn: "টেমপ্লেটের নাম (English)",
    templateDescription: "বর্ণনা (ঐচ্ছিক)",
    templateScreenshot: "স্ক্রীনশট",
    templateScreenshotUpload: "স্ক্রীনশট আপলোড করুন",
    templateScreenshotUploading: "আপলোড হচ্ছে...",
    templateActive: "সক্রিয় (সেলাররা এখনই ব্যবহার করতে পারবে)",
    title: "পেজ শিরোনাম",
    slug: "স্লাগ",
    status: "স্ট্যাটাস",
    draft: "Draft",
    published: "Published",
    adminLockedTitle: "অ্যাডমিন এই পেজটি লক করে দিয়েছে",
    adminLockedBody: "এই পেজটি অ্যাডমিন আনপাবলিশ করে লক করে দিয়েছে। আপনি নিজে থেকে এটি আর পাবলিশ করতে পারবেন না, তবে ড্রাফট হিসেবে এডিট করে সংরক্ষণ করতে পারবেন।",
    adminLockedReason: "কারণ",
    hero: "Hero",
    heroHeadline: "Hero headline",
    heroSubheadline: "Hero subheadline",
    heroCtaText: "CTA বাটন টেক্সট",
    heroImage: "Hero ব্যাকগ্রাউন্ড ছবি (ঐচ্ছিক)",
    productsTitle: "প্রোডাক্ট সেকশনের টাইটেল",
    productsSubtitle: "প্রোডাক্ট সেকশনের সাবটাইটেল",
    checkoutFields: "চেকআউট ফর্ম ফিল্ড",
    checkoutFieldsHint: "কাস্টমারের কাছ থেকে কী কী তথ্য নেবেন তা ঠিক করুন — ড্র্যাগ করে সাজান।",
    addCustomField: "+ কাস্টম ফিল্ড",
    fieldTypeText: "টেক্সট",
    fieldTypeTextarea: "বড় টেক্সট",
    fieldTypeSelect: "ড্রপডাউন",
    fieldShown: "দেখাবে",
    fieldRequired: "বাধ্যতামূলক",
    fieldOptionsPlaceholder: "অপশন, কমা দিয়ে আলাদা করুন (যেমন: S, M, L)",
    tabContent: "কন্টেন্ট",
    tabDesign: "ডিজাইন",
    tabBlocks: "ব্লক",
    tabProducts: "প্রোডাক্ট ও চেকআউট",
    tabSettings: "সেটিংস",
    settingsTitle: "সেটিংস",
    pageLanguage: "পাবলিক পেজের ভাষা",
    pageLanguageHint: "কাস্টমার-facing checkout ও থ্যাংক ইউ পেজের ফিক্সড টেক্সট (যেমন লেবেল, বাটন) এই ভাষায় দেখাবে। বিদ্যমান কন্টেন্ট/টেক্সট (হিরো, ফিচার ইত্যাদি) বদলাবে না — শুধু ডিফল্ট প্লেসহোল্ডার (এখনো এডিট না করা থাকলে) নতুন ভাষায় বদলে যাবে।",
    pageLanguageBn: "বাংলা",
    pageLanguageEn: "English",
    phoneValidation: "ফোন নাম্বার ভ্যালিডেশন",
    phoneValidationHint: "চালু থাকলে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর ছাড়া অর্ডার করা যাবে না।",
    phoneValidationMessage: "ভুল নম্বরে দেখানোর মেসেজ",
    otpVerification: "OTP ফোন নাম্বার ভেরিফিকেশন",
    otpVerificationHint: "চালু থাকলে অর্ডার প্লেসের পর কাস্টমারকে থ্যাংক ইউ পেজে ৪ সংখ্যার OTP দিয়ে ফোন নাম্বার ভেরিফাই করতে হবে, তবেই অর্ডার Confirmed হবে। SMS ব্যালেন্স না থাকলে এটি বন্ধ থাকা অবস্থার মতোই কাজ করবে।",
    otpVerifiedMessage: "ভেরিফাই হলে থ্যাংক ইউ পেজে দেখানোর মেসেজ",
    otpSmsTemplate: "OTP SMS টেমপ্লেট",
    otpSmsTemplateHint: "ব্যবহারযোগ্য Placeholder:",
    otpFormTitle: "OTP ফর্মের শিরোনাম",
    otpFormDescription: "OTP ফর্মের বর্ণনা",
    otpFormButtonText: "কনফার্ম বাটনের টেক্সট",
    otpFormResendText: "পুনরায় পাঠান লিংকের টেক্সট",
    trackingEnabled: "মেটা (Facebook) ট্র্যাকিং",
    stickyCtaEnabled: "মোবাইলে নিচে স্থির অর্ডার বাটন",
    stickyCtaEnabledHint: "মোবাইলে স্ক্রল করার সময় স্ক্রিনের নিচে একটা অর্ডার বাটন থাকবে, চাপলে অর্ডার ফর্মে নিয়ে যাবে। উপরের বাটন বা অর্ডার ফর্ম দেখা গেলে লুকিয়ে যায়।",
    unsavedChanges: "সেভ করা হয়নি এমন পরিবর্তন আছে",
    allSaved: "সব পরিবর্তন সেভ হয়েছে",
    previewMobile: "মোবাইল",
    previewDesktop: "ডেস্কটপ",
    trackingEnabledHint: "চালু থাকলে এই পেজে Facebook Pixel/Conversions API ইভেন্ট পাঠানো হবে (আপনার ট্র্যাকিং কনফিগার করা থাকলে)। বন্ধ করলে এই নির্দিষ্ট পেজের জন্য ট্র্যাকিং সম্পূর্ণ বন্ধ হয়ে যাবে।",
    paymentChannelsTitle: "পেমেন্ট পদ্ধতি",
    paymentChannelsRestrict: "এই পেজের জন্য নির্দিষ্ট পেমেন্ট পদ্ধতি বেছে নিন",
    paymentChannelsHint: "বন্ধ থাকলে শপে যা যা চালু আছে (Settings → Online Payment Channels) সবই এই পেজের চেকআউটে দেখাবে।",
    paymentChannelCod: "ক্যাশ অন ডেলিভারি",
    paymentChannelNoWallet: "শপে কোনো অনলাইন পেমেন্ট চ্যানেল চালু নেই — Settings → Online Payment Channels থেকে চালু করুন।",
    paymentChannelsGatewaySection: "অটোমেটিক পেমেন্ট গেটওয়ে",
    save: "সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    blocksTitle: "পেজ ব্লক (ড্র্যাগ করে সাজান)",
    addBlock: "+ ব্লক যোগ করুন",
    remove: "মুছুন",
    invalidVideoUrl: "শুধু YouTube, Facebook বা Vimeo লিংক দেওয়া যাবে।",
    mediaTitle: "ছবি বাছাই করুন",
    mediaClose: "বন্ধ করুন",
    uploadImages: "নতুন ছবি আপলোড",
    seo: "SEO",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    thankYou: "Thank You পেজ",
    thankYouHint: "অর্ডার সাবমিটের পর কাস্টমার এই পেজটি দেখবে।",
    thankYouTitle: "টাইটেল",
    thankYouMessage: "কাস্টম মেসেজ",
    thankYouShowSummary: "অর্ডার সামারী দেখাবে",
    thankYouShowAddress: "শিপিং ঠিকানা দেখাবে",
    deliveryContact: "ডেলিভারি ও যোগাযোগ",
    deliveryContactHint: "পেজের নিচে দেখানো ডেলিভারি চার্জ ও যোগাযোগ নম্বর এখানে ঠিক করুন।",
    insideDhaka: "ঢাকার ভিতরে (ডেলিভারি চার্জ)",
    outsideDhaka: "ঢাকার বাইরে (ডেলিভারি চার্জ)",
    contactPhone: "যোগাযোগ ফোন নাম্বার (ঐচ্ছিক)",
    whatsappNumber: "WhatsApp নাম্বার (খালি রাখলে ফোন নাম্বারই ব্যবহার হবে)",
    floatingButtons: "পেজের কোণে ভাসমান কল ও WhatsApp বাটন দেখান",
    ogImage: "শেয়ার ছবি (Facebook/Messenger-এ লিংক শেয়ার করলে দেখাবে)",
    ogImageHint: "খালি রাখলে hero ছবি, না থাকলে প্রথম প্রোডাক্টের ছবি ব্যবহার হবে। ১২০০×৬৩০ মাপ সবচেয়ে ভালো।",
    customCss: "কাস্টম CSS (অ্যাডভান্সড)",
    customCssHint: "শুধু এই পেজে প্রযোজ্য হবে। ভুল CSS পেজের ডিজাইন ভেঙে দিতে পারে।",
    blockRemoved: "ব্লক মুছে ফেলা হয়েছে।",
    undo: "ফেরত আনুন",
    addBlockHere: "ব্লক যোগ করুন",
    livePreview: "লাইভ প্রিভিউ",
    livePreviewHint: "মার্চেন্ট ঠিক এই ভিউ-টাই লাইভ পেজে দেখবে — একই কম্পোনেন্ট ব্যবহার করা হয়েছে।",
    duplicate: "কপি করুন",
    products: "পণ্য ও চেকআউট",
    productsHint: "ডান পাশ থেকে পণ্য attach করুন, ড্র্যাগ করে order বদলান।",
    selectedProducts: "সংযুক্ত পণ্য",
    emptyProducts: "এখনও কোনো পণ্য attach করা হয়নি।",
    searchProducts: "পণ্য খুঁজুন...",
    noProducts: "কোনো পণ্য পাওয়া যায়নি।",
    attach: "যুক্ত করুন",
    overrideTitle: "টাইটেল ওভাররাইড",
    overrideSubtitle: "সাবটাইটেল",
    badge: "ব্যাজ",
    overridePrice: "দাম ওভাররাইড",
    defaultQty: "ডিফল্ট Qty",
    selectedByDefault: "ডিফল্ট সিলেক্টেড",
    dragHint: "ড্রাগ করে order বদলান",
  },
  en: {
    loading: "Loading...",
    loadFailed: "Failed to load data.",
    submitFailed: "Failed to save landing page.",
    createSuccess: "Landing page created.",
    updateSuccess: "Landing page updated.",
    templateCreateSuccess: "Template created.",
    templateUpdateSuccess: "Template updated.",
    templateInfoTitle: "Template info",
    templateNameBn: "Template name (Bengali)",
    templateNameEn: "Template name (English)",
    templateDescription: "Description (optional)",
    templateScreenshot: "Screenshot",
    templateScreenshotUpload: "Upload screenshot",
    templateScreenshotUploading: "Uploading...",
    templateActive: "Active (sellers can use it immediately)",
    title: "Page title",
    slug: "Slug",
    status: "Status",
    draft: "Draft",
    published: "Published",
    adminLockedTitle: "This page has been locked by the admin",
    adminLockedBody: "The admin has unpublished and locked this page. You can no longer publish it yourself, but you can still edit and save it as a draft.",
    adminLockedReason: "Reason",
    hero: "Hero",
    heroHeadline: "Hero headline",
    heroSubheadline: "Hero subheadline",
    heroCtaText: "CTA button text",
    heroImage: "Hero background image (optional)",
    productsTitle: "Products section title",
    productsSubtitle: "Products section subtitle",
    checkoutFields: "Checkout form fields",
    checkoutFieldsHint: "Decide what info you collect from customers — drag to reorder.",
    addCustomField: "+ Custom field",
    fieldTypeText: "Text",
    fieldTypeTextarea: "Long text",
    fieldTypeSelect: "Dropdown",
    fieldShown: "Shown",
    fieldRequired: "Required",
    fieldOptionsPlaceholder: "Comma-separated options (e.g. S, M, L)",
    tabContent: "Content",
    tabDesign: "Design",
    tabBlocks: "Blocks",
    tabProducts: "Products & Checkout",
    tabSettings: "Settings",
    settingsTitle: "Settings",
    pageLanguage: "Public page language",
    pageLanguageHint: "Fixed text on the customer-facing checkout and thank-you pages (labels, buttons, etc.) will show in this language. Existing content (hero, features, etc.) is unaffected — only default placeholders you haven't edited yet switch to the new language.",
    pageLanguageBn: "Bengali",
    pageLanguageEn: "English",
    phoneValidation: "Phone number validation",
    phoneValidationHint: "When on, orders require a valid 11-digit Bangladeshi mobile number.",
    phoneValidationMessage: "Message shown for an invalid number",
    otpVerification: "OTP phone number verification",
    otpVerificationHint: "When on, customers must verify their phone with a 4-digit OTP on the thank-you page before an order becomes Confirmed. If SMS balance runs out, this behaves as if it were off.",
    otpVerifiedMessage: "Message shown on the thank-you page once verified",
    otpSmsTemplate: "OTP SMS template",
    otpSmsTemplateHint: "Available placeholders:",
    otpFormTitle: "OTP form title",
    otpFormDescription: "OTP form description",
    otpFormButtonText: "Confirm button text",
    otpFormResendText: "Resend link text",
    trackingEnabled: "Meta (Facebook) tracking",
    stickyCtaEnabled: "Sticky order button on mobile",
    stickyCtaEnabledHint: "On mobile, an order button stays at the bottom of the screen while scrolling and jumps to the order form. It hides while the top button or the order form is in view.",
    unsavedChanges: "You have unsaved changes",
    allSaved: "All changes saved",
    previewMobile: "Mobile",
    previewDesktop: "Desktop",
    trackingEnabledHint: "When on, this page sends Facebook Pixel/Conversions API events (once you've configured tracking). Turning it off disables tracking for this specific page only.",
    paymentChannelsTitle: "Payment Methods",
    paymentChannelsRestrict: "Restrict payment methods for this page",
    paymentChannelsHint: "When off, this page's checkout shows everything the shop has enabled (Settings → Online Payment Channels).",
    paymentChannelCod: "Cash on delivery",
    paymentChannelNoWallet: "No online payment channel is enabled shop-wide yet — turn one on in Settings → Online Payment Channels.",
    paymentChannelsGatewaySection: "Automatic Payment Gateways",
    save: "Save",
    saving: "Saving...",
    blocksTitle: "Page blocks (drag to reorder)",
    addBlock: "+ Add block",
    remove: "Remove",
    invalidVideoUrl: "Only YouTube, Facebook, or Vimeo links are allowed.",
    mediaTitle: "Choose an image",
    mediaClose: "Close",
    uploadImages: "Upload new images",
    seo: "SEO",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    thankYou: "Thank You Page",
    thankYouHint: "Customers see this page after submitting an order.",
    thankYouTitle: "Title",
    thankYouMessage: "Custom message",
    thankYouShowSummary: "Show order summary",
    thankYouShowAddress: "Show shipping address",
    deliveryContact: "Delivery & Contact",
    deliveryContactHint: "Set the delivery charges and contact number shown near the bottom of the page.",
    insideDhaka: "Inside Dhaka (delivery charge)",
    outsideDhaka: "Outside Dhaka (delivery charge)",
    contactPhone: "Contact phone (optional)",
    whatsappNumber: "WhatsApp number (leave empty to use the phone number)",
    floatingButtons: "Show floating call and WhatsApp buttons in the page corner",
    ogImage: "Share image (shown when the link is shared on Facebook/Messenger)",
    ogImageHint: "If empty, the hero image is used, else the first product's photo. 1200×630 works best.",
    customCss: "Custom CSS (advanced)",
    customCssHint: "Applies to this page only. Broken CSS can break the page's design.",
    blockRemoved: "Block removed.",
    undo: "Undo",
    addBlockHere: "Add block",
    livePreview: "Live preview",
    livePreviewHint: "This is exactly what a merchant will see on the live page — same component.",
    duplicate: "Duplicate",
    products: "Products & Checkout",
    productsHint: "Attach products from the right, then drag to reorder them.",
    selectedProducts: "Attached products",
    emptyProducts: "No products attached yet.",
    searchProducts: "Search products...",
    noProducts: "No products found.",
    attach: "Attach",
    overrideTitle: "Title override",
    overrideSubtitle: "Subtitle",
    badge: "Badge",
    overridePrice: "Price override",
    defaultQty: "Default Qty",
    selectedByDefault: "Selected by default",
    dragHint: "Drag to reorder",
  },
};

export default function LandingPageBuilder({ locale: localeProp, mode, pageId, initialTemplateId, sourcePageId, templateId }: LandingPageBuilderProps) {
  const router = useRouter();
  const contextLocale = useLocale();
  const locale = localeProp ?? contextLocale;
  const t = text[locale] ?? text.en;
  const tabLabels: Record<TabKey, string> = {
    content: t.tabContent,
    design: t.tabDesign,
    blocks: t.tabBlocks,
    products: t.tabProducts,
    settings: t.tabSettings,
  };
  // Templates have no product list of their own (products are per-page,
  // attached from the seller's own inventory) — hide that tab when authoring
  // a template.
  const visibleTabs = TAB_ORDER.filter((tab) => mode !== "admin-template" || tab !== "products");
  const token = getStoredToken();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState<LandingPageRecord | null>(null);
  const [templates, setTemplates] = useState<LandingTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("content");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubheadline, setHeroSubheadline] = useState("");
  const [heroCtaText, setHeroCtaText] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [featuresTitle, setFeaturesTitle] = useState("");
  const [featuresLayout, setFeaturesLayout] = useState<"cards" | "list" | "minimal">("cards");
  const [trustBadgesLayout, setTrustBadgesLayout] = useState<"cards" | "row" | "minimal">("cards");
  const [productsTitle, setProductsTitle] = useState("");
  const [productsSubtitle, setProductsSubtitle] = useState("");
  const [pageLanguage, setPageLanguageState] = useState<"bn" | "en">("bn");
  const [checkoutFields, setCheckoutFields] = useState<CheckoutFieldConfig[]>(getDefaultCheckoutFields("bn"));
  const [draggingFieldKey, setDraggingFieldKey] = useState<string | null>(null);
  const [shippingInsideDhaka, setShippingInsideDhaka] = useState("80");
  const [shippingOutsideDhaka, setShippingOutsideDhaka] = useState("120");
  const [contactPhone, setContactPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [floatingButtons, setFloatingButtons] = useState(false);
  const [ogImage, setOgImage] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [lastRemoved, setLastRemoved] = useState<{ type: BlockType; item: Item; itemIndex: number; layoutIndex: number } | null>(null);
  const [thankYouTitle, setThankYouTitle] = useState(getDefaultThankYou("bn").title ?? "");
  const [thankYouMessage, setThankYouMessage] = useState(getDefaultThankYou("bn").message ?? "");
  const [thankYouShowSummary, setThankYouShowSummary] = useState(true);
  const [thankYouShowAddress, setThankYouShowAddress] = useState(true);
  const [phoneValidationEnabled, setPhoneValidationEnabled] = useState<boolean>(getDefaultSettings("bn").phone_validation_enabled);
  const [phoneValidationMessage, setPhoneValidationMessage] = useState<string>(getDefaultSettings("bn").phone_validation_message);
  const [otpVerificationEnabled, setOtpVerificationEnabled] = useState<boolean>(getDefaultSettings("bn").otp_verification_enabled);
  const [otpVerifiedMessage, setOtpVerifiedMessage] = useState<string>(getDefaultSettings("bn").otp_verified_message);
  const [otpSmsTemplate, setOtpSmsTemplate] = useState<string>(getDefaultSettings("bn").otp_sms_template);
  const [otpFormTitle, setOtpFormTitle] = useState<string>(getDefaultSettings("bn").otp_form_title);
  const [otpFormDescription, setOtpFormDescription] = useState<string>(getDefaultSettings("bn").otp_form_description);
  const [otpFormButtonText, setOtpFormButtonText] = useState<string>(getDefaultSettings("bn").otp_form_button_text);
  const [otpFormResendText, setOtpFormResendText] = useState<string>(getDefaultSettings("bn").otp_form_resend_text);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(true);
  const [stickyCtaEnabled, setStickyCtaEnabled] = useState<boolean>(true);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("mobile");
  // null = no restriction, this page offers everything the shop enabled
  // (backward-compatible default). A non-null array is an explicit subset.
  // See online_payment_context.md.
  const [paymentChannels, setPaymentChannels] = useState<string[] | null>(null);
  const [shopWalletProviders, setShopWalletProviders] = useState<string[]>([]);
  const [shopGatewayProviders, setShopGatewayProviders] = useState<string[]>([]);
  const [theme, setTheme] = useState<ThemeSettings>({ ...DEFAULT_THEME });

  // Which wallet channels this shop has turned on at all (Settings → Online
  // Payment Channels) — the per-page selector below can only narrow this
  // set, never offer a channel the shop hasn't enabled. Skipped for
  // templates, which aren't tied to a real seller's payment settings.
  useEffect(() => {
    if (mode === "admin-template") return;
    fetch(`${LANDING_API_BASE}/payment-gateway-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const d = json?.data;
        if (!d) return;
        const providers: string[] = [];
        if (d.bkash_personal_enabled) providers.push("bkash");
        if (d.nagad_personal_enabled) providers.push("nagad");
        if (d.rocket_personal_enabled) providers.push("rocket");
        setShopWalletProviders(providers);
      })
      .catch(() => {});

    // Same idea for automated merchant gateways (SSLCommerz etc, Phase B/C)
    // — enabled here just means "seller turned it on"; the public checkout
    // endpoint (OnlinePaymentController::publicChannels) is the real
    // authority and additionally checks isConfigured(), so an incompletely
    // set-up gateway simply won't appear at checkout even if listed here.
    fetch(`${LANDING_API_BASE}/payment-gateway-credentials`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const rows: Array<{ provider: string; enabled: boolean }> = json?.data?.credentials ?? [];
        setShopGatewayProviders(rows.filter((r) => r.enabled).map((r) => r.provider));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const isAdminTemplateMode = mode === "admin-template";
  const [templateNameBn, setTemplateNameBn] = useState("");
  const [templateNameEn, setTemplateNameEn] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templatePreviewImage, setTemplatePreviewImage] = useState("");
  const [templateIsActive, setTemplateIsActive] = useState(true);
  const [templateScreenshotUploading, setTemplateScreenshotUploading] = useState(false);

  const [contentState, setContentState] = useState<ContentState>(emptyContentState());
  const [layoutEntries, setLayoutEntries] = useState<LayoutEntry[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addAfterKey, setAddAfterKey] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductDraft[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [draggingProductId, setDraggingProductId] = useState<string | null>(null);
  // rowKey is set when re-picking a variant for an already-attached row
  // ("Change variant"); null means attaching a brand-new product.
  const [variantPicker, setVariantPicker] = useState<{ product: ProductItem; rowKey: string | null } | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const [mediaPolicy, setMediaPolicy] = useState<MediaPolicy | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState<MediaLibraryItem[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<{ type: BlockType | "hero"; id: string; field: string } | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  // Switching page language auto-translates fields the merchant hasn't
  // customized yet (still equal to the previous language's default), and
  // leaves anything they've already edited untouched.
  function setPageLanguage(next: "bn" | "en") {
    const prevDefaults = getDefaultSettings(pageLanguage);
    const nextDefaults = getDefaultSettings(next);
    const prevThankYou = getDefaultThankYou(pageLanguage);
    const nextThankYou = getDefaultThankYou(next);

    setCheckoutFields((prev) =>
      JSON.stringify(prev) === JSON.stringify(getDefaultCheckoutFields(pageLanguage))
        ? getDefaultCheckoutFields(next)
        : prev
    );
    setThankYouTitle((prev) => (prev === (prevThankYou.title ?? "") ? nextThankYou.title ?? "" : prev));
    setThankYouMessage((prev) => (prev === (prevThankYou.message ?? "") ? nextThankYou.message ?? "" : prev));
    setPhoneValidationMessage((prev) => (prev === prevDefaults.phone_validation_message ? nextDefaults.phone_validation_message : prev));
    setOtpVerifiedMessage((prev) => (prev === prevDefaults.otp_verified_message ? nextDefaults.otp_verified_message : prev));
    setOtpSmsTemplate((prev) => (prev === prevDefaults.otp_sms_template ? nextDefaults.otp_sms_template : prev));
    setOtpFormTitle((prev) => (prev === prevDefaults.otp_form_title ? nextDefaults.otp_form_title : prev));
    setOtpFormDescription((prev) => (prev === prevDefaults.otp_form_description ? nextDefaults.otp_form_description : prev));
    setOtpFormButtonText((prev) => (prev === prevDefaults.otp_form_button_text ? nextDefaults.otp_form_button_text : prev));
    setOtpFormResendText((prev) => (prev === prevDefaults.otp_form_resend_text ? nextDefaults.otp_form_resend_text : prev));
    setPageLanguageState(next);
  }

  useEffect(() => {
    if (!token) {
      setError(t.loadFailed);
      setLoading(false);
      return;
    }
    if (mode === "edit" && !pageId) {
      setLoading(true);
      return;
    }

    const applySourceContent = (source: LandingPageContent | null, sourceTheme: ThemeSettings | null) => {
      const merged = mergeLandingContent(source, null);
      const nextContent = emptyContentState();
      for (const type of BLOCK_TYPES) {
        if (SINGLETON_BLOCK_TYPES.includes(type)) continue;
        nextContent[type] = ensureItemIds((merged[type] as Item[] | undefined) ?? [], type);
      }
      setContentState(nextContent);
      setLayoutEntries(expandLegacyLayoutOrder(merged.layout_order, nextContent));

      const loadedLanguage = merged.settings?.language ?? "bn";
      const loadedDefaults = getDefaultSettings(loadedLanguage);
      setPageLanguageState(loadedLanguage);
      setHeroHeadline(merged.hero?.headline ?? "");
      setHeroSubheadline(merged.hero?.subheadline ?? "");
      setHeroCtaText(merged.hero?.cta_text ?? "");
      setHeroImage(merged.hero?.background_image_url ?? "");
      setFeaturesTitle(merged.features_title ?? "");
      setFeaturesLayout(merged.features_layout ?? "cards");
      setTrustBadgesLayout(merged.trust_badges_layout ?? "cards");
      setProductsTitle(merged.products_section_title ?? "");
      setProductsSubtitle(merged.products_section_subtitle ?? "");
      setCheckoutFields(merged.checkout_fields ?? getDefaultCheckoutFields(loadedLanguage));
      setShippingInsideDhaka(String(merged.shipping?.inside_dhaka ?? 80));
      setShippingOutsideDhaka(String(merged.shipping?.outside_dhaka ?? 120));
      setContactPhone(merged.contact?.phone ?? "");
      setWhatsappNumber(merged.contact?.whatsapp ?? "");
      setFloatingButtons(merged.contact?.floating_buttons ?? false);
      setThankYouTitle(merged.thank_you?.title ?? "");
      setThankYouMessage(merged.thank_you?.message ?? "");
      setThankYouShowSummary(merged.thank_you?.show_order_summary ?? true);
      setThankYouShowAddress(merged.thank_you?.show_shipping_address ?? true);
      setPhoneValidationEnabled(merged.settings?.phone_validation_enabled ?? loadedDefaults.phone_validation_enabled);
      setPhoneValidationMessage(merged.settings?.phone_validation_message ?? loadedDefaults.phone_validation_message);
      setOtpVerificationEnabled(merged.settings?.otp_verification_enabled ?? loadedDefaults.otp_verification_enabled);
      setOtpVerifiedMessage(merged.settings?.otp_verified_message ?? loadedDefaults.otp_verified_message);
      setOtpSmsTemplate(merged.settings?.otp_sms_template ?? loadedDefaults.otp_sms_template);
      setOtpFormTitle(merged.settings?.otp_form_title ?? loadedDefaults.otp_form_title);
      setOtpFormDescription(merged.settings?.otp_form_description ?? loadedDefaults.otp_form_description);
      setOtpFormButtonText(merged.settings?.otp_form_button_text ?? loadedDefaults.otp_form_button_text);
      setOtpFormResendText(merged.settings?.otp_form_resend_text ?? loadedDefaults.otp_form_resend_text);
      setTrackingEnabled(merged.settings?.tracking_enabled ?? true);
      setStickyCtaEnabled(merged.settings?.sticky_cta_enabled ?? true);
      setPaymentChannels(merged.settings?.payment_channels ?? null);
      if (sourceTheme) {
        setTheme({
          primary_color: sourceTheme.primary_color ?? DEFAULT_THEME.primary_color,
          accent_color: sourceTheme.accent_color ?? DEFAULT_THEME.accent_color,
          background_color: sourceTheme.background_color ?? DEFAULT_THEME.background_color,
          text_color: sourceTheme.text_color ?? DEFAULT_THEME.text_color,
          button_text_color: sourceTheme.button_text_color ?? DEFAULT_THEME.button_text_color,
          font_family: sourceTheme.font_family ?? DEFAULT_THEME.font_family,
        });
      }
    };

    const load = async () => {
      try {
        setError(null);

        if (isAdminTemplateMode) {
          const [mediaPolicyRes, mediaLibraryRes] = await Promise.all([
            fetch(`${LANDING_API_BASE}/landing/media-library/policy`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${LANDING_API_BASE}/landing/media-library`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);
          if (!mediaPolicyRes.ok || !mediaLibraryRes.ok) throw new Error(t.loadFailed);
          setMediaPolicy((await mediaPolicyRes.json()).data ?? null);
          setMediaLibrary((await mediaLibraryRes.json()).data ?? []);
          setProducts([]);

          let sourceContent: LandingPageContent | null = null;
          let sourceTheme: ThemeSettings | null = null;

          if (templateId) {
            const res = await fetch(`${LANDING_API_BASE}/admin/landing/templates/${templateId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(t.loadFailed);
            const tpl = (await res.json()).data as LandingTemplate;
            sourceContent = (tpl.default_content ?? {}) as LandingPageContent;
            sourceTheme = (tpl.theme_settings ?? null) as ThemeSettings | null;
            setTemplateNameBn(tpl.name_bn ?? "");
            setTemplateNameEn(tpl.name_en ?? "");
            setTemplateDescription(tpl.description ?? "");
            setTemplatePreviewImage(tpl.preview_image ?? "");
            setTemplateIsActive(tpl.is_active ?? true);
          } else if (sourcePageId) {
            const res = await fetch(`${LANDING_API_BASE}/admin/landing/pages/${sourcePageId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(t.loadFailed);
            const src = (await res.json()).data as { title?: string; content?: LandingPageContent; theme_settings?: ThemeSettings };
            sourceContent = src.content ?? null;
            sourceTheme = src.theme_settings ?? null;
            setTemplateNameBn(src.title ?? "");
          }

          applySourceContent(sourceContent, sourceTheme);
          return;
        }

        const [templatesRes, productsRes, mediaPolicyRes, mediaLibraryRes, pageRes, initialTemplateRes] = await Promise.all([
          fetch(`${LANDING_API_BASE}/landing/templates`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/products?per_page=100`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/landing/media-library/policy`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/landing/media-library`, { headers: { Authorization: `Bearer ${token}` } }),
          mode === "edit" && pageId
            ? fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve(null),
          mode === "create" && initialTemplateId
            ? fetch(`${LANDING_API_BASE}/landing/templates/${initialTemplateId}`, { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve(null),
        ]);

        if (!templatesRes.ok || !productsRes.ok || !mediaPolicyRes.ok || !mediaLibraryRes.ok || (pageRes && !pageRes.ok) || (initialTemplateRes && !initialTemplateRes.ok)) {
          throw new Error(t.loadFailed);
        }

        setTemplates((await templatesRes.json()).data ?? []);
        const productsJson = await productsRes.json();
        setProducts((productsJson.data ?? []).filter((item: ProductItem) => item.status !== "archived"));
        setMediaPolicy((await mediaPolicyRes.json()).data ?? null);
        setMediaLibrary((await mediaLibraryRes.json()).data ?? []);

        if (!pageRes && initialTemplateRes) {
          const initialTemplate = (await initialTemplateRes.json()).data as LandingTemplate;
          setSelectedTemplateId(initialTemplate.id);
          const nextContent = emptyContentState();
          const merged = mergeLandingContent(null, initialTemplate);
          for (const type of BLOCK_TYPES) {
            if (SINGLETON_BLOCK_TYPES.includes(type)) continue;
            nextContent[type] = ensureItemIds((merged[type] as Item[] | undefined) ?? [], type);
          }
          setContentState(nextContent);
          setLayoutEntries(expandLegacyLayoutOrder(merged.layout_order, nextContent));
          setHeroHeadline(merged.hero?.headline ?? "");
          setHeroSubheadline(merged.hero?.subheadline ?? "");
          setHeroCtaText(merged.hero?.cta_text ?? "");
          setHeroImage(merged.hero?.background_image_url ?? "");
          setFeaturesTitle(merged.features_title ?? "");
          setFeaturesLayout(merged.features_layout ?? "cards");
          setTrustBadgesLayout(merged.trust_badges_layout ?? "cards");
          setProductsTitle(merged.products_section_title ?? "");
          setProductsSubtitle(merged.products_section_subtitle ?? "");
          setCheckoutFields(merged.checkout_fields ?? getDefaultCheckoutFields(merged.settings?.language ?? "bn"));
          setShippingInsideDhaka(String(merged.shipping?.inside_dhaka ?? 80));
          setShippingOutsideDhaka(String(merged.shipping?.outside_dhaka ?? 120));
          setContactPhone(merged.contact?.phone ?? "");
      setWhatsappNumber(merged.contact?.whatsapp ?? "");
      setFloatingButtons(merged.contact?.floating_buttons ?? false);
          const tplTheme = (initialTemplate.theme_settings ?? null) as ThemeSettings | null;
          if (tplTheme) {
            setTheme({
              primary_color: tplTheme.primary_color ?? DEFAULT_THEME.primary_color,
              accent_color: tplTheme.accent_color ?? DEFAULT_THEME.accent_color,
              background_color: tplTheme.background_color ?? DEFAULT_THEME.background_color,
              text_color: tplTheme.text_color ?? DEFAULT_THEME.text_color,
              button_text_color: tplTheme.button_text_color ?? DEFAULT_THEME.button_text_color,
              font_family: tplTheme.font_family ?? DEFAULT_THEME.font_family,
            });
          }
        } else if (pageRes) {
          const pageJson = await pageRes.json();
          const loadedPage = pageJson.data as LandingPageRecord;
          const merged = mergeLandingContent(loadedPage.content, loadedPage.template);

          const nextContent = emptyContentState();
          for (const type of BLOCK_TYPES) {
            if (SINGLETON_BLOCK_TYPES.includes(type)) continue;
            nextContent[type] = ensureItemIds((merged[type] as Item[] | undefined) ?? [], type);
          }
          setContentState(nextContent);
          setLayoutEntries(expandLegacyLayoutOrder(merged.layout_order, nextContent));
          setSelectedProducts((loadedPage.products ?? []).map((item, index) => normalizeProductDraft(item, index)));

          const loadedLanguage = merged.settings?.language ?? "bn";
          const loadedDefaults = getDefaultSettings(loadedLanguage);
          const loadedThankYou = getDefaultThankYou(loadedLanguage);

          setPage(loadedPage);
          setPageLanguageState(loadedLanguage);
          setTitle(loadedPage.title ?? "");
          setSlug(loadedPage.slug ?? "");
          setStatus(loadedPage.status === "published" ? "published" : "draft");
          setMetaTitle(loadedPage.seo_meta?.meta_title ?? loadedPage.title ?? "");
          setMetaDescription(loadedPage.seo_meta?.meta_description ?? "");
          setOgImage(loadedPage.seo_meta?.og_image ?? "");
          setCustomCss(loadedPage.custom_css ?? "");
          setHeroHeadline(merged.hero?.headline ?? loadedPage.title ?? "");
          setHeroSubheadline(merged.hero?.subheadline ?? "");
          setHeroCtaText(merged.hero?.cta_text ?? "");
          setHeroImage(merged.hero?.background_image_url ?? "");
          setFeaturesTitle(merged.features_title ?? "");
          setFeaturesLayout(merged.features_layout ?? "cards");
          setTrustBadgesLayout(merged.trust_badges_layout ?? "cards");
          setProductsTitle(merged.products_section_title ?? "");
          setProductsSubtitle(merged.products_section_subtitle ?? "");
          setCheckoutFields(merged.checkout_fields ?? getDefaultCheckoutFields(loadedLanguage));
          setShippingInsideDhaka(String(merged.shipping?.inside_dhaka ?? 80));
          setShippingOutsideDhaka(String(merged.shipping?.outside_dhaka ?? 120));
          setContactPhone(merged.contact?.phone ?? "");
      setWhatsappNumber(merged.contact?.whatsapp ?? "");
      setFloatingButtons(merged.contact?.floating_buttons ?? false);
          setThankYouTitle(merged.thank_you?.title ?? loadedThankYou.title ?? "");
          setThankYouMessage(merged.thank_you?.message ?? loadedThankYou.message ?? "");
          setThankYouShowSummary(merged.thank_you?.show_order_summary ?? true);
          setThankYouShowAddress(merged.thank_you?.show_shipping_address ?? true);
          setPhoneValidationEnabled(merged.settings?.phone_validation_enabled ?? loadedDefaults.phone_validation_enabled);
          setPhoneValidationMessage(merged.settings?.phone_validation_message ?? loadedDefaults.phone_validation_message);
          setOtpVerificationEnabled(merged.settings?.otp_verification_enabled ?? loadedDefaults.otp_verification_enabled);
          setOtpVerifiedMessage(merged.settings?.otp_verified_message ?? loadedDefaults.otp_verified_message);
          setOtpSmsTemplate(merged.settings?.otp_sms_template ?? loadedDefaults.otp_sms_template);
          setOtpFormTitle(merged.settings?.otp_form_title ?? loadedDefaults.otp_form_title);
          setOtpFormDescription(merged.settings?.otp_form_description ?? loadedDefaults.otp_form_description);
          setOtpFormButtonText(merged.settings?.otp_form_button_text ?? loadedDefaults.otp_form_button_text);
          setOtpFormResendText(merged.settings?.otp_form_resend_text ?? loadedDefaults.otp_form_resend_text);
      setTrackingEnabled(merged.settings?.tracking_enabled ?? true);
      setStickyCtaEnabled(merged.settings?.sticky_cta_enabled ?? true);
          setPaymentChannels(merged.settings?.payment_channels ?? null);
          setTheme({
            primary_color: loadedPage.theme_settings?.primary_color ?? DEFAULT_THEME.primary_color,
            accent_color: loadedPage.theme_settings?.accent_color ?? DEFAULT_THEME.accent_color,
            background_color: loadedPage.theme_settings?.background_color ?? DEFAULT_THEME.background_color,
            text_color: loadedPage.theme_settings?.text_color ?? DEFAULT_THEME.text_color,
            button_text_color: loadedPage.theme_settings?.button_text_color ?? DEFAULT_THEME.button_text_color,
            font_family: loadedPage.theme_settings?.font_family ?? DEFAULT_THEME.font_family,
          });
        } else {
          const nextContent = emptyContentState();
          setContentState(nextContent);
          setLayoutEntries(expandLegacyLayoutOrder([], nextContent));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.loadFailed);
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mode, pageId, initialTemplateId, sourcePageId, templateId]);

  function patchItem(type: BlockType, id: string, changes: Record<string, unknown>) {
    setContentState((prev) => ({
      ...prev,
      [type]: prev[type].map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));
  }

  function addBlock(type: BlockType, afterEntry?: LayoutEntry) {
    const id = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const item: Item = { id, ...BLOCK_REGISTRY[type].defaults() };
    setContentState((prev) => ({ ...prev, [type]: [...prev[type], item] }));
    setLayoutEntries((prev) => {
      if (!afterEntry) return [...prev, { type, id }];
      const index = prev.findIndex((entry) => entry.type === afterEntry.type && entry.id === afterEntry.id);
      if (index < 0) return [...prev, { type, id }];
      const next = [...prev];
      next.splice(index + 1, 0, { type, id });
      return next;
    });
    setAddMenuOpen(false);
    setAddAfterKey(null);
  }

  function removeBlock(type: BlockType, id: string) {
    const item = contentState[type].find((candidate) => candidate.id === id);
    if (item) {
      setLastRemoved({
        type,
        item,
        itemIndex: contentState[type].indexOf(item),
        layoutIndex: layoutEntries.findIndex((entry) => entry.type === type && entry.id === id),
      });
    }
    setContentState((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== id) }));
    setLayoutEntries((prev) => prev.filter((entry) => !(entry.type === type && entry.id === id)));
  }

  function undoRemoveBlock() {
    if (!lastRemoved) return;
    const { type, item, itemIndex, layoutIndex } = lastRemoved;
    setContentState((prev) => {
      const next = [...prev[type]];
      next.splice(Math.min(itemIndex, next.length), 0, item);
      return { ...prev, [type]: next };
    });
    setLayoutEntries((prev) => {
      const next = [...prev];
      next.splice(layoutIndex < 0 ? next.length : Math.min(layoutIndex, next.length), 0, { type, id: item.id });
      return next;
    });
    setLastRemoved(null);
  }

  useEffect(() => {
    if (!lastRemoved) return;
    const timer = window.setTimeout(() => setLastRemoved(null), 10000);
    return () => window.clearTimeout(timer);
  }, [lastRemoved]);

  function duplicateBlock(type: BlockType, id: string) {
    const source = contentState[type].find((item) => item.id === id);
    if (!source) return;
    const newId = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const clone: Item = { ...source, id: newId };
    setContentState((prev) => ({ ...prev, [type]: [...prev[type], clone] }));
    setLayoutEntries((prev) => {
      const index = prev.findIndex((entry) => entry.type === type && entry.id === id);
      if (index < 0) return [...prev, { type, id: newId }];
      const next = [...prev];
      next.splice(index + 1, 0, { type, id: newId });
      return next;
    });
  }

  function addProduct(product: ProductItem) {
    // Variant products need the merchant to pick an attach mode first —
    // pin one exact variant, or attach the whole product and let the
    // customer choose on the public checkout page.
    if (product.has_variants && (product.active_variants_count ?? 0) > 0) {
      setVariantPicker({ product, rowKey: null });
      return;
    }
    attachProduct(product, null);
  }

  function attachProduct(product: ProductItem, variant: ProductVariant | null) {
    setSelectedProducts((prev) => {
      if (prev.some((item) => item.product_id === product.id && item.product_variant_id === (variant?.id ?? null))) {
        return prev;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_variant_id: variant?.id ?? null,
          variant: variant as unknown as AttachedVariant | null,
          title_override: "",
          subtitle: "",
          badge_text: "",
          price_override: "",
          default_qty: 1,
          selected_by_default: true,
          sort_order: prev.length + 1,
        },
      ];
    });
    setVariantPicker(null);
  }

  /** Handles both picker flows: attaching a new row, or re-picking the
   *  variant for an already-attached row ("Change variant"). */
  function handleVariantPicked(variant: ProductVariant | null) {
    if (!variantPicker) return;
    if (variantPicker.rowKey) {
      patchProduct(variantPicker.rowKey, {
        product_variant_id: variant?.id ?? null,
        variant: variant as unknown as AttachedVariant | null,
      });
      setVariantPicker(null);
      return;
    }
    attachProduct(variantPicker.product, variant);
  }

  // The same product can be attached more than once with different pinned
  // variants (mode 2), so product_id alone no longer uniquely identifies a
  // row — key on product_id + product_variant_id instead.
  function draftRowKey(item: Pick<ProductDraft, "product_id" | "product_variant_id">): string {
    return `${item.product_id}:${item.product_variant_id ?? 0}`;
  }

  function removeProduct(rowKey: string) {
    setSelectedProducts((prev) => prev.filter((item) => draftRowKey(item) !== rowKey).map((item, index) => ({ ...item, sort_order: index + 1 })));
  }

  function patchProduct(rowKey: string, changes: Partial<ProductDraft>) {
    setSelectedProducts((prev) => prev.map((item) => (draftRowKey(item) === rowKey ? { ...item, ...changes } : item)));
  }

  function reorderProductsByKey(sourceKey: string, targetKey: string) {
    if (sourceKey === targetKey) return;
    setSelectedProducts((prev) => {
      const from = prev.findIndex((item) => draftRowKey(item) === sourceKey);
      const to = prev.findIndex((item) => draftRowKey(item) === targetKey);
      if (from < 0 || to < 0) return prev;
      return moveItem(prev, from, to).map((item, index) => ({ ...item, sort_order: index + 1 }));
    });
  }

  function patchCheckoutField(key: string, changes: Partial<CheckoutFieldConfig>) {
    setCheckoutFields((prev) => prev.map((field) => (field.key === key ? { ...field, ...changes } : field)));
  }

  function removeCheckoutField(key: string) {
    setCheckoutFields((prev) => prev.filter((field) => field.key !== key));
  }

  function addCustomCheckoutField() {
    const key = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setCheckoutFields((prev) => [
      ...prev,
      { key, kind: "custom", label: pageLanguage === "bn" ? "নতুন ফিল্ড" : "New field", type: "text", required: false, enabled: true },
    ]);
  }

  function reorderCheckoutFieldsByKey(sourceKey: string, targetKey: string) {
    if (sourceKey === targetKey) return;
    setCheckoutFields((prev) => {
      const from = prev.findIndex((field) => field.key === sourceKey);
      const to = prev.findIndex((field) => field.key === targetKey);
      if (from < 0 || to < 0) return prev;
      return moveItem(prev, from, to);
    });
  }

  async function reloadMediaLibrary() {
    if (!token) return;
    const res = await fetch(`${LANDING_API_BASE}/landing/media-library`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setMediaLibrary(json.data ?? []);
  }

  async function uploadMediaFiles(event: React.ChangeEvent<HTMLInputElement>) {
    if (!token) return;
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    if (mediaPolicy) {
      const maxBytes = mediaPolicy.max_file_size_mb * 1024 * 1024;
      for (const file of files) {
        if (!mediaPolicy.allowed_mime_types.includes(file.type) || file.size > maxBytes) {
          setError(`Unsupported/oversized file: ${file.name}`);
          return;
        }
      }
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files[]", file));

    setMediaUploading(true);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/media-library/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Upload failed");
      await reloadMediaLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setMediaUploading(false);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  }

  async function uploadTemplateScreenshot(event: React.ChangeEvent<HTMLInputElement>) {
    if (!token) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setTemplateScreenshotUploading(true);
    try {
      const res = await fetch(`${LANDING_API_BASE}/admin/landing/templates/upload-preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Upload failed");
      setTemplatePreviewImage(json.data?.url ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setTemplateScreenshotUploading(false);
      event.target.value = "";
    }
  }

  function applyMediaPick(url: string) {
    if (!mediaTarget) return;
    if (mediaTarget.type === "hero" && mediaTarget.field === "og_image") {
      setOgImage(url);
    } else if (mediaTarget.type === "hero") {
      setHeroImage(url);
    } else {
      patchItem(mediaTarget.type, mediaTarget.id, { [mediaTarget.field]: url });
    }
    setMediaTarget(null);
  }

  function toggleCarouselImage(blockId: string, image: MediaLibraryItem) {
    setContentState((prev) => ({
      ...prev,
      carousel_images: prev.carousel_images.map((block) => {
        if (block.id !== blockId) return block;
        const images = (block.images as Array<{ id?: number | null; url?: string | null; alt?: string | null }> | undefined) ?? [];
        const exists = images.some((img) => img.url === image.url);
        return {
          ...block,
          images: exists
            ? images.filter((img) => img.url !== image.url)
            : [...images, { id: image.id, url: image.url, alt: image.file_name ?? "" }],
        };
      }),
    }));
  }

  const filteredProducts = useMemo(() => {
    // A variant product stays browsable even after attaching one variant —
    // the merchant can attach several specific variants of the same product
    // (each becomes its own line item), leaving the rest unavailable on this
    // page. Only hide it once it's fully covered: a "whole product" row
    // (customer picks) already exists, or it's a plain product with no
    // variants and is already attached once.
    const fullyCovered = new Set(
      selectedProducts.filter((item) => item.product_variant_id === null).map((item) => item.product_id),
    );
    const needle = productQuery.trim().toLowerCase();
    return products.filter((item) => {
      if (fullyCovered.has(item.id)) return false;
      if (!needle) return true;
      return [item.name, item.sku ?? ""].join(" ").toLowerCase().includes(needle);
    });
  }, [products, productQuery, selectedProducts]);

  const selectedProductDetails = useMemo(() => {
    const map = new Map(products.map((item) => [item.id, item]));
    return selectedProducts.map((item, index) => ({
      ...item,
      sort_order: index + 1,
      product: map.get(item.product_id) ?? null,
    }));
  }, [products, selectedProducts]);

  function buildContent(): LandingPageContent {
    const content: LandingPageContent = {
      hero: {
        headline: heroHeadline || title,
        subheadline: heroSubheadline || null,
        cta_text: heroCtaText || null,
        background_image_url: heroImage || null,
      },
      features_title: featuresTitle || null,
      features_layout: featuresLayout,
      trust_badges_layout: trustBadgesLayout,
      products_section_title: productsTitle || null,
      products_section_subtitle: productsSubtitle || null,
      checkout_fields: checkoutFields,
      contact: { phone: contactPhone || null, whatsapp: whatsappNumber || null, floating_buttons: floatingButtons },
      shipping: {
        inside_dhaka: toNumberOrNull(shippingInsideDhaka) ?? 80,
        outside_dhaka: toNumberOrNull(shippingOutsideDhaka) ?? 120,
      },
      thank_you: {
        title: thankYouTitle || null,
        message: thankYouMessage || null,
        show_order_summary: thankYouShowSummary,
        show_shipping_address: thankYouShowAddress,
      },
      settings: {
        language: pageLanguage,
        phone_validation_enabled: phoneValidationEnabled,
        phone_validation_message: phoneValidationMessage || null,
        otp_verification_enabled: otpVerificationEnabled,
        otp_verified_message: otpVerifiedMessage || null,
        otp_sms_template: otpSmsTemplate || null,
        otp_form_title: otpFormTitle || null,
        otp_form_description: otpFormDescription || null,
        otp_form_button_text: otpFormButtonText || null,
        otp_form_resend_text: otpFormResendText || null,
        tracking_enabled: trackingEnabled,
        sticky_cta_enabled: stickyCtaEnabled,
        payment_channels: paymentChannels,
      },
      layout_order: layoutEntries,
    };
    for (const type of BLOCK_TYPES) {
      if (SINGLETON_BLOCK_TYPES.includes(type)) continue;
      (content as Record<string, unknown>)[type] = contentState[type];
    }
    return content;
  }

  const draftPage: PublicLandingPage = useMemo(() => ({
    id: page?.id ?? 0,
    title: title || (locale === "bn" ? "শিরোনামহীন পেজ" : "Untitled page"),
    slug: slug || "preview",
    template: page?.template ?? null,
    theme_settings: theme,
    content: buildContent() as PublicLandingPage["content"],
    seo_meta: { meta_title: metaTitle || title, meta_description: metaDescription || null, og_image: ogImage || null },
    custom_css: customCss || null,
    products: selectedProductDetails as unknown as PublicLandingPage["products"],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [page, title, slug, theme, contentState, layoutEntries, heroHeadline, heroSubheadline, heroCtaText, heroImage, featuresTitle, featuresLayout, trustBadgesLayout, productsTitle, productsSubtitle, checkoutFields, contactPhone, whatsappNumber, floatingButtons, ogImage, customCss, shippingInsideDhaka, shippingOutsideDhaka, thankYouTitle, thankYouMessage, thankYouShowSummary, thankYouShowAddress, pageLanguage, phoneValidationEnabled, phoneValidationMessage, otpVerificationEnabled, otpVerifiedMessage, otpSmsTemplate, otpFormTitle, otpFormDescription, otpFormButtonText, otpFormResendText, trackingEnabled, stickyCtaEnabled, paymentChannels, metaTitle, metaDescription, locale, selectedProductDetails]);

  // Everything a save sends, as one string, so "unsaved changes" is a plain
  // comparison against what was last loaded or saved.
  const saveSnapshot = useMemo(
    () => JSON.stringify([draftPage, status, selectedProducts, selectedTemplateId, templateNameBn, templateNameEn, templateDescription, templatePreviewImage, templateIsActive]),
    [draftPage, status, selectedProducts, selectedTemplateId, templateNameBn, templateNameEn, templateDescription, templatePreviewImage, templateIsActive],
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  if (!loading && savedSnapshot === null) {
    setSavedSnapshot(saveSnapshot);
  }
  const isDirty = !loading && savedSnapshot !== null && savedSnapshot !== saveSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const content = buildContent();

      const invalidVideo = (contentState.video_embeds ?? []).some((item) => !isAllowedVideoUrl(String(item.url ?? "")));
      if (invalidVideo) {
        throw new Error(t.invalidVideoUrl);
      }

      if (isAdminTemplateMode) {
        const templatePayload = {
          name_bn: templateNameBn,
          name_en: templateNameEn || templateNameBn,
          description: templateDescription || null,
          preview_image: templatePreviewImage || null,
          default_content: content,
          theme_settings: theme,
          is_active: templateIsActive,
          source_landing_page_id: sourcePageId ? Number(sourcePageId) : null,
        };
        const url = templateId
          ? `${LANDING_API_BASE}/admin/landing/templates/${templateId}`
          : `${LANDING_API_BASE}/admin/landing/templates`;
        const res = await fetch(url, {
          method: templateId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(templatePayload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || Object.values(json.errors ?? {}).flat().join(" ") || t.submitFailed);
        }
        setSuccess(templateId ? t.templateUpdateSuccess : t.templateCreateSuccess);
        setTimeout(() => router.push("/admin/landing/templates"), 700);
        return;
      }

      const payload = {
        title,
        slug: slug.trim() || undefined,
        status,
        content,
        seo_meta: { meta_title: metaTitle || title, meta_description: metaDescription || null, og_image: ogImage || null },
        custom_css: customCss || null,
        theme_settings: theme,
        template_id: selectedTemplateId ?? undefined,
        products: selectedProducts.map((item, index) => ({
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          title_override: item.title_override || null,
          subtitle: item.subtitle || null,
          badge_text: item.badge_text || null,
          price_override: toNumberOrNull(item.price_override),
          default_qty: item.default_qty,
          selected_by_default: item.selected_by_default,
          sort_order: index + 1,
        })),
      };

      const url = mode === "edit" && pageId ? `${LANDING_API_BASE}/landing/pages/${pageId}` : `${LANDING_API_BASE}/landing/pages`;
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const baseMessage = json.message || Object.values(json.errors ?? {}).flat().join(" ") || t.submitFailed;
        const message = json.admin_lock_reason ? `${baseMessage} (${t.adminLockedReason}: ${json.admin_lock_reason})` : baseMessage;
        throw new Error(message);
      }

      const nextId = json.data?.id ?? pageId;
      setSuccess(mode === "edit" ? t.updateSuccess : t.createSuccess);
      setSavedSnapshot(saveSnapshot);
      // Keep the seller in the editor. A new page moves to its edit route so
      // the next save updates it instead of creating another one.
      if (mode === "create" && nextId) {
        router.replace(`/dashboard/landing-pages/${nextId}/builder`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.submitFailed);
    } finally {
      setSaving(false);
    }
  }

  function renderBlockItem(entry: LayoutEntry) {
    const Icon = BLOCK_REGISTRY[entry.type].icon;

    if (SINGLETON_BLOCK_TYPES.includes(entry.type)) {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <Icon size={14} /> {blockLabel(entry.type, locale)}
          </span>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {locale === "bn" ? "সবসময় পেজে যুক্ত থাকে — নিচে ম্যানেজ করুন।" : "Always present on the page — manage it below."}
          </p>
        </div>
      );
    }

    const item = contentState[entry.type]?.find((candidate) => candidate.id === entry.id);
    if (!item) return null;

    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <Icon size={14} /> {blockLabel(entry.type, locale)}
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddAfterKey((prev) => (prev === `${entry.type}:${entry.id}` ? null : `${entry.type}:${entry.id}`))}
                className="flex items-center gap-1 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-1 text-xs font-semibold text-[var(--accent)]"
              >
                <Plus size={12} /> {t.addBlockHere}
              </button>
              {addAfterKey === `${entry.type}:${entry.id}` ? (
                <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg">
                  {ADDABLE_BLOCK_TYPES.map((addType) => {
                    const AddIcon = BLOCK_REGISTRY[addType].icon;
                    return (
                      <button key={addType} type="button" onClick={() => addBlock(addType, entry)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-soft)]">
                        <AddIcon size={14} /> {blockLabel(addType, locale)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => duplicateBlock(entry.type, entry.id)} className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--foreground)]">
              <Copy size={12} /> {t.duplicate}
            </button>
            <button type="button" onClick={() => removeBlock(entry.type, entry.id)} className="flex items-center gap-1 rounded-lg border border-red-400/30 px-2 py-1 text-xs font-semibold text-red-400">
              <Trash2 size={12} /> {t.remove}
            </button>
          </div>
        </div>
        <div className="space-y-2">{renderBlockFields(entry.type, item)}</div>
      </div>
    );
  }

  function renderBlockFields(type: BlockType, item: Item) {
    const Editor = BLOCK_REGISTRY[type].Editor;
    if (!Editor) return null;
    return (
      <Editor
        item={item}
        patch={(changes) => patchItem(type, item.id, changes)}
        locale={locale}
        openMedia={(field) => setMediaTarget({ type, id: item.id, field })}
        isFirstOfType={contentState[type][0]?.id === item.id}
        section={{ featuresTitle, featuresLayout, trustBadgesLayout }}
        onSectionChange={(changes) => {
          if (changes.featuresTitle !== undefined) setFeaturesTitle(changes.featuresTitle);
          if (changes.featuresLayout !== undefined) setFeaturesLayout(changes.featuresLayout);
          if (changes.trustBadgesLayout !== undefined) setTrustBadgesLayout(changes.trustBadgesLayout);
        }}
      />
    );
  }

  return (
    <section className="mx-auto max-w-[1600px] catv-panel p-4 sm:p-5">
      {loading ? (
        <div className="text-sm text-[var(--muted)]">{t.loading}</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {(error || (success && !isDirty)) ? (
            <div className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>{error || success}</div>
          ) : null}

          {page?.admin_locked ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <p className="font-semibold">{t.adminLockedTitle}</p>
              <p className="mt-1">{t.adminLockedBody}</p>
              {page.admin_lock_reason ? (
                <p className="mt-1">
                  <span className="font-semibold">{t.adminLockedReason}:</span> {page.admin_lock_reason}
                </p>
              ) : null}
            </div>
          ) : null}

          {isAdminTemplateMode ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="mb-3 text-base font-semibold text-[var(--foreground)]">{t.templateInfoTitle}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.templateNameBn}</span>
                  <input value={templateNameBn} onChange={(e) => setTemplateNameBn(e.target.value)} required className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--foreground)]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.templateNameEn}</span>
                  <input value={templateNameEn} onChange={(e) => setTemplateNameEn(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--foreground)]" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.templateDescription}</span>
                  <textarea value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} rows={2} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--foreground)]" />
                </label>
                <div>
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.templateScreenshot}</span>
                  <div className="flex items-center gap-3">
                    {templatePreviewImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={templatePreviewImage} alt="" className="h-16 w-24 rounded-lg border border-[var(--border)] object-cover" />
                    ) : null}
                    <label className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
                      {templateScreenshotUploading ? t.templateScreenshotUploading : t.templateScreenshotUpload}
                      <input type="file" accept="image/*" className="hidden" disabled={templateScreenshotUploading} onChange={uploadTemplateScreenshot} />
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2 self-end text-sm font-medium text-[var(--foreground)]">
                  <input type="checkbox" checked={templateIsActive} onChange={(e) => setTemplateIsActive(e.target.checked)} />
                  {t.templateActive}
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="block xl:col-span-2">
                  <span className={"mb-1 block text-sm font-medium text-[var(--foreground)]"}>{t.title}</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--foreground)]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.slug}</span>
                  <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--foreground)]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">{t.status}</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--foreground)]">
                    <option value="draft">{t.draft}</option>
                    <option value="published" disabled={Boolean(page?.admin_locked)}>{t.published}</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1.5">
            {visibleTabs.map((tabKey) => {
              const Icon = TAB_ICONS[tabKey];
              const label = tabLabels[tabKey];
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveTab(tabKey)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    isActive ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              );
            })}
          </div>

          <div className={activeTab === "content" ? "space-y-5" : "hidden"}>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">{t.hero}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-3">
                  <TextField label={t.heroHeadline} value={heroHeadline} onChange={setHeroHeadline} />
                  <TextAreaField label={t.heroSubheadline} value={heroSubheadline} onChange={setHeroSubheadline} />
                  <TextField label={t.heroCtaText} value={heroCtaText} onChange={setHeroCtaText} />
                </div>
                <ImagePickerField label={t.heroImage} value={heroImage} locale={locale} onPick={() => setMediaTarget({ type: "hero", id: "hero", field: "background_image_url" })} />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">{t.seo}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TextField label={t.metaTitle} value={metaTitle} onChange={setMetaTitle} />
                <TextAreaField label={t.metaDescription} value={metaDescription} onChange={setMetaDescription} />
                <div className="md:col-span-2">
                  <ImagePickerField label={t.ogImage} value={ogImage} locale={locale} onPick={() => setMediaTarget({ type: "hero", id: "seo", field: "og_image" })} />
                  <p className="mt-1 text-xs text-[var(--muted)]">{t.ogImageHint}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">{t.thankYou}</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.thankYouHint}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TextField label={t.thankYouTitle} value={thankYouTitle} onChange={setThankYouTitle} />
                <TextAreaField label={t.thankYouMessage} value={thankYouMessage} onChange={setThankYouMessage} />
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input type="checkbox" checked={thankYouShowSummary} onChange={(event) => setThankYouShowSummary(event.target.checked)} />
                  {t.thankYouShowSummary}
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input type="checkbox" checked={thankYouShowAddress} onChange={(event) => setThankYouShowAddress(event.target.checked)} />
                  {t.thankYouShowAddress}
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">{t.deliveryContact}</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.deliveryContactHint}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t.insideDhaka}</span>
                  <input type="number" min={0} step="1" value={shippingInsideDhaka} onChange={(e) => setShippingInsideDhaka(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t.outsideDhaka}</span>
                  <input type="number" min={0} step="1" value={shippingOutsideDhaka} onChange={(e) => setShippingOutsideDhaka(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" />
                </label>
                <div className="md:col-span-2">
                  <TextField label={t.contactPhone} value={contactPhone} onChange={setContactPhone} />
                </div>
                <div className="md:col-span-2">
                  <TextField label={t.whatsappNumber} value={whatsappNumber} onChange={setWhatsappNumber} />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] md:col-span-2">
                  <input type="checkbox" checked={floatingButtons} onChange={(e) => setFloatingButtons(e.target.checked)} className="accent-[var(--accent)]" />
                  {t.floatingButtons}
                </label>
              </div>
            </div>
          </div>

          <div className={activeTab === "design" ? "space-y-5" : "hidden"}>
            <LandingDesignPanel locale={locale} theme={theme} onChange={setTheme} />
          </div>

          <div className={activeTab === "blocks" ? "space-y-5" : "hidden"}>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-[var(--foreground)]">{t.blocksTitle}</h3>
                <div className="relative">
                  <button type="button" onClick={() => setAddMenuOpen((prev) => !prev)} className="flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">
                    <Plus size={14} /> {t.addBlock}
                  </button>
                  {addMenuOpen ? (
                    <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg">
                      {ADDABLE_BLOCK_TYPES.map((type) => {
                        const Icon = BLOCK_REGISTRY[type].icon;
                        return (
                          <button key={type} type="button" onClick={() => addBlock(type)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-soft)]">
                            <Icon size={14} /> {blockLabel(type, locale)}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <BlockList entries={layoutEntries} onReorder={setLayoutEntries} renderItem={renderBlockItem} />
            </div>
          </div>

          <div className={activeTab === "products" ? "space-y-5" : "hidden"}>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--foreground)]">{t.selectedProducts}</h3>
                  <p className="text-sm text-[var(--muted)]">{t.productsHint}</p>
                </div>
                <span className="text-xs text-[var(--muted)]">{t.dragHint}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextField label={t.productsTitle} value={productsTitle} onChange={setProductsTitle} />
                <TextField label={t.productsSubtitle} value={productsSubtitle} onChange={setProductsSubtitle} />
              </div>
              {selectedProductDetails.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{t.emptyProducts}</div>
              ) : (
                <div className="mt-3 space-y-4">
                  {selectedProductDetails.map((item, index) => {
                    const rowKey = draftRowKey(item);
                    return (
                    <div
                      key={rowKey}
                      draggable
                      onDragStart={() => setDraggingProductId(rowKey)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggingProductId != null) reorderProductsByKey(draggingProductId, rowKey);
                        setDraggingProductId(null);
                      }}
                      onDragEnd={() => setDraggingProductId(null)}
                      className={`rounded-2xl border bg-[var(--surface)] p-4 ${draggingProductId === rowKey ? "border-[var(--accent)] shadow-lg" : "border-[var(--border)]"}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          {item.variant?.image_url || item.product?.thumbnail ? (
                            <img src={item.variant?.image_url || item.product?.thumbnail || ""} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                          ) : null}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="cursor-grab text-lg text-[var(--muted)]">⋮⋮</span>
                              <h4 className="text-sm font-semibold text-[var(--foreground)]">{item.product?.name ?? `#${item.product_id}`}</h4>
                              {item.product_variant_id ? (
                                <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">{variantLabel(item.variant)}</span>
                              ) : item.product?.has_variants && (item.product.active_variants_count ?? 0) > 0 ? (
                                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] text-[var(--muted)]">{locale === "bn" ? "সব ভেরিয়েন্ট — কাস্টমার সিলেক্ট করবে" : "All variants — customer picks"}</span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              SKU: {item.variant?.sku || item.product?.sku || "—"} · ৳{Number(item.variant?.selling_price ?? item.product?.selling_price ?? item.product?.regular_price ?? 0).toLocaleString()} · #{index + 1}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {item.product?.has_variants && (item.product.active_variants_count ?? 0) > 0 ? (
                            <>
                              <button type="button" onClick={() => item.product && setVariantPicker({ product: item.product, rowKey })} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
                                {locale === "bn" ? "ভেরিয়েন্ট পরিবর্তন" : "Change variant"}
                              </button>
                              {item.product_variant_id ? (
                                <button type="button" onClick={() => item.product && setVariantPicker({ product: item.product, rowKey: null })} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">
                                  {locale === "bn" ? "+ আরেকটি ভেরিয়েন্ট" : "+ Another variant"}
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          <button type="button" onClick={() => removeProduct(rowKey)} className="rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-400">{t.remove}</button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input value={item.title_override} onChange={(e) => patchProduct(rowKey, { title_override: e.target.value })} placeholder={t.overrideTitle} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <input value={item.subtitle} onChange={(e) => patchProduct(rowKey, { subtitle: e.target.value })} placeholder={t.overrideSubtitle} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <input value={item.badge_text} onChange={(e) => patchProduct(rowKey, { badge_text: e.target.value })} placeholder={t.badge} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <input value={item.price_override} onChange={(e) => patchProduct(rowKey, { price_override: e.target.value })} placeholder={t.overridePrice} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
                        <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                          <span>{t.defaultQty}</span>
                          <input type="number" min={1} max={100} value={item.default_qty} onChange={(e) => patchProduct(rowKey, { default_qty: Math.max(1, Number(e.target.value) || 1) })} className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm" />
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                          <input type="checkbox" checked={item.selected_by_default} onChange={(e) => patchProduct(rowKey, { selected_by_default: e.target.checked })} className="accent-[var(--accent)]" />
                          <span>{t.selectedByDefault}</span>
                        </label>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.products}</h4>
                <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder={t.searchProducts} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" />
                <div className="mt-3 space-y-3">
                  {filteredProducts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{t.noProducts}</div>
                  ) : (
                    filteredProducts.slice(0, 30).map((product) => (
                      <div key={product.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">{product.name}</h4>
                          <p className="mt-1 text-xs text-[var(--muted)]">SKU: {product.sku || "—"} · ৳{Number(product.selling_price ?? product.regular_price ?? 0).toLocaleString()} · Stock {product.stock ?? 0}</p>
                        </div>
                        <button type="button" onClick={() => addProduct(product)} className="shrink-0 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">{t.attach}</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--foreground)]">{t.checkoutFields}</h3>
                  <p className="text-sm text-[var(--muted)]">{t.checkoutFieldsHint}</p>
                </div>
                <button type="button" onClick={addCustomCheckoutField} className="flex items-center gap-1 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)]">
                  <Plus size={14} /> {t.addCustomField}
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {checkoutFields.map((field) => (
                  <div
                    key={field.key}
                    draggable
                    onDragStart={() => setDraggingFieldKey(field.key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggingFieldKey) reorderCheckoutFieldsByKey(draggingFieldKey, field.key);
                      setDraggingFieldKey(null);
                    }}
                    onDragEnd={() => setDraggingFieldKey(null)}
                    className={`rounded-2xl border bg-[var(--surface)] p-3 ${draggingFieldKey === field.key ? "border-[var(--accent)] shadow-lg" : "border-[var(--border)]"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cursor-grab text-lg text-[var(--muted)]">⋮⋮</span>
                      <input
                        value={field.label}
                        onChange={(e) => patchCheckoutField(field.key, { label: e.target.value })}
                        className="min-w-[10rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
                      />
                      {field.kind === "custom" ? (
                        <select
                          value={field.type ?? "text"}
                          onChange={(e) => patchCheckoutField(field.key, { type: e.target.value as CheckoutFieldConfig["type"] })}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-2 text-xs text-[var(--foreground)]"
                        >
                          <option value="text">{t.fieldTypeText}</option>
                          <option value="textarea">{t.fieldTypeTextarea}</option>
                          <option value="select">{t.fieldTypeSelect}</option>
                        </select>
                      ) : null}
                      <label className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2 text-xs text-[var(--foreground)]">
                        <input
                          type="checkbox"
                          checked={field.enabled}
                          disabled={field.key === "customer_phone"}
                          onChange={(e) => patchCheckoutField(field.key, { enabled: e.target.checked })}
                          className="accent-[var(--accent)]"
                        />
                        {t.fieldShown}
                      </label>
                      <label className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2 text-xs text-[var(--foreground)]">
                        <input
                          type="checkbox"
                          checked={field.required}
                          disabled={field.key === "customer_phone"}
                          onChange={(e) => patchCheckoutField(field.key, { required: e.target.checked })}
                          className="accent-[var(--accent)]"
                        />
                        {t.fieldRequired}
                      </label>
                      {field.kind === "custom" ? (
                        <button type="button" onClick={() => removeCheckoutField(field.key)} className="rounded-xl border border-red-400/30 px-2.5 py-2 text-xs font-semibold text-red-400">
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                    </div>
                    {field.kind === "custom" && field.type === "select" ? (
                      <input
                        defaultValue={(field.options ?? []).join(", ")}
                        onBlur={(e) => patchCheckoutField(field.key, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        placeholder={t.fieldOptionsPlaceholder}
                        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={activeTab === "settings" ? "space-y-5" : "hidden"}>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <span className="block text-sm font-semibold text-[var(--foreground)]">{t.pageLanguage}</span>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.pageLanguageHint}</p>
              <div className="mt-3 inline-flex rounded-xl border border-[var(--border)] p-1">
                <button
                  type="button"
                  onClick={() => setPageLanguage("bn")}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${pageLanguage === "bn" ? "bg-[var(--accent)] text-white" : "text-[var(--foreground)]"}`}
                >
                  {t.pageLanguageBn}
                </button>
                <button
                  type="button"
                  onClick={() => setPageLanguage("en")}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${pageLanguage === "en" ? "bg-[var(--accent)] text-white" : "text-[var(--foreground)]"}`}
                >
                  {t.pageLanguageEn}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <input type="checkbox" checked={phoneValidationEnabled} onChange={(e) => setPhoneValidationEnabled(e.target.checked)} className="accent-[var(--accent)]" />
                {t.phoneValidation}
              </label>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.phoneValidationHint}</p>
              {phoneValidationEnabled ? (
                <div className="mt-3">
                  <TextField label={t.phoneValidationMessage} value={phoneValidationMessage} onChange={setPhoneValidationMessage} />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <input type="checkbox" checked={otpVerificationEnabled} onChange={(e) => setOtpVerificationEnabled(e.target.checked)} className="accent-[var(--accent)]" />
                {t.otpVerification}
              </label>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.otpVerificationHint}</p>
              {otpVerificationEnabled ? (
                <div className="mt-3 space-y-3">
                  <TextField label={t.otpVerifiedMessage} value={otpVerifiedMessage} onChange={setOtpVerifiedMessage} />
                  <div>
                    <TextAreaField label={t.otpSmsTemplate} value={otpSmsTemplate} onChange={setOtpSmsTemplate} rows={2} />
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {t.otpSmsTemplateHint} {OTP_SMS_TEMPLATE_PLACEHOLDERS.join(" ")}
                    </p>
                  </div>
                  <TextField label={t.otpFormTitle} value={otpFormTitle} onChange={setOtpFormTitle} />
                  <TextAreaField label={t.otpFormDescription} value={otpFormDescription} onChange={setOtpFormDescription} rows={2} />
                  <TextField label={t.otpFormButtonText} value={otpFormButtonText} onChange={setOtpFormButtonText} />
                  <TextField label={t.otpFormResendText} value={otpFormResendText} onChange={setOtpFormResendText} />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <input type="checkbox" checked={trackingEnabled} onChange={(e) => setTrackingEnabled(e.target.checked)} className="accent-[var(--accent)]" />
                {t.trackingEnabled}
              </label>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.trackingEnabledHint}</p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <input type="checkbox" checked={stickyCtaEnabled} onChange={(e) => setStickyCtaEnabled(e.target.checked)} className="accent-[var(--accent)]" />
                {t.stickyCtaEnabled}
              </label>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.stickyCtaEnabledHint}</p>
            </div>

            {!isAdminTemplateMode ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-[var(--foreground)]">{t.customCss}</span>
                  <textarea
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    rows={6}
                    spellCheck={false}
                    placeholder=".lp-shell h2 { letter-spacing: -0.01em; }"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--foreground)]"
                  />
                </label>
                <p className="mt-1 text-xs text-[var(--muted)]">{t.customCssHint}</p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.paymentChannelsTitle}</h4>
              <label className="mt-2 flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={paymentChannels !== null}
                  onChange={(e) => setPaymentChannels(e.target.checked ? ["cod", ...shopWalletProviders, ...shopGatewayProviders] : null)}
                  className="accent-[var(--accent)]"
                />
                {t.paymentChannelsRestrict}
              </label>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.paymentChannelsHint}</p>
              {paymentChannels !== null ? (
                <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={paymentChannels.includes("cod")}
                      onChange={(e) => setPaymentChannels((prev) => {
                        const set = new Set(prev ?? []);
                        if (e.target.checked) set.add("cod"); else set.delete("cod");
                        return Array.from(set);
                      })}
                      className="accent-[var(--accent)]"
                    />
                    {t.paymentChannelCod}
                  </label>
                  {shopWalletProviders.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">{t.paymentChannelNoWallet}</p>
                  ) : shopWalletProviders.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={paymentChannels.includes(p)}
                        onChange={(e) => setPaymentChannels((prev) => {
                          const set = new Set(prev ?? []);
                          if (e.target.checked) set.add(p); else set.delete(p);
                          return Array.from(set);
                        })}
                        className="accent-[var(--accent)]"
                      />
                      {p === "bkash" ? "bKash" : p === "nagad" ? "Nagad" : "Rocket"}
                    </label>
                  ))}
                  {shopGatewayProviders.length > 0 && (
                    <>
                      <p className="pt-1 text-xs font-semibold text-[var(--muted)]">{t.paymentChannelsGatewaySection}</p>
                      {shopGatewayProviders.map((p) => (
                        <label key={p} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                          <input
                            type="checkbox"
                            checked={paymentChannels.includes(p)}
                            onChange={(e) => setPaymentChannels((prev) => {
                              const set = new Set(prev ?? []);
                              if (e.target.checked) set.add(p); else set.delete(p);
                              return Array.from(set);
                            })}
                            className="accent-[var(--accent)]"
                          />
                          {GATEWAY_PROVIDER_LABELS[p] ?? p}
                        </label>
                      ))}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 -mx-1 flex items-center justify-end gap-3 rounded-xl bg-[var(--surface)]/95 px-1 py-2 backdrop-blur">
            {!isAdminTemplateMode ? (
              <span className={`text-xs ${isDirty ? "font-semibold text-amber-500" : "text-[var(--muted)]"}`}>
                {isDirty ? t.unsavedChanges : t.allSaved}
              </span>
            ) : null}
            <button type="submit" disabled={saving} className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? t.saving : t.save}
            </button>
          </div>
        </form>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">{t.livePreview}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{t.livePreviewHint}</p>
              </div>
              <div className="flex shrink-0 rounded-xl border border-[var(--border)] p-0.5">
                {([["mobile", Smartphone, t.previewMobile], ["desktop", Monitor, t.previewDesktop]] as const).map(([device, DeviceIcon, label]) => (
                  <button
                    key={device}
                    type="button"
                    onClick={() => setPreviewDevice(device)}
                    aria-pressed={previewDevice === device}
                    title={label}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${previewDevice === device ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
                  >
                    <DeviceIcon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <PreviewFrame device={previewDevice}>
                <PublicLandingPageView page={draftPage} previewMode />
              </PreviewFrame>
            </div>
          </div>
        </aside>
        </div>
      )}

      {mediaTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMediaTarget(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.mediaTitle}</h4>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => mediaInputRef.current?.click()} disabled={mediaUploading} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:opacity-50">
                  {t.uploadImages}
                </button>
                <input ref={mediaInputRef} type="file" multiple accept="image/*" className="hidden" onChange={uploadMediaFiles} />
                <button type="button" onClick={() => setMediaTarget(null)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
                  {t.mediaClose}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {mediaLibrary.map((item) => {
                const isCarousel = mediaTarget?.type === "carousel_images";
                const carouselImages = isCarousel
                  ? ((contentState.carousel_images.find((block) => block.id === mediaTarget?.id)?.images as Array<{ url?: string | null }> | undefined) ?? [])
                  : [];
                const selected = isCarousel && carouselImages.some((img) => img.url === item.url);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => (isCarousel ? toggleCarouselImage(mediaTarget!.id, item) : applyMediaPick(item.url))}
                    className={`relative overflow-hidden rounded-lg border ${selected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.file_name ?? ""} className="aspect-square w-full object-cover" />
                    {selected ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {lastRemoved ? (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--foreground)] shadow-lg">
          {t.blockRemoved}
          <button type="button" onClick={undoRemoveBlock} className="font-semibold text-[var(--accent)] hover:underline">
            {t.undo}
          </button>
        </div>
      ) : null}

      {variantPicker ? (
        <VariantPickerModal
          productId={variantPicker.product.id}
          productName={variantPicker.product.name}
          token={token}
          apiBase={LANDING_API_BASE}
          allowWholeProduct={!variantPicker.rowKey}
          onSelect={(variant) => handleVariantPicked(variant)}
          onSelectWhole={() => handleVariantPicked(null)}
          onClose={() => setVariantPicker(null)}
          locale={locale}
        />
      ) : null}
    </section>
  );
}
