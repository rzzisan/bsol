<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AddonPackage;
use App\Models\AddonPurchase;
use App\Models\OrderCreditHistory;
use App\Models\OrderCreditWallet;
use Illuminate\Http\JsonResponse;

/**
 * Seller-facing order-credit add-on purchase — subscription_billing_context.md
 * §9.2-B / §9.6 step 3. The old manual-bKash submit flow (submit → pending
 * → admin approve → AddonApplyService grants credits) was removed —
 * sellers now pay via the platform's automated merchant gateways
 * (PlatformGatewayPaymentController). Admin approve/reject stays, for any
 * pre-existing pending purchase and as the generic review queue.
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

        return response()->json([
            'success' => true,
            'data' => [
                'available_balance' => $wallet->availableBalance(),
                'expires_at' => $wallet->isExpired() ? null : $wallet->expires_at,
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

}
