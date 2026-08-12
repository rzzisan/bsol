<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformApiKey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dashboard-facing management of the seller's WordPress/WooCommerce connector
 * API key (Sanctum + owner_only — Pattern B, staff_team_role_context.md §3.3).
 * Distinct from the plugin-facing /api/connect/v1/* surface, which is
 * API-key-authenticated instead of Sanctum-authenticated.
 * See bsol_history_and_new_context.md §5.
 */
class WordpressApiKeyController extends Controller
{
    public function show(): JsonResponse
    {
        $key = PlatformApiKey::where('user_id', auth()->user()->shopOwnerId())->first();

        if (! $key) {
            return response()->json(['success' => true, 'data' => null]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'platform'      => $key->platform,
                'domain'        => $key->domain,
                'masked_key'    => $key->masked(),
                'status'        => $key->status,
                'last_used_at'  => $key->last_used_at,
                'created_at'    => $key->created_at,
            ],
        ]);
    }

    /**
     * Generate a new key or regenerate/reconnect an existing one — an
     * idempotent upsert on the owner's single row. The raw key is returned
     * exactly once, here; it is never persisted or re-derivable afterward.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => 'required|string|max:255',
        ]);

        $ownerId = auth()->user()->shopOwnerId();
        $rawKey = PlatformApiKey::generateRawKey();

        $key = PlatformApiKey::updateOrCreate(
            ['user_id' => $ownerId],
            [
                'platform'    => 'woocommerce',
                'domain'      => PlatformApiKey::normalizeHost($data['domain']),
                'key_hash'    => PlatformApiKey::hashKey($rawKey),
                'key_prefix'  => substr($rawKey, 0, 12),
                'status'      => 'pending',
                'revoked_at'  => null,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'API key generated. Save it now — it will not be shown again.',
            'data' => [
                'api_key'    => $rawKey,
                'platform'   => $key->platform,
                'domain'     => $key->domain,
                'masked_key' => $key->masked(),
                'status'     => $key->status,
            ],
        ], 201);
    }

    public function destroy(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $key = PlatformApiKey::where('user_id', $ownerId)->first();

        if (! $key) {
            return response()->json(['success' => false, 'message' => 'No API key found.'], 404);
        }

        $key->update(['status' => 'revoked', 'revoked_at' => now()]);

        return response()->json(['success' => true, 'message' => 'API key revoked.']);
    }
}
