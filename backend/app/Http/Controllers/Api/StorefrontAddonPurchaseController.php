<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AddonPackage;
use App\Models\AddonPurchase;
use App\Models\PlatformBillingSetting;
use App\Services\StorefrontAddonService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Seller-facing storefront add-on purchase — subscription_billing_context.md
 * §9.2-D / §9.6 step 4. Same manual-bKash-only shape as
 * OrderCreditPurchaseController (see that class's docblock for why no
 * automated gateway yet); binary instead of a wallet, so there's no
 * balance/history concept here, just "unlocked until X".
 */
class StorefrontAddonPurchaseController extends Controller
{
    public function __construct(
        private readonly StorefrontAddonService $storefrontAddonService,
    ) {}

    public function status(): JsonResponse
    {
        $owner = auth()->user()->shopOwner();
        $billingSettings = PlatformBillingSetting::getSetting();

        return response()->json([
            'success' => true,
            'data' => [
                'included_in_plan' => ($owner->subscriptionPackage?->feature_flags['storefront'] ?? true) !== false,
                'addon_active' => $this->storefrontAddonService->hasActiveAddon($owner),
                'addon_until' => $this->storefrontAddonService->hasActiveAddon($owner) ? $owner->storefront_addon_until : null,
                'package' => AddonPackage::where('type', 'storefront')->where('is_active', true)->orderBy('price')->first(['id', 'name', 'price']),
                'payment_instructions' => [
                    'bkash_number' => $billingSettings->bkash_number,
                    'bkash_type' => $billingSettings->bkash_type,
                ],
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

    public function submitPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'addon_package_id' => ['required', 'integer', 'exists:addon_packages,id'],
            'sender_bkash_number' => ['required', 'string', 'max:20'],
            'trx_id' => ['required', 'string', 'max:50', 'unique:addon_purchases,trx_id'],
            'screenshot' => ['nullable', 'file', 'image', 'max:4096'],
        ], [
            'trx_id.unique' => 'This transaction ID has already been submitted. Each bKash transaction ID can only be used once.',
        ]);

        $package = AddonPackage::where('type', 'storefront')
            ->where('is_active', true)
            ->findOrFail($validated['addon_package_id']);

        $screenshotPath = null;
        if ($request->hasFile('screenshot')) {
            $screenshotPath = $request->file('screenshot')->store('storefront-addon-purchases/' . auth()->id(), 'public');
        }

        $purchase = AddonPurchase::create([
            'user_id' => auth()->id(),
            'addon_package_id' => $package->id,
            'amount' => $package->price,
            'payment_method' => 'bkash_manual',
            'sender_bkash_number' => $validated['sender_bkash_number'],
            'trx_id' => $validated['trx_id'],
            'screenshot_path' => $screenshotPath,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Purchase submitted. It will be reviewed shortly.',
            'data' => $purchase,
        ], 201);
    }
}
