<?php

namespace App\Services\Support\AiProviders;

use Anthropic\Client as AnthropicClient;
use App\Models\AiProviderCredential;
use App\Models\PlatformAiSupportSetting;

/**
 * Resolves the currently-selected provider (platform_ai_support_settings.provider)
 * to its saved credential(s) and builds the matching adapter. A provider can
 * hold several keys — multiple candidates are wrapped in a
 * RotatingProviderClient so a rate-limited key doesn't fail the whole reply.
 * Returns null when that provider has no key saved yet — AiSupportAgentService
 * treats a null client exactly like "disabled". support_ticketing_ai_context.md.
 */
class AiProviderClientFactory
{
    private const OPENAI_COMPATIBLE_BASE_URLS = [
        'openai' => 'https://api.openai.com/v1',
        'groq' => 'https://api.groq.com/openai/v1',
        'openrouter' => 'https://openrouter.ai/api/v1',
    ];

    public function make(PlatformAiSupportSetting $settings): ?AiProviderClient
    {
        $credentials = AiProviderCredential::where('provider', $settings->provider)
            ->whereNotNull('api_key')
            ->orderBy('id')
            ->get();

        if ($credentials->isEmpty()) {
            return null;
        }

        if ($credentials->count() === 1) {
            return $this->buildAdapter($settings, $credentials->first());
        }

        return new RotatingProviderClient(
            $credentials->map(fn (AiProviderCredential $credential) => [
                'credential' => $credential,
                'build' => fn () => $this->buildAdapter($settings, $credential),
            ])->all(),
        );
    }

    private function buildAdapter(PlatformAiSupportSetting $settings, AiProviderCredential $credential): AiProviderClient
    {
        return match ($settings->provider) {
            'anthropic' => new AnthropicProviderClient(
                new AnthropicClient(apiKey: $credential->api_key),
                $settings->model,
                $settings->effort,
            ),
            'gemini' => new GeminiProviderClient($credential->api_key, $settings->model),
            'openai', 'groq', 'openrouter' => new OpenAiCompatibleProviderClient(
                $settings->provider,
                self::OPENAI_COMPATIBLE_BASE_URLS[$settings->provider],
                $credential->api_key,
                $settings->model,
            ),
            default => throw new \InvalidArgumentException("Unknown AI provider: {$settings->provider}"),
        };
    }
}
