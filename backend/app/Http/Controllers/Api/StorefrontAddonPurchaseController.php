<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AddonPackage;
use App\Models\AddonPurchase;
use App\Services\StorefrontAddonService;
use Illuminate\Http\JsonResponse;

/**
 * Seller-facing storefront add-on purchase — subscription_billing_context.md
 * §9.2-D / §9.6 step 4. Binary instead of a wallet, so there's no
 * balance/history concept here, just "unlocked until X". The old
 * manual-bKash submit flow was removed — see OrderCreditPurchaseController's
 * docblock.
 */
class StorefrontAddonPurchaseController extends Controller
{
    public function __construct(
        private readonly StorefrontAddonService $storefrontAddonService,
    ) {}

    public function status(): JsonResponse
    {
        $owner = auth()->user()->shopOwner();

        return response()->json([
            'success' => true,
            'data' => [
                'included_in_plan' => ($owner->subscriptionPackage?->feature_flags['storefront'] ?? true) !== false,
                'addon_active' => $this->storefrontAddonService->hasActiveAddon($owner),
                'addon_until' => $this->storefrontAddonService->hasActiveAddon($owner) ? $owner->storefront_addon_until : null,
                'package' => AddonPackage::where('type', 'storefront')->where('is_active', true)->orderBy('price')->first(['id', 'name', 'price']),
            ],
        ]);
    }

    public function myPurchases(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => AddonPurchase::whereHas('addonPackage', fn ($q) => $q->where('type', 'storefront'))
                ->where('user_id', auth()->id())
                ->with('addonPackage:id,name')
                ->latest()
                ->take(20)
                ->get(),
        ]);
    }

}
