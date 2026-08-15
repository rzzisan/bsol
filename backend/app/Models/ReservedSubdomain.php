<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A subdomain label sellers may not claim (custom_domain_context.md §5.3).
 *
 * is_system rows are protected from deletion: they cover labels that already
 * resolve in DNS or that mail/infrastructure depends on, and releasing one
 * would let a seller take over a live service.
 */
class ReservedSubdomain extends Model
{
    protected $fillable = ['label', 'reason', 'is_system', 'created_by'];

    protected function casts(): array
    {
        return ['is_system' => 'boolean'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
