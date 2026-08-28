<?php

namespace Tests\Feature;

use App\Models\AiProviderCredential;
use App\Models\PlatformAiSupportSetting;
use App\Models\User;
use App\Services\Support\AiProviders\AiProviderClientFactory;
use App\Services\Support\AiProviders\AnthropicProviderClient;
use App\Services\Support\AiProviders\GeminiProviderClient;
use App\Services\Support\AiProviders\OpenAiCompatibleProviderClient;
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
        $this->assertTrue($providers['gemini']['has_key']);
        $this->assertSame('••••1234', $providers['gemini']['masked_key']);
        $this->assertFalse($providers['openai']['has_key']);
        $this->assertStringNotContainsString('super-secret-key', json_encode($response->json()));
    }

    public function test_update_saves_a_new_key_and_omitting_it_keeps_the_existing_one(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/ai-providers/groq', ['api_key' => 'groq-key-aaaa', 'default_model' => 'llama-3.3-70b-versatile'])
            ->assertOk()
            ->assertJsonPath('data.has_key', true)
            ->assertJsonPath('data.default_model', 'llama-3.3-70b-versatile');

        // Updating just the model shouldn't wipe the previously saved key.
        $this->putJson('/api/admin/ai-providers/groq', ['default_model' => 'llama-3.1-8b-instant'])
            ->assertOk()
            ->assertJsonPath('data.has_key', true)
            ->assertJsonPath('data.default_model', 'llama-3.1-8b-instant');

        $this->assertSame('groq-key-aaaa', AiProviderCredential::where('provider', 'groq')->first()->api_key);
    }

    public function test_update_rejects_an_unknown_provider(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/ai-providers/made-up-provider', ['api_key' => 'x'])->assertNotFound();
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
}
