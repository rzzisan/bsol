<?php

namespace Tests\Feature;

use App\Models\AiKnowledgeBaseArticle;
use App\Models\PlatformAiSupportSetting;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Support\AiProviders\AiProviderClient;
use App\Services\Support\AiProviders\AiProviderClientFactory;
use App\Services\Support\AiSupportAgentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Platform how-to knowledge base — support_ticketing_ai_context.md
 * §"platform how-to knowledge". Covers the search-scoring logic and the
 * admin CRUD; never touches a real provider.
 */
class AiKnowledgeBaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_update_and_delete_an_article(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $created = $this->postJson('/api/admin/ai-knowledge-base', [
            'slug' => 'test-topic', 'title' => 'Test Topic', 'content' => 'Some help content here.',
        ])->assertOk()->json('data');

        $this->putJson("/api/admin/ai-knowledge-base/{$created['id']}", [
            'slug' => 'test-topic', 'title' => 'Updated Title', 'content' => 'Updated content.',
        ])->assertOk()->assertJsonPath('data.title', 'Updated Title');

        $this->deleteJson("/api/admin/ai-knowledge-base/{$created['id']}")->assertOk();
        $this->assertDatabaseMissing('ai_knowledge_base_articles', ['id' => $created['id']]);
    }

    public function test_slug_must_be_unique(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        AiKnowledgeBaseArticle::create(['slug' => 'a-taken-slug', 'title' => 'X', 'content' => 'x']);

        $this->postJson('/api/admin/ai-knowledge-base', ['slug' => 'a-taken-slug', 'title' => 'Dup', 'content' => 'y'])
            ->assertStatus(422);
    }

    public function test_search_ranks_title_matches_above_body_matches_and_ignores_inactive(): void
    {
        // Distinctive nonsense keyword so this test's matches are never
        // polluted by the migration's real seeded articles.
        AiKnowledgeBaseArticle::create(['slug' => 'zzzquux-title', 'title' => 'zzzquux গাইড', 'content' => 'অপ্রাসঙ্গিক কনটেন্ট।']);
        AiKnowledgeBaseArticle::create(['slug' => 'zzzquux-body', 'title' => 'অসম্পর্কিত শিরোনাম', 'content' => 'এখানে zzzquux শব্দটা উল্লেখ আছে।']);
        AiKnowledgeBaseArticle::create(['slug' => 'zzzquux-inactive', 'title' => 'zzzquux পুরনো', 'content' => 'x', 'is_active' => false]);

        PlatformAiSupportSetting::current()->update(['is_enabled' => true, 'provider' => 'anthropic']);
        \App\Models\AiProviderCredential::create(['provider' => 'anthropic', 'api_key' => 'k']);

        $captured = null;
        $spyProvider = new class($captured) implements AiProviderClient
        {
            public function __construct(private mixed &$captured) {}

            public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
            {
                $this->captured = $executeTool('search_platform_help', ['query' => 'zzzquux']);

                return 'ok';
            }
        };
        $this->mock(AiProviderClientFactory::class, fn ($mock) => $mock->shouldReceive('make')->andReturn($spyProvider));

        $seller = User::factory()->create(['role' => 'user']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000020', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);
        app(AiSupportAgentService::class)->respondToTicket($ticket);

        $results = json_decode($captured, true);
        $this->assertCount(2, $results); // the inactive zzzquux article is excluded
        $this->assertStringContainsString('zzzquux গাইড', $results[0]['title']); // title match ranked above the body-only match
    }
}
