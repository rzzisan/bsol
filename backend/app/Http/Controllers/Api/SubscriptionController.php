<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformBillingSetting;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Services\InvoicePdfService;
use App\Services\Payment\BkashPgwPaymentGatewayClient;
use App\Services\SubscriptionInvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SubscriptionController extends Controller
{
    public function __construct(
        private readonly BkashPgwPaymentGatewayClient $bkashPgw,
        private readonly SubscriptionInvoiceService $invoiceService,
        private readonly InvoicePdfService $invoicePdfService,
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
        $billingSettings = PlatformBillingSetting::getSetting();

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
                'payment_instructions' => [
                    'bkash_number' => $billingSettings->bkash_number,
                    'bkash_type' => $billingSettings->bkash_type,
                ],
                'bkash_gateway_enabled' => $billingSettings->hasBkashGateway(),
                'bkash_api_type' => PlatformBillingSetting::resolvedBkashApiType(),
                'bkash_pgw_script_url' => $this->bkashPgw->scriptUrl(),
                'recent_payments' => $user->subscriptionPayments()
                    ->with('package:id,name,slug')
                    ->latest()
                    ->take(10)
                    ->get(),
            ],
        ]);
    }

    public function invoicePdf(SubscriptionPayment $payment): Response
    {
        abort_unless($payment->user_id === auth()->id(), 403);

        return $this->invoicePdfService->subscriptionInvoice($payment)
            ->stream("invoice-SUB-{$payment->id}.pdf")
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}
