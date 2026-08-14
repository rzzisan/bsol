<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A subdomain label that was once claimed and has been released. Rows are
 * written on release and never deleted — see the migration for why
 * (custom_domain_context.md §5.2).
 */
class SubdomainTombstone extends Model
{
    protected $fillable = ['label', 'user_id', 'released_at'];

    protected function casts(): array
    {
        return ['released_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
