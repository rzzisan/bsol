<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Where a seller's tracking events are sent — pixel/CAPI credentials plus
 * the scope they apply to (tracking_capi_context.md §4.1). Successor to
 * FacebookPixelSetting, which allowed only one per seller.
 *
 * Pattern B (owner-only): these are credentials, so they hang off
 * shopOwnerId() and staff never manage them.
 */
class TrackingDestination extends Model
{
    protected $fillable = [
        'user_id', 'provider', 'label', 'pixel_id', 'access_token', 'test_event_code',
        'enabled', 'scope_type', 'scope_id', 'consent_mode', 'last_sent_at', 'last_error',
    ];

    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'enabled' => 'boolean',
            'scope_id' => 'integer',
            'last_sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Enabled and actually usable — credentials missing means nothing can be sent. */
    public function scopeSendable(Builder $query): Builder
    {
        return $query->where('enabled', true)
            ->whereNotNull('pixel_id')
            ->whereNotNull('access_token');
    }

    /**
     * Every destination that should receive an event from this scope: the
     * shop-wide ones plus any pinned to this specific landing page or
     * connected WooCommerce site.
     *
     * Callers pass the owner id (shopOwnerId()), never the acting user's —
     * a staff-triggered event still belongs to the shop.
     *
     * @return Collection<int, self>
     */
    public static function sendableFor(int $ownerId, ?string $scopeType = null, ?int $scopeId = null): Collection
    {
        return static::query()
            ->sendable()
            ->where('user_id', $ownerId)
            ->where(function (Builder $q) use ($scopeType, $scopeId) {
                $q->whereNull('scope_type');

                if ($scopeType !== null && $scopeId !== null) {
                    $q->orWhere(fn (Builder $scoped) => $scoped
                        ->where('scope_type', $scopeType)
                        ->where('scope_id', $scopeId));
                }
            })
            ->orderBy('id')
            ->get();
    }

    /**
     * Safe-for-frontend representation — the access token never round-trips,
     * only whether one is set (same shape FacebookPixelSetting::masked()
     * already returns, so the settings UI reads the same either way).
     */
    public function masked(): array
    {
        return [
            'id' => $this->id,
            'provider' => $this->provider,
            'label' => $this->label,
            'pixel_id' => $this->pixel_id,
            'access_token_set' => (bool) $this->access_token,
            'test_event_code' => $this->test_event_code,
            'enabled' => $this->enabled,
            'scope_type' => $this->scope_type,
            'scope_id' => $this->scope_id,
            'consent_mode' => $this->consent_mode,
            'last_sent_at' => $this->last_sent_at,
            'last_error' => $this->last_error,
        ];
    }
}
