<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LandingPage extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'template_id',
        'title',
        'slug',
        'status',
        'admin_locked',
        'admin_lock_reason',
        'admin_locked_at',
        'admin_locked_by',
        'theme_settings',
        'content',
        'seo_meta',
        'custom_css',
        'published_at',
        'editor_state',
        'last_editor_save',
    ];

    protected $casts = [
        'theme_settings' => 'array',
        'content' => 'array',
        'seo_meta' => 'array',
        'published_at' => 'datetime',
        'editor_state' => 'array',
        'last_editor_save' => 'datetime',
        'admin_locked' => 'boolean',
        'admin_locked_at' => 'datetime',
    ];

    /**
     * Per-request memo of owner id -> subdomain host, so rendering a list of
     * pages doesn't fire one ShopProfile query per row.
     *
     * @var array<int, string|null>
     */
    private static array $hostByOwner = [];

    /**
     * The page's canonical public address (custom_domain_context.md §14).
     *
     * Single source of truth: the seller dashboard, the admin list and the
     * abandoned-checkout resume link all read this, so none of them can
     * hand out a /lp/ URL for a page that only exists on a subdomain.
     *
     * Requires user_id to be loaded — partial selects must include it.
     */
    public function canonicalUrl(): string
    {
        $ownerId = self::resolveOwnerId((int) $this->user_id);

        if (! array_key_exists($ownerId, self::$hostByOwner)) {
            self::$hostByOwner[$ownerId] = ShopProfile::where('user_id', $ownerId)
                ->first()?->subdomainHost();
        }

        $host = self::$hostByOwner[$ownerId];

        if ($host) {
            return 'https://' . $host . '/' . $this->slug;
        }

        // Pre-subdomain pages keep their platform URL; a page created after
        // subdomains became mandatory has no legacy_slug and therefore no
        // platform address at all, so fall back to the slug for display.
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $base . '/lp/' . ($this->legacy_slug ?? $this->slug);
    }

    /**
     * Accessor form, so a controller can opt a row into the serialized
     * payload with ->append('public_url'). Deliberately not in $appends:
     * several queries select only id/title/slug, and this needs user_id.
     */
    public function getPublicUrlAttribute(): string
    {
        return $this->canonicalUrl();
    }

    /** Landing pages are Pattern A (creator-owned), so staff rows resolve up. */
    private static function resolveOwnerId(int $userId): int
    {
        return User::find($userId)?->shopOwnerId() ?? $userId;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function adminLockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_locked_by');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(LandingTemplate::class, 'template_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(LandingPageProduct::class)->orderBy('sort_order');
    }
}
