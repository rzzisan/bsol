<?php

namespace Database\Seeders;

use App\Models\LandingTemplate;
use App\Models\User;
use Illuminate\Database\Seeder;

class LandingTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $adminId = User::query()->where('role', 'admin')->value('id');

        $templates = [
            [
                'code' => 'goofi_flashcard_offer',
                'name_bn' => 'গুফি ফ্ল্যাশকার্ড অফার',
                'name_en' => 'Goofi Flashcard Offer',
                'description_bn' => 'Education-style offer template with FAQ, review wall, and full checkout flow.',
                'description_en' => 'Education-style offer template with FAQ, review wall, and full checkout flow.',
                'category' => 'education',
                'layout_profile' => null,
                'editor_mode' => 'flex',
                'sort_order' => 1,
                'default_schema_json' => [
                    'sections' => [
                        [
                            'id' => 'hero',
                            'type' => 'hero',
                            'enabled' => true,
                            'order' => 1,
                            'data' => [
                                'hero_title' => 'সন্তানের শেখা আরও মজার ও স্মার্ট করুন',
                                'hero_subtitle' => 'Play-based flashcard learning journey with parent-trust and quick checkout.',
                                'cta_text_primary' => 'এখনই অর্ডার করুন',
                            ],
                        ],
                        [
                            'id' => 'authority',
                            'type' => 'authority',
                            'enabled' => true,
                            'order' => 2,
                            'data' => [
                                'authority_text' => 'Early learning experts inspired framework',
                                'reach_text' => '১২,০০০+ পরিবারের আস্থা',
                                'proof_text' => 'Research-informed activity cards',
                            ],
                        ],
                        [
                            'id' => 'reviews',
                            'type' => 'reviews',
                            'enabled' => true,
                            'order' => 3,
                            'data' => [
                                'review_images' => [
                                    ['title' => 'Parent feedback #1', 'caption' => 'ছবিসহ parent testimonial block'],
                                    ['title' => 'Parent feedback #2', 'caption' => 'Daily learning confidence improvement story'],
                                ],
                            ],
                        ],
                        [
                            'id' => 'faq',
                            'type' => 'faq',
                            'enabled' => true,
                            'order' => 4,
                            'data' => [
                                'faq_items' => [
                                    ['question' => 'ডেলিভারি কতদিনে?', 'answer' => 'ঢাকায় ১-২ দিন, বাইরে ২-৪ দিন।'],
                                    ['question' => 'কোন বয়সে উপযোগী?', 'answer' => 'সাধারণত ২+ বয়স থেকে শুরু করা যায়।'],
                                ],
                            ],
                        ],
                        [
                            'id' => 'guarantees',
                            'type' => 'guarantees',
                            'enabled' => true,
                            'order' => 5,
                            'data' => [
                                'guarantee_items' => [
                                    'Cash on Delivery available',
                                    'Secure payment support',
                                    'Easy return/replacement assistance',
                                    'Fast nationwide delivery',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            [
                'code' => 'laambd_story_checkout',
                'name_bn' => 'স্টোরি-চেকআউট টেমপ্লেট',
                'name_en' => 'Story Checkout Template',
                'description_bn' => 'Story-led health and wellness offer template with strong CTA anchors.',
                'description_en' => 'Story-led health and wellness offer template with strong CTA anchors.',
                'category' => 'story',
                'layout_profile' => null,
                'editor_mode' => 'flex',
                'sort_order' => 2,
                'default_schema_json' => [
                    'sections' => [
                        [
                            'id' => 'hook',
                            'type' => 'hook',
                            'enabled' => true,
                            'order' => 1,
                            'data' => [
                                'hook_headline' => 'সমস্যা থেকে সমাধানের গল্পটা শুরু হোক এখানে',
                                'hook_paragraph' => 'Long-form storytelling, benefits, trust markers এবং simple checkout সহ।',
                            ],
                        ],
                        [
                            'id' => 'benefits',
                            'type' => 'benefits',
                            'enabled' => true,
                            'order' => 2,
                            'data' => [
                                'benefit_points' => ['Simple checkout', 'Repeated CTA anchors', 'Package-focused layout'],
                            ],
                        ],
                        [
                            'id' => 'offer_packages',
                            'type' => 'offer_packages',
                            'enabled' => true,
                            'order' => 3,
                            'data' => [
                                'offer_packages' => [
                                    ['label' => 'Starter Pack', 'price' => '990', 'badge' => 'Popular', 'notes' => 'Best for first-time buyers'],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            [
                'code' => 'naturiva_package_upsell',
                'name_bn' => 'প্যাকেজ + আপসেল টেমপ্লেট',
                'name_en' => 'Package Upsell Template',
                'description_bn' => 'Package comparison with one-time upsell and sticky checkout section.',
                'description_en' => 'Package comparison with one-time upsell and sticky checkout section.',
                'category' => 'package',
                'layout_profile' => 'naturiva_exact_clone_locked',
                'editor_mode' => 'locked',
                'sort_order' => 3,
                'default_schema_json' => [
                    'layout_profile' => 'naturiva_exact_clone_locked',
                    'hero' => [
                        'title' => 'অ্যাজমা, কাশি ও শ্বাসকষ্টের যত্নে প্রাকৃতিক সাপোর্ট',
                        'subtitle' => 'প্যাকেজ বেছে নিয়ে নিচের ফর্ম পূরণ করে সরাসরি অর্ডার কনফার্ম করুন।',
                        'disclaimer' => '',
                    ],
                    'proof' => [
                        'video_url' => '',
                        'review_images' => [],
                    ],
                    'offer_strip' => [
                        'cta_label' => 'অর্ডার করতে চাই',
                        'package_highlights' => [
                            ['text' => '৩ মাসের জন্য ৩০০ গ্রাম', 'emphasis' => '৫০০০ টাকা'],
                            ['text' => '১ মাসের জন্য ১০০ গ্রাম', 'emphasis' => '১৮০০ টাকা'],
                            ['text' => '১৫ দিনের জন্য ৫০ গ্রাম', 'emphasis' => '১০০০ টাকা'],
                        ],
                    ],
                    'contact' => [
                        'call_numbers' => [],
                        'whatsapp_numbers' => [],
                    ],
                    'checkout' => [
                        'section_title' => 'অর্ডার করতে আপনার সঠিক তথ্য দিন',
                        'packages' => [
                            [
                                'id' => 'pkg_1m',
                                'title' => '১ মাসের প্যাকেজ',
                                'subtitle' => '',
                                'price' => 1800,
                                'compare_at_price' => null,
                                'badge' => 'জনপ্রিয়',
                                'image' => '',
                                'is_default' => true,
                            ],
                            [
                                'id' => 'pkg_15d',
                                'title' => '১৫ দিনের প্যাকেজ',
                                'subtitle' => '',
                                'price' => 1000,
                                'compare_at_price' => null,
                                'badge' => '',
                                'image' => '',
                                'is_default' => false,
                            ],
                        ],
                        'billing_fields' => [
                            'name' => true,
                            'phone' => true,
                            'address' => true,
                            'country' => true,
                        ],
                        'shipping_options' => [
                            ['id' => 'outside_dhaka', 'label' => 'ঢাকা সিটির বাহিরে', 'fee' => 100, 'is_default' => true],
                            ['id' => 'inside_dhaka', 'label' => 'ঢাকা সিটিতে', 'fee' => 50, 'is_default' => false],
                        ],
                        'upsell' => [
                            'enabled' => true,
                            'checkbox_label' => 'স্পেশাল কম্বোসহ নিতে চাই',
                            'title' => 'One Time Special Offer',
                            'description_html' => '',
                            'image' => '',
                            'price' => 999,
                        ],
                        'cod_confirmation_text' => 'আমি পণ্য হাতে পেয়ে টাকা পরিশোধ করবো, ইনশাআল্লাহ।',
                        'submit_label' => 'Confirm Order',
                    ],
                    'bottom_cta' => [
                        'text' => 'Click to Call',
                        'phone' => '',
                    ],
                    'policy' => [
                        'privacy_url' => '',
                        'terms_url' => '',
                    ],
                    'theme' => [
                        'primary' => '#0b7a2a',
                        'accent' => '#ff6a00',
                        'button_text' => '#ffffff',
                    ],
                ],
            ],
        ];

        foreach ($templates as $template) {
            LandingTemplate::query()->updateOrCreate(
                ['code' => $template['code']],
                [
                    ...$template,
                    'is_active' => true,
                    'created_by' => $adminId,
                ]
            );
        }
    }
}
