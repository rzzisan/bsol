<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformBillingSetting extends Model
{
    protected $fillable = [
        'bkash_number',
        'bkash_type',
    ];

    public static function getSetting(): static
    {
        $setting = static::first();

        if (! $setting) {
            $setting = static::create([
                'bkash_number' => null,
                'bkash_type' => 'Personal',
            ]);
        }

        return $setting;
    }
}
