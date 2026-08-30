<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AiProviderCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super-admin CRUD for the LLM provider API keys AiSupportAgentService picks
 * from (platform_ai_support_settings.provider selects which one is active).
 * A provider can hold several keys, rotated on rate-limit
 * (support_ticketing_ai_context.md §"multi-key rotation"). Real keys are
 * never returned — only a has_key flag and a masked last-4 preview.
 */
class AiProviderCredentialController extends Controller
{
    public function index(): JsonResponse
    {
        $existing = AiProviderCredential::whereIn('provider', AiProviderCredential::PROVIDERS)
            ->orderBy('id')
            ->get()
            ->groupBy('provider');

        $data = collect(AiProviderCredential::PROVIDERS)->map(fn (string $provider) => [
            'provider' => $provider,
            'keys' => ($existing->get($provider) ?? collect())->map(fn (AiProviderCredential $c) => $this->present($c))->values(),
        ])->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    /** Adds a new key for the provider — does not touch any existing key. */
    public function store(Request $request, string $provider): JsonResponse
    {
        abort_unless(in_array($provider, AiProviderCredential::PROVIDERS, true), 404);

        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:100'],
            'api_key' => ['required', 'string', 'max:500'],
            'default_model' => ['nullable', 'string', 'max:100'],
        ]);

        $credential = AiProviderCredential::create([
            'provider' => $provider,
            'label' => $data['label'] ?? null,
            'api_key' => $data['api_key'],
            'default_model' => $data['default_model'] ?? null,
            'updated_by' => auth()->id(),
        ]);

        return response()->json(['success' => true, 'data' => $this->present($credential)]);
    }

    public function update(Request $request, AiProviderCredential $key): JsonResponse
    {
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:100'],
            'api_key' => ['nullable', 'string', 'max:500'],
            'default_model' => ['nullable', 'string', 'max:100'],
        ]);

        // Omitting api_key (or sending it blank) keeps the existing saved key —
        // lets the admin update just the label/model without re-pasting it.
        if (! empty($data['api_key'])) {
            $key->api_key = $data['api_key'];
        }
        if (array_key_exists('label', $data)) {
            $key->label = $data['label'];
        }
        if (array_key_exists('default_model', $data)) {
            $key->default_model = $data['default_model'];
        }
        $key->updated_by = auth()->id();
        $key->save();

        return response()->json(['success' => true, 'data' => $this->present($key)]);
    }

    public function destroy(AiProviderCredential $key): JsonResponse
    {
        $key->delete();

        return response()->json(['success' => true]);
    }

    private function present(AiProviderCredential $credential): array
    {
        return [
            'id' => $credential->id,
            'label' => $credential->label,
            'has_key' => (bool) $credential->api_key,
            'masked_key' => $credential->maskedKey(),
            'default_model' => $credential->default_model,
            'rate_limited_until' => $credential->rate_limited_until,
        ];
    }
}
