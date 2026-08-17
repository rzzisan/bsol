# Customer-Facing Online Payment — Context

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
