<?php

namespace App\Http\Controllers;

use App\Models\PlatformBillingSetting;
use App\Models\SubscriptionPayment;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSubscriptionController extends Controller
{
    public function __construct(private readonly NotificationDispatchService $notificationDispatchService) {}

    public function getBillingSettings(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => PlatformBillingSetting::getSetting(),
        ]);
    }

    public function updateBillingSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bkash_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9]{11}$/'],
            'bkash_type' => ['required', Rule::in(['Personal', 'Merchant', 'Agent'])],
        ]);

        $setting = PlatformBillingSetting::getSetting();
        $setting->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Billing settings updated successfully.',
            'data' => $setting,
        ]);
    }

    public function listPayments(Request $request): JsonResponse
    {
        $query = SubscriptionPayment::query()
            ->with(['user:id,name,mobile,email', 'package:id,name,slug,price', 'reviewer:id,name']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $payments = $query->latest()->paginate(min((int) ($request->per_page ?? 20), 100));

        return response()->json([
            'success' => true,
            'data' => $payments->items(),
            'meta' => [
                'total' => $payments->total(),
                'current_page' => $payments->currentPage(),
                'last_page' => $payments->lastPage(),
            ],
        ]);
    }

    public function approvePayment(SubscriptionPayment $payment): JsonResponse
    {
        if ($payment->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending payments can be approved.',
            ], 422);
        }

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

        $payment->update([
            'status' => 'approved',
            'reviewed_by' => auth()->id(),
            'reviewed_at' => now(),
        ]);

        try {
            $this->notificationDispatchService->dispatch($user, 'subscription_payment_approved', $user->mobile, $user->email, [
                'package_name' => $package->name,
                'ends_at' => $user->subscription_ends_at?->toDateString(),
            ]);
        } catch (\Throwable) {
            // Notification is best-effort; approval must not fail because of it.
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment approved and subscription activated.',
            'data' => $payment->fresh(['user', 'package']),
        ]);
    }

    public function rejectPayment(Request $request, SubscriptionPayment $payment): JsonResponse
    {
        if ($payment->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending payments can be rejected.',
            ], 422);
        }

        $validated = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $payment->update([
            'status' => 'rejected',
            'admin_note' => $validated['admin_note'] ?? null,
            'reviewed_by' => auth()->id(),
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payment rejected.',
            'data' => $payment->fresh(['user', 'package']),
        ]);
    }
}
