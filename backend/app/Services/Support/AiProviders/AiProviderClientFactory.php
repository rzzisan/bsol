<?php

namespace App\Services\Support\AiProviders;

use Anthropic\Client as AnthropicClient;
use App\Models\AiProviderCredential;
use App\Models\PlatformAiSupportSetting;

/**
 * Resolves the currently-selected provider (platform_ai_support_settings.provider)
 * to its saved credential and builds the matching adapter. Returns null when
 * that provider has no key saved yet — AiSupportAgentService treats a null
 * client exactly like "disabled". support_ticketing_ai_context.md.
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
        $credential = AiProviderCredential::where('provider', $settings->provider)->first();

        if ($credential === null || ! $credential->api_key) {
            return null;
        }

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
            default => null,
        };
    }
}
