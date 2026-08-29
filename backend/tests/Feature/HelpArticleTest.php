<?php

namespace Tests\Feature;

use App\Models\AiKnowledgeBaseArticle;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Per-page "how do I use this?" help button — reads the same knowledge base
 * the AI agent searches. support_ticketing_ai_context.md.
 */
class HelpArticleTest extends TestCase
{
    use RefreshDatabase;

    public function test_seller_can_read_an_active_article_by_slug(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'user']));
        AiKnowledgeBaseArticle::create(['slug' => 'a-test-topic', 'title' => 'অর্ডার ম্যানেজমেন্ট', 'content' => 'কীভাবে অর্ডার তৈরি করবেন...']);

        $this->getJson('/api/help/a-test-topic')
            ->assertOk()
            ->assertJsonPath('data.title', 'অর্ডার ম্যানেজমেন্ট');
    }

    public function test_inactive_or_missing_slug_returns_404(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'user']));
        AiKnowledgeBaseArticle::create(['slug' => 'draft-topic', 'title' => 'x', 'content' => 'y', 'is_active' => false]);

        $this->getJson('/api/help/draft-topic')->assertNotFound();
        $this->getJson('/api/help/does-not-exist')->assertNotFound();
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/help/orders')->assertUnauthorized();
    }
}
