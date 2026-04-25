<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsCreditSetting extends Model
{
    protected $fillable = [
        'rate_per_credit',
        'chars_per_credit_english',
        'chars_per_credit_unicode',
        'currency',
    ];

    protected function casts(): array
    {
        return [
            'rate_per_credit' => 'decimal:4',
        ];
    }

    /**
     * Get (or lazily create) the single settings row.
     */
    public static function getSetting(): static
    {
        $setting = static::first();

        if (! $setting) {
            $setting = static::create([
                'rate_per_credit' => 0.35,
                'chars_per_credit_english' => 160,
                'chars_per_credit_unicode' => 70,
                'currency' => 'BDT',
            ]);
        }

        return $setting;
    }
}
