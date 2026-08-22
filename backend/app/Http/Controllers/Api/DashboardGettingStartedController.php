<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CourierSetting;
use App\Models\PaymentGatewayCredential;
use App\Models\PaymentGatewaySetting;
use App\Models\Product;
use App\Models\ShopProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

/**
 * Dashboard "Getting Started" checklist — production_audit_report_context.md
 * §7 (P1) / onboarding_checklist_context.md. Pattern B, owner-only (same
 * `owner_only` gate as ShopProfileController/StorefrontSettingController) —
 * this is post-mandatory-onboarding setup guidance, distinct from
 * AuthController::onboardingState() which gates reaching /dashboard at all.
 *
 * Every step's `done` is derived live from real data, never stored — so it
 * can never go stale relative to what the seller actually configured
 * elsewhere (courier settings, payment settings, product list).
 */
class DashboardGettingStartedController extends Controller
{
    private const DEMO_PRODUCTS = [
        ['name' => 'ডেমো — কটন টি-শার্ট', 'description' => 'এটি একটি নমুনা পণ্য, বাস্তব বিক্রির জন্য না। এই ফরম্যাটেই আপনার পণ্যের তথ্য সাজাতে পারবেন।', 'regular_price' => 590, 'discount' => 50, 'discount_type' => 'amount'],
        ['name' => 'ডেমো — চামড়ার ব্যাগ', 'description' => 'এটি একটি নমুনা পণ্য, বাস্তব বিক্রির জন্য না।', 'regular_price' => 1450, 'discount' => 0, 'discount_type' => 'amount'],
        ['name' => 'ডেমো — ব্লুটুথ হেডফোন', 'description' => 'এটি একটি নমুনা পণ্য, বাস্তব বিক্রির জন্য না।', 'regular_price' => 990, 'discount' => 10, 'discount_type' => 'percent'],
    ];

    public function show(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $shopUserIds = auth()->user()->shopUserIds();

        $profile = ShopProfile::where('user_id', $ownerId)->first();
        $courier = CourierSetting::where('user_id', $ownerId)->first();
        $paymentSetting = PaymentGatewaySetting::where('user_id', $ownerId)->first();

        $steps = [
            ['key' => 'profile', 'done' => $profile !== null],
            ['key' => 'product', 'done' => Product::whereIn('user_id', $shopUserIds)->where('is_demo', false)->exists()],
            ['key' => 'courier', 'done' => $courier !== null && $this->courierConfigured($courier)],
            ['key' => 'payment', 'done' => $this->paymentConfigured($paymentSetting, $ownerId)],
        ];

        return response()->json(['data' => [
            'dismissed' => $profile?->getting_started_dismissed_at !== null,
            'shop_url' => $profile?->subdomainHost() ? 'https://' . $profile->subdomainHost() : null,
            'steps' => $steps,
            'has_demo_products' => Product::whereIn('user_id', $shopUserIds)->where('is_demo', true)->exists(),
        ]]);
    }

    public function dismiss(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $profile = ShopProfile::where('user_id', $ownerId)->first();
        // Mandatory /onboarding guarantees a profile row exists by the time
        // any owner_only route is reachable, but fail soft rather than 500.
        if ($profile) {
            $profile->update(['getting_started_dismissed_at' => now()]);
        }

        return response()->json(['data' => ['dismissed' => true]]);
    }

    /** Idempotent — a second click while demo products already exist is a no-op, not a duplicate batch. */
    public function createDemoProducts(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();

        if (Product::where('user_id', $ownerId)->where('is_demo', true)->exists()) {
            return response()->json(['data' => ['created' => 0]]);
        }

        foreach (self::DEMO_PRODUCTS as $demo) {
            $regular = (float) $demo['regular_price'];
            $discount = (float) $demo['discount'];
            $selling = $demo['discount_type'] === 'percent'
                ? round($regular * (1 - $discount / 100), 2)
                : max(0, $regular - $discount);

            Product::create([
                'user_id' => $ownerId,
                'name' => $demo['name'],
                'slug' => Str::slug($demo['name']) . '-' . Str::random(6),
                'description' => $demo['description'],
                'regular_price' => $regular,
                'discount' => $discount,
                'discount_type' => $demo['discount_type'],
                'selling_price' => $selling,
                'cost_price' => 0,
                'stock' => 0,
                'track_stock' => false,
                'unit' => 'pcs',
                // Inactive + hidden — structurally invisible everywhere a
                // real transaction could touch it (storefront catalog and
                // OrderController::createBootstrap both filter status=active).
                'status' => 'inactive',
                'show_in_storefront' => false,
                'is_demo' => true,
            ]);
        }

        return response()->json(['data' => ['created' => count(self::DEMO_PRODUCTS)]]);
    }

    public function deleteDemoProducts(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $deleted = Product::where('user_id', $ownerId)->where('is_demo', true)->delete();

        return response()->json(['data' => ['deleted' => $deleted]]);
    }

    private function courierConfigured(CourierSetting $courier): bool
    {
        return $courier->steadfast_api_key !== null
            || $courier->pathao_client_id !== null
            || $courier->redx_api_key !== null
            || $courier->carrybee_client_id !== null
            || $courier->paperfly_api_key !== null;
    }

    private function paymentConfigured(?PaymentGatewaySetting $setting, int $ownerId): bool
    {
        if ($setting && ($setting->bkash_personal_enabled || $setting->nagad_personal_enabled || $setting->rocket_personal_enabled)) {
            return true;
        }

        return PaymentGatewayCredential::where('user_id', $ownerId)->where('enabled', true)->exists();
    }
}
