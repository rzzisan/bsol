# Facebook/Instagram Ad Creative Images

Last updated: 2026-09-02 (added 86 creatives — 3-4 angles per module for
all 16 remaining single-theme modules — see §"Per-module deep-dive
campaigns"). Same day, earlier: 16 incomplete-order-recovery creatives
(§"Incomplete order recovery campaign"), 18 landing-page-builder-only
creatives (§"Landing-page-builder-only campaign"), 18
digital-product-only-seller creatives (§"Digital-product-only seller
campaign"). Before that: 2026-08-30 added 22 new per-module creatives — see
§"Second batch". Reference doc for the PNGs sitting in `image/Image/`
(untracked, not committed — one-off marketing assets, not app code). Full build
backstory, generator design, and the two layout bugs found while building it
live in `homepage_redesign_context.md` §"Facebook/Instagram ad creative set" —
this file exists just to map the actual filenames on disk (random upload-style
names, no theme in the filename itself) back to what each one actually is,
since nothing else records that mapping.

**189 total creatives now exist** across `./png` (29 from the first batch,
listed in the mapping table below; 22 from the second batch, §"Second
batch"; 18 from the third batch, §"Digital-product-only seller campaign";
18 from the fourth batch, §"Landing-page-builder-only campaign"; 16 from the
fifth batch, §"Incomplete order recovery campaign"; 86 from the sixth
batch, §"Per-module deep-dive campaigns"). The first-batch files that were
actually uploaded to Facebook got renamed to random upload-style names when
copied into `image/Image/` (hence the mapping table); batches two through
six are still sitting under their descriptive `./png` filenames — copy
whichever ones get used into `image/Image/` and add a row here once they're
renamed, same as the first batch was.

**All per-module (non-campaign) creatives also copied into
`image/by-feature/<category>/` (added 2026-08-30, untracked)** — one folder
per feature/pillar, for handing off to whoever runs a specific campaign
without hunting through the flat `./png` output. Folders: `brand-general`
(master + free-signup CTA + trust, all sizes), `courier`,
`fraud-protection`, `payments`, `marketing-automation`, `storefront`,
`landing-page`, `hosting`, `tracking-pixel-capi` (problem/solution/why-us/
pricing, 4 sub-themes together since they're one campaign sequence),
`accounting`, `collection-history`, `digital-products` (the single
general-purpose theme — not the campaign below), `staff-team`,
`invoice-pdf`, `bulk-import`, `onboarding`, `ai-support`, `woocommerce`,
`analytics`, `security`, `fb-page-assets`.

**16 of those module folders now also hold angle subfolders (added
2026-09-02)** — each module's original file(s) sit directly in the module
folder as before (the generic/broad angle); 3-4 additional deep-dive angles
each sit in their own `<module>/<angle>/` subfolder. See §"Per-module
deep-dive campaigns" for the full folder → angle mapping.

**Three audience/use-case-specific campaigns each have their own sibling
folder** — kept separate from the folder above since each targets a
distinct audience or single feature in depth, not one more feature pillar:
- `image/by-feature/digital-only/<angle>/` (added 2026-09-02) — sellers
  using BSOL purely for digital products. See §"Digital-product-only seller
  campaign".
- `image/by-feature/landing-page-campaign/<angle>/` (added 2026-09-02) —
  sellers who run (or want to run) FB/IG ads and need a single-product
  campaign page, not the full storefront. See §"Landing-page-builder-only
  campaign".
- `image/by-feature/incomplete-order-recovery/<angle>/` (added
  2026-09-02) — deep dive on just the abandoned-checkout-recovery feature
  (one angle of it already exists as `lp_abandoned_cart` inside the landing
  page campaign above; this is the same feature covered from 8 different
  angles). See §"Incomplete order recovery campaign".

All of these are plain copies (not symlinks) — regenerating via
`gen_ads.py`/`rasterize.js` only refreshes `./png`, so re-copy into
`image/by-feature/` after any regen that changes copy/layout.

## Where they came from

Built by `frontend/scripts/ad-creatives/gen_ads.py` + `rasterize.js` (SVG →
PNG via `sharp`, no image-gen tool or headless browser used — see that
script's own `README.md` for how to regenerate). Copy is grounded in what's
actually shipped (payment gateway/courier names pulled from
`PaymentGatewayFactory`/`CourierFactory`, not invented). `./svg` and `./png`
under that directory are gitignored build output — rerun the two scripts to
regenerate rather than expecting them to still be there.

## Filename → creative mapping

| File (`image/Image/`) | Size | Platform placement | Theme/copy focus |
|---|---|---|---|
| `image-1787675474163.png` | 1200×630 | OG/link-preview banner | Master — same image as `frontend/public/og-banner.png` (byte-identical), homepage hero repurposed as a share-link/ad banner |
| `image-1787676742412.png` | 1200×630 | FB feed link/image ad | Courier — "সব কুরিয়ার, সব অর্ডার এক জায়গায়" (Pathao/Steadfast/RedX/Carrybee/Paperfly) |
| `image-1787676758014.png` | 1200×630 | FB feed link/image ad | Fraud protection — "ফেইক অর্ডারে আর টাকা ও সময় নষ্ট না" |
| `image-1787676775242.png` | 1200×630 | FB feed link/image ad | Payments — "যেভাবেই কাস্টমার পে করুক" (7 gateways: SSLCommerz, bKash, Nagad, AamarPay, ZiniPay, ShurjoPay, EPS) |
| `image-1787676784319.png` | 1200×630 | FB feed link/image ad | Marketing/CRM automation — "একটা মেসেজও যেন মিস না হয়" (Pixel+CAPI, Messenger, WhatsApp, SMS) |
| `image-1787676794854.png` | 1080×1080 | FB/IG feed square | Master, dark style |
| `image-1787676803318.png` | 1080×1080 | FB/IG feed square | Master, light style (visual variety pass) |
| `image-1787676813095.png` | 1080×1080 | FB/IG feed square | Free-signup CTA — "আজই ফ্রি অ্যাকাউন্ট খুলুন, বিক্রি শুরু করুন" |
| `image-1787676820940.png` | 1080×1350 | IG feed portrait | Master |
| `image-1787676827632.png` | 1080×1350 | IG feed portrait | Payments + courier combined |
| `image-1787676900337.png` | 1080×1920 | FB/IG Stories & Reels | Master |
| `image-1787676910327.png` | 1080×1920 | FB/IG Stories & Reels | Free-signup CTA |
| `image-1787676930801.png` | 400×400 | Compact/small placements | Master, thumbnail layout |
| `landscape-storefront-dark.png` | 1200×630 | FB feed link/image ad | Storefront — "নিজের নামে ফুল ইকমার্স শপ, নিজের সাবডোমেইনে, মিনিটেই" (no-code shop, ready theme/catalog/cart) |
| `landscape-landingpage-dark.png` | 1200×630 | FB feed link/image ad | Landing page builder — "একটা প্রোডাক্টের জন্য হাই-কনভার্টিং ল্যান্ডিং পেজ" (drag-drop builder, OTP checkout, own subdomain) |
| `landscape-hosting-dark.png` | 1200×630 | FB feed link/image ad | No hosting needed — "হোস্টিং, সার্ভার, SSL — সব আমরাই ম্যানেজ করি" (free subdomain, SSL, uptime, 5-min live) |
| `square-storefront-dark.png` | 1080×1080 | FB/IG feed square | Storefront, same copy as the landscape variant |
| `square-landingpage-dark.png` | 1080×1080 | FB/IG feed square | Landing page builder, same copy as the landscape variant |
| `square-hosting-dark.png` | 1080×1080 | FB/IG feed square | No hosting needed, same copy as the landscape variant |
| `landscape-tracking-problem-dark.png` | 1200×630 | FB feed link/image ad | Tracking problem — "iOS ১৪+ আপডেটে অনেক অর্ডার Pixel-এ ধরা পড়ছে না" (signal loss, ad blockers, Safari ITP → wrong ad optimization) |
| `landscape-tracking-solution-dark.png` | 1200×630 | FB feed link/image ad | Tracking solution — "ব্রাউজার ও সার্ভার — দুই দিক থেকেই ইভেন্ট পাঠান" (Pixel + server-side CAPI, event dedup, real-time log, 1-click setup) |
| `landscape-tracking-whyus-dark.png` | 1200×630 | FB feed link/image ad | Why us — "ট্র্যাকিং, স্টোর, কুরিয়ার, পেমেন্ট — সব এক প্ল্যাটফর্মে" (no developer needed, live event-quality monitor, 30,000+ events/day) |
| `landscape-tracking-pricing-dark.png` | 1200×630 | FB feed link/image ad | Pricing — "মাসিক $20 না — মাত্র ৳৫০০ এ সব ফিচার" (vs. a standalone CAPI tool; ৳500 = the real Growth package price, includes Pixel+CAPI + couriers + gateways + storefront + hosting) |
| `square-tracking-problem-dark.png` | 1080×1080 | FB/IG feed square | Tracking problem, same copy as the landscape variant |
| `square-tracking-solution-dark.png` | 1080×1080 | FB/IG feed square | Tracking solution, same copy as the landscape variant |
| `square-tracking-whyus-dark.png` | 1080×1080 | FB/IG feed square | Why us, same copy as the landscape variant |
| `square-tracking-pricing-dark.png` | 1080×1080 | FB/IG feed square | Pricing, same copy as the landscape variant |

## Second batch — one landscape + square per module (added 2026-08-30)

11 new themes, each in landscape (1200×630, FB feed link/image ad) and
square (1080×1080, FB/IG feed) — same `THEMES`/`MANIFEST` mechanism as the
first batch, one pillar per file, all copy grounded in `SAAS_MODULE_CONTEXT.md`
ground-truth status (only shipped/✅-done modules — nothing paused like
WhatsApp/auto-top-up, nothing placeholder like Ads ROI, nothing unbuilt like
referral). Filenames: `landscape-<theme>-dark.png` / `square-<theme>-dark.png`.

| Theme key | Module/pillar | Source status |
|---|---|---|
| `accounting` | Auto-ledger, profit/expense reports | §15.6 ✅ DONE |
| `collection_history` | Unified collection log (manual + courier COD) | §19 ✅ DONE 2026-08-17 |
| `digital_products` | Digital product sales (e-book/course/software, instant delivery) | §20 ✅ Phase 1 done 2026-08-20 |
| `staff_team` | Multi-user staff roles/permissions | §16.6 ✅ DONE 2026-08-10 |
| `invoice_pdf` | Auto invoice/waybill PDF | §16.7 ✅ DONE |
| `bulk_import` | CSV bulk product/order import | §23 ✅ DONE 2026-08-22 |
| `onboarding` | Guided onboarding checklist + demo data | §22 ✅ DONE 2026-08-22 |
| `ai_support` | AI support agent (instant diagnosis, per-page help, escalate-to-ticket) | `support_ticketing_ai_context.md`, live 2026-08-30 |
| `woocommerce` | WordPress/WooCommerce connector | §15.12 ✅ DONE (20 phases) — audit caveat: never tested on a real WooCommerce site yet |
| `analytics` | Sales/customer/courier analytics (excludes Ads ROI, still placeholder) | §15.7 ✅ DONE for sales/customers/courier |
| `security_2fa` | 2FA + admin audit trail | `security_hardening_context.md` ✅ DONE 2026-08-28 |

## Post captions (added 2026-08-30)

One caption per **theme**, reused across every size/format variant of that
theme (landscape/square/portrait/story/thumbnail all carry the same message
— only the image aspect ratio changes). Portal link in every caption:
`https://bsol.zyrotechbd.com`.

**Master** — `image-1787675474163`, `square-master-dark/light`, `portrait-master-dark`, `story-master-dark`, `thumbnail-master-dark`
> অর্ডার থেকে প্রফিট — পুরো ব্যবসা এক ড্যাশবোর্ডে 📊
> কুরিয়ার, পেমেন্ট, ফ্রড প্রোটেকশন, মার্কেটিং — সবকিছু এক জায়গায় ম্যানেজ করুন।
> ✅ ৫টি কুরিয়ার পার্টনার ✅ ৭টি পেমেন্ট গেটওয়ে ✅ ফেইক-অর্ডার প্রোটেকশন ✅ Facebook + WhatsApp মার্কেটিং
> আজই ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**কুরিয়ার** — `landscape-courier-dark`
> সব কুরিয়ার, সব অর্ডার — এক জায়গায় ট্র্যাক করুন 🚚
> Pathao, Steadfast, RedX, Carrybee, Paperfly — একসাথে ম্যানেজ করুন, বাল্ক বুকিং ও রিয়েল-টাইম স্ট্যাটাস সহ।
> বারবার আলাদা প্যানেলে লগইন করার দিন শেষ।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ফ্রড প্রোটেকশন** — `landscape-fraud-dark`
> ফেইক অর্ডারে আর টাকা ও সময় নষ্ট না ⚠️
> রিটার্ন-হিস্ট্রি স্কোর, কাস্টমার ব্ল্যাকলিস্ট আর OTP ভেরিফিকেশন দিয়ে আগেই চিনে নিন ঝুঁকিপূর্ণ অর্ডার।
> কুরিয়ার চার্জ আর সময় দুটোই বাঁচান।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**পেমেন্ট** — `landscape-payments-dark`
> যেভাবেই কাস্টমার পে করুক, আপনি টাকা পাবেন 💳
> SSLCommerz, bKash, Nagad, AamarPay, ZiniPay, ShurjoPay, EPS — ৭টি গেটওয়ে সাপোর্ট।
> মার্চেন্ট অ্যাকাউন্ট নেই? সমস্যা নেই — পার্সোনাল bKash/Nagad/Rocket নম্বরেও পেমেন্ট নিন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**মার্কেটিং অটোমেশন** — `landscape-marketing-dark`
> একটা মেসেজও যেন মিস না হয় 💬
> Facebook Pixel + Conversions API, Messenger লিড ইনবক্স, WhatsApp ও SMS অটোমেশন — সব একসাথে।
> প্রতিটা কাস্টমারকে সময়মতো রিপ্লাই দিন, বিক্রি বাড়ান।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ফ্রি সাইনআপ CTA** — `square-cta-dark`, `story-cta-dark`
> কার্ড ছাড়াই, ৫ মিনিটে — আজই ফ্রি অ্যাকাউন্ট খুলুন 🚀
> ৫টি কুরিয়ার, ৭টি পেমেন্ট গেটওয়ে, ফ্রড প্রোটেকশন — সব প্রস্তুত।
> আর দেরি না করে বিক্রি শুরু করুন।
> 👉 https://bsol.zyrotechbd.com

**পেমেন্ট+কুরিয়ার ট্রাস্ট** — `portrait-trust-dark`
> পেমেন্ট ও ডেলিভারি — দুটোই নিশ্চিত ✅
> ৫টি কুরিয়ার + ৭টি পেমেন্ট গেটওয়ে, একই ড্যাশবোর্ড থেকে।
> কাস্টমার যেভাবেই অর্ডার করুক, আপনার ব্যবসা থামবে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**স্টোরফ্রন্ট** — `landscape-storefront-dark`, `square-storefront-dark`
> নিজের নামে ফুল ইকমার্স শপ, নিজের সাবডোমেইনে — মিনিটেই 🏬
> কোনো ডেভেলপার লাগবে না — রেডি থিম, প্রোডাক্ট ক্যাটালগ, কার্ট ও চেকআউট, কাস্টমার রিভিউ সব রেডি।
> কাস্টমাররা এখন থেকে আপনার নিজের শপে অর্ডার করবে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ল্যান্ডিং পেজ** — `landscape-landingpage-dark`, `square-landingpage-dark`
> একটা প্রোডাক্টের জন্য হাই-কনভার্টিং ল্যান্ডিং পেজ 🎯
> ড্র্যাগ-ড্রপ বিল্ডার দিয়ে নিজেই বানান, OTP ভেরিফাইড চেকআউট আর ভিজিট/অর্ডার অ্যানালিটিক্স সহ।
> বিজ্ঞাপনের ট্রাফিক থেকে সরাসরি অর্ডারে কনভার্ট করুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**হোস্টিং লাগে না** — `landscape-hosting-dark`, `square-hosting-dark`
> হোস্টিং, সার্ভার, SSL — সব আমরাই ম্যানেজ করি 🔒
> নিজের ডোমেইন নেই? zyrotechbd.com-এর অধীনে ফ্রি সাবডোমেইন পাবেন, ৫ মিনিটেই লাইভ।
> টেকনিক্যাল কোনো ঝামেলা ছাড়াই ব্যবসা শুরু করুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ট্র্যাকিং — সমস্যা** — `landscape-tracking-problem-dark`, `square-tracking-problem-dark`
> iOS ১৪+ আপডেটে আপনার অনেক অর্ডার Pixel-এ ধরা পড়ছে না জানেন? ⚠️
> Signal Loss, Ad Blocker, Safari ITP-এর কারণে ভুল ডেটায় বিজ্ঞাপন অপ্টিমাইজ হচ্ছে — খরচ বাড়ছে, বিক্রি কমছে।
> সমাধান আছে আমাদের কাছে।
> বিস্তারিত জানুন 👉 https://bsol.zyrotechbd.com

**ট্র্যাকিং — সমাধান** — `landscape-tracking-solution-dark`, `square-tracking-solution-dark`
> ব্রাউজার মিস করলেও, সার্ভার থেকে ইভেন্ট যাবে ✅
> Facebook Pixel + সার্ভার-সাইড Conversions API — অটো ইভেন্ট Dedup, রিয়েল-টাইম লগ, মাত্র ১ ক্লিকে সেটআপ।
> ম্যাচ কোয়ালিটি বাড়ান, বিজ্ঞাপনের খরচ কমান।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ট্র্যাকিং — কেন আমরাই সেরা** — `landscape-tracking-whyus-dark`, `square-tracking-whyus-dark`
> ট্র্যাকিং, স্টোর, কুরিয়ার, পেমেন্ট — সব এক প্ল্যাটফর্মে 🏆
> কোনো ডেভেলপার লাগে না, লাইভ ইভেন্ট কোয়ালিটি মনিটর, দিনে ৩০,০০০+ ইভেন্ট — হোস্টিং সহ সবকিছু একসাথে।
> কেন আলাদা আলাদা টুল ব্যবহার করবেন?
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ট্র্যাকিং — প্রাইসিং** — `landscape-tracking-pricing-dark`, `square-tracking-pricing-dark`
> আলাদা CAPI টুলে মাসিক $20 (~২,৪০০ টাকা) — আমাদের কাছে মাত্র ৳৫০০-এ সব ফিচার! 💰
> Pixel + CAPI, ৫টি কুরিয়ার, ৭টি পেমেন্ট গেটওয়ে, স্টোরফ্রন্ট + হোস্টিং — সব একসাথে, এক দামে।
> আলাদা করে কিছু কিনতে হবে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**অ্যাকাউন্টিং** — `landscape-accounting-dark`, `square-accounting-dark`
> প্রতিটা টাকার হিসাব অটোমেটিক থাকবে 📒
> অর্ডার ডেলিভার হলেই অটো-লেজার আপডেট হয় — কুরিয়ার চার্জ, প্রফিট, এক্সপেন্স সব ট্র্যাক থাকে।
> ম্যানুয়াল এন্ট্রির ঝামেলা নেই।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**কালেকশন হিস্ট্রি** — `landscape-collection-history-dark`, `square-collection-history-dark`
> কে, কবে, কীভাবে টাকা তুলল — সব একসাথে ✅
> ম্যানুয়াল কালেকশন আর কুরিয়ার COD — দুই উৎসের রেকর্ডই এক জায়গায়, স্টাফ ও তারিখ দিয়ে ফিল্টার করুন।
> প্রতিটা লেনদেনের হিসাব থাকুক নিশ্চিত।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ডিজিটাল প্রোডাক্ট** — `landscape-digital-products-dark`, `square-digital-products-dark`
> ই-বুক, কোর্স, সফটওয়্যার — ডিজিটাল প্রোডাক্টও বিক্রি করুন 💾
> পেমেন্ট কনফার্ম হলেই কাস্টমার সাথে সাথে OTP-গেটেড ডাউনলোড লিংক পায় — কুরিয়ার লাগে না।
> ফিজিক্যাল আর ডিজিটাল, দুটোই একই দোকানে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**স্টাফ/টিম** — `landscape-staff-team-dark`, `square-staff-team-dark`
> একা না, পুরো টিম নিয়ে ব্যবসা চালান 👥
> রোল-ভিত্তিক পারমিশন দিয়ে ঠিক করুন কে কোন মডিউল দেখবে, কে কী করতে পারবে।
> স্টাফ অ্যাক্টিভিটিও ট্র্যাক করা যাবে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ইনভয়েস/ওয়েবিল** — `landscape-invoice-pdf-dark`, `square-invoice-pdf-dark`
> প্রতিটা অর্ডারের ইনভয়েস এক ক্লিকেই রেডি 🧾
> PDF ইনভয়েস আর কুরিয়ার ওয়েবিল — ব্র্যান্ডেড টেমপ্লেটে, সরাসরি প্রিন্ট বা ডাউনলোড করুন।
> আলাদা কোনো টুল লাগবে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**বাল্ক ইমপোর্ট** — `landscape-bulk-import-dark`, `square-bulk-import-dark`
> হাজার প্রোডাক্ট? এক CSV আপলোডেই শেষ 📥
> বাল্ক প্রোডাক্ট ও অর্ডার ইমপোর্ট, ভুল সারি অটো-হাইলাইট সহ।
> অন্য প্ল্যাটফর্ম থেকে সুইচ করছেন? পুরনো ডেটা কয়েক মিনিটেই নিয়ে আসুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**অনবোর্ডিং** — `landscape-onboarding-dark`, `square-onboarding-dark`
> প্রথম দিনেই বিভ্রান্ত হবেন না 🧭
> সাইনআপের পরই ধাপে ধাপে চেকলিস্ট, ডেমো ডেটা দিয়ে প্রিভিউ, আর প্রতি পেজে হেল্প গাইড আপনাকে দেখিয়ে দেবে কী করতে হবে।
> খালি ড্যাশবোর্ডে একা আটকে থাকবেন না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**AI সাপোর্ট** — `landscape-ai-support-dark`, `square-ai-support-dark`
> সমস্যায় পড়লে, AI সহকারী সাথে সাথে রেডি 🤖
> ইনস্ট্যান্ট ডায়াগনোসিস, প্রতি পেজে হেল্প বাটন — না বুঝলে নিজেই জিজ্ঞেস করে টিমের কাছে টিকেট খুলে দেয়।
> এজেন্টের জন্য অপেক্ষা করতে হবে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**WooCommerce কানেক্টর** — `landscape-woocommerce-dark`, `square-woocommerce-dark`
> আপনার WordPress সাইট সরাসরি কানেক্ট করুন 🔌
> WooCommerce কানেক্টর দিয়ে অর্ডার সিঙ্ক করুন, একই ড্যাশবোর্ড থেকে কুরিয়ার ও পেমেন্ট ম্যানেজ করুন।
> নতুন সাইট বানাতে হবে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**অ্যানালিটিক্স** — `landscape-analytics-dark`, `square-analytics-dark`
> সেলস, কাস্টমার, কুরিয়ার — রিয়েল ডেটা এক জায়গায় 📈
> সেলস ফানেল, টপ প্রোডাক্ট, কাস্টমার ইন্টেলিজেন্স (VIP/রিস্কি), কুরিয়ার পারফরম্যান্স রেট — সব রিয়েল ডেটা দিয়ে।
> কোনটা লাভজনক, এক নজরে দেখুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**সিকিউরিটি** — `landscape-security-dark`, `square-security-dark`
> আপনার অ্যাকাউন্ট সুরক্ষিত থাকবে সবসময় 🔐
> Two-Factor Authentication, অ্যাডমিন অ্যাক্টিভিটি লগ, রোল-ভিত্তিক অ্যাক্সেস।
> স্কেল বাড়লেও নিরাপত্তা নিয়ে চিন্তা নেই।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

## Digital-product-only seller campaign (added 2026-09-02)

Separate audience from every theme above: sellers who'll use BSOL purely to
sell e-books/courses/software — never a physical product, so courier/waybill
never appears in this set's copy on purpose. Grounded in
`digital_product_context.md` / `SAAS_MODULE_CONTEXT.md §20` (Phase 1 shipped
2026-08-20): hosted-file/external-URL delivery, email/SMS channel,
OTP-gated download, COD excluded (wallet + automated gateway only), mixed
cart blocked. 9 angles × landscape (1200×630) + square (1080×1080) = 18
files, in `image/by-feature/digital-only/<angle>/`.

| Folder (`digital-only/`) | Theme key | Angle |
|---|---|---|
| `master/` | `digital_master` | Broad intro — sell e-books/courses/software with no courier needed |
| `instant-delivery/` | `digital_instant` | Payment confirms → delivery in seconds |
| `anti-piracy-security/` | `digital_security` | OTP-gated download — a shared link can't be reused by someone else |
| `no-inventory/` | `digital_no_inventory` | Upload once, sell forever — no stock/warehouse |
| `course-ebook-creators/` | `digital_creators` | Targets course/e-book creators specifically — own landing page, no platform commission |
| `email-sms-channels/` | `digital_channels` | Per-product delivery channel (email/SMS/download link) |
| `instant-payment/` | `digital_payment` | Automated gateways (no COD for digital) → instant payment triggers instant delivery |
| `storefront-tracking/` | `digital_storefront` | Same storefront/subdomain/Pixel+CAPI/analytics stack digital sellers get too |
| `signup-cta/` | `digital_cta` | Direct signup CTA for this audience |

**Post captions:**

**ডিজিটাল প্রোডাক্ট — মাস্টার** — `landscape-digital-master-dark`, `square-digital-master-dark`
> কুরিয়ার ছাড়াই বিক্রি করুন — ই-বুক, কোর্স, সফটওয়্যার 💻
> ইনস্ট্যান্ট ডেলিভারি, OTP-গেটেড ডাউনলোড, ইমেইল/SMS ডেলিভারি — সব রেডি।
> পেমেন্ট কনফার্ম হলেই কাস্টমার সাথে সাথে প্রোডাক্ট পেয়ে যাবে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ইনস্ট্যান্ট ডেলিভারি** — `landscape-digital-instant-dark`, `square-digital-instant-dark`
> পেমেন্ট হলেই সেকেন্ডেই ডেলিভারি ⚡
> অটোমেটেড পেমেন্ট গেটওয়ে + ইনস্ট্যান্ট ডাউনলোড লিংক — কোনো ম্যানুয়াল কাজ নেই।
> কাস্টমারকে অপেক্ষা করাতে হবে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**পাইরেসি প্রোটেকশন** — `landscape-digital-security-dark`, `square-digital-security-dark`
> লিংক শেয়ার হলেও অন্য কেউ ডাউনলোড করতে পারবে না 🔒
> OTP-ভেরিফাইড ডাউনলোড, প্রাইভেট ফাইল হোস্টিং, প্রতি অর্ডারে আলাদা লিংক।
> আপনার কনটেন্ট সুরক্ষিত থাকবে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**নো ইনভেন্টরি** — `landscape-digital-no-inventory-dark`, `square-digital-no-inventory-dark`
> একবার আপলোড করুন, বারবার বিক্রি করুন 📦❌
> কোনো ইনভেন্টরি নেই, ওয়্যারহাউজ লাগে না — একই ফাইলে আনলিমিটেড বিক্রি।
> ফিজিক্যাল প্রোডাক্টের ঝামেলা ছাড়াই ব্যবসা চালান।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**কোর্স/ই-বুক ক্রিয়েটর** — `landscape-digital-creators-dark`, `square-digital-creators-dark`
> আপনার কোর্স বা ই-বুক বিক্রি করুন প্রফেশনালি 🎓
> নিজের ল্যান্ডিং পেজ, সিকিউর ডেলিভারি, কাস্টমার রিভিউ — সব একসাথে।
> আলাদা কোর্স-প্ল্যাটফর্মের কমিশন দিতে হবে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ইমেইল/SMS ডেলিভারি** — `landscape-digital-channels-dark`, `square-digital-channels-dark`
> কাস্টমার পাবে ইমেইল বা SMS-এ, অটোমেটিক 📩
> প্রতিটা প্রোডাক্টে আলাদা ডেলিভারি চ্যানেল সেট করতে পারবেন — ইমেইল, SMS, বা ডাউনলোড লিংক।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ইনস্ট্যান্ট পেমেন্ট** — `landscape-digital-payment-dark`, `square-digital-payment-dark`
> পেমেন্ট কনফার্ম, ডেলিভারিও একই সেকেন্ডে 💳
> SSLCommerz, bKash, Nagad, পার্সোনাল ওয়ালেট — ডিজিটাল প্রোডাক্টে COD নেই, তাই ডেলিভারি সরাসরি ট্রিগার হয়।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**স্টোরফ্রন্ট + ট্র্যাকিং** — `landscape-digital-storefront-dark`, `square-digital-storefront-dark`
> স্টোরফ্রন্ট, ট্র্যাকিং — সবই ডিজিটাল প্রোডাক্টেও 🏬
> নিজের সাবডোমেইনে শপ, Facebook Pixel + CAPI, সেলস অ্যানালিটিক্স — ফিজিক্যাল প্রোডাক্টের জন্য যা আছে সবই পাবেন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**সাইনআপ CTA** — `landscape-digital-cta-dark`, `square-digital-cta-dark`
> আজই ডিজিটাল প্রোডাক্ট বিক্রি শুরু করুন 🚀
> প্রোডাক্ট আপলোড করুন, পেমেন্ট গেটওয়ে কানেক্ট করুন — ব্যস, বিক্রি শুরু।
> কার্ড ছাড়াই, ৫ মিনিটে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

## Landing-page-builder-only campaign (added 2026-09-02)

Another distinct audience: sellers who already run (or want to run)
Facebook/Instagram ads and need one dedicated single-product campaign page
for that traffic — not the full multi-product storefront (that's the
`storefront` pillar). Grounded in `landing_page_context.md`: block builder
(§7–9, §18 — feature grid/trust badge blocks, media library, theme panel),
checkout-time OTP (§10, `CheckoutOtpController`), per-seller subdomain
publish, visit/order analytics (`LandingPageAnalyticsController`),
abandoned-checkout recovery + resume-checkout link + customer-value badge
(§19), product variant support (§20). 9 angles × landscape (1200×630) +
square (1080×1080) = 18 files, in
`image/by-feature/landing-page-campaign/<angle>/`.

| Folder (`landing-page-campaign/`) | Theme key | Angle |
|---|---|---|
| `master/` | `lp_master` | Broad intro — single-product campaign page for ad traffic |
| `block-builder/` | `lp_builder` | Drag-drop block builder — no developer needed |
| `otp-checkout/` | `lp_otp_checkout` | Phone OTP at checkout — filters fake orders before courier |
| `abandoned-cart-recovery/` | `lp_abandoned_cart` | Abandoned-checkout tracking + resume-checkout link |
| `visit-order-analytics/` | `lp_analytics` | Visit/order/conversion-rate analytics per page |
| `subdomain-hosting/` | `lp_subdomain` | Own subdomain, live in 5 minutes, no separate hosting |
| `product-variants/` | `lp_variants` | Size/color variant selection on the page itself |
| `customer-trust-badge/` | `lp_customer_trust` | Free returning-customer trust badge, no external fraud API |
| `signup-cta/` | `lp_cta` | Direct signup CTA for this audience |

**Post captions:**

**ল্যান্ডিং পেজ — মাস্টার** — `landscape-lp-master-dark`, `square-lp-master-dark`
> একটা প্রোডাক্টের জন্য হাই-কনভার্টিং পেজ বানান 🎯
> ব্লক-বিল্ডার, OTP চেকআউট, নিজের সাবডোমেইনে পাবলিশ, ভিজিট-অর্ডার অ্যানালিটিক্স — সব একসাথে।
> বিজ্ঞাপনের ট্রাফিক থেকে সরাসরি অর্ডারে কনভার্ট করুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ব্লক-বিল্ডার** — `landscape-lp-builder-dark`, `square-lp-builder-dark`
> ড্র্যাগ-ড্রপেই নিজের ল্যান্ডিং পেজ বানান 🛠️
> ফিচার গ্রিড, ট্রাস্ট ব্যাজ, মিডিয়া লাইব্রেরি, থিম প্যানেল — কোনো কোডিং লাগবে না।
> ডেভেলপার ছাড়াই কয়েক মিনিটে প্রফেশনাল পেজ রেডি।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**OTP চেকআউট** — `landscape-lp-otp-checkout-dark`, `square-lp-otp-checkout-dark`
> চেকআউটেই OTP দিয়ে ভেরিফাই ✅
> ফোন OTP ভেরিফিকেশন দিয়ে ফেইক অর্ডার ফিল্টার করুন, কুরিয়ারে পাঠানোর আগেই।
> রিয়েল কাস্টমার শনাক্ত করুন নিশ্চিতভাবে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**অ্যাবানডন্ড চেকআউট রিকভারি** — `landscape-lp-abandoned-cart-dark`, `square-lp-abandoned-cart-dark`
> চেকআউট শেষ না করলেও সেল হারাবেন না 🔁
> অ্যাবানডন্ড চেকআউট ট্র্যাকিং, রিজিউম-চেকআউট লিংক, কাস্টমার-ভ্যালু ব্যাজ।
> কে অর্ডার অসম্পূর্ণ রেখে গেছে জানুন, এক ক্লিকেই আবার কনভার্ট করুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ভিজিট-অর্ডার অ্যানালিটিক্স** — `landscape-lp-analytics-dark`, `square-lp-analytics-dark`
> কতজন এলো, কতজন অর্ডার করলো — দেখুন 📊
> ভিজিট অ্যানালিটিক্স, কনভার্সন রেট, অর্ডার-টু-ভিজিট রেশিও প্রতিটা পেজের জন্য আলাদা।
> কোন বিজ্ঞাপন কাজ করছে বুঝে বাজেট ঠিক জায়গায় খরচ করুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**সাবডোমেইন হোস্টিং** — `landscape-lp-subdomain-dark`, `square-lp-subdomain-dark`
> পেজ বানিয়ে ৫ মিনিটেই লাইভ করুন ⚡
> ফ্রি সাবডোমেইন, SSL সিকিউরিটি — বিজ্ঞাপনে সরাসরি লিংক দিন।
> আলাদা হোস্টিং-ডোমেইন কিনতে হবে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**প্রোডাক্ট ভ্যারিয়েন্ট** — `landscape-lp-variants-dark`, `square-lp-variants-dark`
> একই পেজে ভ্যারিয়েন্ট সিলেক্ট করে অর্ডার 🎨
> সাইজ, কালার — সব অপশন একই পেজে, স্টক-সঠিক অর্ডার নিশ্চিত করে।
> কাস্টমার সরাসরি পেজ থেকেই সঠিক ভ্যারিয়েন্ট বেছে অর্ডার করবে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**কাস্টমার-ট্রাস্ট ব্যাজ** — `landscape-lp-customer-trust-dark`, `square-lp-customer-trust-dark`
> কে বিশ্বস্ত কাস্টমার, চেকআউটেই বুঝে যান 🛡️
> কাস্টমার-ভ্যালু ব্যাজ দিয়ে রিটার্নিং কাস্টমার শনাক্ত করুন — বিনামূল্যে, কোনো এক্সটার্নাল API লাগে না।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**সাইনআপ CTA** — `landscape-lp-cta-dark`, `square-lp-cta-dark`
> আপনার প্রথম ল্যান্ডিং পেজ বানান আজই 🚀
> সাইনআপ করুন, প্রোডাক্ট যোগ করুন, বিজ্ঞাপন চালান — ফ্রি টেমপ্লেট, ৫ মিনিটে লাইভ, OTP চেকআউট সহ।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

## Incomplete order recovery campaign (added 2026-09-02)

A deep dive on one feature rather than a new audience: `landing_page_context.md §19`
("Abandoned Checkout / Incomplete Order ট্র্যাকিং"). Scope is **landing
pages only** (`abandoned_checkouts.landing_page_id` — no equivalent exists
for the storefront, confirmed no `abandoned` hits in
`seller_storefront_context.md`), and the doc is explicit that **automated
WhatsApp/SMS/Email recovery-message sending was deliberately not built**
(owner decision, §19 "ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে") — every angle below
was written to never imply auto-sent follow-up messages; the manual-followup
angle spells out that the seller copies the resume link and reaches out
themselves. 8 angles × landscape (1200×630) + square (1080×1080) = 16
files, in `image/by-feature/incomplete-order-recovery/<angle>/`.

| Folder (`incomplete-order-recovery/`) | Theme key | Angle |
|---|---|---|
| `master/` | `incomplete_master` | Broad intro — checkout not finished ≠ order lost |
| `auto-capture/` | `incomplete_capture` | Captures the moment a visitor starts typing, before submit; 20-min abandoned threshold, no cron |
| `resume-link/` | `incomplete_resume_link` | Resume-checkout link — cart/customer info auto-prefilled |
| `customer-value-badge/` | `incomplete_customer_value` | Free returning-customer badge on each abandoned row (order history + risk level) |
| `dashboard-export/` | `incomplete_dashboard` | Dashboard: filter/search, CSV export, dismiss/delete |
| `manual-followup/` | `incomplete_manual_followup` | Copy the resume link, follow up on your own WhatsApp/call — no automated sending exists |
| `conversion-tracking/` | `incomplete_convert` | Auto-marked converted + linked to the real order once the customer completes it |
| `signup-cta/` | `incomplete_cta` | Direct signup CTA — built into every landing page already, no separate setup |

**Post captions:**

**ইনকমপ্লিট অর্ডার — মাস্টার** — `landscape-incomplete-master-dark`, `square-incomplete-master-dark`
> চেকআউট শেষ না করলেও অর্ডার হারাবেন না 🛒
> অটো-ক্যাপচার, রিজিউম-চেকআউট লিংক, কাস্টমার-ভ্যালু ব্যাজ, CSV এক্সপোর্ট — সব একসাথে।
> কাস্টমার ফর্ম পূরণ করা শুরু করলেই ট্র্যাক হয়ে যায়, সাবমিট না করলেও।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**অটো-ক্যাপচার** — `landscape-incomplete-capture-dark`, `square-incomplete-capture-dark`
> টাইপ করা শুরু করলেই অটোমেটিক ক্যাপচার হয় ⌨️
> নাম বা ফোন এন্ট্রি হলেই ট্র্যাক শুরু — কোনো ক্রন জব লাগে না, ডুপ্লিকেট রো হয় না।
> ২০ মিনিট অ্যাক্টিভিটি না থাকলে নিজে থেকেই 'অ্যাবানডন্ড' হিসেবে দেখা যায়।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**রিজিউম-চেকআউট লিংক** — `landscape-incomplete-resume-link-dark`, `square-incomplete-resume-link-dark`
> রিজিউম লিংক পাঠান, কাস্টমার আবার ফিরে আসবে 🔗
> এক ক্লিকে কপি করুন — কার্ট ও কাস্টমারের তথ্য অটো-প্রিফিল হয়ে যায়, নতুন করে টাইপ লাগবে না।
> আগে যা যা লিখেছিল, ফিরে এসে সবকিছু আগের মতোই পাবে।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**কাস্টমার-ভ্যালু ব্যাজ** — `landscape-incomplete-customer-value-dark`, `square-incomplete-customer-value-dark`
> এই লিড কি আগে থেকেই কাস্টমার? এক নজরে জানুন 🏷️
> মোট অর্ডার ও খরচের হিস্ট্রি, রিস্ক লেভেল — বিনামূল্যে, কোনো এক্সটার্নাল API লাগে না।
> কাকে আগে ফলোআপ করবেন বুঝে অগ্রাধিকার ঠিক করুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ড্যাশবোর্ড ও এক্সপোর্ট** — `landscape-incomplete-dashboard-dark`, `square-incomplete-dashboard-dark`
> প্রতিটা অসম্পূর্ণ অর্ডার এক ড্যাশবোর্ডে ম্যানেজ করুন 📋
> ফিল্টার, সার্চ, CSV এক্সপোর্ট, ডিসমিস বা ডিলিট — সব এক জায়গায়।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**ম্যানুয়াল ফলোআপ** — `landscape-incomplete-manual-followup-dark`, `square-incomplete-manual-followup-dark`
> রিজিউম লিংক কপি করে WhatsApp বা কলে পাঠান 📞
> এক ক্লিকে লিংক কপি, নিজের নম্বর থেকেই মেসেজ — কোনো থার্ড-পার্টি টুল লাগে না।
> আপনি যেভাবে কাস্টমারের সাথে কথা বলেন, ঠিক সেভাবেই ফলোআপ করুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**কনভার্সন ট্র্যাকিং** — `landscape-incomplete-convert-dark`, `square-incomplete-convert-dark`
> রিয়েল অর্ডারে কনভার্ট হলে অটোমেটিক আপডেট হয় ✅
> অর্ডারের সাথে অটো-লিংক, কনভার্সন স্ট্যাটাস — ফলোআপ আসলেই কাজ করছে কিনা বুঝুন।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

**সাইনআপ CTA** — `landscape-incomplete-cta-dark`, `square-incomplete-cta-dark`
> হারানো অর্ডার ফিরিয়ে আনা শুরু করুন আজই 🚀
> ল্যান্ডিং পেজেই বিল্ট-ইন — নতুন কিছু চালু করতে হবে না, সাইনআপের সাথেই রেডি।
> ফ্রি অ্যাকাউন্ট খুলুন 👉 https://bsol.zyrotechbd.com

## Per-module deep-dive campaigns (added 2026-09-02)

User asked for every module/feature to get its own separate campaign — done
at "standard" depth (user's choice over "light"/2-per-module and "deep"/
7-9-per-module): 3-4 angles per module, fewer (2) for modules that are
genuinely thin rather than padded to a fixed count. Covers all 16 modules
that previously had only one generic landscape+square pair. Each module's
original theme/files are untouched; new theme keys only. 43 angles ×
landscape (1200×630) + square (1080×1080) = 86 files, each in
`image/by-feature/<module>/<angle>/`.

**Deliberate exclusion:** Messenger lead-capture is not one of the
marketing angles — `pages_messaging` is still rejected in Facebook App
Review as of 2026-08-20 (`facebook_integration_context.md §10`), so it
doesn't actually work yet for a seller who isn't admin/dev/tester on the
Meta app. Same caution as WhatsApp/auto-top-up already applied elsewhere in
this doc — marketing only got the 2 angles that are fully live for every
seller today (SMS automation, notification templates).

| Module folder | Angle subfolder | Theme key | What it says |
|---|---|---|---|
| `courier/` | `waybill-labels/` | `courier_waybill` | One-click branded waybill/label, 22 sticker templates |
| | `realtime-status/` | `courier_realtime` | Auto status sync across 5 couriers, no manual panel-checking |
| | `bulk-booking/` | `courier_bulk` | Book many orders at once, not one by one |
| `fraud-protection/` | `return-history-score/` | `fraud_return_history` | Aggregated return score across 5 couriers |
| | `customer-blacklist/` | `fraud_blacklist` | Blacklist once, auto-block repeat abusers |
| | `otp-verification/` | `fraud_otp` | Phone OTP filters fake orders before courier |
| `payments/` | `automated-gateways/` | `payments_gateways` | All 7 automated gateways, instant auto-verify |
| | `personal-wallet/` | `payments_wallet` | Personal bKash/Nagad/Rocket number, no merchant account |
| | `payment-choice/` | `payments_choice` | Customer pays any way, seller always gets paid |
| `marketing-automation/` | `sms-automation/` | `marketing_sms` | Auto SMS on every order-status change |
| | `notification-templates/` | `marketing_notification` | SMS + email templates managed in one place |
| `storefront/` | `theme-templates/` | `storefront_themes` | Standard/CareSolution templates, customizable |
| | `customer-reviews/` | `storefront_reviews` | Built-in review system, no external plugin |
| | `seo/` | `storefront_seo` | SEO-ready — sitemap, OG tags, structured data |
| `hosting/` | `fast-setup/` | `hosting_speed` | Signup to live shop in 5 minutes |
| | `free-ssl/` | `hosting_ssl` | Free SSL, 99.9% uptime, no extra cost |
| `accounting/` | `auto-ledger/` | `accounting_ledger` | Ledger auto-updates on order confirm/deliver |
| | `courier-charge-tracking/` | `accounting_courier_charge` | Courier charges auto-tracked as expense |
| | `profit-reports/` | `accounting_reports` | Summary/expense/profit reports |
| `collection-history/` | `unified-sources/` | `collection_sources` | Manual + courier COD in one list |
| | `staff-date-filter/` | `collection_staff_filter` | Filter by staff/date/order-number |
| `staff-team/` | `role-permissions/` | `staff_roles` | Module-level permission per staff account |
| | `owner-only-settings/` | `staff_owner_control` | Courier/payment settings stay owner-only |
| | `activity-tracking/` | `staff_tracking` | Staff activity visibility |
| `invoice-pdf/` | `branded-invoice/` | `invoice_branded` | Branded PDF invoice per order |
| | `instant-generation/` | `invoice_instant` | One-click generate/print/download |
| `bulk-import/` | `product-import/` | `bulk_products` | CSV product import, no manual typing |
| | `order-import/` | `bulk_orders` | CSV order import for migrating sellers |
| | `row-validation/` | `bulk_validation` | Bad rows flagged before commit |
| `onboarding/` | `checklist/` | `onboarding_checklist` | Step-by-step checklist from live data |
| | `demo-data/` | `onboarding_demo` | Preview with demo data, never touches live shop |
| | `per-page-help/` | `onboarding_help` | Guidance on every dashboard page |
| `ai-support/` | `instant-diagnosis/` | `ai_diagnosis` | Instant "why isn't X working" diagnosis |
| | `help-button/` | `ai_helpbutton` | Per-page "how do I use this" button |
| | `smart-escalation/` | `ai_escalation` | Asks before opening a ticket, escalates urgent issues directly |
| `woocommerce/` | `two-way-sync/` | `woo_sync` | Product/order sync both directions |
| | `courier-payment-parity/` | `woo_courier_payment` | Same courier/gateway engine as native orders |
| | `otp-fraud-tracking/` | `woo_extra` | Checkout OTP, fraud filter, Pixel/CAPI — ported to WordPress too |
| `analytics/` | `sales-funnel/` | `analytics_sales` | Sales funnel + top products |
| | `customer-intelligence/` | `analytics_customer` | VIP/risky segments, repeat-buyer rate |
| | `courier-performance/` | `analytics_courier` | Per-courier success rate, delivery time, charges |
| `security/` | `totp-2fa/` | `security_totp` | TOTP 2FA (RFC 6238) + recovery codes |
| | `admin-audit-log/` | `security_audit` | Audit log on high-value admin actions |

Captions follow the same one-per-theme pattern as every campaign above —
not reproduced in full here to keep this file manageable at 43 new angles;
each headline/chip set in `gen_ads.py`'s `THEMES` dict already reads as
ad-ready copy, so a caption is a light paraphrase of the theme's `headline`
+ `chips` + `subtext` fields, same voice as the rest of this document.

## Shared brand elements

Dark navy gradient background with a faint grid texture (light variant on
`image-1787676803318.png` only), teal/emerald accent (`#14b8a6`-ish) on the
one highlighted headline word and the CTA pill, "Zyrotech BSOL" wordmark +
rounded-square "B" logo mark top-left (centered on square/portrait/story/
thumbnail formats), pill-shaped feature chips, and a consistent
"ফ্রি অ্যাকাউন্ট খুলুন →" CTA button. All copy is Bangla; stat strip
("৫টি কুরিয়ার পার্টনার · ৭টি পেমেন্ট গেটওয়ে · ২৪/৭ ড্যাশবোর্ড অ্যাক্সেস")
only appears on the 1200×630 master banner.

## Regenerating or extending

```bash
cd frontend/scripts/ad-creatives
python3 gen_ads.py    # writes ./svg/*.svg
node rasterize.js     # rasterizes ./svg/*.svg -> ./png/*.png
```

New theme/size combos are added via `THEMES`/`MANIFEST` in `gen_ads.py` —
see that script's `README.md` §"Text sizing — read before editing copy"
before touching headline copy (two real overflow bugs were caught and
fixed there, documented so they don't recur).
