<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformPaymentGatewayCredential;
use App\Services\Payment\PaymentGatewayFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin CRUD for the platform's own merchant-gateway credentials (the same
 * 7 providers as PaymentGatewayCredentialController, but for
 * seller→platform billing instead of customer→seller checkout). See
 * online_payment_context.md §12. Mirrors PaymentGatewayCredentialController
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
                'supported_providers' => PaymentGatewayFactory::supportedProviders(),
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
