# Customer-Facing Online Payment — Context

শেষ আপডেট: 2026-08-19 — **সিকিউরিটি রিভিউ ফিক্স (B2/B3 AamarPay/ZiniPay/ShurjoPay কোড, অন্য একটা AI agent দিয়ে করানো হয়েছিল)।** দুইটা আসল বাগ পাওয়া গেছে ও ফিক্স করা হয়েছে:
1. **`ZinipayGatewayClient::verifyPayment()`** callback query string থেকে আসা `invoice_id` (কাস্টমার-controllable) দিয়ে ভেরিফাই করত, আর tampering guard (`metadata.merchant_tran_id` match) conditional ছিল (`isset` না থাকলে skip) — ফলে একই সেলারের কোনো real completed invoice (নিজের ছোট আরেকটা অর্ডারের) replay করে অন্য একটা বড় অর্ডারের callback URL-এ বসিয়ে দিলে সেটাও ভেরিফাই পাস করে confirmed হয়ে যেত। **ফিক্স**: verify সবসময় আমাদের নিজের stored `provider_payment_id` (ZiniPay-র createPayment() রেসপন্স থেকে initiate-এর সময় capture করা, কাস্টমার-influenced না) দিয়ে হয় — callback-এর `invoice_id` আর trust করা হয় না, metadata match এখন শুধু belt-and-suspenders।
2. **`OnlinePaymentController::gatewayIpn()`**-এর candidate-id list-এ ShurjoPay-র নিজের `order_id`/`sp_order_id` ফিল্ড ছিল না (শুধু SSLCommerz/AamarPay/ZiniPay-এর ফিল্ড নাম ছিল) — ফলে ShurjoPay-র server-to-server IPN কখনো claim resolve করতে পারত না (404), শুধু browser-redirect leg-ই কাজ করত। **ফিক্স**: candidate list-এ `order_id`/`sp_order_id` যোগ করা হয়েছে।

দুটোরই regression test যোগ হয়েছে (`test_zinipay_callback_cannot_be_spoofed_with_a_different_completed_invoice_id`, `test_shurjopay_ipn_resolves_claim_by_order_id`)। Full suite: বেসলাইনের ২টা unrelated failure (AuthApiTest, CourierFraudCheckApiTest) ছাড়া সব পাস। Older entries kept as-is:

শেষ আপডেট: 2026-08-18 (৩) — **Phase B3 লাইভ: ShurjoPay automated gateway ইন্টিগ্রেশন সম্পন্ন।** `ShurjopayGatewayClient` (Bearer token auth via `/get_token` + `/secret-pay` + `/verification` server verification) `PaymentGatewayFactory`-তে রেজিস্টার করা হয়েছে। ড্যাশবোর্ডে (`Settings → Online Payment Channels`) ShurjoPay (Username, Password, Prefix)-এর জন্য ক্রেডেনশিয়াল ফর্ম লাইভ। বিস্তারিত নিচে §৮। Older entries kept as-is:

শেষ আপডেট: 2026-08-18 (২) — **Phase B2 লাইভ: AamarPay ও ZiniPay automated gateway ইন্টিগ্রেশন সম্পন্ন।** `AamarpayGatewayClient` (JSON API + `/api/v1/trxcheck` server verification) এবং `ZinipayGatewayClient` (v1 create + `v1/payment/verify` server verification) `PaymentGatewayFactory`-তে রেজিস্টার করা হয়েছে। ড্যাশবোর্ডে (`Settings → Online Payment Channels`) AamarPay (Store ID, Signature Key) ও ZiniPay (API Key)-এর জন্য ক্রেডেনশিয়াল ফর্ম লাইভ। বিস্তারিত নিচে §৬ ও §৭। Older entries kept as-is:

শেষ আপডেট: 2026-08-18 — **Phase B1 লাইভ: SSLCommerz automated gateway (মার্চেন্ট একাউন্ট) + provider-abstraction ফাউন্ডেশন।** কাস্টমার এখন চেকআউটে SSLCommerz দিয়ে সরাসরি অটোমেটিক পে করতে পারবে (redirect → hosted checkout → query-then-trust verify → auto-confirm), সেলার নিজের মার্চেন্ট ক্রেডেনশিয়াল বসায় Dashboard → Settings → Online Payment Channels-এর নতুন "Automatic Payment Gateways" সেকশনে। নতুন `payment_gateway_credentials` টেবিল (প্রতি সেলার-প্রতি-provider এক row, `credentials` JSON blob encrypted) — AamarPay/ZiniPay/ShurjoPay/EPS/bKash Merchant/Nagad Merchant একই abstraction-এ যোগ হবে ধাপে ধাপে। বিস্তারিত নিচে §৬। Older entries kept as-is:

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

## ৩. Phase B/C — automated merchant gateways (🟡 আংশিক, B1 লাইভ — বিস্তারিত §৬)

Phase A-এর মূল রুক্ষ sketch এখানে ছিল (শুধু SSLCommerz + bKash উল্লেখ ছিল) — বাস্তব কাজ শুরুর আগে ব্যবহারকারী পুরো তালিকা কনফার্ম করেছেন: **SSLCommerz, ShurjoPay, EPS, ZiniPay, AamarPay, bKash Merchant, Nagad Merchant** — সেলার যেটা সুবিধা মনে করে সেটাই চালু করবে, একাধিক গেটওয়ে একসাথে চালু রাখা যাবে। বিস্তারিত ডিজাইন ও build-order §৬-এ।

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

## ৬. Phase B — Automated Merchant Gateways (২০২৬-০৮-১৮)

### ৬.১ ফ্লো (SSLCommerz দিয়ে, বাকি providers একই abstraction ব্যবহার করবে)
1. সেলার Dashboard → Settings → Online Payment Channels-এর "Automatic Payment Gateways" সেকশনে গিয়ে SSLCommerz-এর Store ID/Password বসিয়ে চালু করে (Live/Sandbox টগল সহ)।
2. কাস্টমার checkout-এ SSLCommerz বেছে নেয় — অর্ডার তৈরি হয় (payment_method=sslcommerz), তারপর ব্রাউজার SSLCommerz-এর hosted checkout পেজে redirect হয়ে যায় (order create-এর ঠিক পরপরই, thank-you পেজে না গিয়ে)।
3. কাস্টমার SSLCommerz-এর পেজে পে করে — SSLCommerz আমাদের callback URL-এ redirect করে ফেরত পাঠায় (+ আলাদাভাবে IPN-ও পাঠাতে পারে)।
4. Callback/IPN হ্যান্ডলার **কখনোই redirect-এর নিজের `status` প্যারামিটার বিশ্বাস করে না** — সবসময় SSLCommerz-এর নিজস্ব সার্ভার-টু-সার্ভার Order Validation API কল করে `val_id` দিয়ে confirm করে (query-then-trust, ঠিক bKash subscription callback-এর মতোই)।
5. ভ্যালিড হলে: `order_payments` row (source=`online_gateway`), `Transaction`, payment_status রিক্যালকুলেট, অর্ডার `confirmed`-এ অটো-ট্রানজিশন — Phase A-এর wallet-verify cascade-ই reuse হয় (`OnlinePaymentService::applyConfirmedPayment()`)।
6. কাস্টমারকে seller-এর নিজের thank-you পেজে ফেরত পাঠানো হয় `?payment_result=success|failed` সহ (সেলার-ফেসিং সাবস্ক্রিপশন পেজের `?bkash_status=` প্যাটার্নের মতোই)।

### ৬.২ Data model
- **`payment_gateway_credentials`** — নতুন normalized টেবিল, প্রতি সেলার-প্রতি-provider এক row (`user_id`, `provider`, `enabled`, `is_live`, `credentials` — encrypted:array JSON blob)। Phase A-তে `payment_gateway_settings`-এ যোগ করা `sslcommerz_*`/`bkash_gateway_*` কলামগুলো আর ব্যবহৃত হচ্ছে না (deprecated, কখনো কিছু লেখা হয়নি বলে মুছে ফেলার দরকারও নেই) — সাতটা provider-এর ভিন্ন ভিন্ন credential shape (store_id+password, single API key, RSA keypair) একটা fixed column set-এ আর মানানো যাচ্ছিল না।
- `order_online_payments` টেবিলে কোনো migration লাগেনি — Phase A-তেই `provider_payment_id`/`provider_trx_id`/`gateway_response` কলাম যথেষ্ট generic ছিল।

### ৬.৩ Provider abstraction
- `App\Contracts\PaymentGatewayClient` — `isConfigured()`, `createPayment()`, `verifyPayment()`। SSLCommerz, AamarPay, ZiniPay, ShurjoPay, EPS — সবগুলোই এই একই তিন-ধাপের প্যাটার্নে মানানসই (create session → redirect → server-side verify)। শুধু bKash Merchant-এর নিজস্ব bKash API shape (ইতিমধ্যে subscription billing-এ প্রমাণিত), আর Nagad Merchant সম্পূর্ণ আলাদা (RSA-signed payload, plain form POST না) — কিন্তু দুটোই একই ইন্টারফেসের ভেতরেই ফিট করবে, শুধু ক্লাসের ভেতরের ইমপ্লিমেন্টেশন আলাদা হবে।
- `App\Services\Payment\PaymentGatewayFactory` — `CourierFactory`-এর প্যাটার্ন কপি, এখন শুধু `sslcommerz` ম্যাপড।
- `App\Services\Payment\Gateways\SslcommerzGatewayClient` — রেফারেন্স ইমপ্লিমেন্টেশন। Amount-tampering guard: verify response-এর নিজস্ব `tran_id` আমাদের merchantTranId-এর সাথে না মিললে reject করে।
- `OnlinePaymentService` (Phase A ক্লাসেই এক্সটেন্ড করা হয়েছে, নতুন ক্লাস তৈরি হয়নি): `applyConfirmedPayment()` (verifyWalletClaim-এর approve ব্র্যাঞ্চ থেকে extract করা shared cascade), `getEnabledGatewayChannels()`, `initiateGateway()`, `completeGatewayCallback()`।

### ৬.৩.১ ফিক্স (২০২৬-০৮-১৮, লাইভ টেস্টিং ফিডব্যাক)
প্রথম দিকে landing page-এর per-page "Payment Methods" সিলেক্টরে (§৫.৪) শুধু COD + wallet channel-এর চেকবক্স ছিল — gateway channel (SSLCommerz) সিলেক্ট করার কোনো উপায়ই ছিল না, অথচ `publicChannels()`-এর `gateway_channels` সবসময় শপ-ওয়াইড দেখাতো (page-level filter মানতো না)। এখন দুটোই সিমেট্রিক্যাল:
- `OnlinePaymentController::publicChannels()` — `payment_channels` সেটিং এখন `wallet_channels`-এর মতোই `gateway_channels`ও narrow করে।
- `landing-page-builder.tsx` — Payment Methods কার্ডে নতুন "Automatic Payment Gateways" সাব-সেকশন, শপে যা যা গেটওয়ে enabled (নতুন `GET /payment-gateway-credentials` কল) তার চেকবক্স দেখায়, একই `payment_channels` array-তে যোগ হয়।

### ৬.৪ Routes
- Public: `POST /public/landing-pages/{slug}/orders/{orderId}/online-payment/gateway/initiate` (token-guarded)।
- Top-level (slug-scoped না, provider শুধু URL-টাই জানে): `GET|POST /online-payment/{provider}/callback/{id}` (browser redirect, আমাদের নিজের claim id path-এ embedded — provider_payment_id lookup লাগে না), `POST /online-payment/{provider}/ipn` (server-to-server, কিছু provider merchant-panel-এ একবারই সেট করে বলে path param থাকে না — payload-এর নিজস্ব ফিল্ড (tran_id/val_id/invoice_id/mer_txnid) দিয়ে `provider_payment_id` ম্যাচ করে claim খুঁজে বের করে)।
- Dashboard: `GET/PUT /payment-gateway-credentials[/{provider}]` (`staff_permission:payments` group-এই, Phase A-এর সাথে একসাথে)।

### ৬.৫ Frontend
- `dashboard/settings/payments/page.tsx` — নতুন "Automatic Payment Gateways" সেকশন, প্রতি-provider field-schema constant দিয়ে চালিত (এখন শুধু SSLCommerz-এর ফর্ম আছে, বাকিগুলো "শীঘ্রই আসছে" ব্যাজ দেখায় যতক্ষণ না backend+frontend দুই দিকেই সাপোর্ট যোগ হয়)।
- `public-landing-page-view.tsx` — checkout selector-এ gateway চ্যানেল যোগ (একই radio group-এ wallet চ্যানেলের পাশে), সিলেক্ট করলে অর্ডার তৈরির পর সরাসরি `gateway/initiate` কল করে `window.location.href` দিয়ে পুরো পেজ redirect করে (thank-you-তে না গিয়ে)।
- `thank-you-view.tsx` — `?payment_result=success|failed` পড়ে success/failed banner দেখায়।
- `dashboard/orders/page.tsx` — "পেমেন্ট বাকি" ব্যাজ এখন যেকোনো non-cod `payment_method`-এর জন্য কাজ করে (আগে শুধু bkash/nagad/rocket hardcoded ছিল)।

### ৬.৬ Build order বাকি
- **B2**: AamarPay + ZiniPay (✅ সম্পন্ন — ২০২৬-০৮-১৮)।
- **B3**: ShurjoPay (✅ সম্পন্ন — ২০২৬-০৮-১৮) + EPS (পরবর্তী)।
- **C1**: bKash Merchant (subscription billing-এর ক্লায়েন্ট শেপ reuse, per-seller credentialed নতুন sibling class)।
- **C2**: Nagad Merchant (RSA-signed payload, সবচেয়ে আলাদা — শেষে, বাস্তব merchant sandbox credentials লাগবে)।

### ৬.৭ Test coverage
`OnlinePaymentGatewayTest` (১৩টা: channel listing, misconfigured-credential exclusion, initiate, callback-success-cascade, callback-without-val_id-not-trusted, duplicate-callback-idempotent, AamarPay initiate+verify, AamarPay tampering rejection, ZiniPay initiate+verify, ZiniPay failure handling, ShurjoPay initiate+verify, ShurjoPay tampering rejection), `PaymentGatewayCredentialApiTest` (৬টা: CRUD, masking, masked-placeholder-না-overwrite, unknown-provider-404, staff permission, SSLCommerz/AamarPay/ZiniPay/ShurjoPay credentials roundtrip)।

## ৭. Phase B2 — AamarPay & ZiniPay Integration (২০২৬-০৮-১৮)

- **`AamarpayGatewayClient`**:
  - Hosted JSON session (`/jsonpost.php`), redirects to `payment_url`.
  - Server-side verification via `/api/v1/trxcheck/request.php` (GET `request_id`, `store_id`, `signature_key`).
  - Strict tampering check: `mer_txnid` matching our minted `merchantTranId`.
- **`ZinipayGatewayClient`**:
  - Unified JSON API (`/v1/payment/create`) with `zini-api-key` header.
  - Server-side verification via `/v1/payment/verify` (`invoiceId`, `apiKey`).
  - Confirms `status === 'COMPLETED'` and returns transaction ID / amount.
- **Frontend Settings**:
  - `GATEWAY_PROVIDERS` updated with AamarPay (`store_id`, `signature_key`) and ZiniPay (`api_key`) fields.

## ৮. Phase B3 — ShurjoPay Integration (২০২৬-০৮-১৮)

- **`ShurjopayGatewayClient`**:
  - Token-based Authentication: `POST /api/get_token` with `username` & `password` to obtain 15-min Bearer token & `store_id`.
  - Session Creation: `POST /api/secret-pay` with token, `prefix`, `order_id` (`merchantTranId`), `amount`, and returns `checkout_url`.
  - Server-to-Server Verification: `POST /api/verification` with `order_id` (`sp_order_id`), confirms `sp_code === 1000` or `status === 'Completed'`.
  - Strict Anti-Tampering Check: Verifies `customer_order_id` in response matches our `merchantTranId`.
- **Frontend Settings**:
  - Tab-based Settings UI updated with ShurjoPay credentials (`username`, `password`, `prefix`) and secure password toggle.


