<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\OrderOnlinePayment;
use App\Models\PaymentGatewayCredential;
use App\Models\User;
use App\Services\OnlinePaymentService;
use App\Support\FrontendUrl;
use App\Support\LandingPageResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Customer-facing online payment — both the public checkout-side endpoints
 * and the seller-dashboard verification endpoints live here since they're
 * two ends of the same short flow. Covers wallet_manual (Phase A) and
 * gateway_auto (Phase B/C). See online_payment_context.md.
 */
class OnlinePaymentController extends Controller
{
    public function __construct(
        private readonly OnlinePaymentService $onlinePaymentService,
    ) {}

    // ── Public / customer-facing ────────────────────────────────────────

    public function publicChannels(Request $request, string $slug): JsonResponse
    {
        $page = $this->resolvePage($slug, $request);
        // LandingPage.user_id is the page's creator, which may be a staff
        // account, not the shop owner — resolve up, same as
        // LandingPage::resolveOwnerId() does internally (private there).
        $ownerId = User::find($page->user_id)?->shopOwnerId() ?? $page->user_id;

        $shopWideChannels = $this->onlinePaymentService->getEnabledWalletChannels($ownerId);

        // Per-page selection (content.settings.payment_channels — an array
        // of 'cod'/'bkash'/'nagad'/'rocket') narrows the shop-wide-enabled
        // set down to what THIS page actually offers. Unset entirely
        // (older pages, before this setting existed) means "offer
        // everything the shop has enabled" — the pre-existing default
        // behavior, unchanged. See online_payment_context.md.
        $pageSelection = $page->content['settings']['payment_channels'] ?? null;
        $codEnabled = true;
        $walletChannels = $shopWideChannels;
        if (is_array($pageSelection)) {
            $codEnabled = in_array('cod', $pageSelection, true);
            $walletChannels = array_values(array_filter(
                $shopWideChannels,
                fn (array $c) => in_array($c['provider'], $pageSelection, true)
            ));
        }

        // gateway_auto channels aren't affected by the same page-level
        // "payment_channels" narrowing yet — Phase B/C ships them shop-wide
        // only, same as wallet channels were before that setting existed.
        // A per-page gateway toggle can be added later the same way if a
        // seller ever wants it.
        $gatewayChannels = $this->onlinePaymentService->getEnabledGatewayChannels($ownerId);

        return response()->json([
            'success' => true,
            'data' => [
                'cod_enabled' => $codEnabled,
                'wallet_channels' => $walletChannels,
                'gateway_channels' => $gatewayChannels,
            ],
        ]);
    }

    public function initiateGateway(Request $request, string $slug, int $orderId): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'provider' => ['required', Rule::in(PaymentGatewayCredential::PROVIDERS)],
        ]);

        $page = $this->resolvePage($slug, $request);
        $order = $this->resolveOrder($page, $orderId, $data['token']);

        $result = $this->onlinePaymentService->initiateGateway($order, $data['provider'], url('/api'));

        return response()->json(['success' => true, 'data' => $result]);
    }

    /** Browser-redirect leg — the return URL we minted at initiateGateway()
     *  time already embeds our own claim id, so no payload-matching is
     *  needed here (unlike the IPN leg below). Always ends in a redirect
     *  back to the seller's own thank-you page, success or fail alike. */
    public function gatewayCallback(Request $request, string $provider, int $id): RedirectResponse
    {
        $claim = OrderOnlinePayment::where('provider', $provider)->findOrFail($id);
        $order = $claim->order()->with('user')->first();
        $page = LandingPage::find((int) $order->source_ref);

        $thankYouPath = $page ? "/{$page->slug}/thank-you?order={$order->id}&token={$order->public_token}" : '/';
        $frontendUrl = FrontendUrl::forUserPath($order->user, ltrim($thankYouPath, '/'));

        $claim = $this->onlinePaymentService->completeGatewayCallback($claim, $request->all());

        $result = in_array($claim->status, [OrderOnlinePayment::STATUS_COMPLETED], true) ? 'success' : 'failed';

        return redirect($frontendUrl . (str_contains($frontendUrl, '?') ? '&' : '?') . 'payment_result=' . $result);
    }

    /** Server-to-server leg — some providers configure this once per
     *  merchant account rather than per-transaction, so it must resolve
     *  purely from the payload's own fields, not a path param. */
    public function gatewayIpn(Request $request, string $provider): JsonResponse
    {
        $payload = $request->all();
        $candidateIds = array_filter([
            $payload['tran_id'] ?? null,
            $payload['val_id'] ?? null,
            $payload['invoice_id'] ?? null,
            $payload['mer_txnid'] ?? null,
        ]);

        $claim = OrderOnlinePayment::where('provider', $provider)
            ->where(function ($q) use ($candidateIds) {
                foreach ($candidateIds as $value) {
                    $q->orWhere('provider_payment_id', $value);
                }
            })
            ->first();

        if (! $claim) {
            return response()->json(['success' => false, 'message' => 'Unknown transaction.'], 404);
        }

        $this->onlinePaymentService->completeGatewayCallback($claim, $payload);

        return response()->json(['success' => true]);
    }

    public function submitWalletClaim(Request $request, string $slug, int $orderId): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'provider' => ['required', Rule::in(['bkash', 'nagad', 'rocket'])],
            'sender_number' => ['required', 'string', 'max:20'],
            'customer_trx_id' => ['required', 'string', 'max:60'],
            'screenshot' => ['nullable', 'file', 'image', 'max:4096'],
        ]);

        $page = $this->resolvePage($slug, $request);
        $order = $this->resolveOrder($page, $orderId, $data['token']);

        $claim = $this->onlinePaymentService->submitWalletClaim(
            $order,
            $data['provider'],
            $data['sender_number'],
            $data['customer_trx_id'],
            $request->file('screenshot'),
        );

        return response()->json([
            'success' => true,
            'message' => 'পেমেন্টের তথ্য পাঠানো হয়েছে। সেলার যাচাই করার পর কনফার্ম হবে।',
            'data' => ['status' => $claim->status],
        ], 201);
    }

    // ── Seller dashboard ────────────────────────────────────────────────

    public function pendingVerification(): JsonResponse
    {
        $shopUserIds = auth()->user()->shopUserIds();

        $claims = OrderOnlinePayment::whereIn('user_id', $shopUserIds)
            ->where('status', OrderOnlinePayment::STATUS_AWAITING_VERIFICATION)
            ->with('order:id,order_number,customer_name,customer_phone,total')
            ->orderBy('created_at')
            ->get();

        return response()->json(['success' => true, 'data' => $claims]);
    }

    public function verify(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'approve' => ['required', 'boolean'],
            'note' => ['nullable', 'string', 'max:500'],
            // Required only when approving — the seller manually confirms
            // what they actually received, not the customer's own claim.
            'amount' => [Rule::requiredIf((bool) $request->boolean('approve')), 'nullable', 'numeric', 'min:0.01'],
        ]);

        $claim = OrderOnlinePayment::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        $claim = $this->onlinePaymentService->verifyWalletClaim(
            $claim,
            auth()->user(),
            $data['approve'],
            $data['note'] ?? null,
            isset($data['amount']) ? (float) $data['amount'] : null,
        );

        return response()->json([
            'success' => true,
            'message' => $data['approve'] ? 'পেমেন্ট ভেরিফাই করা হয়েছে।' : 'দাবিটি বাতিল করা হয়েছে।',
            'data' => $claim->fresh(),
        ]);
    }

    private function resolvePage(string $slug, Request $request): LandingPage
    {
        return LandingPageResolver::query($slug, $request)
            ->where('status', 'published')
            ->firstOrFail();
    }

    private function resolveOrder(LandingPage $page, int $orderId, string $token): Order
    {
        $order = Order::query()
            ->where('id', $orderId)
            ->where('source', 'landing_page')
            ->where('source_ref', (string) $page->id)
            ->whereNotNull('public_token')
            ->first();

        if (! $order || ! hash_equals($order->public_token, $token)) {
            abort(404);
        }

        return $order;
    }
}
