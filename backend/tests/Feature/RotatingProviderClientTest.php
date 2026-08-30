<?php

namespace Tests\Feature;

use App\Models\AiProviderCredential;
use App\Services\Support\AiProviders\AiProviderClient;
use App\Services\Support\AiProviders\AiProviderRateLimitedException;
use App\Services\Support\AiProviders\RotatingProviderClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Key rotation on rate limit — support_ticketing_ai_context.md
 * §"multi-key rotation". No real provider HTTP calls here, just the
 * rotation logic against fake AiProviderClient implementations.
 */
class RotatingProviderClientTest extends TestCase
{
    use RefreshDatabase;

    private function fakeClient(?string $result, ?\Throwable $throws = null): AiProviderClient
    {
        return new class($result, $throws) implements AiProviderClient
        {
            public function __construct(private readonly ?string $result, private readonly ?\Throwable $throws) {}

            public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
            {
                if ($this->throws !== null) {
                    throw $this->throws;
                }

                return $this->result;
            }
        };
    }

    public function test_falls_through_to_the_second_key_when_the_first_is_rate_limited(): void
    {
        $first = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k1']);
        $second = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k2']);

        $client = new RotatingProviderClient([
            ['credential' => $first, 'build' => fn () => $this->fakeClient(null, new AiProviderRateLimitedException('rate limited', 30))],
            ['credential' => $second, 'build' => fn () => $this->fakeClient('ok from key 2')],
        ]);

        $result = $client->respond('sys', [], [], fn () => 'x');

        $this->assertSame('ok from key 2', $result);
        $this->assertTrue($first->fresh()->isRateLimited());
        $this->assertFalse($second->fresh()->isRateLimited());
    }

    public function test_skips_a_key_already_cooling_down_without_calling_it(): void
    {
        $cooling = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k1', 'rate_limited_until' => now()->addMinutes(5)]);
        $healthy = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k2']);

        $called = false;
        $client = new RotatingProviderClient([
            ['credential' => $cooling, 'build' => function () use (&$called) {
                $called = true;

                return $this->fakeClient('should never be reached');
            }],
            ['credential' => $healthy, 'build' => fn () => $this->fakeClient('ok from healthy key')],
        ]);

        $result = $client->respond('sys', [], [], fn () => 'x');

        $this->assertSame('ok from healthy key', $result);
        $this->assertFalse($called);
    }

    public function test_rethrows_once_every_key_is_exhausted(): void
    {
        $first = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k1']);
        $second = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k2']);

        $client = new RotatingProviderClient([
            ['credential' => $first, 'build' => fn () => $this->fakeClient(null, new AiProviderRateLimitedException('first exhausted'))],
            ['credential' => $second, 'build' => fn () => $this->fakeClient(null, new AiProviderRateLimitedException('second exhausted'))],
        ]);

        $this->expectException(AiProviderRateLimitedException::class);
        $client->respond('sys', [], [], fn () => 'x');
    }
}
