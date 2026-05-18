<?php

namespace Database\Seeders;

use App\Models\LandingTemplate;
use Illuminate\Database\Seeder;

class LandingTemplateSeeder extends Seeder
{
    public function run(): void
    {
        LandingTemplate::updateOrCreate(
            ['code' => 'goofi_flash_cards_v1'],
            [
                'name_bn' => 'ফ্ল্যাশ কার্ডস – গুফি ওয়ার্ল্ড',
                'name_en' => 'Flash Cards – Goofi World',
                'description' => 'Goofi-style high-converting landing template with hero, sections, product cards and checkout.',
                'preview_image' => null,
                'default_content' => [
                    'hero' => [
                        'headline' => 'ফ্ল্যাশ কার্ডস – Goofi World',
                        'subheadline' => 'শিশুর শেখাকে করুন মজার, সহজ এবং ভিজ্যুয়াল।',
                        'cta_text' => 'এখনই অর্ডার করুন',
                    ],
                    'html_sections' => [
                        [
                            'title' => 'কেন এই ফ্ল্যাশ কার্ডস?',
                            'html' => '<ul><li>শিশুর early learning-এর জন্য প্রস্তুত</li><li>রঙিন এবং আকর্ষণীয় ডিজাইন</li><li>বাড়িতে বসেই শেখার উপযোগী</li></ul>',
                        ],
                    ],
                    'features' => [
                        ['title' => 'প্রিমিয়াম প্রিন্ট', 'description' => 'দীর্ঘদিন ব্যবহারযোগ্য মানসম্মত কার্ড'],
                        ['title' => 'শিশুবান্ধব', 'description' => 'শিশুর বয়স বিবেচনায় কনটেন্ট ডিজাইন'],
                        ['title' => 'দ্রুত ডেলিভারি', 'description' => 'সারা বাংলাদেশে হোম ডেলিভারি'],
                    ],
                    'reviews' => [],
                    'faq' => [
                        ['q' => 'ডেলিভারি কত দিনে?', 'a' => 'সাধারণত ২-৫ কার্যদিবসের মধ্যে।'],
                        ['q' => 'COD আছে?', 'a' => 'হ্যাঁ, ক্যাশ অন ডেলিভারি উপলব্ধ।'],
                    ],
                    'contact' => [
                        'phone' => null,
                    ],
                    'shipping' => [
                        'inside_dhaka' => 80,
                        'outside_dhaka' => 120,
                    ],
                ],
                'schema' => [
                    'sections' => ['hero', 'html_sections', 'features', 'reviews', 'faq', 'contact', 'shipping'],
                    'supports_products' => true,
                    'supports_custom_css' => true,
                ],
                'is_active' => true,
                'sort_order' => 1,
            ]
        );
    }
}
