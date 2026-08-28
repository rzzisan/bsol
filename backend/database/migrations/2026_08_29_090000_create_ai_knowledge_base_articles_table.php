<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Lets the AI agent answer "how do I use module X" questions across
        // the whole platform, not just account-specific lookups —
        // support_ticketing_ai_context.md §"platform how-to knowledge".
        // Admin-editable via /admin/settings/ai-knowledge-base — this
        // migration just seeds a first, reasonably complete pass.
        Schema::create('ai_knowledge_base_articles', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('content');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $now = now();
        $articles = self::seedArticles();
        DB::table('ai_knowledge_base_articles')->insert(array_map(
            fn (array $row, int $i) => $row + ['is_active' => true, 'sort_order' => $i, 'created_at' => $now, 'updated_at' => $now],
            $articles,
            array_keys($articles),
        ));
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_knowledge_base_articles');
    }

    /** @return list<array{slug: string, title: string, content: string}> */
    private static function seedArticles(): array
    {
        return [
            [
                'slug' => 'orders',
                'title' => 'অর্ডার ম্যানেজমেন্ট',
                'content' => "ড্যাশবোর্ড → অর্ডার মেনুতে অর্ডার তৈরি ও ম্যানেজ করা যায়।\n- 'সকল অর্ডার' (/dashboard/orders): সব অর্ডারের তালিকা, স্ট্যাটাস অনুযায়ী ফিল্টার।\n- 'নতুন অর্ডার' (/dashboard/orders/create): ম্যানুয়ালি অর্ডার এন্ট্রি করা যায়।\n- 'বাল্ক ইমপোর্ট' (/dashboard/orders/bulk-import): একসাথে অনেক অর্ডার CSV/এক্সেল দিয়ে আপলোড করা যায়।\n- 'ফ্রড চেক' (/dashboard/orders/fraud-check): কোনো ফোন নাম্বার আগে ডেলিভারি ফেইল করেছে কিনা যাচাই।\n- 'ব্ল্যাকলিস্ট' (/dashboard/orders/blacklist): সমস্যাযুক্ত কাস্টমারদের ব্লক করা।\nঅর্ডার তৈরি হলে সেখান থেকেই কুরিয়ারে বুকিং দেওয়া যায়।",
            ],
            [
                'slug' => 'products',
                'title' => 'প্রোডাক্ট ও স্টক ম্যানেজমেন্ট',
                'content' => "ড্যাশবোর্ড → প্রোডাক্ট মেনু থেকে প্রোডাক্ট, ক্যাটাগরি ও স্টক নিয়ন্ত্রণ করা যায়।\n- 'প্রোডাক্ট তালিকা' (/dashboard/products): নতুন প্রোডাক্ট যোগ, এডিট, ভ্যারিয়েন্ট (সাইজ/কালার) সেট করা।\n- 'ক্যাটাগরি' (/dashboard/products/categories): প্রোডাক্ট ক্যাটাগরি তৈরি/সাজানো।\n- 'স্টক' (/dashboard/products/stock): কোন প্রোডাক্টের স্টক কম/শেষ তা দেখা ও আপডেট করা।\n- 'রিভিউ' (/dashboard/products/reviews): কাস্টমার রিভিউ মডারেট করা।\nপ্রোডাক্ট তৈরি করলেই সেটা নিজের স্টোরফ্রন্টে (নিজের সাবডোমেইনে) স্বয়ংক্রিয়ভাবে দেখা যায়।",
            ],
            [
                'slug' => 'customers',
                'title' => 'গ্রাহক (কাস্টমার) ম্যানেজমেন্ট',
                'content' => "ড্যাশবোর্ড → গ্রাহক মেনুতে সব কাস্টমারের তথ্য ও অর্ডার হিস্টরি একসাথে দেখা যায়।\n- 'গ্রাহক তালিকা' (/dashboard/customers): সব কাস্টমার, তাদের মোট অর্ডার/খরচ।\n- 'VIP গ্রাহক' (/dashboard/customers/vip): বেশি অর্ডার/টাকা খরচ করা কাস্টমাররা স্বয়ংক্রিয়ভাবে এখানে চিহ্নিত হয়।\n- 'রিস্কি গ্রাহক' (/dashboard/customers/risky): যাদের ডেলিভারি ফেইল/রিটার্ন বেশি, ফ্রড স্কোর অনুযায়ী।",
            ],
            [
                'slug' => 'courier',
                'title' => 'কুরিয়ার ও ডেলিভারি',
                'content' => "ড্যাশবোর্ড → কুরিয়ার মেনু থেকে পার্সেল বুকিং ও ট্র্যাকিং।\n- 'পার্সেল বুক করুন' (/dashboard/courier): অর্ডার থেকে সরাসরি Steadfast/Pathao/RedX/Paperfly/Carrybee-তে বুকিং দেওয়া যায়।\n- 'অর্ডার ট্র্যাক করুন' (/dashboard/courier/track): সব পার্সেলের লাইভ স্ট্যাটাস।\n- 'কুরিয়ার পারফরম্যান্স' (/dashboard/courier/performance): কোন কুরিয়ারের সাকসেস রেট কেমন।\nকুরিয়ার অ্যাকাউন্টের API key/ক্রেডেনশিয়াল সেট করতে হবে সেটিংস → কুরিয়ার অ্যাকাউন্ট (/dashboard/settings/courier) থেকে, তবেই বুকিং কাজ করবে।",
            ],
            [
                'slug' => 'sms',
                'title' => 'SMS পাঠানো ও SMS ক্রেডিট কেনা',
                'content' => "ড্যাশবোর্ড → SMS মেনু থেকে SMS পাঠানো ও ম্যানেজ করা যায়।\n- 'SMS পাঠান' (/dashboard/sms/send): কাস্টমারদের ম্যানুয়ালি SMS পাঠানো।\n- 'SMS হিস্টরি' (/dashboard/sms/history): কোন SMS কবে পাঠানো হয়েছে, স্ট্যাটাস।\n- 'SMS অটোমেশন' (/dashboard/sms/automation): অর্ডার confirm/shipped হলে স্বয়ংক্রিয় SMS পাঠানোর নিয়ম সেট করা।\n- 'SMS ক্রেডিট' (/dashboard/sms/credit): SMS পাঠাতে ক্রেডিট লাগে — এই পেজ থেকে ক্রেডিট কেনা যায় এবং অটো-রিচার্জ চালু করা যায় (ক্রেডিট কমে গেলে স্বয়ংক্রিয়ভাবে রিচার্জ)। সঠিক দাম/প্যাকেজ এই পেজেই দেখা যাবে।",
            ],
            [
                'slug' => 'whatsapp',
                'title' => 'WhatsApp বিজনেস ইন্টিগ্রেশন',
                'content' => "প্রথমে সেটিংস → হোয়াটসঅ্যাপ (/dashboard/settings/whatsapp) থেকে নিজের WhatsApp Business অ্যাকাউন্ট কানেক্ট করতে হবে।\n- 'হোয়াটসঅ্যাপ ইনবক্স' (/dashboard/whatsapp/inbox): কাস্টমারদের সাথে সরাসরি WhatsApp-এ চ্যাট।\n- 'হোয়াটসঅ্যাপ অটোমেশন' (SMS মেনুর ভেতরে, /dashboard/whatsapp/automation): অর্ডার স্ট্যাটাস বদলালে স্বয়ংক্রিয় WhatsApp মেসেজ পাঠানোর নিয়ম।",
            ],
            [
                'slug' => 'facebook',
                'title' => 'Facebook Leads, Pixel ও CAPI',
                'content' => "প্রথমে সেটিংস → ফেসবুক পেজ (/dashboard/settings/facebook) থেকে নিজের Facebook Page কানেক্ট করতে হবে।\n- 'ফেসবুক লিডস' (/dashboard/leads): পেজের কমেন্ট/ইনবক্স মেসেজ থেকে আসা লিড এখানে জমা হয়, সরাসরি কাস্টমারে কনভার্ট করা যায়।\n- মার্কেটিং → Facebook CAPI (/dashboard/marketing/facebook-capi): নিজের Facebook Pixel/Conversion API সেট করে বিজ্ঞাপনের পারফরম্যান্স আরও ভালোভাবে ট্র্যাক করা যায়।",
            ],
            [
                'slug' => 'landing_pages',
                'title' => 'ল্যান্ডিং পেজ ও অসম্পূর্ণ অর্ডার',
                'content' => "'ল্যান্ডিং পেজ' (/dashboard/landing-pages): নির্দিষ্ট প্রোডাক্টের জন্য আলাদা বিক্রয়-পেজ বানানো যায়, রেডিমেড টেমপ্লেট থেকে শুরু করা যায় বা নিজে ডিজাইন করা যায়। বিজ্ঞাপনে এই লিংক ব্যবহার করলে ভিজিটর/কনভার্শন হিসাব এখান থেকেই দেখা যায়।\n'অসম্পূর্ণ অর্ডার' (/dashboard/abandoned-checkouts): যেসব কাস্টমার চেকআউট শুরু করেও অর্ডার সম্পূর্ণ করেননি, তাদের তালিকা — ফলো-আপ করে অর্ডার কনভার্ট করা যায়।",
            ],
            [
                'slug' => 'analytics',
                'title' => 'অ্যানালিটিক্স ও রিপোর্ট',
                'content' => "ড্যাশবোর্ড → অ্যানালিটিক্স মেনুতে বিভিন্ন রিপোর্ট।\n- 'সেলস রিপোর্ট' (/dashboard/analytics/sales), 'ইন্টেলিজেন্স' (/dashboard/analytics/intelligence): বিক্রয় ট্রেন্ড।\n- 'বিজ্ঞাপন ROI' (/dashboard/analytics/ads-roi): বিজ্ঞাপন খরচ বনাম বিক্রয়।\n- 'কুরিয়ার রিপোর্ট' (/dashboard/analytics/courier): কুরিয়ার পারফরম্যান্স।\n- 'ট্র্যাকিং লগ' (/dashboard/analytics/tracking): ভিজিটর ট্র্যাকিং ডেটা (Facebook Pixel/CAPI ইভেন্ট)।",
            ],
            [
                'slug' => 'accounting',
                'title' => 'হিসাব-নিকাশ (অ্যাকাউন্টিং)',
                'content' => "ড্যাশবোর্ড → অ্যাকাউন্টিং মেনুতে ব্যবসার আর্থিক হিসাব।\n- 'দৈনিক রিপোর্ট' (/dashboard/accounting), 'খরচ' (/dashboard/accounting/expenses), 'লাভ' (/dashboard/accounting/profit): দিনভিত্তিক আয়-ব্যয়-লাভের হিসাব।\n- 'কালেকশন হিস্টরি' (/dashboard/accounting/collections): COD/ক্যাশ কালেকশন।\n- 'অনলাইন পেমেন্ট ভেরিফিকেশন' (/dashboard/accounting/online-payments): কাস্টমারের অনলাইন পেমেন্ট যাচাই।",
            ],
            [
                'slug' => 'subscription_billing',
                'title' => 'সাবস্ক্রিপশন, বিলিং ও প্যাকেজ আপগ্রেড',
                'content' => "সেটিংস → সাবস্ক্রিপশন (/dashboard/settings/subscription): বর্তমান প্যাকেজ, মেয়াদ, এবং প্যাকেজ আপগ্রেড/রিনিউ করার অপশন এখানে। bKash দিয়ে instant পেমেন্ট করা যায় (auto-verify), অথবা ম্যানুয়ালি TrxID জমা দিয়ে অ্যাডমিন অনুমোদনের অপেক্ষা করা যায়।\n'অর্ডার ক্রেডিট' (/dashboard/order-credits) ও 'স্টোরফ্রন্ট অ্যাড-অন' (/dashboard/storefront-addon): নির্দিষ্ট প্যাকেজ-লিমিটের বাইরে অতিরিক্ত অর্ডার-কোটা বা স্টোরফ্রন্ট ফিচার আলাদাভাবে কেনা যায়। সাবস্ক্রিপশন মেয়াদ শেষ হয়ে গেলেও সাপোর্ট (লাইভ চ্যাট/টিকেট) সবসময় খোলা থাকে।",
            ],
            [
                'slug' => 'settings_store',
                'title' => 'দোকান/স্টোরফ্রন্ট সেটিংস ও স্টাফ',
                'content' => "সেটিংস মেনুতে দোকান সংক্রান্ত সব কনফিগারেশন:\n- 'দোকানের প্রোফাইল' (/dashboard/settings/shop): নাম, লোগো, যোগাযোগ তথ্য।\n- 'স্টোরফ্রন্ট' (/dashboard/settings/storefront): নিজের অনলাইন স্টোরের থিম, সাবডোমেইন, শিপিং চার্জ সেট করা।\n- 'স্টিকার টেমপ্লেট' (/dashboard/settings/sticker-templates): প্যাকেজিং/শিপিং স্টিকার ডিজাইন।\n- 'অনলাইন পেমেন্ট সেটিংস' (/dashboard/settings/payments): কাস্টমারদের জন্য নিজের পেমেন্ট মেথড কনফিগার।\n- 'ওয়ার্ডপ্রেস কানেক্ট' (/dashboard/settings/wordpress): WooCommerce স্টোরের সাথে স্টক/অর্ডার সিঙ্ক।\n- 'স্টাফ ম্যানেজমেন্ট' (/dashboard/settings/staff): টিম মেম্বার যোগ করে নির্দিষ্ট মডিউলের অ্যাক্সেস দেওয়া (যেমন শুধু অর্ডার দেখতে পারবে, সেটিংস না)।",
            ],
            [
                'slug' => 'support',
                'title' => 'সাপোর্ট: লাইভ চ্যাট ও টিকেট',
                'content' => "সাহায্য দরকার হলে দুইভাবে যোগাযোগ করা যায়:\n১) ডান-নিচের 'সাপোর্ট' বাটনে ক্লিক করে সরাসরি লাইভ চ্যাট — ছোট/সাধারণ প্রশ্নের জন্য।\n২) 'আমার টিকেট' (/dashboard/tickets) থেকে ফরমাল টিকেট খোলা — যেকোনো সমস্যা যেটা ট্র্যাক করে রাখতে চান (বিষয়, ক্যাটাগরি, প্রায়োরিটি সহ), সেখানে ব্যবহার করুন।\nদুই জায়গাতেই AI এজেন্ট প্রথমে তাৎক্ষণিক উত্তর দেওয়ার চেষ্টা করে; জটিল/স্পর্শকাতর কিছু হলে (রিফান্ড, অ্যাকাউন্ট পরিবর্তন) সরাসরি অ্যাডমিন টিমের কাছে পাঠিয়ে দেয়।",
            ],
        ];
    }
};
