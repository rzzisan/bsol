<?php

namespace App\Services\Support\AiProviders;

/**
 * Thrown by an adapter when a specific API key is the reason a request
 * failed (rate limit, invalid/revoked key) — as opposed to the request
 * itself being bad (wrong model name, malformed payload), which stays a
 * plain \Throwable no rotation would fix. RotatingProviderClient catches
 * this one and tries the provider's next key. support_ticketing_ai_context.md
 * §"multi-key rotation".
 */
class AiProviderRateLimitedException extends \RuntimeException
{
    public function __construct(string $message, public readonly ?int $retryAfterSeconds = null, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }
}
