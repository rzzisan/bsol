<?php
namespace App\Services;

use App\Models\LandingPage;
use App\Models\LandingPageEditorDraft;
use App\Models\LandingPageVersion;
use Illuminate\Support\Facades\Redis;

class LandingPageEditorService
{
    private const REDIS_DRAFT_KEY = 'landing_editor:draft:%d';
    private const REDIS_DRAFT_TTL = 86400; // 24 hours

    /**
     * Get editor draft (from Redis or database)
     */
    public function getDraft(int $pageId, int $userId): ?LandingPageEditorDraft
    {
        $cacheKey = sprintf(self::REDIS_DRAFT_KEY, $pageId);
        
        // Try Redis first
        $cached = Redis::get($cacheKey);
        if ($cached) {
            return json_decode($cached, true);
        }
        
        // Fall back to database
        return LandingPageEditorDraft::where([
            'landing_page_id' => $pageId,
            'user_id' => $userId,
        ])->first();
    }

    /**
     * Save draft to Redis and database
     */
    public function saveDraft(
        int $pageId,
        int $userId,
        array $data
    ): LandingPageEditorDraft {
        // Update database
        $draft = LandingPageEditorDraft::updateOrCreate(
            [
                'landing_page_id' => $pageId,
                'user_id' => $userId,
            ],
            [
                'components_json' => $data['components_json'] ?? null,
                'styles_json' => $data['styles_json'] ?? null,
                'html_output' => $data['html_output'] ?? null,
                'css_output' => $data['css_output'] ?? null,
                'metadata' => $data['metadata'] ?? null,
                'last_edited_at' => now(),
            ]
        );
        
        // Update Redis cache
        $cacheKey = sprintf(self::REDIS_DRAFT_KEY, $pageId);
        Redis::setex($cacheKey, self::REDIS_DRAFT_TTL, json_encode($draft));
        
        return $draft;
    }

    /**
     * Publish draft (create version and update landing page)
     */
    public function publishDraft(int $pageId, int $userId): LandingPage
    {
        $draft = LandingPageEditorDraft::where([
            'landing_page_id' => $pageId,
            'user_id' => $userId,
        ])->firstOrFail();

        $page = LandingPage::findOrFail($pageId);

        // Create version
        $latestVersion = LandingPageVersion::where('landing_page_id', $pageId)
            ->max('version_number') ?? 0;

        LandingPageVersion::create([
            'landing_page_id' => $pageId,
            'created_by' => $userId,
            'version_number' => $latestVersion + 1,
            'components_json' => $draft->components_json,
            'styles_json' => $draft->styles_json,
            'version_name' => "Version " . ($latestVersion + 1),
        ]);

        // Update page
        $page->update([
            'status' => 'published',
            'published_at' => now(),
            'editor_state' => [
                'components' => $draft->components_json,
                'styles' => $draft->styles_json,
                'html' => $draft->html_output,
                'css' => $draft->css_output,
            ],
        ]);

        // Clear cache
        $cacheKey = sprintf(self::REDIS_DRAFT_KEY, $pageId);
        Redis::del($cacheKey);

        return $page;
    }

    /**
     * Get version history
     */
    public function getVersions(int $pageId, int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return LandingPageVersion::where('landing_page_id', $pageId)
            ->orderByDesc('version_number')
            ->limit($limit)
            ->get();
    }

    /**
     * Rollback to version
     */
    public function rollbackToVersion(int $pageId, int $userId, int $versionNumber): LandingPageEditorDraft
    {
        $version = LandingPageVersion::where([
            'landing_page_id' => $pageId,
            'version_number' => $versionNumber,
        ])->firstOrFail();

        return $this->saveDraft($pageId, $userId, [
            'components_json' => $version->components_json,
            'styles_json' => $version->styles_json,
        ]);
    }
}
