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

## ৪. স্কোপের বাইরে (ইচ্ছাকৃতভাবে এই ধাপে বাদ)

- **`courier_cod_amount` স্বয়ংক্রিয় recompute** — courier বুকিং ফর্মে `cod_amount` এখনো সেলার নিজে হাতে বসান। এই ফিচার সেলারকে সঠিক বাকি টাকা (`due`) দেখিয়ে দিচ্ছে যাতে ভুল না হয়, কিন্তু বুকিং ফর্ম নিজে থেকে `due`-কে prefill করছে না — আলাদা ভবিষ্যৎ ধাপ।
- **Invoice PDF-এ কালেকশন-হিস্ট্রি/due প্রিন্ট করা** — আজকের ইনভয়েসে শুধু payment-method ব্যাজ আছে (`resources/views/invoices/order-invoice.blade.php`), কালেকশন লিস্ট যোগ করা হয়নি।
- **Overpayment/রিফান্ড ফ্লো** — `due` ঋণাত্মক (negative) হতে পারে (বেশি টাকা কালেক্ট হলে), কিন্তু কোনো রিফান্ড-ট্র্যাকিং তৈরি হয়নি, শুধু সংখ্যাটা দেখানো হয়।
- Screenshot শুধু bKash/Nagad/Rocket/Upay-তে সার্ভার-সাইড `required` — bank/cash-এ ঐচ্ছিক (ব্যাংক ট্রান্সফারের রিসিট আলাদা করে বাধ্যতামূলক করা হয়নি, প্রয়োজনে পরে যোগ করা যাবে)।

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
