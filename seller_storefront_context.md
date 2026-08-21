# BSOL — সেলার স্টোরফ্রন্ট (ফুল ইকমার্স শপ) — প্ল্যান

**অবস্থা:** প্ল্যান সম্পন্ন। **S0, S1, S4, S6 — চারটাই implement + deploy সম্পন্ন ও লাইভ (২০২৬-০৮-২১)** — visually ভেরিফাই করা হয়েছে `zareen.zyrotechbd.com`-এ। নিচে §১৪-১৬ দেখো। বাকি S2 (dashboard ফিল্ড এডিটর), S3 (checkout backend — কার্ট পেজে এখনো "শীঘ্রই আসছে"), S5 (ফুল হোমপেজ থিম), S7-S9 (রিভিউ/SEO/ট্র্যাকিং)।

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

### দ্বিতীয় রেফারেন্স — স্পেক-হেভি/ইলেকট্রনিক্স-স্টাইল প্রোডাক্ট ডিটেইল পেজ (Sumash Tech-স্টাইল স্ক্রিনশট, ২০২৬-০৮-২১)

Ghorer Bazar রেফারেন্স (FMCG/গ্রোসারি-স্টাইল) তুলনায় অনেক বেশি structured — এটাকে Phase 1-এর **বেসলাইন প্রোডাক্ট-ডিটেইল টেমপ্লেট** ধরা হচ্ছে, কারণ এর মধ্যে সরল ভার্সন (Ghorer Bazar-এর মতো) already fit করে যায়, উল্টোটা না।

- **Breadcrumb** গভীর — Home / Phone / Smartphone / Vivo / Vivo Y05e (Official) (ক্যাটাগরি + ব্র্যান্ড দুটোই path-এ)
- দাম-এর পাশে **secondary action row** — Compare, [Brand] Store, View EMI Options
- দামের নিচে একটা **quick-spec bullet বক্স** (Display/Processor/Camera/Battery/Others — সংক্ষিপ্ত, "Key Features"-এর মতোই কিন্তু structured label:value ফরম্যাটে)
- **Variant selector chips/swatches** — Storage (button chip), Color (color swatch) — বিদ্যমান `ProductVariant` অ্যাট্রিবিউট সিস্টেম দিয়েই ডেটা আছে, এটা শুধু storefront-এ রেন্ডারিং স্টাইলের প্রশ্ন
- **অ্যাকশন বাটন সারি** — Add to Wishlist, Add To Cart, Buy Now, **+ তিনটা কন্টাক্ট-চ্যানেল পিল: Via Messenger, Via Hotline Call, Via WhatsApp**
- **৬টা ট্যাব** — Specification, Description, Rating, Warranty, Delivery, Share (§১-এর আগের ২-ট্যাব ডিজাইনের বদলে এটাই বেসলাইন)
  - **Specification ট্যাব** — গ্রুপ করা, collapsible sections (Physical Specification/Network/Display/Processor/Memory/Main Camera/Selfie Camera/OS/Connectivity/Features/Battery/Test), প্রতিটার ভেতরে label:value রো
  - **Warranty/Delivery ট্যাব** — শপ-লেভেল পলিসি টেক্সট (একবার কনফিগার, সব প্রোডাক্টে দেখায়), প্রয়োজনে per-product override
- **Right-rail সাইডবার** (দুই-কলাম লেআউট) — Warranty card, Rating summary card (avg + count + সংক্ষিপ্ত টেক্সট), Delivery estimate card, Social Share আইকন, Related Products লিস্ট (ছোট কার্ড: ইমেজ/নাম/দাম+save%/স্টক স্ট্যাটাস)
- **পেজের নিচে SEO long-form ব্লক** — "[Product Name] Price in Bangladesh" প্যারাগ্রাফ + একই ব্র্যান্ড/ক্যাটাগরির বাকি প্রোডাক্টের একটা price-comparison টেবিল (internal-linking SEO প্যাটার্ন, খুব কার্যকর) — S8-এ এটা যোগ হবে (নিচে §৮ আপডেট দেখো)
- **Badges** — "OFFICIAL" ব্যাজ, "SAVE X%" রিবন (discount থেকেই derive করা যায়, নতুন ফিল্ড লাগে না), "EARN N POINTS" রিবন (loyalty — non-goal, §১১)

**Phase 1-এ যা নেওয়া হচ্ছে এখান থেকে:** structured grouped specification (§৫.২-এ নতুন `specifications` ফিল্ড), ৬-ট্যাব লেআউট + শপ-লেভেল warranty/delivery পলিসি, right-rail সাইডবার লেআউট (rating summary/related products/share), Messenger কন্টাক্ট-চ্যানেল বাটন, SEO price-comparison ব্লক।
**যা non-goal থাকছে:** Compare (side-by-side), EMI/financing ক্যালকুলেটর, loyalty points প্রোগ্রাম, "OFFICIAL" trust-badge সিস্টেম — §১১-এ যোগ হলো।

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
show_messenger_button   boolean default true  -- FacebookPageConnection কানেক্টেড থাকলেই effective, নাহলে auto-hide
warranty_policy_text    text nullable  -- Warranty ট্যাবের শপ-লেভেল ডিফল্ট কন্টেন্ট
delivery_policy_text    text nullable  -- Delivery ট্যাবের শপ-লেভেল ডিফল্ট কন্টেন্ট
is_active                boolean default true  -- ভবিষ্যতে সাময়িকভাবে বন্ধ রাখার সুবিধা (§৬-এর non-goal না, ছোট flag)
```

### ৫.২ `products` টেবিলে নতুন কলাম (migration)
```
show_in_storefront  boolean default true   -- ক্যাম্পেইন-এক্সক্লুসিভ প্রোডাক্ট storefront থেকে লুকানোর সুবিধা
features            jsonb nullable          -- ["100% Pure...", "No chemicals..."] — দামের নিচে quick-spec/key-features bullet বক্স
specifications       jsonb nullable          -- [{group: "Display", items: [{label: "Size", value: "6.74 inches"}, ...]}, ...]
                                              -- Specification ট্যাবের গ্রুপ করা spec টেবিল (§১-এর দ্বিতীয় রেফারেন্স)
seo_content           text nullable           -- "[Product] Price in Bangladesh"-স্টাইল SEO প্যারাগ্রাফ, সেলার-লিখিত/ঐচ্ছিক (S8)
warranty_override      text nullable           -- খালি থাকলে storefront_settings.warranty_policy_text দেখাবে
delivery_override      text nullable           -- খালি থাকলে storefront_settings.delivery_policy_text দেখাবে
is_featured          boolean default false  -- হোমপেজ "Top Selling"-এ ম্যানুয়াল কিউরেশন (user সিদ্ধান্ত: Phase 1-এ auto sales-count না, শুধু is_featured)
```
`features` বনাম `specifications`-এর পার্থক্য: `features` হলো ছোট, বিক্রয়-উদ্দেশ্যমূলক bullet ("100% Pure Maghi Mustard Oil") যা দামের ঠিক নিচে দেখা যায়; `specifications` হলো টেকনিক্যাল/স্ট্রাকচার্ড ডেটা যা Specification ট্যাবে গ্রুপ করে দেখানো হয় — দুটোই ঐচ্ছিক, ফিজিকাল/ডিজিটাল দুই ধরনের প্রোডাক্টেই প্রযোজ্য (ইলেকট্রনিক্সে `specifications` বেশি ব্যবহৃত হবে, গ্রোসারি/ফ্যাশনে হয়তো খালিই থাকবে)।

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

## ৭. "Order on WhatsApp" / "Call for Order" / "Via Messenger" — কোনো নতুন ডিপেন্ডেন্সি না

তিনটাই সাধারণ deep-link, কোনো API কল না:
- **Call:** `tel:` লিংক, `ShopProfile.phone`
- **WhatsApp:** `wa.me` লিংক, prefilled মেসেজ (`storefront_settings.whatsapp_number` — ডিফল্ট `ShopProfile.phone`) — **paused WhatsApp Business Cloud API automation ফিচার থেকে সম্পূর্ণ আলাদা** (ওটা 2-way inbox + template automation, Meta App verification-নির্ভর, `whatsapp_context.md`)। এখানে কোনো Meta ডিপেন্ডেন্সি নেই।
- **Messenger:** `m.me/{page_id}` deep-link — শুধু সেলারের একটা `FacebookPageConnection` কানেক্টেড থাকলেই বাটন দেখাবে (§৫.১-এর `show_messenger_button`), না থাকলে auto-hide করে দিতে হবে — বিদ্যমান Facebook Page/Messenger integration-এর ডেটা reuse, নতুন কোনো Graph API কল লাগে না (এটা শুধু একটা লিংক, লিড-ক্যাপচার ইনবক্সের সাথে সম্পর্কহীন)।

Phase 1 থেকেই কাজ করবে, কোনো External approval নির্ভরতা নেই।

---

## ৮. Tracking + SEO

- **Tracking:** এখন Pixel/CAPI শুধু landing-page checkout-এ ফায়ার করে। Storefront পেজে নতুন ইভেন্ট যোগ হবে: `ViewContent` (প্রোডাক্ট ডিটেইল), `AddToCart`, `InitiateCheckout` (checkout পেজ ওপেন), `Purchase` (storefront checkout completion — বিদ্যমান CAPI client-ই reuse, নতুন trigger point)। Pixel `/dashboard/*`-এ কখনো লোড হবে না নিয়ম (`custom_domain_context.md §10`) অপরিবর্তিত থাকে, বাকি সব পাবলিক পেজে লোড হবে।
- **SEO:** প্রতিটা শপ-হোস্টে `/sitemap.xml` (ক্যাটাগরি + প্রোডাক্ট + প্রকাশিত landing page URL সব লিস্ট করে), `/robots.txt`, প্রতিটা প্রোডাক্ট/ক্যাটাগরি পেজে Next.js `generateMetadata` দিয়ে dynamic title/description/OG image (প্রোডাক্ট থাম্বনেইল ফলব্যাক), JSON-LD `Product`/`Organization`/`BreadcrumbList` schema।
- **প্রোডাক্ট পেজের নিচে price-comparison ব্লক** (§১-এর দ্বিতীয় রেফারেন্স) — `products.seo_content` (সেলার-লিখিত, ঐচ্ছিক) + একই ক্যাটাগরি/ব্র্যান্ডের বাকি প্রোডাক্টের একটা auto-generated টেবিল (নাম + দাম, প্রতিটা নিজের প্রোডাক্ট পেজে লিংক করা) — internal-linking SEO প্যাটার্ন, কোনো নতুন ফিল্ড ছাড়াই বিদ্যমান ক্যাটাগরি/দাম ডেটা দিয়ে জেনারেট হয়।

---

## ৯. কাস্টমার অ্যাকাউন্ট — MVP সিদ্ধান্ত

রেফারেন্স ডিজাইনে "Login/Register", "My Account", "My Orders", "My Wishlist" আছে — কিন্তু bsol-এ কোনো **কাস্টমার-facing auth সিস্টেম নেই** (শুধু checkout-time ফোন OTP)। ফুল কাস্টমার অ্যাকাউন্ট (persistent login, saved address, order history dashboard) একটা বড় আলাদা সাবসিস্টেম — **Phase 1-এ স্কোপের বাইরে।**

**Phase 1 বিকল্প (user confirm করেছেন):**
- **"My Orders" → phone + order-number দিয়ে lookup** (বিদ্যমান `Order.public_token`-ভিত্তিক thank-you/order-status পেজের একটা সহজ front-door — কাস্টমার ফোন+অর্ডার নম্বর দিলে সেই অর্ডারের public token পেজে রিডাইরেক্ট)।
- **Wishlist client-side** (`localStorage`, cart-এর মতোই) — persist করার জন্য অ্যাকাউন্ট লাগবে না।
- **"Login/Register" বাটন Phase 1-এ UI placeholder** — ফাংশনাল না, ক্লিক করলে "শীঘ্রই আসছে"-জাতীয় বার্তা। কাস্টমার রেজিস্ট্রেশন/লগইন ভবিষ্যতে একটা পূর্ণাঙ্গ ফিচার হিসেবে যোগ হবে (এই ডকের স্কোপে না) — তাই এখনই এটা মাথায় রেখে ডিজাইন করা ভালো: cart/wishlist-এর localStorage key structure এমন রাখা উচিত যাতে ভবিষ্যতে অ্যাকাউন্ট চালু হলে "গেস্ট কার্ট → লগইন-করা কাস্টমারের কার্টে মার্জ" করা সহজ হয় (এখনই বানাতে হবে না, শুধু নামকরণ/স্ট্রাকচারে অন্ধ গলি এড়ানো)।

---

## ১০. Staff/Team

`StaffPermission::MODULE_KEYS`-এ নতুন `'storefront'` এন্ট্রি — থিম/হোমপেজ কনফিগারেশন Pattern B (owner-only, `ShopProfile`-এর মতোই ব্র্যান্ডিং-জাতীয়), রিভিউ moderation Pattern A (team-shared, প্রোডাক্ট module-এর মতো)।

---

## ১১. Non-goals (Phase 1) — সব resolved, কোনো open question বাকি নেই

**সিদ্ধান্ত (user confirm, ২০২৬-০৮-২১):**
1. "Login/Register" বাটন Phase 1-এ **placeholder** (non-functional, "coming soon") — কাস্টমার অ্যাকাউন্ট ভবিষ্যতে আসবে (§৯)।
2. **`is_featured` ম্যানুয়াল কিউরেশন** — Phase 1-এ auto sales-count-ভিত্তিক "Top Selling" লাগবে না।
3. **রিভিউ সাবমিশনে অর্ডার-verification বাধ্যতামূলক না** — যে কেউ লিখতে পারবে, `is_approved=false` ডিফল্ট (§৫.৩) + সেলার moderation-ই একমাত্র গেট; `order_id` ম্যাচ পাওয়া গেলে ঐচ্ছিক "Verified Purchase" ব্যাজ দেখানো হবে, বাধ্যতামূলক শর্ত না।

**Non-goals (Phase 1):**
- ফুল কাস্টমার অ্যাকাউন্ট সিস্টেম (§৯)
- ড্র্যাগ-ড্রপ হোমপেজ বিল্ডার (§১-এর ডিজাইন সিদ্ধান্ত — ফিক্সড টেমপ্লেট)
- কুপন/ডিসকাউন্ট কোড (future candidate)
- মাল্টি-ভেন্ডর মার্কেটপ্লেস কনসেপ্ট (প্রযোজ্যই না — প্রতি শপ একজন সেলারের)
- রিভিউ-এ ছবি/ভিডিও আপলোড (টেক্সট+রেটিং যথেষ্ট Phase 1-এ)
- **Compare (side-by-side প্রোডাক্ট তুলনা)** — দ্বিতীয় রেফারেন্স থেকে, real UI/state স্কোপ, future candidate
- **EMI/financing ক্যালকুলেটর** — দ্বিতীয় রেফারেন্স থেকে, financial-partner ইন্টিগ্রেশন লাগবে, future candidate
- **Loyalty/reward points প্রোগ্রাম** ("Earn N points") — দ্বিতীয় রেফারেন্স থেকে, আলাদা বড় ফিচার, future candidate
- **"OFFICIAL" trust-badge সিস্টেম** — সাধারণ per-product boolean দিয়ে ট্রিভিয়ালি করা যায় কিন্তু এখন স্কিপ (কোনো ভেরিফিকেশন-ভিত্তিক অর্থ ছাড়া badge বিভ্রান্তিকর), future candidate

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
| **S6** | Frontend ক্যাটাগরি লিস্টিং, প্রোডাক্ট ডিটেইল (গ্যালারি, ৫-বাটন অ্যাকশন রো + Messenger/Call/WhatsApp পিল, quick-spec bullet বক্স, ৬-ট্যাব লেআউট + গ্রুপড Specification টেবিল, right-rail সাইডবার — warranty/rating/delivery/share/related), সার্চ পেজ, "My Orders" lookup | S1, S3, S4 |
| **S7** | রিভিউ — ব্যাকএন্ড (মডেল+মডারেশন এন্ডপয়েন্ট) + ফ্রন্টএন্ড (সাবমিশন ফর্ম, ডিসপ্লে, সেলার moderation পেজ) | S6 |
| **S8** | SEO — sitemap.xml/robots.txt per host, generateMetadata, JSON-LD | S6 |
| **S9** | Tracking ইভেন্ট এক্সটেনশন (ViewContent/AddToCart/InitiateCheckout/Purchase), মোবাইল-ফার্স্ট পলিশ + responsive QA, Staff/Team permission wiring, ফুল টেস্ট স্যুট, ডক sync, রোলআউট | S1-S8 |

**প্রতি ফেজের চেকলিস্ট:** isolated Postgres schema-তে টেস্ট, `php artisan migrate --force` (প্রোডাকশন লাইভ, migration লেখার পরপরই), `deploy-safe.sh` ফ্রন্টএন্ড পরিবর্তনে, staff-role তিন-কেস verification (`CONTEXT.md §৩১`)।

---

## ১৩. ঝুঁকি/সতর্কতা

- **Public API leak সতর্কতা reuse** — digital-product ফিচারে `Product.digital_file_path`/`digital_external_url` পাবলিক landing page JSON-এ leak হয়েছিল কারণ `Product` মডেলে `$hidden` ছিল না। storefront-এর পাবলিক ক্যাটালগ endpoint বানানোর সময় একই ক্লাস-এর ভুল যেন না হয় — কোন ফিল্ড পাবলিক-safe তার একটা explicit allowlist/`makeHidden()` স্কোপড সিরিয়ালাইজেশন থেকেই শুরু করতে হবে, model-wide `$hidden` না (সেলারের নিজের dashboard-এ ফুল অ্যাক্সেস লাগবে)।
- **Reserved-slug কনফ্লিক্ট** — S0-এ migration চালানোর আগে বিদ্যমান landing page-গুলোর slug-এ `category`/`product`/`cart`/ইত্যাদি সংঘর্ষ আছে কিনা চেক করা বাধ্যতামূলক।
- **CheckoutFieldResolver জেনারালাইজেশন** — landing_page_id থেকে user_id-scoped "ডিফল্ট" রো-তে সরানোর সময় বিদ্যমান landing page checkout ফ্লো যেন না ভাঙে, রিগ্রেশন টেস্ট লাগবে।

---

## ১৪. S0 — as-built (২০২৬-০৮-২১, ✅ লাইভ)

**গুরুত্বপূর্ণ সংশোধন যা কোড পড়ে ধরা পড়েছে:** §৪-এ ধরে নেওয়া হয়েছিল root `/`-এ redirect হওয়ার কারণ "কোনো host-aware রাউটিং নেই"। বাস্তবে `proxy.ts`-এ এটা **ইচ্ছাকৃত নিরাপত্তা সিদ্ধান্ত** ছিল (`domain_security_audit.md M-3`) — platform hostের root পেজে লগইন ফর্ম থাকে, আর সেলারের সাবডোমেইনে সেলারের নিজের landing-page HTML-ও চলে (কম বিশ্বস্ত origin), তাই লগইন ফর্ম ভুলেও সেখানে রেন্ডার হওয়া ঠেকাতে root hit করলেই platform host-এ পাঠানো হতো। এটা ভাঙা হয়নি — বদলে `/store` (storefront home) **কখনোই কোনো লগইন ফর্ম রাখে না** (Login/Register বাটন এমনিতেই placeholder-only, §১১) বলে root-কে নিরাপদে সেলারের নিজের origin-এ রেন্ডার করা গেছে, নিরাপত্তা নিয়মটা অক্ষত রেখেই।

**যা করা হয়েছে:**
- `storefront_settings` টেবিল (§৫.১-এর পূর্ণ কলাম সেট, migration `2026_08_21_100000`) — production-এ migrate করা হয়েছে
- `StorefrontSetting` মডেল, `StorefrontSettingController` (owner-only GET/PUT `/storefront-settings`)
- `/public/shop-by-subdomain/{label}` এখন `homepage_mode`/`homepage_landing_slug`-ও ফেরত দেয় (proxy.ts-এর একই round-trip-এ, অতিরিক্ত কল ছাড়াই)
- **Reserved words** `APP_PATHS`-এ যোগ হয়েছে: `category`, `product`, `products`, `cart`, `checkout`, `search`, `wishlist`, `account`, `shop` (migration-এর আগে production-এ conflict চেক করা হয়েছে — কোনো বিদ্যমান landing page slug এই শব্দগুলো ব্যবহার করছিল না)
- `STOREFRONT_PATHS` (category/product/cart/checkout/search) — `/lp/{slug}`-এর মতোই `/store/*`-এ internal rewrite, direct `/store` hit ৪০৪ (`/lp`-এর মতো, duplicate-content এড়াতে)
- Root `/` এখন: `homepage_mode = 'landing_page'` + valid published page হলে সেই পেজে rewrite, নাহলে (ডিফল্ট) `/store`-এ rewrite
- `/store/page.tsx` — **S0 placeholder** (shop নাম/লোগো + "শীঘ্রই আসছে"), পূর্ণাঙ্গ হোমপেজ S5/S6-এ
- Dashboard → Settings → Storefront (নতুন পেজ) — homepage_mode picker (storefront vs আমার একটা প্রকাশিত landing page বেছে নেওয়া) — এখনই কার্যকর একটা বাস্তব সুবিধা, বাকি থিম UI S5-এ

**যাচাই:** isolated schema migrate + full test suite (৩টা known baseline failure ছাড়া ৪৪৫ pass, নতুন কোনো ফেইলিওর না), production migrate, `deploy-safe.sh`, এবং লাইভ smoke test (`zareen.zyrotechbd.com/` এখন storefront placeholder দেখায় "Zareen Natural Foods — অনলাইন শপ শীঘ্রই আসছে", আগের মতো platform লগইনে redirect করে না; direct `/store` ও `/category/test` ঠিকমতো ৪০৪)।

---

## ১৫. S1 — as-built (২০২৬-০৮-২১, ✅ লাইভ)

S1 ও S2-এর প্রোডাক্ট-কলাম migration একসাথে করা হয়েছে (একই টেবিল, একটাই migration পাস বেশি efficient) — `products` টেবিলে `slug`, `show_in_storefront`, `features`, `specifications`, `seo_content`, `warranty_override`, `delivery_override`, `is_featured` যোগ হয়েছে। `slug` নতুন — `/product/{slug}`-এর জন্য দরকার, per-shop unique DB constraint (landing_pages-এর মতোই), প্রোডাকশনের বিদ্যমান ১৩টা প্রোডাক্টে migration নিজেই backfill করেছে (নাম থেকে derive, কনফ্লিক্টে counter suffix)। ProductController-এ creation-এ auto-generate হয়, পরে name বদলালেও slug অপরিবর্তিত থাকে (public লিংক স্থিতিশীল রাখতে)।

**নতুন পাবলিক এন্ডপয়েন্ট** (`StorefrontCatalogController`, host-resolved via `LandingPageResolver`, throttle 60/min):
- `GET /public/storefront/home` — শপ পরিচয় + storefront_settings-এর পাবলিক-সেফ অংশ + featured categories/products, একটা কলে
- `GET /public/storefront/categories` — active categories, product count সহ
- `GET /public/storefront/products` — pagination + category/সার্চ ফিল্টার + sort (newest/price_asc/price_desc/name_asc)
- `GET /public/storefront/products/{slug}` — পূর্ণ ডিটেইল (features/specifications/warranty-delivery-text resolved from override-or-shop-default/images/variants/rating placeholder/related products)

**দুটো real bug ধরা পড়েছে ও ফিক্স হয়েছে বিল্ডের সময়:**
1. **`Product.variants` নাম-সংঘর্ষ** — `products` টেবিলে একটা লিগ্যাসি `variants` jsonb কলাম আছে (ProductVariant টেবিল আসার আগেকার), আর `Product::variants()` HasMany রিলেশনের নামও একই। Eloquent-এ attribute access সবসময় eager-loaded relation-এর আগে জেতে, তাই `$product->variants` (property হিসেবে) সবসময় null/raw কলাম ফেরত দেয়, কখনো loaded relation না — `getRelation('variants')` দিয়ে বাইপাস করতে হয়েছে। টেস্ট লেখার সময়ই ধরা পড়েছে (500 error), প্রোডাকশনে যাওয়ার আগেই।
2. **Cost-price leak, তবে এই ফিচারের কোডে না — বিদ্যমান কোডে।** `ProductVariantFormatter::format()` (মার্চেন্ট ড্যাশবোর্ডের জন্য বানানো shared helper) `cost_price` include করে, আর সেটাই **ইতিমধ্যে চালু থাকা পাবলিক এন্ডপয়েন্ট** `LandingPageController::publicResolveVariant()`-এ ব্যবহৃত হচ্ছে — অর্থাৎ landing-page checkout-এর ভ্যারিয়েন্ট-রিজলভ কল দিয়ে যে কেউ এখনই সেলারের cost price দেখতে পারে। এই ফিচারের কাজ করতেই ধরা পড়েছে (নিজের নতুন কোডে `ProductVariantFormatter` reuse না করে explicit allowlist লেখার সময়), কিন্তু bug টা pre-existing, storefront-সম্পর্কহীন — তাই ইনলাইনে ফিক্স না করে `spawn_task` দিয়ে flag করা হয়েছে (`task_7227a254`)।

**লিক-প্রতিরোধ:** পুরো কন্ট্রোলার allowlist-বিল্ট (raw model dump না) — `cost_price`/`user_id`/`source`/`source_ref`/`platform_api_key_id`/`digital_file_path`/`digital_external_url`/`digital_file_mime_type`/`track_stock`/`low_stock_alert` কোনোটাই রেসপন্সে যায় না, রিগ্রেশন টেস্ট আছে (`StorefrontCatalogTest::test_product_detail_never_leaks_internal_fields`)। স্টক সংখ্যা exact দেখানো হয় না, শুধু `in_stock` boolean।

**টেস্ট:** নতুন `StorefrontCatalogTest.php` (৭টা: shop-scoped categories/products, ফিল্টার+সর্ট, leak-regression, warranty/delivery override resolution, unknown-subdomain ৪০৪, home bundle) — সব pass। ফুল স্যুট ৪৫২ pass (৩টা known baseline failure অপরিবর্তিত)।

**লাইভ ভেরিফাই:** `zareen.zyrotechbd.com`-এ categories/products/product-detail/home চারটাই বাস্তব ডেটা দিয়ে সঠিক রেসপন্স দিয়েছে, ডিজিটাল প্রোডাক্টের (`bsol-connect`) কোনো ডেলিভারি-সংক্রান্ত ফিল্ড leak হয়নি, অজানা সাবডোমেইনে ৪০৪।

**বাকি (S2):** dashboard প্রোডাক্ট ফর্মে নতুন ফিল্ড এডিটর (features bullet list, specifications গ্রুপড টেবিল builder, is_featured/show_in_storefront checkbox, seo_content/warranty_override/delivery_override টেক্সট) — এখনো backend-only, সেলার এখনো UI থেকে এগুলো সেট করতে পারবে না (ডিফল্ট ভ্যালু দিয়েই কাজ করে: সব প্রোডাক্ট show_in_storefront=true, is_featured=false)।

---

## ১৬. S4 + S6 — as-built (২০২৬-০৮-২১, ✅ লাইভ)

User-এর অনুরোধে S2/S3/S5 বাদ দিয়ে সরাসরি S4+S6-এ ঝাঁপ দেওয়া হয়েছে ("visually দেখতে চাই")। `/store` layout, category listing, product detail, search/browse-all, cart — সব লাইভ ও ব্রাউজারে ভেরিফাই করা।

**নতুন frontend ফাইল:**
- `lib/storefront-client.ts` — টাইপ + fetch হেল্পার (server-side `fetchHome`/`fetchCategories`/`fetchProductDetail`/`fetchProductsServer` host-aware absolute URL দিয়ে; client-side `fetchProductsClient`/`fetchCategoriesClient` **রিলেটিভ `/api`** দিয়ে — নিচে বাগ দেখো)
- `lib/storefront-cart.tsx` — `CartProvider`/`useCart`, localStorage-based (কোনো ব্যাকএন্ড Cart মডেল নেই, ইচ্ছাকৃতভাবে — §৫.৪), মিক্সড-কার্ট (ফিজিক্যাল+ডিজিটাল) client-side-ই ব্লক করে
- `components/storefront/{product-card,floating-cart-button,contact-buttons,product-detail-view}.tsx`
- `app/store/layout.tsx` — CartProvider + মিনি টপ-বার + ফ্লোটিং কার্ট বাটন, সব `/store/*` পেজে শেয়ার্ড
- `app/store/category/[slug]/page.tsx`, `app/store/product/[slug]/page.tsx`, `app/store/search/page.tsx` (browse-all + ফিল্টার/সর্ট, `useSearchParams()` না — `window.location.search`, established convention মেনে Suspense boundary এড়াতে), `app/store/cart/page.tsx`
- `/store/page.tsx` (হোমপেজ প্লেসহোল্ডার) আপডেট — "সব প্রোডাক্ট দেখুন" লিংক যোগ, S5-এর আগেই একটা ডিসকভারি পাথ

**Backend সংযোজন:** `home()` এন্ডপয়েন্ট এখন contact info-ও ফেরত দেয় (`phone`, `whatsapp_number` override-অথবা-shop-phone ফলব্যাক, `show_*_button` টগল, `messenger_page_id` — `FacebookPageConnection` থেকে, শুধু status='connected' হলে) — প্রোডাক্ট পেজের Call/WhatsApp/Messenger বাটনের জন্য।

**Real bug ধরা পড়েছে ও ফিক্স হয়েছে (deploy-পরবর্তী, ব্রাউজারে টেস্ট করার সময়):** `/search` পেজে client-side fetch হেল্পার `NEXT_PUBLIC_API_BASE_URL` (absolute, `bsol.{apex}` pinned) ব্যবহার করছিল — storefront পেজ থেকে এই কল করলে platform host-এ hit করত, যেটাকে `LandingPageResolver` explicitly "কোনো শপ নেই" ধরে (§18, `custom_domain_context.md §11.4`), ফলে "কোনো প্রোডাক্ট পাওয়া যায়নি" দেখাচ্ছিল যদিও প্রোডাক্ট আছে। সব public landing-page কম্পোনেন্ট প্লেইন রিলেটিভ `/api/...` ব্যবহার করে ঠিক এই কারণেই — সেই কনভেনশন মিস করাই ভুল ছিল। ফিক্স: client-side fetch-এ hardcoded রিলেটিভ `/api`।

**ভেরিফাই:** ব্রাউজারে (Chrome DevTools MCP) সরাসরি `zareen.zyrotechbd.com`-এ — প্রোডাক্ট ডিটেইল পেজ (গ্যালারি, দাম, quantity, ৫-বাটন অ্যাকশন রো + Call/WhatsApp/Messenger তিনটাই দৃশ্যমান কারণ zareen-এর শপে তিনটাই কনফিগার করা, ৬-ট্যাব + collapsible spec, right-rail sidebar রিলেটেড প্রোডাক্ট সহ), Add to Cart → ফ্লোটিং কার্ট বাটনে badge আপডেট, `/cart` পেজে item persist + qty control + "চেকআউট (শীঘ্রই আসছে)" disabled অবস্থা, `/search` পেজে পূর্ণ ক্যাটালগ গ্রিড + ফিল্টার/সর্ট, `/category/it-items`-এ ব্রেডক্রাম্ব + সঠিক স্টক-স্ট্যাটাস ("স্টক নেই" ঠিকমতো disable করেছে) — সব স্ক্রিনশটে কনফার্ম করা।

**`npx tsc --noEmit`** clean, **`deploy-safe.sh`** (পুরো `next build` সহ) দুইবার সফল (প্রথমবার bug-সহ বিল্ড হয়েছিল, fix-এর পর আবার) — কোনো Suspense-boundary/prerender ব্যর্থতা হয়নি।
