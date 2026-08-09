<?php

namespace App\Services;

use App\Models\SubscriptionPackage;
use App\Models\User;

/**
 * Computes the invoice breakdown for a seller buying/upgrading/renewing a
 * subscription package — shared by the invoice-preview endpoint and every
 * purchase entry point (manual submit, bKash Tokenized, bKash PGW) so the
 * amount charged is always server-computed, never trusted from the client.
 *
 * See subscription_billing_context.md §2 for the design (upgrade-only
 * proration, downgrade blocked while active, fresh full cycle on upgrade).
 */
class SubscriptionInvoiceService
{
    public function compute(User $user, SubscriptionPackage $target): array
    {
        $currentPackage = $user->subscriptionPackage;
        $hasActive = $currentPackage
            && $user->subscription_ends_at
            && ! $user->isSubscriptionExpired();

        $isSamePackage = $hasActive && $currentPackage->id === $target->id;
        $isUpgrade = $hasActive && ! $isSamePackage && (float) $target->price > (float) $currentPackage->price;
        $isDowngradeBlocked = $hasActive && ! $isSamePackage && (float) $target->price < (float) $currentPackage->price;

        $baseAmount = round((float) $target->price, 2);
        $prorationCredit = 0.0;
        $currentRemaining = null;

        if ($isUpgrade) {
            $remainingSeconds = max(0, now()->diffInSeconds($user->subscription_ends_at, false));
            $remainingDays = $remainingSeconds / 86400;
            $dailyRate = $currentPackage->duration_days > 0
                ? ((float) $currentPackage->price / $currentPackage->duration_days)
                : 0.0;

            $prorationCredit = round($remainingDays * $dailyRate, 2);
            $prorationCredit = min($prorationCredit, $baseAmount);

            $currentRemaining = [
                'days' => (int) floor($remainingSeconds / 86400),
                'hours' => (int) floor(($remainingSeconds % 86400) / 3600),
                'minutes' => (int) floor(($remainingSeconds % 3600) / 60),
                'total_seconds' => $remainingSeconds,
            ];
        }

        $payableAmount = round(max(0, $baseAmount - $prorationCredit), 2);

        // Renewal of the same package extends the existing ends_at (unchanged
        // legacy behaviour); an upgrade starts a fresh cycle from now (the
        // leftover value was already credited into payable_amount above); a
        // fresh purchase (no active subscription) also starts from now.
        $newEndsAtPreview = ($isSamePackage && $hasActive)
            ? $user->subscription_ends_at->copy()->addDays($target->duration_days)
            : now()->addDays($target->duration_days);

        return [
            'target_package' => [
                'id' => $target->id,
                'name' => $target->name,
                'price' => $baseAmount,
                'duration_days' => $target->duration_days,
            ],
            'previous_package' => $currentPackage ? [
                'id' => $currentPackage->id,
                'name' => $currentPackage->name,
                'price' => round((float) $currentPackage->price, 2),
            ] : null,
            'is_current' => $isSamePackage,
            'is_upgrade' => $isUpgrade,
            'is_downgrade_blocked' => $isDowngradeBlocked,
            'base_amount' => $baseAmount,
            'proration_credit' => $prorationCredit,
            'payable_amount' => $payableAmount,
            'current_remaining' => $currentRemaining,
            'new_ends_at_preview' => $newEndsAtPreview->toIso8601String(),
        ];
    }
}
