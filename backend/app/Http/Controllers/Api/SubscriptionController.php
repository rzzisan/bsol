<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Services\HeldOrderService;
use App\Services\InvoicePdfService;
use App\Services\SubscriptionActivationService;
use App\Services\SubscriptionInvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class SubscriptionController extends Controller
{
    public function __construct(
        private readonly SubscriptionInvoiceService $invoiceService,
        private readonly InvoicePdfService $invoicePdfService,
        private readonly HeldOrderService $heldOrders,
        private readonly SubscriptionActivationService $activationService,
    ) {}

    public function plans(): JsonResponse
    {
        $user = auth()->user();
        $packages = SubscriptionPackage::where('is_active', true)
            ->orderBy('price')
            ->get();

        $data = $packages->map(function (SubscriptionPackage $package) use ($user) {
            $invoice = $this->invoiceService->compute($user, $package);

            return array_merge($package->toArray(), [
                'is_current' => $invoice['is_current'],
                'is_upgrade' => $invoice['is_upgrade'],
                'is_downgrade_blocked' => $invoice['is_downgrade_blocked'],
                'payable_amount' => $invoice['payable_amount'],
            ]);
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function invoicePreview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
        ]);

        $package = SubscriptionPackage::findOrFail($validated['package_id']);
        $invoice = $this->invoiceService->compute(auth()->user(), $package);

        return response()->json([
            'success' => true,
            'data' => $invoice,
        ]);
    }

    public function mySubscription(): JsonResponse
    {
        $user = auth()->user()->load('subscriptionPackage');

        // Safety net for renewal paths that don't go through
        // SubscriptionActivationService (admin editing the dates, a failed
        // release): once the plan is live again, surface any held orders.
        if (! $user->isSubscriptionExpired()) {
            $this->heldOrders->release($user);
        }

        $daysLeft = $user->subscription_ends_at
            ? max(0, now()->diffInDays($user->subscription_ends_at, false))
            : null;

        $remaining = null;
        if ($user->subscription_ends_at && ! $user->isSubscriptionExpired()) {
            $remainingSeconds = max(0, now()->diffInSeconds($user->subscription_ends_at, false));
            $remaining = [
                'days' => (int) floor($remainingSeconds / 86400),
                'hours' => (int) floor(($remainingSeconds % 86400) / 3600),
                'minutes' => (int) floor(($remainingSeconds % 3600) / 60),
                'total_seconds' => $remainingSeconds,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'package' => $user->subscriptionPackage,
                'status' => $user->subscription_status,
                'started_at' => $user->subscription_started_at,
                'ends_at' => $user->subscription_ends_at,
                'days_left' => $daysLeft,
                'remaining' => $remaining,
                'is_expired' => $user->isSubscriptionExpired(),
                // Orders customers placed while expired, hidden until renewal
                // (subscription_billing_context.md §13).
                'held_orders_count' => $this->heldOrders->heldCount($user->id),
                'held_leads_count' => $this->heldOrders->heldLeadsCount($user->id),
                'held_orders_expire_at' => $this->heldOrders->oldestExpiresAt($user->id),
                'recent_payments' => $user->subscriptionPayments()
                    ->with('package:id,name,slug')
                    ->latest()
                    ->take(10)
                    ->get(),
            ],
        ]);
    }

    /**
     * Activates a plan whose payable amount is zero — a free package (Trial)
     * or an upgrade fully covered by the proration credit. There is nothing
     * to charge, so the gateway flow (which needs a positive amount) can't
     * be used. A genuinely free package (base price 0) can be taken once per
     * account, otherwise Trial could be re-claimed forever.
     * subscription_billing_context.md §2.5.
     */
    public function activateFree(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
        ]);

        $user = $request->user();
        $package = SubscriptionPackage::where('is_active', true)->findOrFail($validated['package_id']);
        $invoice = $this->invoiceService->compute($user, $package);

        if ($invoice['is_downgrade_blocked']) {
            throw ValidationException::withMessages([
                'package_id' => ['বর্তমান প্যাকেজের মেয়াদ শেষ না হওয়া পর্যন্ত এর চেয়ে ছোট প্যাকেজে যাওয়া যাবে না।'],
            ]);
        }

        if ((float) $invoice['payable_amount'] > 0) {
            throw ValidationException::withMessages([
                'package_id' => ['এই প্যাকেজের জন্য পেমেন্ট প্রয়োজন।'],
            ]);
        }

        if ((float) $invoice['base_amount'] <= 0) {
            $alreadyUsed = $user->subscription_package_id === $package->id
                || SubscriptionPayment::where('user_id', $user->id)
                    ->where('package_id', $package->id)
                    ->where('status', 'approved')
                    ->exists();

            if ($alreadyUsed) {
                throw ValidationException::withMessages([
                    'package_id' => ['এই ফ্রি প্যাকেজটি আপনি আগেই ব্যবহার করেছেন। অন্য একটি প্যাকেজ বেছে নিন।'],
                ]);
            }
        }

        $payment = SubscriptionPayment::create([
            'user_id' => $user->id,
            'package_id' => $package->id,
            'previous_package_id' => $invoice['is_upgrade'] ? $invoice['previous_package']['id'] : null,
            'amount' => 0,
            'base_amount' => $invoice['base_amount'],
            'proration_credit' => $invoice['proration_credit'],
            'invoice_breakdown' => $invoice,
            'payment_method' => 'free',
            'status' => 'approved',
            'reviewed_at' => now(),
        ]);

        $this->activationService->activate($payment);

        return response()->json(['success' => true]);
    }

    public function invoicePdf(SubscriptionPayment $payment): Response
    {
        abort_unless($payment->user_id === auth()->id(), 403);

        return $this->invoicePdfService->subscriptionInvoice($payment)
            ->stream("invoice-SUB-{$payment->id}.pdf")
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}
