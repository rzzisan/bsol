<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderOnlinePayment;
use App\Models\OrderPayment;
use App\Models\PaymentGatewaySetting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Orchestrates customer-facing online payment — Phase A (this class) covers
 * only wallet_manual (bKash/Nagad/Rocket personal-number send & verify).
 * Phase B/C (gateway_auto — SSLCommerz, bKash merchant) add methods here
 * without touching what's below. See online_payment_context.md.
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
     */
    /**
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

            $payment = OrderPayment::create([
                'order_id' => $order->id,
                'user_id' => $order->user_id,
                'source' => 'online_wallet',
                'collected_by' => null,
                'created_by' => $verifier->id,
                'purpose' => 'full_payment',
                'method' => $claim->provider,
                'amount' => $amount,
                'discount' => 0,
                'screenshot_path' => $claim->screenshot_path,
                'note' => "Online payment verified — sender {$claim->sender_number}, TrxID {$claim->customer_trx_id}"
                    . ((float) $amount !== (float) $claim->amount ? " (claimed ৳{$claim->amount}, confirmed ৳{$amount})." : '.'),
                'collected_at' => now(),
            ]);

            $this->accountingService->recordManualPayment($payment, 'order_online_payment');

            if ($amount > 0 && $order->status === 'pending') {
                $this->orderStatusService->transition(
                    $order,
                    'confirmed',
                    'Order confirmed via verified online wallet payment.',
                    $verifier->id,
                );
            }

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
}
