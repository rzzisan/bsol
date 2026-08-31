<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformBillingSetting;
use App\Models\SmsCreditPurchase;
use App\Models\SmsCreditSetting;
use App\Services\InvoicePdfService;
use App\Services\Payment\BkashPgwPaymentGatewayClient;
use App\Services\SmsCreditService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Seller-facing self-service SMS credit purchase — see
 * subscription_billing_context.md §3. Reuses the existing SmsCreditService
 * wallet/history machinery (previously admin-recharge-only). The old
 * manual-bKash submit flow was removed — sellers now pay via the
 * platform's automated merchant gateways (PlatformGatewayPaymentController).
 */
class SmsCreditPurchaseController extends Controller
{
    public function __construct(
        private readonly SmsCreditService $creditService,
        private readonly BkashPgwPaymentGatewayClient $bkashPgw,
        private readonly InvoicePdfService $invoicePdfService,
    ) {}

    public function rate(): JsonResponse
    {
        $settings = SmsCreditSetting::getSetting();
        $billingSettings = PlatformBillingSetting::getSetting();

        return response()->json([
            'success' => true,
            'data' => [
                'rate_per_credit' => (float) $settings->rate_per_credit,
                'currency' => $settings->currency,
                'balance' => $this->creditService->getBalance(auth()->id()),
                'bkash_gateway_enabled' => $billingSettings->hasBkashGateway(),
                'bkash_api_type' => PlatformBillingSetting::resolvedBkashApiType(),
                'bkash_pgw_script_url' => $this->bkashPgw->scriptUrl(),
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
            'data' => SmsCreditPurchase::where('user_id', auth()->id())
                ->latest()
                ->take(20)
                ->get(),
        ]);
    }

    public function invoicePdf(SmsCreditPurchase $purchase): Response
    {
        abort_unless($purchase->user_id === auth()->id(), 403);

        return $this->invoicePdfService->smsCreditInvoice($purchase)
            ->stream("invoice-SMSC-{$purchase->id}.pdf")
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}
