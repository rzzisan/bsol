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
    ];

    protected $casts = [
        'terms_content_bn' => 'array',
        'terms_content_en' => 'array',
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
    ];

    public static function getSetting(): static
    {
        $setting = static::first();

        if (!$setting) {
            $setting = static::create(self::DEFAULTS);
        }

        return $setting;
    }
}
