# SMS Credit Auto-Recharge (Auto-top-up) — Context

শেষ আপডেট: 2026-08-20 — **Phase 1 সম্পূর্ণ: SMS credit auto-recharge লাইভ।** `feature_roadmap_context.md` আইটেম #৩। সেলার একবার একটা bKash Agreement কানেক্ট করে থ্রেশহোল্ড + প্রতিবার কত ক্রেডিট কেনা হবে সেট করে দিলে, ব্যালেন্স ওই থ্রেশহোল্ডের নিচে নামলেই সেভ করা bKash দিয়ে নিজে থেকে রিচার্জ হয়ে যায় — ম্যানুয়াল চেকআউট রিপিট করার দরকার নেই। Subscription auto-renew ইচ্ছাকৃতভাবে এই ফেজে বাদ (user confirm করেছেন — বড় blast radius, পরে দরকার হলে একই `saved_payment_methods` টেবিল দিয়েই বানানো যাবে)।

## ১. কেন

আগে SMS credit ব্যালেন্স শেষ হলে automation (SMS trigger) চুপচাপ থেমে যেত, সেলার নিজে খেয়াল না করলে বুঝতেই পারত না। Manual/bKash one-time checkout (`SmsCreditPurchaseController`, `subscription_billing_context.md §৩`) এখনো আছে, কিন্তু প্রতিবার রিপিট করতে হয়। Auto-recharge এই friction সরায়।

## ২. ⚠️ গুরুত্বপূর্ণ সতর্কতা — bKash Agreement API shape unconfirmed

bKash-এর Tokenized Checkout-এর real "Agreement" (saved-token recurring charge) API-র request/response field shape কোডবেসে **এই প্রথমবার** ব্যবহার হলো — এর আগে `BkashPaymentGatewayClient`/`BkashPgwPaymentGatewayClient` দুটোই শুধু one-time `intent: sale` checkout করত (`mode: "0011"`)। নিচের এন্ডপয়েন্ট/ফিল্ড শেপ bKash-এর পাবলিক ডকুমেন্টেশনের standard create→execute প্যাটার্ন অনুসরণ করে লেখা, কিন্তু **কোনো real bKash sandbox-এ verify করা হয়নি** — ঠিক যেমন `online_payment_context.md §১১`-এ Nagad Merchant-এর `verify()` shape নিয়ে সতর্কতা আছে। **Production-এ কাউকে auto-recharge চালু করতে দেওয়ার আগে একটা real sandbox agreement create→execute→charge round-trip টেস্ট করা প্রয়োজন।**

## ৩. আর্কিটেকচার

**`App\Services\Payment\BkashPaymentGatewayClient`-এ নতুন মেথড** (নতুন ক্লাস না — একই merchant token, একই base URL reuse করে):
- `createAgreement($payerReference, $callbackUrl)` — `POST /tokenized/checkout/create`, `mode: "0000"`, amount ছাড়া (agreement মানে সম্মতি, চার্জ না)। রিটার্ন `{paymentID, bkashURL}`।
- `executeAgreement($paymentId)` — একই `/tokenized/checkout/execute` এন্ডপয়েন্ট one-time flow ব্যবহার করে। রিটার্ন `{agreementID, agreementStatus}`।
- `chargeAgreement($agreementId, $amount, $merchantInvoiceNumber)` — `POST /tokenized/checkout/create` আবার, এবার `agreementID` + `amount` সহ, browser redirect ছাড়াই (server-to-server) — তারপর existing `executePayment()` দিয়েই finalize।
- `cancelAgreement($agreementId)` — `POST /tokenized/checkout/agreement/cancel`।

**নতুন টেবিল `saved_payment_methods`** — `(user_id, provider)` per row, শুধু `bkash` এখন:
```
agreement_id       text, encrypted cast — কখনো API response-এ যায় না
pending_payment_id string, plain — শুধু create→callback windowতে paymentID ধরে রাখে
status             pending | active | cancelled | failed
```
**গুরুত্বপূর্ণ ডিজাইন নোট**: `agreement_id` একটা `encrypted` cast কলাম — Laravel-এর encrypted cast random IV ব্যবহার করে বলে **`where('agreement_id', $value')` দিয়ে কখনো lookup করা যাবে না** (একই plaintext প্রতিবার আলাদা ciphertext দেয়)। তাই callback-এর সময় pending paymentID matching-এর জন্য আলাদা plain `pending_payment_id` কলাম রাখা হয়েছে — শুধু `status='pending'` অবস্থায় ব্যবহৃত হয়, execute সফল হলে null হয়ে যায় আর আসল `agreement_id` (encrypted) সেট হয়।

**Auto-recharge সেটিংস — নতুন settings টেবিল না, বরং `sms_credits` ওয়ালেট রো-তেই নতুন কলাম** (আগে থেকেই এক ইউজারে এক রো, `SmsCredit::walletFor()`):
`auto_recharge_enabled`, `auto_recharge_threshold`, `auto_recharge_credits`, `auto_recharge_failure_count`, `auto_recharge_last_attempted_at`।

**ট্রিগার — `SmsCreditService::deduct()`**: প্রতিটা সফল deduction-এর পর, enabled + balance ≤ threshold + active saved method + ১০ মিনিট cooldown পার হলে `AutoRechargeSmsCreditJob::dispatch()` (queued)। **Fail-open**: এই dispatch শুধু side-effect, `deduct()`-এর নিজের রিটার্ন ভ্যালুকে কখনো প্রভাবিত করে না — যে SMS-টা balance কমিয়েছে সেটা ইতিমধ্যে পাঠানো/deduct হয়ে গেছে, auto-recharge পরে সফল হোক বা না হোক তাতে কিছু যায় আসে না।

**`AutoRechargeSmsCreditJob`** — `tries = 1`, **ইচ্ছাকৃতভাবে কোনো auto-retry নেই**: `chargeAgreement()` প্রতিবার নতুন bKash paymentID বানায়, তাই Laravel job retry করলে (timeout/worker restart) একই ঘাটতির জন্য দ্বিতীয়বার real charge হওয়ার ঝুঁকি থাকে — পরের কোনো SMS পাঠানোর সময় `deduct()`-এর trigger আবার নিজে থেকেই চেষ্টা করবে (cooldown মেনে), সেটাই যথেষ্ট নিরাপদ retry path। প্রতিটা রান fresh অবস্থা re-check করে (balance/enabled/active method আবার manually recharge/disable হয়ে গেলে no-op)। সফল হলে `SmsCreditService::recharge()` + `failure_count` রিসেট + `sms_auto_recharge_success` নোটিফিকেশন। ব্যর্থ হলে `failure_count` increment + `sms_auto_recharge_failed`; **৩ বার consecutive ব্যর্থ হলে** circuit-breaker হিসেবে `auto_recharge_enabled = false` করে দেয় + `sms_auto_recharge_disabled` নোটিফিকেশন — bKash-এর দিক থেকে agreement revoke হয়ে গেলে (যেমন কাস্টমার নিজের bKash অ্যাপ থেকে বাতিল করলে) প্রতি SMS-এই বারবার ব্যর্থ চেষ্টা চলতেই থাকবে না।

**Notification use-case keys**: `NotificationUseCaseBindingController::validatePayload()`-এর `Rule::in([...])` হোয়াইটলিস্টে `sms_auto_recharge_success`/`_failed`/`_disabled` যোগ করা হয়েছে — নাহলে (আগে থেকেই থাকা `subscription_expiry_reminder`-এর মতোই) `NotificationDispatchService::dispatch()` কখনো active binding খুঁজে পাবে না, নোটিফিকেশন চিরকাল silent no-op থাকবে। সেই পুরনো gap ফিক্স করা হয়নি (out of scope), শুধু নতুন key-তে রিপিট করা হয়নি।

## ৪. API সারফেস (`routes/api.php`)

`Sanctum` + `owner_only` middleware group-এ (Pattern B — billing/credential-equivalent, staff-delegable না, `PaymentGatewaySettingController`-এর মতোই):
- `GET /sms/credit/auto-recharge/settings` — `{enabled, threshold, credits, connected, status, failure_count, last_attempted_at}`, কখনো raw `agreement_id` না।
- `PUT /sms/credit/auto-recharge/settings` — enable করতে হলে আগে একটা active connected method থাকতে হবে (422 নাহলে)।
- `POST /sms/credit/auto-recharge/agreement/create` — bKash Agreement flow শুরু করে, `bkash_url` রিটার্ন করে।
- `DELETE /sms/credit/auto-recharge/agreement` — `cancelAgreement()` কল করে + row ডিলিট করে + auto-recharge অফ করে দেয়।

Public (Sanctum-এর বাইরে, bKash bare browser redirect করে):
- `GET /sms/credit/auto-recharge/agreement/callback` — `pending_payment_id` দিয়ে row resolve করে (client-supplied user id কখনো trust করে না), `executeAgreement()` কল করে, active/failed মার্ক করে, frontend-এ `?bkash_agreement=success|failed|cancelled|error` দিয়ে রিডাইরেক্ট করে।

Controller: `App\Http\Controllers\Api\SmsCreditAutoRechargeController` — `SmsCreditBkashPaymentController`-এর initiate/callback শেপ + settings CRUD।

## ৫. Frontend

`frontend/src/app/dashboard/sms/credit/page.tsx`-এই নতুন "Auto-recharge" প্যানেল (Bill Payment সেকশনের নিচে, History-র উপরে) — শুধু `rateInfo.bkash_gateway_enabled` true হলে দেখায়। Not-connected হলে "Connect bKash" বাটন (agreement create → redirect, ঠিক one-time bKash পেমেন্ট বাটনের মতোই UX)। Connected হলে enable টগল + threshold/credits ইনপুট + failure count/circuit-breaker warning + Disconnect বাটন। `?bkash_agreement=...` query param দিয়ে ফেরত এলে success/failed/cancelled ব্যানার (one-time bKash checkout-এর `?bkash_status=...` প্যাটার্নের হুবহু কপি)।

## ৬. Staff/Team

Pattern B (owner-only) — `owner_only` middleware, staff কখনো কানেক্ট/ডিসকানেক্ট/সেটিংস বদলাতে পারবে না, `CONTEXT.md §৩১`।

## ৭. Non-goals (v1)

- Subscription auto-renew (deferred — একই `saved_payment_methods` টেবিল পরে reuse করা যাবে)।
- bKash ছাড়া অন্য কোনো গেটওয়ে-র tokenization।
- এক ইউজারের একাধিক saved method / provider বাছাই।

## ৮. টেস্ট

`backend/tests/Feature/SmsCreditAutoRechargeTest.php` — ১৫টা টেস্ট: agreement create/callback (success/failed/unknown-paymentID), settings enable-without-connection reject, settings save, staff 403, `deduct()`-এর trigger (dispatch/no-dispatch: above-threshold, disabled, cooldown), job success (recharge+reset), job failure (increment, balance অপরিবর্তিত), circuit-breaker (৩ বার ব্যর্থে disable), job no-op যখন balance আগেই recover হয়ে গেছে। Full backend suite (isolated pgsql schema): pre-existing baseline-এর ৪টা unrelated failure (`AuthApiTest`, `CollectionHistoryApiTest`, `CourierFraudCheckApiTest`, `ProductMediaApiTest`) ছাড়া সব পাস।
