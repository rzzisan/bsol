<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Services\Payment\BkashPaymentGatewayClient;
use App\Services\SubscriptionActivationService;
use App\Services\SubscriptionInvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use App\Support\FrontendUrl;
use Illuminate\Http\Request;

/**
 * bKash Payment Gateway checkout for subscription billing — §16.4 in
 * SAAS_MODULE_CONTEXT.md. Automates the existing manual "send money +
 * submit TrxID + admin approves" flow (SubscriptionController::submitPayment
 * / AdminSubscriptionController::approvePayment) for sellers who'd rather
 * pay instantly; the manual flow stays available as a fallback.
 */
class BkashPaymentController extends Controller
{
    public function __construct(
        private readonly BkashPaymentGatewayClient $bkash,
        private readonly SubscriptionActivationService $activationService,
        private readonly SubscriptionInvoiceService $invoiceService,
    ) {}

    public function initiate(Request $request): JsonResponse
    {
        if (! $this->bkash->isConfigured()) {
            return response()->json(['success' => false, 'message' => 'bKash payment gateway is not configured yet.'], 422);
        }

        $data = $request->validate([
            'package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
        ]);

        $package = SubscriptionPackage::findOrFail($data['package_id']);
        $user = auth()->user();

        $invoice = $this->invoiceService->compute($user, $package);

        if ($invoice['is_downgrade_blocked']) {
            return response()->json([
                'success' => false,
                'message' => 'বর্তমান প্যাকেজের মেয়াদ শেষ না হওয়া পর্যন্ত এর চেয়ে ছোট প্যাকেজে যাওয়া যাবে না।',
            ], 422);
        }

        $payment = SubscriptionPayment::create([
            'user_id' => $user->id,
            'package_id' => $package->id,
            'previous_package_id' => $invoice['is_upgrade'] ? $invoice['previous_package']['id'] : null,
            'amount' => $invoice['payable_amount'],
            'base_amount' => $invoice['base_amount'],
            'proration_credit' => $invoice['proration_credit'],
            'invoice_breakdown' => $invoice,
            'payment_method' => 'bkash_gateway',
            'status' => 'pending',
        ]);

        $result = $this->bkash->createPayment(
            amount: number_format((float) $invoice['payable_amount'], 2, '.', ''),
            merchantInvoiceNumber: 'SUB' . $payment->id,
            payerReference: $user->mobile ?: ('U' . $user->id),
            callbackUrl: $this->callbackUrl(),
        );

        if (! $result) {
            $payment->update(['status' => 'rejected', 'admin_note' => 'bKash create-payment call failed.']);

            return response()->json(['success' => false, 'message' => 'Could not start the bKash payment. Please try again.'], 502);
        }

        $payment->update(['bkash_payment_id' => $result['paymentID']]);

        return response()->json(['success' => true, 'data' => ['bkash_url' => $result['bkashURL']]]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $paymentId = (string) $request->query('paymentID', '');
        $status = (string) $request->query('status', '');

        $payment = $paymentId ? SubscriptionPayment::where('bkash_payment_id', $paymentId)->first() : null;

        // Send the seller back to their own address, not the platform one.
        // Resolved from the payment's owner rather than the request Host:
        // bKash controls this redirect, so a Host header here is untrusted.
        $frontendUrl = FrontendUrl::forUserPath($payment?->user, 'dashboard/settings/subscription');

        if (! $payment) {
            return redirect("{$frontendUrl}?bkash_status=error");
        }

        // Already processed (double redirect, back-button, retried callback)
        // — don't re-execute against bKash, just report the existing outcome.
        if ($payment->status !== 'pending') {
            return redirect("{$frontendUrl}?bkash_status=" . ($payment->status === 'approved' ? 'success' : 'failed'));
        }

        if ($status !== 'success') {
            // 'cancel' or 'failure' — bKash's own terms for the two non-success outcomes.
            $payment->update(['status' => 'rejected', 'admin_note' => "bKash checkout ended with status={$status}."]);

            return redirect("{$frontendUrl}?bkash_status=" . ($status === 'cancel' ? 'cancelled' : 'failed'));
        }

        $executed = $this->bkash->executePayment($paymentId);

        if (! $executed || $executed['transactionStatus'] !== 'Completed') {
            $payment->update([
                'status' => 'rejected',
                'admin_note' => 'bKash execute-payment did not complete: ' . ($executed['transactionStatus'] ?? 'no response'),
            ]);

            return redirect("{$frontendUrl}?bkash_status=failed");
        }

        $payment->update([
            'status' => 'approved',
            'trx_id' => $executed['trxID'],
            'reviewed_at' => now(),
        ]);

        $this->activationService->activate($payment);

        return redirect("{$frontendUrl}?bkash_status=success");
    }

    private function callbackUrl(): string
    {
        return rtrim((string) config('app.url'), '/') . '/api/subscription/pay/bkash/callback';
    }
}
