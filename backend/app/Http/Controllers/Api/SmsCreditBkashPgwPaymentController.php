<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformBillingSetting;
use App\Models\SmsCreditPurchase;
use App\Models\SmsCreditSetting;
use App\Services\Payment\BkashPgwPaymentGatewayClient;
use App\Services\SmsCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * bKash classic Checkout API ("PGW") for SMS credit purchase — widget-driven
 * counterpart to SmsCreditBkashPaymentController, mirroring
 * BkashPgwPaymentController's subscription-billing flow. See §18 in
 * SAAS_MODULE_CONTEXT.md and subscription_billing_context.md §3.
 */
class SmsCreditBkashPgwPaymentController extends Controller
{
    public function __construct(
        private readonly BkashPgwPaymentGatewayClient $bkash,
        private readonly SmsCreditService $creditService,
    ) {}

    public function create(Request $request): JsonResponse
    {
        if (! $this->bkash->isConfigured() || PlatformBillingSetting::resolvedBkashApiType() !== 'pgw') {
            return response()->json(['paymentID' => null, 'message' => 'bKash PGW payment gateway is not configured.'], 422);
        }

        $data = $request->validate([
            'credits' => ['required', 'integer', 'min:100', 'max:1000000'],
        ]);

        $user = auth()->user();
        $rate = (float) SmsCreditSetting::getSetting()->rate_per_credit;
        $amount = round($data['credits'] * $rate, 2);

        $purchase = SmsCreditPurchase::create([
            'user_id' => $user->id,
            'credits' => $data['credits'],
            'rate_used' => $rate,
            'amount' => $amount,
            'payment_method' => 'bkash_gateway_pgw',
            'status' => 'pending',
        ]);

        $result = $this->bkash->createPayment(
            amount: number_format($amount, 2, '.', ''),
            merchantInvoiceNumber: 'ZyroSmsCredit-' . $purchase->id,
        );

        if (! $result) {
            $purchase->update(['status' => 'rejected', 'admin_note' => 'bKash PGW create-payment call failed.']);

            return response()->json(['paymentID' => null, 'message' => 'Could not start the bKash payment. Please try again.'], 502);
        }

        $purchase->update(['bkash_payment_id' => $result['paymentID']]);

        return response()->json(['paymentID' => $result['paymentID']]);
    }

    public function execute(Request $request, string $paymentId): JsonResponse
    {
        $purchase = SmsCreditPurchase::where('bkash_payment_id', $paymentId)->first();

        if (! $purchase || $purchase->user_id !== auth()->id()) {
            return response()->json(['paymentID' => null, 'message' => 'Payment not found.'], 404);
        }

        if ($purchase->status !== 'pending') {
            return $purchase->status === 'approved'
                ? response()->json(['paymentID' => $paymentId, 'transactionStatus' => 'Completed', 'trxID' => $purchase->trx_id])
                : response()->json(['paymentID' => null, 'message' => 'Payment already ' . $purchase->status . '.'], 422);
        }

        $executed = $this->bkash->executePayment($paymentId);

        if (! $executed || $executed['transactionStatus'] !== 'Completed') {
            $purchase->update([
                'status' => 'rejected',
                'admin_note' => 'bKash PGW execute-payment did not complete: ' . ($executed['transactionStatus'] ?? 'no response'),
            ]);

            return response()->json(['paymentID' => null, 'message' => 'Payment was not completed.'], 502);
        }

        $purchase->update([
            'status' => 'approved',
            'trx_id' => $executed['trxID'],
            'reviewed_at' => now(),
        ]);

        $this->creditService->recharge(
            userId: $purchase->user_id,
            credits: $purchase->credits,
            rechargedBy: null,
            note: "Self-purchase via bKash (purchase #{$purchase->id})",
        );

        return response()->json(['paymentID' => $paymentId, 'transactionStatus' => 'Completed', 'trxID' => $executed['trxID']]);
    }
}
