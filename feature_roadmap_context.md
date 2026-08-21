# SaaS ফিচার/মডিউল রোডম্যাপ — Business Growth Recommendations

এই ফাইলে ২০২৬-০৮-১০ তারিখে করা সম্পূর্ণ SaaS প্রজেক্ট অডিট (মডিউল/ফিচার অ্যানালাইসিস) থেকে পাওয়া সব সুপারিশ তালিকাবদ্ধ আছে, যাতে **"4. Staff/Team sub-account role"** (এখন সক্রিয় কাজ, বিস্তারিত `staff_team_role_context.md`-এ) শেষ হওয়ার পর বাকি সুপারিশগুলো সহজে রেফারেন্স করা যায় এবং পরবর্তী কাজ বেছে নেওয়া যায়।

Master context: `CONTEXT.md` (server/ops), `SAAS_MODULE_CONTEXT.md` (§15 ground-truth audit, §16 আগের প্রায়োরিটি লিস্ট — এই ফাইলের সাথে ওভারল্যাপ আছে, এই ফাইলটা business/commercial angle-এ বেশি ফোকাসড এবং নতুন কিছু আইটেমও যোগ করে)।

> **🚨 এই তালিকা থেকে যেকোনো নতুন আইটেমে কাজ শুরু করার আগে বাধ্যতামূলক:** CONTEXT.md §৩১ এবং `staff_team_role_context.md` পড়ো এবং সেই ফিচারটা Staff/Team role-aware ভাবে ডিজাইন/implement করো — নতুন কোনো resource তৈরি করলে সেটা Pattern A (team-shared, `whereIn(shopUserIds())`) না Pattern B (owner-only, `shopOwnerId()`) সেই সিদ্ধান্ত প্রথমেই নিতে হবে, প্রয়োজনে নতুন `StaffPermission::MODULE_KEYS` entry ও route middleware যোগ করতে হবে। এটা এখন optional না, প্রতিটা নতুন module-এর জন্য mandatory চেকলিস্ট।

Last updated: 2026-08-21 — **নতুন আইটেম #৯: সেলার স্টোরফ্রন্ট (ফুল ইকমার্স শপ)** — ফিজিবিলিটি যাচাই + ১০-ফেজ প্ল্যান সম্পন্ন (`seller_storefront_context.md`)। এখন landing page একটা single-product ক্যাম্পেইন পেজ; এই ফিচার তার পাশাপাশি একটা পূর্ণাঙ্গ browsable ক্যাটালগ শপ (হোমপেজ/ক্যাটাগরি/প্রোডাক্ট লিস্টিং/কার্ট/সার্চ/রিভিউ) যোগ করে, per-seller সাবডোমেইনেই। কোনো migration/কোড এখনো লেখা হয়নি, user-এর অনুমতি বাকি। Older entries kept as-is:

Last updated: 2026-08-20 (৬) — **আইটেম #৮ (ডিজিটাল প্রোডাক্ট সিস্টেম) Phase 1 ✅ সম্পন্ন ও লাইভ** — user-এর ৪টা সিদ্ধান্ত অনুযায়ী ইমপ্লিমেন্ট + deploy সম্পন্ন: personal wallet রাখা হয়েছে (COD বাদ), mixed cart checkout-এ block, per-product delivery config (hosted file/external URL + email/SMS চ্যানেল), hosted file-এ OTP-gated anti-piracy। বিস্তারিত `digital_product_context.md`। Older entries kept as-is:

Last updated: 2026-08-20 (৫) — **নতুন আইটেম #৮: ডিজিটাল প্রোডাক্ট সিস্টেম** — user-এর সিদ্ধান্তে পরবর্তী গবেষণার বিষয় হিসেবে যোগ করা হলো (ফিজিকালের পাশাপাশি e-book/software/course ইত্যাদি বিক্রি, instant email/WhatsApp/SMS/download-link ডেলিভারি, সুপার-অ্যাডমিন-নিয়ন্ত্রিত ফাইল সাইজ/ফরম্যাট পলিসি)। প্রাথমিক গবেষণা রিপোর্ট সম্পূর্ণ — বিস্তারিত `digital_product_context.md`। এখনো কোনো migration/কোড লেখা হয়নি, user-conferm বাকি (`digital_product_context.md §৯`)।

Last updated: 2026-08-20 (৪) — **WhatsApp (#২) ও Auto-top-up (#৩) দুটোই পজড** — কোড/টেস্ট/ডক সব সম্পূর্ণ ও deployed, কিন্তু দুটোই এমন external (Meta/bKash-side) সেটআপে আটকে আছে যেটা এই dev environment থেকে production-এ শেষ করা যাচ্ছে না এখন। User পরবর্তী অন্য একটা ফিচারে সরে যাওয়ার সিদ্ধান্ত নিয়েছেন — বিস্তারিত "পরবর্তী পদক্ষেপ" সেকশনে ও status টেবিলে। Older entries kept as-is:

Last updated: 2026-08-20 (৩) — **WhatsApp §১ সংশোধন**: real কাস্টমারে পাঠাতে যে verification লাগে সেটা BSOL-এর একটামাত্র App Review না, **প্রতিটা সেলারকে নিজের Meta Business Manager নিজে verify করাতে হবে** (credential-paste architecture-এ token সেলারের নিজের App-এর সাথে বাঁধা থাকে)। একই সাথে একটা real কোড গ্যাপও পাওয়া গেছে ও ফিক্স হয়েছে — inbound webhook subscribe (`subscribed_apps`) কল বাদ পড়েছিল, তাই connect করা সত্ত্বেও ইনবক্স কখনো মেসেজ পেত না। বিস্তারিত `whatsapp_context.md §১/§১ক`।

Last updated: 2026-08-20 (২) — **আইটেম #২ (WhatsApp Business)-এর Phase 1 ✅ সম্পন্ন ও লাইভ** — order-status automation (Meta-approved টেমপ্লেট) + ২-way ইনবক্স, দুটোই deploy করা হয়েছে। বিস্তারিত `whatsapp_context.md`।

Last updated: 2026-08-20 — **আইটেম #৩ (Auto-top-up)-এর Phase 1 ✅ সম্পন্ন ও লাইভ** — SMS credit auto-recharge: bKash Agreement (saved payment method) কানেক্ট করে থ্রেশহোল্ড সেট করলে balance কমে গেলেই নিজে থেকে রিচার্জ হয়। Subscription auto-renew ইচ্ছাকৃতভাবে বাদ (deferred)। বিস্তারিত `auto_top_up_context.md`।

Last updated: 2026-08-17 (২) — **আইটেম #১ (checkout online payment)-এর Phase A এখন ✅ সম্পন্ন ও লাইভ** — personal bKash/Nagad/Rocket "send & verify" (মার্চেন্ট একাউন্ট ছাড়াই)। বিস্তারিত `online_payment_context.md`, `SAAS_MODULE_CONTEXT.md §15.15`। নিচের §১-এর বিস্তারিত অংশও দ্রষ্টব্য — Phase B/C (SSLCommerz/bKash merchant gateway) এখনো বাকি।

Last updated: 2026-08-17 — এই ফাইলের status টেবিল অনেকদিন sync হয়নি, বড় আপডেট: Tracking Platform (T1-T7, `tracking_capi_context.md`) এবং Per-seller সাবডোমেইন (D1-D5, `custom_domain_context.md`) দুটোই এখন **✅ সম্পূর্ণ**, আগে "planning/design done" লেখা ছিল যেটা এখন ভুল। WordPress/WooCommerce Connector-এর জন্য নতুন row যোগ হলো (২০ ফেজ, ✅ সম্পূর্ণ, আগে এই টেবিলেই ছিল না)। Custom domain (landing pages, #৬)-এর অর্ধেক (per-seller subdomain অংশ) এখন সম্পূর্ণ — বাকি শুধু সেলারের নিজস্ব ডোমেইন (T8b)।

Last updated: 2026-08-10 — প্রাথমিক তালিকা তৈরি। **Staff/Team sub-account role (Phase 1+2, সব মডিউল) সম্পূর্ণ শেষ** — বিস্তারিত `staff_team_role_context.md`, নিচের status টেবিলে আপডেট করা হয়েছে। নিচের বাকি আইটেমগুলোর কোনোটাতে এখনো কাজ শুরু হয়নি।

---

## অবস্থা ট্র্যাকিং

| # | ফিচার | স্ট্যাটাস | ডিটেইল ফাইল |
|---|---|---|---|
| — | **Staff/Team sub-account role** | ✅ **সম্পন্ন** (Phase 1 + Phase 2, সব মডিউল কভার করা হয়েছে, deployed+verified) | `staff_team_role_context.md` |
| 1 | চেকআউটে অনলাইন পেমেন্ট কালেকশন | ✅ সম্পূর্ণ — Phase A (personal wallet) + Phase B/C-এর পরিকল্পিত সবগুলো (৭টা) automated gateway (SSLCommerz, AamarPay, ZiniPay, ShurjoPay, EPS, bKash Merchant, Nagad Merchant) লাইভ (২০২৬-০৮-১৯), landing page ও WooCommerce (`bsol-connect` v1.19.0) দুই জায়গাতেই। Nagad Merchant-এর verify shape unconfirmed — live sandbox test প্রয়োজন | `online_payment_context.md`, `wordpress_connect_context.md §১২` |
| 2 | WhatsApp Business integration | ⏸️ **পজড (২০২৬-০৮-২০)** — Phase 1 (automation + inbox) কোড সম্পূর্ণ ও deployed, কিন্তু production-এ end-to-end টেস্ট করার উপায় নেই এখন (সেলার-সাইড Meta App-এ WhatsApp product/token setup বাকি, `whatsapp_context.md §১`) — resume-able অবস্থায় রাখা হয়েছে | `whatsapp_context.md` |
| 3 | Auto-top-up / usage-based billing | ⏸️ **পজড (২০২৬-০৮-২০)** — Phase 1 (SMS credit auto-recharge) কোড সম্পূর্ণ ও deployed, কিন্তু production-এর real bKash credential Tokenized Checkout-এর জন্য না (PGW-এর জন্য) বলে end-to-end টেস্ট করা যাচ্ছে না — `auto_top_up_context.md §২ক`। subscription auto-renew আগে থেকেই deferred | `auto_top_up_context.md` |
| 5 | Courier waybill/label PDF | ✅ সম্পন্ন ও deployed — COD amount বাগ ফিক্স, Pathao-স্টাইল লেবেল, Sticker Template ফিচার (২২টা ডিজাইন, সেলার-সিলেক্টেবল, প্রিভিউ থাম্বনেইল সহ) সম্পূর্ণ, এবং ✅ বাংলা টেক্সট রেন্ডারিং বাগ ফাইনালি সমাধান (real HarfBuzz shaping — সবগুলো ২২টা sticker টেমপ্লেট + order invoice-এ), + Payment History টেবিল (২০২৬-০৮-১৭) | `courier_waybill_context.md` §৪.৭, §৬, §৮.১ |
| — | **Tracking Platform (Facebook CAPI + browser-side, প্যাকেজ-ভিত্তিক ইভেন্ট লিমিট)** | ✅ সম্পন্ন (T1-T7, ২০২৬-০৮-১৬) — পরিকল্পনার সবগুলো ফেজ শেষ, browser Pixel + server CAPI + order-flow ইভেন্ট + quota + event log + admin usage view — লাইভ | `tracking_capi_context.md` |
| — | **Per-seller সাবডোমেইন (ড্যাশবোর্ড + ল্যান্ডিং পেজ, `*.zyrotechbd.com`)** | ✅ সম্পন্ন (D1-D5, ২০২৬-০৮-১৫) — wildcard DNS/TLS/nginx লাইভ, handoff login, reserved-subdomain admin মডিউল, নিরাপত্তা অডিট সম্পন্ন (১ High+২ Medium, সব ফিক্সড) | `custom_domain_context.md`, `domain_security_audit.md` |
| — | **WordPress/WooCommerce Connector (BSOL Connect প্লাগইন)** | ✅ সম্পন্ন (২০ ফেজ, v1.17.0) — order/product sync, courier booking (৫টাই), waybill/invoice PDF, checkout OTP, Facebook CAPI, bulk sync, abandoned checkout, repeat-order block, blacklist block, tracking Pixel — সব লাইভ; বাকি শুধু real WooCommerce staging QA (ব্যবহারকারীর নিজের সাইটে) | `wordpress_connect_context.md` |
| 6 | Custom domain সাপোর্ট (landing pages) | 🟡 আংশিক — per-seller সাবডোমেইন অংশ ✅ সম্পন্ন (উপরে); সেলারের **নিজস্ব** ডোমেইন (T8b, `custom_domain_context.md §11` আইটেম ৩) এখনো শুরু হয়নি | `custom_domain_context.md` |
| 7 | Marketing broadcast campaign (CRM-segment টার্গেটেড) | ⬜ Not started | — |
| 8 | ডিজিটাল প্রোডাক্ট সিস্টেম (instant delivery, নিজস্ব হোস্টিং) | ✅ Phase 1 সম্পন্ন ও লাইভ (২০২৬-০৮-২০) | `digital_product_context.md` |
| 9 | সেলার স্টোরফ্রন্ট (ফুল ইকমার্স শপ) | 🟡 S0/S1/S2/S3/S4/S6 ✅ লাইভ, real order দিয়ে end-to-end ভেরিফাইড (রাউটিং + API + dashboard ফিল্ড এডিটর + COD checkout + কার্ট + ক্যাটাগরি/প্রোডাক্ট/সার্চ পেজ, ২০২৬-০৮-২১) — বাকি S5/S7-S9, S3b (অনলাইন পেমেন্ট) | `seller_storefront_context.md` |
| — | Bulk/CSV order import | ⬜ Not started | (SAAS_MODULE_CONTEXT.md §16.8-এও আছে) |
| — | PWA | ⬜ Not started | (§16.9) |
| — | Referral/affiliate program (সেলার→সেলার) | ⬜ Not started | — |
| — | Onboarding wizard | ⬜ Not started | — |
| — | Facebook App Review সম্পূর্ণ করা (external) | ⬜ Not started | `facebook_integration_context.md` §3 |
| — | Native mobile app | ⬜ Not started | দীর্ঘমেয়াদী |
| — | AI product-description/auto-reply generator | ⬜ Not started | দীর্ঘমেয়াদী |
| — | Cross-seller courier rate negotiation | ⬜ Not started | দীর্ঘমেয়াদী |
| — | VAT/Tax challan export ফরম্যাট | ⬜ Not started | দীর্ঘমেয়াদী |

---

## উচ্চ-প্রায়োরিটি (সরাসরি রেভিনিউ/রিটেনশন impact)

### 1. চেকআউটে অনলাইন পেমেন্ট কালেকশন — 🟡 আংশিক (Phase A ✅ সম্পন্ন, ২০২৬-০৮-১৭)
প্রোডাক্ট ভিশনের মূল সমস্যা "৩০-৫০% ফেক/অনুপস্থিত অর্ডার"-এর সবচেয়ে সরাসরি সমাধান। **Phase A লাইভ**: personal bKash/Nagad/Rocket "send & verify" — কাস্টমার সেলারের পার্সোনাল নম্বরে টাকা পাঠায়, TrxID সাবমিট করে, সেলার ভেরিফাই করে অ্যাপ্রুভ করে; মার্চেন্ট একাউন্ট লাগে না বলে ছোট/নতুন সেলারদের জন্য প্রথমে শিপ করা হয়েছে (দুটো external AI review-ও independently এই gap-টাই সবচেয়ে বড় বলেছিল)। বিস্তারিত `online_payment_context.md`।

**বাকি (Phase B/C):** সত্যিকারের automated gateway — SSLCommerz (মার্চেন্ট একাউন্ট থাকা সেলারদের জন্য) ও bKash Merchant/PGW (subscription billing-এর bKash কোড থেকে সম্পূর্ণ আলাদা, ইচ্ছাকৃতভাবে touch করা হয়নি — platform-wide vs per-seller creds mismatch)। Provider abstraction ইন্টারফেস (`PaymentGatewayClient`) ডিজাইন করা আছে, `payment_gateway_settings` টেবিলে sslcommerz/bkash_gateway কলামও রেডি — শুধু client+controller+route যোগ করতে হবে।

### 2. WhatsApp Business integration — 🟡 Phase 1 ✅ সম্পন্ন (২০২৬-০৮-২০)
Facebook Messenger lead-capture-এর architecture (webhook + phone auto-link) সরাসরি reuse হয়েছে — `WhatsappMessageCaptureService`, `WhatsappCloudApiClient` (`FacebookGraphClient`-এর প্যাটার্ন)। Order-status automation (`SmsAutomationService`-এর হুবহু কাঠামো, Meta-approved টেমপ্লেট রেফারেন্স করে) + ২-way ইনবক্স (`FacebookLeadController`-এর প্যাটার্ন, wa_id দিয়ে exact customer auto-link) — দুটোই লাইভ।
**বাকি**: প্রতিটা সেলারকে (BSOL না) নিজের Meta Business Manager-এ Business Verification করাতে হবে ৫টা verified-tester নম্বরের cap কাটাতে — onboarding-এর একটা ধাপ, একবারের কেন্দ্রীয় App Review না। বিস্তারিত `whatsapp_context.md §১`।

### 3. Auto-top-up / usage-based billing — 🟡 আংশিক (Phase 1 ✅ সম্পন্ন, ২০২৬-০৮-২০)
**Phase 1 লাইভ**: SMS credit auto-recharge — সেলার একবার bKash Agreement কানেক্ট করে থ্রেশহোল্ড + top-up amount সেট করলে balance কমে গেলে নিজে থেকেই রিচার্জ হয় (নতুন `saved_payment_methods` টেবিল, `BkashPaymentGatewayClient`-এ Agreement মেথড, `AutoRechargeSmsCreditJob`, circuit-breaker ৩ বার ব্যর্থে auto-disable)। ⚠️ bKash-এর real Agreement API shape sandbox-এ verify করা হয়নি এখনো (EPS/Nagad Merchant-এর মতোই সতর্কতা)। বিস্তারিত `auto_top_up_context.md`।

**বাকি (subscription auto-renew, ইচ্ছাকৃতভাবে deferred)**: একই saved-payment-method infra/টেবিল দিয়ে subscription-ও auto-renew করা যাবে (`ExpireSubscriptions` command-এ hook করে) — বড় blast radius বলে এই ফেজে করা হয়নি, user explicit request করলে পরে যোগ করা যাবে।

---

## মাঝারি-প্রায়োরিটি

### 5. Courier waybill/label PDF (thermal print format)
`barryvdh/laravel-dompdf` ইতিমধ্যে কোডবেসে আছে (subscription/SMS invoice PDF-এ ব্যবহৃত, `InvoicePdfService`)। একই pattern দিয়ে 58mm/80mm প্রিন্টেবল label — বাংলাদেশি courier workflow-এ প্রায় must-have।
**শুরুর পয়েন্ট:** নতুন Blade template + `InvoicePdfService`-এর অনুরূপ `WaybillPdfService`, courier booking response থেকে render।

### 6. Custom domain সাপোর্ট (landing pages) — 🟡 আংশিক (per-seller সাবডোমেইন অংশ ✅ সম্পন্ন)
**আপডেট (২০২৬-০৮-১৭):** এখানে বর্ণিত সমস্যাগুলোর (`_fbc` ক্রস-সেলার দূষণ, Meta domain verification) সবচেয়ে বড় অংশ ইতিমধ্যে সমাধান হয়ে গেছে per-seller **সাবডোমেইন** ফিচারের মাধ্যমে (D1-D5, ২০২৬-০৮-১৫, `custom_domain_context.md`) — প্রতিটা সেলার এখন `{label}.zyrotechbd.com`-এ নিজের ঠিকানায় Full tracking tier পায়, exact-host কুকি ক্রস-সেলার দূষণ কাঠামোগতভাবে বন্ধ, আর `zyrotechbd.com` একবার verify করাতেই সব সেলারের সাবডোমেইন ঢেকে যায় (per-seller partner-assignment লাগে না)। **যা এখনো বাকি** নিচের মূল টেক্সট অনুযায়ী শুধু সেলারের **নিজের কেনা** ডোমেইন (T8b) — সেটার একমাত্র বাকি বাস্তব সুবিধা শেয়ার্ড-অ্যাপেক্স রেপুটেশন ঝুঁকি এড়ানো (`custom_domain_context.md §10`), AEM/verification আর ব্লকার না।

এখন সব পেজ platform সাবডোমেইনে। নিজের domain কানেক্ট করার সুবিধা — premium-tier subscription-এর জন্য শক্তিশালী upsell reason (ব্র্যান্ডিং চাওয়া বড় সেলাররা higher-tier প্যাকেজ কিনবে)।
**নতুন, আরও শক্তিশালী যুক্তি (২০২৬-০৮-১৪, `tracking_capi_context.md §8`):** শেয়ার্ড ডোমেইনে Meta domain verification/AEM সেলার নিজে করতে পারে না, `_fbc` কুকি ক্রস-সেলার দূষিত হয়, এবং একজনের পলিসি-লঙ্ঘনে পুরো ডোমেইন (ড্যাশবোর্ডসহ) ঝুঁকিতে পড়ে। কাস্টম ডোমেইন এই তিনটাই সমাধান করে — অর্থাৎ এটা শুধু ব্র্যান্ডিং নয়, **পরিমাপযোগ্য ad-performance upsell** (Full vs Basic tracking tier)।
**শুরুর পয়েন্ট (এখন শুধু T8b-এর জন্য প্রযোজ্য):** DNS CNAME verification flow + nginx/certbot automation (server-level কাজ, `CONTEXT.md`-এর nginx/SSL সেকশন রেফারেন্স করতে হবে) — এটা তুলনামূলক বড় ops স্কোপ, অন্যগুলোর চেয়ে ভিন্ন ধরনের কাজ।

### 7. Marketing broadcast campaign (CRM-segment টার্গেটেড)
SMS automation এখন শুধু order-status trigger। VIP/loyal/risky segment (Customer Intelligence-এ ইতিমধ্যে আছে, `AnalyticsController::customers()`) টার্গেট করে one-off marketing broadcast SMS পাঠানোর UI — সেলারদের বিক্রি বাড়ায় + SMS credit বেশি বিক্রি হয় (revenue loop)।
**শুরুর পয়েন্ট:** নতুন `SmsBroadcastController` — segment query (existing customer-tagging লজিক reuse) + bulk-send job (queue worker এখন লাইভ আছে, §17.10 fix অনুযায়ী)।

### 8. ডিজিটাল প্রোডাক্ট সিস্টেম (২০২৬-০৮-২০, গবেষণা সম্পন্ন)
ফিজিকালের পাশাপাশি সেলাররা e-book/software/course ইত্যাদি ডিজিটাল প্রোডাক্ট বিক্রি করবে — কুরিয়ারের বদলে instant email/WhatsApp/SMS/download-link ডেলিভারি, ফাইল হোস্টিং নিজেদের সার্ভারে, সাইজ/ফরম্যাট পলিসি সুপার-অ্যাডমিন-নিয়ন্ত্রিত। গবেষণায় দেখা গেছে অনেক ইনফ্রা আগে থেকেই আছে (admin-controlled file-policy প্যাটার্ন `ProductMediaSetting`-এ, email+SMS dispatch `NotificationDispatchService`-এ, secure token-link `Order.public_token`-এ, private storage disk আগে থেকেই আলাদা) — মূল নতুন কাজ হলো ডিজিটাল ফাইল স্টোরেজ+ডেলিভারি পাইপলাইন আর payment→instant-delivery gating (শুধু automated gateway-তে instant, personal-wallet manual-verify-তে না — এইটাই সবচেয়ে বড় সিদ্ধান্ত)। বিস্তারিত `digital_product_context.md`।

### 9. সেলার স্টোরফ্রন্ট (ফুল ইকমার্স শপ) (২০২৬-০৮-২১, প্ল্যান সম্পন্ন)
এখন landing page একটা single-product ক্যাম্পেইন পেজ (বিজ্ঞাপন থেকে আসা ট্রাফিকের জন্য)। সেলারদের একটা পূর্ণাঙ্গ browsable ইকমার্স শপও দরকার — হোমপেজ (ব্যানার/ফিচারড ক্যাটাগরি/টপ-সেলিং), ক্যাটাগরি নেভিগেশন, প্রোডাক্ট লিস্টিং+সার্চ, প্রোডাক্ট ডিটেইল (গ্যালারি/রিভিউ/related products), মাল্টি-প্রোডাক্ট কার্ট। User-এর দেওয়া রেফারেন্স ডিজাইন (Ghorer Bazar/organic.deshitech.com) থেকে স্পেসিফিকেশন নেওয়া, মোবাইল-ফার্স্ট (bottom nav + floating cart), SEO-friendly।

`Product`/`ProductCategory`/per-seller subdomain/checkout-payment-courier ইঞ্জিন সরাসরি reuse হবে — নতুন মূল কাজ: পাবলিক ক্যাটালগ API, client-side cart, storefront থিম/হোমপেজ কনফিগারেশন, রিভিউ সিস্টেম, SEO ইনফ্রা। root path (`/`) ডিফল্টে storefront দেখাবে, সেলার চাইলে একটা landing page-কে হোমপেজ হিসেবে সেট করতে পারবে — কিন্তু স্টোরফ্রন্ট সবসময় সরাসরি URL-এ অ্যাক্সেসযোগ্য থাকবে। বিস্তারিত ১০-ফেজ প্ল্যান `seller_storefront_context.md`। **User-এর অনুমতির অপেক্ষায়, কোনো কোড এখনো লেখা হয়নি।**

---

## নিম্ন-প্রায়োরিটি / দীর্ঘমেয়াদী (আগের turn-এ উল্লেখিত, বিস্তারিত এখানে repeat করা হয়নি — `SAAS_MODULE_CONTEXT.md §16`-এ ক্রস-রেফারেন্স)

- Bulk/CSV order import (§16.8)
- PWA (§16.9)
- Referral/affiliate program (সেলার→সেলার) — কম CAC-তে নতুন সেলার আনা
- Onboarding wizard — নতুন সেলারের setup complexity কমানো, churn কমায়
- Facebook App Review সম্পূর্ণ করা (external, `facebook_integration_context.md §3`)
- Native mobile app (Android প্রথমে)
- AI-assisted product description / auto-reply generator
- Cross-seller courier rate negotiation (platform bulk volume leverage)
- VAT/Tax challan export ফরম্যাট (বড় সেলারদের জন্য compliance ফিচার)

---

## পরবর্তী পদক্ষেপ

> **আপডেট (২০২৬-০৮-২০, ৪)** — user সিদ্ধান্ত নিয়েছেন: **#২ (WhatsApp) ও #৩ (Auto-top-up) দুটোই আপাতত পজড** — কোড সম্পূর্ণ ও deployed, কিন্তু দুটোই এমন external ব্লকারে আটকে আছে যেটা এই dev environment থেকে production-এ সরাসরি টেস্ট করার উপায় নেই (bKash-এর real credential Tokenized Checkout-এর জন্য না — `auto_top_up_context.md §২ক`; WhatsApp-এ WhatsApp product/token generation সেলারকে নিজে Meta Business Suite-এ গিয়ে করতে হয় — `whatsapp_context.md §১`)। দুটোই resume-able অবস্থায় রেখে দেওয়া হয়েছে (কোড/টেস্ট/ডক সব আপ-টু-ডেট) — bKash credential ঠিক হলে বা কেউ Meta-সাইড setup শেষ করলে যেকোনো সময় ফিরে আসা যাবে, নতুন করে ডিজাইন করতে হবে না।
>
> এখন **অন্য একটা ফিচার নিয়ে গবেষণা/কাজ শুরু** হচ্ছে — নিচের তালিকা থেকে ⬜/🟡 আইটেমগুলো (Marketing broadcast #৭, Bulk/CSV import, Custom domain T8b, ইত্যাদি) বিবেচনায় আছে, চূড়ান্ত সিদ্ধান্ত user-এর সাথে পরের turn-এ কনফার্ম হবে।

Staff/Team sub-account role (`staff_team_role_context.md`) শেষ হওয়ার পর, উপরের তালিকা থেকে user-এর সাথে confirm করে পরবর্তী আইটেম বেছে নিতে হবে — recommended order ছিল: **#1 (checkout payment) → #3 (auto-top-up) → #2 (WhatsApp)**, কারণ এই তিনটাই সরাসরি core problem/revenue hit করে এবং existing bKash/webhook pattern-এর উপর অল্প কাজে বসানো যায়। #1 সম্পূর্ণ, #2/#3 উপরে বর্ণিত কারণে পজড।
