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

        $base = ($user->subscription_ends_at && $user->subscription_ends_at->isFuture())
            ? $user->subscription_ends_at
            : now();

        $user->update([
            'subscription_package_id' => $package->id,
            'subscription_status' => 'active',
            'subscription_started_at' => $user->subscription_started_at ?? now(),
            'subscription_ends_at' => $base->copy()->addDays($package->duration_days),
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
