# কুরিয়ার ডেলিভারি → অর্ডার লাইফসাইকেল সিঙ্ক — মাস্টার কনটেক্সট ফাইল

> এই ফাইলটা AI agent-দের জন্য: courier-এর নিজস্ব ট্র্যাকিং স্ট্যাটাস কীভাবে (এবং আসলে কীভাবে ছিল না) BSOL-এর `order.status`/accounting/tracking-pixel-এ প্রতিফলিত হয়, সেটা নিয়ে কোনো কাজ করার আগে এই ফাইল পড়লেই যথেষ্ট। তৈরি হয়েছে: 2026-08-16, একটা রিয়াল প্রোডাকশন অর্ডারে (`ORD-20260811-0002`, user_id 3, ডোমেইন zareen) সরাসরি ধরা পড়া বাগ থেকে।

---

## ১. উপসর্গ (যেটা রিপোর্ট হয়েছিল)

সেলার বাস্তবে অর্ডারটা কুরিয়ারে দিয়েছিল, কুরিয়ার ডেলিভারি করেছে, COD-এর টাকাও কালেক্ট করেছে। কুরিয়ারের নিজস্ব ট্র্যাকিং-এ (Pathao/Steadfast ড্যাশবোর্ডে) সব ঠিক দেখাচ্ছিল। কিন্তু BSOL-এ:

- অর্ডার স্ট্যাটাস `processing`-এই আটকে ছিল — কখনো `shipped`/`delivered` হয়নি।
- COD-এর টাকা অ্যাকাউন্টিং/ইনভয়েসে "confirmed income" হিসেবে জমা হয়নি — `pending` অবস্থাতেই আটকে ছিল।
- অর্ডারের payment badge (`due`/`partial`) কখনো `paid`-এ বদলায়নি।
- Analytics-এর revenue/delivered কাউন্টে এই অর্ডারটা কখনো ধরা পড়েনি।
- Meta-তে `OrderDelivered` pixel event কখনো যায়নি — যেটা এই পুরো ট্র্যাকিং সিস্টেমের (`tracking_capi_context.md`) মূল সেলিং পয়েন্ট, "courier-verified outcome, not just form-submitted"।

## ২. রুট কজ — ভেরিফাই করা হয়েছে সরাসরি প্রোডাকশন DB দিয়ে

`Order` মডেলের দুইটা সম্পূর্ণ আলাদা "স্ট্যাটাস" কলাম আছে যেগুলো কেউ কখনো একসাথে সিঙ্ক করেনি:

- **`courier_status`** — raw string, সরাসরি কুরিয়ারের API response থেকে (`"Delivered"`, `"in_transit"`, ইত্যাদি)। এটা শুধু `CourierController::trackOrder()` (dashboard-এর "Refresh" বাটন) ক্লিক করলেই আপডেট হতো — **কোনো automatic polling/webhook ছিল না**, কোনো cron entry ছিল না।
- **`status`** — BSOL-এর canonical lifecycle vocabulary (`pending/confirmed/processing/shipped/delivered/cancelled/returned`)। এটা বদলানোর **একমাত্র** সঠিক পথ হলো `OrderStatusService::transition()` — এটাই inventory release, `AccountingService::onOrderDelivered()`/`onOrderCancelledOrReturned()` (COD income), `OrderStatusLog`, SMS automation, এবং Meta order-flow pixel event (`submitTrackingEvent()`) — সবকিছুর একমাত্র চোকপয়েন্ট।

`CourierController::trackOrder()` সবসময় শুধু প্রথমটা করত:

```php
// আগে (বাগ):
$order->update(['courier_status' => $result['status']]);
// transition() কখনো কল হতো না — কোনো cascade নেই।
```

**ভেরিফিকেশন (2026-08-16, লাইভ DB):** `ORD-20260811-0002`-এর `courier_status = "Delivered"` (আপডেট `2026-08-15`-এ, কেউ Refresh বাটনে ক্লিক করেছিল), কিন্তু `status = "processing"` — কখনো বদলায়নি। ওই অর্ডারের `Transaction` রো (`order_cod`, id 33) `status = pending`, ২০২৬-০৮-১১ থেকে অপরিবর্তিত — `TransactionController`-এর সব সামারি/রিপোর্ট query শুধু `status = confirmed` গোনে, তাই এই আয় সেলারের কোনো accounting রিপোর্টে কখনো ধরা পড়েনি।

### ২.১ কেন WooCommerce-এর জন্য এই বাগ ছিল না

`ConnectOrderController::syncStatus()` (WordPress প্লাগইন থেকে আসা status sync) সরাসরি `OrderStatusService::transition()` কল করে — এখানে কোনো গ্যাপ নেই। বাগটা শুধু **BSOL-এর নিজস্ব courier booking** (Pathao/Steadfast/RedX/CarryBee/Paperfly-কে সরাসরি ড্যাশবোর্ড থেকে বুক করা অর্ডার)-এর জন্য।

**`tracking_capi_context.md`-এর একটা ভুল ধারণা এখানে ধরা পড়েছে** — সেই ফাইলের §7-এ (৪২৬ নং লাইনের আশেপাশে) লেখা আছে "BSOL-এর courier-verified স্ট্যাটাস দিয়ে" `OrderStatusService::transition()` order-flow event পাঠায়, যেন এটা সবসময় সত্যি। WooCommerce sync path-এর জন্য এটা ঠিক ছিল, কিন্তু BSOL-নেটিভ courier বুকিং-এর জন্য **সম্পূর্ণ মিথ্যা ছিল ২০২৬-০৮-১৬-এর ফিক্সের আগ পর্যন্ত** — `courier_status` কখনো `transition()`-এ পৌঁছাতোই না।

## ৩. ফিক্স (২০২৬-০৮-১৬)

### ৩.১ নতুন `App\Services\Courier\CourierStatusSyncService`

`sync(Order $order): array` — provider থেকে raw status টেনে আনে, `courier_status` কলামে লিখে রাখে (আগের মতোই), তারপর **classify() দিয়ে raw স্ট্রিং-কে BSOL vocabulary-তে ম্যাপ করে এবং কনফিডেন্ট মিলে গেলে `OrderStatusService::transition()` কল করে**।

**ম্যাপিং কৌশল — exact-match table না, keyword-based:** পাঁচটা কুরিয়ারের (Pathao-র `order_status_slug`, Steadfast-এর `delivery_status`, RedX-এর `status`, CarryBee-র `transfer_status`, Paperfly-র নিজস্ব normalized string) কোনো শেয়ার্ড enum নেই, আর বাস্তব ডেটায় casing-ও ভিন্ন হতে দেখা গেছে (`"Delivered"` ড্যাশবোর্ড capitalization বনাম API slug `"delivered"`)। তাই `strtolower()` + `str_contains()` কীওয়ার্ড ম্যাচ:

| raw status-এ যা থাকলে | ম্যাপ হয় |
|---|---|
| `deliver` বা `partial` | `delivered` (partial delivery-ও COD আংশিক কালেক্ট করা সম্পূর্ণ delivery leg, hold না) |
| `return` | `returned` |
| `cancel` | `cancelled` |
| `transit`/`pick`/`hub`/`dispatch`/`sorting`/`out for delivery` | `shipped` |
| বাকি সব (`pending`/`hold`/`in_review`/`booked`/অচেনা) | কোনো ম্যাপ নেই — `status` অপরিবর্তিত থাকে |

**টার্মিনাল-স্টেট গার্ড:** `order.status` একবার `delivered`/`cancelled`/`returned`-এ পৌঁছালে, পরের যেকোনো courier flap (courier-এর ডেটা glitch) সেটাকে আর পিছনে সরাতে পারে না — cascade সাইলেন্টলি স্কিপ হয়ে যায়, কিন্তু `courier_status` কলাম তবুও আপডেট হয় (raw ডেটা কখনো লুকানো হয় না, শুধু cascade থামে)।

`transition()`-এর কোনো ব্যর্থতা (যেমন stock mismatch) `try/catch`-এ মোড়ানো — courier sync request/command কখনো এই কারণে fail করবে না, ঠিক `submitTrackingEvent()`-এর মতোই একই নীতি।

### ৩.২ `CourierController::trackOrder()` রিফ্যাক্টর

আগের ইনলাইন লজিক এখন শুধু `$this->courierStatusSyncService->sync($order)` কল করে — response shape অপরিবর্তিত (frontend-এ কোনো পরিবর্তন লাগেনি)।

### ৩.৩ নতুন — automatic polling: `app:sync-courier-statuses`

**আগে কোনো automatic trigger-ই ছিল না** — শুধু সেলার নিজে ড্যাশবোর্ডে ঢুকে "Refresh" ক্লিক করলেই status আপডেট হতো। এখন `routes/console.php`-এ ঘণ্টায় একবার শিডিউল করা (`Schedule::command('app:sync-courier-statuses')->hourly()`):

- Query: `courier_tracking_id NOT NULL`, `status NOT IN (delivered, cancelled, returned)`, `courier_name IN` (supported couriers)।
- `chunkById(50, ...)`-এ প্রতিটা অর্ডারের জন্য `CourierStatusSyncService::sync()` কল, প্রতিটা try/catch-এ মোড়ানো (একটা অর্ডার fail করলে বাকিগুলো থামবে না)।
- ইচ্ছাকৃতভাবে `->limit()` নেই — Laravel-এর `chunkById()` নিজের `WHERE id > $lastId` প্যাজিনেশন করে, বাইরের `limit()`/`take()`-এর সাথে reliable-ভাবে compose করে না। যেহেতু একবার resolve (delivered/cancelled/returned) হয়ে গেলে অর্ডার এই query থেকে চিরতরে বাদ পড়ে যায়, ব্যাকলগ স্বাভাবিকভাবেই বাউন্ডেড — শুধু genuinely এখনো "in flight" অর্ডারগুলোই কভার হয়।

### ৩.৪ `AccountingService` — payment_status অটো-সিঙ্ক

`onOrderDelivered()`-এ যোগ হয়েছে: COD অর্ডার হলে (এবং ইতিমধ্যে `paid` না হলে) `payment_status = 'paid'` — courier হ্যান্ডওভারের সময় বাকি পুরো টাকা কালেক্ট করে ফেলে, `partial` (advance আগে নেওয়া) আর `due` (কিছুই নেওয়া হয়নি) দুটোই ডেলিভারিতে সমানভাবে সেটেল্ড হয়ে যায়।

`onOrderCancelledOrReturned()`-এ যোগ হয়েছে (সিমেট্রিক্যাল): COD অর্ডার আগে `paid` থাকলে (মানে delivered ছিল, এখন returned হচ্ছে), `payment_status` আবার `due`-এ রিসেট হয় — টাকা আর হাতে নেই। শুধু এই একই অটো-লজিক যা `paid` করেছিল সেটাই touch করে — সেলারের নিজের ম্যানুয়াল নোট (যেমন return হওয়া সত্ত্বেও advance রেখে দেওয়া) অক্ষত থাকে।

## ৪. যা **ইচ্ছাকৃতভাবে** বাদ রাখা হয়েছে

- **COD income Transaction-এর amount** এখনো সবসময় `order->total` (পুরো অর্ডার টোটাল), `courier_cod_amount` (কুরিয়ারকে কালেক্ট করতে বলা প্রকৃত COD, advance বাদ দিয়ে) না — এটা `AccountingService::onOrderDelivered()`-এর একটা প্রি-এক্সিস্টিং ডিজাইন সিদ্ধান্ত, এই ফিক্সের স্কোপের বাইরে। বাস্তব উদাহরণ: `ORD-20260811-0002`-এ `total=620` কিন্তু `courier_cod_amount=120` (advance ৫০০ আগেই নেওয়া হয়েছিল) — Transaction তবুও পুরো ৬২০ বুক করে।
- **Partial delivery-র জন্য partial COD amount** ট্র্যাক করা হয় না — `classify()` partial-কেও সম্পূর্ণ `delivered` হিসেবে গোনে (§৩.১)।
- **Steadfast/Pathao ইত্যাদির নিজস্ব push webhook** ব্যবহার করা হয়নি — polling-ই যথেষ্ট এই স্কেলে, আর কোনো courier-ই BSOL-কে outbound webhook পাঠানোর সুবিধা দেয় না (নিশ্চিত করা হয়নি প্রতিটার জন্য, কিন্তু কোনো কোডে existing webhook route নেই)।

## ৫. ফাইল-বাই-ফাইল

1. `backend/app/Services/Courier/CourierStatusSyncService.php` — নতুন, মূল লজিক
2. `backend/app/Services/Courier/CourierFactory.php` — `supportedCouriers(): array` (নতুন পাবলিক accessor, command-এর query-তে reuse করার জন্য)
3. `backend/app/Http/Controllers/Api/CourierController.php` — `trackOrder()` রিফ্যাক্টর, constructor DI
4. `backend/app/Console/Commands/SyncCourierStatuses.php` — নতুন
5. `backend/routes/console.php` — নতুন schedule entry
6. `backend/app/Services/AccountingService.php` — `onOrderDelivered()`/`onOrderCancelledOrReturned()`-এ payment_status
7. `backend/tests/Feature/CourierStatusSyncTest.php` — নতুন, ৬টা টেস্ট (cascade, shipped mapping, unrecognized-status no-op, terminal guard, return reversal, scheduled command eligibility)

## ৬. যাচাই

Isolated Postgres schema-তে টার্গেটেড টেস্ট (৬/৬ পাস) + ফুল স্যুট (312 passed, established ২-ফেইলিওর বেসলাইনে — `AuthApiTest`, `CourierFraudCheckApiTest`, দুটোই অসম্পর্কিত প্রি-এক্সিস্টিং)। কোনো migration লাগেনি (নতুন কলাম নেই)। নতুন ক্লাস তৈরি হওয়ায় `composer dump-autoload` + `php8.3-fpm`/queue-worker রিস্টার্ট লেগেছে ডিপ্লয়ে। প্রোডাকশনের রিয়াল অর্ডার `ORD-20260811-0002`-এ `php artisan tinker`-এ সরাসরি `CourierStatusSyncService::sync()` চালিয়ে রেট্রোঅ্যাক্টিভলি ঠিক করা হয়েছে (§৭)।

## ৭. রিয়াল অর্ডার ফিক্স লগ

`ORD-20260811-0002` (id 53, user_id 3, zareen): fix ডিপ্লয়ের পর `CourierStatusSyncService::sync($order)` ম্যানুয়ালি চালানো হয়েছে (আসল Steadfast/Pathao credentials দিয়ে live re-track, বানানো ডেটা না) — ফলাফল: `status: processing → delivered`, `payment_status: partial → paid`, `Transaction#33: pending → confirmed`, `OrderStatusLog` নতুন রো, Meta-তে `OrderDelivered` pixel event পাঠানো হয়েছে।
