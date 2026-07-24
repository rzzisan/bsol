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

    public function __construct(private readonly GrapesJsContentSerializer $contentSerializer) {}

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
        $draft = LandingPageEditorDraft::where([
            'landing_page_id' => $pageId,
            'user_id' => $userId,
        ])->first();

        $isEmptyDraft = !$draft || (
            (empty($draft->components_json) || $draft->components_json === '[]')
            && empty($draft->html_output)
        );

        // If no draft exists yet, or the existing draft never received any
        // real content, seed it from the landing page's current content so
        // the visual editor doesn't open to a blank canvas.
        if ($isEmptyDraft) {
            $page = LandingPage::find($pageId);
            $seed = $page ? $this->renderContentHtml($page) : ['html' => '', 'css' => ''];

            $draft = LandingPageEditorDraft::updateOrCreate(
                [
                    'landing_page_id' => $pageId,
                    'user_id' => $userId,
                ],
                [
                    'components_json' => null,
                    'styles_json' => null,
                    'html_output' => $seed['html'],
                    'css_output' => $seed['css'],
                    'metadata' => $draft->metadata ?? [],
                ]
            );
        }

        return $draft;
    }

    /**
     * Render the page's existing structured content (hero, html sections,
     * carousels, features, FAQ, reviews) into a plain HTML/CSS fragment the
     * editor can seed itself with. Feature/review/carousel blocks are marked
     * up with the same data-content-* attributes their GrapesJS component
     * types use (grapesjs-elements/content-blocks.ts), so a save round-trips
     * back into structured `content` arrays via GrapesJsContentSerializer
     * instead of being flattened into opaque HTML the first time a
     * Quick-Edit-authored page is opened in the visual editor. Excludes the
     * checkout form and product list, which stay server-rendered and aren't
     * user-editable here.
     */
    private function renderContentHtml(LandingPage $page): array
    {
        $content = $page->content ?? [];
        $theme = $page->theme_settings ?? [];

        $primary = e($theme['primary_color'] ?? '#0f766e');
        $accent = e($theme['accent_color'] ?? '#f97316');
        $bg = e($theme['background_color'] ?? '#f8fafc');
        $text = e($theme['text_color'] ?? '#0f172a');
        $btnText = e($theme['button_text_color'] ?? '#ffffff');

        $headline = e(data_get($content, 'hero.headline', $page->title));
        $subheadline = e(data_get($content, 'hero.subheadline', ''));
        $cta = e(data_get($content, 'hero.cta_text', 'অর্ডার করতে চাই'));

        $html = '<header class="hero"><div class="container">'
            . '<h1>' . $headline . '</h1>'
            . '<p>' . $subheadline . '</p>'
            . '<a href="#checkout" class="btn">' . $cta . '</a>'
            . '</div></header>';

        $html .= '<div class="container" style="padding:20px 16px 40px;">';

        foreach ((array) data_get($content, 'html_sections', []) as $section) {
            $title = $section['title'] ?? '';
            $sectionHtml = $section['html'] ?? '';
            $html .= '<section class="card">';
            if ($title !== '') {
                $html .= '<h2 class="section-title">' . e($title) . '</h2>';
            }
            $html .= '<div>' . $sectionHtml . '</div>';
            $html .= '</section>';
        }

        $carousels = (array) data_get($content, 'carousel_images', []);
        foreach ($carousels as $carousel) {
            $title = e($carousel['title'] ?? '');
            $html .= '<div data-content-carousel="true" data-carousel-title="' . $title . '" style="padding:16px;background:#f8fafc;border-radius:8px;margin-bottom:12px;">';
            $html .= '<p style="font-weight:600;margin:0 0 8px;">🖼️ ' . $title . '</p>';
            $html .= '<div data-carousel-images="true" style="display:flex;gap:8px;flex-wrap:wrap;min-height:80px;border:1px dashed #94a3b8;padding:8px;">';
            foreach ((array) ($carousel['images'] ?? []) as $image) {
                $html .= '<img src="' . e($image['url'] ?? '') . '" alt="' . e($image['alt'] ?? '') . '" style="max-width:100%;height:auto;width:120px;" />';
            }
            $html .= '</div></div>';
        }

        $features = (array) data_get($content, 'features', []);
        foreach ($features as $feature) {
            $html .= '<div data-content-feature="true" style="padding:20px;background:#fff;border-radius:8px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:12px;">'
                . '<h3 data-field="title" style="font-size:18px;font-weight:600;margin:0 0 8px;">' . e($feature['title'] ?? '') . '</h3>'
                . '<p data-field="description" style="color:#6b7280;margin:0;">' . e($feature['description'] ?? '') . '</p>'
                . '</div>';
        }

        $faqs = (array) data_get($content, 'faq', []);
        if (!empty($faqs)) {
            $html .= '<section class="card"><h2 class="section-title">সাধারণ প্রশ্ন</h2>';
            foreach ($faqs as $faq) {
                $html .= '<details style="margin-bottom:8px;">'
                    . '<summary style="font-weight:700;cursor:pointer;">' . e($faq['q'] ?? '') . '</summary>'
                    . '<p>' . e($faq['a'] ?? '') . '</p>'
                    . '</details>';
            }
            $html .= '</section>';
        }

        $reviews = (array) data_get($content, 'reviews', []);
        foreach ($reviews as $review) {
            $html .= '<div data-content-review="true" style="padding:20px;background:#f9fafb;border-left:4px solid #3B82F6;border-radius:8px;margin-bottom:12px;">'
                . '<p data-field="quote" style="margin:0 0 8px;color:#374151;">' . e($review['quote'] ?? '') . '</p>'
                . '<p data-field="name" style="margin:0;font-weight:600;">' . e($review['name'] ?? '') . '</p>'
                . '</div>';
        }

        $html .= '</div>';

        $css = ':root {'
            . '--primary: ' . $primary . ';'
            . '--accent: ' . $accent . ';'
            . '--bg: ' . $bg . ';'
            . '--text: ' . $text . ';'
            . '--btn-text: ' . $btnText . ';'
            . '}'
            . '.hero { background: linear-gradient(135deg, var(--primary), #0b3b36); color: #fff; padding: 48px 0; text-align: center; }'
            . '.hero h1 { font-size: clamp(30px, 5vw, 48px); margin: 0 0 10px; }'
            . '.hero p { margin: 0 0 24px; font-size: clamp(16px, 2.5vw, 22px); }'
            . '.btn { display: inline-block; padding: 12px 22px; border: 0; border-radius: 10px; background: var(--accent); color: var(--btn-text); font-size: 18px; font-weight: 600; text-decoration: none; cursor: pointer; }'
            . '.card { background: #fff; border-radius: 14px; box-shadow: 0 10px 30px rgba(15, 23, 42, .08); padding: 18px; margin: 16px 0; }'
            . '.section-title { font-size: 30px; margin: 18px 0; color: var(--primary); text-align: center; }'
            . '.container { max-width: 980px; margin: 0 auto; padding: 0 16px; }';

        if ($page->custom_css) {
            $css .= "\n" . $page->custom_css;
        }

        return ['html' => $html, 'css' => $css];
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

        // Keep the public page's `content` in sync with every autosave, not
        // just on publish, so a mid-edit preview reflects the latest canvas.
        $page = LandingPage::find($pageId);
        if ($page && !empty($data['html_output'])) {
            $page->update([
                'content' => $this->contentSerializer->toContent(
                    $data['html_output'] ?? null,
                    $data['css_output'] ?? null,
                    $page->content ?? []
                ),
            ]);
        }

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
            // components_json/styles_json are NOT NULL columns; a draft seeded
            // from html_output only (no real GrapesJS component tree yet) has
            // null here, so fall back to empty-but-valid JSON.
            'components_json' => $draft->components_json ?? '[]',
            'styles_json' => $draft->styles_json ?? '{}',
            'version_name' => "Version " . ($latestVersion + 1),
        ]);

        // Update page — also translate the draft into `content`, which is
        // what the public page actually renders. Previously only
        // `editor_state` was written here, so Publish silently had no
        // effect on the live page.
        $page->update([
            'status' => 'published',
            'published_at' => now(),
            'editor_state' => [
                'components' => $draft->components_json,
                'styles' => $draft->styles_json,
                'html' => $draft->html_output,
                'css' => $draft->css_output,
            ],
            'content' => $this->contentSerializer->toContent(
                $draft->html_output,
                $draft->css_output,
                $page->content ?? []
            ),
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
