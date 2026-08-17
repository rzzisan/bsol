<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentGatewaySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Seller-facing configuration for customer-facing online payment channels —
 * see online_payment_context.md. Mirrors CourierController's
 * getSettings/saveSettings shape exactly.
 */
class PaymentGatewaySettingController extends Controller
{
    public function getSettings(): JsonResponse
    {
        $settings = PaymentGatewaySetting::firstOrNew(['user_id' => auth()->user()->shopOwnerId()]);

        return response()->json([
            'success' => true,
            'data' => $settings->exists ? $settings->masked() : null,
        ]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bkash_personal_enabled' => 'boolean',
            'bkash_personal_number' => 'nullable|string|max:20',
            'nagad_personal_enabled' => 'boolean',
            'nagad_personal_number' => 'nullable|string|max:20',
            'rocket_personal_enabled' => 'boolean',
            'rocket_personal_number' => 'nullable|string|max:20',
            // sslcommerz_*/bkash_gateway_* accepted but unused until Phase B/C
            // ship their gateway clients — validated now so the settings page
            // can add those cards later without another migration/route change.
            'sslcommerz_enabled' => 'boolean',
            'sslcommerz_store_id' => 'nullable|string|max:200',
            'sslcommerz_store_password' => 'nullable|string|max:200',
            'sslcommerz_is_live' => 'boolean',
            'bkash_gateway_enabled' => 'boolean',
            'bkash_gateway_api_type' => 'nullable|in:tokenized,pgw',
            'bkash_gateway_username' => 'nullable|string|max:200',
            'bkash_gateway_password' => 'nullable|string|max:200',
            'bkash_gateway_app_key' => 'nullable|string|max:200',
            'bkash_gateway_app_secret' => 'nullable|string|max:200',
            'bkash_gateway_is_live' => 'boolean',
        ]);

        $existing = PaymentGatewaySetting::firstOrNew(['user_id' => auth()->user()->shopOwnerId()]);

        foreach ($data as $field => $value) {
            // Skip masked placeholders coming back from a GET response.
            if ($value !== null && is_string($value) && str_contains($value, '***')) {
                continue;
            }
            $existing->$field = $value;
        }
        $existing->user_id = auth()->user()->shopOwnerId();
        $existing->save();

        return response()->json(['success' => true, 'data' => $existing->masked()]);
    }
}
