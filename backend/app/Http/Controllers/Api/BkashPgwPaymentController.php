<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformBillingSetting;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Services\Payment\BkashPgwPaymentGatewayClient;
use App\Services\SubscriptionActivationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * bKash classic Checkout API ("PGW") for subscription billing — the
 * JS-widget counterpart to BkashPaymentController (Tokenized Checkout).
 * See SAAS_MODULE_CONTEXT.md §18 and BkashPgwPaymentGatewayClient's docblock
 * for why this is a separate implementation, not a config toggle on the
 * same client.
 *
 * There is no public callback route here — unlike Tokenized Checkout, the
 * classic Checkout API doesn't redirect the browser to bKash's domain and
 * back. Instead bKash's own bKash-checkout.js widget stays on our page and
 * calls these two endpoints itself (via `createRequest` /
 * `executeRequestOnAuthorization` in `bKash.init()`), authenticated as the
 * logged-in seller the whole time.
 */
class BkashPgwPaymentController extends Controller
{
    public function __construct(
        private readonly BkashPgwPaymentGatewayClient $bkash,
        private readonly SubscriptionActivationService $activationService,
    ) {}

    public function create(Request $request): JsonResponse
    {
        if (! $this->bkash->isConfigured() || PlatformBillingSetting::resolvedBkashApiType() !== 'pgw') {
            return response()->json(['paymentID' => null, 'message' => 'bKash PGW payment gateway is not configured.'], 422);
        }

        $data = $request->validate([
            'package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
        ]);

        $package = SubscriptionPackage::findOrFail($data['package_id']);
        $user = auth()->user();

        $payment = SubscriptionPayment::create([
            'user_id' => $user->id,
            'package_id' => $package->id,
            'amount' => $package->price,
            'payment_method' => 'bkash_gateway_pgw',
            'status' => 'pending',
        ]);

        $result = $this->bkash->createPayment(
            amount: number_format((float) $package->price, 2, '.', ''),
            merchantInvoiceNumber: 'ZyroSub-' . $payment->id,
        );

        if (! $result) {
            $payment->update(['status' => 'rejected', 'admin_note' => 'bKash PGW create-payment call failed.']);

            return response()->json(['paymentID' => null, 'message' => 'Could not start the bKash payment. Please try again.'], 502);
        }

        $payment->update(['bkash_payment_id' => $result['paymentID']]);

        // Shape mirrors what bKash's own create-payment response looks like
        // — the widget's createRequest callback only checks `paymentID`.
        return response()->json(['paymentID' => $result['paymentID']]);
    }

    public function execute(Request $request, string $paymentId): JsonResponse
    {
        $payment = SubscriptionPayment::where('bkash_payment_id', $paymentId)->first();

        if (! $payment || $payment->user_id !== auth()->id()) {
            return response()->json(['paymentID' => null, 'message' => 'Payment not found.'], 404);
        }

        // Already processed (widget retry, double-click) — report existing outcome, don't re-execute.
        if ($payment->status !== 'pending') {
            return $payment->status === 'approved'
                ? response()->json(['paymentID' => $paymentId, 'transactionStatus' => 'Completed', 'trxID' => $payment->trx_id])
                : response()->json(['paymentID' => null, 'message' => 'Payment already ' . $payment->status . '.'], 422);
        }

        $executed = $this->bkash->executePayment($paymentId);

        if (! $executed || $executed['transactionStatus'] !== 'Completed') {
            $payment->update([
                'status' => 'rejected',
                'admin_note' => 'bKash PGW execute-payment did not complete: ' . ($executed['transactionStatus'] ?? 'no response'),
            ]);

            return response()->json(['paymentID' => null, 'message' => 'Payment was not completed.'], 502);
        }

        $payment->update([
            'status' => 'approved',
            'trx_id' => $executed['trxID'],
            'reviewed_at' => now(),
        ]);

        $this->activationService->activate($payment);

        return response()->json(['paymentID' => $paymentId, 'transactionStatus' => 'Completed', 'trxID' => $executed['trxID']]);
    }
}
