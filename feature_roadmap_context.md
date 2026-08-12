# SaaS ফিচার/মডিউল রোডম্যাপ — Business Growth Recommendations

এই ফাইলে ২০২৬-০৮-১০ তারিখে করা সম্পূর্ণ SaaS প্রজেক্ট অডিট (মডিউল/ফিচার অ্যানালাইসিস) থেকে পাওয়া সব সুপারিশ তালিকাবদ্ধ আছে, যাতে **"4. Staff/Team sub-account role"** (এখন সক্রিয় কাজ, বিস্তারিত `staff_team_role_context.md`-এ) শেষ হওয়ার পর বাকি সুপারিশগুলো সহজে রেফারেন্স করা যায় এবং পরবর্তী কাজ বেছে নেওয়া যায়।

Master context: `CONTEXT.md` (server/ops), `SAAS_MODULE_CONTEXT.md` (§15 ground-truth audit, §16 আগের প্রায়োরিটি লিস্ট — এই ফাইলের সাথে ওভারল্যাপ আছে, এই ফাইলটা business/commercial angle-এ বেশি ফোকাসড এবং নতুন কিছু আইটেমও যোগ করে)।

> **🚨 এই তালিকা থেকে যেকোনো নতুন আইটেমে কাজ শুরু করার আগে বাধ্যতামূলক:** CONTEXT.md §৩১ এবং `staff_team_role_context.md` পড়ো এবং সেই ফিচারটা Staff/Team role-aware ভাবে ডিজাইন/implement করো — নতুন কোনো resource তৈরি করলে সেটা Pattern A (team-shared, `whereIn(shopUserIds())`) না Pattern B (owner-only, `shopOwnerId()`) সেই সিদ্ধান্ত প্রথমেই নিতে হবে, প্রয়োজনে নতুন `StaffPermission::MODULE_KEYS` entry ও route middleware যোগ করতে হবে। এটা এখন optional না, প্রতিটা নতুন module-এর জন্য mandatory চেকলিস্ট।

Last updated: 2026-08-10 — প্রাথমিক তালিকা তৈরি। **Staff/Team sub-account role (Phase 1+2, সব মডিউল) সম্পূর্ণ শেষ** — বিস্তারিত `staff_team_role_context.md`, নিচের status টেবিলে আপডেট করা হয়েছে। নিচের বাকি আইটেমগুলোর কোনোটাতে এখনো কাজ শুরু হয়নি।

---

## অবস্থা ট্র্যাকিং

| # | ফিচার | স্ট্যাটাস | ডিটেইল ফাইল |
|---|---|---|---|
| — | **Staff/Team sub-account role** | ✅ **সম্পন্ন** (Phase 1 + Phase 2, সব মডিউল কভার করা হয়েছে, deployed+verified) | `staff_team_role_context.md` |
| 1 | চেকআউটে অনলাইন পেমেন্ট কালেকশন | ⬜ Not started | — |
| 2 | WhatsApp Business integration | ⬜ Not started | — |
| 3 | Auto-top-up / usage-based billing | ⬜ Not started | — |
| 5 | Courier waybill/label PDF | ✅ সম্পন্ন ও deployed — COD amount বাগ ফিক্স, Pathao-স্টাইল লেবেল, Sticker Template ফিচার (২২টা ডিজাইন, সেলার-সিলেক্টেবল, প্রিভিউ থাম্বনেইল সহ) সম্পূর্ণ। তবে ⚠️ একটা বাংলা matra-rendering বাগ এখনো OPEN (ডিফার করা হয়েছে) | `courier_waybill_context.md` §৪.৫, §৬ |
| 6 | Custom domain সাপোর্ট (landing pages) | ⬜ Not started | — |
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

### 1. চেকআউটে অনলাইন পেমেন্ট কালেকশন (সর্বোচ্চ priority)
প্রোডাক্ট ভিশনের মূল সমস্যা "৩০-৫০% ফেক/অনুপস্থিত অর্ডার"-এর সবচেয়ে সরাসরি সমাধান — advance/partial payment checkout-এ নেওয়া (এখন সব COD, `payment_method: bkash/online` শুধু লেবেল, কোনো charge/callback হয় না — `SAAS_MODULE_CONTEXT.md §15.8`)। bKash Tokenized/PGW client + OTP verification flow ইতিমধ্যে subscription billing-এ verified প্যাটার্ন হিসেবে আছে (`app/Services/Bkash*`, `BkashPaymentController`, `BkashPgwPaymentController`) — landing page checkout-এ reuse করা তুলনামূলক কম effort।
**শুরুর পয়েন্ট:** `LandingPageOrderService::create()` + নতুন gateway controller (subscription billing-এর প্যাটার্ন কপি), `landing_pages.content.settings`-এ payment-mode toggle।

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

### 6. Custom domain সাপোর্ট (landing pages)
এখন সব পেজ platform সাবডোমেইনে। নিজের domain কানেক্ট করার সুবিধা — premium-tier subscription-এর জন্য শক্তিশালী upsell reason (ব্র্যান্ডিং চাওয়া বড় সেলাররা higher-tier প্যাকেজ কিনবে)।
**শুরুর পয়েন্ট:** DNS CNAME verification flow + nginx/certbot automation (server-level কাজ, `CONTEXT.md`-এর nginx/SSL সেকশন রেফারেন্স করতে হবে) — এটা তুলনামূলক বড় ops স্কোপ, অন্যগুলোর চেয়ে ভিন্ন ধরনের কাজ।

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
