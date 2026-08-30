# Facebook/Instagram Ad Creative Images

Last updated: 2026-08-30 (added 22 new per-module creatives — see
§"Second batch"). Reference doc for the PNGs sitting in `image/Image/`
(untracked, not committed — one-off marketing assets, not app code). Full build
backstory, generator design, and the two layout bugs found while building it
live in `homepage_redesign_context.md` §"Facebook/Instagram ad creative set" —
this file exists just to map the actual filenames on disk (random upload-style
names, no theme in the filename itself) back to what each one actually is,
since nothing else records that mapping.

**51 total creatives now exist** across `./png` (29 from the first batch,
listed in the mapping table below; 22 from the second batch, one landscape +
one square per new module, listed in §"Second batch — one landscape + square
per module"). The first-batch files that were actually uploaded to Facebook
got renamed to random upload-style names when copied into `image/Image/`
(hence the mapping table); the second batch is still sitting under its
descriptive `./png` filenames — copy whichever ones get used into
`image/Image/` and add a row here once they're renamed, same as the first
batch was.

**All 51 also copied into `image/by-feature/<category>/` (added 2026-08-30,
untracked)** — one folder per feature/pillar, for handing off to whoever runs
a specific campaign without hunting through the flat `./png` output. Folders:
`brand-general` (master + free-signup CTA + trust, all sizes), `courier`,
`fraud-protection`, `payments`, `marketing-automation`, `storefront`,
`landing-page`, `hosting`, `tracking-pixel-capi` (problem/solution/why-us/
pricing, 4 sub-themes together since they're one campaign sequence),
`accounting`, `collection-history`, `digital-products`, `staff-team`,
`invoice-pdf`, `bulk-import`, `onboarding`, `ai-support`, `woocommerce`,
`analytics`, `security`, `fb-page-assets`. These are plain copies (not
symlinks) — regenerating via `gen_ads.py`/`rasterize.js` only refreshes
`./png`, so re-copy into `image/by-feature/` after any regen that changes
copy/layout.

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
