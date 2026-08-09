<?php

namespace App\Services;

use App\Models\SubscriptionPayment;
use App\Services\NotificationDispatchService;

/**
 * Activates a user's subscription from an approved payment — shared by
 * manual admin approval (AdminSubscriptionController::approvePayment) and
 * bKash gateway auto-approval (BkashPaymentController::callback), so both
 * paths extend an already-active subscription the same way instead of
 * clobbering remaining days.
 */
class SubscriptionActivationService
{
    public function __construct(private readonly NotificationDispatchService $notificationDispatchService) {}

    public function activate(SubscriptionPayment $payment): void
    {
        $user = $payment->user;
        $package = $payment->package;

        // An upgrade (previous_package_id set and different from the package
        // being activated — see SubscriptionInvoiceService) starts a fresh
        // full cycle from now: the seller already paid for a full new period,
        // and the leftover value of the old package was credited into the
        // payable amount instead of being added as extra days (that would be
        // a double benefit — subscription_billing_context.md §2.4).
        // Otherwise (renewal of the same package, or a fresh purchase after
        // expiry) the legacy "extend from ends_at if still future" behaviour
        // applies unchanged.
        $isUpgrade = $payment->previous_package_id && $payment->previous_package_id !== $package->id;

        if ($isUpgrade) {
            $newEndsAt = now()->addDays($package->duration_days);
        } else {
            $base = ($user->subscription_ends_at && $user->subscription_ends_at->isFuture())
                ? $user->subscription_ends_at
                : now();
            $newEndsAt = $base->copy()->addDays($package->duration_days);
        }

        $user->update([
            'subscription_package_id' => $package->id,
            'subscription_status' => 'active',
            'subscription_started_at' => $user->subscription_started_at ?? now(),
            'subscription_ends_at' => $newEndsAt,
        ]);

        try {
            $this->notificationDispatchService->dispatch($user, 'subscription_payment_approved', $user->mobile, $user->email, [
                'package_name' => $package->name,
                'ends_at' => $user->subscription_ends_at?->toDateString(),
            ]);
        } catch (\Throwable) {
            // Notification is best-effort; activation must not fail because of it.
        }
    }
}
