<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AiProviderCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super-admin CRUD for the LLM provider API keys AiSupportAgentService picks
 * from (platform_ai_support_settings.provider selects which one is active).
 * support_ticketing_ai_context.md. Real keys are never returned — only a
 * has_key flag and a masked last-4 preview.
 */
class AiProviderCredentialController extends Controller
{
    public function index(): JsonResponse
    {
        $existing = AiProviderCredential::whereIn('provider', AiProviderCredential::PROVIDERS)->get()->keyBy('provider');

        $data = collect(AiProviderCredential::PROVIDERS)->map(function (string $provider) use ($existing) {
            $credential = $existing->get($provider);

            return [
                'provider' => $provider,
                'has_key' => (bool) $credential?->api_key,
                'masked_key' => $credential?->maskedKey(),
                'default_model' => $credential?->default_model,
            ];
        })->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function update(Request $request, string $provider): JsonResponse
    {
        abort_unless(in_array($provider, AiProviderCredential::PROVIDERS, true), 404);

        $data = $request->validate([
            'api_key' => ['nullable', 'string', 'max:500'],
            'default_model' => ['nullable', 'string', 'max:100'],
        ]);

        $credential = AiProviderCredential::firstOrNew(['provider' => $provider]);

        // Omitting api_key (or sending it blank) keeps the existing saved key —
        // lets the admin update just the default model without re-pasting it.
        if (! empty($data['api_key'])) {
            $credential->api_key = $data['api_key'];
        }
        $credential->default_model = $data['default_model'] ?? $credential->default_model;
        $credential->updated_by = auth()->id();
        $credential->save();

        return response()->json([
            'success' => true,
            'data' => [
                'provider' => $provider,
                'has_key' => (bool) $credential->api_key,
                'masked_key' => $credential->maskedKey(),
                'default_model' => $credential->default_model,
            ],
        ]);
    }
}
