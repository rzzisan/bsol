<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SavedPaymentMethod;
use App\Models\SmsCredit;
use App\Services\Payment\BkashPaymentGatewayClient;
use App\Support\FrontendUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * SMS-credit auto-recharge — connect/disconnect a saved bKash agreement +
 * threshold/top-up settings. See auto_top_up_context.md. Owner-only
 * (`owner_only` middleware in routes/api.php), same as every other billing
 * route in this file's neighborhood (SmsCreditBkashPaymentController etc.)
 * — this is a recurring-charge authorization, credential-equivalent, never
 * staff-delegable.
 */
class SmsCreditAutoRechargeController extends Controller
{
    public function __construct(private readonly BkashPaymentGatewayClient $bkash) {}

    public function status(): JsonResponse
    {
        $user = auth()->user();
        $wallet = SmsCredit::walletFor($user->id);
        $method = SavedPaymentMethod::where('user_id', $user->id)->where('provider', 'bkash')->first();

        return response()->json([
            'success' => true,
            'data' => [
                'enabled' => (bool) $wallet->auto_recharge_enabled,
                'threshold' => (int) $wallet->auto_recharge_threshold,
                'credits' => (int) $wallet->auto_recharge_credits,
                'failure_count' => (int) $wallet->auto_recharge_failure_count,
                'last_attempted_at' => $wallet->auto_recharge_last_attempted_at,
                'connected' => (bool) $method?->isActive(),
                'status' => $method?->status,
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'threshold' => ['required', 'integer', 'min:0', 'max:1000000'],
            'credits' => ['required', 'integer', 'min:0', 'max:1000000'],
        ]);

        $user = auth()->user();
        $wallet = SmsCredit::walletFor($user->id);

        if ($data['enabled']) {
            $method = SavedPaymentMethod::where('user_id', $user->id)->where('provider', 'bkash')->first();
            if (! $method?->isActive()) {
                return response()->json(['success' => false, 'message' => 'Connect a bKash agreement before enabling auto-recharge.'], 422);
            }
        }

        $wallet->update([
            'auto_recharge_enabled' => $data['enabled'],
            'auto_recharge_threshold' => $data['threshold'],
            'auto_recharge_credits' => $data['credits'],
            // A seller re-enabling after the circuit-breaker tripped it
            // deserves a fresh run of attempts, not an instant re-trip.
            'auto_recharge_failure_count' => 0,
        ]);

        return response()->json(['success' => true]);
    }

    public function createAgreement(): JsonResponse
    {
        if (! $this->bkash->isConfigured()) {
            return response()->json(['success' => false, 'message' => 'bKash payment gateway is not configured yet.'], 422);
        }

        $user = auth()->user();

        $result = $this->bkash->createAgreement(
            payerReference: $user->mobile ?: ('U' . $user->id),
            callbackUrl: $this->callbackUrl(),
        );

        if (! $result) {
            return response()->json(['success' => false, 'message' => 'Could not start the bKash agreement. Please try again.'], 502);
        }

        SavedPaymentMethod::updateOrCreate(
            ['user_id' => $user->id, 'provider' => 'bkash'],
            ['pending_payment_id' => $result['paymentID'], 'agreement_id' => null, 'status' => 'pending'],
        );

        return response()->json(['success' => true, 'data' => ['bkash_url' => $result['bkashURL']]]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $paymentId = (string) $request->query('paymentID', '');
        $status = (string) $request->query('status', '');

        // Never trust a user id from the query string; bKash only ever
        // gives us back the paymentID it was handed at create time.
        $method = $paymentId
            ? SavedPaymentMethod::where('provider', 'bkash')->where('pending_payment_id', $paymentId)->where('status', 'pending')->first()
            : null;

        $frontendUrl = FrontendUrl::forUserPath($method?->user, 'dashboard/sms/credit');

        if (! $method) {
            return redirect("{$frontendUrl}?bkash_agreement=error");
        }

        if ($status !== 'success') {
            $method->update(['status' => 'failed']);

            return redirect("{$frontendUrl}?bkash_agreement=" . ($status === 'cancel' ? 'cancelled' : 'failed'));
        }

        $executed = $this->bkash->executeAgreement($paymentId);

        if (! $executed || $executed['agreementStatus'] !== 'Completed' || ! $executed['agreementID']) {
            $method->update(['status' => 'failed']);

            return redirect("{$frontendUrl}?bkash_agreement=failed");
        }

        $method->update([
            'agreement_id' => $executed['agreementID'],
            'pending_payment_id' => null,
            'status' => 'active',
        ]);

        return redirect("{$frontendUrl}?bkash_agreement=success");
    }

    public function disconnect(): JsonResponse
    {
        $user = auth()->user();
        $method = SavedPaymentMethod::where('user_id', $user->id)->where('provider', 'bkash')->first();

        if ($method?->isActive()) {
            $this->bkash->cancelAgreement($method->agreement_id);
        }

        $method?->delete();

        SmsCredit::walletFor($user->id)->update(['auto_recharge_enabled' => false]);

        return response()->json(['success' => true]);
    }

    private function callbackUrl(): string
    {
        return rtrim((string) config('app.url'), '/') . '/api/sms/credit/auto-recharge/agreement/callback';
    }
}
