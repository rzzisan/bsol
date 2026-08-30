<?php

namespace App\Services\Support\AiProviders;

use App\Models\AiProviderCredential;
use Illuminate\Support\Facades\Log;

/**
 * Wraps several keys for the same provider — tries each in turn, skipping
 * any already in cooldown, and marks a key rate-limited (rather than giving
 * up) when its adapter throws AiProviderRateLimitedException.
 * support_ticketing_ai_context.md §"multi-key rotation".
 */
class RotatingProviderClient implements AiProviderClient
{
    private const DEFAULT_COOLDOWN_SECONDS = 60;

    /** @param list<array{credential: AiProviderCredential, build: \Closure(): AiProviderClient}> $candidates */
    public function __construct(private readonly array $candidates) {}

    public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
    {
        $lastException = null;

        foreach ($this->candidates as $candidate) {
            $credential = $candidate['credential'];

            if ($credential->isRateLimited()) {
                continue;
            }

            try {
                return $candidate['build']()->respond($systemPrompt, $history, $tools, $executeTool);
            } catch (AiProviderRateLimitedException $e) {
                Log::warning('ai_support.key_rotated', [
                    'provider' => $credential->provider, 'credential_id' => $credential->id, 'reason' => $e->getMessage(),
                ]);
                $credential->update(['rate_limited_until' => now()->addSeconds($e->retryAfterSeconds ?? self::DEFAULT_COOLDOWN_SECONDS)]);
                $lastException = $e;
            }
        }

        if ($lastException !== null) {
            throw $lastException; // every key exhausted — outer catch turns this into the standard fallback + escalation
        }

        return null; // every candidate was already cooling down
    }
}
