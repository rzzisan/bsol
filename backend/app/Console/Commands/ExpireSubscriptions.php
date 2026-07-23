<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:expire-subscriptions')]
#[Description('Flip lapsed subscriptions to expired and remind users approaching expiry.')]
class ExpireSubscriptions extends Command
{
    public function handle(NotificationDispatchService $notificationDispatchService): void
    {
        $expiredCount = User::query()
            ->whereIn('subscription_status', ['trial', 'active'])
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<', now())
            ->update(['subscription_status' => 'expired']);

        $this->info("Expired {$expiredCount} subscription(s).");

        $reminderWindowStart = now();
        $reminderWindowEnd = now()->addDays(3);

        $expiringSoon = User::query()
            ->whereIn('subscription_status', ['trial', 'active'])
            ->whereNotNull('subscription_ends_at')
            ->whereBetween('subscription_ends_at', [$reminderWindowStart, $reminderWindowEnd])
            ->with('subscriptionPackage:id,name')
            ->get();

        foreach ($expiringSoon as $user) {
            try {
                $notificationDispatchService->dispatch($user, 'subscription_expiry_reminder', $user->mobile, $user->email, [
                    'package_name' => $user->subscriptionPackage?->name,
                    'ends_at' => $user->subscription_ends_at?->toDateString(),
                    'days_left' => (int) now()->diffInDays($user->subscription_ends_at, false),
                ]);
            } catch (\Throwable) {
                // Best-effort reminder; a failed dispatch shouldn't stop the rest of the run.
            }
        }

        $this->info("Sent expiry reminders to {$expiringSoon->count()} user(s).");
    }
}
