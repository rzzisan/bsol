<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One row per sensitive admin action — security_hardening_context.md.
 * Write-only from the app's own controllers (via AdminAuditLogger), never
 * client-writable; read-only in the admin UI.
 */
#[Fillable(['admin_user_id', 'action', 'target_type', 'target_id', 'meta', 'ip_address'])]
class AdminAuditLog extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'meta' => 'array',
        ];
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}
