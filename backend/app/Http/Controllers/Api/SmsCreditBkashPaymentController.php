<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmsCreditPurchase;
use App\Models\SmsCreditSetting;
use App\Services\Payment\BkashPaymentGatewayClient;
use App\Services\SmsCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use App\Support\FrontendUrl;
use Illuminate\Http\Request;

/**
 * bKash Tokenized Checkout for SMS credit purchase — same gateway client and
 * redirect-callback flow as BkashPaymentController (subscription billing),
 * just crediting SmsCreditService instead of activating a subscription. See
 * subscription_billing_context.md §3.
 */
class SmsCreditBkashPaymentController extends Controller
{
    public function __construct(
        private readonly BkashPaymentGatewayClient $bkash,
        private readonly SmsCreditService $creditService,
    ) {}

    public function initiate(Request $request): JsonResponse
    {
        if (! $this->bkash->isConfigured()) {
            return response()->json(['success' => false, 'message' => 'bKash payment gateway is not configured yet.'], 422);
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
            'payment_method' => 'bkash_gateway',
            'status' => 'pending',
        ]);

        $result = $this->bkash->createPayment(
            amount: number_format($amount, 2, '.', ''),
            merchantInvoiceNumber: 'SMSC' . $purchase->id,
            payerReference: $user->mobile ?: ('U' . $user->id),
            callbackUrl: $this->callbackUrl(),
        );

        if (! $result) {
            $purchase->update(['status' => 'rejected', 'admin_note' => 'bKash create-payment call failed.']);

            return response()->json(['success' => false, 'message' => 'Could not start the bKash payment. Please try again.'], 502);
        }

        $purchase->update(['bkash_payment_id' => $result['paymentID']]);

        return response()->json(['success' => true, 'data' => ['bkash_url' => $result['bkashURL']]]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $paymentId = (string) $request->query('paymentID', '');
        $status = (string) $request->query('status', '');

        $purchase = $paymentId ? SmsCreditPurchase::where('bkash_payment_id', $paymentId)->first() : null;

        // See BkashPaymentController::callback() — owner-resolved, not
        // Host-derived, because bKash controls this redirect.
        $frontendUrl = FrontendUrl::forUserPath($purchase?->user, 'dashboard/sms/credit');

        if (! $purchase) {
            return redirect("{$frontendUrl}?bkash_status=error");
        }

        if ($purchase->status !== 'pending') {
            return redirect("{$frontendUrl}?bkash_status=" . ($purchase->status === 'approved' ? 'success' : 'failed'));
        }

        if ($status !== 'success') {
            $purchase->update(['status' => 'rejected', 'admin_note' => "bKash checkout ended with status={$status}."]);

            return redirect("{$frontendUrl}?bkash_status=" . ($status === 'cancel' ? 'cancelled' : 'failed'));
        }

        $executed = $this->bkash->executePayment($paymentId);

        if (! $executed || $executed['transactionStatus'] !== 'Completed') {
            $purchase->update([
                'status' => 'rejected',
                'admin_note' => 'bKash execute-payment did not complete: ' . ($executed['transactionStatus'] ?? 'no response'),
            ]);

            return redirect("{$frontendUrl}?bkash_status=failed");
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

        return redirect("{$frontendUrl}?bkash_status=success");
    }

    private function callbackUrl(): string
    {
        return rtrim((string) config('app.url'), '/') . '/api/sms/credit/pay/bkash/callback';
    }
}
