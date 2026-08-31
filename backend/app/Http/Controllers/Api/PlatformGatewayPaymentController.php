<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformGatewayPayment;
use App\Services\Payment\PlatformGatewayPaymentService;
use App\Support\FrontendUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Seller-facing automated-gateway payment for the 4 platform billing
 * surfaces (subscription, sms_credit, order_credit, storefront_addon) —
 * mirrors OnlinePaymentController's gateway_auto endpoints, one purpose
 * segment removed from being 4 near-identical bKash-only controller pairs.
 * See online_payment_context.md §12.
 */
class PlatformGatewayPaymentController extends Controller
{
    public function __construct(
        private readonly PlatformGatewayPaymentService $paymentService,
    ) {}

    /** Which providers the admin has enabled+configured — same shape as
     *  OnlinePaymentController::publicChannels()'s gateway_channels half,
     *  used identically across all 4 seller-facing purchase pages. */
    public function channels(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->paymentService->enabledChannels()]);
    }

    public function initiate(Request $request, string $purpose): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', 'string'],
        ]);

        $result = $this->paymentService->initiate(
            purpose: $purpose,
            user: $request->user(),
            provider: $data['provider'],
            input: $request->all(),
            callbackBaseUrl: url('/api'),
        );

        return response()->json(['success' => true, 'data' => ['redirect_url' => $result['redirect_url']]]);
    }

    /** Browser-redirect leg — no Sanctum token (gateway redirects the
     *  payer's own browser here directly), same rationale as
     *  BkashPaymentController::callback() and OnlinePaymentController's
     *  gatewayCallback(). Our own claim id in the path means no
     *  payload-matching is needed here (unlike the IPN leg below). */
    public function callback(Request $request, string $purpose, string $provider, int $id): RedirectResponse
    {
        $claim = PlatformGatewayPayment::where('purpose', $purpose)->where('provider', $provider)->find($id);
        $frontendPath = $this->paymentService->frontendReturnPath($purpose);

        if (! $claim) {
            return redirect(FrontendUrl::forUserPath(null, $frontendPath) . '?payment_result=error');
        }

        $claim->loadMissing('user');
        $frontendUrl = FrontendUrl::forUserPath($claim->user, $frontendPath);

        $claim = $this->paymentService->completeCallback($claim, $request->all());

        $result = $claim->status === PlatformGatewayPayment::STATUS_COMPLETED ? 'success' : 'failed';

        return redirect($frontendUrl . (str_contains($frontendUrl, '?') ? '&' : '?') . 'payment_result=' . $result);
    }

    /** Server-to-server leg — some providers configure this once per
     *  merchant account rather than per-transaction, so (like
     *  OnlinePaymentController::gatewayIpn()) it resolves purely from the
     *  payload's own fields, not a path param. */
    public function ipn(Request $request, string $provider): JsonResponse
    {
        $payload = $request->all();
        $claim = $this->paymentService->findClaimForIpn($provider, $payload);

        if (! $claim) {
            return response()->json(['success' => false, 'message' => 'Unknown transaction.'], 404);
        }

        $this->paymentService->completeCallback($claim, $payload);

        return response()->json(['success' => true]);
    }
}
