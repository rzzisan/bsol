# অর্ডার — ম্যানুয়াল পেমেন্ট কালেকশন

## ১. সমস্যা / প্রয়োজন

সেলার অনেক সময় অর্ডারের টাকা কুরিয়ারের COD ছাড়াও সরাসরি কালেক্ট করেন —
অগ্রিম (advance), শুধু কুরিয়ার চার্জ অগ্রিম, বা ফুল পেমেন্ট (bKash/bank/cash)।
আজ পর্যন্ত এই লেনদেনগুলো BSOL-এ কোথাও রেকর্ড হয় না:

- অর্ডার ডিটেইলে কত টাকা বাকি (due) তা কোনো নির্ভরযোগ্য সংখ্যা থেকে বের করা যায় না — `orders.payment_status` শুধু `due/partial/paid` — কোনো amount নেই ([Order.php](backend/app/Models/Order.php))।
- কে, কবে, কোন মাধ্যমে (bkash/bank/cash) কত টাকা রিসিভ করলো — এর কোনো audit trail নেই।
- bKash/মোবাইল ব্যাংকিং-এ পাঠানো টাকার প্রমাণ (স্ক্রিনশট) সংরক্ষণের জায়গা নেই।
- Accounting রিপোর্টে (`TransactionController`) শুধু COD ডেলিভারি-কনফার্মড ইনকাম আর কুরিয়ার-চার্জ এক্সপেন্স দেখা যায় ([AccountingService.php](backend/app/Services/AccountingService.php)) — ম্যানুয়ালি কালেক্ট করা কোনো টাকা রিপোর্টে ঢোকে না। non-COD (bkash/online) অর্ডারের জন্য তো এখন পর্যন্ত ইনকামই রেকর্ড হয় না — `onOrderCreated()`/`onOrderDelivered()` উভয়ই `payment_method !== 'cod'` হলে সঙ্গে সঙ্গে রিটার্ন করে।

**চাওয়া হয়েছে:** অর্ডার লিস্টে Invoice বাটনের পাশে "Payment" বাটন — ক্লিক করলে একটা পপ-আপ, যেখানে অর্ডারের সামারি (bill/shipping/discount/total/due) দেখা যাবে, আর একটা ফর্মে পেমেন্ট এন্ট্রি করা যাবে (ধরন, মাধ্যম, টাকা, ডিসকাউন্ট, কে রিসিভ করলো, স্ক্রিনশট)।

## ২. ডেটা মডেল

নতুন টেবিল **`order_payments`** — প্রতিটি কালেকশন ইভেন্টের নিজস্ব সারি (একটা অর্ডারে একাধিক এন্ট্রি হতে পারে: প্রথমে অগ্রিম, পরে বাকি)।

| কলাম | অর্থ |
|---|---|
| `order_id` | কোন অর্ডার |
| `user_id` | অর্ডারের মালিক শপ (`order->user_id` কপি — `Transaction.user_id`-এর কনভেনশন অনুসরণ করে) |
| `collected_by` | **কে রিসিভ করলো** — শপের owner/staff-দের যে কেউ (`shopUserIds()` থেকে বেছে নেওয়া) — মাল্টি-ইউজার সাপোর্ট এখানেই |
| `created_by` | এই এন্ট্রিটা সিস্টেমে কে লিখলো (audit — `collected_by` থেকে ভিন্ন হতে পারে, যেমন স্টাফ লিখছে কিন্তু মালিক টাকা রিসিভ করেছে) |
| `purpose` | পেমেন্ট ধরন — `advance` (অগ্রিম) / `courier_charge` (শুধু কুরিয়ার চার্জ) / `full_payment` (সম্পূর্ণ) / `other` |
| `method` | পেমেন্ট টাইপ — `cash` / `bank` / `bkash` / `nagad` / `rocket` / `upay` / `other` |
| `amount` | কত টাকা কালেক্ট হলো |
| `discount` | এই এন্ট্রিতে অতিরিক্ত কত ছাড় দেওয়া হলো (order-level discount থেকে আলাদা — যেমন বাকি টাকার উপর গুডউইল ছাড়) |
| `screenshot_path` | bKash/মোবাইল ব্যাংকিং প্রমাণ (public disk, `order-payments/{shop_user_id}/...`) |
| `note` | ফ্রি-টেক্সট নোট |
| `collected_at` | কবে কালেক্ট হয়েছে (ডিফল্ট এখন, ব্যাক-ডেট করা যায়) |

**বাকি (due) হিসাব** — কোনো নতুন কলাম `orders`-এ যোগ হয়নি, রিয়েল-টাইম গণনা:

```
due = order.total − SUM(order_payments.amount) − SUM(order_payments.discount)
```

`order.total`-এর মধ্যেই order তৈরির সময়ের discount আগে থেকে নেট করা আছে (`total = subtotal + shipping_charge − discount`, [OrderController.php:218](backend/app/Http/Controllers/Api/OrderController.php:218)) — তাই কালেকশন-টাইম discount এর উপর আলাদাভাবে যোগ হয়, ডাবল-কাউন্ট হয় না।

## ৩. Accounting-এ প্রভাব (verify করা হয়েছে)

`AccountingService::onOrderCreated()`/`onOrderDelivered()` শুধু COD-এর জন্য কাজ করে ([90a354f](https://github.com)-এর আগের সেশনের কাজ) — courier-driven ইনকাম। ম্যানুয়াল কালেকশন সম্পূর্ণ আলাদা টাকার প্রবাহ (সেলার নিজে হাতে নিচ্ছেন, কুরিয়ারের মাধ্যমে না) — তাই এটা একটা **নতুন, স্বতন্ত্র Transaction** হিসেবে রেকর্ড হবে, পুরনো `order_cod`/`courier_charge` লজিক স্পর্শ না করে:

- প্রতিটি `OrderPayment.amount > 0` এন্ট্রির জন্য একটা `Transaction` (`type=income`, `category=order_manual_payment`, `status=confirmed`, `reference_type=order_payment`, `reference_id=<payment.id>`) তৈরি হয় — `TransactionController`-এর রিপোর্টে (যা `status=confirmed` যোগফল করে) স্বয়ংক্রিয়ভাবে দেখা যাবে।
- এন্ট্রি ডিলিট হলে সংশ্লিষ্ট `Transaction` ডিলিট হয়ে যায় (ভুল এন্ট্রি সংশোধনের সুযোগ)।
- `discount`-only এন্ট্রি (amount=0) কোনো Transaction তৈরি করে না — শুধু `due` কমায়।
- প্রতিটি কালেকশন/ডিলিটের পর `order.payment_status` স্বয়ংক্রিয়ভাবে recompute হয় (`due` → `partial` → `paid`) — courier delivery-এর `onOrderDelivered()`-এর payment_status auto-sync ঠিক একই নীতিতে (দেখুন `courier_status_sync_context.md` §3.4)।

**এর ফলে একটা পুরনো gap-ও বন্ধ হচ্ছে**: non-COD (bkash/online `payment_method`) অর্ডারে আগে কখনোই কোনো ইনকাম Transaction রেকর্ড হতো না। সেলার এখন সেই পেমেন্ট ম্যানুয়ালি লগ করলে (purpose=full_payment) সেটাও Accounting রিপোর্টে ধরা পড়বে।

## ৩ক. অটোমেটিক অর্ডার কনফার্ম + ফেসবুক ট্র্যাকিং

**যোগ করা হয়েছে:** এই ফিচার থেকে একটা প্রকৃত পেমেন্ট (amount > 0, শুধু discount-only এন্ট্রি না) কালেক্ট হলে, আর অর্ডারটা এখনো `pending` থাকলে — অর্ডার স্বয়ংক্রিয়ভাবে `confirmed`-এ চলে যাবে, ঠিক ম্যানুয়ালি স্ট্যাটাস পরিবর্তনের মতোই `OrderStatusService::transition()`-এর মধ্য দিয়ে। এর মানে courier-fix-এর মতোই পুরো সাইড-ইফেক্ট চেইন ফ্রি-তে পাওয়া যায়:

- `order_status_logs` এন্ট্রি
- SMS অটোমেশন ট্রিগার
- **Meta-এর `OrderConfirmed` ট্র্যাকিং ইভেন্ট** (`OrderStatusService::ORDER_FLOW_EVENTS['confirmed']`) — এটাই মূল অনুরোধ ছিল ("সেই ভাবেই ফেসবুক ট্রাকিং এ ইভেন্ট যাবে")।

**গার্ড:** অর্ডার ইতিমধ্যে `pending`-এর চেয়ে এগিয়ে থাকলে (processing/shipped/...) কোনো পরিবর্তন হয় না — দেরিতে করা বা আংশিক (advance) পেমেন্ট এন্ট্রি একটা এগিয়ে থাকা অর্ডারকে পিছিয়ে দেবে না। Discount-only এন্ট্রি (কোনো টাকা কালেক্ট হয়নি) কনফার্ম ট্রিগার করে না।

**পেমেন্ট এন্ট্রি ডিলিট করলে** — status ফিরিয়ে `pending` করা হয় না (courier fix-এর terminal-state নীতির মতোই, ইচ্ছাকৃতভাবে এক-দিকমুখী — একটা ভুল এন্ট্রি সংশোধনের সময় সেলারের ইতিমধ্যে কাস্টমারকে কল করা/প্রসেস শুরু করা কাজ যেন বাতিল না হয়ে যায়)।

## ৩খ. Courier COD amount বাস্তবে ভুল ছিল (verify করে নিশ্চিত করা হয়েছে) + বাকি কলাম + অর্ডার ডিটেইল/ইনভয়েসে হিস্ট্রি

**রিপোর্ট করা সমস্যা:** `ORD-20260816-0007` — total ৳1,000, ৳500 ম্যানুয়ালি কালেক্ট হয়েছে, বাকি ৳500। কিন্তু courier বুকিং ফর্মে COD amount দেখাচ্ছিল পুরো ৳1,000।

**রুট কজ (verify করা হয়েছে):** এই ফিচারের ৩খ-এর আগ পর্যন্ত `courier_cod_amount`-এর ডিফল্ট বসতো `$order->total` থেকে — `CourierController::book()`-এ (single booking) সরাসরি, আর **প্রতিটা courier provider-এর নিজের ভেতরেও একই ডিফল্ট আলাদাভাবে ডুপ্লিকেট করা ছিল** (`PathaoCourierProvider`, `RedxCourierProvider`, `CarrybeeCourierProvider`, `PaperflyCourierProvider`, `SteadfastCourierProvider::book()`/`bookBulk()` — ৬টা জায়গায়)। ফলে `$data['cod_amount']` ফাঁকা থাকলে প্রতিটা provider নিজে থেকেই `$order->total` ফলব্যাক করতো, `due` না জেনেই। Bulk booking (`CourierController::bookBulk()`) তো `courier_cod_amount` আদৌ persist-ই করতো না — তার মানে বাল্ক-বুক করা অর্ডার ডেলিভারি হলে `AccountingService::codIncomeAmount()` আবার পুরো `total`-এ ফলব্যাক করতো (গত সেশনের [583704d](https://github.com)-এ যে ওভারস্টেটমেন্ট বাগ ফিক্স হয়েছিল, বাল্ক পাথে সেটা রয়েই গিয়েছিল)।

**ফিক্স:** একটাই সোর্স-অব-ট্রুথ — `AbstractCourierProvider::resolveCodAmount(Order, array $data)` (নতুন protected helper, সব ৫টা provider এটা থেকেই extend করে): `$data['cod_amount'] ?? max(0, $order->dueAmount())`। প্রতিটা provider-এর নিজস্ব `?? $order->total` ফলব্যাক এই helper-কল দিয়ে বদলানো হয়েছে। `CourierController::book()`-এও কেন্দ্রীয়ভাবে একবার resolve করে `$data['cod_amount']`-এ বসিয়ে দেওয়া হয় (নিচে দেখুন) — তাই provider-লেয়ারের নিজস্ব ফলব্যাক শুধু defense-in-depth, ব্যবহারিকভাবে আর কখনো ট্রিগার হবে না। `bookBulk()`-এ `courier_cod_amount` persist করা যোগ হয়েছে (প্রতি অর্ডারের নিজের `dueAmount()` দিয়ে) — আগে এটা একদমই সেট হতো না।

**COD amount স্টাফ পরিবর্তন করতে পারবে না:** `CourierController::book()`-এ নতুন `resolveCodAmount(Order $order, ?float $submitted)`:
```php
$due = max(0, $order->dueAmount());
if (auth()->user()->isStaff()) {
    return $due; // যা-ই পাঠানো হোক না কেন, উপেক্ষা করা হয় — স্টাফ ওভাররাইড করতে পারবে না
}
return $submitted ?? $due;
```
মালিক (owner) চাইলে এখনো ম্যানুয়ালি ভিন্ন amount দিতে পারবেন (যেমন courier partial-COD নেবে এমন বিশেষ ব্যবস্থা), স্টাফ পারবে না — ফলাফল সবসময় সিস্টেম-গণনা করা `due`। ফ্রন্টএন্ডেও (`dashboard/courier/page.tsx`) স্টাফ হলে COD input disabled/read-only দেখানো হয় (`getStoredUser()?.is_staff`)।

**Order list এ নতুন কলাম:** "জমা" (paid) ও "বকেয়া" (due) — `OrderController::index()` এবং `CourierController::readyToBook()` উভয় query-তে `withSum('payments as paid_amount','amount')` + `withSum('payments as collection_discount','discount')` যোগ হয়েছে (প্রতি-রো আলাদা query না চালিয়ে, ২টা মাত্র subquery পুরো পেজের জন্য), তারপর `due_amount = total - paid_amount - collection_discount` কম্পিউট করে রেসপন্সে যোগ হয়। `readyToBook()`-ই আসলে "কুরিয়ার লিস্ট" (পার্সেল বুক করুন পেজ) — সেখানেও `due_amount` এখন আসে, ফ্রন্টএন্ড booking modal সেটাকেই COD-এর ডিফল্ট হিসেবে prefill করে (আগে `order.total` prefill হতো)।

**অর্ডার ডিটেইলস-এ পেমেন্ট হিস্ট্রি:** `dashboard/orders/[id]/page.tsx`-এ নতুন প্যানেল — `GET /orders/{id}/payments` থেকে (আগে থেকেই ছিল, order list মডালে ব্যবহৃত হতো) bill summary + প্রতিটা কালেকশন এন্ট্রি (তারিখ, ধরন, মাধ্যম, amount, discount, রিসিভার, স্ক্রিনশট লিংক) দেখায়। ভিউ-অনলি — নতুন পেমেন্ট যোগ করার ফর্ম এখানে নেই (সেটা order list-এর মডালেই থাকছে), ডুপ্লিকেট UI এড়াতে।

**PDF ইনভয়েসে পেমেন্ট হিস্ট্রি:** `OrderInvoicePdfService`/`order-invoice.blade.php`-এ totals-table-এর পরে "PAYMENT HISTORY" টেবিল (Date/Type/Method/Amount/Discount/Received by) + Paid/Extra Discount/Due সামারি — শুধু `amount>0` বা `discount>0` থাকা অর্ডারে দেখানো হয় (কোনো পেমেন্ট না থাকলে সেকশনটাই নেই, পুরোনো ইনভয়েসের লে-আউট অপরিবর্তিত থাকে)। Purpose/method লেবেল ইংরেজিতে (Advance/Courier Charge/Full Payment/Other, Cash/Bank/bKash/...) — ইনভয়েসের বাকি লেবেলগুলোর (Subtotal/Discount/Total) কনভেনশন অনুসরণ করে। রিসিভারের নাম বাংলা হলে matra-reorder হয় (পুরো HarfBuzz শেপিং না — item/customer-name-এর মতো ভারী নয়, ছোট রিসিপ্ট-স্টাইল সেকশন বলে সরলীকরণ)। Note ফিল্ড ইনভয়েসে দেখানো হয় না (স্পেস-সীমিত, প্রয়োজনে অর্ডার ডিটেইল পেজেই আছে)।

## ৪. স্কোপের বাইরে (ইচ্ছাকৃতভাবে এই ধাপে বাদ)

- ~~`courier_cod_amount` স্বয়ংক্রিয় recompute~~ ✅ ৩খ-তে ঠিক হয়ে গেছে।
- ~~Invoice PDF-এ কালেকশন-হিস্ট্রি/due প্রিন্ট করা~~ ✅ ৩খ-তে যোগ হয়েছে।
- **Overpayment/রিফান্ড ফ্লো** — `due` ঋণাত্মক (negative) হতে পারে (বেশি টাকা কালেক্ট হলে), কিন্তু কোনো রিফান্ড-ট্র্যাকিং তৈরি হয়নি, শুধু সংখ্যাটা দেখানো হয়। COD-এ অবশ্য `max(0, due)` — কখনো নেগেটিভ COD চাওয়া হয় না।
- Screenshot শুধু bKash/Nagad/Rocket/Upay-তে সার্ভার-সাইড `required` — bank/cash-এ ঐচ্ছিক (ব্যাংক ট্রান্সফারের রিসিট আলাদা করে বাধ্যতামূলক করা হয়নি, প্রয়োজনে পরে যোগ করা যাবে)।
- **Order detail পেজ থেকে সরাসরি পেমেন্ট এন্ট্রি করা** — শুধু ভিউ, এন্ট্রি এখনো order list-এর মডাল থেকেই করতে হয়।

## ৫. Backend

- Migration: `create_order_payments_table` — উপরের কলাম, FK cascade on `order_id`, `nullOnDelete` on `collected_by`/`created_by` (soft-deleted staff-এর পুরনো এন্ট্রি নষ্ট হবে না)।
- `App\Models\OrderPayment` — `PURPOSES`/`METHODS`/`SCREENSHOT_REQUIRED_METHODS` const।
- `Order::payments()`/`paidAmount()`/`collectionDiscountAmount()`/`dueAmount()`।
- `AccountingService::recordManualPayment()`/`reverseManualPayment()`/`syncPaymentStatus()`।
- `App\Http\Controllers\Api\OrderPaymentController` — `index`(order + payment history + collector list) / `store` (multipart, screenshot) / `destroy`। শপ-স্কোপিং সব জায়গায় `whereIn('user_id', shopUserIds())` — বিদ্যমান কনভেনশন।
- Routes — বিদ্যমান `staff_permission:orders` গ্রুপে (Invoice রুটের পাশে), যেহেতু এটা অর্ডার-স্কোপড অ্যাকশন এবং staff অনুমতি-মডেল ইতিমধ্যেই এই মডিউলে আছে — নতুন module key তৈরি করা হয়নি।

## ৬. Frontend

`dashboard/orders/page.tsx` — Invoice বাটনের পাশে "Payment" বাটন → মডাল (স্ট্যাটাস-চেঞ্জ মডালের প্যাটার্ন অনুসরণ করে):
- উপরে অর্ডার সামারি: subtotal/shipping/discount/total/paid/due (লাইভ `GET /orders/{id}/payments` থেকে)।
- নিচে কালেকশন-হিস্ট্রি টেবিল (কে, কবে, কত, কীভাবে, স্ক্রিনশট থাম্বনেইল লিংক)।
- নতুন এন্ট্রি ফর্ম: purpose (select), method (select), amount, discount, collected_by (select — শপের সদস্যরা), collected_at (date, ঐচ্ছিক), note, screenshot (file, method অনুযায়ী conditionally required — ক্লায়েন্ট সাইডেও হালকা ইঙ্গিত, আসল ভ্যালিডেশন সার্ভারে)।
- `due <= 0` হলে ফর্মের উপরে "সম্পূর্ণ পরিশোধিত" ব্যাজ দেখানো, কিন্তু ফর্ম বন্ধ করা হয়নি (overpay/adjustment এন্ট্রির জন্য)।

## ৭. যাচাই

Backend: isolated Postgres schema কনভেনশনে — পেমেন্ট এন্ট্রির পর due/paid/discount ঠিকভাবে recompute হয়; `amount` পুরো due কভার করলে `payment_status=paid`; bkash/nagad method-এ screenshot ছাড়া 422; `collected_by` শপের বাইরের ইউজার হলে 422; এন্ট্রি ডিলিট হলে Transaction-ও ডিলিট হয় ও due আবার বেড়ে যায়; স্টাফ (orders permission সহ) নিজে এন্ট্রি করতে পারে, মালিককে `collected_by` হিসেবে বেছে নিতে পারে। ফুল স্যুট বেসলাইনের বিপরীতে রি-রান (২টা পুরনো, অসম্পর্কিত ফেইলিউর ছাড়া আর কিছু না)।
