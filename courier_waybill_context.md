# কুরিয়ার ওয়েবিল/লেবেল PDF — মাস্টার কনটেক্সট ফাইল

> এই ফাইলটা AI agent-দের জন্য: courier waybill/sticker PDF ফিচার নিয়ে কোনো কাজ করার আগে পুরো কোডবেস স্ক্যান না করে এই ফাইল পড়লেই যথেষ্ট। শেষ আপডেট: 2026-08-11 (প্রথম ডেলিভারি + একাধিক dompdf বাগ ফিক্স, একই সেশনে)। এই ফিচার `feature_roadmap_context.md`-এর #5 আইটেম — সম্পূর্ণ হয়ে গেছে, ওই ফাইলের status টেবিলে আপডেট করা আছে।
>
> স্ট্যাক: Laravel backend (`/var/www/hybrid-stack/backend`) + Next.js/TypeScript frontend (`/var/www/hybrid-stack/frontend`)। PDF রেন্ডারার `barryvdh/laravel-dompdf` (dompdf/dompdf ^3.0) — subscription/SMS-credit ইনভয়েসেও (`InvoicePdfService`) একই লাইব্রেরি ব্যবহার হয়, কিন্তু waybill-এ **নতুন ধরনের কনটেন্ট (barcode/QR ইমেজ, ছোট থার্মাল পেজ সাইজ, বড় বোল্ড ফন্ট)** এমন কিছু dompdf বাগ সামনে এনেছে যেগুলো ইনভয়েস টেমপ্লেটে কখনো ধরা পড়েনি।

> **🚨 Staff/Team role সচেতনতা:** কুরিয়ার মডিউল Pattern A (team-shared) — `CourierController`-এর সব মেথডই `Order::whereIn('user_id', auth()->user()->shopUserIds())` দিয়ে স্কোপড, নতুন `waybill`/`waybillBulk` মেথডও একই প্যাটার্ন অনুসরণ করেছে। রুট `staff_permission:courier` গ্রুপের ভেতরে (owner_only credential রুটের বাইরে) — নতুন `StaffPermission::MODULE_KEYS` entry লাগেনি, বিদ্যমান `courier` key-ই যথেষ্ট।

---

## ১. ফিচার সারাংশ

সেলার এখন booked অর্ডারের জন্য প্রিন্টেবল থার্মাল ওয়েবিল/লেবেল PDF ডাউনলোড করতে পারে — একক অর্ডার বা bulk (একসাথে একাধিক নির্বাচিত অর্ডার, প্রতিটার জন্য আলাদা page)। লেবেলে থাকে: কুরিয়ার ব্যানার, বড় বক্সড COD amount, Code128 barcode + tracking ID, বড় প্রমিনেন্ট রিসিভার নাম/ফোন/ঠিকানা, ছোট সেন্ডার/অর্ডার তথ্য, এবং একটা QR code (order#, tracking ID, COD amount, ফোন এনকোড করা — phone-camera স্ক্যানের জন্য)। ৫৮mm ও ৮০mm — দুই সাইজের থার্মাল প্রিন্টারই সাপোর্ট করে (`?size=58|80` query param)।

---

## ২. Backend ফাইল

- **`app/Services/WaybillPdfService.php`** (নতুন) — মূল সার্ভিস, `InvoicePdfService.php`-এর প্যাটার্ন অনুসরণ করে (bundled `NotoSansBengali-Regular/Bold.ttf`, `Pdf::loadView()->setPaper()`)। মেথড: `render(Collection|array $orders, int $widthMm = 80): PdfDocument` — এক বা একাধিক অর্ডার নিয়ে multi-page PDF বানায় (এক অর্ডার = এক page)। প্রাইভেট হেল্পার: `barcodeDataUri()` (Code128 PNG, base64 data URI), `qrDataUri()` (QR PNG, base64 data URI, order summary টেক্সট এনকোড করে), `reorderBengaliMatras()` (§৫ দেখো — জরুরি বাগ ফিক্স)।
- **`resources/views/couriers/waybill.blade.php`** (নতুন) — শেয়ার্ড Blade টেমপ্লেট, `@foreach($labels as $label)` লুপে প্রতিটা অর্ডারের জন্য একটা `.label` div, শেষটা ছাড়া সবগুলোতে `page-break-after: always`।
- **`app/Http/Controllers/Api/CourierController.php`** — দুইটা নতুন মেথড যোগ হয়েছে (existing methods অপরিবর্তিত): `waybill(Request, int $orderId): Response` (GET, single, `?size=58|80`), `waybillBulk(Request): Response` (POST, `order_ids[]` + `size`, max ২০০টা)। দুটোই `Order::whereIn('user_id', auth()->user()->shopUserIds())->whereNotNull('courier_tracking_id')` দিয়ে স্কোপড — শুধু বুকড অর্ডারের জন্যই কাজ করে।
- **`routes/api.php`** — `staff_permission:courier` গ্রুপের ভেতরে: `GET /courier/waybill/{order}`, `POST /courier/waybill/bulk`।
- **`composer.json`/`composer.lock`** — দুইটা নতুন প্যাকেজ: `picqer/php-barcode-generator` (^3.1, Code128 PNG generation, GD lib লাগে), `chillerlan/php-qrcode` (^5.0, QR PNG generation, base64 output built-in)।

---

## ৩. Frontend ফাইল

- **`src/app/dashboard/courier/track/page.tsx`** ("Track Parcels" পেজ, `/dashboard/courier/track`) — এখানেই প্রিন্ট বাটন যোগ হয়েছে, "Book Parcel" পেজে (`/dashboard/courier`) না, কারণ waybill বুকড অর্ডারের জন্যই দরকার। যোগ হয়েছে: প্রতি row-এ "Print label" বাটন (Actions কলামে), row checkbox + "Print selected" bulk বাটন, 58mm/80mm সাইজ selector।
- **`src/lib/dashboard-client.ts`** — `openAuthenticatedPdf(url, init?: RequestInit)` এখন optional দ্বিতীয় প্যারামিটার নেয় (আগে শুধু GET সাপোর্ট করত, subscription/SMS-credit ইনভয়েসের জন্য) — bulk waybill POST request-এও reuse করা যায়।

---

## ৪. dompdf-এর বাগ — যা পাওয়া গেছে এবং কীভাবে ফিক্স হয়েছে

এই সেকশনটাই এই ফাইলের সবচেয়ে গুরুত্বপূর্ণ অংশ — এই বাগগুলো আবার আবিষ্কার করতে অনেক সময় লেগেছে, ভবিষ্যতে dompdf দিয়ে নতুন কিছু বানানোর আগে (waybill-এর বাইরেও, যেমন কোনো নতুন label/report PDF) এই লিস্ট পড়ে নেওয়া উচিত।

### ৪.১ Phantom blank page — height:100% ≈ page height
`.label` div-এ `height: {{ $heightMm }}mm` (page-এর height-এর সমান) সেট করলে dompdf প্রতিটা label-এর পর একটা **সম্পূর্ণ ফাঁকা extra page** যোগ করে দিত (sub-pixel rounding — box height পেজ height-এর ঠিক সমান হলে overflow trigger হয়)। **ফিক্স:** `.label`-এ কোনো explicit `height` সেট না করা — শুধু `@page { size: ... }` CSS দিয়ে physical page size বাউন্ড করা, content-কে নিজের height নিতে দেওয়া। `page-break-after: always` আলাদাভাবে conditionally (`$loop->last`) apply করা হয়, CSS `:last-child` selector-এর ওপর ভরসা না করে (dompdf pseudo-selector সাপোর্ট অবিশ্বাস্য)।

### ৪.২ `text-align:right`/`float:right` টেক্সটের শেষ ক্যারেক্টার ড্রপ করে দেয়
Width-constrained + `box-sizing:border-box` label-এর ভেতরে ডান-align করা যেকোনো টেক্সট ব্লক তার **শেষ ক্যারেক্টার সাইলেন্টলি হারিয়ে ফেলে** — `1,120` রেন্ডার হতো `1,12`, একক-ডিজিট ITEMS count (`"1"`) পুরোপুরি উধাও হয়ে যেত। মিনিমাল repro-তে নামিয়ে কনফার্ম করা হয়েছে: এটা `text-align:right` এবং `float:right` দুটোতেই হয়, `<div>` এবং `<td>` (table cell) দুটোতেই হয়, ফন্ট/সাইজ/কনটেন্ট-length নির্বিশেষে সবসময় হয়। **ফিক্স:** এই লেবেলের ভেতরে কোথাও `text-align:right`/`float:right` টেক্সটের জন্য ব্যবহার করা হয়নি — কুরিয়ার নাম + COD amount একলাইনে left-aligned (`{{ courier }} · COD Tk {{ amount }}`), ORDER/ITEMS দুটো stacked left-aligned লাইন (২-কলাম right-aligned টেবিলের বদলে)। **নোট:** `text-align:center` টেস্ট করে সেফ পাওয়া গেছে (§৭-এ ব্যবহৃত হচ্ছে), শুধু `right`/`float:right` সমস্যাজনক।

### ৪.৩ Percentage-width/fixed-width `<img>` ডান মার্জিন ছাড়াই overflow করে
Barcode-এ `width:100%` এবং QR-এ fixed mm width — দুটোই printable area-র ডান প্রান্ত পেরিয়ে গিয়ে কেটে যেত (কোনো ডান মার্জিন ছাড়াই, বাস্তব থার্মাল প্রিন্টে ইউজার-রিপোর্টেড)। **ফিক্স:** ইমেজের width PHP সাইডে (service-এ) explicit mm হিসেবে হিসাব করা হয় — content width (label width − padding) থেকে ২mm সেফটি বাফার বিয়োগ করে (`$barcodeWidthMm`), percentage বা edge-flush সাইজিং কোনোটাই ব্যবহার হয় না।

### ৪.৪ `vertical-align:middle` (inline-block pair) ওপরের কনটেন্টের সাথে overlap করে
QR + caption টেক্সট `inline-block; vertical-align:middle` দিয়ে পাশাপাশি রাখলে — লম্বা QR ইমেজ (২০mm) ছোট টেক্সট ব্লকের (~৭mm) সাথে line-box-এর মাঝ বরাবর align হতে গিয়ে QR-এর ওপরের অংশ line-box-এর বাইরে ঠেলে দেয়, উপরের barcode-এর ওপর ওভারল্যাপ করে ফেলে। **ফিক্স:** `vertical-align:top` — দুটো element একই স্টার্ট-লাইনে anchor হয়, QR শুধু নিচের দিকে বাড়ে, ওপরের কনটেন্টে কখনো ঢোকে না।

### ৪.৫ Complex-script (বাংলা) শেপিং নেই — matra reordering নিজেই করতে হয়
dompdf-এ কোনো OpenType/HarfBuzz-স্টাইল text shaping engine নেই — এটা glyph-গুলো raw Unicode storage order-এ আঁকে, ফন্টের GSUB reordering rule apply করে না। বাংলার pre-base vowel sign (**ি, ে, ৈ** — U+09BF/U+09C7/U+09C8) Unicode-এ কনসোনেন্টের **পরে** স্টোর হয় কিন্তু ভিজুয়ালি **আগে** দেখাতে হয় — reorder না করলে "জিসান" রেন্ডার হয় "জসিান", "হেডফোন" রেন্ডার হয় "হডেফোন" (ইউজার-রিপোর্টেড রিয়েল প্রোডাকশন অর্ডার থেকে ধরা পড়েছে)। **ফিক্স:** `WaybillPdfService::reorderBengaliMatras()` — regex দিয়ে এই তিনটা vowel sign-কে তাদের consonant cluster-এর (আগের virama-জোড়া conjunct সহ) আগে সরিয়ে দেয়, dompdf-কে ফিড করার আগে। এই ফাংশন সব বাংলা টেক্সট ফিল্ডে apply হয়: রিসিভার নাম, সেন্ডার নাম, ঠিকানা, আইটেম নাম, নোট। precomposed **ো/ৌ** (single codepoint, নিজের সম্পূর্ণ গ্লিফ) reorder লাগে না, তাই বাদ দেওয়া হয়েছে।
  ```php
  $consonant = '\x{0995}-\x{09B9}\x{09CE}\x{09DC}-\x{09DF}';
  $pattern = '/((?:[' . $consonant . ']\x{09CD})*[' . $consonant . '])([\x{09BF}\x{09C7}\x{09C8}])/u';
  preg_replace($pattern, '$2$1', $text);
  ```
  **সাইড এফেক্ট:** এই রিঅর্ডার শুধু ভিজুয়াল রেন্ডারিং ঠিক করে — PDF-এর টেক্সট লেয়ার (কপি/এক্সট্র্যাক্ট করলে) reordered (ভুল) ক্রমেই থাকবে। প্রিন্টেড লেবেলের জন্য এটাই কাম্য ট্রেড-অফ (searchable text না, ভিজুয়াল প্রিন্ট-ই আসল উদ্দেশ্য)।
  **⚠️ এই বাগ সম্ভবত `InvoicePdfService`/`resources/views/invoices/document.blade.php`-তেও আছে** (একই dompdf + একই ফন্ট ব্যবহার করে) — এখনো ভেরিফাই/ফিক্স করা হয়নি, শুধু বড় ফন্ট-সাইজ + bold weight-এর waybill-এ চোখে পড়েছে। ভবিষ্যতে কেউ যদি ইনভয়েসে বাংলা কাস্টমার নাম গার্বল্ড দেখে রিপোর্ট করে, এই একই ফিক্স ওখানেও দরকার হবে।

### ৪.৬ Amount-এ ৳ গ্লিফ মিসিং হলে বক্স-ক্যারেক্টার দেখায়
বেস `DejaVu Sans` ফন্টে ৳ (টাকা সাইন) গ্লিফ নেই — `.i18n` (AppFont/NotoSansBengali) ক্লাস লাগবে। কিন্তু পুরো amount লাইন `.i18n` করলে §৪.২-এর মতোই আরেকটা রহস্যময় character-drop হতো (root cause পুরোপুরি আইসোলেট করা যায়নি — ফন্ট-মিক্সিং vs অন্য কিছু, নিশ্চিত না)। **ফিক্স:** ৳ চিহ্নটাই বাদ দিয়ে ASCII **"Tk"** ব্যবহার করা হয়েছে (`COD Tk 1,120`) — পুরো লাইন `DejaVu Sans`-এই থাকে, কোনো ফন্ট-মিক্সিং হয় না, সমস্যাও নেই।

---

## ৫. লেবেল ডিজাইন/লে-আউট হায়ারার্কি

শুরুতে সহজ stacked layout ছিল (courier + COD একলাইনে, তারপর FROM/TO সমান গুরুত্বে)। ইউজার নিজে বাস্তব BD কুরিয়ার (Pathao/Steadfast) স্টিকারের মতো ডিজাইন করতে বলার পর রিডিজাইন করা হয়েছে — real courier API/integration doc থেকে পাওয়া field hierarchy অনুযায়ী (কোনো actual ছবি web search-এ পাওয়া যায়নি, শুধু ডকুমেন্টেড ফিল্ড লিস্ট + established convention):

1. **কুরিয়ার ব্যানার** (`courier_name`, সেন্টার্ড, বোল্ড আপারকেস)
2. **বক্সড COD amount** (`.cod-box` — বর্ডার + প্যাডিং, "CASH ON DELIVERY" লেবেল + বড় বোল্ড amount) — টাকা কালেক্ট করা সবচেয়ে জরুরি তথ্য, ওপরে
3. **Tracking ID + barcode** — hub scanning-এর জন্য ওপরের দিকে
4. **TO (RECEIVER)** — লেবেলের সবচেয়ে বড় টেক্সট (name 17-20px, phone 15-17px) — ডেলিভারি রাইডার প্রথমে এটাই পড়ে
5. **FROM (SENDER)** — কমপ্যাক্ট একলাইন, সেকেন্ডারি
6. **ORDER** — order# + item count, কমপ্যাক্ট একলাইন + item summary (Str::limit করা)
7. **QR footer** — "SCAN FOR DETAILS" caption + QR code পাশাপাশি (inline-block, §৪.৪)

Page height জেনারাসলি সেট করা আছে (58mm→145mm, 80mm→150mm) — content overflow করে নতুন page-এ চলে যাওয়া এড়াতে (§৪.১-এর সাথে related কিন্তু ভিন্ন কারণ: এখানে actual content height page-এর চেয়ে বেশি হয়ে যাচ্ছিল যখন ORDER/ITEMS টেবিল থেকে stacked lines-এ কনভার্ট করা হলো — বেশি vertical স্পেস লাগে)।

---

## ৬. ডিপ্লয়মেন্ট নোট

- **Backend PDF সার্ভিস/ব্লেড টেমপ্লেট পরিবর্তনের পর:** `php artisan view:clear` (compiled Blade cache) + `sudo -n /usr/bin/systemctl restart php8.3-fpm` (opcache) — দুটোই লাগে, নাহলে পুরনো কম্পাইলড ভিউ/অপকোড সার্ভ হতে থাকে।
- **`sudo` নন-ইন্টারঅ্যাক্টিভ flag বাধ্যতামূলক:** এই সার্ভারে `claude-dev` ইউজারের জন্য নির্দিষ্ট কমান্ডে passwordless sudo আছে (`sudoers -l` দেখো — `systemctl restart hybrid-frontend.service/php8.3-fpm/nginx`, `chown -R www-data:www-data .../.next`, পুরো `deploy-safe.sh` স্ক্রিপ্ট), কিন্তু bash tool-এর ভেতর থেকে চালালে `-n` (non-interactive) flag ছাড়া "a terminal is required to read the password" এরর দেয় যদিও NOPASSWD ম্যাচ করে — সবসময় `sudo -n <cmd>` ব্যবহার করা।
- **Frontend পরিবর্তনের পর (এই সেশনে হয়নি waybill ফিচারে, কিন্তু আগের turn-এ লাগসিল):** `sudo -n /var/www/hybrid-stack/frontend/scripts/deploy-safe.sh` — build + `systemctl restart hybrid-frontend.service` + live smoke-check, সব এক কমান্ডে (রুট হিসেবে চলে, পুরো স্ক্রিপ্টটাই sudoers-এ NOPASSWD)। প্রোডাকশন `next start` (pre-built `.next` সার্ভ করে) চালাচ্ছে systemd-এর মাধ্যমে — শুধু সোর্স ফাইল এডিট করলে লাইভ সাইটে reflect হয় না, rebuild+restart বাধ্যতামূলক।
- **টেস্টিং পদ্ধতি:** ফিচার ডেভেলপমেন্টের সময় `php artisan tinker` দিয়ে সরাসরি `WaybillPdfService::render()` কল করে `/tmp/.../scratchpad/*.pdf`-এ আউটপুট সেভ করে যাচাই করা হয়েছে — `pdfinfo` (page count/size) + `pdftotext -layout` (character-drop bug ধরার জন্য, visual bug ধরার জন্য না) + Read tool দিয়ে ভিজুয়াল রেন্ডার (visual bug ধরার জন্য — pdftotext দিয়ে §৪.৫-এর মতো visual-only বাগ ধরা যায় না, উল্টো ভুল কনফিডেন্স দেয়)।

---

## ৭. দ্রুত রেফারেন্স — কাজভেদে কোন ফাইল

| কাজ | ফাইল |
|---|---|
| Waybill PDF জেনারেশন লজিক | `app/Services/WaybillPdfService.php` |
| Waybill লে-আউট/স্টাইল | `resources/views/couriers/waybill.blade.php` |
| API এন্ডপয়েন্ট (single/bulk) | `app/Http/Controllers/Api/CourierController.php::waybill/waybillBulk` |
| রুট | `routes/api.php` (`staff_permission:courier` গ্রুপ) |
| প্রিন্ট বাটন/UI | `frontend/src/app/dashboard/courier/track/page.tsx` |
| Authenticated PDF ডাউনলোড হেল্পার | `frontend/src/lib/dashboard-client.ts::openAuthenticatedPdf` |
| dompdf বাগ রেফারেন্স (নতুন কোনো PDF ফিচার বানানোর আগে পড়ো) | §৪ (এই ফাইল) |
| বাংলা matra reordering হেল্পার | `WaybillPdfService::reorderBengaliMatras()` — অন্য কোনো dompdf+বাংলা ফিচারে দরকার হলে এখান থেকে কপি করা যায় (এখনো shared utility class-এ এক্সট্র্যাক্ট করা হয়নি) |
