"use client";

import { useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

/**
 * Storefront homepage/theme settings — S0 (homepage_mode) + S5 (theme,
 * banners, featured categories, about, policies, contact toggles).
 * seller_storefront_context.md §12.
 */
const t = {
  bn: {
    pageTitle: "স্টোরফ্রন্ট",
    intro: "আপনার সাবডোমেইনের হোমপেজ (রুট ঠিকানা) কী দেখাবে বেছে নিন। যেটাই বেছে নিন, ক্যাটাগরি/প্রোডাক্ট পেজ সবসময় সরাসরি লিংকে চালু থাকবে।",
    loading: "লোড হচ্ছে...",
    templateSection: "ডিজাইন টেমপ্লেট",
    templateHint: "আপনার স্টোরফ্রন্টের ডিজাইন বেছে নিন।",
    templateStandard: "Standard",
    templateStandardHint: "বর্তমান সাধারণ ডিজাইন।",
    templateCaresolution: "CareSolution Style",
    templateCaresolutionHint: "ডার্ক হেডার, ট্রাস্ট ব্যাজ, SALE ব্যাজসহ প্রোডাক্ট কার্ড, মোবাইলে বটম ন্যাভ বার।",
    shippingSection: "শিপিং চার্জ",
    shippingHint: "CareSolution টেমপ্লেটে কার্ট পেজে এই দুটো রেট দেখানো হবে এবং অর্ডারে যোগ হবে। খালি রাখলে ডিফল্ট রেট (৭০/১২০ টাকা) ব্যবহার হবে।",
    shippingInside: "ঢাকার ভেতরে (৳)",
    shippingOutside: "ঢাকার বাইরে (৳)",
    navBarSection: "ক্যাটাগরি ন্যাভ বার (CareSolution টেমপ্লেট)",
    navBarHint: "হোমপেজের উপরের ক্যাটাগরি বার-এর রঙ।",
    navBgColor: "ব্যাকগ্রাউন্ড কালার",
    navTextColor: "টেক্সট কালার",
    modeStorefront: "শপ হোমপেজ (ডিফল্ট)",
    modeStorefrontHint: "একটা পূর্ণাঙ্গ ক্যাটালগ হোমপেজ (ব্যানার/ফিচারড ক্যাটাগরি/টপ-সেলিং)।",
    modeLandingPage: "আমার একটা ল্যান্ডিং পেজ",
    modeLandingPageHint: "আপনার প্রকাশিত ল্যান্ডিং পেজগুলোর একটা রুট ঠিকানায় দেখাবে।",
    pickPage: "ল্যান্ডিং পেজ বেছে নিন",
    noPages: "কোনো প্রকাশিত ল্যান্ডিং পেজ নেই — আগে একটা পেজ প্রকাশ করুন।",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    saveSuccess: "সেভ হয়েছে।",
    saveFailed: "সেভ করা যায়নি, আবার চেষ্টা করুন।",
    selectRequired: "একটা ল্যান্ডিং পেজ বেছে নিন।",
    homepageSection: "হোমপেজ",
    themeSection: "থিম ও যোগাযোগ",
    themeColor: "থিম কালার (accent)",
    whatsappNumber: "হোয়াটসঅ্যাপ নম্বর (খালি রাখলে শপ প্রোফাইলের ফোন নম্বর ব্যবহার হবে)",
    showCallButton: "প্রোডাক্ট পেজে Call বাটন দেখাও",
    showWhatsappButton: "প্রোডাক্ট পেজে WhatsApp বাটন দেখাও",
    showMessengerButton: "প্রোডাক্ট পেজে Messenger বাটন দেখাও (ফেসবুক পেজ কানেক্টেড থাকলে)",
    bannerSection: "হোমপেজ ব্যানার",
    bannerHint: "হোমপেজের উপরে দেখানো হবে। একাধিক ব্যানার দিতে পারেন।",
    uploadBanner: "ব্যানার আপলোড করুন",
    linkUrlPlaceholder: "লিংক (ঐচ্ছিক)",
    bannerProductLabel: "প্রোডাক্ট লিংক",
    bannerNoProductLink: "কোনো লিংক না",
    featuredCategoriesSection: "ফিচারড ক্যাটাগরি",
    featuredCategoriesHint: "হোমপেজে কোন ক্যাটাগরিগুলো হাইলাইট করে দেখানো হবে বেছে নিন। কিছু না বাছলে সবগুলো দেখাবে। প্রতিটার জন্য একটা থাম্বনেইল ছবিও সেট করতে পারেন — সেট না করলে বর্তমানে যেভাবে দেখাচ্ছে (অক্ষরের গোল আইকন) সেভাবেই থাকবে।",
    categoryThumbUpload: "থাম্বনেইল",
    aboutSection: "শপ সম্পর্কে",
    aboutText: "শপ সম্পর্কে টেক্সট",
    uploadAboutImage: "ছবি আপলোড করুন",
    partnerSection: "পার্টনার/ব্র্যান্ড লোগো",
    partnerHint: "হোমপেজের নিচে লোগো স্ট্রিপ হিসেবে দেখাবে।",
    uploadPartnerLogo: "লোগো আপলোড করুন",
    policySection: "ওয়ারেন্টি ও ডেলিভারি (ডিফল্ট)",
    policyHint: "প্রোডাক্ট পেজে Warranty/Delivery ট্যাবের ডিফল্ট টেক্সট — প্রোডাক্ট চাইলে নিজের আলাদা টেক্সট সেট করতে পারবে।",
    warrantyPolicy: "ডিফল্ট ওয়ারেন্টি টেক্সট",
    deliveryPolicy: "ডিফল্ট ডেলিভারি টেক্সট",
    remove: "সরান",
    uploading: "আপলোড হচ্ছে...",
  },
  en: {
    pageTitle: "Storefront",
    intro: "Choose what your subdomain's homepage (root address) shows. Either way, category/product pages stay live at their own direct links.",
    loading: "Loading...",
    templateSection: "Design Template",
    templateHint: "Choose your storefront's design.",
    templateStandard: "Standard",
    templateStandardHint: "The current, plain design.",
    templateCaresolution: "CareSolution Style",
    templateCaresolutionHint: "Dark header, trust badges, SALE-badge product cards, mobile bottom nav bar.",
    shippingSection: "Shipping Charge",
    shippingHint: "Shown on the cart page and added to orders on the CareSolution template. Leave empty to use the default rates (৳70/৳120).",
    shippingInside: "Inside Dhaka (৳)",
    shippingOutside: "Outside Dhaka (৳)",
    navBarSection: "Category Nav Bar (CareSolution template)",
    navBarHint: "Colors for the category bar at the top of the homepage.",
    navBgColor: "Background color",
    navTextColor: "Text color",
    modeStorefront: "Shop homepage (default)",
    modeStorefrontHint: "A full catalog homepage (banners/featured categories/top-selling).",
    modeLandingPage: "One of my landing pages",
    modeLandingPageHint: "Shows one of your published landing pages at the root address.",
    pickPage: "Pick a landing page",
    noPages: "No published landing page yet — publish one first.",
    save: "Save",
    saving: "Saving...",
    saveSuccess: "Saved.",
    saveFailed: "Could not save, please try again.",
    selectRequired: "Please pick a landing page.",
    homepageSection: "Homepage",
    themeSection: "Theme & Contact",
    themeColor: "Theme color (accent)",
    whatsappNumber: "WhatsApp number (leave empty to use Shop Profile's phone)",
    showCallButton: "Show Call button on product pages",
    showWhatsappButton: "Show WhatsApp button on product pages",
    showMessengerButton: "Show Messenger button on product pages (if Facebook page connected)",
    bannerSection: "Homepage Banners",
    bannerHint: "Shown at the top of the homepage. You can add multiple.",
    uploadBanner: "Upload banner",
    linkUrlPlaceholder: "Link (optional)",
    bannerProductLabel: "Product link",
    bannerNoProductLink: "No link",
    featuredCategoriesSection: "Featured Categories",
    featuredCategoriesHint: "Choose which categories are highlighted on the homepage. Leave empty to show all. You can also set a thumbnail image for each — if not set, it keeps showing the current letter-circle icon.",
    categoryThumbUpload: "Thumbnail",
    aboutSection: "About the shop",
    aboutText: "About text",
    uploadAboutImage: "Upload image",
    partnerSection: "Partner/Brand Logos",
    partnerHint: "Shown as a logo strip at the bottom of the homepage.",
    uploadPartnerLogo: "Upload logo",
    policySection: "Warranty & Delivery (default)",
    policyHint: "Default text for the product page's Warranty/Delivery tabs — a product can set its own override.",
    warrantyPolicy: "Default warranty text",
    deliveryPolicy: "Default delivery text",
    remove: "Remove",
    uploading: "Uploading...",
  },
};

type LandingPageOption = { id: number; title: string; status: string };
type Category = { id: number; name: string; thumbnail_url: string | null };
type ProductOption = { id: number; name: string; slug: string };
type ImageEntry = { image_url: string; link_url: string | null };
type Settings = {
  homepage_mode: "storefront" | "landing_page";
  homepage_landing_page_id: number | null;
  theme_template: "standard" | "caresolution" | null;
  shipping_charge_inside_dhaka: string | number | null;
  shipping_charge_outside_dhaka: string | number | null;
  theme_primary_color: string | null;
  nav_bg_color: string | null;
  nav_text_color: string | null;
  whatsapp_number: string | null;
  show_call_button: boolean;
  show_whatsapp_button: boolean;
  show_messenger_button: boolean;
  banner_images: ImageEntry[] | null;
  featured_category_ids: number[] | null;
  about_text: string | null;
  about_image_url: string | null;
  partner_logos: ImageEntry[] | null;
  warranty_policy_text: string | null;
  delivery_policy_text: string | null;
};

export default function StorefrontSettingsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<LandingPageOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [mode, setMode] = useState<"storefront" | "landing_page">("storefront");
  const [pageId, setPageId] = useState<number | "">("");
  const [themeTemplate, setThemeTemplate] = useState<"standard" | "caresolution">("standard");
  const [shippingInside, setShippingInside] = useState("");
  const [shippingOutside, setShippingOutside] = useState("");
  const [navBgColor, setNavBgColor] = useState("#111827");
  const [navTextColor, setNavTextColor] = useState("#ffffff");
  const [themeColor, setThemeColor] = useState("#ea580c");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [showCall, setShowCall] = useState(true);
  const [showWhatsapp, setShowWhatsapp] = useState(true);
  const [showMessenger, setShowMessenger] = useState(true);
  const [featuredCategoryIds, setFeaturedCategoryIds] = useState<number[]>([]);
  const [aboutText, setAboutText] = useState("");
  const [aboutImageUrl, setAboutImageUrl] = useState<string | null>(null);
  const [warrantyText, setWarrantyText] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [banners, setBanners] = useState<ImageEntry[]>([]);
  const [partnerLogos, setPartnerLogos] = useState<ImageEntry[]>([]);
  const [bannerLinkInput, setBannerLinkInput] = useState("");
  const [partnerLinkInput, setPartnerLinkInput] = useState("");
  const [thumbUploadingId, setThumbUploadingId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const txt = t[locale];
  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    setLocale(getStoredLocale());
    setToken(getStoredToken());
  }, []);

  function applySettings(settings: Settings) {
    if (settings.homepage_mode) setMode(settings.homepage_mode);
    if (settings.homepage_landing_page_id) setPageId(settings.homepage_landing_page_id);
    setThemeTemplate(settings.theme_template === "caresolution" ? "caresolution" : "standard");
    setShippingInside(settings.shipping_charge_inside_dhaka != null ? String(settings.shipping_charge_inside_dhaka) : "");
    setShippingOutside(settings.shipping_charge_outside_dhaka != null ? String(settings.shipping_charge_outside_dhaka) : "");
    setNavBgColor(settings.nav_bg_color || "#111827");
    setNavTextColor(settings.nav_text_color || "#ffffff");
    setThemeColor(settings.theme_primary_color || "#ea580c");
    setWhatsappNumber(settings.whatsapp_number ?? "");
    setShowCall(settings.show_call_button ?? true);
    setShowWhatsapp(settings.show_whatsapp_button ?? true);
    setShowMessenger(settings.show_messenger_button ?? true);
    setFeaturedCategoryIds(settings.featured_category_ids ?? []);
    setAboutText(settings.about_text ?? "");
    setAboutImageUrl(settings.about_image_url ?? null);
    setWarrantyText(settings.warranty_policy_text ?? "");
    setDeliveryText(settings.delivery_policy_text ?? "");
    setBanners(settings.banner_images ?? []);
    setPartnerLogos(settings.partner_logos ?? []);
  }

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const [settingsRes, pagesRes, categoriesRes, productsRes] = await Promise.all([
          fetch(`${API}/storefront-settings`, { headers: authHeaders }),
          fetch(`${API}/landing/pages?per_page=100`, { headers: authHeaders }),
          fetch(`${API}/categories`, { headers: authHeaders }),
          fetch(`${API}/products?per_page=200&status=active`, { headers: authHeaders }),
        ]);

        const settingsJson = await settingsRes.json().catch(() => ({}));
        const pagesJson = await pagesRes.json().catch(() => ({}));
        const categoriesJson = await categoriesRes.json().catch(() => ({}));
        const productsJson = await productsRes.json().catch(() => ({}));

        if (settingsJson?.data) applySettings(settingsJson.data);

        const published: LandingPageOption[] = (pagesJson?.data ?? []).filter(
          (p: LandingPageOption) => p.status === "published",
        );
        setPages(published);
        setCategories(categoriesJson?.data ?? []);
        setProducts(productsJson?.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function toggleFeaturedCategory(id: number) {
    setFeaturedCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (mode === "landing_page" && !pageId) {
      setMessage({ success: false, text: txt.selectRequired });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`${API}/storefront-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          homepage_mode: mode,
          homepage_landing_page_id: mode === "landing_page" ? pageId : null,
          theme_template: themeTemplate,
          shipping_charge_inside_dhaka: shippingInside === "" ? null : Number(shippingInside),
          shipping_charge_outside_dhaka: shippingOutside === "" ? null : Number(shippingOutside),
          nav_bg_color: navBgColor,
          nav_text_color: navTextColor,
          theme_primary_color: themeColor,
          whatsapp_number: whatsappNumber || null,
          show_call_button: showCall,
          show_whatsapp_button: showWhatsapp,
          show_messenger_button: showMessenger,
          featured_category_ids: featuredCategoryIds,
          about_text: aboutText || null,
          warranty_policy_text: warrantyText || null,
          delivery_policy_text: deliveryText || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error("save failed");

      applySettings(data.data);
      setMessage({ success: true, text: txt.saveSuccess });
    } catch {
      setMessage({ success: false, text: txt.saveFailed });
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(endpoint: string, file: File, linkUrl?: string) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      if (linkUrl) body.append("link_url", linkUrl);

      const res = await fetch(`${API}/storefront-settings/${endpoint}`, {
        method: "POST",
        headers: authHeaders,
        body,
      });
      const data = await res.json();
      if (res.ok) applySettings(data.data);
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(endpoint: string) {
    setUploading(true);
    try {
      const res = await fetch(`${API}/storefront-settings/${endpoint}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (res.ok) applySettings(data.data);
    } finally {
      setUploading(false);
    }
  }

  async function uploadCategoryThumbnail(categoryId: number, file: File) {
    setThumbUploadingId(categoryId);
    try {
      const body = new FormData();
      body.append("image", file);

      const res = await fetch(`${API}/categories/${categoryId}/thumbnail`, {
        method: "POST",
        headers: authHeaders,
        body,
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, thumbnail_url: data.data.thumbnail_url } : c)));
      }
    } finally {
      setThumbUploadingId(null);
    }
  }

  async function removeCategoryThumbnail(categoryId: number) {
    setThumbUploadingId(categoryId);
    try {
      const res = await fetch(`${API}/categories/${categoryId}/thumbnail`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (res.ok) {
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, thumbnail_url: null } : c)));
      }
    } finally {
      setThumbUploadingId(null);
    }
  }

  if (loading) {
    return (
      <UserShell activeKey="storefront-settings" defaultExpandedKey="settings">
        <p className="py-16 text-center text-[var(--muted)]">{txt.loading}</p>
      </UserShell>
    );
  }

  return (
    <UserShell activeKey="storefront-settings" defaultExpandedKey="settings">
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold sm:text-2xl">{txt.pageTitle}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{txt.intro}</p>

        {/* Design template */}
        <section className="catv-panel mt-5 p-5">
          <h2 className="text-sm font-bold">{txt.templateSection}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{txt.templateHint}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-3 ${themeTemplate === "standard" ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]"}`}
            >
              <input type="radio" checked={themeTemplate === "standard"} onChange={() => setThemeTemplate("standard")} className="hidden" />
              <div className="mb-2 h-16 rounded-lg bg-gradient-to-b from-slate-100 to-white" />
              <span className="block text-sm font-semibold">{txt.templateStandard}</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">{txt.templateStandardHint}</span>
            </label>
            <label
              className={`cursor-pointer rounded-xl border p-3 ${themeTemplate === "caresolution" ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]"}`}
            >
              <input type="radio" checked={themeTemplate === "caresolution"} onChange={() => setThemeTemplate("caresolution")} className="hidden" />
              <div className="mb-2 h-16 rounded-lg bg-gradient-to-b from-neutral-900 via-neutral-900 to-orange-500" />
              <span className="block text-sm font-semibold">{txt.templateCaresolution}</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">{txt.templateCaresolutionHint}</span>
            </label>
          </div>
        </section>

        {/* Shipping charge */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="text-sm font-bold">{txt.shippingSection}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{txt.shippingHint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.shippingInside}</span>
              <input
                type="number"
                min={0}
                value={shippingInside}
                onChange={(e) => setShippingInside(e.target.value)}
                placeholder="70"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.shippingOutside}</span>
              <input
                type="number"
                min={0}
                value={shippingOutside}
                onChange={(e) => setShippingOutside(e.target.value)}
                placeholder="120"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        {/* Category nav bar colors */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="text-sm font-bold">{txt.navBarSection}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{txt.navBarHint}</p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.navBgColor}</span>
              <input type="color" value={navBgColor} onChange={(e) => setNavBgColor(e.target.value)} className="h-10 w-16 rounded-lg border border-[var(--border)]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.navTextColor}</span>
              <input type="color" value={navTextColor} onChange={(e) => setNavTextColor(e.target.value)} className="h-10 w-16 rounded-lg border border-[var(--border)]" />
            </label>
            <div
              className="flex h-10 flex-1 min-w-[160px] items-center rounded-lg px-4 text-sm font-medium"
              style={{ background: navBgColor, color: navTextColor }}
            >
              {(categories[0]?.name ?? "Category")} · {(categories[1]?.name ?? "Category")}
            </div>
          </div>
        </section>

        {/* Homepage mode */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="mb-3 text-sm font-bold">{txt.homepageSection}</h2>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3">
            <input type="radio" checked={mode === "storefront"} onChange={() => setMode("storefront")} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
            <span>
              <span className="block text-sm font-semibold">{txt.modeStorefront}</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">{txt.modeStorefrontHint}</span>
            </span>
          </label>

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3">
            <input type="radio" checked={mode === "landing_page"} onChange={() => setMode("landing_page")} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
            <span className="w-full">
              <span className="block text-sm font-semibold">{txt.modeLandingPage}</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">{txt.modeLandingPageHint}</span>
              {mode === "landing_page" ? (
                pages.length > 0 ? (
                  <select
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value ? Number(e.target.value) : "")}
                    className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="">{txt.pickPage}</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-2 text-xs text-amber-600">{txt.noPages}</p>
                )
              ) : null}
            </span>
          </label>
        </section>

        {/* Theme & contact */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="mb-3 text-sm font-bold">{txt.themeSection}</h2>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">{txt.themeColor}</span>
            <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-16 rounded-lg border border-[var(--border)]" />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-[var(--muted)]">{txt.whatsappNumber}</span>
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-3 space-y-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showCall} onChange={(e) => setShowCall(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              {txt.showCallButton}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showWhatsapp} onChange={(e) => setShowWhatsapp(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              {txt.showWhatsappButton}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showMessenger} onChange={(e) => setShowMessenger(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              {txt.showMessengerButton}
            </label>
          </div>
        </section>

        {/* Banners */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="text-sm font-bold">{txt.bannerSection}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{txt.bannerHint}</p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {banners.map((b, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-[var(--border)]">
                <img src={b.image_url} alt="" className="h-24 w-full object-cover" />
                <button
                  onClick={() => removeImage(`banners/${i}`)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                >
                  {txt.remove}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.bannerProductLabel}</span>
              <select
                value={bannerLinkInput}
                onChange={(e) => setBannerLinkInput(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
              >
                <option value="">{txt.bannerNoProductLink}</option>
                {products.map((p) => (
                  <option key={p.id} value={`/product/${p.slug}`}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="cursor-pointer self-end rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              {uploading ? txt.uploading : txt.uploadBanner}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage("banners", file, bannerLinkInput || undefined);
                  e.target.value = "";
                  setBannerLinkInput("");
                }}
              />
            </label>
          </div>
        </section>

        {/* Featured categories */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="text-sm font-bold">{txt.featuredCategoriesSection}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{txt.featuredCategoriesHint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border p-3 ${featuredCategoryIds.includes(c.id) ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]"}`}
              >
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={featuredCategoryIds.includes(c.id)}
                    onChange={() => toggleFeaturedCategory(c.id)}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  {c.name}
                </label>

                <div className="mt-2 flex items-center gap-2">
                  {c.thumbnail_url ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.thumbnail_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      <button
                        onClick={() => removeCategoryThumbnail(c.id)}
                        disabled={thumbUploadingId === c.id}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[9px] text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/10 text-sm text-[var(--accent)]">
                      {c.name.charAt(0)}
                    </span>
                  )}
                  <label className="cursor-pointer text-[11px] font-medium text-[var(--accent)]">
                    {thumbUploadingId === c.id ? txt.uploading : txt.categoryThumbUpload}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={thumbUploadingId === c.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadCategoryThumbnail(c.id, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="text-sm font-bold">{txt.aboutSection}</h2>
          <textarea
            rows={3}
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            placeholder={txt.aboutText}
            className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <div className="mt-3 flex items-center gap-3">
            {aboutImageUrl ? (
              <div className="relative">
                <img src={aboutImageUrl} alt="" className="h-20 w-32 rounded-lg object-cover" />
                <button
                  onClick={() => removeImage("about-image")}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                >
                  {txt.remove}
                </button>
              </div>
            ) : null}
            <label className="cursor-pointer rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">
              {uploading ? txt.uploading : txt.uploadAboutImage}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage("about-image", file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </section>

        {/* Partner logos */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="text-sm font-bold">{txt.partnerSection}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{txt.partnerHint}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {partnerLogos.map((p, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-[var(--border)]">
                <img src={p.image_url} alt="" className="h-14 w-24 object-contain" />
                <button
                  onClick={() => removeImage(`partner-logos/${i}`)}
                  className="absolute right-0 top-0 rounded-bl-lg bg-black/60 px-1.5 py-0.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={partnerLinkInput}
              onChange={(e) => setPartnerLinkInput(e.target.value)}
              placeholder={txt.linkUrlPlaceholder}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
            />
            <label className="cursor-pointer rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">
              {uploading ? txt.uploading : txt.uploadPartnerLogo}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage("partner-logos", file, partnerLinkInput || undefined);
                  e.target.value = "";
                  setPartnerLinkInput("");
                }}
              />
            </label>
          </div>
        </section>

        {/* Warranty/Delivery policy */}
        <section className="catv-panel mt-4 p-5">
          <h2 className="text-sm font-bold">{txt.policySection}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{txt.policyHint}</p>
          <textarea
            rows={2}
            value={warrantyText}
            onChange={(e) => setWarrantyText(e.target.value)}
            placeholder={txt.warrantyPolicy}
            className="mt-3 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <textarea
            rows={2}
            value={deliveryText}
            onChange={(e) => setDeliveryText(e.target.value)}
            placeholder={txt.deliveryPolicy}
            className="mt-3 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </section>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? txt.saving : txt.save}
          </button>
          {message ? (
            <p className={`text-sm ${message.success ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>
          ) : null}
        </div>
      </main>
    </UserShell>
  );
}
