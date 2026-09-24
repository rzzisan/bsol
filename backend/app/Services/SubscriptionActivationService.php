<?php

namespace App\Services;

use App\Models\SubscriptionPayment;
use App\Services\Marketing\PlatformMarketingEventService;
use App\Services\NotificationDispatchService;
use App\Support\FrontendUrl;

/**
 * Activates a user's subscription from an approved payment — shared by
 * manual admin approval (AdminSubscriptionController::approvePayment) and
 * every automated-gateway auto-approval path (PlatformGatewayPaymentService,
 * §12/§13.2 — redirect-based gateways and the bKash PGW widget flow alike),
 * so all of them extend an already-active subscription the same way
 * instead of clobbering remaining days.
 */
class SubscriptionActivationService
{
    public function __construct(
        private readonly NotificationDispatchService $notificationDispatchService,
        private readonly StorefrontAddonService $storefrontAddonService,
        private readonly PlatformMarketingEventService $marketingEventService,
    ) {}

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

        // Orders customers placed while the subscription was expired become
        // visible now (HeldOrderService, subscription_billing_context.md §13).
        // Best-effort — a failure here must not undo a paid activation, and
        // mySubscription() retries the release on the next dashboard load.
        try {
            app(HeldOrderService::class)->release($user);
        } catch (\Throwable $e) {
            report($e);
        }

        // Storefront add-on (§9.2-D) — co-terminous with the main cycle,
        // kept in sync here on every renewal/upgrade. No-op if the seller
        // never had it, or it already lapsed.
        $this->storefrontAddonService->extendToMatchIfActive($user, $newEndsAt);

        // BSOL's own acquisition-funnel Subscribe event
        // (platform_marketing_tracking_context.md) — the real conversion
        // signal for ad optimization/lookalikes, since a signup alone
        // (CompleteRegistration, fired at registration) doesn't prove
        // someone became a paying customer. Uses the first-touch fbp/fbc
        // stored on the user at signup, so a payment approved weeks later
        // still attributes to the original ad.
        //
        // action_source: 'system_generated', not 'website' — activation
        // runs from admin approval or a payment-gateway webhook, never a
        // live browser request, so there's no client_user_agent to send
        // truthfully. Meta requires action_source to be accurate; claiming
        // 'website' without the client_user_agent it requires would violate
        // that (Conversions API best practices, platform_marketing_tracking_context.md §2).
        $this->marketingEventService->track(
            eventName: 'Subscribe',
            eventId: 'sub_' . $payment->id,
            rawUserData: [
                'ph' => $user->mobile,
                'em' => $user->email,
                'fn' => $user->name,
                'external_id' => (string) $user->id,
                'fbp' => $user->signup_fbp,
                'fbc' => $user->signup_fbc,
            ],
            customData: [
                'currency' => 'BDT',
                'value' => (float) $payment->amount,
            ],
            userId: $user->id,
            eventSourceUrl: FrontendUrl::platform() . '/dashboard/settings/subscription',
            actionSource: 'system_generated',
        );

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
