<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderOnlinePayment;
use App\Models\OrderPayment;
use App\Models\PaymentGatewayCredential;
use App\Models\PaymentGatewaySetting;
use App\Models\User;
use App\Services\Payment\PaymentGatewayFactory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Orchestrates customer-facing online payment — wallet_manual (Phase A:
 * bKash/Nagad/Rocket personal-number send & verify) and gateway_auto
 * (Phase B/C: SSLCommerz and friends, per-seller merchant credentials) both
 * live here since they share the same confirm-and-cascade logic
 * (applyConfirmedPayment()). See online_payment_context.md.
 */
class OnlinePaymentService
{
    public function __construct(
        private readonly AccountingService $accountingService,
        private readonly OrderStatusService $orderStatusService,
    ) {}

    /** Channels a seller has actually turned on and filled in — what the
     *  public checkout should offer. */
    public function getEnabledWalletChannels(int $shopOwnerId): array
    {
        $settings = PaymentGatewaySetting::where('user_id', $shopOwnerId)->first();
        return $settings?->activeWalletChannels() ?? [];
    }

    /**
     * Customer submits proof of a personal-wallet transfer they already made
     * outside our system. Creates the claim in awaiting_verification —
     * nothing is confirmed/collected yet, a seller/staff must verify it.
     */
    public function submitWalletClaim(Order $order, string $provider, string $senderNumber, string $trxId, ?UploadedFile $screenshot): OrderOnlinePayment
    {
        $settings = PaymentGatewaySetting::where('user_id', $order->user_id)->first();
        $enabled = collect($settings?->activeWalletChannels() ?? [])->pluck('provider');

        if (! $enabled->contains($provider)) {
            throw ValidationException::withMessages([
                'provider' => ['এই পেমেন্ট চ্যানেলটি এই শপে চালু নেই।'],
            ]);
        }

        $due = $order->dueAmount();
        if ($due <= 0) {
            throw ValidationException::withMessages([
                'order' => ['এই অর্ডারে আর কোনো বকেয়া নেই।'],
            ]);
        }

        // Friendly pre-check ahead of the DB-level unique index — same real
        // TrxID must not be claimable against more than one order for this
        // seller (a customer replaying one genuine transaction across
        // several orders). The unique index is still the actual guard
        // (race-safe); this just gives a clean message on the common path.
        $alreadyUsed = OrderOnlinePayment::where('user_id', $order->user_id)
            ->where('channel_type', OrderOnlinePayment::CHANNEL_WALLET_MANUAL)
            ->where('customer_trx_id', $trxId)
            ->exists();
        if ($alreadyUsed) {
            throw ValidationException::withMessages([
                'customer_trx_id' => ['এই ট্রানজেকশন আইডি ইতিমধ্যে অন্য একটি অর্ডারে ব্যবহার করা হয়েছে।'],
            ]);
        }

        $screenshotPath = null;
        if ($screenshot) {
            $screenshotPath = $screenshot->store('online-payments/' . $order->user_id, 'public');
        }

        try {
            return OrderOnlinePayment::create([
                'order_id' => $order->id,
                'user_id' => $order->user_id,
                'channel_type' => OrderOnlinePayment::CHANNEL_WALLET_MANUAL,
                'provider' => $provider,
                'amount' => $due,
                'status' => OrderOnlinePayment::STATUS_AWAITING_VERIFICATION,
                'sender_number' => $senderNumber,
                'customer_trx_id' => $trxId,
                'screenshot_path' => $screenshotPath,
                'expires_at' => now()->addHours(24),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            if ($screenshotPath) {
                Storage::disk('public')->delete($screenshotPath);
            }
            // The DB-level unique index caught a race the pre-check above
            // missed (two near-simultaneous submits of the same real TrxID).
            throw ValidationException::withMessages([
                'customer_trx_id' => ['এই ট্রানজেকশন আইডি ইতিমধ্যে অন্য একটি অর্ডারে ব্যবহার করা হয়েছে।'],
            ]);
        }
    }

    /**
     * Seller/staff approves or rejects a pending wallet claim. Approve
     * cascades exactly like OrderPaymentController::store()'s manual-payment
     * path: a real OrderPayment row, an accounting transaction, and an
     * auto-confirm transition (only from 'pending', never pulling a
     * further-along order backward).
     *
     * $amount is the amount the seller actually confirms receiving —
     * manually entered at approve time, not blindly trusted from the
     * customer's own claim (the customer may have sent less/more than the
     * order total, or made a mistake typing the claim). Required when
     * $approve is true; ignored on reject.
     */
    public function verifyWalletClaim(OrderOnlinePayment $claim, User $verifier, bool $approve, ?string $note = null, ?float $amount = null): OrderOnlinePayment
    {
        if ($claim->isTerminal()) {
            throw ValidationException::withMessages([
                'claim' => ['এই দাবিটি ইতিমধ্যে নিষ্পত্তি করা হয়েছে।'],
            ]);
        }

        if ($approve && ($amount === null || $amount <= 0)) {
            throw ValidationException::withMessages([
                'amount' => ['কত টাকা পেয়েছেন তা লিখুন।'],
            ]);
        }

        return DB::transaction(function () use ($claim, $verifier, $approve, $note, $amount) {
            // Row-lock to guard against a double-click double-approving the
            // same claim — mirrors the tightened idempotency discipline
            // called for in online_payment_context.md's gateway-callback
            // design, applied here too since this is the same "confirm
            // money received" trust boundary.
            $claim = OrderOnlinePayment::whereKey($claim->id)->lockForUpdate()->firstOrFail();
            if ($claim->isTerminal()) {
                throw ValidationException::withMessages([
                    'claim' => ['এই দাবিটি ইতিমধ্যে নিষ্পত্তি করা হয়েছে।'],
                ]);
            }

            $order = $claim->order()->lockForUpdate()->first();

            if (! $approve) {
                $claim->update([
                    'status' => OrderOnlinePayment::STATUS_REJECTED,
                    'verified_by' => $verifier->id,
                    'verified_at' => now(),
                    'note' => $note,
                ]);
                return $claim;
            }

            $note = "Online payment verified — sender {$claim->sender_number}, TrxID {$claim->customer_trx_id}"
                . ((float) $amount !== (float) $claim->amount ? " (claimed ৳{$claim->amount}, confirmed ৳{$amount})." : '.');
            $payment = $this->applyConfirmedPayment($claim, $order, $amount, $verifier->id, $note);

            $claim->update([
                'status' => OrderOnlinePayment::STATUS_VERIFIED,
                'verified_by' => $verifier->id,
                'verified_at' => now(),
                'note' => $note,
                'order_payment_id' => $payment->id,
            ]);

            return $claim;
        });
    }

    /**
     * The shared "money confirmed, cascade it" logic — extracted from
     * verifyWalletClaim()'s approve branch so the gateway_auto path below
     * doesn't duplicate it. Creates the ledger row, books it in accounting,
     * and auto-confirms the order (only from 'pending', matching every
     * other payment-confirmation path in this codebase).
     */
    private function applyConfirmedPayment(OrderOnlinePayment $claim, Order $order, float $amount, ?int $verifiedBy, string $note): OrderPayment
    {
        $payment = OrderPayment::create([
            'order_id' => $order->id,
            'user_id' => $order->user_id,
            'source' => $claim->channel_type === OrderOnlinePayment::CHANNEL_WALLET_MANUAL ? 'online_wallet' : 'online_gateway',
            'collected_by' => null,
            'created_by' => $verifiedBy,
            'purpose' => 'full_payment',
            'method' => $claim->provider,
            'amount' => $amount,
            'discount' => 0,
            'screenshot_path' => $claim->screenshot_path,
            'note' => $note,
            'collected_at' => now(),
        ]);

        $this->accountingService->recordManualPayment($payment, 'order_online_payment');

        if ($amount > 0 && $order->status === 'pending') {
            $this->orderStatusService->transition(
                $order,
                'confirmed',
                $claim->channel_type === OrderOnlinePayment::CHANNEL_WALLET_MANUAL
                    ? 'Order confirmed via verified online wallet payment.'
                    : 'Order confirmed via automated online payment gateway.',
                $verifiedBy,
            );
        }

        return $payment;
    }

    // ── gateway_auto (Phase B/C) ────────────────────────────────────────

    /** Gateways a seller has enabled AND whose credentials are actually
     *  complete (isConfigured()) — a half-filled credential set shouldn't
     *  appear as a live checkout option. */
    public function getEnabledGatewayChannels(int $shopOwnerId): array
    {
        return PaymentGatewayCredential::where('user_id', $shopOwnerId)
            ->where('enabled', true)
            ->get()
            ->filter(fn (PaymentGatewayCredential $cred) => PaymentGatewayFactory::supports($cred->provider)
                && PaymentGatewayFactory::make($cred->provider, $cred)->isConfigured())
            ->map(fn (PaymentGatewayCredential $cred) => ['provider' => $cred->provider])
            ->values()
            ->all();
    }

    /**
     * Opens a hosted checkout session with the given provider. $callbackBaseUrl
     * is the platform's own API base (never the seller's subdomain — the
     * gateway calls this URL directly, and it must be reachable/stable
     * regardless of which subdomain the customer started the checkout on).
     */
    public function initiateGateway(Order $order, string $provider, string $callbackBaseUrl): array
    {
        $credential = PaymentGatewayCredential::where('user_id', $order->user_id)
            ->where('provider', $provider)
            ->where('enabled', true)
            ->first();

        if (! $credential || ! PaymentGatewayFactory::supports($provider)) {
            throw ValidationException::withMessages([
                'provider' => ['এই পেমেন্ট গেটওয়েটি এই শপে চালু নেই।'],
            ]);
        }

        $client = PaymentGatewayFactory::make($provider, $credential);
        if (! $client->isConfigured()) {
            throw ValidationException::withMessages([
                'provider' => ['এই পেমেন্ট গেটওয়ের সেটিং সম্পূর্ণ নয়।'],
            ]);
        }

        $due = $order->dueAmount();
        if ($due <= 0) {
            throw ValidationException::withMessages([
                'order' => ['এই অর্ডারে আর কোনো বকেয়া নেই।'],
            ]);
        }

        $claim = OrderOnlinePayment::create([
            'order_id' => $order->id,
            'user_id' => $order->user_id,
            'channel_type' => OrderOnlinePayment::CHANNEL_GATEWAY_AUTO,
            'provider' => $provider,
            'amount' => $due,
            'status' => OrderOnlinePayment::STATUS_INITIATED,
            // Gateway checkout sessions expire fast (typically ~15-30 min on
            // the provider's own side) — much shorter than a wallet claim's
            // 24h window, where the customer sends money on their own time.
            'expires_at' => now()->addMinutes(30),
        ]);

        // Ours from the start — the return URL is keyed by our own claim id
        // (path param), so the redirect leg never needs provider_payment_id
        // lookup at all; only the IPN leg (no path param available) does.
        $merchantTranId = 'OOP-' . $claim->id . '-' . Str::random(8);
        $returnUrl = rtrim($callbackBaseUrl, '/') . "/online-payment/{$provider}/callback/{$claim->id}";

        $result = $client->createPayment($merchantTranId, $due, $returnUrl, [
            'name' => $order->customer_name,
            'phone' => $order->customer_phone,
            'address' => $order->customer_address,
        ]);

        $claim->update([
            'provider_payment_id' => $result['provider_payment_id'],
            // merchant_tran_id kept alongside the raw response — not every
            // provider's provider_payment_id equals what we minted (some
            // mint their own opaque id instead), so verifyPayment() needs
            // both values later and gateway_response is the only place to
            // keep the one that isn't already a dedicated column.
            'gateway_response' => ['merchant_tran_id' => $merchantTranId],
        ]);

        return ['redirect_url' => $result['redirect_url']];
    }

    /**
     * Confirms (or fails) a gateway_auto claim after a browser-redirect
     * callback or a server-to-server IPN — the caller resolves which
     * OrderOnlinePayment row this is (by path param for the redirect leg,
     * by payload-matching provider_payment_id for the IPN leg) and hands it
     * here. Idempotent: a second call for an already-terminal claim is a
     * no-op, guarding the redirect and IPN legs racing each other.
     */
    public function completeGatewayCallback(OrderOnlinePayment $claim, array $callbackData): OrderOnlinePayment
    {
        if ($claim->isTerminal()) {
            return $claim;
        }

        return DB::transaction(function () use ($claim, $callbackData) {
            $claim = OrderOnlinePayment::whereKey($claim->id)->lockForUpdate()->firstOrFail();
            if ($claim->isTerminal()) {
                return $claim;
            }

            $order = $claim->order()->lockForUpdate()->first();
            $credential = PaymentGatewayCredential::where('user_id', $claim->user_id)
                ->where('provider', $claim->provider)
                ->firstOrFail();
            $client = PaymentGatewayFactory::make($claim->provider, $credential);

            $merchantTranId = $claim->gateway_response['merchant_tran_id'] ?? (string) $claim->provider_payment_id;
            $result = $client->verifyPayment($merchantTranId, (string) $claim->provider_payment_id, $callbackData);

            $claim->update([
                'gateway_response' => array_merge($claim->gateway_response ?? [], [
                    'last_callback' => $callbackData,
                    'verify_result' => $result['raw'] ?? [],
                ]),
                'provider_trx_id' => $result['trx_id'] ?? $claim->provider_trx_id,
            ]);

            if (! ($result['success'] ?? false)) {
                $claim->update(['status' => OrderOnlinePayment::STATUS_FAILED]);
                return $claim;
            }

            $amount = $result['amount'] ?? (float) $claim->amount;
            $note = "Online payment via {$claim->provider} — TrxID " . ($result['trx_id'] ?? 'N/A') . '.';
            $payment = $this->applyConfirmedPayment($claim, $order, $amount, null, $note);

            $claim->update([
                'status' => OrderOnlinePayment::STATUS_COMPLETED,
                'order_payment_id' => $payment->id,
            ]);

            return $claim;
        });
    }
}
