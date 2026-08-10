<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'module_key', 'enabled'])]
class StaffPermission extends Model
{
    /** Canonical module keys — Phase 1 (core) + Phase 2 (added later, kept here as the
     *  single source of truth so the frontend permission grid and backend middleware
     *  never drift). "staff" is deliberately never a module key — team management
     *  always stays hard owner-only, see staff_team_role_context.md §3.1. */
    public const MODULE_KEYS = [
        'orders',
        'products',
        'customers',
        'courier',
        'sms',
        'accounting',
        'analytics',
        'landing_pages',
        'fraud',
        'facebook',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
