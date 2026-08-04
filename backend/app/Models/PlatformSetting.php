<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformSetting extends Model
{
    protected $fillable = [
        'credit_text_bn',
        'credit_text_en',
        'terms_link_label_bn',
        'terms_link_label_en',
        'terms_title_bn',
        'terms_title_en',
        'terms_content_bn',
        'terms_content_en',
        'privacy_link_label_bn',
        'privacy_link_label_en',
        'privacy_title_bn',
        'privacy_title_en',
        'privacy_content_bn',
        'privacy_content_en',
    ];

    protected $casts = [
        'terms_content_bn' => 'array',
        'terms_content_en' => 'array',
        'privacy_content_bn' => 'array',
        'privacy_content_en' => 'array',
    ];

    private const DEFAULTS = [
        'credit_text_bn' => 'এই ল্যান্ডিং পেজটি একটি তৃতীয়-পক্ষ প্ল্যাটফর্মের মাধ্যমে পরিচালিত। পণ্যের মান ও ডেলিভারির দায়ভার সংশ্লিষ্ট বিক্রেতার।',
        'credit_text_en' => 'This landing page is powered by a third-party platform. Product quality and delivery are the responsibility of the seller.',
        'terms_link_label_bn' => 'ব্যবহারের শর্তাবলি',
        'terms_link_label_en' => 'Terms of Use',
        'terms_title_bn' => 'ব্যবহারের শর্তাবলি',
        'terms_title_en' => 'Terms of Use',
        'terms_content_bn' => ['type' => 'doc', 'content' => [['type' => 'paragraph']]],
        'terms_content_en' => ['type' => 'doc', 'content' => [['type' => 'paragraph']]],
        'privacy_link_label_bn' => 'গোপনীয়তা নীতি',
        'privacy_link_label_en' => 'Privacy Policy',
        'privacy_title_bn' => 'গোপনীয়তা নীতি',
        'privacy_title_en' => 'Privacy Policy',
    ];

    /**
     * Privacy Policy default copy lives in resources/legal/*.json rather than
     * inline here — it's ~900 lines of Tiptap JSON per language, written for
     * Meta App Review (§facebook_integration_context.md) as well as general
     * platform use.
     */
    private static function defaults(): array
    {
        return self::DEFAULTS + [
            'privacy_content_bn' => json_decode(file_get_contents(resource_path('legal/privacy_policy_bn.json')), true),
            'privacy_content_en' => json_decode(file_get_contents(resource_path('legal/privacy_policy_en.json')), true),
        ];
    }

    public static function getSetting(): static
    {
        $setting = static::first();

        if (!$setting) {
            $setting = static::create(self::defaults());
        }

        return $setting;
    }
}
