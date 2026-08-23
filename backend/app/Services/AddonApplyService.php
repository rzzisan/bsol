<?php

namespace App\Services;

use App\Models\AddonPurchase;

/**
 * "What happens when an add-on purchase is approved" — subscription_billing_context.md
 * §9.2-B. One shared purchase/payment pipeline (AddonPurchase), a small
 * per-type branch here for the actual effect. Only 'order_credit' is
 * implemented — the other AddonPackage::TYPES values aren't creatable yet
 * (AddonPackage::CREATABLE_TYPES), so this can't be reached for them.
 */
class AddonApplyService
{
    public function __construct(
        private readonly OrderCreditService $orderCreditService,
    ) {}

    /** Idempotent — a purchase already applied (applied_at set) is a no-op. */
    public function apply(AddonPurchase $purchase): void
    {
        if ($purchase->applied_at !== null) {
            return;
        }

        $package = $purchase->addonPackage;

        match ($package->type) {
            'order_credit' => $this->orderCreditService->grant(
                userId: $purchase->user_id,
                credits: (int) $package->quantity,
                durationDays: (int) $package->duration_days,
                note: "Add-on purchase #{$purchase->id} ({$package->name})",
                addonPurchaseId: $purchase->id,
            ),
            default => throw new \RuntimeException("No AddonApplyService branch for type '{$package->type}' yet."),
        };

        $purchase->update(['applied_at' => now()]);
    }
}
