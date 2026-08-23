<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AddonPackage;
use App\Models\AddonPurchase;
use App\Models\OrderCreditHistory;
use App\Models\OrderCreditWallet;
use App\Models\PlatformBillingSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Seller-facing order-credit add-on purchase — subscription_billing_context.md
 * §9.2-B / §9.6 step 3. Mirrors SmsCreditPurchaseController's manual-bKash
 * flow exactly (submit → pending → admin approve → AddonApplyService
 * grants credits). Automated bKash gateway (Tokenized/PGW), like
 * subscription billing and SMS credit both had, is a deliberate fast-follow
 * — not built in this pass, manual-only for now (matches this codebase's
 * own Phase A-before-B/C precedent for new payment surfaces).
 */
class OrderCreditPurchaseController extends Controller
{
    public function packages(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => AddonPackage::where('type', 'order_credit')
                ->where('is_active', true)
                ->orderBy('price')
                ->get(['id', 'name', 'price', 'quantity', 'duration_days']),
        ]);
    }

    public function balance(): JsonResponse
    {
        $wallet = OrderCreditWallet::walletFor(auth()->id());
        $billingSettings = PlatformBillingSetting::getSetting();

        return response()->json([
            'success' => true,
            'data' => [
                'available_balance' => $wallet->availableBalance(),
                'expires_at' => $wallet->isExpired() ? null : $wallet->expires_at,
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
            'data' => AddonPurchase::whereHas('addonPackage', fn ($q) => $q->where('type', 'order_credit'))
                ->where('user_id', auth()->id())
                ->with('addonPackage:id,name,quantity,duration_days')
                ->latest()
                ->take(20)
                ->get(),
        ]);
    }

    public function history(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => OrderCreditHistory::where('user_id', auth()->id())
                ->latest()
                ->take(50)
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

        $package = AddonPackage::where('type', 'order_credit')
            ->where('is_active', true)
            ->findOrFail($validated['addon_package_id']);

        $screenshotPath = null;
        if ($request->hasFile('screenshot')) {
            $screenshotPath = $request->file('screenshot')->store('order-credit-purchases/' . auth()->id(), 'public');
        }

        $purchase = AddonPurchase::create([
            'user_id' => auth()->id(),
            'addon_package_id' => $package->id,
            // Server-computed from the package, never trusted from the client.
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
