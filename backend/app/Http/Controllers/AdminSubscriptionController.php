<?php

namespace App\Http\Controllers;

use App\Models\PlatformBillingSetting;
use App\Models\SubscriptionPayment;
use App\Services\SubscriptionActivationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSubscriptionController extends Controller
{
    public function __construct(private readonly SubscriptionActivationService $activationService) {}

    public function getBillingSettings(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => PlatformBillingSetting::getSetting()->masked(),
        ]);
    }

    public function updateBillingSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bkash_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9]{11}$/'],
            'bkash_type' => ['required', Rule::in(['Personal', 'Merchant', 'Agent'])],
            'bkash_app_key' => ['nullable', 'string', 'max:255'],
            'bkash_app_secret' => ['nullable', 'string', 'max:255'],
            'bkash_username' => ['nullable', 'string', 'max:255'],
            'bkash_password' => ['nullable', 'string', 'max:255'],
            'bkash_sandbox' => ['nullable', 'boolean'],
            'bkash_api_type' => ['nullable', Rule::in(['tokenized', 'pgw'])],
        ]);

        $setting = PlatformBillingSetting::getSetting();

        // Blank app_secret/password = "leave unchanged" — the real value
        // never round-trips to the frontend (same pattern as
        // PlatformFacebookSettingsController::update()).
        if (! filled($validated['bkash_app_secret'] ?? null)) {
            unset($validated['bkash_app_secret']);
        }
        if (! filled($validated['bkash_password'] ?? null)) {
            unset($validated['bkash_password']);
        }

        $setting->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Billing settings updated successfully.',
            'data' => $setting->fresh()->masked(),
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

        $payment->update([
            'status' => 'approved',
            'reviewed_by' => auth()->id(),
            'reviewed_at' => now(),
        ]);

        $this->activationService->activate($payment);

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
