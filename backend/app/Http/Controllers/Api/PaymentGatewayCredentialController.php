<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentGatewayCredential;
use App\Services\Payment\PaymentGatewayFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Seller-facing configuration for automated merchant-gateway providers
 * (SSLCommerz and friends) — Phase B/C of online payment. See
 * online_payment_context.md. Distinct from PaymentGatewaySettingController
 * (Phase A wallet_manual settings) since the credential shape here is
 * per-provider and normalized, not a fixed column set.
 */
class PaymentGatewayCredentialController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = PaymentGatewayCredential::where('user_id', auth()->user()->shopOwnerId())->get();

        return response()->json([
            'success' => true,
            'data' => [
                'supported_providers' => PaymentGatewayFactory::supportedProviders(),
                'credentials' => $rows->map(fn (PaymentGatewayCredential $row) => $row->masked())->values(),
            ],
        ]);
    }

    public function save(Request $request, string $provider): JsonResponse
    {
        if (! in_array($provider, PaymentGatewayCredential::PROVIDERS, true)) {
            return response()->json(['success' => false, 'message' => 'Unknown provider.'], 404);
        }

        $data = $request->validate([
            'enabled' => 'boolean',
            'is_live' => 'boolean',
            'credentials' => 'nullable|array',
            'credentials.*' => 'nullable|string|max:1000',
        ]);

        $existing = PaymentGatewayCredential::firstOrNew([
            'user_id' => auth()->user()->shopOwnerId(),
            'provider' => $provider,
        ]);

        // Skip masked placeholders coming back from a GET response, same
        // convention as PaymentGatewaySettingController/CourierController —
        // merge onto the existing decrypted values rather than overwrite,
        // so re-saving the form without touching a field doesn't blank it.
        $incoming = collect($data['credentials'] ?? [])
            ->reject(fn ($value) => is_string($value) && str_contains($value, '***'));
        $existing->credentials = array_merge($existing->credentials ?? [], $incoming->all());

        $existing->enabled = $data['enabled'] ?? $existing->enabled ?? false;
        $existing->is_live = $data['is_live'] ?? $existing->is_live ?? false;
        $existing->user_id = auth()->user()->shopOwnerId();
        $existing->provider = $provider;
        $existing->save();

        return response()->json(['success' => true, 'data' => $existing->masked()]);
    }
}
