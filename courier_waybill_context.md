# কুরিয়ার ওয়েবিল/লেবেল PDF — মাস্টার কনটেক্সট ফাইল

> এই ফাইলটা AI agent-দের জন্য: courier waybill/sticker PDF (এবং একই কোড-প্যাটার্ন শেয়ার করা order sales invoice, `OrderInvoicePdfService`) নিয়ে কোনো কাজ করার আগে পুরো কোডবেস স্ক্যান না করে এই ফাইল পড়লেই যথেষ্ট। শেষ আপডেট: 2026-08-12 (প্রথম ডেলিভারি + একাধিক dompdf বাগ ফিক্স + শপ প্রোফাইল ইন্টিগ্রেশন + অর্ডার ইনভয়েস ফিচার + COD amount ফিক্স + Pathao-স্টাইল লেবেল + **Sticker Template ফিচার — এখন ২২টা টেমপ্লেট সম্পূর্ণ, প্রিভিউ থাম্বনেইল সহ (§৬)**, একাধিক দিনে একাধিক সেশনে)। এই ফিচার `feature_roadmap_context.md`-এর #5 আইটেম — মূল ডেলিভারি সম্পূর্ণ ও deployed, কিন্তু **§৪.৫-এ একটা বাংলা টেক্সট রেন্ডারিং বাগ এখনো OPEN/আনসলভড, ইউজারের অনুরোধে ডিফার করা হয়েছে** — নিচে দেখো। **নতুন কোনো টেমপ্লেট/PDF লে-আউট বানানোর আগে §৬.৪ পড়ো** — dompdf-এর box-sizing না-থাকা নিয়ে একটা fundamental বাগ-ক্লাস ডকুমেন্টেড আছে সেখানে।
>
> স্ট্যাক: Laravel backend (`/var/www/hybrid-stack/backend`) + Next.js/TypeScript frontend (`/var/www/hybrid-stack/frontend`)। PDF রেন্ডারার `barryvdh/laravel-dompdf` (dompdf/dompdf ^3.0) — subscription/SMS-credit ইনভয়েসেও (`InvoicePdfService`) একই লাইব্রেরি ব্যবহার হয়, কিন্তু waybill-এ **নতুন ধরনের কনটেন্ট (barcode/QR ইমেজ, ছোট থার্মাল পেজ সাইজ, বড় বোল্ড ফন্ট)** এমন কিছু dompdf বাগ সামনে এনেছে যেগুলো ইনভয়েস টেমপ্লেটে কখনো ধরা পড়েনি।

> **🚨 Staff/Team role সচেতনতা:** কুরিয়ার মডিউল Pattern A (team-shared) — `CourierController`-এর সব মেথডই `Order::whereIn('user_id', auth()->user()->shopUserIds())` দিয়ে স্কোপড, নতুন `waybill`/`waybillBulk` মেথডও একই প্যাটার্ন অনুসরণ করেছে। রুট `staff_permission:courier` গ্রুপের ভেতরে (owner_only credential রুটের বাইরে) — নতুন `StaffPermission::MODULE_KEYS` entry লাগেনি, বিদ্যমান `courier` key-ই যথেষ্ট।

> **🚨 KNOWN OPEN ISSUE (2026-08-11) — বাংলা matra reordering এখনো পুরোপুরি ঠিক হয়নি, কাজ ডিফার করা হয়েছে।** ইউজার একাধিকবার রিপোর্ট করেছে যে waybill/order-invoice-এ কিছু বাংলা নাম/ঠিকানা এখনো ভুল দেখাচ্ছে (যেমন "মনিরুজ্জামান"), অথচ **এই ফাইলের এজেন্ট নিজে high-res raster টেস্ট করে সেই একই স্ট্রিং সঠিক রেন্ডার হতে দেখেছে** (regular ও bold দুই ওজনেই) এবং browser-caching সম্ভাবনাও রুল-আউট করার চেষ্টা করা হয়েছে (নিচে দেখো)। **রুট কজ এখনো অজানা/আনসলভড** — নতুন কেউ এই সমস্যা ধরতে আসলে §৪.৫ পুরোটা পড়ো, আগে যা যা ট্রাই করা হয়েছে সেটা রিপিট কোরো না, বরং সেখানে "পরবর্তী ধাপ" অংশে যা প্রস্তাব করা আছে সেখান থেকে শুরু করো।

---

## ১. ফিচার সারাংশ

সেলার এখন booked অর্ডারের জন্য প্রিন্টেবল থার্মাল ওয়েবিল/লেবেল PDF ডাউনলোড করতে পারে — একক অর্ডার বা bulk (একসাথে একাধিক নির্বাচিত অর্ডার, প্রতিটার জন্য আলাদা page)। লেবেলে থাকে: কুরিয়ার ব্যানার, বড় বক্সড COD amount, Code128 barcode + tracking ID, বড় প্রমিনেন্ট রিসিভার নাম/ফোন/ঠিকানা, ছোট সেন্ডার/অর্ডার তথ্য, এবং একটা QR code (order#, tracking ID, COD amount, ফোন এনকোড করা — phone-camera স্ক্যানের জন্য)। ৫৮mm ও ৮০mm — দুই সাইজের থার্মাল প্রিন্টারই সাপোর্ট করে (`?size=58|80` query param)।

---

## ২. Backend ফাইল

- **`app/Services/WaybillPdfService.php`** (নতুন) — মূল সার্ভিস, `InvoicePdfService.php`-এর প্যাটার্ন অনুসরণ করে (bundled `NotoSansBengali-Regular/Bold.ttf`, `Pdf::loadView()->setPaper()`)। মেথড: `render(Collection|array $orders, int $widthMm = 80): PdfDocument` — এক বা একাধিক অর্ডার নিয়ে multi-page PDF বানায় (এক অর্ডার = এক page)। প্রাইভেট হেল্পার: `barcodeDataUri()` (Code128 PNG, base64 data URI), `qrDataUri()` (QR PNG, base64 data URI, order summary টেক্সট এনকোড করে), `reorderBengaliMatras()` (§৪.৫ দেখো — জরুরি বাগ ফিক্স)।
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
Width-constrained + `box-sizing:border-box` label-এর ভেতরে ডান-align করা যেকোনো টেক্সট ব্লক তার **শেষ ক্যারেক্টার সাইলেন্টলি হারিয়ে ফেলে** — `1,120` রেন্ডার হতো `1,12`, একক-ডিজিট ITEMS count (`"1"`) পুরোপুরি উধাও হয়ে যেত। মিনিমাল repro-তে নামিয়ে কনফার্ম করা হয়েছে: এটা `text-align:right` এবং `float:right` দুটোতেই হয়, `<div>` এবং `<td>` (table cell) দুটোতেই হয়, ফন্ট/সাইজ/কনটেন্ট-length নির্বিশেষে সবসময় হয়। **ফিক্স:** এই লেবেলের ভেতরে কোথাও `text-align:right`/`float:right` টেক্সটের জন্য ব্যবহার করা হয়নি — কুরিয়ার নাম + COD amount একলাইনে left-aligned (`{{ courier }} · COD Tk {{ amount }}`), ORDER/ITEMS দুটো stacked left-aligned লাইন (২-কলাম right-aligned টেবিলের বদলে)। **নোট:** `text-align:center` টেস্ট করে সেফ পাওয়া গেছে (§৫-এ ব্যবহৃত হচ্ছে), শুধু `right`/`float:right` সমস্যাজনক।

### ৪.৩ Percentage-width/fixed-width `<img>` ডান মার্জিন ছাড়াই overflow করে
Barcode-এ `width:100%` এবং QR-এ fixed mm width — দুটোই printable area-র ডান প্রান্ত পেরিয়ে গিয়ে কেটে যেত (কোনো ডান মার্জিন ছাড়াই, বাস্তব থার্মাল প্রিন্টে ইউজার-রিপোর্টেড)। **ফিক্স:** ইমেজের width PHP সাইডে (service-এ) explicit mm হিসেবে হিসাব করা হয় — content width (label width − padding) থেকে ২mm সেফটি বাফার বিয়োগ করে (`$barcodeWidthMm`), percentage বা edge-flush সাইজিং কোনোটাই ব্যবহার হয় না।

### ৪.৪ `vertical-align:middle` (inline-block pair) ওপরের কনটেন্টের সাথে overlap করে
QR + caption টেক্সট `inline-block; vertical-align:middle` দিয়ে পাশাপাশি রাখলে — লম্বা QR ইমেজ (২০mm) ছোট টেক্সট ব্লকের (~৭mm) সাথে line-box-এর মাঝ বরাবর align হতে গিয়ে QR-এর ওপরের অংশ line-box-এর বাইরে ঠেলে দেয়, উপরের barcode-এর ওপর ওভারল্যাপ করে ফেলে। **ফিক্স:** `vertical-align:top` — দুটো element একই স্টার্ট-লাইনে anchor হয়, QR শুধু নিচের দিকে বাড়ে, ওপরের কনটেন্টে কখনো ঢোকে না।

### ৪.৫ Complex-script (বাংলা) শেপিং নেই — matra reordering নিজেই করতে হয় — ⚠️ **STATUS: OPEN/UNRESOLVED, 2026-08-11-এ ডিফার করা হয়েছে**

dompdf-এ কোনো OpenType/HarfBuzz-স্টাইল text shaping engine নেই — এটা glyph-গুলো raw Unicode storage order-এ আঁকে, ফন্টের GSUB reordering rule apply করে না। বাংলার pre-base vowel sign (**ি, ে, ৈ** — U+09BF/U+09C7/U+09C8) Unicode-এ কনসোনেন্টের **পরে** স্টোর হয় কিন্তু ভিজুয়ালি **আগে** দেখাতে হয় — reorder না করলে "জিসান" রেন্ডার হয় "জসিান", "হেডফোন" রেন্ডার হয় "হডেফোন"।

**যা যা ট্রাই করা হয়েছে (কালানুক্রমিকভাবে, সবগুলোই দুই ফাইলে ডুপ্লিকেট করা আছে — `WaybillPdfService::reorderBengaliMatras()` এবং `OrderInvoicePdfService::reorderBengaliMatras()`, শেয়ার্ড helper/trait-এ এক্সট্র্যাক্ট করা হয়নি):**

1. **প্রথম পাস** — regex দিয়ে ি/ে/ৈ-কে তাদের consonant cluster-এর (আগের virama-জোড়া conjunct সহ) আগে সরানো:
   ```php
   $consonant = '\x{0995}-\x{09B9}\x{09CE}\x{09DC}-\x{09DF}';
   $pattern = '/((?:[' . $consonant . ']\x{09CD})*[' . $consonant . '])([\x{09BF}\x{09C7}\x{09C8}])/u';
   preg_replace($pattern, '$2$1', $text);
   ```
   এটা "জিসান"/"শহিদ"/"তাসু"-এর মতো সহজ কেসে কাজ করেছিল বলে মনে হয়েছিল।
2. **দ্বিতীয় পাস (একই দিনে)** — ধরা পড়ল precomposed **ো/ৌ** (U+09CB/U+09CC)-ও ভাঙে ("হেডফোন" → "হেডফো·ন", missing-glyph mark) — ফন্টের ওগুলোর নিজস্ব glyph নেই, `ccmp` OpenType feature দিয়ে ে+া থেকে কম্পোজ হওয়ার কথা যেটা dompdf করে না। **ফিক্স যোগ হলো:** reorder-এর আগে ো→ে+া এবং ৌ→ে+ৗ ডিকম্পোজ করা।
3. **ইউজার আবার রিপোর্ট করল** ("মনিরুজ্জামান" ঠিকমতো দেখাচ্ছে না, একটা রিয়েল অর্ডার ইনভয়েসে) — এজেন্ট তখন `ReflectionMethod` দিয়ে codepoint-লেভেলে ডিবাগ করে দেখাল যে "মনিরুজ্জামান" রিঅর্ডার হয়ে "মিনরুজ্জামান" (স্ট্রিং অর্ডার) হয়, কারণ "মন" (ম+ন, কোনো virama ছাড়া দুইটা আলাদা akshara) থাকলে regex-টা "নি" ম্যাচ করে "িন" বানিয়ে দেয় — এবং এটা তাত্ত্বিকভাবে ambiguous মনে হয়েছিল (ি এখন ম-এর ঠিক পরে বসে, যেন ম-এর সাথে অ্যাটাচড)।
4. **কিন্তু isolated high-res raster টেস্টে** (dompdf দিয়ে সরাসরি "মিনরুজ্জামান" স্ট্রিং রেন্ডার করে `pdftoppm -r 300`/`-r 200` দিয়ে PNG-তে কনভার্ট করে চোখে দেখা) — regular ও bold দুই ওজনেই এটা ভিজুয়ালি **সঠিক** "মনিরুজ্জামান" হিসেবে রেন্ডার হয়েছে (ফন্টের ি গ্লিফ আপাতদৃষ্টিতে পরের ক্যারেক্টারের দিকে "ঝুঁকে" থাকে, আগেরটার দিকে না — তাই তাত্ত্বিক ambiguity বাস্তবে ঘটেনি)। অর্ডারের বাকি সব বাংলা স্ট্রিং (ঠিকানা, শপ নেম ইত্যাদি) একইভাবে আলাদা-আলাদা টেস্ট করেও সঠিক পাওয়া গেছে।
5. **তাহলে সমস্যাটা কী?** — সন্দেহ করা হলো browser caching (dompdf-এর `stream()` কোনো `Cache-Control` হেডার সেট করে না, তাই আগের buggy PDF ব্রাউজারে cached থেকে যেতে পারত)। **ফিক্স:** সব PDF-stream endpoint-এ (`order invoice`, `waybill` single+bulk, subscription/SMS-credit invoice) `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` হেডার যোগ করা হলো, প্লাস ফ্রন্টএন্ড `openAuthenticatedPdf()`-এ `cache: "no-store"`।
6. **এরপরও ইউজার বলল "এখনও সমস্যা সমাধান হয়নি"** — cache হেডার ডিপ্লয়ের পরেও। এই পয়েন্টে ইউজার কাজটা ডিফার করতে বলেছে।

**বর্তমান অবস্থা / প্যারাডক্স:** এজেন্টের নিজস্ব verification (poppler/pdftoppm দিয়ে rasterize করে PNG-তে চোখে দেখা) বারবার "ঠিক আছে" দেখাচ্ছে, কিন্তু ইউজারের নিজের ডিভাইসে/ভিউয়ারে এখনও ভুল দেখাচ্ছে বলে রিপোর্ট। এই gap-টা এখনো ব্যাখ্যা করা যায়নি।

**পরবর্তী ধাপ (এখানে থেকে শুরু করো, আগের ধাপগুলো রিপিট কোরো না):**
- **ইউজারের কাছ থেকে নির্দিষ্ট তথ্য নাও, অনুমান কোরো না:** কোন word/character ভুল দেখাচ্ছে (স্ক্রিনশট + জুম করে দেখানো), কোন ডিভাইস/অ্যাপ/ব্রাউজার দিয়ে খুলছে (Chrome/Firefox built-in PDF viewer? Adobe Reader? সরাসরি প্রিন্টার?), মোবাইল না ডেস্কটপ। আগের turn-এ এই নির্দিষ্ট তথ্য চাওয়া হয়নি — অনুমান করে multiple hypothesis টেস্ট করা হয়েছে যেগুলো ভুল প্রমাণিত হয়েছে।
- **PDF ফাইলটা সরাসরি ইউজারের কাছ থেকে নিয়ে ইন্সপেক্ট করো** (উনি যেটা ডাউনলোড করেছেন সেই আসল ফাইল/স্ক্রিনশট, নতুন করে জেনারেট করা নিজের কপি না) — `pdftotext`/`pdffonts` দিয়ে চেক করো এমবেডেড ফন্ট সাবসেট ও glyph mapping ঠিক আছে কিনা।
- **pdf.js (Chrome/Firefox built-in ভিউয়ার) vs poppler রেন্ডারিং তুলনা করো** — এজেন্টের হাইপোথিসিস ছিল pre-positioned glyph সব renderer-এ একই দেখানো উচিত (PDF content stream-এ glyph position আগে থেকেই বসানো থাকে), কিন্তু এটা ভেরিফাই করা হয়নি সরাসরি pdf.js দিয়ে রেন্ডার করে — dompdf-generated ফন্ট সাবসেটে কোনো malformed cmap/glyph-index থাকলে different renderer আলাদা আচরণ করতে পারে।
- **আরও দীর্ঘমেয়াদী বিকল্প বিবেচনা করো** যদি regex-reordering hack অবিশ্বস্ত প্রমাণিত হয়: (ক) প্রকৃত text-shaping (HarfBuzz PHP binding, যদি সার্ভারে ইনস্টলযোগ্য হয়) দিয়ে pre-shape করে গ্লিফ ইনডেক্স সরাসরি বসানো, (খ) headless Chrome/Puppeteer দিয়ে PDF জেনারেট করা (পূর্ণ browser text-shaping পাওয়া যায়, কিন্তু বড় আর্কিটেকচার পরিবর্তন — নতুন Node.js dependency, dompdf-এর পুরো replacement)।
- এই সমস্যাটা §৪.৪/border-issue-এর (সেই ইস্যুও poppler-এ reproduce হয়নি কিন্তু ইউজারের real printer-এ হয়েছিল) সাথে একই "poppler-এ ঠিক, ইউজারের ডিভাইসে ভুল" প্যাটার্নের — সম্ভবত সম্পর্কিত/একই রুট কজ, একসাথে investigate করা যেতে পারে।

**সাইড এফেক্ট (এখনো প্রযোজ্য):** এই রিঅর্ডার শুধু ভিজুয়াল রেন্ডারিং ঠিক করার চেষ্টা করে — PDF-এর টেক্সট লেয়ার (কপি/এক্সট্র্যাক্ট করলে) reordered (ভুল) ক্রমেই থাকবে।

### ৪.৬ Amount-এ ৳ গ্লিফ মিসিং হলে বক্স-ক্যারেক্টার দেখায়
বেস `DejaVu Sans` ফন্টে ৳ (টাকা সাইন) গ্লিফ নেই — `.i18n` (AppFont/NotoSansBengali) ক্লাস লাগবে। কিন্তু পুরো amount লাইন `.i18n` করলে §৪.২-এর মতোই আরেকটা রহস্যময় character-drop হতো (root cause পুরোপুরি আইসোলেট করা যায়নি — ফন্ট-মিক্সিং vs অন্য কিছু, নিশ্চিত না)। **ফিক্স:** ৳ চিহ্নটাই বাদ দিয়ে ASCII **"Tk"** ব্যবহার করা হয়েছে (`COD Tk 1,120`) — পুরো লাইন `DejaVu Sans`-এই থাকে, কোনো ফন্ট-মিক্সিং হয় না, সমস্যাও নেই।

---

## ৫. লেবেল ডিজাইন/লে-আউট হায়ারার্কি

শুরুতে সহজ stacked layout ছিল (courier + COD একলাইনে, তারপর FROM/TO সমান গুরুত্বে)। ইউজার নিজে বাস্তব BD কুরিয়ার (Pathao/Steadfast) স্টিকারের মতো ডিজাইন করতে বলার পর রিডিজাইন করা হয়েছে — real courier API/integration doc থেকে পাওয়া field hierarchy অনুযায়ী (কোনো actual ছবি web search-এ পাওয়া যায়নি, শুধু ডকুমেন্টেড ফিল্ড লিস্ট + established convention):

1. **কুরিয়ার ব্যানার** (`courier_name`, সেন্টার্ড, বোল্ড আপারকেস)
2. **বক্সড COD amount** (`.cod-box` — বর্ডার + প্যাডিং, "CASH ON DELIVERY" লেবেল + বড় বোল্ড amount) — টাকা কালেক্ট করা সবচেয়ে জরুরি তথ্য, ওপরে
3. **Tracking ID + barcode** — hub scanning-এর জন্য ওপরের দিকে
4. **TO (RECEIVER)** — লেবেলের সবচেয়ে বড় টেক্সট (name 17-20px, phone 15-17px) — ডেলিভারি রাইডার প্রথমে এটাই পড়ে
5. **FROM (SENDER)** — কমপ্যাক্ট একলাইন (নাম · ফোন) + ঠিকানা (থাকলে), সেকেন্ডারি — §৭ দেখো, এখন `ShopProfile`-এর ডেটা
6. **ORDER** — order# + item count, কমপ্যাক্ট একলাইন + item summary (Str::limit করা)
7. **QR footer** — "SCAN FOR DETAILS" caption + QR code পাশাপাশি (inline-block, §৪.৪)

Page height জেনারাসলি সেট করা আছে (58mm→145mm, 80mm→150mm) — content overflow করে নতুন page-এ চলে যাওয়া এড়াতে (§৪.১-এর সাথে related কিন্তু ভিন্ন কারণ: এখানে actual content height page-এর চেয়ে বেশি হয়ে যাচ্ছিল যখন ORDER/ITEMS টেবিল থেকে stacked lines-এ কনভার্ট করা হলো — বেশি vertical স্পেস লাগে)।

---

## ৬. Sticker Template ফিচার (2026-08-11 যোগ হয়েছে) — একাধিক লেবেল ডিজাইন, সেলার বেছে নেয়

আগে waybill-এর ডিজাইন ছিল দুটো ফিক্সড অপশন (§৫-এর generic thermal + Pathao-স্টাইল, courier_name দিয়ে auto-select)। ইউজার ২২টা রিয়েল কুরিয়ার/সেলার স্টিকার-স্যাম্পল (স্ক্রিনশট) দিয়ে বলেছে একটা "Sticker Template" ফিচার চাই — সেলার একটা ডিফল্ট টেমপ্লেট বেছে নেবে, চাইলে প্রতি-কুরিয়ারের জন্য আলাদা টেমপ্লেটও সেট করতে পারবে। **স্কোপ সিদ্ধান্ত (ইউজারের সাথে কনফার্ম করে):** ২২টা pixel-perfect ক্লোন না বানিয়ে আর্কিটেকচার + ৬টা variety-covering টেমপ্লেট আগে ডেলিভার করা হয়েছে (৪টা নতুন + আগে থেকে থাকা classic/pathao দুটো), বাকিগুলো ভবিষ্যতে একই প্যাটার্নে যোগ করা যাবে।

### ৬.১ Catalog ও ডাটা মডেল

- **`config/sticker_templates.php`** — ফিক্সড ক্যাটালগ (কোড, DB না) — প্রতিটা এন্ট্রি: `label_bn`/`label_en`, `view` (Blade partial path), `widthMm`/`heightMm` (native fixed size; `classic`-এর জন্য `null` — এটা এখনো caller-এর 58/80mm সিলেক্টর মেনে চলে)।
- **`sticker_settings` টেবিল** (Pattern B, owner-only, `user_id` unique) — `default_template_key` (default `'classic'`)। Model: `app/Models/StickerSetting.php`।
- **`sticker_courier_templates` টেবিল** (Pattern B, owner-only, sparse — শুধু কাস্টমাইজ করা কুরিয়ারগুলোর রো) — `user_id + courier_name` unique, `template_key`। Model: `app/Models/StickerCourierTemplate.php`।
- **রেজোলিউশন লজিক** (`WaybillPdfService::resolveTemplateKey()`): per-order courier_name → override টেবিলে খোঁজে → না পেলে shop-এর `default_template_key` → না পেলে `'classic'`।

### ৬.২ বাইশটা টেমপ্লেট (রেফারেন্স স্ক্রিনশট থেকে, সম্পূর্ণ ক্যাটালগ)

প্রথম সেশনে ৬টা (architecture + variety-covering সেট) ডেলিভার হয়েছিল, ব্যবহারকারীর অনুরোধে পরে বাকি ১৬টা ধাপে ধাপে (৪-৪টার ব্যাচে) যোগ হয়েছে — মোট ২২টা, প্রতিটা user-provided রেফারেন্স স্ক্রিনশটের একটা distinct ডিজাইনের সাথে ম্যাপ করা।

| Key | সাইজ | রেফারেন্স | মূল ফিল্ড |
|---|---|---|---|
| `classic` | 58/80mm (সিলেক্টর-নির্ভর) | আগে থেকে ছিল | কুরিয়ার ব্যানার, COD বক্স, barcode, TO/FROM/ORDER, QR |
| `pathao` | 100 x 78mm | Pathao ড্যাশবোর্ড sticker | logo, Shipped From/To, QR, weight, collectable amount, barcode, target hub/zone/area — §৫ |
| `cod_band_compact` | 2 x 3 inch | "Sticker 1" | ব্ল্যাক কুরিয়ার ব্যানার, বড় tracking ID, নাম/ফোন, ব্ল্যাক COD ব্যান্ড, SKU-qty প্রোডাক্ট সামারি, নোট, barcode |
| `invoice_table` | 75 x 50mm | RetailBD/EcomDrive পরিবার | শপ/ডেট/IV-no, কুরিয়ার+নাম+ফোন+ঠিকানা, barcode, parcel ID, প্রোডাক্ট টেবিল, sub total/delivery/due amount |
| `pos_bill` | 80mm (auto, cap 100mm) | "Pos Sticker" | সেন্টার্ড শপ নাম, "POS Machine Bill", issued-to/order-no/date, ব্ল্যাক-হেডার প্রোডাক্ট টেবিল, ব্ল্যাক TOTAL ব্যান্ড, seller/thank-you, barcode |
| `mini_cod` | 38 x 25mm | "Shokher Gadget" | শুধু শপ নাম + barcode + parcel ID + বড় COD amount — বাকি সব ইচ্ছাকৃতভাবে বাদ |
| `product_table_receipt` | 3 x 4 inch | "Sticker 2" | Help Line, Invoice No/Date, Invoice To ব্লক, barcode, প্রোডাক্ট টেবিল, sub total/delivery fee/due amount |
| `order_note_receipt` | 3 x 4 inch | "Sticker 4" | Hotline/Date, ব্ল্যাক Parcel ID বক্স (top-right), Invoice To, barcode, প্রোডাক্ট টেবিল, Order Note বক্স |
| `retail_compact` | 3 inch (auto height) | "Sticker 10/11" | Courier/নাম/ফোন + barcode, ঠিকানা, Parcel ID, প্রোডাক্ট টেবিল, Shipping Note বক্স |
| `qr_cod_enlarged` | 50 x 75mm | "Sticker 12" | বড় NAME/PHONE লেবেল, বর্ডারড barcode বক্স ("COURIER BARCODE" ক্যাপশন), ব্ল্যাক COD ব্যান্ড |
| `sku_rows_bold` | 3 x 4 inch | "Sticker 14" | বোল্ড ফোন, SKU-only রো (প্রোডাক্ট নাম/প্রাইস ছাড়া, শুধু SKU+Qty) |
| `shipping_note_no_barcode` | 3 x 4 inch | "Sticker 5" | **কোনো barcode নাই** (ইচ্ছাকৃত), Invoice To, প্রোডাক্ট টেবিল, ফিক্সড disclaimer + অর্ডার নোট |
| `logo_invoice_compact` | 75 x 50mm | "Sticker 7" | **শপ লোগো** (top-left, `ShopProfile.logo_path` থেকে base64 — নতুন `logoDataUri()` হেল্পার), courier/নাম/ফোন/ঠিকানা, barcode, প্রোডাক্ট টেবিল |
| `bengali_shipping_note` | 75 x 50mm | "Sticker 8" | নাম+qty-only প্রোডাক্ট লিস্ট (প্রাইস কলাম নাই), হাইলাইটেড শিপিং নোট বক্স |
| `sku_truncate_note` | 75 x 50mm | "Sticker 9" | টাইট-truncated SKU নাম, হলুদ-হাইলাইটেড শিপিং নোট বক্স |
| `dual_note_receipt` | 3 inch (auto height) | "Sticker 15" | শপ লোগো, প্রোডাক্ট টেবিল, **দুইটা আলাদা নোট বক্স** (Shipping Note + Order Note) |
| `sku_grid_square` | 3 x 3 inch | "Sticker 16" | স্কয়ার ক্যানভাস, SKU-only রো, একটা নোট বক্স |
| `color_size_grid` | 3 x 4 inch | "Sticker 18" | বড় ব্ল্যাক-বর্ডার Parcel ID বক্স (top-right) + নিচে barcode, প্রোডাক্ট টেবিলে **color/size variant** (`variant_info` থেকে, নতুন `formatVariant()`), Total Product/Total Bill |
| `minimal_list` | 45 x 35mm | "Sticker 19" | শুধু বড় merchant/phone + প্লেইন প্রোডাক্ট লিস্ট (নাম x qty) + Parcel ID — barcode নাই |
| `equals_price_band` | 3 x 4 inch | "Sticker 20" | ব্ল্যাক শপ-নেম ব্যানার (top), প্রোডাক্ট টেবিল "মূল্য/=" ফরম্যাটে (`750/=`), ব্ল্যাক COD ব্যান্ড, Order Note বক্স |
| `qr_recipient_focus` | 50 x 75mm | "Sticker 21" | ব্ল্যাক COD ব্যান্ড (Tk, ৳ না — §৪.৬), RECIPIENT সেকশন (বড় বোল্ড নাম), PRODUCT সেকশন + barcode |
| `no_price_multipage` | 75 x 50mm | "Sticker 22" | **কোথাও কোনো প্রাইস/টোটাল/due amount দেখানো হয় না** (কুরিয়ার রাইডারকে দাম দেখাতে না চাইলে) — শুধু নাম+qty, বড় শিপিং নোট |

সব ব্লেড partial `resources/views/couriers/templates/{key}.blade.php`-এ, মাস্টার `resources/views/couriers/waybill.blade.php` একটাই `<style>` ব্লকে সব টেমপ্লেটের CSS (প্রতিটা টেমপ্লেটের নিজস্ব ২-৩ অক্ষরের prefix — `.p-*`, `.cbc-*`, `.it-*`, `.pb-*`, `.mc-*`, `.ptr-*`, `.onr-*`, `.rtc-*`, `.qce-*`, `.srb-*`, `.snb-*`, `.lic-*`, `.bsn-*`, `.stn-*`, `.dnr-*`, `.sgs-*`, `.csg-*`, `.ml-*`, `.epb-*`, `.qrf-*`, `.npm-*`) রাখে, শুধু active টেমপ্লেটের partial `@include` করে।

`WaybillPdfService`-এ প্রতিটা টেমপ্লেটের জন্য একটা `*Geometry()` প্রাইভেট মেথড আছে যেটা widthMm/heightMm থেকে সব padding/column/barcode/QR mm-সাইজ প্রি-কম্পিউট করে `$g` অ্যারেতে — `geometryFor()` ডিসপ্যাচার দুটো এন্ট্রি পয়েন্ট (`render()` আসল অর্ডারের জন্য, `renderPreview()` প্রিভিউ থাম্বনেইলের জন্য) দুটোতেই শেয়ার হয়। বেশ কয়েকটা টেমপ্লেট **কমন হেল্পার** `productTableColumns()` রিইউজ করে (name/qty/price/total ৪-কলাম split) — একই লজিক বারবার লেখা এড়াতে। নতুন টেমপ্লেট যোগ করতে হলে এই প্যাটার্ন অনুসরণ করা (নিচে §৬.৪-এর নিয়ম মেনে): (1) `config/sticker_templates.php`-এ এন্ট্রি, (2) `*Geometry()` মেথড + `geometryFor()`-এ ম্যাচ কেস, (3) Blade partial, (4) মাস্টার ফাইলে prefix করা CSS, (5) `php artisan tinker` দিয়ে `renderPreview()` কল করে `pdfinfo`/`pdftoppm`-দিয়ে টেস্ট (single page, margin/overflow চেক)।

### ৬.৩ একটা PDF = একটা পেজ সাইজ (bulk-এ মিক্সড টেমপ্লেট)

dompdf named `@page` selector সাপোর্ট করে না (`Stylesheet::_parse_css`-এর `"page"` কেস-এ `:first`/`:left`/`:right`/`:odd`/`:even` ছাড়া বাকি সব `default: break 2;`-এ silently ড্রপ হয়ে যায় — সোর্স গ্রেপ করে ভেরিফাই করা হয়েছে)। মানে একটা PDF ডকুমেন্টে একটাই ফিজিক্যাল পেজ সাইজ থাকতে পারে।

- **Bulk-এর সব অর্ডার একই টেমপ্লেটে resolve করলে** → সেই টেমপ্লেটের native সাইজ পুরো ডকুমেন্টে।
- **মিক্সড হলে** (আলাদা কুরিয়ার, আলাদা override) → পুরো ডকুমেন্ট `'classic'`-এ ফলব্যাক করে (একমাত্র টেমপ্লেট যেটা যেকোনো কন্টেন্ট/সাইজে ফিট করার জন্য ডিজাইন করা, ফিক্সড নেটিভ সাইজ নেই)। **ইউজারের individual template choice honor করা হয় না মিক্সড ব্যাচে** — একক অর্ডার প্রিন্ট বা same-courier bulk (কমন কেস) এতে প্রভাবিত হয় না।
- Per-template-per-page সঠিকভাবে মার্জ করতে হলে আলাদাভাবে রেন্ডার করে `setasign/fpdi` দিয়ে merge করা যেত (প্রতিটা page-এর নিজস্ব সাইজ প্রিজার্ভ করে) — এই স্কোপে ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে (নতুন ডিপেন্ডেন্সি + জটিলতা, rare edge case-এর জন্য যথেষ্ট justify হয়নি)। ভবিষ্যতে দরকার হলে এটা একটা ভালো ফলো-আপ।

### ৬.৪ 🚨 নতুন dompdf বাগ ক্লাস — box-sizing পুরোপুরি আনসাপোর্টেড

এই ফিচার বানানোর সময় §৪-এর তালিকায় থাকা বাগগুলোর চেয়ে **আরও fundamental** একটা dompdf সীমাবদ্ধতা পাওয়া গেছে, যেটা future PDF কাজের জন্য critical:

**dompdf `box-sizing` CSS প্রপার্টি একদমই সাপোর্ট করে না** (পুরো ভেন্ডর সোর্সে গ্রেপ করে zero matches — প্রপার্টিটা silently ignore হয়)। মানে:

1. **এক্সপ্লিসিট width সবসময় content-box** — কোনো এলিমেন্টে `width: Xmm; padding: Ymm;` দিলে তার **আসল দৃশ্যমান প্রস্থ হয় X + 2Y**, X না (border-box আচরণ আশা করাটাই ভুল, `box-sizing: border-box` লিখলেও তা কোনো effect করে না — সেটাও শুধু silently ignore হয়)।
2. **`width: auto`** (কোনো width declare না করলে) একটা ভিন্ন, নিজস্ব বাগ আছে: child তার প্যারেন্টের "content minus padding" স্পেস ফিল করে না (যেমন CSS spec অনুযায়ী হওয়ার কথা) — বরং প্যারেন্টের **literal declared `width` value** ফিল করে, প্যারেন্টের নিজের padding হিসাবের বাইরে গিয়ে। একটা আইসোলেটেড টেস্ট দিয়ে কনফার্ম করা হয়েছে (`.outer{width:80mm;padding:10mm}` এর ভেতর `.autoband`-এ কোনো width না দিলে সেটা 80mm ফিল করে, 60mm না, ফলে পেজ-এজ পর্যন্ত bleed করে)।

**ব্যবহারিক প্রভাব ও কী করতে হবে:**
- কোনো এলিমেন্টের ***নিজস্ব দৃশ্যমান edge*** সুনির্দিষ্ট জায়গায় থামা দরকার হলে (কালারড ব্যান্ড, বর্ডার বক্স, টেবিল) — **সবসময় এক্সপ্লিসিট mm width দাও, কখনো `auto`/`100%` না** (`pb-total-band`-এ এটা মিস করে প্রথমে পেজ-এজে bleed করেছিল, ফিক্স হয়েছে explicit width দিয়ে)।
- সেই width-এর ভ্যালু বসানোর সময় এলিমেন্টের **নিজের horizontal padding বাদ দিয়ে** বসাও (`intended_visible_width - left_padding - right_padding`) — নাহলে padding যোগ হয়ে overflow করবে (`pb-items-head td`-এ এই বাগ ধরা পড়েছিল, ফিক্স: horizontal padding পুরো ০ করে দেওয়া, column width দিয়েই স্পেসিং ম্যানেজ করা — এটাই সবচেয়ে সহজ/নিরাপদ প্যাটার্ন)।
- চাইলে horizontal padding সম্পূর্ণ এড়িয়ে যাওয়াই সবচেয়ে নিরাপদ (এই ফাইলের বেশিরভাগ টেবিল/সেল CSS এখন তাই করে — `padding: Ymm 0` বা `padding: 0`)।
- Top-level `.{key}-label` wrapper div-গুলো (`width:$pageWidthMm; padding:$g.paddingMm`) টেকনিক্যালি এই বাগের শিকার (content-box অনুযায়ী প্রকৃত edge পেজের বাইরে চলে যায়) — কিন্তু এটা harmless, কারণ ওদের নিজস্ব কোনো visible background/border নাই; ভেতরের প্রতিটা child নিজের এক্সপ্লিসিট width (content-width হিসেবে প্রি-ক্যালকুলেটেড) নিয়ে আসে, তাই আসল visible content সবসময় সঠিক জায়গায় বসে, wrapper-এর নিজের oversized বক্স পেজ-বাউন্ডারিতে invisible-ভাবে clip হয়ে যায়।
- **নতুন কোনো টেমপ্লেট/PDF ফিচারে কাজ করার আগে এই সেকশন পড়ো** — এটা §৪-এর বাগগুলোর (text-align:right char-drop, image %-width overflow, table auto-layout overflow) root cause-ও একই পরিবারের, আরও ব্যাপকভাবে এখানে বোঝা গেছে।

### ৬.৫ Backend/Frontend ফাইল

- **Controller:** `app/Http/Controllers/Api/StickerTemplateController.php` — `catalog()` (GET, static list), `show()` (GET, বর্তমান default + overrides), `update()` (POST, দুটোই সেভ করে — override সেট পুরোটা replace করে, diff করে না)।
- **রুট:** `owner_only` গ্রুপ, `sticker-templates` prefix — `GET /catalog`, `GET /settings`, `POST /settings` (`routes/api.php`, shop-profile গ্রুপের ঠিক পরে)।
- **ফ্রন্টএন্ড:** `frontend/src/app/dashboard/settings/sticker-templates/page.tsx` (নতুন সেটিংস পেজ) — টেমপ্লেট গ্যালারি (কার্ড ক্লিক করে ডিফল্ট সেট), প্রতি-কুরিয়ার override ড্রপডাউন (steadfast/pathao/redx/carrybee/paperfly/manual), প্রিভিউ থাম্বনেইল + ক্লিক করলে enlarge modal (§৬.৬ দেখো)। মেনুতে যোগ হয়েছে `user-shell.tsx`-এ (Settings গ্রুপ, Shop Profile-এর ঠিক পরে)।

### ৬.৬ প্রিভিউ থাম্বনেইল (2026-08-12 যোগ হয়েছে)

প্রতিটা টেমপ্লেট কার্ডে একটা রিয়েল রেন্ডারড প্রিভিউ ছবি দেখা যায় (নিছক টেক্সট লেবেল না) — সেলার ডিজাইন না বেছেই দেখতে পারে কেমন দেখাবে।

- **`WaybillPdfService::renderPreview(string $templateKey)`** — কোনো real `Order`/DB ছাড়াই একটা single-label PDF রেন্ডার করে, fixed demo ডেটা দিয়ে (`new Order([...])` — unsaved Eloquent instance, শুধু attribute access-এর জন্য, `->save()` কখনো কল হয় না)। `render()`-এর মতোই `geometryFor()` শেয়ার করে, তাই preview আর real render একদম একই layout logic ব্যবহার করে — কোনো ডুপ্লিকেট টেমপ্লেট-স্পেসিফিক কোড নাই।
- **`app/Services/StickerPreviewService.php`** — PDF-কে PNG-তে কনভার্ট করে `pdftoppm -r 150 -png -singlefile` (Symfony Process দিয়ে শেল-আউট, `poppler-utils` — এই প্রজেক্টের নিজস্ব ডিবাগিং ওয়ার্কফ্লো-তেও ব্যবহৃত, সার্ভারে কনফার্মড ইনস্টলড)। ফলাফল `storage/app/public/sticker-previews/{key}.png`-এ ক্যাশড থাকে।
- **অটো-ইনভ্যালিডেশন:** ক্যাশড PNG-র mtime বনাম টেমপ্লেটের Blade partial ফাইলের mtime তুলনা করে — partial-এ কোনো ডিজাইন পরিবর্তন হলে পরের রিকোয়েস্টেই নতুন প্রিভিউ অটো-রিজেনারেট হয়, ম্যানুয়াল cache-bust লাগে না।
- **`php artisan sticker-templates:warm-previews`** (নতুন artisan command) — সব টেমপ্লেটের প্রিভিউ deploy-টাইমে প্রি-জেনারেট করে রাখে, যাতে ডিপ্লয়ের পর প্রথম যে সেলার সেটিংস পেজ খুলবে তাকে live render+rasterize-এর খরচ বহন করতে না হয় (ঐচ্ছিক — না চালালেও `previewUrl()` on-demand জেনারেট করবে, শুধু প্রথম রিকোয়েস্টটা একটু স্লো হবে)।
- **এন্ডপয়েন্ট:** `catalog()`-এর রেসপন্সে প্রতিটা এন্ট্রিতে `preview_url` যোগ হয়েছে (null হতে পারে যদি rasterize ফেইল করে — frontend তখন "প্রিভিউ নাই" দেখায়, catalog fetch ব্লক হয় না)। ছবিটা `<img src="{preview_url}">` হিসেবে সরাসরি লোড হয় (Authorization header পাঠানো যায় না img tag থেকে), তাই এটা পাবলিক disk URL — `ShopProfile` লোগোর মতোই কোনো auth middleware ছাড়া অ্যাক্সেসযোগ্য (sensitive কিছু না, শুধু ফিক্সড ডেমো ডেটার রেন্ডার)।

**🚨 ডিপ্লয়মেন্ট গটচা (2026-08-12-এ ধরা পড়েছে):** প্রিভিউ থাম্বনেইলের ফ্রন্টএন্ড কোড (`<img>` রেন্ডারিং, লাইটবক্স) ব্যাকএন্ড ইনফ্রার সাথে একই সেশনে লেখা হলেও ভুলবশত ডিপ্লয় করা হয়নি — ব্যাকএন্ডে ৪ ব্যাচ (১৬টা) নতুন টেমপ্লেট যোগ করার সময় "ফ্রন্টএন্ডে কোনো পরিবর্তন লাগেনি" ধরে নিয়ে শুধু ব্যাকএন্ড রিস্টার্ট করা হয়েছিল — ফলে লাইভ সাইটে অনেকক্ষণ পুরনো (থাম্বনেইল-বিহীন, শুধু টেক্সট কার্ড) ফ্রন্টএন্ড বিল্ড সার্ভ হচ্ছিল, যদিও ব্যাকএন্ড API সঠিকভাবে `preview_url` রিটার্ন করছিল। ইউজার রিপোর্ট করার পর ধরা পড়ে, `deploy-safe.sh` চালিয়ে ফিক্স হয়েছে। **শিক্ষা:** ফ্রন্টএন্ড ফাইল এডিট করা মানেই ডিপ্লয় হয়ে গেছে না — `git diff`/`git status`-এ ফ্রন্টএন্ড ফাইল পরিবর্তিত দেখলে "deploy বাকি আছে" ধরে নিতে হবে, কাজ শেষে backend আর frontend দুটোরই deploy স্ট্যাটাস আলাদাভাবে যাচাই করা।

---

## ৭. Shop Profile (2026-08-11 যোগ হয়েছে) — waybill-এর FROM (SENDER) ডেটার সোর্স

`/dashboard/settings/shop` (আগে placeholder ছিল) এখন real ফিচার — শপের নাম, ফোন, ইমেইল (ঐচ্ছিক), ঠিকানা, লোগো সেভ করা যায়। **Pattern B** (owner-only — courier settings/subscription-এর মতো, staff কখনো এডিট করতে পারবে না)।

- **DB:** `shop_profiles` টেবিল, `user_id` unique FK (এক শপে একটা রো)। `logo_path` (storage disk-এ relative path, ডিলিট/রিপ্লেসের জন্য) + `logo_url` (আপলোডের সময় হিসাব করা পূর্ণ URL, `LandingMediaAsset`-এর কনভেনশন অনুসরণ করে — প্রতিবার অ্যাক্সেসরে ডিরাইভ করা হয় না)।
- **Model:** `app/Models/ShopProfile.php`।
- **Controller:** `app/Http/Controllers/Api/ShopProfileController.php` — `show()` (GET, না থাকলে `User.name`/`mobile` দিয়ে non-persisted প্রি-ফিল করে), `update()` (POST, multipart — text ফিল্ড + ঐচ্ছিক `logo` ফাইল + `remove_logo` বুলিয়ান একই রিকোয়েস্টে)। লোগো `storage/app/public/shop-logos/{ownerId}`-এ (public disk, `storage:link` আগে থেকেই সেটআপ করা আছে)।
- **রুট:** `owner_only` গ্রুপে (`routes/api.php`, courier গ্রুপের ঠিক আগে) — `GET/POST /shop-profile`।
- **ফ্রন্টএন্ড:** `frontend/src/app/dashboard/settings/shop/page.tsx` — ফর্ম + লোগো আপলোড/প্রিভিউ/রিমুভ, সবসময় `FormData` দিয়ে POST করে (JSON না, কারণ ফাইলসহ/ছাড়া দুই ক্ষেত্রেই একই এন্ডপয়েন্ট)।
- **Waybill ইন্টিগ্রেশন:** `WaybillPdfService::render()`-এ প্রতিটা লেবেলের জন্য owner id দিয়ে (per-request memoized — bulk-এ সব অর্ডার একই শপের হয়) `ShopProfile` লুকআপ করা হয়; `shopName`/`shopPhone` এখন `$profile->shop_name/phone ?? $shop->name/mobile` (প্রোফাইল সেটআপ না করা থাকলে অ্যাকাউন্টের নিজের নাম/মোবাইলে ফলব্যাক করে, লেবেল কখনো ফাঁকা দেখায় না) — এবং নতুন `shopAddress` ফিল্ড FROM (SENDER)-এ ঠিকানা লাইন হিসেবে যোগ হয়েছে (সেট করা থাকলে)। **লোগো waybill-এ বসানো হয়নি** — ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে (§৪-এ ডকুমেন্টেড অনেকগুলো dompdf ইমেজ-সম্পর্কিত বাগের পর নতুন কোনো ইমেজ রিস্ক না নেওয়ার সিদ্ধান্ত, এবং বাস্তব কুরিয়ার স্টিকারে সাধারণত মার্চেন্ট লোগো থাকেই না — কুরিয়ারের নিজের ব্র্যান্ডিং-ই প্রাধান্য পায়)। ভবিষ্যতে লোগো অন্য কোথাও (ড্যাশবোর্ড টপবার, পাবলিক ল্যান্ডিং পেজ, ইনভয়েস) দেখাতে হলে সেটা আলাদা কাজ — এখনো কোথাও wire করা হয়নি।

---

## ৮. Order Sales Invoice (2026-08-11 যোগ হয়েছে) — waybill-এর সাথে কোড-প্যাটার্ন শেয়ার করে

`OrderInvoicePdfService` — প্রতিটা অর্ডারের জন্য seller→customer A4 sales invoice PDF (Bill To, itemized product টেবিল, subtotal/discount/shipping/total, shop logo/নাম/ঠিকানা)। **`InvoicePdfService`-এর থেকে আলাদা** (ওটা platform→seller billing invoice — subscription/SMS credit)।

- **Backend:** `app/Services/OrderInvoicePdfService.php` (নতুন) — `render(Order $order): PdfDocument`। নিজের কপি আছে `reorderBengaliMatras()`-এর (§৪.৫ দেখো, OPEN ইস্যু) এবং একটা নতুন `logoDataUri()` হেল্পার — `ShopProfile.logo_url`-এর `https://` লিংক dompdf fetch করতে পারে না (`enable_remote` false, SSRF প্রিভেনশনের জন্য ইচ্ছাকৃত) — তাই লোগো ফাইল সরাসরি local disk (`Storage::disk('public')`) থেকে পড়ে base64 data URI বানানো হয়, নেটওয়ার্ক কল ছাড়াই (barcode/QR-এর মতোই)।
- **টেমপ্লেট:** `resources/views/invoices/order-invoice.blade.php` — safe A4-width প্যাটার্ন (waybill-এর ৫৮/৮০mm সংকীর্ণ কনটেক্সটের বাগগুলো এখানে প্রযোজ্য না, কারণ generous width; existing `invoices/document.blade.php`-এর মতোই `text-align:right` নিরাপদে ব্যবহার হয়েছে টোটাল/অ্যামাউন্ট কলামে)।
- **Controller/রুট:** `OrderController::invoicePdf(int $id, OrderInvoicePdfService $service)` — `GET /orders/{order}/invoice`, `staff_permission:orders` গ্রুপ (Pattern A, `shopUserIds()`)।
- **ফ্রন্টএন্ড:** "Download Invoice"/"Invoice" বাটন দুই জায়গায় — অর্ডার ডিটেইল পেজ (`dashboard/orders/[id]/page.tsx`, টপ অ্যাকশন বার) এবং অর্ডার লিস্ট পেজ (`dashboard/orders/page.tsx`, প্রতি row-এ Actions কলামে)। দুটোই `openAuthenticatedPdf()` ব্যবহার করে।
- **`variant_info` শেপ:** flat `{optionName: value}` map (যেমন `{"Color":"Red","Size":"XL"}`), array-of-objects না — এই শেপ ভুল ধরে প্রথমবার লেখা হয়েছিল, frontend-এর `order-item-grid.tsx`/`order-intake-form.tsx` দেখে ঠিক করা হয়েছে।

---

## ৯. PDF ডাউনলোড কখনো ব্রাউজার-cached হবে না (2026-08-11)

`dompdf`-এর `stream()` মেথড কোনো `Cache-Control` হেডার সেট করে না (barryvdh/laravel-dompdf ভেন্ডর কোড-এ ভেরিফাই করা হয়েছে) — মানে GET রিকোয়েস্ট heuristic browser caching-এর শিকার হতে পারে, একই order/purchase-এর জন্য বারবার ডাউনলোড করলে **আগের (হয়তো বাগযুক্ত) কপি** ফেরত আসতে পারে সার্ভার-সাইড ফিক্স ডিপ্লয়ের পরেও। এটা ঠিক §৪.৫-এর ডিবাগিং-এর সময় সন্দেহ করা হয়েছিল (নিশ্চিতভাবে প্রমাণিত না হলেও)।

**ফিক্স (৫টা PDF-stream endpoint-এই):** `->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')` চেইন করা হয়েছে —
- `OrderController::invoicePdf`
- `CourierController::waybill` + `waybillBulk`
- `SmsCreditPurchaseController::invoicePdf`
- `SubscriptionController::invoicePdf`

প্লাস ফ্রন্টএন্ড `frontend/src/lib/dashboard-client.ts::openAuthenticatedPdf()`-এ `cache: "no-store"` (defense-in-depth)।

**নোট:** `->header()` `Illuminate\Http\ResponseTrait`-এর মেথড (dompdf-এর `stream()` আসলে `Illuminate\Http\Response` রিটার্ন করে, যদিও controller signature-এ প্রায়ই `Symfony\Component\HttpFoundation\Response` টাইপ-হিন্ট করা থাকে) — রানটাইমে কাজ করে যাচাই করা হয়েছে (`tinker`-এ `get_class()` + হেডার ভ্যালু চেক করে)।

---

## ১০. ডিপ্লয়মেন্ট নোট

- **Backend PDF সার্ভিস/ব্লেড টেমপ্লেট পরিবর্তনের পর:** `php artisan view:clear` (compiled Blade cache) + `sudo -n /usr/bin/systemctl restart php8.3-fpm` (opcache) — দুটোই লাগে, নাহলে পুরনো কম্পাইলড ভিউ/অপকোড সার্ভ হতে থাকে।
- **`sudo` নন-ইন্টারঅ্যাক্টিভ flag বাধ্যতামূলক:** এই সার্ভারে `claude-dev` ইউজারের জন্য নির্দিষ্ট কমান্ডে passwordless sudo আছে (`sudoers -l` দেখো — `systemctl restart hybrid-frontend.service/php8.3-fpm/nginx`, `chown -R www-data:www-data .../.next`, পুরো `deploy-safe.sh` স্ক্রিপ্ট), কিন্তু bash tool-এর ভেতর থেকে চালালে `-n` (non-interactive) flag ছাড়া "a terminal is required to read the password" এরর দেয় যদিও NOPASSWD ম্যাচ করে — সবসময় `sudo -n <cmd>` ব্যবহার করা।
- **Frontend পরিবর্তনের পর:** `sudo -n /var/www/hybrid-stack/frontend/scripts/deploy-safe.sh` — build + `systemctl restart hybrid-frontend.service` + live smoke-check, সব এক কমান্ডে (রুট হিসেবে চলে, পুরো স্ক্রিপ্টটাই sudoers-এ NOPASSWD)। প্রোডাকশন `next start` (pre-built `.next` সার্ভ করে) চালাচ্ছে systemd-এর মাধ্যমে — শুধু সোর্স ফাইল এডিট করলে লাইভ সাইটে reflect হয় না, rebuild+restart বাধ্যতামূলক।
- **টেস্টিং পদ্ধতি:** ফিচার ডেভেলপমেন্টের সময় `php artisan tinker` দিয়ে সরাসরি `WaybillPdfService::render()`/`OrderInvoicePdfService::render()` কল করে `/tmp/.../scratchpad/*.pdf`-এ আউটপুট সেভ করে যাচাই করা হয়েছে — `pdfinfo` (page count/size) + `pdftotext -layout` (character-drop bug ধরার জন্য, visual bug ধরার জন্য না) + `pdftoppm -r 300` দিয়ে high-res PNG-তে rasterize করে Read tool দিয়ে ভিজুয়াল ইন্সপেকশন (visual bug ধরার জন্য — pdftotext দিয়ে §৪.৫-এর মতো visual-only বাগ ধরা যায় না, উল্টো ভুল কনফিডেন্স দেয়)। **⚠️ এই পদ্ধতির সীমাবদ্ধতা:** poppler (pdftoppm/pdftotext)-এ সঠিক দেখানো মানেই ইউজারের আসল ভিউয়ার/প্রিন্টারে সঠিক দেখাবে তার গ্যারান্টি না — §৪.৪ (border) ও §৪.৫ (matra) দুটো ক্ষেত্রেই এই gap দেখা গেছে।

---

## ১১. দ্রুত রেফারেন্স — কাজভেদে কোন ফাইল

| কাজ | ফাইল |
|---|---|
| Waybill PDF জেনারেশন লজিক (template resolve + সব geometry) | `app/Services/WaybillPdfService.php` |
| Waybill মাস্টার লে-আউট শেল + সব টেমপ্লেটের CSS | `resources/views/couriers/waybill.blade.php` |
| প্রতিটা টেমপ্লেটের HTML markup | `resources/views/couriers/templates/{key}.blade.php` |
| Sticker Template ক্যাটালগ (২২টা) | `config/sticker_templates.php`, §৬.২ |
| Sticker Template সেটিংস API | `app/Http/Controllers/Api/StickerTemplateController.php` |
| Sticker Template সেটিংস পেজ (প্রিভিউ গ্যালারি সহ) | `frontend/src/app/dashboard/settings/sticker-templates/page.tsx` |
| প্রিভিউ থাম্বনেইল জেনারেশন | `app/Services/StickerPreviewService.php`, §৬.৬ |
| প্রিভিউ warm-cache artisan command | `app/Console/Commands/WarmStickerPreviews.php` |
| dompdf-এ box-sizing/width বাগ (⚠️ নতুন কোনো টেমপ্লেট বানানোর আগে পড়ো) | §৬.৪ |
| Waybill API এন্ডপয়েন্ট (single/bulk) | `app/Http/Controllers/Api/CourierController.php::waybill/waybillBulk` |
| Waybill প্রিন্ট বাটন/UI | `frontend/src/app/dashboard/courier/track/page.tsx` |
| Order sales invoice জেনারেশন লজিক | `app/Services/OrderInvoicePdfService.php` |
| Order invoice লে-আউট/স্টাইল | `resources/views/invoices/order-invoice.blade.php` |
| Order invoice API এন্ডপয়েন্ট | `app/Http/Controllers/Api/OrderController.php::invoicePdf` |
| Order invoice ডাউনলোড বাটন/UI | `dashboard/orders/page.tsx` (list) + `dashboard/orders/[id]/page.tsx` (detail) |
| Shop Profile (নাম/ফোন/ঠিকানা/লোগো + sticker phone/address টগল) | §৭, `app/Models/ShopProfile.php` + `ShopProfileController.php` |
| রুট (waybill + shop-profile + sticker-templates) | `routes/api.php` (`staff_permission:courier` / `owner_only` গ্রুপ) |
| Authenticated PDF ডাউনলোড হেল্পার | `frontend/src/lib/dashboard-client.ts::openAuthenticatedPdf` |
| dompdf বাগ রেফারেন্স (নতুন কোনো PDF ফিচার বানানোর আগে পড়ো) | §৪, §৬.৪ (এই ফাইল) |
| বাংলা matra reordering হেল্পার (⚠️ এখনো OPEN ইস্যু, §৪.৫ দেখো) | `WaybillPdfService::reorderBengaliMatras()` + `OrderInvoicePdfService::reorderBengaliMatras()` (ডুপ্লিকেট, শেয়ার্ড ক্লাসে এক্সট্র্যাক্ট করা হয়নি) |
