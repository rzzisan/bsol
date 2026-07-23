<?php

namespace Database\Seeders;

use App\Models\RegistrationSetting;
use App\Models\SubscriptionPackage;
use Illuminate\Database\Seeder;

class SubscriptionPackageSeeder extends Seeder
{
    /**
     * Seed the default subscription tiers. Prices/limits are a starting
     * proposal (SAAS_MODULE_CONTEXT.md monetization plan) — adjust via the
     * admin packages UI once the business finalizes pricing.
     */
    public function run(): void
    {
        $packages = [
            [
                'slug' => 'free-trial',
                'name' => 'Free Trial',
                'price' => 0,
                'duration_days' => 14,
                'max_orders' => 50,
                'features' => ['orders', 'customers', 'products', 'courier', 'sms_automation', 'fraud_check', 'landing_pages', 'accounting'],
            ],
            [
                'slug' => 'starter',
                'name' => 'Starter',
                'price' => 799,
                'duration_days' => 30,
                'max_orders' => 150,
                'features' => ['orders', 'customers', 'products', 'courier'],
            ],
            [
                'slug' => 'growth',
                'name' => 'Growth',
                'price' => 1999,
                'duration_days' => 30,
                'max_orders' => 500,
                'features' => ['orders', 'customers', 'products', 'courier', 'sms_automation', 'fraud_check', 'landing_pages', 'accounting'],
            ],
            [
                'slug' => 'business',
                'name' => 'Business',
                'price' => 3999,
                'duration_days' => 30,
                'max_orders' => null,
                'features' => ['orders', 'customers', 'products', 'courier', 'sms_automation', 'fraud_check', 'landing_pages', 'accounting', 'analytics', 'multi_staff', 'priority_support'],
            ],
        ];

        foreach ($packages as $package) {
            SubscriptionPackage::updateOrCreate(
                ['slug' => $package['slug']],
                $package + ['is_active' => true]
            );
        }

        $trial = SubscriptionPackage::where('slug', 'free-trial')->first();
        if ($trial) {
            $setting = RegistrationSetting::getSetting();
            if (! $setting->default_subscription_package_id) {
                $setting->update(['default_subscription_package_id' => $trial->id]);
            }
        }
    }
}
