<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A snapshot of a landing page as it was before a save, so a seller can go
 * back to it. Taken in LandingPageController::update() and before a restore.
 */
class LandingPageRevision extends Model
{
    public const UPDATED_AT = null;

    // Older snapshots beyond this are pruned on each new one.
    public const KEEP = 30;

    // Saves closer together than this reuse the latest snapshot instead of
    // taking another, so a burst of edits doesn't push out older history.
    public const MIN_GAP_SECONDS = 120;

    protected $fillable = [
        'landing_page_id',
        'user_id',
        'title',
        'theme_settings',
        'content',
        'seo_meta',
        'custom_css',
        'products',
    ];

    protected $casts = [
        'theme_settings' => 'array',
        'content' => 'array',
        'seo_meta' => 'array',
        'products' => 'array',
        'created_at' => 'datetime',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Stores the page's current state, unless it matches the latest
     * snapshot. With $force false (an ordinary save), also skips it when the
     * latest snapshot is recent.
     */
    public static function snapshot(LandingPage $page, ?int $userId, bool $force = false): ?self
    {
        $latest = null;
        if (! $force) {
            $latest = self::query()->where('landing_page_id', $page->id)->latest('id')->first();
            if ($latest && $latest->created_at && $latest->created_at->gt(now()->subSeconds(self::MIN_GAP_SECONDS))) {
                return null;
            }
        }

        $products = $page->products()
            ->get(['product_id', 'product_variant_id', 'title_override', 'subtitle', 'badge_text', 'price_override', 'default_qty', 'selected_by_default', 'sort_order'])
            ->map(fn (LandingPageProduct $row) => [
                'product_id' => $row->product_id,
                'product_variant_id' => $row->product_variant_id,
                'title_override' => $row->title_override,
                'subtitle' => $row->subtitle,
                'badge_text' => $row->badge_text,
                'price_override' => $row->price_override,
                'default_qty' => $row->default_qty,
                'selected_by_default' => $row->selected_by_default,
                'sort_order' => $row->sort_order,
            ])
            ->all();

        $state = [
            'title' => $page->title,
            'theme_settings' => $page->theme_settings,
            'content' => $page->content,
            'seo_meta' => $page->seo_meta,
            'custom_css' => $page->custom_css,
            'products' => $products,
        ];

        // Nothing changed since the latest snapshot: don't store a copy.
        $latest ??= self::query()->where('landing_page_id', $page->id)->latest('id')->first();
        if ($latest && $latest->only(array_keys($state)) == $state) {
            return null;
        }

        $revision = self::create($state + ['landing_page_id' => $page->id, 'user_id' => $userId]);

        $stale = self::query()
            ->where('landing_page_id', $page->id)
            ->orderByDesc('id')
            ->skip(self::KEEP)
            ->take(PHP_INT_MAX)
            ->pluck('id');
        if ($stale->isNotEmpty()) {
            self::query()->whereIn('id', $stale)->delete();
        }

        return $revision;
    }
}
