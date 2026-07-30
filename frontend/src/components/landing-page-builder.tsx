"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, Image as ImageIcon, Type, Video, ShieldCheck, Timer, Star, HelpCircle, Images, Rows3, LayoutGrid, FileText, Palette, Layers, ShoppingBag, Settings as SettingsIcon } from "lucide-react";
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
  IconPickerField,
  RichTextEditorField,
  ImagePickerField,
  isAllowedVideoUrl,
} from "@/components/landing-builder/block-fields";
import type { JSONContent } from "@tiptap/react";
import PublicLandingPageView, { type PublicLandingPage } from "@/components/public-landing-page-view";
import VariantPickerModal from "@/components/products/variant-picker-modal";
import type { ProductVariant } from "@/types/variant";

type LandingPageBuilderProps = {
  locale?: Locale;
  mode: "create" | "edit";
  pageId?: string;
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

const BLOCK_LABELS: Record<Locale, Record<BlockType, string>> = {
  bn: {
    html_sections: "টেক্সট সেকশন",
    carousel_images: "ইমেজ ক্যারুসেল",
    features: "ফিচার গ্রিড",
    faq: "FAQ",
    reviews: "রিভিউ",
    rich_text_blocks: "রিচ টেক্সট",
    image_text_blocks: "ছবি + টেক্সট",
    video_embeds: "ভিডিও",
    trust_badges: "ট্রাস্ট ব্যাজ",
    countdown_blocks: "কাউন্টডাউন",
    spacers: "স্পেসার",
    products: "পণ্য ও চেকআউট",
  },
  en: {
    html_sections: "Text Section",
    carousel_images: "Image Carousel",
    features: "Feature Grid",
    faq: "FAQ",
    reviews: "Reviews",
    rich_text_blocks: "Rich Text",
    image_text_blocks: "Image + Text",
    video_embeds: "Video Embed",
    trust_badges: "Trust Badges",
    countdown_blocks: "Countdown Timer",
    spacers: "Spacer",
    products: "Products & Checkout",
  },
};

const ADDABLE_TYPES: BlockType[] = [
  "rich_text_blocks",
  "image_text_blocks",
  "features",
  "trust_badges",
  "carousel_images",
  "video_embeds",
  "countdown_blocks",
  "reviews",
  "faq",
  "spacers",
];

const BLOCK_ICONS: Record<BlockType, React.ComponentType<{ size?: number }>> = {
  html_sections: Type,
  carousel_images: Images,
  features: LayoutGrid,
  faq: HelpCircle,
  reviews: Star,
  rich_text_blocks: Type,
  image_text_blocks: ImageIcon,
  video_embeds: Video,
  trust_badges: ShieldCheck,
  countdown_blocks: Timer,
  spacers: Rows3,
  products: LayoutGrid,
};

type TabKey = "content" | "design" | "blocks" | "products" | "settings";

const TAB_ORDER: TabKey[] = ["content", "design", "blocks", "products", "settings"];

const TAB_ICONS: Record<TabKey, React.ComponentType<{ size?: number }>> = {
  content: FileText,
  design: Palette,
  blocks: Layers,
  products: ShoppingBag,
  settings: SettingsIcon,
};

function defaultItemFor(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "rich_text_blocks":
      return { title: "", body: { type: "doc", content: [{ type: "paragraph" }] } };
    case "image_text_blocks":
      return { image_url: "", image_position: "left", heading: "", body: "", cta_text: "", cta_url: "" };
    case "features":
      return { title: "", description: "", icon: "star" };
    case "trust_badges":
      return { icon: "shield-check", label: "", sublabel: "" };
    case "carousel_images":
      return { title: "", template: "style-1", images: [] };
    case "video_embeds":
      return { title: "", url: "" };
    case "countdown_blocks":
      return { message: "", end_datetime: "" };
    case "reviews":
      return { name: "", quote: "", rating: 5, avatar_url: "" };
    case "faq":
      return { q: "", a: "" };
    case "spacers":
      return { style: "space", size: "md" };
    default:
      return {};
  }
}

const text = {
  bn: {
    loading: "লোড হচ্ছে...",
    loadFailed: "ডেটা লোড করা যায়নি।",
    submitFailed: "সংরক্ষণ করা যায়নি।",
    createSuccess: "ল্যান্ডিং পেজ তৈরি হয়েছে।",
    updateSuccess: "ল্যান্ডিং পেজ আপডেট হয়েছে।",
    title: "পেজ শিরোনাম",
    slug: "স্লাগ",
    status: "স্ট্যাটাস",
    draft: "Draft",
    published: "Published",
    hero: "Hero",
    heroHeadline: "Hero headline",
    heroSubheadline: "Hero subheadline",
    heroCtaText: "CTA বাটন টেক্সট",
    heroImage: "Hero ব্যাকগ্রাউন্ড ছবি (ঐচ্ছিক)",
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
    pickImages: "Gallery থেকে ছবি সিলেক্ট করুন",
    selectedCount: "Selected",
  },
  en: {
    loading: "Loading...",
    loadFailed: "Failed to load data.",
    submitFailed: "Failed to save landing page.",
    createSuccess: "Landing page created.",
    updateSuccess: "Landing page updated.",
    title: "Page title",
    slug: "Slug",
    status: "Status",
    draft: "Draft",
    published: "Published",
    hero: "Hero",
    heroHeadline: "Hero headline",
    heroSubheadline: "Hero subheadline",
    heroCtaText: "CTA button text",
    heroImage: "Hero background image (optional)",
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
    pickImages: "Pick images from gallery",
    selectedCount: "Selected",
  },
};

export default function LandingPageBuilder({ locale: localeProp, mode, pageId }: LandingPageBuilderProps) {
  const router = useRouter();
  const contextLocale = useLocale();
  const locale = localeProp ?? contextLocale;
  const t = text[locale] ?? text.en;
  const blockLabels = BLOCK_LABELS[locale] ?? BLOCK_LABELS.en;
  const tabLabels: Record<TabKey, string> = {
    content: t.tabContent,
    design: t.tabDesign,
    blocks: t.tabBlocks,
    products: t.tabProducts,
    settings: t.tabSettings,
  };
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
  const [theme, setTheme] = useState<ThemeSettings>({ ...DEFAULT_THEME });

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

    const load = async () => {
      try {
        setError(null);
        const [templatesRes, productsRes, mediaPolicyRes, mediaLibraryRes, pageRes] = await Promise.all([
          fetch(`${LANDING_API_BASE}/landing/templates`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/products?per_page=100`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/landing/media-library/policy`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${LANDING_API_BASE}/landing/media-library`, { headers: { Authorization: `Bearer ${token}` } }),
          mode === "edit" && pageId
            ? fetch(`${LANDING_API_BASE}/landing/pages/${pageId}`, { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve(null),
        ]);

        if (!templatesRes.ok || !productsRes.ok || !mediaPolicyRes.ok || !mediaLibraryRes.ok || (pageRes && !pageRes.ok)) {
          throw new Error(t.loadFailed);
        }

        setTemplates((await templatesRes.json()).data ?? []);
        const productsJson = await productsRes.json();
        setProducts((productsJson.data ?? []).filter((item: ProductItem) => item.status !== "archived"));
        setMediaPolicy((await mediaPolicyRes.json()).data ?? null);
        setMediaLibrary((await mediaLibraryRes.json()).data ?? []);

        if (pageRes) {
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
  }, [token, mode, pageId]);

  function patchItem(type: BlockType, id: string, changes: Record<string, unknown>) {
    setContentState((prev) => ({
      ...prev,
      [type]: prev[type].map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));
  }

  function addBlock(type: BlockType, afterEntry?: LayoutEntry) {
    const id = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const item: Item = { id, ...defaultItemFor(type) };
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
    setContentState((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== id) }));
    setLayoutEntries((prev) => prev.filter((entry) => !(entry.type === type && entry.id === id)));
  }

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

  function applyMediaPick(url: string) {
    if (!mediaTarget) return;
    if (mediaTarget.type === "hero") {
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
      contact: { phone: contactPhone || null },
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
    seo_meta: { meta_title: metaTitle || title, meta_description: metaDescription || null },
    custom_css: page?.custom_css ?? null,
    products: selectedProductDetails as unknown as PublicLandingPage["products"],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [page, title, slug, theme, contentState, layoutEntries, heroHeadline, heroSubheadline, heroCtaText, heroImage, featuresTitle, featuresLayout, trustBadgesLayout, productsTitle, productsSubtitle, checkoutFields, contactPhone, shippingInsideDhaka, shippingOutsideDhaka, thankYouTitle, thankYouMessage, thankYouShowSummary, thankYouShowAddress, pageLanguage, phoneValidationEnabled, phoneValidationMessage, otpVerificationEnabled, otpVerifiedMessage, otpSmsTemplate, otpFormTitle, otpFormDescription, otpFormButtonText, otpFormResendText, metaTitle, metaDescription, locale, selectedProductDetails]);

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

      const payload = {
        title,
        slug: slug.trim() || undefined,
        status,
        content,
        seo_meta: { meta_title: metaTitle || title, meta_description: metaDescription || null },
        theme_settings: theme,
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
        throw new Error(json.message || Object.values(json.errors ?? {}).flat().join(" ") || t.submitFailed);
      }

      const nextId = json.data?.id ?? pageId;
      setSuccess(mode === "edit" ? t.updateSuccess : t.createSuccess);
      if (nextId) {
        setTimeout(() => router.push(`/dashboard/landing-pages/${nextId}`), 700);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.submitFailed);
    } finally {
      setSaving(false);
    }
  }

  function renderBlockItem(entry: LayoutEntry) {
    const Icon = BLOCK_ICONS[entry.type];

    if (SINGLETON_BLOCK_TYPES.includes(entry.type)) {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <Icon size={14} /> {blockLabels[entry.type]}
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
            <Icon size={14} /> {blockLabels[entry.type]}
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
                  {ADDABLE_TYPES.map((addType) => {
                    const AddIcon = BLOCK_ICONS[addType];
                    return (
                      <button key={addType} type="button" onClick={() => addBlock(addType, entry)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-soft)]">
                        <AddIcon size={14} /> {blockLabels[addType]}
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
    const patch = (changes: Record<string, unknown>) => patchItem(type, item.id, changes);

    switch (type) {
      case "rich_text_blocks":
        return (
          <>
            <TextField label={locale === "bn" ? "শিরোনাম (ঐচ্ছিক)" : "Title (optional)"} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
            <RichTextEditorField value={item.body as JSONContent | undefined} onChange={(json) => patch({ body: json })} />
          </>
        );
      case "image_text_blocks":
        return (
          <>
            <ImagePickerField
              label={locale === "bn" ? "ছবি" : "Image"}
              value={String(item.image_url ?? "")}
              locale={locale}
              onPick={() => setMediaTarget({ type, id: item.id, field: "image_url" })}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{locale === "bn" ? "ছবির অবস্থান" : "Image position"}</span>
              <select value={String(item.image_position ?? "left")} onChange={(e) => patch({ image_position: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <option value="left">{locale === "bn" ? "বামে" : "Left"}</option>
                <option value="right">{locale === "bn" ? "ডানে" : "Right"}</option>
              </select>
            </label>
            <TextField label={locale === "bn" ? "হেডিং" : "Heading"} value={String(item.heading ?? "")} onChange={(v) => patch({ heading: v })} />
            <TextAreaField label={locale === "bn" ? "বর্ণনা" : "Body"} value={String(item.body ?? "")} onChange={(v) => patch({ body: v })} />
            <TextField label={locale === "bn" ? "বাটন টেক্সট (ঐচ্ছিক)" : "Button text (optional)"} value={String(item.cta_text ?? "")} onChange={(v) => patch({ cta_text: v })} />
            <TextField label={locale === "bn" ? "বাটন লিংক (ঐচ্ছিক)" : "Button link (optional)"} value={String(item.cta_url ?? "")} onChange={(v) => patch({ cta_url: v })} />
          </>
        );
      case "features": {
        const isFirst = contentState.features[0]?.id === item.id;
        return (
          <>
            {isFirst ? (
              <div className="mb-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs text-[var(--muted)]">{t.sectionWideHint}</p>
                <TextField label={t.featuresTitle} value={featuresTitle} onChange={setFeaturesTitle} />
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t.featuresLayout}</span>
                  <select
                    value={featuresLayout}
                    onChange={(e) => setFeaturesLayout(e.target.value as "cards" | "list" | "minimal")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                  >
                    <option value="cards">{t.featuresLayoutCards}</option>
                    <option value="list">{t.featuresLayoutList}</option>
                    <option value="minimal">{t.featuresLayoutMinimal}</option>
                  </select>
                </label>
              </div>
            ) : null}
            <IconPickerField label={locale === "bn" ? "আইকন" : "Icon"} value={String(item.icon ?? "star")} onChange={(v) => patch({ icon: v })} locale={locale} />
            <TextField label={locale === "bn" ? "শিরোনাম" : "Title"} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
            <TextAreaField label={locale === "bn" ? "বর্ণনা" : "Description"} value={String(item.description ?? "")} onChange={(v) => patch({ description: v })} rows={2} />
          </>
        );
      }
      case "trust_badges": {
        const isFirst = contentState.trust_badges[0]?.id === item.id;
        return (
          <>
            {isFirst ? (
              <div className="mb-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs text-[var(--muted)]">{t.sectionWideHint}</p>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t.trustBadgesLayout}</span>
                  <select
                    value={trustBadgesLayout}
                    onChange={(e) => setTrustBadgesLayout(e.target.value as "cards" | "row" | "minimal")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                  >
                    <option value="cards">{t.trustBadgesLayoutCards}</option>
                    <option value="row">{t.trustBadgesLayoutRow}</option>
                    <option value="minimal">{t.trustBadgesLayoutMinimal}</option>
                  </select>
                </label>
              </div>
            ) : null}
            <IconPickerField label={locale === "bn" ? "আইকন" : "Icon"} value={String(item.icon ?? "shield-check")} onChange={(v) => patch({ icon: v })} locale={locale} />
            <TextField label={locale === "bn" ? "লেবেল" : "Label"} value={String(item.label ?? "")} onChange={(v) => patch({ label: v })} />
            <TextField label={locale === "bn" ? "সাব-লেবেল (ঐচ্ছিক)" : "Sublabel (optional)"} value={String(item.sublabel ?? "")} onChange={(v) => patch({ sublabel: v })} />
          </>
        );
      }
      case "video_embeds": {
        const url = String(item.url ?? "");
        const invalid = url.trim().length > 0 && !isAllowedVideoUrl(url);
        return (
          <>
            <TextField label={locale === "bn" ? "শিরোনাম (ঐচ্ছিক)" : "Title (optional)"} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
            <TextField label="YouTube / Facebook / Vimeo URL" value={url} onChange={(v) => patch({ url: v })} placeholder="https://youtube.com/watch?v=..." />
            {invalid ? <p className="text-xs text-red-400">{t.invalidVideoUrl}</p> : null}
          </>
        );
      }
      case "countdown_blocks":
        return (
          <>
            <TextField label={locale === "bn" ? "মেসেজ" : "Message"} value={String(item.message ?? "")} onChange={(v) => patch({ message: v })} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{locale === "bn" ? "শেষ সময়" : "End date/time"}</span>
              <input type="datetime-local" value={String(item.end_datetime ?? "")} onChange={(e) => patch({ end_datetime: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" />
            </label>
          </>
        );
      case "reviews":
        return (
          <>
            <ImagePickerField
              label={locale === "bn" ? "প্রোফাইল ছবি (ঐচ্ছিক)" : "Avatar (optional)"}
              value={String(item.avatar_url ?? "")}
              locale={locale}
              onPick={() => setMediaTarget({ type, id: item.id, field: "avatar_url" })}
            />
            <TextField label={locale === "bn" ? "নাম" : "Name"} value={String(item.name ?? "")} onChange={(v) => patch({ name: v })} />
            <TextAreaField label={locale === "bn" ? "রিভিউ" : "Quote"} value={String(item.quote ?? "")} onChange={(v) => patch({ quote: v })} rows={2} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{locale === "bn" ? "রেটিং" : "Rating"}</span>
              <select value={String(item.rating ?? 5)} onChange={(e) => patch({ rating: Number(e.target.value) })} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            </label>
          </>
        );
      case "faq":
        return (
          <>
            <TextField label={locale === "bn" ? "প্রশ্ন" : "Question"} value={String(item.q ?? "")} onChange={(v) => patch({ q: v })} />
            <TextAreaField label={locale === "bn" ? "উত্তর" : "Answer"} value={String(item.a ?? "")} onChange={(v) => patch({ a: v })} rows={2} />
          </>
        );
      case "spacers":
        return (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{locale === "bn" ? "স্টাইল" : "Style"}</span>
              <select value={String(item.style ?? "space")} onChange={(e) => patch({ style: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <option value="space">{locale === "bn" ? "ফাঁকা জায়গা" : "Blank space"}</option>
                <option value="line">{locale === "bn" ? "লাইন" : "Line"}</option>
                <option value="dots">{locale === "bn" ? "ডট" : "Dots"}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{locale === "bn" ? "সাইজ" : "Size"}</span>
              <select value={String(item.size ?? "md")} onChange={(e) => patch({ size: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <option value="sm">{locale === "bn" ? "ছোট" : "Small"}</option>
                <option value="md">{locale === "bn" ? "মাঝারি" : "Medium"}</option>
                <option value="lg">{locale === "bn" ? "বড়" : "Large"}</option>
              </select>
            </label>
          </div>
        );
      case "html_sections":
        return (
          <>
            <TextField label={locale === "bn" ? "শিরোনাম" : "Title"} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
            <p className="text-xs text-[var(--muted)]">{locale === "bn" ? "এই সেকশনটি পুরনো এডিটরে তৈরি — নতুন বিল্ডারে কোড এডিট করা যায় না।" : "Created in the old editor — code can't be edited from this builder."}</p>
          </>
        );
      case "carousel_images": {
        const images = (item.images as Array<{ id?: number | null; url?: string | null; alt?: string | null }> | undefined) ?? [];
        return (
          <>
            <TextField label={locale === "bn" ? "শিরোনাম" : "Title"} value={String(item.title ?? "")} onChange={(v) => patch({ title: v })} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{locale === "bn" ? "স্টাইল" : "Style"}</span>
              <select value={String(item.template ?? "style-1")} onChange={(e) => patch({ template: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <option value="style-1">Style 1</option>
                <option value="style-2">Style 2</option>
              </select>
            </label>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setMediaTarget({ type: "carousel_images", id: item.id, field: "images" })} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
                {t.pickImages}
              </button>
              <span className="text-xs text-[var(--muted)]">{t.selectedCount}: {images.length}</span>
            </div>
            {images.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {images.map((image, imageIndex) => (
                  <div key={`${image.url}-${imageIndex}`} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url ?? ""} alt={image.alt ?? ""} className="aspect-square w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </>
        );
      }
      default:
        return null;
    }
  }

  return (
    <section className="mx-auto max-w-[1600px] catv-panel p-4 sm:p-5">
      {loading ? (
        <div className="text-sm text-[var(--muted)]">{t.loading}</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {(error || success) ? (
            <div className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>{error || success}</div>
          ) : null}

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
                  <option value="published">{t.published}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1.5">
            {TAB_ORDER.map((tabKey) => {
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
                      {ADDABLE_TYPES.map((type) => {
                        const Icon = BLOCK_ICONS[type];
                        return (
                          <button key={type} type="button" onClick={() => addBlock(type)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-soft)]">
                            <Icon size={14} /> {blockLabels[type]}
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
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? t.saving : t.save}
            </button>
          </div>
        </form>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <h3 className="text-base font-semibold text-[var(--foreground)]">{t.livePreview}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.livePreviewHint}</p>
            <div className="mt-4 max-h-[80vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--border)]">
              <PublicLandingPageView page={draftPage} previewMode />
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
        />
      ) : null}
    </section>
  );
}
