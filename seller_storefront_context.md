# BSOL — সেলার স্টোরফ্রন্ট (ফুল ইকমার্স শপ) — প্ল্যান

**অবস্থা:** ফিজিবিলিটি যাচাই + ফেজ প্ল্যান সম্পন্ন (২০২৬-০৮-২১)। **কোনো migration/কোড এখনো লেখা হয়নি — user-এর অনুমতির অপেক্ষায়।**

**সম্পর্কিত:** `custom_domain_context.md` (per-seller সাবডোমেইন — এই ফিচারের ভিত্তি), `landing_page_context.md` (single-product ক্যাম্পেইন পেজ — এর পাশে বসবে, প্রতিস্থাপন না), `tracking_capi_context.md` (Pixel/CAPI — storefront পেজে extend করতে হবে), `digital_product_context.md` (Product model-এ সাম্প্রতিক ডিজিটাল-প্রোডাক্ট এক্সটেনশন, একই cart-এ থাকবে), `SAAS_MODULE_CONTEXT.md §21`, `feature_roadmap_context.md` আইটেম #৯।

---

## ০. সমস্যা ও লক্ষ্য

User-এর নিজের কথায়: "আমাদের এই SaaS-এ সকল সুবিধা একজন সেলার পেয়ে যাবে। একটা সুবিধা বাকি — সেলার শপ, পাবলিক-এর জন্য একটা ইকমার্স শপ, যেখানে সাধারণ কাস্টমাররা সেলারের একটা পূর্ণাঙ্গ ইকমার্স শপ দেখতে পাবে।" রেফারেন্স হিসেবে ১৮টা বাস্তব BD ইকমার্স শপের লিংক দেওয়া হয়েছে (lorettaleather.com.bd, trinoorbd.com, organic.deshitech.com, ইত্যাদি) এবং Ghorer Bazar (organic.deshitech.com)-এর হোমপেজ/প্রোডাক্ট-ডিটেইল/মোবাইল ভিউ-এর তিনটা স্ক্রিনশট রেফারেন্স ডিজাইন হিসেবে দেওয়া হয়েছে।

এখন bsol-এ যা আছে (`LandingPage`) সেটা একটা **single-product ক্যাম্পেইন পেজ** — বিজ্ঞাপন-ট্র্যাফিকের জন্য ডিজাইন করা, ব্লক-বিল্ডার দিয়ে বানানো, এক পেজে সাধারণত একটা মূল প্রোডাক্ট। এই ফিচার সেটার **পাশে** একটা নতুন জিনিস যোগ করে: প্রতিটা সেলারের সব প্রোডাক্ট ব্রাউজ করা যাবে এমন একটা পূর্ণাঙ্গ, স্থায়ী ক্যাটালগ শপ — হোমপেজ, ক্যাটাগরি নেভিগেশন, লিস্টিং, সার্চ, কার্ট, প্রোডাক্ট ডিটেইল, রিভিউ।

---

## ১. রেফারেন্স ডিজাইন — স্ক্রিনশট থেকে স্পেসিফিকেশন

### হোমপেজ
- Top bar: লোগো, সার্চ বক্স, "Order inquiry" ফোন নম্বর, কার্ট আইকন (item count + amount), Login/Register
- ক্যাটাগরি নেভ বার (হরাইজন্টাল মেনু, ড্রপডাউনসহ)
- হিরো ব্যানার (মাল্টি-ব্যানার, ২-আপ)
- "Featured Categories" — আইকন সহ হরাইজন্টাল স্ক্রল রো
- "Top Selling Products" — গ্রিড, Add to Cart + Buy Now বাটন
- ক্যাটাগরি-ওয়াইজ প্রোডাক্ট রো (প্রতিটার নিজস্ব হরাইজন্টাল ক্যারোসেল + "See All" লিংক) — একাধিক ক্যাটাগরির জন্য রিপিট হয়
- প্রোমোশনাল ব্যানার স্ট্রিপ
- পার্টনার/ব্র্যান্ড লোগো ক্যারোসেল
- About Us সেকশন + অ্যাপ-প্রোমো ইমেজ
- ফুটার: Information/Quick Links (My Account, My Orders, My Wishlist)/Policies কলাম + নিউজলেটার সাবস্ক্রাইব + সোশ্যাল আইকন + কপিরাইট

### প্রোডাক্ট ডিটেইল পেজ
- Breadcrumb (Home / Shop)
- ইমেজ গ্যালারি (থাম্বনেইল স্ট্রিপ + মেইন ইমেজ)
- নাম, SKU, দাম (strikethrough আসল দাম + ডিসকাউন্ট দাম), quantity stepper
- বাটন: Add to Cart, Order Now (কার্ট বাদ দিয়ে সরাসরি checkout), Call for Order (`tel:`), Order on WhatsApp (`wa.me` click-to-chat), Add to Wishlist
- Share row: Facebook / Messenger / WhatsApp / Copy Link
- "Key Features" — ছোট bullet লিস্ট, দামের নিচে সরাসরি দৃশ্যমান
- Tabs: Description / Reviews
- "You might also like" — related products ক্যারোসেল

### মোবাইল
- Sticky bottom nav: Home / Menu / Cart / Search / Account
- Floating cart বাটন (item count + amount ব্যাজ সহ)
- Hamburger মেনু (top-left), কার্ট আইকন (top-right)

**ডিজাইন সিদ্ধান্ত — Phase 1-এ ফিক্সড টেমপ্লেট, ড্র্যাগ-ড্রপ বিল্ডার না।** ব্লক-বিল্ডার-স্টাইল ফ্লেক্সিবল হোমপেজ বানানো একটা অনেক বড় আলাদা স্কোপ (landing page builder-এর সমান কাজ)। উপরের লেআউট **ফিক্সড থাকবে**, সেলার শুধু কন্টেন্ট কনফিগার করবে (ব্যানার ইমেজ, ফিচারড ক্যাটাগরি, কালার, About টেক্সট, পার্টনার লোগো) — `bsol_history_and_new_context.md §১০`-এর নিজস্ব সতর্কতা অনুযায়ী ("অমীমাংসিত ডিজাইন প্রশ্ন রেখে দেওয়া চলবে না") একটা পথ বেছে নেওয়া হলো। ভবিষ্যতে ফ্লেক্সিবল বিল্ডার চাইলে আলাদা ফিচার হিসেবে বিবেচনা করা যাবে।

---

## ২. Reuse হবে (ফ্রি ভিত্তি)

| প্রয়োজন | যা reuse হবে |
|---|---|
| প্রোডাক্ট/ভ্যারিয়েন্ট/স্টক/ইমেজ | `Product`, `ProductVariant`, `ProductImage` |
| ক্যাটাগরি | `ProductCategory` (`slug`, `is_active`, `sort_order` — ক্যাটাগরি-নেভ বানানোর জন্য যথেষ্ট) |
| প্রতিটা সেলারের নিজস্ব হোস্ট | `custom_domain_context.md` — `{sub}.zyrotechbd.com` লাইভ, wildcard SSL, host resolver |
| শপ পরিচয়/লোগো | `ShopProfile` |
| চেকআউট ফিল্ড কনফিগারেশন | `CheckoutFieldResolver` — landing-page-scoped, storefront-এর জন্য নতুন "shop-default" স্কোপ যোগ হবে (নিচে §৫) |
| পেমেন্ট | `OnlinePaymentService`, `PaymentGatewayFactory`, ওয়ালেট-ক্লেম ফ্লো — সব শপ-ওয়াইড সেটিং হিসেবেই আগে থেকে আছে |
| ফ্রড/OTP | `FraudScoreService`, checkout OTP ফ্লো |
| অর্ডার স্ট্যাটাস/SMS automation | `OrderStatusService`, `SmsAutomationService` |
| কুরিয়ার + ইনভয়েস/ওয়েবিল | `CourierFactory`, `WaybillPdfService` |
| ডিজিটাল প্রোডাক্ট ডেলিভারি | সদ্য বানানো সিস্টেম — একই catalog/cart-এর অংশ হবে, mixed-cart নিয়ম পুনরায় প্রযোজ্য |
| ট্র্যাকিং | Pixel/CAPI infra — নতুন ইভেন্ট টাইপ যোগ হবে, ইঞ্জিন একই |

---

## ৩. গ্যাপ — যা সত্যিই নতুন

- **পাবলিক ক্যাটালগ API** — এখন প্রোডাক্ট এক্সপোজার শুধু dashboard (auth) বা landing page-এ attached single product। "সব প্রোডাক্ট ব্রাউজ করো" এমন এন্ডপয়েন্টই নেই।
- **মাল্টি-প্রোডাক্ট কার্ট** — কোনো `Cart`/`CartItem` মডেল নেই।
- **Storefront থিম/হোমপেজ কনফিগ** — `ShopProfile`-এ থিম কালার/ব্যানার/ফিচারড ক্যাটাগরি কিছুই নেই।
- **প্রোডাক্ট লিস্টিং/সার্চ/ফিল্টার** — নতুন API + UI।
- **রিভিউ/রেটিং** — কোনো মডেল নেই।
- **SEO ইনফ্রা** — sitemap.xml, robots.txt, JSON-LD, per-page meta/OG — এখন landing-page-নির্দিষ্ট, ফুল ক্যাটালগের জন্য নেই।
- **কাস্টমার অ্যাকাউন্ট** — ফুটারে "My Account/My Orders/My Wishlist" আছে, কিন্তু কোনো কাস্টমার-লগইন সিস্টেম bsol-এ নেই (§৯-এ MVP সিদ্ধান্ত)।

---

## ৪. মূল আর্কিটেকচার সিদ্ধান্ত — Root/হোমপেজ রেজলিউশন

**বর্তমান বাগ (এই ফিচারের মাধ্যমে ফিক্স হবে):** সেলারের সাবডোমেইনের bare root (`seller1.zyrotechbd.com/`)-এ হিট করলে এখন কোনো host-aware রাউটিং হয় না — `proxy.ts` শুধু `/{slug}` (landing page) আর `/dashboard/*` রিরাইট করে, bare `/` করে না। ফলে এখন root-এ hit করলে bsol-এর নিজস্ব মার্কেটিং/লগইন হোমপেজ দেখায় (host নির্বিশেষে সবসময় একই কম্পোনেন্ট রেন্ডার হয়)।

**সিদ্ধান্ত (user confirm করেছেন):**
- Root path (`/`) **ডিফল্টে storefront হোমপেজ** দেখাবে।
- সেলার চাইলে তার একটা প্রকাশিত landing page-কে হোমপেজ হিসেবে সেট করতে পারবে (`homepage_mode: 'storefront' | 'landing_page'` + `homepage_landing_page_id`)।
- **যেটাই হোমপেজ হোক, স্টোরফ্রন্ট সবসময় সরাসরি URL দিয়ে অ্যাক্সেসযোগ্য থাকবে** — কেউ সরাসরি `zareen.zyrotechbd.com/category/it` টাইপ করলে সেই পেজ পাবে, root-এ কী সেট আছে তা নির্বিশেষে। অর্থাৎ storefront "টগল করে বন্ধ করা" যায় না, শুধু root-এর ডিফল্ট গন্তব্য বদলানো যায়।

**Reserved path সংযোজন** (`custom_domain_context.md §4.3`-এর তালিকায়): `category`, `product`, `products`, `cart`, `checkout`, `search`, `shop`, `wishlist`, `account` — এগুলো এখন landing-page slug হিসেবে নেওয়া যাবে না (আগের কোনো landing page ইতিমধ্যে এই slug ব্যবহার করছে কিনা migration-এর আগে চেক করতে হবে, conflict থাকলে সেই সেলারকে জানাতে হবে)।

**Proxy resolution আপডেট** (`src/proxy.ts`): host resolve হওয়ার পর path prefix চেক করে storefront route (`/category/*`, `/product/*`, `/shop`, `/cart`, `/search`) হলে storefront অ্যাপে rewrite, নাহলে বর্তমান লজিক (`/{slug}` → landing page, `/dashboard/*` যেমন আছে)। bare `/`-এর জন্য `homepage_mode` চেক করে হয় storefront হোম, নাহয় ওই landing page-এর slug-এ ইন্টারনাল রিরাইট।

---

## ৫. ডেটা মডেল (নতুন)

### ৫.১ `storefront_settings` (নতুন টেবিল, Pattern B owner-only, `user_id` unique)
```
user_id (unique)
homepage_mode           string default 'storefront'   -- 'storefront' | 'landing_page'
homepage_landing_page_id nullable FK -> landing_pages
theme_primary_color     string(7) nullable  -- hex
banner_images           jsonb  -- [{image_url, link_url, sort_order}]
featured_category_ids   jsonb  -- ordered array of ProductCategory.id
about_text              text nullable
about_image_url         string nullable
partner_logos           jsonb  -- [{image_url, link_url}]
whatsapp_number         string nullable  -- ডিফল্ট ShopProfile.phone, override করা যায়
show_call_button        boolean default true
show_whatsapp_button    boolean default true
is_active                boolean default true  -- ভবিষ্যতে সাময়িকভাবে বন্ধ রাখার সুবিধা (§৬-এর non-goal না, ছোট flag)
```

### ৫.২ `products` টেবিলে নতুন কলাম (migration)
```
show_in_storefront  boolean default true   -- ক্যাম্পেইন-এক্সক্লুসিভ প্রোডাক্ট storefront থেকে লুকানোর সুবিধা
features            jsonb nullable          -- ["100% Pure...", "No chemicals..."] — "Key Features" bullet box
is_featured          boolean default false  -- হোমপেজ "Top Selling"-এ ম্যানুয়াল কিউরেশন (নাহলে actual sales count দিয়ে ফলব্যাক)
```

### ৫.৩ `product_reviews` (নতুন টেবিল)
```
id, product_id, user_id (shop owner, scoping-এর জন্য),
customer_name, customer_phone নালাবল (verified-purchase লুকআপের জন্য),
rating (1-5, tinyint), comment (text),
order_id nullable FK -> orders   -- সেট থাকলে "Verified Purchase" ব্যাজ
is_approved boolean default false  -- মডারেশন গেট, ডিফল্ট লুকানো
created_at, updated_at
```
পাবলিক সাবমিশন এন্ডপয়েন্ট থ্রটল করা থাকবে (`throttle:10,1` স্টাইল), `is_approved=false` দিয়ে তৈরি হয় — সেলার dashboard থেকে approve/reject করে, স্প্যাম ঠেকাতে।

### ৫.৪ Cart — **কোনো নতুন টেবিল না, client-side**
`localStorage`-এ shop-এর নিজস্ব origin-এ (`custom_domain_context.md §2`-এর একই origin-isolation প্রপার্টি reuse — এক সেলারের কার্ট আরেক সেলারের সাবডোমেইনে কখনো দেখা যায় না, কোনো এক্সট্রা কোড ছাড়াই)। কার্ট শুধু checkout সাবমিট হওয়া পর্যন্তই client-এ থাকে; সাবমিট হলে সরাসরি `Order` + `OrderItem` রো হয়ে যায় (ঠিক এখনকার landing-page checkout-এর মতোই, শুধু multi-landing-page-independent)।

---

## ৬. Cart + Checkout ফ্লো

- **Add to Cart** — client state-এ যোগ, cart badge আপডেট, cart drawer/পেজে দেখা যায়।
- **Order Now** (প্রোডাক্ট ডিটেইল থেকে) — cart বাইপাস করে সরাসরি checkout, শুধু এই এক আইটেম (quantity সহ) — session/query state দিয়ে পাঠানো হয়, cart persist হয় না এই ফ্লোতে।
- **Checkout পেজ** (`/checkout`) — cart-এর সব আইটেম বা "buy now" single item দেখায়, `CheckoutFieldResolver`-এর নতুন **shop-default স্কোপ** (landing_page_id-এর বদলে সরাসরি `user_id`-scoped একটা "ডিফল্ট" রো — landing page-এর কনফিগারযোগ্য ফিল্ড সিস্টেমের ঠিক একই ইঞ্জিন, শুধু owner key আলাদা) দিয়ে ফিল্ড রেন্ডার করে।
- **নতুন backend endpoint:** `POST /public/storefront/orders` — `LandingPageOrderService`-এর লজিক জেনারালাইজ করে (fraud check, mixed-cart digital/physical block reuse, OTP, payment channel resolution) কিন্তু `landing_page_id`-এর বদলে host-resolved `user_id` দিয়ে scope করে। **Mixed-cart নিয়ম (`digital_product_context.md`) এখানেও প্রযোজ্য** — এক অর্ডারে ডিজিটাল+ফিজিক্যাল একসাথে না।
- **পেমেন্ট চ্যানেল** — শপ-ওয়াইড ডিফল্ট (landing page-এর per-page override storefront-এ প্রযোজ্য না, কারণ এটা কোনো নির্দিষ্ট landing page না)।

---

## ৭. "Order on WhatsApp" / "Call for Order" — কোনো নতুন ডিপেন্ডেন্সি না

এই দুটো বাটন সাধারণ `tel:`/`wa.me` ডিপ-লিংক (ShopProfile.phone / `storefront_settings.whatsapp_number` দিয়ে prefilled মেসেজ) — **paused WhatsApp Business Cloud API automation ফিচার থেকে সম্পূর্ণ আলাদা** (ওটা 2-way inbox + template automation, Meta App verification-নির্ভর, `whatsapp_context.md`)। এখানে কোনো API কল নেই, কোনো Meta ডিপেন্ডেন্সি নেই — Phase 1 থেকেই কাজ করবে।

---

## ৮. Tracking + SEO

- **Tracking:** এখন Pixel/CAPI শুধু landing-page checkout-এ ফায়ার করে। Storefront পেজে নতুন ইভেন্ট যোগ হবে: `ViewContent` (প্রোডাক্ট ডিটেইল), `AddToCart`, `InitiateCheckout` (checkout পেজ ওপেন), `Purchase` (storefront checkout completion — বিদ্যমান CAPI client-ই reuse, নতুন trigger point)। Pixel `/dashboard/*`-এ কখনো লোড হবে না নিয়ম (`custom_domain_context.md §10`) অপরিবর্তিত থাকে, বাকি সব পাবলিক পেজে লোড হবে।
- **SEO:** প্রতিটা শপ-হোস্টে `/sitemap.xml` (ক্যাটাগরি + প্রোডাক্ট + প্রকাশিত landing page URL সব লিস্ট করে), `/robots.txt`, প্রতিটা প্রোডাক্ট/ক্যাটাগরি পেজে Next.js `generateMetadata` দিয়ে dynamic title/description/OG image (প্রোডাক্ট থাম্বনেইল ফলব্যাক), JSON-LD `Product`/`Organization`/`BreadcrumbList` schema।

---

## ৯. কাস্টমার অ্যাকাউন্ট — MVP সিদ্ধান্ত

রেফারেন্স ডিজাইনে "Login/Register", "My Account", "My Orders", "My Wishlist" আছে — কিন্তু bsol-এ কোনো **কাস্টমার-facing auth সিস্টেম নেই** (শুধু checkout-time ফোন OTP)। ফুল কাস্টমার অ্যাকাউন্ট (persistent login, saved address, order history dashboard) একটা বড় আলাদা সাবসিস্টেম — **Phase 1-এ স্কোপের বাইরে।**

**Phase 1 বিকল্প:**
- **"My Orders" → phone + order-number দিয়ে lookup** (বিদ্যমান `Order.public_token`-ভিত্তিক thank-you/order-status পেজের একটা সহজ front-door — কাস্টমার ফোন+অর্ডার নম্বর দিলে সেই অর্ডারের public token পেজে রিডাইরেক্ট)।
- **Wishlist client-side** (`localStorage`, cart-এর মতোই) — persist করার জন্য অ্যাকাউন্ট লাগবে না।
- **"Login/Register" বাটন Phase 1-এ hide/defer** — অথবা শুধু ভবিষ্যতের জন্য UI placeholder, ফাংশনাল না। এটা একটা open question (§১১)।

---

## ১০. Staff/Team

`StaffPermission::MODULE_KEYS`-এ নতুন `'storefront'` এন্ট্রি — থিম/হোমপেজ কনফিগারেশন Pattern B (owner-only, `ShopProfile`-এর মতোই ব্র্যান্ডিং-জাতীয়), রিভিউ moderation Pattern A (team-shared, প্রোডাক্ট module-এর মতো)।

---

## ১১. Non-goals (Phase 1) ও Open Questions

**Non-goals:**
- ফুল কাস্টমার অ্যাকাউন্ট সিস্টেম (§৯)
- ড্র্যাগ-ড্রপ হোমপেজ বিল্ডার (§১-এর ডিজাইন সিদ্ধান্ত — ফিক্সড টেমপ্লেট)
- কুপন/ডিসকাউন্ট কোড (নতুন কিছুই নেই এখন — future candidate)
- মাল্টি-ভেন্ডর মার্কেটপ্লেস কনসেপ্ট (প্রযোজ্যই না — প্রতি শপ একজন সেলারের)
- রিভিউ-এ ছবি/ভিডিও আপলোড (টেক্সট+রেটিং যথেষ্ট Phase 1-এ)

**User confirm করা লাগবে:**
1. "Login/Register" বাটন Phase 1-এ hide করা হবে, নাকি placeholder হিসেবে থাকবে ("coming soon")?
2. `is_featured` ম্যানুয়াল কিউরেশন যথেষ্ট, নাকি actual sales-count-ভিত্তিক "Top Selling" (auto) দরকার প্রথম থেকেই?
3. রিভিউ সাবমিট করতে কি অর্ডার-verification বাধ্যতামূলক (শুধু যারা কিনেছে), নাকি যে কেউ লিখতে পারবে (moderation-ই একমাত্র গেট)?

---

## ১২. ফেজ প্ল্যান (S0–S9)

| ফেজ | পরিধি | নির্ভরতা |
|---|---|---|
| **S0** | Root/হোমপেজ রেজলিউশন — `storefront_settings` টেবিল (`homepage_mode`), reserved path সংযোজন (§৪), `proxy.ts` আপডেট | — |
| **S1** | Backend পাবলিক ক্যাটালগ API — categories list, products list (pagination/filter/সার্চ/sort), product detail; `show_in_storefront` কলাম; leak-prevention (`makeHidden` — digital-product ফিচারে যেমন raw file/URL পাবলিক leak ধরা পড়েছিল, একই সতর্কতা এখানে নতুন করে apply করতে হবে) | S0 |
| **S2** | Product model এক্সটেনশন — `features` (jsonb bullets), `is_featured` — migration + dashboard ফর্মে ফিল্ড | — |
| **S3** | Cart + Checkout ব্যাকএন্ড — `StorefrontOrderService` (LandingPageOrderService জেনারালাইজড), `POST /public/storefront/orders`, shop-default `CheckoutFieldResolver` স্কোপ, mixed-cart নিয়ম reuse | S1 |
| **S4** | Frontend cart state — localStorage cart, drawer/পেজ, floating cart বাটন + badge | S1 |
| **S5** | Frontend হোমপেজ + সেলার-সাইড থিম কনফিগারেশন UI (ব্যানার/ফিচারড ক্যাটাগরি/কালার/About/পার্টনার লোগো আপলোড, homepage_mode/landing-page picker) | S0, S1 |
| **S6** | Frontend ক্যাটাগরি লিস্টিং, প্রোডাক্ট ডিটেইল (গ্যালারি/৪-বাটন অ্যাকশন/key features/tabs/related), সার্চ পেজ, "My Orders" lookup | S1, S3, S4 |
| **S7** | রিভিউ — ব্যাকএন্ড (মডেল+মডারেশন এন্ডপয়েন্ট) + ফ্রন্টএন্ড (সাবমিশন ফর্ম, ডিসপ্লে, সেলার moderation পেজ) | S6 |
| **S8** | SEO — sitemap.xml/robots.txt per host, generateMetadata, JSON-LD | S6 |
| **S9** | Tracking ইভেন্ট এক্সটেনশন (ViewContent/AddToCart/InitiateCheckout/Purchase), মোবাইল-ফার্স্ট পলিশ + responsive QA, Staff/Team permission wiring, ফুল টেস্ট স্যুট, ডক sync, রোলআউট | S1-S8 |

**প্রতি ফেজের চেকলিস্ট:** isolated Postgres schema-তে টেস্ট, `php artisan migrate --force` (প্রোডাকশন লাইভ, migration লেখার পরপরই), `deploy-safe.sh` ফ্রন্টএন্ড পরিবর্তনে, staff-role তিন-কেস verification (`CONTEXT.md §৩১`)।

---

## ১৩. ঝুঁকি/সতর্কতা

- **Public API leak সতর্কতা reuse** — digital-product ফিচারে `Product.digital_file_path`/`digital_external_url` পাবলিক landing page JSON-এ leak হয়েছিল কারণ `Product` মডেলে `$hidden` ছিল না। storefront-এর পাবলিক ক্যাটালগ endpoint বানানোর সময় একই ক্লাস-এর ভুল যেন না হয় — কোন ফিল্ড পাবলিক-safe তার একটা explicit allowlist/`makeHidden()` স্কোপড সিরিয়ালাইজেশন থেকেই শুরু করতে হবে, model-wide `$hidden` না (সেলারের নিজের dashboard-এ ফুল অ্যাক্সেস লাগবে)।
- **Reserved-slug কনফ্লিক্ট** — S0-এ migration চালানোর আগে বিদ্যমান landing page-গুলোর slug-এ `category`/`product`/`cart`/ইত্যাদি সংঘর্ষ আছে কিনা চেক করা বাধ্যতামূলক।
- **CheckoutFieldResolver জেনারালাইজেশন** — landing_page_id থেকে user_id-scoped "ডিফল্ট" রো-তে সরানোর সময় বিদ্যমান landing page checkout ফ্লো যেন না ভাঙে, রিগ্রেশন টেস্ট লাগবে।
