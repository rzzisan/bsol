<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Services\AbandonedCheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Plugin-facing WooCommerce checkout-in-progress capture —
 * /api/connect/v1/checkout/abandoned. Delegates to
 * AbandonedCheckoutService::captureWooCommerce() — the same
 * abandoned_checkouts table/dashboard UI landing pages already use (Phase
 * 17, see wordpress_connect_context.md §7.1 item 2 / §9). Best-effort
 * marketing signal, not a transactional payload — validation stays loose
 * (nothing here blocks a real order from syncing if it fails).
 */
class ConnectAbandonedCheckoutController extends Controller
{
    public function __construct(
        private readonly AbandonedCheckoutService $abandonedCheckoutService,
    ) {}

    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_token' => 'required|string|max:64',
            'customer_name' => 'nullable|string|max:150',
            'customer_phone' => 'nullable|string|max:20',
            'customer_email' => 'nullable|string|max:150',
            'customer_address' => 'nullable|string|max:500',
            'items' => 'nullable|array',
            'items.*.name' => 'nullable|string|max:255',
            'items.*.sku' => 'nullable|string|max:100',
            'items.*.quantity' => 'nullable|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.product_link' => 'nullable|string|max:500',
        ]);

        $merchant = auth()->user();
        $apiKey = $request->attributes->get('platform_api_key');

        $this->abandonedCheckoutService->captureWooCommerce(
            $merchant->shopOwnerId(),
            $apiKey?->id,
            $data,
            $request->ip(),
        );

        return response()->json(['success' => true]);
    }
}
