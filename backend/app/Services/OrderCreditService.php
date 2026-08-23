<?php

namespace App\Services;

use App\Models\OrderCreditHistory;
use App\Models\OrderCreditWallet;
use Illuminate\Support\Facades\DB;

/**
 * Order-credit wallet operations — subscription_billing_context.md §9.2-B,
 * §9.3. Same shape as SmsCreditService (walletFor/recharge/deduct) but
 * with lazy expiry (§9.3 decision #1/#2: single refreshing balance, no
 * per-lot tracking, no rollover) baked into every read/consume.
 */
class OrderCreditService
{
    /** Real usable balance right now (0 once expired) — what the seller-facing UI should show. */
    public function getAvailableBalance(int $userId): int
    {
        return OrderCreditWallet::walletFor($userId)->availableBalance();
    }

    /**
     * Grant credits from an approved add-on purchase. Always resets the
     * expiry to a fresh window from now (decision #1: buying more credits
     * always refreshes the clock, no separate "lots").
     */
    public function grant(int $userId, int $credits, int $durationDays, ?string $note = null, ?int $addonPurchaseId = null): void
    {
        DB::transaction(function () use ($userId, $credits, $durationDays, $note, $addonPurchaseId) {
            $wallet = OrderCreditWallet::walletFor($userId);
            $wallet->increment('balance', $credits);
            $wallet->update(['expires_at' => now()->addDays($durationDays)]);

            OrderCreditHistory::create([
                'user_id' => $userId,
                'type' => 'purchase',
                'credits' => $credits,
                'balance_after' => $wallet->fresh()->balance,
                'addon_purchase_id' => $addonPurchaseId,
                'note' => $note,
            ]);
        });
    }

    /**
     * Atomically consume exactly one credit if available (not expired,
     * balance > 0). Returns false (no-op, nothing charged) if there's
     * nothing usable — the caller (OrderStatusService) falls back to
     * blocking with 402 in that case.
     */
    public function consumeOne(int $userId, ?int $orderId = null, ?string $note = null): bool
    {
        return DB::transaction(function () use ($userId, $orderId, $note) {
            $wallet = OrderCreditWallet::where('user_id', $userId)
                ->where('balance', '>', 0)
                ->where(function ($q) {
                    $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
                })
                ->lockForUpdate()
                ->first();

            if (! $wallet) {
                return false;
            }

            $wallet->decrement('balance', 1);

            OrderCreditHistory::create([
                'user_id' => $userId,
                'type' => 'consume',
                'credits' => -1,
                'balance_after' => $wallet->fresh()->balance,
                'order_id' => $orderId,
                'note' => $note,
            ]);

            return true;
        });
    }
}
