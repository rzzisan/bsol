<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformBillingSetting;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Services\Payment\BkashPgwPaymentGatewayClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function __construct(private readonly BkashPgwPaymentGatewayClient $bkashPgw) {}

    public function plans(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => SubscriptionPackage::where('is_active', true)
                ->orderBy('price')
                ->get(),
        ]);
    }

    public function mySubscription(): JsonResponse
    {
        $user = auth()->user()->load('subscriptionPackage');
        $billingSettings = PlatformBillingSetting::getSetting();

        $daysLeft = $user->subscription_ends_at
            ? max(0, now()->diffInDays($user->subscription_ends_at, false))
            : null;

        return response()->json([
            'success' => true,
            'data' => [
                'package' => $user->subscriptionPackage,
                'status' => $user->subscription_status,
                'started_at' => $user->subscription_started_at,
                'ends_at' => $user->subscription_ends_at,
                'days_left' => $daysLeft,
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

    public function submitPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
            'sender_bkash_number' => ['required', 'string', 'max:20'],
            'trx_id' => ['required', 'string', 'max:50', 'unique:subscription_payments,trx_id'],
            'screenshot' => ['nullable', 'file', 'image', 'max:4096'],
        ], [
            'trx_id.unique' => 'This transaction ID has already been submitted. Each bKash transaction ID can only be used once.',
        ]);

        $package = SubscriptionPackage::findOrFail($validated['package_id']);

        $screenshotPath = null;
        if ($request->hasFile('screenshot')) {
            $screenshotPath = $request->file('screenshot')->store('subscription-payments/' . auth()->id(), 'public');
        }

        $payment = SubscriptionPayment::create([
            'user_id' => auth()->id(),
            'package_id' => $package->id,
            'amount' => $package->price,
            'payment_method' => 'bkash_manual',
            'sender_bkash_number' => $validated['sender_bkash_number'],
            'trx_id' => $validated['trx_id'],
            'screenshot_path' => $screenshotPath,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payment submitted. It will be reviewed shortly.',
            'data' => $payment,
        ], 201);
    }
}
