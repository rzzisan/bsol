<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegistrationSetting extends Model
{
    protected $fillable = [
        'default_user_status',
        'default_subscription_package_id',
    ];

    public function defaultPackage()
    {
        return $this->belongsTo(SubscriptionPackage::class, 'default_subscription_package_id');
    }

    public static function getSetting(): static
    {
        $setting = static::first();

        if (! $setting) {
            $setting = static::create([
                'default_user_status' => 'pending',
                'default_subscription_package_id' => null,
            ]);
        }

        return $setting;
    }
}
