# SaaS ফিচার/মডিউল রোডম্যাপ — Business Growth Recommendations

এই ফাইলে ২০২৬-০৮-১০ তারিখে করা সম্পূর্ণ SaaS প্রজেক্ট অডিট (মডিউল/ফিচার অ্যানালাইসিস) থেকে পাওয়া সব সুপারিশ তালিকাবদ্ধ আছে, যাতে **"4. Staff/Team sub-account role"** (এখন সক্রিয় কাজ, বিস্তারিত `staff_team_role_context.md`-এ) শেষ হওয়ার পর বাকি সুপারিশগুলো সহজে রেফারেন্স করা যায় এবং পরবর্তী কাজ বেছে নেওয়া যায়।

Master context: `CONTEXT.md` (server/ops), `SAAS_MODULE_CONTEXT.md` (§15 ground-truth audit, §16 আগের প্রায়োরিটি লিস্ট — এই ফাইলের সাথে ওভারল্যাপ আছে, এই ফাইলটা business/commercial angle-এ বেশি ফোকাসড এবং নতুন কিছু আইটেমও যোগ করে)।

> **🚨 এই তালিকা থেকে যেকোনো নতুন আইটেমে কাজ শুরু করার আগে বাধ্যতামূলক:** CONTEXT.md §৩১ এবং `staff_team_role_context.md` পড়ো এবং সেই ফিচারটা Staff/Team role-aware ভাবে ডিজাইন/implement করো — নতুন কোনো resource তৈরি করলে সেটা Pattern A (team-shared, `whereIn(shopUserIds())`) না Pattern B (owner-only, `shopOwnerId()`) সেই সিদ্ধান্ত প্রথমেই নিতে হবে, প্রয়োজনে নতুন `StaffPermission::MODULE_KEYS` entry ও route middleware যোগ করতে হবে। এটা এখন optional না, প্রতিটা নতুন module-এর জন্য mandatory চেকলিস্ট।

Last updated: 2026-08-17 (২) — **আইটেম #১ (checkout online payment)-এর Phase A এখন ✅ সম্পন্ন ও লাইভ** — personal bKash/Nagad/Rocket "send & verify" (মার্চেন্ট একাউন্ট ছাড়াই)। বিস্তারিত `online_payment_context.md`, `SAAS_MODULE_CONTEXT.md §15.15`। নিচের §১-এর বিস্তারিত অংশও দ্রষ্টব্য — Phase B/C (SSLCommerz/bKash merchant gateway) এখনো বাকি।

Last updated: 2026-08-17 — এই ফাইলের status টেবিল অনেকদিন sync হয়নি, বড় আপডেট: Tracking Platform (T1-T7, `tracking_capi_context.md`) এবং Per-seller সাবডোমেইন (D1-D5, `custom_domain_context.md`) দুটোই এখন **✅ সম্পূর্ণ**, আগে "planning/design done" লেখা ছিল যেটা এখন ভুল। WordPress/WooCommerce Connector-এর জন্য নতুন row যোগ হলো (২০ ফেজ, ✅ সম্পূর্ণ, আগে এই টেবিলেই ছিল না)। Custom domain (landing pages, #৬)-এর অর্ধেক (per-seller subdomain অংশ) এখন সম্পূর্ণ — বাকি শুধু সেলারের নিজস্ব ডোমেইন (T8b)।

Last updated: 2026-08-10 — প্রাথমিক তালিকা তৈরি। **Staff/Team sub-account role (Phase 1+2, সব মডিউল) সম্পূর্ণ শেষ** — বিস্তারিত `staff_team_role_context.md`, নিচের status টেবিলে আপডেট করা হয়েছে। নিচের বাকি আইটেমগুলোর কোনোটাতে এখনো কাজ শুরু হয়নি।

---

## অবস্থা ট্র্যাকিং

| # | ফিচার | স্ট্যাটাস | ডিটেইল ফাইল |
|---|---|---|---|
| — | **Staff/Team sub-account role** | ✅ **সম্পন্ন** (Phase 1 + Phase 2, সব মডিউল কভার করা হয়েছে, deployed+verified) | `staff_team_role_context.md` |
| 1 | চেকআউটে অনলাইন পেমেন্ট কালেকশন | ✅ সম্পূর্ণ — Phase A (personal wallet) + Phase B/C-এর পরিকল্পিত সবগুলো (৭টা) automated gateway (SSLCommerz, AamarPay, ZiniPay, ShurjoPay, EPS, bKash Merchant, Nagad Merchant) লাইভ (২০২৬-০৮-১৯), landing page ও WooCommerce (`bsol-connect` v1.19.0) দুই জায়গাতেই। Nagad Merchant-এর verify shape unconfirmed — live sandbox test প্রয়োজন | `online_payment_context.md`, `wordpress_connect_context.md §১২` |
| 2 | WhatsApp Business integration | ⬜ Not started | — |
| 3 | Auto-top-up / usage-based billing | ⬜ Not started | — |
| 5 | Courier waybill/label PDF | ✅ সম্পন্ন ও deployed — COD amount বাগ ফিক্স, Pathao-স্টাইল লেবেল, Sticker Template ফিচার (২২টা ডিজাইন, সেলার-সিলেক্টেবল, প্রিভিউ থাম্বনেইল সহ) সম্পূর্ণ, এবং ✅ বাংলা টেক্সট রেন্ডারিং বাগ ফাইনালি সমাধান (real HarfBuzz shaping — সবগুলো ২২টা sticker টেমপ্লেট + order invoice-এ), + Payment History টেবিল (২০২৬-০৮-১৭) | `courier_waybill_context.md` §৪.৭, §৬, §৮.১ |
| — | **Tracking Platform (Facebook CAPI + browser-side, প্যাকেজ-ভিত্তিক ইভেন্ট লিমিট)** | ✅ সম্পন্ন (T1-T7, ২০২৬-০৮-১৬) — পরিকল্পনার সবগুলো ফেজ শেষ, browser Pixel + server CAPI + order-flow ইভেন্ট + quota + event log + admin usage view — লাইভ | `tracking_capi_context.md` |
| — | **Per-seller সাবডোমেইন (ড্যাশবোর্ড + ল্যান্ডিং পেজ, `*.zyrotechbd.com`)** | ✅ সম্পন্ন (D1-D5, ২০২৬-০৮-১৫) — wildcard DNS/TLS/nginx লাইভ, handoff login, reserved-subdomain admin মডিউল, নিরাপত্তা অডিট সম্পন্ন (১ High+২ Medium, সব ফিক্সড) | `custom_domain_context.md`, `domain_security_audit.md` |
| — | **WordPress/WooCommerce Connector (BSOL Connect প্লাগইন)** | ✅ সম্পন্ন (২০ ফেজ, v1.17.0) — order/product sync, courier booking (৫টাই), waybill/invoice PDF, checkout OTP, Facebook CAPI, bulk sync, abandoned checkout, repeat-order block, blacklist block, tracking Pixel — সব লাইভ; বাকি শুধু real WooCommerce staging QA (ব্যবহারকারীর নিজের সাইটে) | `wordpress_connect_context.md` |
| 6 | Custom domain সাপোর্ট (landing pages) | 🟡 আংশিক — per-seller সাবডোমেইন অংশ ✅ সম্পন্ন (উপরে); সেলারের **নিজস্ব** ডোমেইন (T8b, `custom_domain_context.md §11` আইটেম ৩) এখনো শুরু হয়নি | `custom_domain_context.md` |
| 7 | Marketing broadcast campaign (CRM-segment টার্গেটেড) | ⬜ Not started | — |
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

### 2. WhatsApp Business integration
Facebook Messenger lead-capture-এর architecture (webhook + phone auto-link, `FacebookLeadCaptureService`) প্রায় হুবহু reuse করা যাবে। Order confirm/broadcast/CRM follow-up চ্যানেল হিসেবে দ্রুত বাড়ছে বাংলাদেশে।
**শুরুর পয়েন্ট:** WhatsApp Cloud API credential (Meta Business), নতুন `WhatsappMessageService` — `FacebookGraphClient`-এর প্যাটার্ন অনুসরণ করে।

### 3. Auto-top-up / usage-based billing (নিজের রেভিনিউ optimize)
SMS credit ও subscription infra দুটোই এখন self-service (`SmsCreditPurchaseController`, subscription bKash gateway)। Balance কমে গেলে auto-recharge (saved bKash token দিয়ে) — প্রায় বিনামূল্যে upsell, infra সব আছে।
**শুরুর পয়েন্ট:** `SmsCreditSetting`-এ auto-recharge threshold/amount ফিল্ড + saved-payment-method concept (নতুন — bKash-এ card/token সেভ করার সুবিধা যাচাই করতে হবে)।

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

Staff/Team sub-account role (`staff_team_role_context.md`) শেষ হওয়ার পর, উপরের তালিকা থেকে user-এর সাথে confirm করে পরবর্তী আইটেম বেছে নিতে হবে — recommended order: **#1 (checkout payment) → #3 (auto-top-up) → #2 (WhatsApp)**, কারণ এই তিনটাই সরাসরি core problem/revenue hit করে এবং existing bKash/webhook pattern-এর উপর অল্প কাজে বসানো যায়।
