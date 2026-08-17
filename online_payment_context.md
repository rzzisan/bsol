# Customer-Facing Online Payment — Context

শেষ আপডেট: 2026-08-17 (২) — Phase A লাইভ টেস্ট করার পর ব্যবহারকারীর ৩টা রিয়েল-ওয়ার্ল্ড ফিডব্যাক অনুযায়ী রিফাইনমেন্ট: (১) OTP এখন শুধু COD-তে সক্রিয়, অনলাইন পেমেন্ট বেছে নিলে OTP আর লাগে না — বদলে অর্ডার লিস্টে "পেমেন্ট বাকি" ফ্ল্যাগ দেখায়, (২) অ্যাপ্রুভ করার সময় সেলার নিজে হাতে amount বসায় (কাস্টমারের claim অন্ধভাবে বিশ্বাস করা হয় না), (৩) প্রতিটা ল্যান্ডিং পেজে আলাদাভাবে কোন পেমেন্ট চ্যানেল দেখাবে তা সিলেক্ট করা যায় (আগে পুরো শপ-ওয়াইড ছিল)। দেখো নিচে §৫। Older entries kept as-is:

শেষ আপডেট: 2026-08-17 — Phase A (`wallet_manual`) সম্পন্ন, deploy করা হয়েছে (migrations + backend + frontend live)।

## ১. এই ফিচারটা কী

কাস্টমার ল্যান্ডিং পেজ চেকআউটে সরাসরি অনলাইনে পেমেন্ট করতে পারবে — এতদিন শুধু COD ছিল। bKash/Nagad/Rocket subscription billing (seller → platform ফি) থেকে সম্পূর্ণ আলাদা মডিউল এটা — এটা কাস্টমার → seller পেমেন্ট।

**ব্যবসায়িক সিদ্ধান্ত**: বাংলাদেশের ছোট/নতুন F-commerce সেলারদের বেশিরভাগেরই মার্চেন্ট একাউন্ট নেই — শুধু পার্সোনাল বিকাশ/নগদ/রকেট নম্বর আছে। তাই **Phase A প্রথমে personal-wallet "send & verify" ফ্লো** শিপ করা হয়েছে (মার্চেন্ট একাউন্ট লাগে না)। সত্যিকারের automated gateway (SSLCommerz, bKash Merchant) পরের ফেজে (B/C) — যাদের মার্চেন্ট একাউন্ট আছে তাদের জন্য।

## ২. Phase A — Wallet Manual (✅ DONE, লাইভ)

### ফ্লো
1. সেলার Dashboard → Settings → Online Payment Channels-এ গিয়ে bKash/Nagad/Rocket চালু করে নিজের পার্সোনাল নম্বর দেয়।
2. কাস্টমার checkout-এ সেই চ্যানেল বেছে নেয় — অর্ডার আগের মতোই তৈরি হয় (status=pending, payment_status=due)।
3. Thank-you পেজে একটা কার্ড দেখায়: "এই নম্বরে টাকা পাঠান, তারপর TrxID দিন।" কাস্টমার নিজের অ্যাপ দিয়ে টাকা পাঠিয়ে sender_number + customer_trx_id (+ঐচ্ছিক স্ক্রিনশট) সাবমিট করে।
4. একটা `order_online_payments` row তৈরি হয় status=`awaiting_verification`।
5. সেলার Dashboard → Accounting → Online Payment Verification-এ গিয়ে অ্যাপ্রুভ/রিজেক্ট করে।
6. অ্যাপ্রুভ করলে: `order_payments` row তৈরি (source=`online_wallet`), `Transaction` (category=`order_online_payment`), `payment_status` রিক্যালকুলেট, আর অর্ডার এখনো `pending` থাকলে `confirmed`-এ অটো-ট্রানজিশন (ঠিক ম্যানুয়াল পেমেন্টের মতোই)।

### Data model
- **`payment_gateway_settings`** — এক সেলারের এক row (`CourierSetting`-এর প্যাটার্ন কপি) — `{provider}_personal_enabled`/`{provider}_personal_number` কলাম bkash/nagad/rocket-এর জন্য। SSLCommerz/bKash-gateway কলামও আছে কিন্তু Phase B/C পর্যন্ত অব্যবহৃত।
- **`order_online_payments`** — প্রতিটা পেমেন্ট-অ্যাটেম্পটের raw/technical row (provider, sender_number, customer_trx_id, screenshot_path, status, verified_by/at, order_payment_id লিংক)। Unique index: একই seller-এর জন্য একই `customer_trx_id` দুবার claim করা যাবে না (anti-replay)।
- **`order_payments.source`** — নতুন কলাম (`manual`|`online_wallet`|`online_gateway`, ডিফল্ট `manual`)। `CollectionHistoryController` এই কলাম দিয়েই Collection History-তে সব উৎস দেখায় (আলাদা UNION branch লাগেনি)।

### Backend files
- `App\Models\PaymentGatewaySetting`, `App\Models\OrderOnlinePayment`
- `App\Services\OnlinePaymentService` — `getEnabledWalletChannels()`, `submitWalletClaim()`, `verifyWalletClaim()`
- `App\Http\Controllers\Api\PaymentGatewaySettingController` — সেলার সেটিংস CRUD
- `App\Http\Controllers\Api\OnlinePaymentController` — public channels/claim-submit + dashboard pending-list/verify
- `AccountingService::recordManualPayment()` — `?string $category = null` প্যারাম যোগ হয়েছে, online path `order_online_payment` পাস করে
- Routes: `GET/PUT /payment-gateway-settings`, `GET /online-payments/pending-verification`, `POST /online-payments/{id}/verify` (নতুন `staff_permission:payments` group); public `GET /public/landing-pages/{slug}/payment-channels`, `POST .../orders/{orderId}/online-payment/wallet-claim`

### Frontend files
- `dashboard/settings/payments/page.tsx` — চ্যানেল চালু/বন্ধ + নম্বর সেটিং (owner-only, `settings` মেনু গ্রুপে)
- `dashboard/accounting/online-payments/page.tsx` — পেন্ডিং claim ভেরিফাই (staff `payments` পারমিশনে অ্যাক্সেসযোগ্য)
- `public-landing-page-view.tsx` — চেকআউটে dynamic wallet-channel selector (আগে hardcoded "Coming soon" ছিল), `payment_method` এখন সাবমিট পেলোডে যায়
- `thank-you-view.tsx` — নতুন `WalletClaimCard`, TrxID সাবমিট ফর্ম

### সিদ্ধান্তসমূহ (design decisions)
- Subscription billing-এর bKash কোড (`BkashPaymentGatewayClient`, `PlatformBillingSetting` ইত্যাদি) **একদম টাচ করা হয়নি** — platform-wide singleton creds বনাম per-seller creds-এর mismatch, আর revenue-critical লাইভ ফ্লো ভাঙার ঝুঁকি এড়াতে সম্পূর্ণ আলাদা নতুন ক্লাস।
- `orders.payment_status` (due/partial/paid)-এর জন্য কোনো প্যারালাল ট্র্যাকিং তৈরি হয়নি — এখনো পুরোপুরি বিদ্যমান `AccountingService::syncPaymentStatus()` চালায়, `order_payments`-এর ওপর নির্ভর করে।
- Wallet-claim স্ক্রিনশট **ঐচ্ছিক** (সেলার ড্যাশবোর্ডের ম্যানুয়াল কালেকশনের মতো বাধ্যতামূলক না) — পাবলিক unauthenticated কাস্টমার ফোন থেকে ফাইল আপলোডে বেশি friction থাকতে পারে ধরে নিয়ে।

## ৩. Phase B/C — পরের ফেজ (⬜ শুরু হয়নি)

- **Phase B**: `App\Contracts\PaymentGatewayClient` ইন্টারফেস + `SslcommerzGatewayClient` + gateway routes/callback (query-then-trust val_id validation)।
- **Phase C**: `BkashGatewayClient` (per-seller merchant/PGW ক্রেডেনশিয়াল, subscription billing-এর ক্লাস থেকে সম্পূর্ণ আলাদা)।

`payment_gateway_settings` টেবিলে ইতিমধ্যে `sslcommerz_*`/`bkash_gateway_*` কলাম আছে (Phase A migration-এই যোগ হয়েছিল যাতে পরে আবার টেবিল টাচ করতে না হয়) — শুধু client + controller + route যোগ করতে হবে।

## ৪. Test coverage

`PaymentGatewaySettingApiTest`, `OnlinePaymentWalletClaimTest`, `CollectionHistoryApiTest` (সোর্স-ট্যাগিং কভারেজ যোগ)। Full suite ২ পুরনো unrelated baseline failure (AuthApiTest, CourierFraudCheckApiTest) বাদে সব পাস।

## ৫. Phase A রিফাইনমেন্ট (লাইভ টেস্টিং ফিডব্যাক, ২০২৬-০৮-১৭)

Phase A প্রথমবার production-এ টেস্ট করার পর ব্যবহারকারীর ৩টা সরাসরি observation থেকে এই তিনটা ফিক্স এসেছে।

### ৫.১ OTP শুধু COD-তে সক্রিয়
আগে landing page-এর `otp_verification_enabled` সেটিং সব অর্ডারে (payment_method নির্বিশেষে) OTP পাঠাতো। এখন `LandingPageController::publicSubmitOrder()` শুধু `payment_method === 'cod'` হলেই `CheckoutOtpService::maybeSendForOrder()` কল করে — যুক্তি: অনলাইন পেমেন্ট বেছে নেওয়া কাস্টমার নিজেই real money পাঠিয়ে + TrxID সাবমিট করে যথেষ্ট intent প্রমাণ করে, দ্বিতীয় ভেরিফিকেশন গেট লাগে না।

এর ফলে যে গ্যাপ তৈরি হতে পারত (কাস্টমার পেমেন্ট চ্যানেল বেছেছে কিন্তু আসলে টাকা পাঠায়নি) — সেটা ঢাকা হয়েছে অর্ডার লিস্টের নতুন ফ্ল্যাগ দিয়ে (নিচে ৫.২)। অর্ডারটা `pending`-এই থেকে যায় যতক্ষণ না ভেরিফাই হয় — নতুন কোনো auto-cancel/expire লজিক যোগ করা হয়নি, সেলার নিজে ফলো-আপ করবে।

### ৫.২ অর্ডার লিস্টে "পেমেন্ট বাকি" ফ্ল্যাগ
`dashboard/orders/page.tsx` — যেকোনো অর্ডারের `payment_method` bkash/nagad/rocket হলে আর `payment_status !== 'paid'` হলে status pill-এর পাশে একটা amber ব্যাজ দেখায় (`bKash ⏳` স্টাইলে) — সেলার এক নজরে বুঝবে কোন অর্ডারগুলোতে কাস্টমার পেমেন্ট চ্যানেল বেছেছে কিন্তু এখনো ভেরিফাই হয়নি।

### ৫.৩ Approve-এর সময় সেলার নিজে amount বসায়
আগে approve করলে claim-এ কাস্টমারের নিজের বলা amount সরাসরি `OrderPayment`-এ বসতো — কিন্তু কাস্টমার ভুল amount পাঠাতে পারে বা কম/বেশি পাঠাতে পারে। এখন:
- `OnlinePaymentService::verifyWalletClaim()` একটা `?float $amount` প্যারাম নেয় — approve করলে required, claim-এর amount-কে trust করে না।
- `OnlinePaymentController::verify()` — `amount` required_if `approve=true`।
- Frontend (`dashboard/accounting/online-payments/page.tsx`) — প্রতিটা claim row-এ একটা এডিটেবল amount input, কাস্টমারের claim দিয়ে pre-fill করা কিন্তু সেলার বদলাতে পারে; নিচে ছোট টেক্সটে কাস্টমারের আসল claim দেখায় (রেফারেন্সের জন্য)।
- `OrderPayment.note`-এ claim ও confirmed amount আলাদা হলে দুটোই লেখা থাকে audit trail-এর জন্য।

### ৫.৪ প্রতি ল্যান্ডিং পেজে আলাদা পেমেন্ট চ্যানেল সিলেকশন
আগে সব ল্যান্ডিং পেজে শপ-ওয়াইড যা যা চ্যানেল চালু (`payment_gateway_settings`) সব দেখাতো, পেজ-লেভেলে filter করার উপায় ছিল না। এখন:
- `LandingPage.content.settings.payment_channels` — নতুন optional field, `string[] | null`। `null` (ডিফল্ট, পুরনো পেজেও) মানে "শপ যা যা চালু করেছে সব দেখাও" (backward compatible)। একটা array মানে সেই সাবসেটই (এমনকি `'cod'`-ও এই লিস্টে থাকতে হবে যদি COD দেখাতে হয়)।
- `OnlinePaymentController::publicChannels()` — শপ-ওয়াইড enabled চ্যানেল বের করে, তারপর পেজের `payment_channels` সেট থাকলে সেটা দিয়ে narrow করে; রেসপন্সে নতুন `cod_enabled: boolean` ফিল্ড যোগ হয়েছে।
- `landing-page-builder.tsx` — Settings ট্যাবে নতুন "Payment Methods" কার্ড: "এই পেজের জন্য নির্দিষ্ট পেমেন্ট পদ্ধতি বেছে নিন" চেকবক্স বন্ধ থাকলে কিছুই সেভ হয় না (null থাকে); চালু করলে COD + শপ-এ যা যা wallet channel চালু আছে (নতুন `GET /payment-gateway-settings` কল করে) তার চেকবক্স লিস্ট দেখায়, সব ডিফল্ট-চেকড।
- `public-landing-page-view.tsx` — checkout selector `cod_enabled=false` হলে COD radio লুকায়, প্রথম উপলব্ধ wallet channel-কে ডিফল্ট বানায়।

**সিদ্ধান্ত**: order-submit ভ্যালিডেশন (`payment_method: cod,bkash,nagad,rocket`) পেজ-লেভেল সাবসেটের বিপরীতে strict enforce করা হয়নি — একটা customer URL manipulate করে seller-এর নিজের enable-করা অন্য কোনো চ্যানেল বেছে নিলেও সেটা নিছক UX অসঙ্গতি (সেলার এমন একটা চ্যানেলের instructions দেখাবে যেটা এই পেজে advertise করেনি), নিরাপত্তা ঝুঁকি না — তাই backend-এ আলাদা enforcement যোগ করা হয়নি, scope সীমিত রাখা হয়েছে।
