<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformPaymentGatewayCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin CRUD for the platform's own merchant-gateway credentials (6 of the
 * 7 providers PaymentGatewayCredentialController offers sellers, for
 * seller→platform billing instead of customer→seller checkout — bKash
 * Merchant is deliberately excluded here, see PlatformPaymentGatewayCredential's
 * docblock and online_payment_context.md §13.2; it's configured on
 * /admin/billing-settings instead). Mirrors PaymentGatewayCredentialController
 * almost exactly, minus the per-seller user_id scoping.
 */
class PlatformPaymentGatewayController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = PlatformPaymentGatewayCredential::all();

        return response()->json([
            'success' => true,
            'data' => [
                'supported_providers' => PlatformPaymentGatewayCredential::PROVIDERS,
                'credentials' => $rows->map(fn (PlatformPaymentGatewayCredential $row) => $row->masked())->values(),
            ],
        ]);
    }

    public function save(Request $request, string $provider): JsonResponse
    {
        if (! in_array($provider, PlatformPaymentGatewayCredential::PROVIDERS, true)) {
            return response()->json(['success' => false, 'message' => 'Unknown provider.'], 404);
        }

        $data = $request->validate([
            'enabled' => 'boolean',
            'is_live' => 'boolean',
            'credentials' => 'nullable|array',
            'credentials.*' => 'nullable|string|max:1000',
        ]);

        $existing = PlatformPaymentGatewayCredential::firstOrNew(['provider' => $provider]);

        // Skip masked placeholders coming back from a GET response — same
        // merge-onto-existing convention as the seller-facing controller.
        $incoming = collect($data['credentials'] ?? [])
            ->reject(fn ($value) => is_string($value) && str_contains($value, '***'));
        $existing->credentials = array_merge($existing->credentials ?? [], $incoming->all());

        $existing->enabled = $data['enabled'] ?? $existing->enabled ?? false;
        $existing->is_live = $data['is_live'] ?? $existing->is_live ?? false;
        $existing->provider = $provider;
        $existing->save();

        return response()->json(['success' => true, 'data' => $existing->masked()]);
    }
}
