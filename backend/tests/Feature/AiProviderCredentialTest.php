<?php

namespace Tests\Feature;

use App\Models\AiProviderCredential;
use App\Models\PlatformAiSupportSetting;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Support\AiProviders\AiProviderClient;
use App\Services\Support\AiProviders\AiProviderClientFactory;
use App\Services\Support\AiProviders\AnthropicProviderClient;
use App\Services\Support\AiProviders\GeminiProviderClient;
use App\Services\Support\AiProviders\OpenAiCompatibleProviderClient;
use App\Services\Support\AiProviders\RotatingProviderClient;
use App\Services\Support\AiSupportAgentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Multi-provider AI agent — support_ticketing_ai_context.md. Covers the
 * provider-selection/credential-storage layer only; the actual per-provider
 * HTTP calls are never exercised here (no real API hit in CI).
 */
class AiProviderCredentialTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_never_echoes_the_real_key(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        AiProviderCredential::create(['provider' => 'gemini', 'api_key' => 'super-secret-key-1234']);

        $response = $this->getJson('/api/admin/ai-providers')->assertOk();

        $providers = collect($response->json('data'))->keyBy('provider');
        $this->assertCount(5, $providers);
        $geminiKeys = $providers['gemini']['keys'];
        $this->assertCount(1, $geminiKeys);
        $this->assertTrue($geminiKeys[0]['has_key']);
        $this->assertSame('••••1234', $geminiKeys[0]['masked_key']);
        $this->assertCount(0, $providers['openai']['keys']);
        $this->assertStringNotContainsString('super-secret-key', json_encode($response->json()));
    }

    public function test_store_adds_a_key_without_touching_others_on_the_same_provider(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/admin/ai-providers/groq', ['label' => 'Key 1', 'api_key' => 'groq-key-aaaa', 'default_model' => 'openai/gpt-oss-120b'])
            ->assertOk()
            ->assertJsonPath('data.has_key', true)
            ->assertJsonPath('data.default_model', 'openai/gpt-oss-120b');

        $this->postJson('/api/admin/ai-providers/groq', ['label' => 'Key 2', 'api_key' => 'groq-key-bbbb'])
            ->assertOk();

        $this->assertCount(2, AiProviderCredential::where('provider', 'groq')->get());
        $this->assertSame('groq-key-aaaa', AiProviderCredential::where('label', 'Key 1')->first()->api_key);
        $this->assertSame('groq-key-bbbb', AiProviderCredential::where('label', 'Key 2')->first()->api_key);
    }

    public function test_store_rejects_an_unknown_provider(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/admin/ai-providers/made-up-provider', ['api_key' => 'x'])->assertNotFound();
    }

    public function test_update_by_id_changes_only_the_targeted_key_and_omitting_api_key_keeps_it(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $key = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'groq-key-aaaa', 'label' => 'Key 1']);

        $this->putJson("/api/admin/ai-providers/keys/{$key->id}", ['default_model' => 'openai/gpt-oss-20b'])
            ->assertOk()
            ->assertJsonPath('data.has_key', true)
            ->assertJsonPath('data.default_model', 'openai/gpt-oss-20b');

        $this->assertSame('groq-key-aaaa', $key->fresh()->api_key);
    }

    public function test_destroy_removes_only_that_key(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $keep = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k1']);
        $remove = AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k2']);

        $this->deleteJson("/api/admin/ai-providers/keys/{$remove->id}")->assertOk();

        $this->assertModelExists($keep);
        $this->assertModelMissing($remove);
    }

    public function test_ai_support_settings_validate_the_provider_field(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/settings/ai-support', [
            'is_enabled' => true, 'provider' => 'not-a-real-provider', 'effort' => 'medium', 'model' => 'x',
        ])->assertStatus(422);

        $this->putJson('/api/admin/settings/ai-support', [
            'is_enabled' => true, 'provider' => 'openrouter', 'effort' => 'medium', 'model' => 'meta-llama/llama-3.3-70b-instruct:free',
        ])->assertOk()->assertJsonPath('data.provider', 'openrouter');
    }

    // -- Factory --------------------------------------------------------------

    public function test_factory_returns_null_when_the_selected_provider_has_no_key(): void
    {
        $settings = PlatformAiSupportSetting::current();
        $settings->update(['provider' => 'openai']);

        $this->assertNull(app(AiProviderClientFactory::class)->make($settings));
    }

    public function test_factory_builds_the_matching_adapter_per_provider(): void
    {
        AiProviderCredential::create(['provider' => 'anthropic', 'api_key' => 'k']);
        AiProviderCredential::create(['provider' => 'gemini', 'api_key' => 'k']);
        AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k']);

        $factory = app(AiProviderClientFactory::class);
        $settings = PlatformAiSupportSetting::current();

        $settings->update(['provider' => 'anthropic']);
        $this->assertInstanceOf(AnthropicProviderClient::class, $factory->make($settings));

        $settings->update(['provider' => 'gemini']);
        $this->assertInstanceOf(GeminiProviderClient::class, $factory->make($settings));

        $settings->update(['provider' => 'groq']);
        $this->assertInstanceOf(OpenAiCompatibleProviderClient::class, $factory->make($settings));
    }

    public function test_factory_wraps_multiple_keys_for_the_same_provider_in_a_rotating_client(): void
    {
        AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k1']);
        AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'k2']);

        $settings = PlatformAiSupportSetting::current();
        $settings->update(['provider' => 'groq']);

        $this->assertInstanceOf(RotatingProviderClient::class, app(AiProviderClientFactory::class)->make($settings));
    }

    public function test_factory_skips_a_key_with_no_api_key_saved(): void
    {
        AiProviderCredential::create(['provider' => 'groq', 'label' => 'empty', 'api_key' => null]);
        AiProviderCredential::create(['provider' => 'groq', 'api_key' => 'real-key']);

        $settings = PlatformAiSupportSetting::current();
        $settings->update(['provider' => 'groq']);

        // Only one usable key -> a bare adapter, not a rotating wrapper.
        $this->assertInstanceOf(OpenAiCompatibleProviderClient::class, app(AiProviderClientFactory::class)->make($settings));
    }

    // -- Safety net: a provider that returns null without throwing must never
    // read as silence to the seller (this is exactly what happened live —
    // GeminiProviderClient logged an HTTP error and returned null, and the
    // orchestrator did nothing at all with it). ---------------------------

    public function test_a_provider_returning_null_still_gets_a_fallback_reply_and_escalation(): void
    {
        PlatformAiSupportSetting::current()->update(['is_enabled' => true, 'provider' => 'anthropic']);
        AiProviderCredential::create(['provider' => 'anthropic', 'api_key' => 'k']);

        $silentProvider = new class implements AiProviderClient
        {
            public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
            {
                return null; // simulates a logged HTTP failure or an empty model response
            }
        };
        $this->mock(AiProviderClientFactory::class, function ($mock) use ($silentProvider) {
            $mock->shouldReceive('make')->andReturn($silentProvider);
        });

        $seller = User::factory()->create(['role' => 'user']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000010', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);

        app(AiSupportAgentService::class)->respondToTicket($ticket);

        $ticket->refresh();
        $this->assertSame(1, $ticket->messages()->where('sender_type', 'ai')->count());
        $this->assertTrue($ticket->escalated);
    }
}
