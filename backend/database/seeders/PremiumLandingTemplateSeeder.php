<?php

namespace Database\Seeders;

use App\Models\LandingTemplate;
use Illuminate\Database\Seeder;

/**
 * A hand-crafted (not JSON-imported) starter template styled after a
 * real high-converting Bengali F-commerce landing page — dark-green hero,
 * orange section banners, numbered feature list, USP badge grid, black
 * pill CTA buttons, review carousel. Content is generic/product-agnostic
 * placeholder copy so any merchant can pick it and just replace text +
 * images with their own. All styling is embedded as a <style> block inside
 * the first html_sections entry (self-contained — works regardless of
 * whether template selection copies custom_css/theme_settings, which the
 * create-page flow currently does not). All placeholder imagery is
 * self-contained SVG data URIs, never hotlinked, so nothing can break if
 * an external site goes down.
 */
class PremiumLandingTemplateSeeder extends Seeder
{
    private const ORANGE = '#DB7519';
    private const ORANGE_LIGHT = '#F7941D';
    private const GREEN = '#15803D';
    private const GREEN_DARK = '#0B3B1F';
    private const CREAM = '#FEFEF3';
    private const CARD_BORDER = '#F1E6C9';

    public function run(): void
    {
        $css = $this->buildStyle();

        LandingTemplate::updateOrCreate(
            ['code' => 'premium_product_launch_v1'],
            [
                'name_bn' => 'প্রিমিয়াম প্রোডাক্ট ল্যান্ডিং পেজ',
                'name_en' => 'Premium Product Launch',
                'description' => 'High-converting design: numbered feature list, USP badge grid, review carousel, pill CTA buttons. Replace the placeholder text/images with your own product.',
                'preview_image' => null,
                'default_content' => [
                    'hero' => [
                        'headline' => 'আপনার প্রোডাক্টের নাম — সেরা সমাধান এক জায়গায়',
                        'subheadline' => 'এখানে আপনার প্রোডাক্টের মূল সুবিধা এক-দুই লাইনে লিখুন — কেন কাস্টমার এটা কিনবে।',
                        'cta_text' => 'অর্ডার করতে চাই',
                    ],
                    'html_sections' => [
                        [
                            'title' => '',
                            'html' => $css . $this->videoSectionHtml() . $this->uspGridHtml(),
                        ],
                    ],
                    'features' => [
                        ['title' => '১. দ্রুত ও কার্যকর ফলাফল', 'description' => 'প্রথম ব্যবহারেই পার্থক্য বুঝতে পারবেন — এখানে বিস্তারিত লিখুন।'],
                        ['title' => '২. সম্পূর্ণ নিরাপদ', 'description' => 'উপকরণ মানসম্মত ও পরীক্ষিত — নিরাপত্তা নিয়ে আশ্বস্ত করুন।'],
                        ['title' => '৩. ব্যবহার করা সহজ', 'description' => 'কোনো জটিলতা ছাড়াই সহজে ব্যবহারের পদ্ধতি লিখুন।'],
                        ['title' => '৪. মানসম্মত উৎপাদন', 'description' => 'কীভাবে তৈরি/সংগ্রহ করা হয় তার সংক্ষিপ্ত বিবরণ দিন।'],
                        ['title' => '৫. প্রমাণিত মান', 'description' => 'গ্রাহকের অভিজ্ঞতা বা পরীক্ষার ফলাফল উল্লেখ করুন।'],
                        ['title' => '৬. দীর্ঘস্থায়ী', 'description' => 'দীর্ঘমেয়াদী ব্যবহারের নিশ্চয়তা সম্পর্কে লিখুন।'],
                    ],
                    'carousel_images' => [
                        [
                            'title' => 'অসংখ্য কাস্টমারের রিভিউ সমূহ',
                            'template' => 'style-1',
                            'images' => [
                                ['url' => $this->placeholderSvg('গ্রাহকের রিভিউ ১', self::CREAM, self::ORANGE, 500, 500), 'alt' => 'Review 1'],
                                ['url' => $this->placeholderSvg('গ্রাহকের রিভিউ ২', self::CREAM, self::ORANGE, 500, 500), 'alt' => 'Review 2'],
                                ['url' => $this->placeholderSvg('গ্রাহকের রিভিউ ৩', self::CREAM, self::ORANGE, 500, 500), 'alt' => 'Review 3'],
                            ],
                        ],
                    ],
                    'reviews' => [],
                    'faq' => [
                        ['q' => 'ডেলিভারি কত দিনে পাবো?', 'a' => 'সাধারণত ২-৫ কার্যদিবসের মধ্যে ডেলিভারি সম্পন্ন হয়।'],
                        ['q' => 'ক্যাশ অন ডেলিভারি (COD) আছে কি?', 'a' => 'হ্যাঁ, সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা উপলব্ধ।'],
                    ],
                    'contact' => [
                        'phone' => null,
                    ],
                    'shipping' => [
                        'inside_dhaka' => 80,
                        'outside_dhaka' => 120,
                    ],
                    'layout_order' => ['html_sections', 'features', 'carousel_images', 'faq', 'reviews', 'products'],
                ],
                'schema' => [
                    'sections' => ['hero', 'html_sections', 'features', 'carousel_images', 'faq', 'contact', 'shipping'],
                    'supports_products' => true,
                    'supports_custom_css' => true,
                    'style_reference' => 'hand-crafted, not imported',
                ],
                'is_active' => true,
                'sort_order' => 0,
            ]
        );
    }

    private function buildStyle(): string
    {
        $orange = self::ORANGE;
        $orangeLight = self::ORANGE_LIGHT;
        $green = self::GREEN;
        $greenDark = self::GREEN_DARK;
        $cream = self::CREAM;
        $border = self::CARD_BORDER;

        return <<<HTML
<style>
@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700;800&display=swap');
.pl-wrap, .pl-wrap * { font-family: 'Hind Siliguri', sans-serif; box-sizing: border-box; }
.pl-section-title { background:{$orange}; color:#fff; font-weight:800; font-size:20px; padding:14px 22px; border-radius:10px; text-align:center; margin:0 0 20px; }
.pl-cta-btn { display:inline-flex; align-items:center; gap:10px; background:#111; color:#fff !important; font-weight:600; font-size:17px; padding:14px 32px; border-radius:50px; text-decoration:none; margin-top:18px; cursor:pointer; border:0; }
.pl-cta-btn .pl-cta-dot { background:{$orangeLight}; width:26px; height:26px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; font-size:14px; }
.pl-center { text-align:center; }
.pl-video-box { max-width:640px; margin:0 auto; border-radius:16px; overflow:hidden; background:{$greenDark}; aspect-ratio:16/9; display:flex; align-items:center; justify-content:center; color:#fff; padding:20px; text-align:center; font-weight:600; }
.pl-usp-grid { display:grid; grid-template-columns:1fr 1.3fr 1fr; gap:14px; align-items:center; margin-top:10px; }
@media (max-width: 768px) { .pl-usp-grid { grid-template-columns: 1fr; } }
.pl-badge-card { background:{$cream}; border:2px solid {$border}; border-radius:14px; padding:16px 12px; text-align:center; margin-bottom:14px; }
.pl-badge-icon { font-size:30px; margin-bottom:6px; }
.pl-badge-text { font-weight:700; font-size:14px; color:#1a1a1a; }
.pl-center-image { border:2px solid {$orange}; border-radius:16px; overflow:hidden; }
.pl-center-image img { width:100%; display:block; }
</style>
HTML;
    }

    private function videoSectionHtml(): string
    {
        return <<<'HTML'
<div class="pl-wrap pl-center">
  <div class="pl-video-box">🎬 এখানে আপনার প্রোডাক্টের ভিডিও যুক্ত করুন (YouTube লিংক এমবেড করুন)</div>
  <a href="#checkout" class="pl-cta-btn"><span class="pl-cta-dot">➜</span> অর্ডার করতে চাই</a>
</div>
HTML;
    }

    private function uspGridHtml(): string
    {
        $centerImage = $this->placeholderSvg('আপনার প্রোডাক্টের ছবি', '#F3F4F6', '#6B7280', 600, 500);

        return <<<HTML
<div class="pl-wrap" style="margin-top:28px;">
  <div class="pl-section-title">আমাদের প্রোডাক্টের বিশেষত্ব</div>
  <div class="pl-usp-grid">
    <div>
      <div class="pl-badge-card"><div class="pl-badge-icon">🏆</div><div class="pl-badge-text">১০০% মানসম্মত ও কার্যকর</div></div>
      <div class="pl-badge-card"><div class="pl-badge-icon">⚡</div><div class="pl-badge-text">দ্রুত ফলাফল পাবেন</div></div>
    </div>
    <div class="pl-center-image"><img src="{$centerImage}" alt="Product" /></div>
    <div>
      <div class="pl-badge-card"><div class="pl-badge-icon">✅</div><div class="pl-badge-text">উন্নত মানের উপকরণ</div></div>
      <div class="pl-badge-card"><div class="pl-badge-icon">📦</div><div class="pl-badge-text">ব্যবহারের জন্য প্রস্তুত</div></div>
    </div>
  </div>
  <div class="pl-center">
    <a href="#checkout" class="pl-cta-btn"><span class="pl-cta-dot">➜</span> অর্ডার করতে চাই</a>
  </div>
</div>
HTML;
    }

    private function placeholderSvg(string $label, string $bg, string $fg, int $w, int $h): string
    {
        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="{$w}" height="{$h}" viewBox="0 0 {$w} {$h}">
<rect width="100%" height="100%" fill="{$bg}"/>
<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="28" fill="{$fg}">{$label}</text>
</svg>
SVG;

        return 'data:image/svg+xml;base64,' . base64_encode($svg);
    }
}
