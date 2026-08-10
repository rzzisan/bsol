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
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Seller-facing self-service SMS credit purchase — see
 * subscription_billing_context.md §3. Reuses the existing SmsCreditService
 * wallet/history machinery (previously admin-recharge-only) and the same
 * bKash gateway clients already wired up for subscription billing.
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

    public function submitPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'credits' => ['required', 'integer', 'min:100', 'max:1000000'],
            'sender_bkash_number' => ['required', 'string', 'max:20'],
            'trx_id' => ['required', 'string', 'max:50', 'unique:sms_credit_purchases,trx_id'],
            'screenshot' => ['nullable', 'file', 'image', 'max:4096'],
        ], [
            'trx_id.unique' => 'This transaction ID has already been submitted. Each bKash transaction ID can only be used once.',
        ]);

        $rate = (float) SmsCreditSetting::getSetting()->rate_per_credit;
        $amount = round($validated['credits'] * $rate, 2);

        $screenshotPath = null;
        if ($request->hasFile('screenshot')) {
            $screenshotPath = $request->file('screenshot')->store('sms-credit-purchases/' . auth()->id(), 'public');
        }

        $purchase = SmsCreditPurchase::create([
            'user_id' => auth()->id(),
            'credits' => $validated['credits'],
            'rate_used' => $rate,
            'amount' => $amount,
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

    public function invoicePdf(SmsCreditPurchase $purchase): Response
    {
        abort_unless($purchase->user_id === auth()->id(), 403);

        return $this->invoicePdfService->smsCreditInvoice($purchase)
            ->stream("invoice-SMSC-{$purchase->id}.pdf");
    }
}
